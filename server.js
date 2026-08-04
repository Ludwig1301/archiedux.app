const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const express = require("express");
const session = require("express-session");
const { createClient } = require("redis");
const { RedisStore } = require("connect-redis");

// Oturumlar Redis'te saklanır; sunucu yeniden başlasa bile üyeler çıkış yapmaz.
// REDIS_URL tanımlıysa Redis kullanılır. Lokal geliştirmede Redis yoksa
// oturumlar bellekte tutulur (sunucu yeniden başlayınca sıfırlanır, sadece dev).
for (const envFile of [path.join(__dirname, ".env"), path.join(__dirname, ".env.example")]) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

const REDIS_URL = process.env.REDIS_URL || "";
let sessionStore;
if (REDIS_URL) {
  const redisClient = createClient({ url: REDIS_URL });
  redisClient.connect().catch((e) => console.error("Redis bağlantı hatası:", e));
  sessionStore = new RedisStore({ client: redisClient });
} else {
  const { MemoryStore } = require("express-session");
  sessionStore = new MemoryStore();
  console.log("REDIS_URL tanımlı değil; oturumlar bellekte tutuluyor (geliştirme modu).");
}

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  SESSION_SECRET,
  TMDB_API_KEY,
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
  "perde": { ad: "Perde", aciklama: "Navbardaki FİLM & DİZİ yazısına 3 kez sağ tıkladın.", ikon: "🎬", xp: 100 },
  "archie-avcisi": { ad: "Arşiv Avcısı", aciklama: "Sitede 'archie' kelimesini yazdın.", ikon: "🔎", xp: 100 },
  "koleksiyoncu": { ad: "Koleksiyoncu", aciklama: "Günlüğüne 5 farklı film/dizi ekledin.", ikon: "📀", xp: 150 },
  "sinema-tutkunu": { ad: "Sinema Tutkunu", aciklama: "Günlüğüne 10 farklı film/dizi ekledin.", ikon: "🎞️", xp: 200 },
  "besleyici": { ad: "Besleyici", aciklama: "Archie'yi 15 kez besledin.", ikon: "🐟", xp: 100 },
};

// XP ekle; xpKilitli hesaplar için XP verme (seviyesi dondurulmuş üyeler)
function xpArtir(profil, miktar) {
  if (!profil || profil.xpKilitli) return 0;
  if (miktar > 0) {
    profil.xp = (profil.xp || 0) + miktar;
    return miktar;
  }
  return 0;
}

// Rozeti kazandır (varsa tekrar kazandırmaz; XP sadece ilk alımda verilir)
function rozetKazandir(discordId, kod) {
  const egg = EASTER_EGGS[kod];
  if (!egg) return null;
  const db = okuDB();
  const profil = profilGetir(discordId);
  const rozetler = Array.isArray(profil.rozetler) ? profil.rozetler : [];
  if (rozetler.some((r) => r.kod === kod)) {
    return {
      zatenVar: true,
      rozetler,
      seviye: seviyeHesapla(profil.xp || 0),
    };
  }
  const rozet = {
    kod,
    ad: egg.ad,
    aciklama: egg.aciklama,
    ikon: egg.ikon,
    tarih: new Date().toISOString(),
  };
  db.profiles[discordId].rozetler = [rozet, ...rozetler].slice(0, 30);
  const verilenXp = xpArtir(db.profiles[discordId], egg.xp);
  yazDB(db);
  return {
    zatenVar: false,
    rozet,
    kazanilanXp: verilenXp,
    rozetler: db.profiles[discordId].rozetler,
    seviye: seviyeHesapla(db.profiles[discordId].xp || 0),
  };
}

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
  let ham = fs.readFileSync(DB_PATH, "utf-8");
  if (ham.charCodeAt(0) === 0xfeff) ham = ham.slice(1); // UTF-8 BOM olursa temizle
  const db = JSON.parse(ham);
  return db;
}

function yazDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Site içi etkinlik günlüğü (film ekleme, yorum, galeri vb.) — sadece adminler görür.
function logEkle(kullaniciId, kullaniciAd, tur, detay) {
  const db = okuDB();
  db.loglar = Array.isArray(db.loglar) ? db.loglar : [];
  db.loglar.unshift({
    id: `log-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    kullaniciId: String(kullaniciId || ""),
    kullaniciAd: String(kullaniciAd || "") || null,
    tur: String(tur || "bilinmeyen"),
    detay: String(detay || "").slice(0, 300),
    tarih: new Date().toISOString(),
  });
  db.loglar = db.loglar.slice(0, 300);
  yazDB(db);
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
      filmler: [],
      filmXpKazanilan: [],
      vitrinTuru: "proje",
      vitrinler: [],
      favoriSarki: null,
      profilSarkiUrl: "",
      profilGoruntulenme: 0,
      okunmamisYorum: 0,
      bildirimler: [],
      xp: 0,
      xpKilitli: false,
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

// Vitrin listesi: yeni çoklu vitrin yapısı; eski tek vitrin alanları varsa onu da vitrin olarak göster.
const VITRIN_TURLERI = ["proje", "galeri", "film", "sarki"];
function efektifVitrinler(profil) {
  const liste = Array.isArray(profil.vitrinler) ? profil.vitrinler : [];
  if (liste.length) return liste;
  if (profil.vitrinBaslik || profil.vitrinResim || (profil.vitrinTuru && VITRIN_TURLERI.includes(profil.vitrinTuru) && profil.vitrinTuru !== "proje")) {
    return [{
      tur: VITRIN_TURLERI.includes(profil.vitrinTuru) ? profil.vitrinTuru : "proje",
      baslik: profil.vitrinBaslik || "",
      aciklama: profil.vitrinAciklama || "",
      resim: profil.vitrinResim || "",
    }];
  }
  return [];
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

// Tüm üyeleri TEK istekte çeker (rate limit'e takılmamak için).
// Discord'da her üye için ayrı istek atmak 429'a takılıyordu.
async function discordUyeleriTopluCek() {
  const { botToken, guildId } = getDiscordConfig();
  const harita = new Map();
  if (!botToken || !guildId) return harita;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` },
      signal: controller.signal,
    });
    if (!res.ok) return harita;
    const liste = await res.json();
    if (!Array.isArray(liste)) return harita;
    for (const uye of liste) {
      const u = uye.user || {};
      const avatarHash = u.avatar;
      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${u.id}/${avatarHash}.png?size=256`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;
      const sonuc = {
        id: u.id,
        kullaniciAdi: uye.nick || u.global_name || u.username || "Üye",
        avatar: avatarUrl,
        roller: uye.roles || [],
      };
      harita.set(u.id, sonuc);
      UYE_ONBELLEK.set(u.id, { zaman: Date.now(), veri: sonuc });
    }
  } catch (e) {
    return harita;
  } finally {
    clearTimeout(timeout);
  }
  return harita;
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
app.get("/filmler", temizSayfa("filmler.html"));
app.get("/filmler.html", (req, res) => res.redirect("/filmler"));
app.get("/gunluk", temizSayfa("gunluk.html"));
app.get("/gunluk.html", (req, res) => res.redirect("/gunluk"));
app.get("/log", temizSayfa("log.html"));
app.get("/log.html", (req, res) => res.redirect("/log"));

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

  // Görüntülenme sayacı: sadece profil sayfası istediğinde (goruntulendi=1) ve
  // sahibi kendi profiline bakmıyorsa artırılır. Kimin baktığı saklanmaz.
  if (req.query.goruntulendi && req.session.discordId !== req.params.id) {
    profilGetir(req.params.id); // yoksa oluştur
    const dbGuncel = okuDB();
    dbGuncel.profiles[req.params.id].profilGoruntulenme =
      (dbGuncel.profiles[req.params.id].profilGoruntulenme || 0) + 1;
    yazDB(dbGuncel);
    profil.profilGoruntulenme = dbGuncel.profiles[req.params.id].profilGoruntulenme;
  }
  if (!uyeBilgisi) {
    if (!db.profiles[req.params.id]) return res.status(404).json({ hata: "Bu üye sunucuda bulunamadı." });
    const { yorumlar: _fallbackYorumlar, galleryEntries: _fallbackGallery, filmler: _fallbackFilmler, ...fallbackProfil } = profil;
    const fallbackFilmler = Array.isArray(profil.filmler) ? profil.filmler : [];
    const fallbackVitrinGaleri = (profil.galleryEntries || []).slice(0, 4).map((e) => e.imageUrl).filter(Boolean);
    return res.json({
      id: req.params.id,
      kullaniciAdi: profil.sonIsim || "Üye",
      avatar: profil.avatar || profil.sonAvatar || varsayilanAvatar(req.params.id),
      roller: [],
      profil: {
        ...fallbackProfil,
        yorumlar: [],
        yorumSayfalama: { sayfa: 1, limit: 10, toplam: 0, toplamSayfa: 1 },
        filmler: fallbackFilmler.slice(0, 12),
        filmSayisi: fallbackFilmler.length,
        filmAdet: fallbackFilmler.filter((f) => f.tur === "film").length,
        diziAdet: fallbackFilmler.filter((f) => f.tur === "dizi").length,
        vitrinGaleri: fallbackVitrinGaleri,
        favoriFilm: fallbackFilmler.find((f) => f.favori) || null,
        vitrinler: efektifVitrinler(profil),
      },
    });
  }
  const { yorumlar: _yorumlar, galleryEntries: _galleryEntries, filmler: _filmler, ...profilTemiz } = profil;
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
  const tumFilmler = Array.isArray(profil.filmler) ? profil.filmler : [];
  const favoriFilm = tumFilmler.find((f) => f.favori) || null;
  const vitrinGaleri = (profil.galleryEntries || []).slice(0, 4).map((e) => e.imageUrl).filter(Boolean);
  res.json({
    ...uyeBilgisi,
    profil: {
      ...profilTemiz,
      yorumlar,
      yorumSayfalama: { sayfa: guvenliSayfa, limit, toplam: tumYorumlar.length, toplamSayfa },
      filmler: tumFilmler.slice(0, 12),
      filmSayisi: tumFilmler.length,
      filmAdet: tumFilmler.filter((f) => f.tur === "film").length,
      diziAdet: tumFilmler.filter((f) => f.tur === "dizi").length,
      vitrinGaleri,
      favoriFilm,
      vitrinler: efektifVitrinler(profil),
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
  logEkle(
    req.session.discordId,
    null,
    "galeri-ekle",
    `Galeriye görsel eklendi${metin ? `: ${metin}` : ""}`
  );
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
  // Galeri sahibi yorumcu değilse sahibine bildirim git
  if (req.params.id !== req.session.discordId) {
    const hedef = db.profiles[req.params.id];
    hedef.okunmamisYorum = (hedef.okunmamisYorum || 0) + 1;
    hedef.bildirimler = Array.isArray(hedef.bildirimler) ? hedef.bildirimler : [];
    hedef.bildirimler.unshift({
      id: `bildirim-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      tur: "galeri",
      yazanId: req.session.discordId,
      yazanAd: yazan ? yazan.kullaniciAdi : "Üye",
      yorumMetni: metin.slice(0, 90),
      tarih: new Date().toISOString(),
      okundu: false,
    });
    hedef.bildirimler = hedef.bildirimler.slice(0, 20);
  }
  yazDB(db);
  logEkle(
    req.session.discordId,
    yazan ? yazan.kullaniciAdi : null,
    "galeri-yorum",
    `Galeriye yorum yazdı${metin ? `: ${metin}` : ""}`
  );
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

// ---------- Film & Dizi Günlüğü (Letterboxd tarzı) ----------
// Arama TMDB üzerinden yapılır; sonuçlar (afiş, ad, yıl) profilde saklanır.
// TMDB_API_KEY .env'de tanımlı değilse arama boş döner, site kırılmaz.

async function tmdbAra(q) {
  if (!TMDB_API_KEY || !q) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=tr-TR&query=${encodeURIComponent(q)}&include_adult=false`,
      { signal: controller.signal }
    );
    if (!res.ok) return [];
    const veri = await res.json();
    const sonuc = [];
    for (const oge of veri.results || []) {
      if (oge.media_type !== "movie" && oge.media_type !== "tv") continue;
      sonuc.push({
        id: oge.id,
        tur: oge.media_type === "movie" ? "film" : "dizi",
        ad: oge.title || oge.name || "Bilinmeyen",
        yil: (oge.release_date || oge.first_air_date || "").slice(0, 4),
        poster: oge.poster_path
          ? `/api/filmler/poster?path=${encodeURIComponent(oge.poster_path)}`
          : "",
      });
    }
    return sonuc;
  } catch (e) {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// Bazı internet sağlayıcıları image.tmdb.org alan adını engelleyebiliyor.
// Afişi sunucudan çekip tarayıcıya aynı origin üzerinden gönderiyoruz.
app.get("/api/filmler/poster", async (req, res) => {
  const posterPath = String(req.query.path || "").trim();
  if (!/^\/[A-Za-z0-9/_().-]+$/.test(posterPath) || posterPath.includes("..")) {
    return res.status(400).send("Geçersiz afiş yolu.");
  }

  const kaynaklar = [
    `https://image.tmdb.org/t/p/w342${posterPath}`,
    `https://media.themoviedb.org/t/p/w342${posterPath}`,
  ];
  for (const kaynak of kaynaklar) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const cevap = await fetch(kaynak, { signal: controller.signal });
      if (!cevap.ok) continue;
      const veri = Buffer.from(await cevap.arrayBuffer());
      res.set("Content-Type", cevap.headers.get("content-type") || "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      return res.send(veri);
    } catch (e) {
      // İlk CDN çalışmazsa TMDB'nin alternatif alan adını dene.
    } finally {
      clearTimeout(timeout);
    }
  }
  return res.status(502).send("Afiş alınamadı.");
});

// YouTube video başlığı (oEmbed) — profilde çalan şarkının adını göstermek için
app.get("/api/youtube/baslik", async (req, res) => {
  const url = String(req.query.url || "").trim().slice(0, 500);
  if (!/youtu\.be\/|youtube\.com\//i.test(url)) return res.json({ ad: "" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const cevap = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: controller.signal }
    );
    if (!cevap.ok) return res.json({ ad: "" });
    const veri = await cevap.json();
    return res.json({ ad: veri.title || "" });
  } catch (e) {
    return res.json({ ad: "" });
  } finally {
    clearTimeout(timeout);
  }
});

// TMDB arama proxy'si: anahtar tarayıcıya sızmaz, sunucuda kalır.
app.get("/api/filmler/arama", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (!q) return res.json([]);
  const sonuc = await tmdbAra(q);
  res.json(sonuc);
});

// Favori şarkı arama: ücretsiz iTunes Search API (anahtar gerekmez, sunucu tarafı)
app.get("/api/sarki/arama", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (!q) return res.json([]);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const cevap = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=12`,
      { signal: controller.signal }
    );
    if (!cevap.ok) return res.json([]);
    const veri = await cevap.json();
    const sonuc = (veri.results || []).map((r) => ({
      ad: r.trackName || r.collectionName || "Bilinmeyen",
      sanatci: r.artistName || "",
      album: r.collectionName || "",
      kapak: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "300x300") : "",
    }));
    return res.json(sonuc);
  } catch (e) {
    return res.json([]);
  } finally {
    clearTimeout(timeout);
  }
});

// Bir üyenin film/dizi günlüğü (herkese açık)
app.get("/api/profile/:id/filmler", async (req, res) => {
  const uyeBilgisi = await discordUyeBilgisiCek(req.params.id);
  const profil = profilGetir(req.params.id);
  const db = okuDB();
  if (!uyeBilgisi && !db.profiles[req.params.id]) {
    return res.status(404).json({ hata: "Bu üye sunucuda bulunamadı." });
  }
  res.json({
    uye: uyeBilgisi || {
      id: req.params.id,
      kullaniciAdi: profil.sonIsim || "Üye",
      avatar: profil.avatar || profil.sonAvatar || varsayilanAvatar(req.params.id),
      roller: [],
    },
    filmler: Array.isArray(profil.filmler) ? profil.filmler : [],
  });
});

const FILM_DURUMLARI = ["izledim", "izliyorum", "izlemek-istiyorum"];

// Film/dizi ekle veya güncelle (sadece kendi günlüğünü)
app.post("/api/filmler", girisGerekli, (req, res) => {
  const gelen = req.body || {};
  const id = parseInt(gelen.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ hata: "Film/Dizi kimliği eksik." });
  const tur = gelen.tur === "film" ? "film" : gelen.tur === "dizi" ? "dizi" : "";
  if (!tur) return res.status(400).json({ hata: "Tür geçersiz." });
  const ad = String(gelen.ad || "").trim().slice(0, 200);
  if (!ad) return res.status(400).json({ hata: "Ad boş olamaz." });

  const yil = String(gelen.yil || "").slice(0, 4);
  const poster = String(gelen.poster || "").slice(0, 500);
  const durum = FILM_DURUMLARI.includes(gelen.durum) ? gelen.durum : "izledim";
  let puan = parseFloat(gelen.puan);
  if (isNaN(puan) || puan <= 0) {
    puan = null;
  } else {
    puan = Math.min(5, Math.max(0.5, Math.round(puan * 2) / 2)); // 0.5 adımlı (Letterboxd tarzı)
  }
  const yorum = String(gelen.yorum || "").trim().slice(0, 800);

  profilGetir(req.session.discordId); // yoksa oluştur
  const db = okuDB();
  const filmler = Array.isArray(db.profiles[req.session.discordId].filmler)
    ? db.profiles[req.session.discordId].filmler
    : [];
  const mevcut = filmler.find((f) => f.id === id && f.tur === tur);

  // İlk kez eklenen benzersiz film/dizi için XP ver. Kayıt silinip tekrar eklenirse
  // XP verilmez (filmXpKazanilan listesi kalıcı olduğundan abuse engellenir).
  const xpAnahtari = `${id}-${tur}`;
  const xpKazanilanlar = Array.isArray(db.profiles[req.session.discordId].filmXpKazanilan)
    ? db.profiles[req.session.discordId].filmXpKazanilan
    : [];
  let kazanilanXp = 0;

  if (mevcut) {
    mevcut.ad = ad;
    mevcut.yil = yil;
    mevcut.poster = poster;
    mevcut.durum = durum;
    mevcut.puan = puan;
    mevcut.yorum = yorum;
    mevcut.guncelleme = new Date().toISOString();
  } else {
    if (!xpKazanilanlar.includes(xpAnahtari)) {
      kazanilanXp = 25;
      xpKazanilanlar.push(xpAnahtari);
    }
    filmler.unshift({
      entryId: `film-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      id,
      tur,
      ad,
      yil,
      poster,
      durum,
      puan,
      yorum,
      favori: false,
      tarih: new Date().toISOString(),
    });
  }

  // Sınırsız kayıt: sayfalama ile listelenir, veri kaybı olmaz
  db.profiles[req.session.discordId].filmler = filmler;
  db.profiles[req.session.discordId].filmXpKazanilan = xpKazanilanlar;
  kazanilanXp = xpArtir(db.profiles[req.session.discordId], kazanilanXp);
  yazDB(db);

  // Yeni eklenen benzersiz kayıtlarda koleksiyoncu / sinema tutkunu rozetlerini kontrol et
  if (!mevcut) {
    const adet = filmler.length;
    if (adet >= 5) rozetKazandir(req.session.discordId, "koleksiyoncu");
    if (adet >= 10) rozetKazandir(req.session.discordId, "sinema-tutkunu");
  }

  logEkle(
    req.session.discordId,
    null,
    mevcut ? "film-guncelle" : "film-ekle",
    `${ad} (${tur === "film" ? "Film" : "Dizi"}${yil ? ` ${yil}` : ""})`
  );

  res.json({
    basarili: true,
    kazanilanXp,
    filmler: db.profiles[req.session.discordId].filmler,
  });
});

// Günlükten bir kaydı sil (sadece sahibi)
app.delete("/api/filmler/:entryId", girisGerekli, (req, res) => {
  profilGetir(req.session.discordId);
  const db = okuDB();
  const filmler = Array.isArray(db.profiles[req.session.discordId].filmler)
    ? db.profiles[req.session.discordId].filmler
    : [];
  db.profiles[req.session.discordId].filmler = filmler.filter(
    (f) => f.entryId !== req.params.entryId
  );
  yazDB(db);
  res.json({ basarili: true, filmler: db.profiles[req.session.discordId].filmler });
});

// Bir kaydı "favori film" yap (sadece sahibi; aynı anda tek favori olur)
app.post("/api/filmler/favori", girisGerekli, (req, res) => {
  const entryId = String((req.body || {}).entryId || "");
  if (!entryId) return res.status(400).json({ hata: "Kayıt kimliği eksik." });
  profilGetir(req.session.discordId);
  const db = okuDB();
  const filmler = Array.isArray(db.profiles[req.session.discordId].filmler)
    ? db.profiles[req.session.discordId].filmler
    : [];
  const hedef = filmler.find((f) => f.entryId === entryId);
  if (!hedef) return res.status(404).json({ hata: "Kayıt bulunamadı." });
  const zatenFavori = hedef.favori === true;
  for (const f of filmler) f.favori = false;
  hedef.favori = !zatenFavori; // tekrar basınca favoriden çıkar
  db.profiles[req.session.discordId].filmler = filmler;
  yazDB(db);
  if (hedef.favori) {
    logEkle(
      req.session.discordId,
      null,
      "favori",
      `${hedef.ad} (${hedef.tur === "film" ? "Film" : "Dizi"}${hedef.yil ? ` ${hedef.yil}` : ""})`
    );
  }
  res.json({ basarili: true, filmler });
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

  // vitrin türü: sadece bilinen vitrin seçeneklerinden biri olabilir
  if (typeof req.body.vitrinTuru === "string" && VITRIN_TURLERI.includes(req.body.vitrinTuru)) {
    gelenVeri.vitrinTuru = req.body.vitrinTuru;
  }

  // vitrinler: birden çok vitrin (Steam vitrin yöneticisi gibi)
  if (Array.isArray(req.body.vitrinler)) {
    gelenVeri.vitrinler = req.body.vitrinler
      .filter((v) => v && typeof v === "object" && VITRIN_TURLERI.includes(v.tur))
      .slice(0, 6)
      .map((v) => ({
        tur: v.tur,
        baslik: String(v.baslik || "").slice(0, 200),
        aciklama: String(v.aciklama || "").slice(0, 500),
        resim: gorselUrlTemizle(String(v.resim || "")),
      }));
    // eski tek vitrin alanlarını temizle ki çelişki olmasın
    gelenVeri.vitrinTuru = "proje";
    gelenVeri.vitrinBaslik = "";
    gelenVeri.vitrinAciklama = "";
    gelenVeri.vitrinResim = "";
  }

  // favori şarkı: nesne olarak gelir; boş/null ise temizlenir
  if ("favoriSarki" in req.body) {
    const fs = req.body.favoriSarki;
    if (fs && typeof fs === "object" && !Array.isArray(fs)) {
      const sarki = {
        ad: String(fs.ad || "").slice(0, 200),
        sanatci: String(fs.sanatci || "").slice(0, 200),
        album: String(fs.album || "").slice(0, 200),
        kapak: String(fs.kapak || "").slice(0, 500),
      };
      gelenVeri.favoriSarki = sarki.ad ? sarki : null;
    } else {
      gelenVeri.favoriSarki = null;
    }
  }

  // profil şarkısı: boş ya da geçerli bir YouTube linki olabilir
  if (typeof req.body.profilSarkiUrl === "string") {
    const url = req.body.profilSarkiUrl.trim().slice(0, 500);
    gelenVeri.profilSarkiUrl = url && /youtu\.be\/|youtube\.com\//i.test(url) ? url : "";
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
  kazanilanXp = xpArtir(db.profiles[hedefId], kazanilanXp);
  yazDB(db);

  const guncel = db.profiles[hedefId];
  res.json({ basarili: true, kazanilanXp, seviye: seviyeHesapla(guncel.xp || 0), profil: guncel });
});

// Easter egg rozetini talep et (bulunan gizli şey için XP + rozet kazan)
app.post("/api/rozet/kod", girisGerekli, (req, res) => {
  const kod = String(req.body.kod || "").trim();
  if (!EASTER_EGGS[kod]) return res.status(404).json({ hata: "Böyle bir rozet bulunamadı." });
  const sonuc = rozetKazandir(req.session.discordId, kod);
  res.json({ basarili: true, ...sonuc });
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
      tur: "yorum",
      yazanId: yazan.id,
      yazanAd: yazan.kullaniciAdi,
      yorumMetni: metin.slice(0, 90),
      tarih: new Date().toISOString(),
      okundu: false,
    });
    db.profiles[req.params.id].bildirimler = db.profiles[req.params.id].bildirimler.slice(0, 20);
  }
  yazDB(db);
  logEkle(
    req.session.discordId,
    yazanAd,
    "yorum",
    `Profile yorum yazdı${metin ? `: ${metin}` : ""}`
  );
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

// Etkinlik günlüğü: sadece adminler görür (kim ne ekledi, kime yorum yazdı vb.)
app.get("/api/loglar", girisGerekli, async (req, res) => {
  if (!adminMi(req.session.discordId)) {
    return res.status(403).json({ hata: "Bu günlüğü görme yetkin yok." });
  }
  const db = okuDB();
  const uyeHaritasi = await discordUyeleriTopluCek();
  const loglar = (db.loglar || []).map((l) => {
    const uye = uyeHaritasi.get(String(l.kullaniciId));
    return {
      ...l,
      kullaniciAd: uye ? uye.kullaniciAdi : (l.kullaniciAd || "Üye"),
      avatar: uye ? uye.avatar : "",
    };
  });
  res.json({ loglar });
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
  const uyeHaritasi = await discordUyeleriTopluCek();
  let degisti = false;
  const liste = idler.map((id) => {
    const uyeBilgisi = uyeHaritasi.get(id);
    const profil = db.profiles[id] || {};
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
  });
  if (degisti) yazDB(db);
  UYE_LISTESI_ONBELLEK = { zaman: Date.now(), veri: liste };
  res.json(liste);
});

// ---------- Sunucu Pet'i: Archie ----------
// Tüm üyelerin ortak baktığı site maskotu. Açlık ve susuzluk 0-100 arasıdır;
// zamanla düşer. Kedi yemlikten yemek, su kabından su içmek için gider; kabı
// dolduran üyeler XP kazanır. Durum data/pet.json içinde saklanır.
const PET_DOSYASI = path.join(__dirname, "data", "pet.json");
const PET_DOLDURMA_COOLDOWN_MS = 10 * 60 * 1000; // bir üye 10 dakikada bir kap doldurabilir
const PET_ACLIK_DECAY_MS = 4 * 60 * 1000; // açlık 4 dakikada 1 birim düşer
const PET_SU_DECAY_MS = 5 * 60 * 1000; // susuzluk 5 dakikada 1 birim düşer
const PET_YEME_SURE_MS = 45 * 1000; // kedi 45 saniyede yemeği bitirir
const PET_ICME_SURE_MS = 45 * 1000; // kedi 45 saniyede suyu bitirir
const PET_YEME_ESIGI = 55; // açlık bu değerin altına düşünce kedi yemlikten yer
const PET_ICME_ESIGI = 55; // susuzluk bu değerin altına düşünce kedi su içer
const PET_DOLDURMA_XP = 5;
const PET_BESLEYICI_BESLEME = 15; // toplam 15 dolum yapan üye "Besleyici" rozeti alır

function petOku() {
  const varsayilan = {
    tree: 1,
    yemDolu: true,
    suDolu: true,
    yemYiyorBasladi: null,
    suIyiyorBasladi: null,
    aclik: 100,
    susuzluk: 100,
    sonGuncelleme: Date.now(),
    toplamMama: 0,
    toplamSu: 0,
    besleyenler: {},
  };
  if (!fs.existsSync(PET_DOSYASI)) {
    fs.writeFileSync(PET_DOSYASI, JSON.stringify(varsayilan, null, 2));
    return varsayilan;
  }
  try {
    const veri = JSON.parse(fs.readFileSync(PET_DOSYASI, "utf-8"));
    return { ...varsayilan, ...veri };
  } catch (e) {
    return varsayilan;
  }
}

function petYaz(veri) {
  fs.writeFileSync(PET_DOSYASI, JSON.stringify(veri, null, 2));
}

// Zaman temelli simülasyon: açlık/susuzluk düşer, kedi kaplardan yiyip içer.
// Durum gerçekten değiştiyse true döner (gereksiz disk yazımı önlenir).
function petSimulasyon(pet) {
  let degisti = false;
  const simdi = Date.now();
  const gecen = Math.max(0, simdi - (pet.sonGuncelleme || simdi));
  pet.aclik = Math.max(0, (pet.aclik || 100) - Math.floor(gecen / PET_ACLIK_DECAY_MS));
  pet.susuzluk = Math.max(0, (pet.susuzluk || 100) - Math.floor(gecen / PET_SU_DECAY_MS));
  pet.sonGuncelleme = simdi;

  if (pet.yemYiyorBasladi) {
    if (simdi - pet.yemYiyorBasladi >= PET_YEME_SURE_MS) {
      pet.yemYiyorBasladi = null;
      pet.yemDolu = false;
      pet.aclik = 100;
      degisti = true;
    }
  } else if (pet.yemDolu && pet.aclik < PET_YEME_ESIGI && !pet.suIyiyorBasladi) {
    pet.yemYiyorBasladi = simdi;
    degisti = true;
  }

  if (pet.suIyiyorBasladi) {
    if (simdi - pet.suIyiyorBasladi >= PET_ICME_SURE_MS) {
      pet.suIyiyorBasladi = null;
      pet.suDolu = false;
      pet.susuzluk = 100;
      degisti = true;
    }
  } else if (pet.suDolu && pet.susuzluk < PET_ICME_ESIGI && !pet.yemYiyorBasladi) {
    pet.suIyiyorBasladi = simdi;
    degisti = true;
  }

  return degisti;
}

function petDurum(aclik, susuzluk) {
  const enDusuk = Math.min(aclik, susuzluk);
  if (enDusuk >= 70) return "mutlu";
  if (enDusuk >= 35) return "tok";
  return "ac";
}

function petKullaniciVeri(pet, discordId) {
  const k = (discordId && pet.besleyenler[discordId]) || { sayi: 0, su: 0, sonDoldurma: 0 };
  const kalan = Math.max(0, PET_DOLDURMA_COOLDOWN_MS - (Date.now() - (k.sonDoldurma || 0)));
  return { mamaSayisi: k.sayi || 0, suSayisi: k.su || 0, doldurabilir: kalan <= 0, kalanMs: kalan };
}

function petDurumYanit(pet, req, ekstra) {
  return {
    ...(ekstra || {}),
    tree: pet.tree,
    yemDolu: pet.yemDolu,
    suDolu: pet.suDolu,
    yemYiyor: !!pet.yemYiyorBasladi,
    suIyiyor: !!pet.suIyiyorBasladi,
    aclik: pet.aclik,
    susuzluk: pet.susuzluk,
    durum: petDurum(pet.aclik, pet.susuzluk),
    toplamMama: pet.toplamMama || 0,
    toplamSu: pet.toplamSu || 0,
    ben: req.session.discordId ? petKullaniciVeri(pet, req.session.discordId) : null,
  };
}

app.get("/api/pet", (req, res) => {
  const pet = petOku();
  if (petSimulasyon(pet)) petYaz(pet);
  res.json(petDurumYanit(pet, req));
});

app.post("/api/pet/tree", girisGerekli, (req, res) => {
  const tree = parseInt((req.body || {}).tree, 10);
  if (![1, 2, 3].includes(tree)) return res.status(400).json({ hata: "Geçersiz ağaç rengi." });
  const pet = petOku();
  if (petSimulasyon(pet)) petYaz(pet);
  pet.tree = tree;
  petYaz(pet);
  logEkle(req.session.discordId, null, "pet-agac", `Kedi ağacını ${tree}. renge çevirdi`);
  res.json(petDurumYanit(pet, req, { basarili: true }));
});

// Bir kabı doldur (yem veya su). XP + rozet mantığı ortaktır.
function petKapDoldur(req, res, tur) {
  const pet = petOku();
  if (petSimulasyon(pet)) petYaz(pet);
  const kullanici = pet.besleyenler[req.session.discordId] || { sayi: 0, su: 0, sonDoldurma: 0 };
  const kalan = PET_DOLDURMA_COOLDOWN_MS - (Date.now() - (kullanici.sonDoldurma || 0));
  if (kalan > 0) {
    return res.status(429).json({
      hata: "Biraz beklemelisin, Archie'nin kapları henüz bitmedi.",
      kalanMs: kalan,
    });
  }

  const doluMu = tur === "yem" ? pet.yemDolu : pet.suDolu;
  if (doluMu) {
    return res.json({
      hata: tur === "yem" ? "Yemlik zaten dolu." : "Su kabı zaten dolu.",
      ...petDurumYanit(pet, req),
    });
  }

  if (tur === "yem") {
    pet.yemDolu = true;
    pet.yemYiyorBasladi = null;
    pet.toplamMama = (pet.toplamMama || 0) + 1;
    kullanici.sayi = (kullanici.sayi || 0) + 1;
  } else {
    pet.suDolu = true;
    pet.suIyiyorBasladi = null;
    pet.toplamSu = (pet.toplamSu || 0) + 1;
    kullanici.su = (kullanici.su || 0) + 1;
  }
  kullanici.sonDoldurma = Date.now();
  pet.besleyenler[req.session.discordId] = kullanici;
  petYaz(pet);

  let kazanilanXp = 0;
  let rozet = null;
  let rozetXp = 0;
  profilGetir(req.session.discordId); // yoksa oluştur
  const db = okuDB();
  kazanilanXp = xpArtir(db.profiles[req.session.discordId], PET_DOLDURMA_XP);
  yazDB(db);
  if ((kullanici.sayi || 0) + (kullanici.su || 0) >= PET_BESLEYICI_BESLEME) {
    const sonuc = rozetKazandir(req.session.discordId, "besleyici");
    if (sonuc && sonuc.rozet) {
      rozet = sonuc.rozet;
      rozetXp = sonuc.kazanilanXp || 0;
    }
  }
  logEkle(
    req.session.discordId,
    null,
    "pet-besle",
    tur === "yem"
      ? `Yemliği doldurdu (toplam ${pet.toplamMama} yemlik)`
      : `Su kabını doldurdu (toplam ${pet.toplamSu} su kabı)`
  );

  res.json(petDurumYanit(pet, req, { basarili: true, kazanilanXp, rozet, rozetXp }));
}

app.post("/api/pet/yem", girisGerekli, (req, res) => petKapDoldur(req, res, "yem"));
app.post("/api/pet/su", girisGerekli, (req, res) => petKapDoldur(req, res, "su"));

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
