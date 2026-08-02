const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const session = require("express-session");

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
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function yazDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function profilGetir(discordId) {
  const db = okuDB();
  if (!db.profiles[discordId]) {
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
      katilimTarihi: new Date().toISOString(),
    };
    yazDB(db);
  }
  // Eski (id'siz) yorumlara silinebilmeleri için birer id ekle
  const profil = db.profiles[discordId];
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
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) {
      // canlı çekilemediyse varsa önbellekteki kopyayı döndür (oturumu koru)
      return onbellek ? onbellek.veri : null;
    }
    veri = await res.json();
  } catch (e) {
    return onbellek ? onbellek.veri : null;
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

// Temiz adresler (URL'lerde .html görünmesin)
app.get("/profil", (req, res) => res.sendFile(path.join(__dirname, "public", "profile.html")));
app.get("/galeri", (req, res) => res.sendFile(path.join(__dirname, "public", "gallery.html")));
app.get("/uyeler", (req, res) => res.sendFile(path.join(__dirname, "public", "members.html")));

const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use(
  session({
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
  res.json({ girisYapti: true, ...uyeBilgisi });
});

// Herkese açık profil görüntüleme (Discord bilgisi canlı, profil verisi DB'den)
app.get("/api/profile/:id", async (req, res) => {
  // Kendi profilini görüntülüyorsa önbelleği atlayıp canlı bilgi çek
  const kendiProfilim = req.session.discordId === req.params.id;
  const uyeBilgisi = await discordUyeBilgisiCek(req.params.id, kendiProfilim);
  if (!uyeBilgisi) {
    return res.status(404).json({ hata: "Bu üye sunucuda bulunamadı." });
  }
  const db = okuDB();
  const profil = profilGetir(req.params.id);
  // Yorumlarda yazarın GÜNCEL adı + profil fotoğrafı gösterilsin (özel pp öncelikli)
  const yorumlar = await Promise.all(
    (profil.yorumlar || []).map(async (y) => {
      const uye = await discordUyeBilgisiCek(y.yazanId);
      const hedefProfil = db.profiles[y.yazanId] || {};
      return {
        ...y,
        yazanAd: uye ? uye.kullaniciAdi : y.yazanAd,
        yazanAvatar: hedefProfil.avatar || (uye ? uye.avatar : y.yazanAvatar),
      };
    })
  );
  res.json({ ...uyeBilgisi, profil: { ...profil, yorumlar } });
});

app.get("/api/profile/:id/gallery", async (req, res) => {
  const uyeBilgisi = await discordUyeBilgisiCek(req.params.id);
  if (!uyeBilgisi) {
    return res.status(404).json({ hata: "Bu üye sunucuda bulunamadı." });
  }
  const profil = profilGetir(req.params.id);
  res.json({
    uye: uyeBilgisi,
    profil: {
      ...profil,
      galleryEntries: Array.isArray(profil.galleryEntries) ? profil.galleryEntries : [],
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
  });

  db.profiles[req.params.id].galleryEntries = entries;
  yazDB(db);
  res.json({ basarili: true, galleryEntries: entries });
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

  const guncel = profilGuncelle(req.session.discordId, gelenVeri);
  res.json({ basarili: true, profil: guncel });
});

// Yorum (guestbook) - herhangi bir üye, giriş yapmış olmak şartıyla
app.post("/api/profile/:id/comments", girisGerekli, async (req, res) => {
  const metin = (req.body.metin || "").trim().slice(0, 300);
  if (!metin) return res.status(400).json({ hata: "Boş yorum gönderilemez." });

  const yazan = await discordUyeBilgisiCek(req.session.discordId);
  const db = okuDB();
  profilGetir(req.params.id); // hedef profili garantiye al
  db.profiles[req.params.id].yorumlar.unshift({
    id: `yorum-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    yazanId: yazan.id,
    yazanAd: yazan.kullaniciAdi,
    yazanAvatar: yazan.avatar,
    metin,
    tarih: new Date().toISOString(),
  });
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
app.get("/api/members", async (req, res) => {
  const db = okuDB();
  const idler = Object.keys(db.profiles);
  const liste = [];
  for (const id of idler) {
    const uyeBilgisi = await discordUyeBilgisiCek(id);
    if (uyeBilgisi) {
      // Kullanıcı özel profil fotoğrafı yüklemişse onu da gönder (üye listesi bunu göstersin)
      const profil = db.profiles[id] || {};
      liste.push({ ...uyeBilgisi, profilAvatar: profil.avatar || "" });
    }
  }
  res.json(liste);
});

app.listen(PORT || 3000, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT || 3000}`);
});
