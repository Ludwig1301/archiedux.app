const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const session = require("express-session");
const { createClient } = require("redis");
const { RedisStore } = require("connect-redis");

// Oturumlar Redis'te saklanır; sunucu yeniden başlasa bile üyeler çıkış yapmaz.
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});
redisClient.connect().catch((e) => console.error("Redis bağlantı hatası:", e));
const sessionStore = new RedisStore({ client: redisClient });

for (const envFile of [path.join(__dirname, ".env"), path.join(__dirname, ".env.example")]) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  SESSION_SECRET,
  PORT,
} = process.env;

const DB_PATH = path.join(__dirname, "data", "db.json");

// Yöneticiler: bu kişiler herkesin profilini düzenleyebilir (örn. uygunsuz içeriği temizlemek için)
const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || "152414566133792769")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function adminMi(discordId) {
  return !!discordId && ADMIN_IDS.includes(String(discordId));
}

// ---------- Seviye / XP ----------
// Steam benzeri: seviye N'den N+1'e geçmek için N*100 XP gerekir (1->2: 100, 2->3: 200, ...)
function seviyeHesapla(xp) {
  xp = Math.max(0, xp || 0);
  let seviye = 1;
  let kalan = xp;
  while (kalan >= seviye * 100) {
    kalan -= seviye * 100;
    seviye++;
  }
  return { seviye, mevcut: kalan, gerekli: seviye * 100 };
}

// Profil bölümleri ilk kez tamamlandığında kazanılan XP (farming'i önlemek için bir kez)
const XP_KURALLARI = {
  avatar: 50,
  bio: 50,
  unvan: 30,
  vitrinBaslik: 50,
  kapakFoto: 30,
  arkaplanResim: 30,
  hayvanResmi: 30,
};

// ---------- Easter egg rozetleri ----------
const EASTER_EGGS = {
  "muhr-bekcisi": { ad: "Mühür Bekçisi", aciklama: "Navbardaki mühür logosuna 3 kez sağ tıkladın.", ikon: "🛡️", xp: 100 },
  "retro-oyuncu": { ad: "Retro Oyuncu", aciklama: "Konami kodunu girdin (↑↑↓↓←→←→B A).", ikon: "🎮", xp: 100 },
  "gizli-kelime": { ad: "Gizli Kelime", aciklama: "Sitede 'congress' kelimesini yazdın.", ikon: "🔍", xp: 100 },
};

function getDiscordConfig() {
  const clientId = DISCORD_CLIENT_ID || "";
  const clientSecret = DISCORD_CLIENT_SECRET || "";
  const redirectUri = DISCORD_REDIRECT_URI || "http://localhost:3000/auth/callback";
  const botToken = DISCORD_BOT_TOKEN || "";
  const guildId = DISCORD_GUILD_ID || "";

  return { clientId, clientSecret, redirectUri, botToken, guildId };
}

// ---------- Basit JSON "veritabanı" ----------
function okuDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ profiles: {} }, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  return db;
}

function yazDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function gecerliDiscordId(id) {
  return typeof id === "string" && /^\d{15,20}$/.test(id);
}

// Discord'dan alınamadığında kullanılacak varsayılan avatar (Discord varsayılanlarından)
function varsayilanAvatar(id) {
  const n = Math.abs(parseInt(String(id).slice(-2), 10) || 0) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${n}.png`;
}

function profilGetir(discordId) {
  const db = okuDB();
  // Geçersiz ID'ler için profil oluşturma; bozuk URL'ler veritabanını kirletmesin.
  if (!db.profiles[discordId] && gecerliDiscordId(discordId)) {
    db.profiles[discordId] = {
      bio: "",
      unvan: "",
      vitrinBaslik: "",
      vitrinAciklama: "",
      vitrinResim: "",
      kediResmi: "",
      hayvanBaslik: "",
      hayvanAciklama: "",
      hayvanResmi: "",
      galeriBaslik: "",
      galeriAciklama: "",
      galeriResim: "",
      kapakFoto: "",
      avatar: "",
      aksanRenk: "",
      arkaplanTuru: "renk",
      arkaplanRenk1: "#1c1a12",
      arkaplanRenk2: "#161619",
      arkaplanBlur: "0",
      arkaplanResim: "",
      rozetler: [],
      yorumlar: [],
      galleryEntries: [],
      okunmamisYorum: 0,
      bildirimler: [],
      xp: 0,
      katilimTarihi: new Date().toISOString(),
    };
    yazDB(db);
  }
  // Eski (id'siz) yorumlara silinebilmeleri için birer id ekle
  const profil = db.profiles[discordId] || {};
  if (Array.isArray(profil.yorumlar)) {
    let degisti = false;
    for (const y of profil.yorumlar) {
      if (!y.id) {
        y.id = `yorum-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        degisti = true;
      }
    }
    if (degisti) yazDB(db);
  }
  return profil;
}

function profilGuncelle(discordId, alanlar) {
  const db = okuDB();
  const mevcut = profilGetir(discordId); // varsa oluşturur
  db.profiles[discordId] = { ...mevcut, ...alanlar };
  yazDB(db);
  return db.profiles[discordId];
}

// ---------- Discord API yardımcıları ----------
// Üye bilgisi Discord'dan çekilir; kısa süreli önbellekleme yapılır ki
// F5 ya da geçici Discord hatasında kullanıcı oturum dışına atılmasın.
const UYE_ONBELLEK = new Map();
const UYE_ONBELLEK_SURE = 60 * 1000; // 1 dakika (isim değişiklikleri hızlı yansısın)

async function discordUyeBilgisiCek(discordId, yenile) {
  const onbellek = UYE_ONBELLEK.get(discordId);
  if (!yenile && onbellek && Date.now() - onbellek.zaman < UYE_ONBELLEK_SURE) {
    return onbellek.veri;
  }

  const { botToken, guildId } = getDiscordConfig();

  if (!botToken || !guildId) {
    return onbellek ? onbellek.veri : null;
  }

  // Bot token ile sunucudaki üyeyi çekiyoruz (canlı avatar/isim/rol bilgisi için)
  let veri;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
      headers: { Authorization: `Bot ${botToken}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      // canlı çekilemediyse varsa önbellekteki kopyayı döndür (oturumu koru)
      return onbellek ? onbellek.veri : null;
    }
    veri = await res.json();
  } catch (e) {
    return onbellek ? onbellek.veri : null;
  } finally {
    clearTimeout(timeout);
  }

  const avatarHash = veri.user.avatar;
  const avatarUrl = avatarHash
    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const sonuc = {
    id: discordId,
    kullaniciAdi: veri.nick || veri.user.global_name || veri.user.username,
    avatar: avatarUrl,
    roller: veri.roles || [],
  };

  UYE_ONBELLEK.set(discordId, { zaman: Date.now(), veri: sonuc });
  return sonuc;
}

// ---------- Express kurulumu ----------
const app = express();
app.use(express.json({ limit: "9mb" })); // base64 görsel yüklemeleri için büyütüldü

// Eski .html adresleri temiz adreslere yönlendirilsin (URL'de .html görünmesin).
app.get("/profile.html", (req, res) => res.redirect("/profil"));
app.get("/gallery.html", (req, res) => res.redirect("/galeri"));
app.get("/members.html", (req, res) => res.redirect("/uyeler"));
app.get("/index.html", (req, res) => res.redirect("/"));

// Statik dosyalar hiç önbelleğe alınmasın; güncellemeler anında görünsün.
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: 0,
    setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
  })
);

// Temiz adresler (URL'lerde .html görünmesin) — önbellek kapalı, güncellemeler anında görünsün
const temizSayfa = (dosya) => (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", dosya));
};
app.get("/profil", temizSayfa("profile.html"));
app.get("/galeri", temizSayfa("gallery.html"));
app.get("/uyeler", temizSayfa("members.html"));

const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use(
  session({
    store: sessionStore,
    secret: SESSION_SECRET || "gelistirme-icin-gecici-anahtar",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gün — F5'te çıkış yapılmasın
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  })
);

function girisGerekli(req, res, next) {
  if (!req.session.discordId) {
    return res.status(401).json({ hata: "Giriş yapmalısın." });
  }
  next();
}

// ---------- OAuth2 akışı ----------
app.get("/auth/login", (req, res) => {
  const { clientId, redirectUri } = getDiscordConfig();

  if (!clientId) {
    return res.status(500).send("DISCORD_CLIENT_ID ayarlanmadı. .env dosyasını kontrol et.");
  }

  const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=identify`;
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?hata=kod_yok");

  try {
    const { clientId, clientSecret, redirectUri } = getDiscordConfig();

    if (!clientId || !clientSecret) {
      return res.status(500).send("DISCORD_CLIENT_ID veya DISCORD_CLIENT_SECRET ayarlanmadı.");
    }

    // 1) code'u access token'a çeviriyoruz
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) return res.redirect("/?hata=token_alinamadi");
    const tokenJson = await tokenRes.json();

    // 2) access token ile "ben kimim" bilgisini çekiyoruz
    const kullaniciRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!kullaniciRes.ok) return res.redirect("/?hata=kullanici_alinamadi");
    const kullanici = await kullaniciRes.json();

    // 3) BOT token ile: bu kişi gerçekten bizim sunucumuzda mı?
    const uyeBilgisi = await discordUyeBilgisiCek(kullanici.id);
    if (!uyeBilgisi) {
      return res.redirect("/?hata=uye_degil");
    }

    // 4) Oturumu başlat + profili oluştur/getir
    req.session.discordId = kullanici.id;
    profilGetir(kullanici.id);

    res.redirect("/profile.html");
  } catch (err) {
    console.error("OAuth hatası:", err);
    res.redirect("/?hata=sunucu_hatasi");
  }
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ---------- Profil API ----------

// Oturumdaki kullanıcının kendi ID'si + temel bilgisi
app.get("/api/me", async (req, res) => {
  if (!req.session.discordId) return res.json({ girisYapti: false });

  // Kendi bilgisi her zaman canlı çekilir ki Discord'da isim/avatar değişince
  // navbar ve profil anında güncellensin.
  let uyeBilgisi = await discordUyeBilgisiCek(req.session.discordId, true);
  if (!uyeBilgisi) {
    // Discord canlı bilgisi hiç alınamıyorsa bile oturumu sürdür (F5'te çıkış yaptırma)
    const profil = profilGetir(req.session.discordId);
    uyeBilgisi = {
      id: req.session.discordId,
      kullaniciAdi: "Üye",
      avatar: profil.avatar || "",
      roller: [],
    };
  }
  res.json({ girisYapti: true, admin: adminMi(req.session.discordId), ...uyeBilgisi });
});

// Herkese açık profil görüntüleme (Discord bilgisi canlı, profil verisi DB'den)
app.get("/api/profile/:id", async (req, res) => {
  // Kendi profilini görüntülüyorsa önbelleği atlayıp canlı bilgi çek
  const kendiProfilim = req.session.discordId === req.params.id;
  const uyeBilgisi = await discordUyeBilgisiCek(req.params.id, kendiProfilim);
  const db = okuDB();
  const profil = profilGetir(req.params.id);
  if (!uyeBilgisi) {
    if (!db.profiles[req.params.id]) return res.status(404).json({ hata: "Bu üye sunucuda bulunamadı." });
    const { yorumlar: _fallbackYorumlar, galleryEntries: _fallbackGallery, ...fallbackProfil } = profil;
    return res.json({
      id: req.params.id,
      kullaniciAdi: profil.sonIsim || "Üye",
      avatar: profil.avatar || profil.sonAvatar || varsayilanAvatar(req.params.id),
      roller: [],
      profil: { ...fallbackProfil, yorumlar: [], yorumSayfalama: { sayfa: 1, limit: 10, toplam: 0, toplamSayfa: 1 } },
    });
  }
  const { yorumlar: _yorumlar, galleryEntries: _galleryEntries, ...profilTemiz } = profil;
  const tumYorumlar = Array.isArray(profil.yorumlar) ? profil.yorumlar : [];
  const sayfa = Math.max(1, parseInt(req.query.yorumSayfa, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.yorumLimit, 10) || 10));
  const toplamSayfa = Math.max(1, Math.ceil(tumYorumlar.length / limit));
  const guvenliSayfa = Math.min(sayfa, toplamSayfa);
  const sayfaYorumlari = tumYorumlar.slice((guvenliSayfa - 1) * limit, guvenliSayfa * limit);
  // Yorumlarda yazarın GÜNCEL adı + profil fotoğrafı gösterilsin (özel pp öncelikli)
  const yorumlar = await Promise.all(
    sayfaYorumlari.map(async (y) => {
      const uye = await discordUyeBilgisiCek(y.yazanId);
      const hedefProfil = db.profiles[y.yazanId] || {};
      return {
        ...y,
        yazanAd: uye ? uye.kullaniciAdi : y.yazanAd,
        yazanAvatar: hedefProfil.avatar || (uye ? uye.avatar : y.yazanAvatar),
      };
    })
  );
  res.json({
    ...uyeBilgisi,
    profil: {
      ...profilTemiz,
      yorumlar,
      yorumSayfalama: { sayfa: guvenliSayfa, limit, toplam: tumYorumlar.length, toplamSayfa },
    },
  });
});

app.get("/api/profile/:id/gallery", async (req, res) => {
  const uyeBilgisi = await discordUyeBilgisiCek(req.params.id);
  const profil = profilGetir(req.params.id);
  if (!uyeBilgisi) {
    const db = okuDB();
    if (!db.profiles[req.params.id]) return res.status(404).json({ hata: "Bu üye sunucuda bulunamadı." });
  }
  const db = okuDB();
  const entries = Array.isArray(profil.galleryEntries) ? profil.galleryEntries : [];
  const galleryEntries = await Promise.all(entries.map(async (entry) => {
    const comments = Array.isArray(entry.comments) ? entry.comments.slice(0, 50) : [];
    const enrichedComments = await Promise.all(comments.map(async (comment) => {
      const uye = await discordUyeBilgisiCek(comment.yazanId);
      const yazanProfil = db.profiles[comment.yazanId] || {};
      return {
        ...comment,
        yazanAd: uye ? uye.kullaniciAdi : comment.yazanAd,
        yazanAvatar: yazanProfil.avatar || (uye ? uye.avatar : comment.yazanAvatar),
      };
    }));
    return { ...entry, comments: enrichedComments };
  }));
  res.json({
    uye: uyeBilgisi || { id: req.params.id, kullaniciAdi: profil.sonIsim || "Üye", avatar: profil.avatar || profil.sonAvatar || varsayilanAvatar(req.params.id), roller: [] },
    profil: {
      ...profil,
      galleryEntries,
    },
  });
});

app.post("/api/profile/:id/gallery", girisGerekli, async (req, res) => {
  if (req.session.discordId !== req.params.id) {
    return res.status(403).json({ hata: "Sadece kendi galerini düzenleyebilirsin." });
  }

  const { imageUrl, description } = req.body || {};
  const temizUrl = gorselUrlTemizle(imageUrl);
  if (!temizUrl) {
    return res.status(400).json({ hata: "Fotoğraf eklemek için bir görsel seçmelisin." });
  }

  const metin = (description || "").trim().slice(0, 400);
  const db = okuDB();
  const profil = profilGetir(req.params.id);
  const entries = Array.isArray(profil.galleryEntries) ? profil.galleryEntries : [];

  entries.unshift({
    id: `${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    imageUrl: temizUrl,
    description: metin,
    createdAt: new Date().toISOString(),
    comments: [],
  });

  db.profiles[req.params.id].galleryEntries = entries;
  yazDB(db);
  res.json({ basarili: true, galleryEntries: entries });
});

app.post("/api/profile/:id/gallery/:entryId/comments", girisGerekli, async (req, res) => {
  const metin = String(req.body.metin || "").trim().slice(0, 300);
  if (!metin) return res.status(400).json({ hata: "Boş yorum gönderilemez." });
  const db = okuDB();
  const profil = profilGetir(req.params.id);
  const entry = (profil.galleryEntries || []).find((item) => item.id === req.params.entryId);
  if (!entry) return res.status(404).json({ hata: "Galeri görseli bulunamadı." });
  const yazan = await discordUyeBilgisiCek(req.session.discordId);
  entry.comments = Array.isArray(entry.comments) ? entry.comments : [];
  entry.comments.unshift({
    id: `galeri-yorum-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    yazanId: req.session.discordId,
    yazanAd: yazan ? yazan.kullaniciAdi : "Üye",
    yazanAvatar: yazan ? yazan.avatar : "",
    metin,
    tarih: new Date().toISOString(),
  });
  entry.comments = entry.comments.slice(0, 50);
  db.profiles[req.params.id].galleryEntries = profil.galleryEntries;
  yazDB(db);
  res.json({ basarili: true, comments: entry.comments });
});

// Galeri öğesi silme (sadece profil sahibi)
app.delete("/api/profile/:id/gallery/:entryId", girisGerekli, (req, res) => {
  if (req.session.discordId !== req.params.id) {
    return res.status(403).json({ hata: "Sadece kendi galerini düzenleyebilirsin." });
  }
  const db = okuDB();
  const profil = profilGetir(req.params.id);
  const entries = Array.isArray(profil.galleryEntries) ? profil.galleryEntries : [];
  const hedef = entries.find((e) => e.id === req.params.entryId);
  if (hedef && hedef.imageUrl && hedef.imageUrl.startsWith("/uploads/")) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(hedef.imageUrl))); } catch (e) { /* yoksay */ }
  }
  db.profiles[req.params.id].galleryEntries = entries.filter((e) => e.id !== req.params.entryId);
  yazDB(db);
  res.json({ basarili: true, galleryEntries: db.profiles[req.params.id].galleryEntries });
});

// ---------- Görsel yükleme (kullanıcının kendi bilgisayarından) ----------
// Dosya multipart yerine base64 dataURL olarak gelir (bağımlılık gerektirmez).
const IZINLI_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAKS_DOSYA_BOYUTU = 5 * 1024 * 1024; // 5MB

app.post("/api/upload", girisGerekli, (req, res) => {
  const { dataUrl } = req.body;
  if (typeof dataUrl !== "string") {
    return res.status(400).json({ hata: "Geçersiz görsel verisi." });
  }

  const eslesme = dataUrl.match(/^data:(image\/(png|jpeg|gif|webp));base64,(.+)$/);
  if (!eslesme) {
    return res.status(400).json({ hata: "Sadece PNG, JPEG, GIF veya WEBP görseller yüklenebilir." });
  }

  const mime = eslesme[1];
  const uzanti = IZINLI_MIME[mime];
  const base64Veri = eslesme[3];
  const arabellek = Buffer.from(base64Veri, "base64");

  if (arabellek.length > MAKS_DOSYA_BOYUTU) {
    return res.status(400).json({ hata: "Görsel çok büyük (maksimum 5MB)." });
  }

  const dosyaAdi = `${req.session.discordId}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${uzanti}`;
  const hedefYol = path.join(UPLOADS_DIR, dosyaAdi);

  fs.writeFile(hedefYol, arabellek, (err) => {
    if (err) {
      console.error("Yükleme hatası:", err);
      return res.status(500).json({ hata: "Görsel kaydedilemedi." });
    }
    res.json({ basarili: true, url: `/uploads/${dosyaAdi}` });
  });
});

// Sunucudan yüklenmiş bir dosyayı sil (kullanıcının kendi yüklemeleri)
app.post("/api/delete-upload", girisGerekli, (req, res) => {
  const { url } = req.body || {};
  if (typeof url !== "string" || !url.startsWith("/uploads/")) {
    return res.status(400).json({ hata: "Geçersiz dosya yolu." });
  }
  const dosyaAdi = path.basename(url);
  const hedefYol = path.join(UPLOADS_DIR, dosyaAdi);
  fs.unlink(hedefYol, (err) => {
    if (err) {
      console.error("Dosya silme hatası:", err);
      return res.status(500).json({ hata: "Dosya silinemedi." });
    }
    res.json({ basarili: true });
  });
});

// Sadece oturum sahibi kendi profilini güncelleyebilir
const ARKAPLAN_TURLERI = [
  "varsayilan",
  "renk",
  "resim",
];
const HEX_RENK_REGEX = /^#[0-9a-fA-F]{6}$/;

// Görsel alanlarına gelen değerler ya kendi yükleme dizinimizde (/uploads/)
// ya da geçerli bir http(s) adresi olmalıdır. Bunun dışındaki değerler
// profilin görünümünü bozmasın diye temizlenir.
const GORSEL_ALANLAR = [
  "vitrinResim",
  "kediResmi",
  "hayvanResmi",
  "galeriResim",
  "kapakFoto",
  "arkaplanResim",
  "avatar",
];

function gorselUrlTemizle(deger) {
  const d = (deger || "").trim();
  if (/^\/uploads\/[\w\-.]+$/.test(d)) return d;
  if (/^https?:\/\/.+/i.test(d)) return d.slice(0, 2000);
  return "";
}

app.post("/api/profile", girisGerekli, (req, res) => {
  // Admin başka bir profili düzenlemek istiyorsa hedefId gönderir; aksi halde kendi profili
  const hedefId =
    adminMi(req.session.discordId) && typeof req.body.hedefId === "string" && req.body.hedefId
      ? req.body.hedefId
      : req.session.discordId;
  const izinliAlanlar = [
    "bio",
    "unvan",
    "vitrinBaslik",
    "vitrinAciklama",
    "vitrinResim",
    "kediResmi",
    "hayvanBaslik",
    "hayvanAciklama",
    "hayvanResmi",
    "galeriBaslik",
    "galeriAciklama",
    "galeriResim",
    "kapakFoto",
    "arkaplanResim",
    "arkaplanRenk1",
    "arkaplanRenk2",
    "arkaplanBlur",
    "isimRenk1",
    "isimRenk2",
    "unvanRenk1",
    "unvanRenk2",
    "avatar",
  ];
  const gelenVeri = {};
  for (const alan of izinliAlanlar) {
    if (typeof req.body[alan] === "string") {
      const deger = req.body[alan].slice(0, 500); // basit uzunluk sınırı
      gelenVeri[alan] = GORSEL_ALANLAR.includes(alan) ? gorselUrlTemizle(deger) : deger;
    }
  }

  // aksan rengi: sadece geçerli hex kod kabul edilir, aksi halde temizlenir
  if (typeof req.body.aksanRenk === "string") {
    gelenVeri.aksanRenk = HEX_RENK_REGEX.test(req.body.aksanRenk.trim())
      ? req.body.aksanRenk.trim()
      : "";
  }

  // arkaplan türü: sadece izin verilen seçeneklerden biri olabilir
  if (typeof req.body.arkaplanTuru === "string" && ARKAPLAN_TURLERI.includes(req.body.arkaplanTuru)) {
    gelenVeri.arkaplanTuru = req.body.arkaplanTuru;
  }

  // İsim / ünvan rengi: tür boş, "renk" veya "gradyan"; renkler geçerli hex olmalı
  const METIN_RENK_TURLERI = ["", "renk", "gradyan"];
  for (const alan of ["isimRenkTuru", "unvanRenkTuru"]) {
    if (typeof req.body[alan] === "string" && METIN_RENK_TURLERI.includes(req.body[alan])) {
      gelenVeri[alan] = req.body[alan];
    }
  }
  for (const alan of ["isimRenk1", "isimRenk2", "unvanRenk1", "unvanRenk2"]) {
    if (typeof req.body[alan] === "string") {
      gelenVeri[alan] = HEX_RENK_REGEX.test(req.body[alan].trim())
        ? req.body[alan].trim()
        : "";
    }
  }

  // Profili güncelle ve XP kuralına göre ilk kez tamamlanan bölümler için XP kazandır
  profilGetir(hedefId); // yoksa oluştur
  const db = okuDB();
  const onceki = db.profiles[hedefId] || {};
  let kazanilanXp = 0;
  for (const [alan, xp] of Object.entries(XP_KURALLARI)) {
    const oncekiDeger = (onceki[alan] || "").toString().trim();
    const yeniDeger = (gelenVeri[alan] || "").toString().trim();
    if (!oncekiDeger && yeniDeger) {
      kazanilanXp += xp;
    }
  }
  db.profiles[hedefId] = { ...onceki, ...gelenVeri };
  if (kazanilanXp > 0) {
    db.profiles[hedefId].xp = (onceki.xp || 0) + kazanilanXp;
  }
  yazDB(db);

  const guncel = db.profiles[hedefId];
  res.json({ basarili: true, kazanilanXp, seviye: seviyeHesapla(guncel.xp || 0), profil: guncel });
});

// Easter egg rozetini talep et (bulunan gizli şey için XP + rozet kazan)
app.post("/api/rozet/kod", girisGerekli, (req, res) => {
  const kod = String(req.body.kod || "").trim();
  const egg = EASTER_EGGS[kod];
  if (!egg) return res.status(404).json({ hata: "Böyle bir rozet bulunamadı." });

  const db = okuDB();
  const profil = profilGetir(req.session.discordId);
  const rozetler = Array.isArray(profil.rozetler) ? profil.rozetler : [];
  const zatenVar = rozetler.some((r) => r.kod === kod);

  if (zatenVar) {
    return res.json({ basarili: true, zatenVar: true, rozetler, seviye: seviyeHesapla(profil.xp || 0) });
  }

  const rozet = {
    kod,
    ad: egg.ad,
    aciklama: egg.aciklama,
    ikon: egg.ikon,
    tarih: new Date().toISOString(),
  };
  db.profiles[req.session.discordId].rozetler = [rozet, ...rozetler].slice(0, 30);
  db.profiles[req.session.discordId].xp = (profil.xp || 0) + egg.xp;
  yazDB(db);

  res.json({
    basarili: true,
    kazanilanXp: egg.xp,
    rozet,
    rozetler: db.profiles[req.session.discordId].rozetler,
    seviye: seviyeHesapla(db.profiles[req.session.discordId].xp || 0),
  });
});

// Yorum (guestbook) - herhangi bir üye, giriş yapmış olmak şartıyla
app.post("/api/profile/:id/comments", girisGerekli, async (req, res) => {
  const metin = (req.body.metin || "").trim().slice(0, 300);
  if (!metin) return res.status(400).json({ hata: "Boş yorum gönderilemez." });

  const yazan = await discordUyeBilgisiCek(req.session.discordId);
  // Üyelik bilgisi anlık çekilemezse bile yorum kaybolmasın (isim/avatar varsayılan)
  const yazanId = yazan ? yazan.id : req.session.discordId;
  const yazanAd = yazan ? yazan.kullaniciAdi : "Üye";
  const yazanAvatar = yazan ? yazan.avatar : "";
  const db = okuDB();
  profilGetir(req.params.id); // hedef profili garantiye al
  db.profiles[req.params.id].yorumlar.unshift({
    id: `yorum-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    yazanId,
    yazanAd,
    yazanAvatar,
    metin,
    tarih: new Date().toISOString(),
  });
  db.profiles[req.params.id].yorumlar = db.profiles[req.params.id].yorumlar.slice(0, 500);
  // Kendi profiline yorum yazmıyorsa, profil sahibi için okunmamış yorum sayısını artır
  if (req.params.id !== req.session.discordId) {
    db.profiles[req.params.id].okunmamisYorum =
      (db.profiles[req.params.id].okunmamisYorum || 0) + 1;
    db.profiles[req.params.id].bildirimler = db.profiles[req.params.id].bildirimler || [];
    db.profiles[req.params.id].bildirimler.unshift({
      id: `bildirim-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      yazanId: yazan.id,
      yazanAd: yazan.kullaniciAdi,
      yorumMetni: metin.slice(0, 90),
      tarih: new Date().toISOString(),
      okundu: false,
    });
    db.profiles[req.params.id].bildirimler = db.profiles[req.params.id].bildirimler.slice(0, 20);
  }
  yazDB(db);
  res.json({ basarili: true, yorumlar: db.profiles[req.params.id].yorumlar });
});

// Yorum silme (sadece profil sahibi kendi profilindeki yorumları silebilir)
app.delete("/api/profile/:id/comments/:commentId", girisGerekli, (req, res) => {
  if (req.session.discordId !== req.params.id) {
    return res.status(403).json({ hata: "Sadece profil sahibi yorum silebilir." });
  }
  const db = okuDB();
  const profil = profilGetir(req.params.id);
  const yorumlar = Array.isArray(profil.yorumlar) ? profil.yorumlar : [];
  db.profiles[req.params.id].yorumlar = yorumlar.filter((y) => y.id !== req.params.commentId);
  yazDB(db);
  res.json({ basarili: true, yorumlar: db.profiles[req.params.id].yorumlar });
});

// Bildirimler: giriş yapan üyenin bildirim listesi + okunmamış sayısı
app.get("/api/bildirimler", girisGerekli, (req, res) => {
  const profil = profilGetir(req.session.discordId);
  const liste = profil.bildirimler || [];
  const sayi = liste.filter((b) => !b.okundu).length;
  res.json({ sayi, liste, id: req.session.discordId });
});

// Bildirimler okundu olarak işaretlenir (geçmiş listesi kalır)
app.post("/api/bildirimler/okundu", girisGerekli, (req, res) => {
  const db = okuDB();
  const profil = db.profiles[req.session.discordId];
  if (profil) {
    (profil.bildirimler || []).forEach((b) => { b.okundu = true; });
    profil.okunmamisYorum = 0;
    yazDB(db);
  }
  res.json({ basarili: true });
});

// Kayıtlı (en az bir kez giriş yapmış) tüm üyelerin listesi
// Üye listesi kısa süreli cache'lenir; Discord tekrar tekrar sorulmaz, sayfa anında açılır.
let UYE_LISTESI_ONBELLEK = { zaman: 0, veri: null };

app.get("/api/members", async (req, res) => {
  const simdi = Date.now();
  if (UYE_LISTESI_ONBELLEK.veri && simdi - UYE_LISTESI_ONBELLEK.zaman < 60 * 1000) {
    return res.json(UYE_LISTESI_ONBELLEK.veri);
  }
  const db = okuDB();
  const idler = Object.keys(db.profiles).filter(gecerliDiscordId);
  const liste = [];
  let degisti = false;
  for (let i = 0; i < idler.length; i += 8) {
    const parca = await Promise.all(idler.slice(i, i + 8).map(async (id) => {
      const uyeBilgisi = await discordUyeBilgisiCek(id);
      const profil = db.profiles[id] || {};
      // Discord başarılı olduğunda son bilinen isim/avatari kalıcı kaydet
      // (Discord daha sonra çekilemezse üye listesinde boş görünmesin).
      if (uyeBilgisi && (profil.sonIsim !== uyeBilgisi.kullaniciAdi || profil.sonAvatar !== uyeBilgisi.avatar)) {
        profil.sonIsim = uyeBilgisi.kullaniciAdi;
        profil.sonAvatar = uyeBilgisi.avatar;
        degisti = true;
      }
      return {
        id,
        kullaniciAdi: uyeBilgisi ? uyeBilgisi.kullaniciAdi : (profil.sonIsim || "Üye"),
        avatar: uyeBilgisi ? uyeBilgisi.avatar : (profil.sonAvatar || varsayilanAvatar(id)),
        roller: uyeBilgisi ? uyeBilgisi.roller : [],
        profilAvatar: profil.avatar || "",
      };
    }));
    liste.push(...parca.filter(Boolean));
  }
  if (degisti) yazDB(db);
  UYE_LISTESI_ONBELLEK = { zaman: Date.now(), veri: liste };
  res.json(liste);
});

// ---------- Sunucu Başlatma ----------
app.listen(PORT || 3000, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT || 3000}`);
});

// Beklenmedik hatalar isteği asılı bırakmasın; JSON hata dönsün
app.use((err, req, res, next) => {
  console.error("Sunucu hatası:", err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ hata: "Beklenmeyen bir hata oluştu." });
});
