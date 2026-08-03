# ARCH — Discord OAuth2'li Üye Profil Sistemi

Bu proje, Congress sunucusu üyelerinin Discord ile giriş yapıp kendi
profillerini (bio, proje vitrini, kedi fotoğrafı, Spotify) düzenleyebildiği
küçük bir backend + frontend uygulamasıdır.

**Önemli:** Bu artık statik bir site değil. Node.js çalıştırabilen bir
ortamda (kendi bilgisayarın, bir VPS, Railway/Render gibi bir servis)
çalıştırman gerekiyor. Sadece dosyaları bir hosting'e "yüklemek" yetmez.

---

## 1) Discord tarafında hazırlık

### a) Uygulama oluştur
1. https://discord.com/developers/applications adresine git, giriş yap.
2. "New Application" ile yeni bir uygulama oluştur (adı önemli değil).
3. Sol menüden **OAuth2** sekmesine gir:
   - **Client ID** ve **Client Secret**'i kopyala → `.env` dosyasına yapıştıracaksın.
   - **Redirects** kısmına şunu ekle (localde test için):
     `http://localhost:3000/auth/callback`
     (canlıya alınca gerçek domainini de ekleyeceksin, örn.
     `https://archiedux.com/auth/callback`)

### b) Bot oluştur ve sunucuna ekle
Üyelik kontrolü için bir bot'a ihtiyacımız var (bu bot sunucunda zaten
varsa aynı uygulamayı kullanabilirsin, ayrı bot şart değil).

1. Sol menüden **Bot** sekmesine gir, "Add Bot" (yoksa).
2. **Token**'ı kopyala → `.env` dosyasındaki `DISCORD_BOT_TOKEN`'a yapıştır.
   (Bu token'ı KİMSEYLE paylaşma, GitHub'a da atma.)
3. Sol menüden **OAuth2 → URL Generator**'a gir:
   - Scopes: `bot`
   - Bot Permissions: hiçbir özel izin gerekmiyor, "View Channels" yeterli.
   - Oluşan linki tarayıcıda aç, botu kendi sunucuna davet et.
4. Discord'da sunucu adına sağ tıkla → **Sunucu Kimliğini Kopyala**
   (Geliştirici Modu kapalıysa Discord ayarlarından açman gerekir) →
   `.env` dosyasındaki `DISCORD_GUILD_ID`'ye yapıştır.

---

## 2) Projeyi çalıştırma

Node.js 18 veya üstü kurulu olmalı (`node -v` ile kontrol edebilirsin).

```bash
cd archiedux-app
npm install
cp .env.example .env
```

`.env` dosyasını aç, yukarıda topladığın bilgileri doldur:

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
SESSION_SECRET=çok-uzun-rastgele-bir-metin
# Film & Dizi Günlüğü için (https://www.themoviedb.org/settings/api)
TMDB_API_KEY=...
PORT=3000
```

Sonra çalıştır:

```bash
npm start
```

Tarayıcıda `http://localhost:3000` adresini aç. "Discord ile Giriş Yap"
butonuna basınca Discord'un izin ekranına yönlenmelisin.

---

## 3) Nasıl çalışıyor (kısaca)

- `/auth/login` → kullanıcıyı Discord'un izin ekranına yönlendirir.
- `/auth/callback` → Discord'dan dönen kodu access token'a çevirir,
  kullanıcının kim olduğunu öğrenir, **bot token'ıyla** o kişinin
  gerçekten sunucunda üye olup olmadığını kontrol eder. Üye değilse
  girişi reddeder.
- Üyeyse bir oturum (session cookie) açılır ve `data/db.json` içinde
  o kişi için bir profil kaydı oluşturulur/bulunur.
- `profile.html?id=<discordId>` → o kişinin profilini gösterir.
  Avatar/isim her zaman Discord'dan **canlı** çekilir (bot API'siyle),
  bio/proje/kedi fotoğrafı gibi alanlar `data/db.json`'dan gelir.
- Sadece oturum sahibi kendi profilini düzenleyebilir — bu kontrol
  **backend'de** (`server.js` içindeki `girisGerekli` fonksiyonu ve
  `req.session.discordId` karşılaştırması) yapılıyor, sadece butonu
  gizlemekle değil.
- Yorumlar (guestbook) için de giriş şartı var — böylece herkes
  gerçek Discord kimliğiyle yorum yapar, rastgele sahte isim üretilmiyor.

---

## 4) Canlıya alma (deploy)

Bu proje bir Node.js sunucusu çalıştırdığı için statik hosting
(sadece dosya barındıran hizmetler) yeterli değil. Kolay seçenekler:

- **Railway** veya **Render** — ücretsiz katmanları var, GitHub reponu
  bağlayıp birkaç tıkla deploy edebilirsin. Ortam değişkenlerini
  (`.env` içindekileri) panelden ekleyeceksin.
- **Kendi VPS'in** — `pm2` gibi bir process manager ile `npm start`'ı
  arka planda çalıştırıp, Nginx ile domain'e (archiedux.com) bağlarsın.

Hangisini seçersen seç, canlıya aldığında:
1. Discord Developer Portal'daki **Redirects** listesine gerçek domain'ini
   ekle (`https://archiedux.com/auth/callback`).
2. `.env` içindeki `DISCORD_REDIRECT_URI`'yi de buna göre güncelle.

---

## 5) Şu an eksik / sonraki adım olabilecekler

- **Fotoğraf yükleme yok** — şu an kedi fotoğrafı ve proje görseli için
  bir URL yapıştırman gerekiyor (imgur, Discord CDN linki vs.). Kendi
  sunucundan dosya yüklemeyi istersen bir sonraki adımda ekleyebiliriz.
- **Rozetler admin tarafından atanmıyor henüz** — `data/db.json` içindeki
  `rozetler` alanına elle ID ekleyip göstermek mümkün, otomatik bir
  yönetim paneli yok. İstersen bunu da ekleriz.
- **veritabanı basit bir JSON dosyası** — küçük bir topluluk için sorun
  değil, ama çok büyürse (binlerce üye, çok yoğun trafik) gerçek bir
  veritabanına (SQLite/Postgres) geçmek gerekebilir.
