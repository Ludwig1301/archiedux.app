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

## 6) Replik Kulübü (MVP)

Lisansı açık sahnelerle oda kodu üzerinden birlikte seslendirme deneyimi
`dublaj/` altında ayrı bir Next.js + Socket.IO servisi olarak geliştirilir.
Ana uygulama ve veritabanından ayrıdır; Express sunucusunu değiştirmez.

Yerelde çalıştırmak için:

```bash
cd dublaj
npm install
npm run dev
```

Ardından `http://localhost:3100/dublaj` adresini aç. Mikrofon kaydı için
tarayıcı izni gerekir. Oda kayıtları geçici olarak bellekte tutulur; servis
kapanınca silinir ve kalıcı kayıt oluşturulmaz.

Canlıya almak için: önce dublaj servisini bir kez hazırla, sonra ana
sunucuyu çalıştır.

```bash
cd dublaj
npm install
npm run build

cd ..
npm start            # ana site (PORT, varsayılan 3000)
```

Ana sunucu açılışta `127.0.0.1:3100` (`DUBLAJ_HOST`/`DUBLAJ_PORT`) portunu
yoklar; dublaj servisi çalışmıyorsa kendisi başlatır ve servis durursa
yeniden dener. `/dublaj` ve altındaki HTTP istekleri ile Socket.IO
WebSocket yükseltmeleri ana sunucu tarafından içeride dublaj servisine
iletilir. Yani canlıda ek bir PM2 süreci şart değildir; `npm start` yeter.

`DUBLAJ_AUTOSTART=0` ile bu otomatik başlatma kapatılabilir (ör. dublaj'ı
PM2 ile ayrı yönetmek isterseniz). Next.js uygulaması `/dublaj` adresini
kanonik kullanır; `/dublaj/` bu adrese yönlendirilir.

Nginx kullanıyorsanız, WebSocket yükseltmelerini ana Node servisine
(varsayılan `127.0.0.1:3000`) iletmeniz yeterlidir; ayrı bir
`/dublaj` kuralı gerekmez:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}
```

Canlıya almadan önce Nginx yapılandırması ve mevcut kullanıcı verileri
yedeklenmelidir.

Sahne kataloğunda yalnızca lisans/kaynak bilgisi doğrulanmış medya yer
almalıdır. Örnek sahne “Tears of Steel” için Blender Foundation'ın resmi
YouTube gömme oynatıcısını ve CC BY 3.0 atfını kullanır; Türkçe altyazılar
lisanslı İngilizce altyazıdan uyarlanmıştır. Kullanıcı videoları veya
altyazıları sunucuya indirilmez ya da yeniden barındırılmaz.

## 7) Dub Pack stüdyosu (YouTube / MP4 → kendi sesinle dublaj)

`/dublaj/tr/paketler` altında, Türk dizileri ve memeler için ChoicerVoicer tarzı tek
kişilik dublaj stüdyosu çalışır. Aynı `dublaj/` Next.js servisinin parçasıdır; ayrı bir
süreç ya da port gerekmez.

Akış:

1. Kullanıcı YouTube linki yapıştırır ya da MP4 yükler, en fazla 60 sn'lik aralığı seçer.
2. Sunucu: `yt-dlp` ile bölümü indirir → FFmpeg ile H.264/AAC'ye çevirir → vokali
   müzik/efektlerden ayırır (Demucs) → Türkçe konuşmayı zaman damgalı repliklere çevirir
   (Whisper) → `pack.json` yazar.
3. Oluşturan kişi stüdyoda (`/dublaj/tr/paket/<id>/duzenle`) metinleri düzeltir, zamanları
   sürükleyerek ayarlar, karakter adı/rengi atar ve isterse kütüphanede yayınlar.
4. Dublaj sahnesinde (`/dublaj/tr/paket/<id>`) her repliği orijinal müzik ve efektler
   kulağında çalarken kaydeder; "MP4 olarak indir" ile FFmpeg sesleri tam zamanına
   yerleştirip videoyu üretir.

Kod: `dublaj/lib/packs/server/` (hat ve render), `dublaj/app/api/packs/` (API),
`dublaj/app/packs/[packId]/[file]` (medya, Range destekli), `dublaj/components/packs/` (arayüz).
Paketler `dublaj/storage/packs/<id>/` klasörüne yazılır (git'e girmez, **yedeklenmeli**).

### Sunucuda gerekenler

| Araç | Ne için | Zorunlu mu |
|---|---|---|
| `ffmpeg` + `ffprobe` | Kesme, dönüştürme, MP4 render | Evet |
| `yt-dlp` (+ `deno`) | YouTube'dan bölüm indirme | YouTube linki için |
| Demucs (Python) **veya** `REPLICATE_API_TOKEN` | Vokal / arka plan ayrıştırma | Önerilir |
| `OPENAI_API_KEY` **veya** yerel `whisper` | Türkçe konuşma → metin | Önerilir |

Ubuntu (x86_64) için — canlı sunucuya bu şekilde kuruldu:

```bash
# FFmpeg (güncel statik derleme; Ubuntu 22.04'ün apt sürümü bazı filtreler için eski)
curl -fL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | sudo tar -xJ -C /opt
sudo ln -sf /opt/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg
sudo ln -sf /opt/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe

# yt-dlp (tek dosya) + Deno (yt-dlp'nin YouTube çözücüsü için)
sudo curl -fL -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
sudo chmod a+rx /usr/local/bin/yt-dlp
curl -fL -o /tmp/deno.zip https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip
sudo unzip -o /tmp/deno.zip -d /usr/local/bin

# Derleme
cd dublaj && npm ci && npm run build && pm2 restart archiedux-dublaj
```

4 GB+ RAM'li bir sunucuda Replicate yerine yerel Demucs kullanılabilir:
`pip install torch torchaudio demucs soundfile` (CPU'da 60 sn ses ≈ 1-3 dk).

Ayarlar **`dublaj/.env`** dosyasına yazılır (örnek: `dublaj/.env.example`). Next.js bu
dosyayı dublaj servisi başlarken okur; servis ana sunucu tarafından ya da pm2 ile ayrı
başlatılsa da aynı şekilde çalışır. En azından:

```
OPENAI_API_KEY=...
REPLICATE_API_TOKEN=...        # sunucuda Demucs yoksa
DUBPACK_ADMIN_TOKEN=uzun-rastgele-bir-metin
```

Hiçbir yapay zekâ aracı yoksa da sayfa çalışır: ayrıştırma FFmpeg merkez kanal iptaliyle
(düşük kalite) yapılır, replik zamanları ses seviyesinden bulunur ve metinler editörde elle
yazılır. Hangi araçların bulunduğunu `GET /dublaj/api/health` gösterir.

Nginx kullanılıyorsa yükleme ve render için `location /` bloğuna şunlar eklenmeli:

```nginx
client_max_body_size 150m;
proxy_request_buffering off;
```

Mikrofon kaydı yalnızca HTTPS'te çalışır.

### Yetki

Hesap gerekmez. Paketi oluşturan tarayıcıya bir düzenleme anahtarı verilir ve paketi
sadece o tarayıcı düzenleyebilir. `DUBPACK_ADMIN_TOKEN` tanımlanırsa, paketler sayfasındaki
anahtar simgesine bu değeri giren kişi tüm paketleri düzenleyebilir, yayından kaldırabilir
ve silebilir. `DUBPACK_PUBLISH_REQUIRES_ADMIN=true` ile kütüphaneye yalnızca yönetici yayın yapar.

Topluluk paketleri kullanıcıların yüklediği içerikten oluşur. Hak sahibinden kaldırma
talebi gelirse paket yönetici anahtarıyla silinir.
