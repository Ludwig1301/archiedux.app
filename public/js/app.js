async function apiFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Navbar: giriş durumuna göre sağ üstü doldur ----------
async function navBarDoldur() {
  const navSag = document.getElementById("navSag");
  if (!navSag) return;

  let veri = { girisYapti: false };
  try {
    const res = await apiFetch("/api/me");
    if (res.ok) veri = await res.json();
  } catch (e) {
    // Navbar beklenmeyen ağ hatasında sayfanın geri kalanını kilitlemesin.
  }

  if (veri.girisYapti) {
    navSag.innerHTML = `
      <div class="bildirim-kutu" id="bildirimKutu">
        <button type="button" class="bildirim-can" id="bildirimCan" onclick="bildirimPanelAcKapat(event)" aria-label="Bildirimler">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          <span class="bildirim-rozet" id="bildirimRozet" style="display:none;">0</span>
        </button>
        <div class="bildirim-panel" id="bildirimPanel" style="display:none;">
          <div class="bildirim-baslik">Bildirimler</div>
          <div class="bildirim-listesi" id="bildirimListesi"></div>
        </div>
      </div>
      ${veri.admin ? `<a href="/log">GÜNLÜK</a>` : ""}
      <a href="/profil?id=${veri.id}">${veri.kullaniciAdi}</a>
      <a href="/auth/logout" class="cikis-link">Çıkış</a>
    `;
    bildirimYukle();
  } else {
    navSag.innerHTML = `<a href="/auth/login" class="discord-giris-btn">Discord ile Giriş Yap</a>`;
  }

  // Anasayfadaki büyük giriş butonu: giriş yapılmışsa gizle, değilse göster
  const heroBtn = document.getElementById("heroGirisBtn");
  if (heroBtn) {
    heroBtn.style.display = veri.girisYapti ? "none" : "inline-flex";
  }
  return veri;
}

// ---------- Bildirim çanı (okunmamış yorum) ----------

async function bildirimYukle() {
  try {
    const res = await fetch("/api/bildirimler");
    const veri = await res.json();
    const sayi = veri.sayi || 0;
    const rozet = document.getElementById("bildirimRozet");
    if (rozet) {
      rozet.innerText = sayi > 9 ? "9+" : String(sayi);
      rozet.style.display = sayi > 0 ? "flex" : "none";
    }
    bildirimListesiCiz(veri.liste || [], veri.id);
  } catch (e) {
    /* yoksay */
  }
}

function bildirimListesiCiz(liste, kendiId) {
  const kutu = document.getElementById("bildirimListesi");
  if (!kutu) return;
  if (!liste.length) {
    kutu.innerHTML = '<div class="bildirim-bos">Yeni bildiriminiz yok.</div>';
    return;
  }
  kutu.innerHTML = liste
    .map((b) => {
      const galeri = b.tur === "galeri";
      const link = galeri ? `/galeri?id=${kendiId}` : `/profil?id=${kendiId}`;
      const eylem = galeri ? "galerine yorum yaptı" : "profiline yorum yaptı";
      return `
      <a class="bildirim-ogesi ${b.okundu ? "" : "yeni"}" href="${link}">
        <span class="bildirim-oge-nokta"></span>
        <span class="bildirim-oge-metin">
          <strong>${htmlEsc(b.yazanAd)}</strong> ${eylem}
          ${b.yorumMetni ? `<span class="bildirim-oge-yorum">"${htmlEsc(b.yorumMetni)}"</span>` : ""}
        </span>
      </a>`;
    })
    .join("");
}

async function bildirimPanelAcKapat(evt) {
  if (evt) evt.stopPropagation();
  const panel = document.getElementById("bildirimPanel");
  if (!panel) return;
  if (panel.style.display === "block") {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";
  const rozet = document.getElementById("bildirimRozet");
  const okunmamis = rozet && rozet.style.display !== "none";
  if (okunmamis) {
    try {
      await fetch("/api/bildirimler/okundu", { method: "POST" });
      if (rozet) rozet.style.display = "none";
      bildirimYukle();
    } catch (e) {
      /* yoksay */
    }
  }
}

// Çan dışına tıklanınca panel kapanır
document.addEventListener("click", (e) => {
  const kutu = document.getElementById("bildirimKutu");
  const panel = document.getElementById("bildirimPanel");
  if (panel && kutu && !kutu.contains(e.target)) {
    panel.style.display = "none";
  }
});

// Kullanıcının yüklediği görseli (önizleme + gizli input) temizler.
// Eğer görsel `/uploads/...` dizinindeyse sunucudan silme isteği gönderir.
async function removeUploadedImage(hiddenInputId, previewElId) {
  const inputEl = document.getElementById(hiddenInputId);
  const previewEl = document.getElementById(previewElId);
  if (!inputEl) return;
  const mevcut = inputEl.value || "";

  if (mevcut.startsWith("/uploads/")) {
    try {
      await fetch("/api/delete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mevcut }),
      });
    } catch (e) {
      console.warn("Sunucudan silme isteği gönderilemedi:", e);
    }
  }

  inputEl.value = "";
  if (previewEl) onizlemeElGuncelle(previewElId, "");
  canliKaydiTetikle();
}

// ---------- Spotify (kendi Lanyard kurulumumuz) - herhangi bir Discord ID için ----------
// Kutu her zaman görünür; dinlemiyorsa "müzik dinlemiyor" durumu gösterir.
async function spotifyYukle(discordId) {
  const kutu = document.getElementById("spotifyKutusu");
  if (!kutu) return;
  const resim = document.getElementById("spotifyResim");
  const sarki = document.getElementById("spotifySarki");
  const sanatci = document.getElementById("spotifySanatci");
  const baslik = kutu.querySelector(".spotify-header");
  const equalizer = kutu.querySelector(".equalizer");

  try {
    const res = await fetch(`/lanyard/v1/users/${discordId}`);
    const json = await res.json();
    const veri = json.data;

    kutu.style.display = "block";
    if (veri && veri.listening_to_spotify) {
      resim.src = veri.spotify.album_art_url;
      resim.style.display = "block";
      sarki.innerText = veri.spotify.song;
      sanatci.innerText = veri.spotify.artist;
      sarki.style.color = "";
      sarki.style.whiteSpace = "nowrap";
      sarki.style.overflow = "hidden";
      sarki.style.textOverflow = "ellipsis";
      sarki.style.maxWidth = "140px";
      sanatci.style.color = "";
      baslik.innerText = "Spotify'da Dinliyor";
      equalizer.style.display = "flex";
    } else {
      resim.style.display = "none";
      sarki.innerText = "Şu an müzik dinlemiyor";
      sanatci.innerText = "";
      sarki.style.color = "var(--ink-text-dim)";
      sarki.style.whiteSpace = "normal";
      sarki.style.overflow = "visible";
      sarki.style.textOverflow = "clip";
      sarki.style.maxWidth = "none";
      baslik.innerText = "Spotify";
      equalizer.style.display = "none";
    }
  } catch (e) {
    kutu.style.display = "block";
    resim.style.display = "none";
    sarki.innerText = "Spotify durumu alınamadı";
    sanatci.innerText = "";
    sarki.style.color = "var(--ink-text-dim)";
    sarki.style.whiteSpace = "normal";
    sarki.style.overflow = "visible";
    sarki.style.textOverflow = "clip";
    sarki.style.maxWidth = "none";
    baslik.innerText = "Spotify";
    equalizer.style.display = "none";
  }
}

// ---------- Görünüm özelleştirme ----------
const AKSAN_PALETI = [
  { ad: "Kehribar (varsayılan)", hex: "#c9a227" },
  { ad: "Kızıl Mühür", hex: "#8b2222" },
  { ad: "Lacivert", hex: "#2d4e8c" },
  { ad: "Zümrüt", hex: "#22785a" },
  { ad: "Bakır", hex: "#b5651d" },
  { ad: "Gümüş", hex: "#9a9aa2" },
];

// Bir profile ait görünüm ayarlarını mainframe elementine uygular
function gorunumUygula(mainframeEl, kapakEl, profil) {
  // aksan rengi
  if (profil.aksanRenk) {
    mainframeEl.style.setProperty("--aksan-renk", profil.aksanRenk);
  } else {
    mainframeEl.style.removeProperty("--aksan-renk");
  }

  // arka plan: özel renk (2 renkli gradyan) veya özel görsel (bulanıklık destekli)
  mainframeEl.classList.remove("bg-resim");
  mainframeEl.style.removeProperty("--profil-arkaplan");
  mainframeEl.style.removeProperty("--profil-blur");

  const tur = profil.arkaplanTuru || "renk";
  if (tur === "renk") {
    const r1 = profil.arkaplanRenk1 || "#1c1a12";
    const r2 = profil.arkaplanRenk2 || "#161619";
    mainframeEl.style.setProperty(
      "--profil-arkaplan",
      `linear-gradient(165deg, ${r1} 0%, ${r2} 75%)`
    );
  } else if (tur === "resim" && profil.arkaplanResim) {
    mainframeEl.classList.add("bg-resim");
    mainframeEl.style.setProperty("--profil-arkaplan", `url('${profil.arkaplanResim}')`);
    mainframeEl.style.setProperty("--profil-blur", `${profil.arkaplanBlur || "0"}px`);
  }

  // kapak fotoğrafı
  if (kapakEl) {
    if (profil.kapakFoto) {
      kapakEl.style.backgroundImage = `url('${profil.kapakFoto}')`;
      kapakEl.classList.remove("kapak-bos");
    } else {
      kapakEl.style.backgroundImage = "";
      kapakEl.classList.add("kapak-bos");
    }
  }
}

// ---------- Vitrin (Steam vitrin yöneticisi tarzı) ----------
const VITRIN_BASLIKLAR = {
  proje: "Öne Çıkan Proje",
  galeri: "Galeri Vitrini",
  film: "Favori Film",
  sarki: "Favori Şarkı",
};

// TMDB afişlerini sunucu proxy'sinden geçir; bazı ağlar image.tmdb.org'u reddediyor.
function filmPosterUrl(url) {
  const deger = String(url || "");
  if (!deger) return "";
  if (deger.startsWith("/api/filmler/poster?")) return deger;
  try {
    const parsed = new URL(deger, window.location.origin);
    if (parsed.hostname === "image.tmdb.org" || parsed.hostname === "media.themoviedb.org") {
      const eslesme = parsed.pathname.match(/^\/t\/p\/[^/]+(\/[^?]+)$/);
      if (eslesme) return `/api/filmler/poster?path=${encodeURIComponent(eslesme[1])}`;
    }
  } catch (e) {
    return deger;
  }
  return deger;
}

let GUNCEL_VITRINLER = [];
let GUNCEL_FAVORI_FILM = null;

// Vitrin alanlarını (birden çok) çizer. profil: API'den gelen profil verisi
function vitrinCiz(profil) {
  const kutu = document.getElementById("pVitrinler");
  if (!kutu) return;
  const liste = Array.isArray(profil.vitrinler) ? profil.vitrinler : [];
  if (!liste.length) {
    kutu.style.display = "none";
    return;
  }
  kutu.style.display = "";
  kutu.innerHTML = liste.map((v, idx) => {
    const tur = v.tur || "proje";
    return `
      <div class="vitrin">
        <div class="vitrin-baslik">${VITRIN_BASLIKLAR[tur] || "Vitrin"}</div>
        <div class="vitrin-icerik">${vitrinBirimIcerik(profil, v)}</div>
      </div>`;
  }).join("");
}

function vitrinBirimIcerik(profil, v) {
  const tur = v.tur || "proje";
  if (tur === "galeri") {
    const gorseller = (profil.vitrinGaleri || GUNCEL_VITRIN_GALERI || []).filter(Boolean);
    if (!gorseller.length) return '<span class="bos-hint">Galeride henüz fotoğraf yok.</span>';
    return `<div class="vitrin-galeri">${gorseller.map((u) => `<a href="/galeri?id=${GORUNTULENEN_ID}"><img src="${htmlEsc(u)}" alt="" loading="lazy" /></a>`).join("")}</div>`;
  }
  if (tur === "film") {
    const filmler = profil.filmler || GUNCEL_PROFIL_FILMLER || [];
    const favori = profil.favoriFilm || GUNCEL_FAVORI_FILM || filmler.find((f) => f.favori);
    if (!favori) return '<span class="bos-hint">Henüz favori film seçilmemiş.</span>';
    return `
      <div class="vitrin-film">
        ${favori.poster ? `<img src="${htmlEsc(filmPosterUrl(favori.poster))}" alt="" class="vitrin-film-poster" onerror="gorselHataYerineIcon(this)" />` : ""}
        <div class="proje-detay">
          <h3>${htmlEsc(favori.ad)}</h3>
          <p>${favori.tur === "film" ? "Film" : "Dizi"}${favori.yil ? ` · ${htmlEsc(favori.yil)}` : ""}</p>
          <div class="vitrin-film-alt">${puanYildizlariHTML(favori.puan)}</div>
          ${favori.yorum ? `<p class="vitrin-film-yorum">${htmlEsc(favori.yorum)}</p>` : ""}
        </div>
      </div>`;
  }
  if (tur === "sarki") {
    const sarki = profil.favoriSarki || GUNCEL_FAVORI_SARKI;
    if (!sarki || !sarki.ad) return '<span class="bos-hint">Henüz favori şarkı seçilmemiş.</span>';
    return `
      <div class="vitrin-sarki">
        ${sarki.kapak ? `<img src="${htmlEsc(sarki.kapak)}" alt="" class="vitrin-sarki-kapak" />` : ""}
        <div class="proje-detay">
          <h3>${htmlEsc(sarki.ad)}</h3>
          <p>${htmlEsc(sarki.sanatci || "")}</p>
          ${sarki.album ? `<p class="vitrin-sarki-album">${htmlEsc(sarki.album)}</p>` : ""}
        </div>
      </div>`;
  }
  // proje
  if (v.baslik) {
    return `
      ${v.resim ? `<img src="${htmlEsc(v.resim)}" class="proje" />` : ""}
      <div class="proje-detay">
        <h3>${htmlEsc(v.baslik)}</h3>
        <p>${htmlEsc(v.aciklama || "")}</p>
      </div>`;
  }
  return '<span class="bos-hint">Bu vitrin henüz boş.</span>';
}

// Düzenleme paneli: çoklu vitrin listesi
function vitrinKayitHTML(v, i) {
  const tur = v.tur || "proje";
  const ipucu = tur === "galeri"
    ? "Profilindeki galeri fotoğrafları burada sergilenir."
    : tur === "film"
      ? "Favori filmin burada sergilenir. Günlük sayfandan seçebilirsin."
      : tur === "sarki"
        ? "Aşağıdaki 'Favori Şarkı' bölümünden şarkını seç."
        : "";
  return `
    <div class="vitrin-kayit">
      <div class="vitrin-kayit-ust">
        <span class="vitrin-kayit-no">Vitrin ${i + 1}</span>
        <span class="vitrin-kayit-oklar">
          <button type="button" class="vitrin-ok" onclick="vitrinYukari(${i})" title="Yukarı taşı" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="vitrin-ok" onclick="vitrinAsagi(${i})" title="Aşağı taşı" ${i === GUNCEL_VITRINLER.length - 1 ? "disabled" : ""}>↓</button>
        </span>
        <button type="button" class="vitrin-kayit-sil" onclick="vitrinSil(${i})" title="Vitrini sil">×</button>
      </div>
      <div class="form-alani">
        <label>Vitrin Türü</label>
        <select onchange="vitrinKayitTurDegisti(${i}, this.value)">
          <option value="proje" ${tur === "proje" ? "selected" : ""}>Öne Çıkan Proje</option>
          <option value="galeri" ${tur === "galeri" ? "selected" : ""}>Galeri Vitrini</option>
          <option value="film" ${tur === "film" ? "selected" : ""}>Favori Film</option>
          <option value="sarki" ${tur === "sarki" ? "selected" : ""}>Favori Şarkı</option>
        </select>
      </div>
      ${tur === "proje" ? `
        <div class="form-alani">
          <label>Proje Başlığı</label>
          <input type="text" value="${htmlEsc(v.baslik || "")}" placeholder="Örn: Portfolyo Sitesi" oninput="vitrinKayitAlanDegisti(${i}, 'baslik', this.value)" />
        </div>
        <div class="form-alani">
          <label>Proje Açıklaması</label>
          <textarea rows="2" placeholder="Projeyi kısaca anlat..." oninput="vitrinKayitAlanDegisti(${i}, 'aciklama', this.value)">${htmlEsc(v.aciklama || "")}</textarea>
        </div>
        <div class="form-alani">
          <label>Proje Görseli</label>
          <div class="dosya-secici" onclick="document.getElementById('vitrinDosya${i}').click()">
            <div class="dosya-secici-onizleme" id="vitrinOnizleme${i}">
              <button type="button" class="remove-image" onclick="event.stopPropagation(); vitrinResimSil(${i})">×</button>
            </div>
            <div class="dosya-secici-metin"><strong>Görsel seç</strong><span>PNG, JPG, GIF, WEBP</span></div>
          </div>
          <input type="file" id="vitrinDosya${i}" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none;" onchange="vitrinGorselSec(this.files[0], ${i})" />
          <input type="hidden" id="vitrinResim${i}" value="${htmlEsc(v.resim || "")}" />
        </div>` : `
        <div class="form-yardim vitrin-ipucu">${ipucu}</div>`}
    </div>`;
}

function vitrinListesiCiz() {
  const kutu = document.getElementById("vitrinListesi");
  if (!kutu) return;
  kutu.innerHTML = GUNCEL_VITRINLER.map((v, i) => vitrinKayitHTML(v, i)).join("");
  GUNCEL_VITRINLER.forEach((v, i) => {
    onizlemeElGuncelle(`vitrinOnizleme${i}`, v.resim || "");
  });
  const sarkiBolumu = document.getElementById("favoriSarkiBolumu");
  if (sarkiBolumu) {
    sarkiBolumu.style.display = GUNCEL_VITRINLER.some((x) => x.tur === "sarki") ? "block" : "none";
  }
}

function vitrinKayitTurDegisti(i, tur) {
  if (!GUNCEL_VITRINLER[i]) return;
  GUNCEL_VITRINLER[i].tur = tur;
  vitrinListesiCiz();
  canliKaydiTetikle();
}

function vitrinKayitAlanDegisti(i, alan, deger) {
  if (!GUNCEL_VITRINLER[i]) return;
  GUNCEL_VITRINLER[i][alan] = deger;
  canliKaydiTetikle();
}

function vitrinEkle() {
  GUNCEL_VITRINLER.push({ tur: "proje", baslik: "", aciklama: "", resim: "" });
  vitrinListesiCiz();
  canliKaydiTetikle();
}

function vitrinSil(i) {
  GUNCEL_VITRINLER.splice(i, 1);
  vitrinListesiCiz();
  canliKaydiTetikle();
}

function vitrinYukari(i) {
  if (i <= 0 || i >= GUNCEL_VITRINLER.length) return;
  const t = GUNCEL_VITRINLER[i];
  GUNCEL_VITRINLER[i] = GUNCEL_VITRINLER[i - 1];
  GUNCEL_VITRINLER[i - 1] = t;
  vitrinListesiCiz();
  canliKaydiTetikle();
}

function vitrinAsagi(i) {
  if (i < 0 || i >= GUNCEL_VITRINLER.length - 1) return;
  const t = GUNCEL_VITRINLER[i];
  GUNCEL_VITRINLER[i] = GUNCEL_VITRINLER[i + 1];
  GUNCEL_VITRINLER[i + 1] = t;
  vitrinListesiCiz();
  canliKaydiTetikle();
}

function vitrinGorselSec(dosya, i) {
  dosyaYukle(dosya, `vitrinResim${i}`, `vitrinOnizleme${i}`, () => {
    if (GUNCEL_VITRINLER[i]) {
      GUNCEL_VITRINLER[i].resim = document.getElementById(`vitrinResim${i}`).value || "";
    }
  });
}

function vitrinResimSil(i) {
  const input = document.getElementById(`vitrinResim${i}`);
  if (!input) return;
  const mevcut = input.value || "";
  if (mevcut.startsWith("/uploads/")) {
    fetch("/api/delete-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: mevcut }),
    }).catch(() => {});
  }
  if (GUNCEL_VITRINLER[i]) GUNCEL_VITRINLER[i].resim = "";
  input.value = "";
  vitrinListesiCiz();
  canliKaydiTetikle();
}

// Favori şarkı seçimi (iTunes araması)
async function sarkiAra() {
  const q = document.getElementById("sarkiAramaInput").value.trim();
  const kutu = document.getElementById("sarkiSonuclar");
  if (!q) {
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Aramak için bir şeyler yaz.</span>';
    return;
  }
  if (kutu) kutu.innerHTML = '<span class="bos-hint">Aranıyor…</span>';
  try {
    const res = await apiFetch(`/api/sarki/arama?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Arama yapılamadı.");
    const sonuc = await res.json();
    GUNCEL_SARKI_ARAMA = Array.isArray(sonuc) ? sonuc : [];
    sarkiSonuclariCiz();
  } catch (e) {
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Arama şu anda yapılamadı.</span>';
  }
}

function sarkiSonuclariCiz() {
  const kutu = document.getElementById("sarkiSonuclar");
  if (!kutu) return;
  if (!GUNCEL_SARKI_ARAMA.length) {
    kutu.innerHTML = '<span class="bos-hint">Sonuç bulunamadı.</span>';
    return;
  }
  kutu.innerHTML = GUNCEL_SARKI_ARAMA.map((s, i) => `
    <button type="button" class="sarki-sonuc" onclick="sarkiSec(${i})">
      ${s.kapak ? `<img src="${htmlEsc(s.kapak)}" alt="" loading="lazy" />` : `<span class="sarki-sonuc-yok"></span>`}
      <span class="sarki-sonuc-bilgi">
        <strong>${htmlEsc(s.ad)}</strong>
        <em>${htmlEsc(s.sanatci)}</em>
      </span>
    </button>
  `).join("");
}

function sarkiSec(i) {
  const s = GUNCEL_SARKI_ARAMA[i];
  if (!s) return;
  GUNCEL_FAVORI_SARKI = s;
  sarkiSeciliCiz();
  canliKaydiTetikle();
}

function sarkiTemizle() {
  GUNCEL_FAVORI_SARKI = null;
  sarkiSeciliCiz();
  canliKaydiTetikle();
}

function sarkiSeciliCiz() {
  const kutu = document.getElementById("sarkiSecili");
  if (!kutu) return;
  const s = GUNCEL_FAVORI_SARKI;
  if (!s || !s.ad) {
    kutu.style.display = "none";
    return;
  }
  kutu.style.display = "flex";
  const kapakEl = document.getElementById("sarkiSeciliKapak");
  if (kapakEl) kapakEl.src = s.kapak || "";
  const adEl = document.getElementById("sarkiSeciliAd");
  if (adEl) adEl.innerText = s.ad;
  const sanatciEl = document.getElementById("sarkiSeciliSanatci");
  if (sanatciEl) sanatciEl.innerText = s.sanatci || "";
}

// ---------- Profil sayfası ----------
let GORUNTULENEN_ID = null;
let BENIM_ID = null;
let BENIM_ADMIN = false;
let DISCORD_AVATAR = "";
let GUNCEL_PROFIL_FOTO = "";
let GUNCEL_HAYVAN_RESMI = "";
let GUNCEL_FAVORI_SARKI = null;
let GUNCEL_SARKI_ARAMA = [];
let GUNCEL_VITRIN_GALERI = [];
let GUNCEL_PROFIL_FILMLER = [];
let cropper = null;
let YORUM_SAYFA = 1;
let YORUM_SAYFALAMA = { sayfa: 1, toplam: 0, toplamSayfa: 1 };
let GALLERY_ENTRIES = [];
let AKTIF_GALERI_ENTRY = null;

// Admin ya da profil sahibi profili düzenleyebilir
function buProfiliDuzenleyebilir() {
  return BENIM_ID === GORUNTULENEN_ID || BENIM_ADMIN;
}

// Kayıt hedefi: admin başkasının profilini düzenliyorsa o profilin id'si döner
function kayitHedefi() {
  return BENIM_ADMIN && BENIM_ID !== GORUNTULENEN_ID ? GORUNTULENEN_ID : null;
}

// ---------- Seviye / XP / Rozetler ----------
let GUNCEL_XP = 0;
let GUNCEL_XP_YAZI = "";
let GUNCEL_ROZETLER = [];

function seviyeBilgisi(xp) {
  xp = Math.max(0, xp || 0);
  let seviye = 1;
  let kalan = xp;
  while (kalan >= seviye * 100) {
    kalan -= seviye * 100;
    seviye++;
  }
  return { seviye, mevcut: kalan, gerekli: seviye * 100 };
}

function seviyeGoster() {
  const bilgi = seviyeBilgisi(GUNCEL_XP);
  const rozet = document.getElementById("pSeviye");
  if (rozet) rozet.innerText = "Lv. " + bilgi.seviye;
  const ilerleme = document.getElementById("pSeviyeIlerleme");
  // Özel XP yazısı varsa (easter egg) hesaplanan yerine o yazı gösterilir
  if (ilerleme) ilerleme.innerText = GUNCEL_XP_YAZI || `${bilgi.mevcut}/${bilgi.gerekli} XP`;
  const doluluk = document.getElementById("pSeviyeDoluluk");
  if (doluluk) doluluk.style.width = Math.min(100, Math.round((bilgi.mevcut / bilgi.gerekli) * 100)) + "%";
}

function rozetlerGoster() {
  const kutu = document.getElementById("pRozetler");
  if (!kutu) return;
  const list = Array.isArray(GUNCEL_ROZETLER) ? GUNCEL_ROZETLER : [];
  if (!list.length) {
    kutu.innerHTML = '<span class="bos-hint">Henüz rozet bulunmamış. Gizli sürprizleri keşfet!</span>';
    return;
  }
  kutu.innerHTML = list
    .map(
      (r) => `
      <span class="rozet-oge" title="${htmlEsc(r.ad)}">
        <span class="rozet-ikon">${rozetIkonu(r)}</span>
      </span>
    `
    )
    .join("");
}

function rozetIkonu(rozet) {
  const ikonlar = {
    "muhr-bekcisi": '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l5 7 8-1-1 8 7 5-7 5 1 8-8-1-5 7-5-7-8 1 1-8-7-5 7-5-1-8 8 1 5-7z"/><path d="M17 24l5 5 10-11"/></svg>',
    "retro-oyuncu": '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="13" width="36" height="22" rx="8"/><path d="M15 24h8m-4-4v8m12-3h.01m5-4h.01"/><path d="M12 38l5-5m19 5l-5-5"/></svg>',
    "gizli-kelime": '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="21" cy="21" r="12"/><path d="M30 30l10 10M17 21h8m-4-4v8"/></svg>',
    "perde": '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="3"/><path d="M15 10v28m18-28v28M15 10l3 7-3 7 3 7-3 7M33 10l-3 7 3 7-3 7 3 7"/></svg>',
    "archie-avcisi": '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="20" cy="20" r="12"/><path d="M29 29l11 11M15 20h10m-5-5v10"/></svg>',
    "koleksiyoncu": '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="16" cy="26" r="10"/><circle cx="32" cy="26" r="10"/><path d="M16 16a10 10 0 0 1 16 0M24 16v10"/></svg>',
    "sinema-tutkunu": '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 14l10 6v8l-10 6z"/><rect x="18" y="14" width="22" height="20" rx="3"/><path d="M22 20h8m-4-4v8"/></svg>',
    "okur": '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8a5 5 0 0 1 5-5h19v34H17a5 5 0 0 0-5 5z"/><path d="M12 8v34"/><path d="M20 14h13M20 21h13"/></svg>',
  };
  return ikonlar[rozet.kod] || '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 6v10c0 10-6 17-15 22C15 38 9 31 9 21V11l15-6z"/><path d="M16 24l5 5 11-12"/></svg>';
}

// Bulunan easter egg rozetini sunucudan talep et (XP + rozet)
async function rozetTalepEt(kod) {
  if (!BENIM_ID) return;
  try {
    const res = await fetch("/api/rozet/kod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kod }),
    });
    if (!res.ok) return;
    const veri = await res.json();
    if (veri.zatenVar) return;
    alert(`🎉 Rozet kazandın: ${veri.rozet.ad} (+${veri.kazanilanXp} XP)`);
    if (BENIM_ID === GORUNTULENEN_ID) {
      GUNCEL_XP = (GUNCEL_XP || 0) + (veri.kazanilanXp || 0);
      GUNCEL_ROZETLER = veri.rozetler || GUNCEL_ROZETLER;
      seviyeGoster();
      rozetlerGoster();
    }
  } catch (e) {
    /* yoksay */
  }
}

// Easter egg tetikleyicileri
(function easterEggler() {
  // 1) Navbardaki mühre 3 kez sağ tıkla (logo link olduğu için sol tık ana sayfaya atar)
  let muhrSayac = 0;
  document.addEventListener("contextmenu", (e) => {
    const mark = e.target.closest(".navbar-mark");
    if (!mark) return;
    e.preventDefault();
    muhrSayac++;
    if (muhrSayac >= 3) {
      muhrSayac = 0;
      rozetTalepEt("muhr-bekcisi");
    }
  });

  // 2) Konami kodu (↑↑↓↓←→←→B A)
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konamiIndex = 0;
  document.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === KONAMI[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === KONAMI.length) {
        konamiIndex = 0;
        rozetTalepEt("retro-oyuncu");
      }
    } else {
      konamiIndex = k === KONAMI[0] ? 1 : 0;
    }
  });

  // 3) Sitede "congress" yaz
  let kelimeBuf = "";
  document.addEventListener("keydown", (e) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      kelimeBuf += e.key.toLowerCase();
      if (kelimeBuf.length > 8) kelimeBuf = kelimeBuf.slice(-8);
      if (kelimeBuf === "congress") {
        kelimeBuf = "";
        rozetTalepEt("gizli-kelime");
      } else if (kelimeBuf === "archie") {
        kelimeBuf = "";
        rozetTalepEt("archie-avcisi");
      }
    }
  });

  // 4) Navbardaki FİLM & DİZİ yazısına 3 kez sağ tıkla
  let perdeSayac = 0;
  document.addEventListener("contextmenu", (e) => {
    const link = e.target.closest('.nav-sol a[href="/filmler"]');
    if (!link) return;
    e.preventDefault();
    perdeSayac++;
    if (perdeSayac >= 3) {
      perdeSayac = 0;
      rozetTalepEt("perde");
    }
  });
})();

function urlIdOku() {
  return new URLSearchParams(window.location.search).get("id");
}

// ---------- Profil şarkısı (YouTube) — tüm sayfalarda çalar ----------
const PLAY_IKON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const DURDUR_IKON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
const MUZIK_KEY = "congress.muzik";
let GUNCEL_PLAYER = null;
let GUNCEL_PLAYER_OYNUYOR = false;
let GUNCEL_PLAYER_ISTEK = false; // kullanıcı müziğin çalmasını istiyor mu
let GUNCEL_PLAYER_ID = "";
let GUNCEL_PLAYER_AD = "";
let GUNCEL_MUZIK_SAHIPI = ""; // hangi üyenin şarkısı çalıyor
let YT_HAZIR_CALLBACKLER = [];
let YT_API_YUKLENIYOR = false;

function ytApiHazirMi() {
  return !!(window.YT && typeof window.YT.Player === "function");
}

window.onYouTubeIframeAPIReady = function () {
  YT_API_YUKLENIYOR = false;
  if (!ytApiHazirMi()) return;
  const callbacks = YT_HAZIR_CALLBACKLER.splice(0);
  callbacks.forEach((callback) => callback());
};

function youtubeVideoIdCek(url) {
  if (!url) return "";
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : "";
}

function ytApiYukle(cb) {
  if (ytApiHazirMi()) {
    cb();
    return;
  }
  YT_HAZIR_CALLBACKLER.push(cb);
  if (YT_API_YUKLENIYOR) return;

  let script = document.getElementById("yt-api-script");
  if (!script) {
    script = document.createElement("script");
    script.id = "yt-api-script";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  }
  // The script's load event fires before the API has installed YT.Player.
  // Wait for YouTube's official ready callback instead of constructing early.
  YT_API_YUKLENIYOR = true;
}

// Oynatıcıyı her sayfaya ekle (yoksa oluştur) ve son çalan şarkıyı devam ettir
function profilPlayerOlustur() {
  if (document.getElementById("profilPlayer")) return;
  const kutu = document.createElement("div");
  kutu.className = "profil-player";
  kutu.id = "profilPlayer";
  kutu.style.display = "none";
  kutu.innerHTML = `
    <div class="profil-player-ust">
      <img class="profil-player-thumb" id="profilPlayerThumb" src="" alt="" />
      <button type="button" class="profil-player-btn" id="profilPlayerToggle" onclick="profilPlayerToggle()" title="Oynat / Durdur"></button>
      <input type="range" class="profil-player-ses" id="profilPlayerSes" min="0" max="100" value="70" oninput="profilPlayerSesDegistir(this.value)" title="Ses seviyesi" />
      <button type="button" class="profil-player-btn profil-player-kapat" onclick="profilPlayerKapat()" title="Kapat">×</button>
    </div>
    <div class="profil-player-marquee" id="profilPlayerMarquee">
      <div class="profil-player-marquee-ic" id="profilPlayerMarqueeIc"></div>
    </div>
    <div id="profilPlayerVideo" class="profil-player-video"></div>`;
  document.body.appendChild(kutu);
  profilPlayerIkonGuncelle();
}

function muzikKaydet() {
  try {
    localStorage.setItem(MUZIK_KEY, JSON.stringify({
      videoId: GUNCEL_PLAYER_ID,
      ad: GUNCEL_PLAYER_AD,
      position: GUNCEL_PLAYER ? Math.floor(GUNCEL_PLAYER.getCurrentTime() || 0) : 0,
      volume: GUNCEL_PLAYER ? GUNCEL_PLAYER.getVolume() : 70,
      sahip: GUNCEL_MUZIK_SAHIPI,
      zaman: Date.now(),
    }));
  } catch (e) {}
}

function muzikTemizle() {
  try { localStorage.removeItem(MUZIK_KEY); } catch (e) {}
}

// Sayfadan çıkarken (yeni sayfaya geçişte) çalan konumu kaydet
window.addEventListener("pagehide", () => {
  if (GUNCEL_PLAYER && GUNCEL_PLAYER_OYNUYOR) muzikKaydet();
});

// Şarkı adını oEmbed ile al (YouTube oEmbed, anahtar gerekmez)
async function muzikBaslikGetir(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await apiFetch(`/api/youtube/baslik?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const v = await res.json();
      if (v.ad) {
        GUNCEL_PLAYER_AD = v.ad;
        profilPlayerAdGoster(v.ad);
        muzikKaydet();
      }
    }
  } catch (e) {
    /* yoksay */
  }
}

// LED tabela tarzı akan şarkı adı (kısa isimse tek kopya, uzunsa kayan çift kopya)
function profilPlayerAdGoster(ad) {
  const ic = document.getElementById("profilPlayerMarqueeIc");
  const kutu = document.getElementById("profilPlayerMarquee");
  if (!ic || !kutu) return;
  ic.innerHTML = ad ? `<span>${htmlEsc(ad)}</span>` : "";
  kutu.classList.remove("kayiyor");
  if (ad && ic.scrollWidth > kutu.clientWidth) {
    ic.innerHTML = `<span>${htmlEsc(ad)}</span><span>${htmlEsc(ad)}</span>`;
    kutu.classList.add("kayiyor");
  }
}

function profilPlayerIkonGuncelle() {
  const btn = document.getElementById("profilPlayerToggle");
  if (btn) btn.innerHTML = GUNCEL_PLAYER_OYNUYOR ? DURDUR_IKON : PLAY_IKON;
}

function profilPlayerOynat() {
  if (!GUNCEL_PLAYER) return;
  GUNCEL_PLAYER_ISTEK = true;
  GUNCEL_PLAYER.playVideo();
}

function profilPlayerDurdur() {
  if (!GUNCEL_PLAYER) return;
  GUNCEL_PLAYER_ISTEK = false;
  GUNCEL_PLAYER.pauseVideo();
}

// Sekme gizlenince tarayıcı oynatıcıyı duraklatabilir; tekrar görünür olunca devam ettir
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && GUNCEL_PLAYER && GUNCEL_PLAYER_ISTEK && !GUNCEL_PLAYER_OYNUYOR) {
    GUNCEL_PLAYER.playVideo();
  }
});
window.addEventListener("focus", () => {
  if (GUNCEL_PLAYER && GUNCEL_PLAYER_ISTEK && !GUNCEL_PLAYER_OYNUYOR) {
    GUNCEL_PLAYER.playVideo();
  }
});

function profilPlayerYukle(videoId, konum, ses) {
  ytApiYukle(() => {
    if (!ytApiHazirMi()) return;
    if (GUNCEL_PLAYER) {
      GUNCEL_PLAYER.loadVideoById(videoId);
      if (konum > 1) GUNCEL_PLAYER.seekTo(konum, true);
      GUNCEL_PLAYER.setVolume(ses || 70);
      profilPlayerOynat();
    } else {
      GUNCEL_PLAYER = new window.YT.Player("profilPlayerVideo", {
        videoId,
        width: "200",
        height: "113",
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(ses || 70);
            const sesEl = document.getElementById("profilPlayerSes");
            if (sesEl) sesEl.value = ses || 70;
            GUNCEL_PLAYER_ISTEK = true;
            e.target.playVideo(); // otomatik oynatma denemesi; tarayıcı engellerse butonla
            if (konum > 1) {
              // video yüklenmeye başlayınca kaldığı yere atla
              setTimeout(() => { try { e.target.seekTo(konum, true); } catch (err) {} }, 400);
            }
          },
          onStateChange: (e) => {
            GUNCEL_PLAYER_OYNUYOR = e.data === window.YT.PlayerState.PLAYING;
            profilPlayerIkonGuncelle();
            if (e.data === window.YT.PlayerState.PLAYING) muzikKaydet();
          },
        },
      });
    }
  });
}

// Bir üyenin şarkısını aç (sadece üye sayfaları çağırır)
// Aynı üyenin sayfaları arasında geçişte kaldığı yerden devam eder; şarkı yoksa durur.
function profilSarkiGoster(url, sahipId) {
  const kutu = document.getElementById("profilPlayer");
  if (!kutu) return;
  const videoId = youtubeVideoIdCek(url);
  if (!videoId) {
    // bu üyenin şarkısı yok: müziği durdur ve oynatıcıyı gizle
    GUNCEL_MUZIK_SAHIPI = "";
    profilPlayerDurdur();
    muzikTemizle();
    kutu.style.display = "none";
    return;
  }
  let kayit = null;
  try { kayit = JSON.parse(localStorage.getItem(MUZIK_KEY) || "null"); } catch (e) {}
  // Aynı üyenin aynı şarkısıysa kaldığı yerden devam et
  const devamKonum = kayit && kayit.sahip === sahipId && kayit.videoId === videoId ? (kayit.position || 0) : 0;
  const ses = kayit && kayit.sahip === sahipId ? (kayit.volume || 70) : 70;
  GUNCEL_MUZIK_SAHIPI = sahipId;
  kutu.style.display = "flex";
  const thumb = document.getElementById("profilPlayerThumb");
  if (thumb) thumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const sesEl = document.getElementById("profilPlayerSes");
  if (sesEl) sesEl.value = ses;
  if (GUNCEL_PLAYER && GUNCEL_PLAYER_ID === videoId) {
    if (!GUNCEL_PLAYER_OYNUYOR) profilPlayerOynat();
    return;
  }
  GUNCEL_PLAYER_ID = videoId;
  GUNCEL_PLAYER_AD = "";
  muzikBaslikGetir(videoId);
  profilPlayerYukle(videoId, devamKonum, ses);
}

// Düzenleme panelinde şarkı değişince (sahip kendi profili)
function profilSarkiYukle(url) {
  profilSarkiGoster(url, GORUNTULENEN_ID);
}

function profilPlayerToggle() {
  if (GUNCEL_PLAYER_OYNUYOR) profilPlayerDurdur();
  else profilPlayerOynat();
}

function profilPlayerSesDegistir(val) {
  if (GUNCEL_PLAYER) GUNCEL_PLAYER.setVolume(parseInt(val, 10));
  muzikKaydet();
}

function profilPlayerKapat() {
  GUNCEL_PLAYER_ISTEK = false;
  if (GUNCEL_PLAYER) GUNCEL_PLAYER.pauseVideo();
  muzikTemizle();
  const kutu = document.getElementById("profilPlayer");
  if (kutu) kutu.style.display = "none";
}

// Düzenleme panelindeki şarkı önizlemesi
function profilSarkiOnizlemeGuncelle() {
  const input = document.getElementById("formProfilSarkiUrl");
  const onizleme = document.getElementById("profilSarkiOnizleme");
  if (!input || !onizleme) return;
  const videoId = youtubeVideoIdCek(input.value);
  if (!videoId) {
    onizleme.innerHTML = '<span class="form-yardim">Geçerli bir YouTube linki yapıştırdığında önizleme burada görünür.</span>';
    return;
  }
  onizleme.innerHTML = `
    <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="" />
    <span class="form-yardim">Bu şarkı profilinde otomatik oynatılır.</span>`;
}

async function profilSayfasiBaslat() {
  const ben = await navBarDoldur();
  BENIM_ID = ben && ben.girisYapti ? ben.id : null;
  BENIM_ADMIN = ben && ben.girisYapti && ben.admin === true;

  GORUNTULENEN_ID = urlIdOku() || BENIM_ID;

  if (!GORUNTULENEN_ID) {
    document.getElementById("yukleniyorAlani").innerHTML = `
      <div class="giris-uyari">
        <svg class="seal" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#c9a227" stroke-width="1.6"/>
          <circle cx="24" cy="24" r="17" stroke="#c9a227" stroke-width="1" opacity="0.6"/>
          <path d="M24 12 L27 20 L35 20 L28.5 25 L31 33 L24 28 L17 33 L19.5 25 L13 20 L21 20 Z" fill="#c9a227"/>
        </svg>
        <h2>Giriş Gerekli</h2>
        <p>Profilleri görüntülemek ve kendi profili düzenlemek için Discord ile giriş yapmalısın.</p>
        <a href="/auth/login" class="discord-giris-btn buyuk">Discord ile Giriş Yap</a>
      </div>`;
    return;
  }

  let res = null;
  try {
    res = await apiFetch(`/api/profile/${GORUNTULENEN_ID}?goruntulendi=1&yorumSayfa=1&yorumLimit=10`);
  } catch (e) {
    res = null;
  }
  if (!res || !res.ok) {
    document.getElementById("yukleniyorAlani").innerHTML = `
      <div class="giris-uyari">
        <svg class="seal" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#8b2222" stroke-width="1.6"/>
          <circle cx="24" cy="24" r="17" stroke="#8b2222" stroke-width="1" opacity="0.6"/>
          <path d="M24 12 L27 20 L35 20 L28.5 25 L31 33 L24 28 L17 33 L19.5 25 L13 20 L21 20 Z" fill="#8b2222"/>
        </svg>
        <h2>Üye Bulunamadı</h2>
        <p>Bu üye sunucuda değil ya da artık sunucuda bulunmuyor.</p>
        <a href="/uyeler" class="discord-giris-btn buyuk">Üye Listesine Git</a>
      </div>`;
    return;
  }
  const veri = await res.json();

  document.getElementById("yukleniyorAlani").style.display = "none";
  document.getElementById("profilAlani").style.display = "block";

  DISCORD_AVATAR = veri.avatar || "";
  GUNCEL_PROFIL_FOTO = veri.profil.avatar || "";
  GUNCEL_HAYVAN_RESMI = veri.profil.hayvanResmi || veri.profil.kediResmi || "";
  const profilFoto = GUNCEL_PROFIL_FOTO || DISCORD_AVATAR;
  document.getElementById("pAvatar").src = profilFoto;
  document.getElementById("profilFotoOnizleme").src = profilFoto;
  document.getElementById("profilFotoSilBtn").style.display = GUNCEL_PROFIL_FOTO ? "inline-block" : "none";
  document.getElementById("pIsim").innerText = veri.kullaniciAdi;
  document.title = veri.kullaniciAdi;
  document.getElementById("pUnvan").innerText = veri.profil.unvan || "Ünvan belirtilmemiş";
  document.getElementById("pBio").innerText =
    veri.profil.bio || "Bu kişi henüz kendini tanıtmamış.";

  // Görüntülenme sayısı (kimin baktığı değil, sadece sayı)
  const goruntelenmeEl = document.getElementById("profilGoruntulenme");
  if (goruntelenmeEl) goruntelenmeEl.innerText = (veri.profil.profilGoruntulenme || 0) + " görüntülenme";

  // Seviye ve rozetleri göster
  GUNCEL_XP = veri.profil.xp || 0;
  GUNCEL_XP_YAZI = veri.profil.xpYazi || "";
  GUNCEL_ROZETLER = veri.profil.rozetler || [];
  seviyeGoster();
  rozetlerGoster();

  // Film & Dizi günlüğü özeti (sağ panel)
  filmProfilGoster(veri.profil.filmler || [], veri.profil.filmSayisi || 0, veri.profil.filmAdet, veri.profil.diziAdet);

  // Kitap günlüğü özeti (sağ panel)
  kitapProfilGoster(veri.profil.kitaplar || [], veri.profil.kitapSayisi || 0);

  gorunumUygula(
    document.getElementById("profilAlani"),
    document.getElementById("pKapak"),
    veri.profil
  );

  // Vitrin verilerini sakla ve çiz
  GUNCEL_VITRIN_GALERI = veri.profil.vitrinGaleri || [];
  GUNCEL_PROFIL_FILMLER = veri.profil.filmler || [];
  vitrinCiz(veri.profil);

  const hayvanResim = veri.profil.hayvanResmi || veri.profil.kediResmi || "";
  const hayvanResimEl = document.getElementById("pHayvanResmi");
  const hayvanBosHint = document.getElementById("hayvanBosHint");
  if (hayvanResimEl) {
    hayvanResimEl.src = hayvanResim;
    hayvanResimEl.style.display = hayvanResim ? "block" : "none";
  }
  if (hayvanBosHint) hayvanBosHint.style.display = hayvanResim ? "none" : "block";

  const galeriLink = document.getElementById("galeriLink");
  if (galeriLink) {
    galeriLink.href = `/galeri?id=${GORUNTULENEN_ID}`;
  }

  // sahibi veya admin ise düzenle butonu ve yorum formu görünsün
  if (buProfiliDuzenleyebilir()) {
    document.getElementById("duzenleBtn").style.display = "inline-block";
    document.getElementById("kapakDegistirBtn").style.display = "flex";
  }
  if (BENIM_ID) {
    document.getElementById("yorumFormAlani").style.display = "flex";
  }
  // "Sevimli Dost" butonu yalnızca profil sahibine/admin'e gösterilir
  const hayvanBtn = document.getElementById("hayvanBtn");
  if (hayvanBtn) {
    hayvanBtn.style.display = buProfiliDuzenleyebilir() ? "flex" : "none";
  }
  hayvanSilBtnGuncelle();

  YORUM_SAYFA = veri.profil.yorumSayfalama?.sayfa || 1;
  YORUM_SAYFALAMA = veri.profil.yorumSayfalama || YORUM_SAYFALAMA;
  yorumlariCiz(veri.profil.yorumlar || [], YORUM_SAYFALAMA);
  spotifyYukle(GORUNTULENEN_ID);

  // düzenleme formunu mevcut verilerle önceden doldur
  document.getElementById("formUnvan").value = veri.profil.unvan || "";
  document.getElementById("formBio").value = veri.profil.bio || "";

  // Vitrin yöneticisi: mevcut vitrinleri yükle (yoksa bir boş vitrinle başla)
  GUNCEL_VITRINLER = Array.isArray(veri.profil.vitrinler) ? veri.profil.vitrinler.map((v) => ({ ...v })) : [];
  if (!GUNCEL_VITRINLER.length) GUNCEL_VITRINLER = [{ tur: "proje", baslik: "", aciklama: "", resim: "" }];
  GUNCEL_FAVORI_FILM = veri.profil.favoriFilm || null;
  GUNCEL_FAVORI_SARKI = veri.profil.favoriSarki || null;
  vitrinListesiCiz();
  sarkiSeciliCiz();

  // Profil şarkısı: formu doldur + önizleme + oynatıcıyı başlat
  const sarkiUrlInput = document.getElementById("formProfilSarkiUrl");
  if (sarkiUrlInput) sarkiUrlInput.value = veri.profil.profilSarkiUrl || "";
  profilSarkiOnizlemeGuncelle();
  profilSarkiGoster(veri.profil.profilSarkiUrl || "", GORUNTULENEN_ID);
  document.getElementById("formKapakFoto").value = veri.profil.kapakFoto || "";
  document.getElementById("formAksanRenk").value = veri.profil.aksanRenk || "";
  const arkaplanTuru = ["renk", "resim"].includes(veri.profil.arkaplanTuru)
    ? veri.profil.arkaplanTuru
    : "renk";
  document.getElementById("formArkaplanTuru").value = arkaplanTuru;
  document.getElementById("formArkaplanResim").value = veri.profil.arkaplanResim || "";
  const renk1El = document.getElementById("formArkaplanRenk1");
  if (renk1El) renk1El.value = veri.profil.arkaplanRenk1 || "#1c1a12";
  const renk2El = document.getElementById("formArkaplanRenk2");
  if (renk2El) renk2El.value = veri.profil.arkaplanRenk2 || "#161619";
  const blurDeger = veri.profil.arkaplanBlur || "0";
  const blurEl = document.getElementById("formArkaplanBlur");
  if (blurEl) blurEl.value = blurDeger;
  const blurGoster = document.getElementById("arkaplanBlurGoster");
  if (blurGoster) blurGoster.innerText = `${blurDeger}px`;

  const aksanBaslangic = veri.profil.aksanRenk || "";
  const aksanPicker = document.getElementById("formAksanRenkOzel");
  if (aksanPicker) aksanPicker.value = aksanBaslangic || VARSAYILAN_RENK;
  const aksanGoster = document.getElementById("renkHexGoster");
  if (aksanGoster) aksanGoster.innerText = aksanBaslangic || VARSAYILAN_RENK;
  renkSonlariniCiz();
  arkaplanSecimDegisti();

  // İsim / Ünvan renklerini forma yükle
  const isimTuruEl = document.getElementById("formIsimRenkTuru");
  if (isimTuruEl) isimTuruEl.value = veri.profil.isimRenkTuru || "";
  const isimR1El = document.getElementById("formIsimRenk1");
  if (isimR1El) isimR1El.value = veri.profil.isimRenk1 || "#c9a227";
  const isimR2El = document.getElementById("formIsimRenk2");
  if (isimR2El) isimR2El.value = veri.profil.isimRenk2 || "#c9a227";
  isimRenkAlanAcKapat();
  isimRenkUygula();

  const unvanTuruEl = document.getElementById("formUnvanRenkTuru");
  if (unvanTuruEl) unvanTuruEl.value = veri.profil.unvanRenkTuru || "";
  const unvanR1El = document.getElementById("formUnvanRenk1");
  if (unvanR1El) unvanR1El.value = veri.profil.unvanRenk1 || "#a1a1aa";
  const unvanR2El = document.getElementById("formUnvanRenk2");
  if (unvanR2El) unvanR2El.value = veri.profil.unvanRenk2 || "#a1a1aa";
  unvanRenkAlanAcKapat();
  unvanRenkUygula();

  renkCiftleriniCiz(ISIM_RENK_ANAHTARI, "isimRenkSonlar", "isimRenkSonSec");
  renkCiftleriniCiz(UNVAN_RENK_ANAHTARI, "unvanRenkSonlar", "unvanRenkSonSec");

  onizlemeElGuncelle("onizlemeArkaplan", veri.profil.arkaplanResim);

  canliKayitDinleyicileriEkle();
}

function onizlemeElGuncelle(elId, url) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (url) {
    el.style.backgroundImage = `url('${url}')`;
    el.classList.add("dolu");
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("dolu");
  }
}

// ---------- Görünüm formu: renk seçimi (native picker), önizleme, arka plan ----------
const HEX_DESENI = /^#[0-9a-fA-F]{6}$/;
const SON_RENK_ANAHTARI = "congress.son-renkler";
const VARSAYILAN_RENK = "#c9a227";

function sonRenkleriOku() {
  try {
    const liste = JSON.parse(localStorage.getItem(SON_RENK_ANAHTARI) || "[]");
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    return [];
  }
}

function sonRenkleriKaydet(renkler) {
  try {
    localStorage.setItem(SON_RENK_ANAHTARI, JSON.stringify(renkler));
  } catch (e) {
    /* depolama engellenmiş olabilir, yoksay */
  }
}

// Seçilen rengi "son kullanılanlar" listesinin başına ekler (en fazla 8).
function renkSonlarinaEkle(hex) {
  if (!HEX_DESENI.test(hex)) return;
  let renkler = sonRenkleriOku().filter((r) => r.toLowerCase() !== hex.toLowerCase());
  renkler.unshift(hex);
  renkler = renkler.slice(0, 8);
  sonRenkleriKaydet(renkler);
  renkSonlariniCiz();
}

// Son kullanılan renkleri panelin üst kısmında gösterir.
function renkSonlariniCiz() {
  const kutu = document.getElementById("renkSonlar");
  if (!kutu) return;
  const renkler = sonRenkleriOku();
  const secili = (document.getElementById("formAksanRenk").value || "").toLowerCase();
  kutu.innerHTML =
    `<span class="renk-son-baslik">Son kullanılanlar</span>` +
    (renkler.length
      ? renkler
          .map(
            (r) => `
          <button type="button" class="renk-son ${r.toLowerCase() === secili ? "secili" : ""}"
            style="background-color:${r}" title="${r}" onclick="renkSec('${r}')"></button>
        `
          )
          .join("")
      : `<span class="renk-son-bos">Henüz renk kaydedilmedi</span>`);
}

// Son kullanılanlar listesinden bir renk seçildiğinde / reset sonrası uygulanır.
function renkSec(hex) {
  if (!HEX_DESENI.test(hex)) hex = VARSAYILAN_RENK;
  document.getElementById("formAksanRenk").value = hex;
  const picker = document.getElementById("formAksanRenkOzel");
  if (picker) picker.value = hex;
  const goster = document.getElementById("renkHexGoster");
  if (goster) goster.innerText = hex;
  renkSonlarinaEkle(hex);
  canliKaydiTetikle();
}

// Native color picker: sürüklerken anında uygulanır (canlı önizleme).
function ozelRenkSecildi(deger) {
  const hex = deger.trim();
  if (!HEX_DESENI.test(hex)) return;
  document.getElementById("formAksanRenk").value = hex;
  const goster = document.getElementById("renkHexGoster");
  if (goster) goster.innerText = hex;
  renkSonlariniCiz();
  canliKaydiTetikle();
}

// Native color picker kapatılınca seçilen renk "son kullanılanlar"a kaydedilir.
function ozelRenkBitti(deger) {
  const hex = deger.trim();
  if (!HEX_DESENI.test(hex)) return;
  renkSonlarinaEkle(hex);
  canliKaydiTetikle();
}

function aksanRenkSifirla() {
  document.getElementById("formAksanRenk").value = "";
  const picker = document.getElementById("formAksanRenkOzel");
  if (picker) picker.value = VARSAYILAN_RENK;
  const goster = document.getElementById("renkHexGoster");
  if (goster) goster.innerText = VARSAYILAN_RENK;
  renkSonlariniCiz();
  canliKaydiTetikle();
}

// ---------- İsim / Ünvan yazısı rengi (sabit veya gradyan) ----------
const ISIM_RENK_ANAHTARI = "congress.isim-renkler";
const UNVAN_RENK_ANAHTARI = "congress.unvan-renkler";

function metinRengiUygula(el, tur, r1, r2) {
  if (!el) return;
  if (tur === "gradyan" && r1 && r2) {
    el.style.color = "transparent";
    el.style.backgroundImage = `linear-gradient(90deg, ${r1}, ${r2})`;
    el.style.webkitBackgroundClip = "text";
    el.style.backgroundClip = "text";
    el.style.webkitTextFillColor = "transparent";
    el.style.textShadow = "none";
  } else if (tur === "renk" && r1) {
    el.style.color = r1;
    el.style.backgroundImage = "none";
    el.style.webkitBackgroundClip = "initial";
    el.style.backgroundClip = "initial";
    el.style.webkitTextFillColor = "initial";
    el.style.textShadow = "";
  } else {
    el.style.color = "";
    el.style.backgroundImage = "";
    el.style.webkitBackgroundClip = "";
    el.style.backgroundClip = "";
    el.style.webkitTextFillColor = "";
    el.style.textShadow = "";
  }
}

function renkCiftleriOku(anahtar) {
  try {
    const l = JSON.parse(localStorage.getItem(anahtar) || "[]");
    return Array.isArray(l) ? l : [];
  } catch (e) {
    return [];
  }
}

function renkCiftleriniKaydet(anahtar, liste) {
  try {
    localStorage.setItem(anahtar, JSON.stringify(liste));
  } catch (e) {
    /* yoksay */
  }
}

function renkCiftiEkle(anahtar, r1, r2) {
  const cift = { r1: r1.toLowerCase(), r2: (r2 || "").toLowerCase() };
  let liste = renkCiftleriOku(anahtar).filter(
    (c) => !(c.r1 === cift.r1 && (c.r2 || "") === cift.r2)
  );
  liste.unshift(cift);
  liste = liste.slice(0, 8);
  renkCiftleriniKaydet(anahtar, liste);
}

// Kaydedilen renkleri gradyan yuvarlaklar olarak gösterir; tıklayınca iki rengi de uygular.
function renkCiftleriniCiz(anahtar, kutuId, tiklaFn) {
  const kutu = document.getElementById(kutuId);
  if (!kutu) return;
  const liste = renkCiftleriOku(anahtar);
  kutu.innerHTML =
    `<span class="renk-son-baslik">Son kullanılanlar</span>` +
    (liste.length
      ? liste
          .map(
            (c, i) => `
          <button type="button" class="renk-son renk-son-gradyan"
            style="background: linear-gradient(135deg, ${c.r1}, ${c.r2 || c.r1});"
            title="${c.r2 ? c.r1 + " → " + c.r2 : c.r1}"
            onclick="${tiklaFn}(${i})"></button>
        `
          )
          .join("")
      : `<span class="renk-son-bos">Henüz renk kaydedilmedi</span>`);
}

function isimRenkAlanAcKapat() {
  const tur = document.getElementById("formIsimRenkTuru").value;
  const alan = document.getElementById("formIsimRenkAlani");
  if (alan) alan.style.display = tur ? "block" : "none";
  const r2 = document.getElementById("formIsimRenk2");
  if (r2) r2.style.display = tur === "gradyan" ? "block" : "none";
}

function isimRenkUygula() {
  const tur = document.getElementById("formIsimRenkTuru").value;
  const r1 = document.getElementById("formIsimRenk1").value;
  const r2 = document.getElementById("formIsimRenk2").value;
  metinRengiUygula(document.getElementById("pIsim"), tur, r1, tur === "gradyan" ? r2 : "");
}

function isimRenkDegisti() {
  isimRenkUygula();
  canliKaydiTetikle();
}

function isimRenkSecimDegisti() {
  isimRenkAlanAcKapat();
  isimRenkDegisti();
}

function isimRenkBitti() {
  isimRenkDegisti();
  const tur = document.getElementById("formIsimRenkTuru").value;
  const r1 = document.getElementById("formIsimRenk1").value;
  const r2 = document.getElementById("formIsimRenk2").value;
  renkCiftiEkle(ISIM_RENK_ANAHTARI, r1, tur === "gradyan" ? r2 : "");
  renkCiftleriniCiz(ISIM_RENK_ANAHTARI, "isimRenkSonlar", "isimRenkSonSec");
}

function isimRenkSonSec(i) {
  const liste = renkCiftleriOku(ISIM_RENK_ANAHTARI);
  const c = liste[i];
  if (!c) return;
  document.getElementById("formIsimRenk1").value = c.r1;
  document.getElementById("formIsimRenk2").value = c.r2 || c.r1;
  document.getElementById("formIsimRenkTuru").value = c.r2 ? "gradyan" : "renk";
  isimRenkSecimDegisti();
}

function isimRenkSifirla() {
  document.getElementById("formIsimRenkTuru").value = "";
  document.getElementById("formIsimRenk1").value = "#c9a227";
  document.getElementById("formIsimRenk2").value = "#c9a227";
  isimRenkSecimDegisti();
}

function unvanRenkAlanAcKapat() {
  const tur = document.getElementById("formUnvanRenkTuru").value;
  const alan = document.getElementById("formUnvanRenkAlani");
  if (alan) alan.style.display = tur ? "block" : "none";
  const r2 = document.getElementById("formUnvanRenk2");
  if (r2) r2.style.display = tur === "gradyan" ? "block" : "none";
}

function unvanRenkUygula() {
  const tur = document.getElementById("formUnvanRenkTuru").value;
  const r1 = document.getElementById("formUnvanRenk1").value;
  const r2 = document.getElementById("formUnvanRenk2").value;
  metinRengiUygula(document.getElementById("pUnvan"), tur, r1, tur === "gradyan" ? r2 : "");
}

function unvanRenkDegisti() {
  unvanRenkUygula();
  canliKaydiTetikle();
}

function unvanRenkSecimDegisti() {
  unvanRenkAlanAcKapat();
  unvanRenkDegisti();
}

function unvanRenkBitti() {
  unvanRenkDegisti();
  const tur = document.getElementById("formUnvanRenkTuru").value;
  const r1 = document.getElementById("formUnvanRenk1").value;
  const r2 = document.getElementById("formUnvanRenk2").value;
  renkCiftiEkle(UNVAN_RENK_ANAHTARI, r1, tur === "gradyan" ? r2 : "");
  renkCiftleriniCiz(UNVAN_RENK_ANAHTARI, "unvanRenkSonlar", "unvanRenkSonSec");
}

function unvanRenkSonSec(i) {
  const liste = renkCiftleriOku(UNVAN_RENK_ANAHTARI);
  const c = liste[i];
  if (!c) return;
  document.getElementById("formUnvanRenk1").value = c.r1;
  document.getElementById("formUnvanRenk2").value = c.r2 || c.r1;
  document.getElementById("formUnvanRenkTuru").value = c.r2 ? "gradyan" : "renk";
  unvanRenkSecimDegisti();
}

function unvanRenkSifirla() {
  document.getElementById("formUnvanRenkTuru").value = "";
  document.getElementById("formUnvanRenk1").value = "#a1a1aa";
  document.getElementById("formUnvanRenk2").value = "#a1a1aa";
  unvanRenkSecimDegisti();
}

function arkaplanSecimDegisti() {
  const tur = document.getElementById("formArkaplanTuru").value;
  document.getElementById("formArkaplanRenkAlani").style.display =
    tur === "renk" ? "block" : "none";
  document.getElementById("formArkaplanResimAlani").style.display =
    tur === "resim" ? "block" : "none";
}

// İki gradyan renginden biri değiştiğinde canlı önizleme + kayıt tetiklenir.
function arkaplanRenkDegisti() {
  canliKaydiTetikle();
}

// Görsel bulanıklığı kaydırıcısı değiştiğinde hem değeri gösterir hem kaydeder.
function arkaplanBlurDegisti(deger) {
  const goster = document.getElementById("arkaplanBlurGoster");
  if (goster) goster.innerText = `${deger}px`;
  canliKaydiTetikle();
}

// Yorum tarihi: kısaca göreli ("3 gün önce"), üzerine gelince tam tarih+saat
function yorumTarihYaz(tarih) {
  if (!tarih) return "";
  const t = new Date(tarih);
  if (isNaN(t.getTime())) return "";
  const dk = Math.floor((Date.now() - t.getTime()) / 60000);
  let kisa;
  if (dk < 1) kisa = "şimdi";
  else if (dk < 60) kisa = `${dk} dk önce`;
  else if (dk < 1440) kisa = `${Math.floor(dk / 60)} saat önce`;
  else if (dk < 10080) kisa = `${Math.floor(dk / 1440)} gün önce`;
  else {
    kisa = t.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  }
  let tam;
  try {
    tam = t.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    tam = t.toLocaleString();
  }
  return `<span class="yorum-tarih" title="${htmlEsc(tam)}">${htmlEsc(kisa)}</span>`;
}

function yorumlariCiz(yorumlar, sayfalama = YORUM_SAYFALAMA) {
  const kutu = document.getElementById("yorumListesi");
  if (!kutu) return;
  if (yorumlar.length === 0) {
    kutu.innerHTML = '<span class="bos-hint">Henüz yorum yok.</span>';
    return;
  }
  const benimProfili = buProfiliDuzenleyebilir();
  kutu.innerHTML = yorumlar
    .map(
      (y) => `
      <div class="yorum">
        <a href="/profil?id=${encodeURIComponent(y.yazanId)}" class="yorum-avatar-link">
          <img src="${htmlEsc(y.yazanAvatar)}" class="yorum-avatar" alt="${htmlEsc(y.yazanAd)}" loading="lazy" />
        </a>
        <div class="yorum-ic">
          <div class="yorum-baslik-satir">
            <span class="yorum-sol">
              <a href="/profil?id=${encodeURIComponent(y.yazanId)}" class="yorum-yazar-link">
                <div class="yorum-yazar">${htmlEsc(y.yazanAd)}</div>
              </a>
              ${yorumTarihYaz(y.tarih)}
            </span>
            ${benimProfili && y.id ? `<button type="button" class="yorum-sil" title="Yorumu sil" onclick="yorumSil('${y.id}')">×</button>` : ""}
          </div>
          <div class="yorum-metin">${htmlEsc(y.metin)}</div>
        </div>
      </div>
    `
    )
    .join("") + yorumSayfalariHTML(sayfalama);
}

function yorumSayfalariHTML(sayfalama) {
  if (!sayfalama || sayfalama.toplamSayfa <= 1) return "";
  let html = '<nav class="yorum-sayfalama" aria-label="Yorum sayfaları">';
  for (let i = 1; i <= sayfalama.toplamSayfa; i++) {
    html += `<button type="button" class="yorum-sayfa ${i === sayfalama.sayfa ? "aktif" : ""}" onclick="yorumSayfasinaGit(${i})">${i}</button>`;
  }
  return html + "</nav>";
}

async function yorumSayfasinaGit(sayfa) {
  if (!GORUNTULENEN_ID) return;
  try {
    const res = await apiFetch(`/api/profile/${GORUNTULENEN_ID}?yorumSayfa=${sayfa}&yorumLimit=10`);
    if (!res.ok) throw new Error("Yorumlar yüklenemedi.");
    const veri = await res.json();
    YORUM_SAYFA = veri.profil.yorumSayfalama?.sayfa || sayfa;
    YORUM_SAYFALAMA = veri.profil.yorumSayfalama || YORUM_SAYFALAMA;
    yorumlariCiz(veri.profil.yorumlar || [], YORUM_SAYFALAMA);
  } catch (e) {
    alert(e.message || "Yorumlar yüklenemedi.");
  }
}

async function yorumSil(commentId) {
  if (!buProfiliDuzenleyebilir()) return;
  if (!confirm("Bu yorumu silmek istiyor musun?")) return;
  try {
    const res = await fetch(`/api/profile/${GORUNTULENEN_ID}/comments/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Yorum silinemedi.");
    await yorumSayfasinaGit(1);
  } catch (e) {
    alert(e.message || "Yorum silinemedi.");
  }
}

const YORUM_EMOJILER = ["😀","😁","😂","🤣","😊","😍","🥰","😎","🤩","🥳","😅","😆","🥹","😌","🤔","🙄","😴","🤗","😇","🥺","😮","🤫","🤭","😢","😭","😡","😱","🤯","👻","💀","🤖","😺","👍","👎","👏","🙏","🤝","💪","🔥","✨","🎉","❤️","💖","💯","🎬","🎮","🎵","🍕","☕","⚡","🌙","🌟"];

function yorumEmojiPanelDoldur() {
  const panel = document.getElementById("yorumEmojiPanel");
  if (!panel || panel.dataset.doldu) return;
  panel.dataset.doldu = "1";
  panel.innerHTML = YORUM_EMOJILER.map((e) => `<button type="button" class="yorum-emoji-oge" onclick="yorumEmojiEkle('${e}')">${e}</button>`).join("");
}

function yorumEmojiPanelAcKapat(event) {
  if (event) event.stopPropagation();
  yorumEmojiPanelDoldur();
  const panel = document.getElementById("yorumEmojiPanel");
  if (!panel) return;
  panel.style.display = panel.style.display === "block" ? "none" : "block";
}

function yorumEmojiEkle(e) {
  const ta = document.getElementById("yorumMetni");
  if (!ta) return;
  const bas = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
  const son = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
  ta.value = ta.value.slice(0, bas) + e + ta.value.slice(son);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = bas + e.length;
  yorumMetniBoyutlandir();
  const panel = document.getElementById("yorumEmojiPanel");
  if (panel) panel.style.display = "none";
}

// Emoji paneli dışına tıklanınca kapanır
document.addEventListener("click", (e) => {
  const panel = document.getElementById("yorumEmojiPanel");
  if (panel && !e.target.closest(".yorum-emoji-panel") && !e.target.closest(".yorum-emoji-btn")) {
    panel.style.display = "none";
  }
});

// Yorum yazı alanı içeriğe göre otomatik büyür (scroll çubuğu çıkmaz)
function yorumMetniBoyutlandir() {
  const ta = document.getElementById("yorumMetni");
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
}

// Enter ile yorumu gönder (Shift+Enter alt satıra geçirir)
function yorumMetniKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    yorumGonder();
  } else {
    yorumMetniBoyutlandir();
  }
}

async function yorumGonder() {
  const metin = document.getElementById("yorumMetni").value.trim();
  if (!metin) return;

  const res = await fetch(`/api/profile/${GORUNTULENEN_ID}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metin }),
  });

  if (!res.ok) {
    alert("Yorum gönderilemedi. Giriş yaptığından emin ol.");
    return;
  }

  document.getElementById("yorumMetni").value = "";
  await yorumSayfasinaGit(1);
}

// ---------- Düzenleme paneli (sol taraftan açılan modal) ----------
function duzenlemePaneliAcKapat() {
  const acik = document.body.classList.toggle("duzenleme-acik");
  const metin = document.getElementById("duzenlemeBtnMetin");
  if (metin) metin.innerText = acik ? "Düzenlemeyi Kapat" : "Profili Düzenle";
  const panel = document.getElementById("duzenlemePaneli");
  if (panel) panel.setAttribute("aria-hidden", acik ? "false" : "true");
}

// Kapak fotoğrafını canlı olarak (panel dışındaki gerçek kapak alanında) günceller
function kapakOnizlemeGuncelle() {
  const kapakEl = document.getElementById("pKapak");
  const url = document.getElementById("formKapakFoto").value;
  if (url) {
    kapakEl.style.backgroundImage = `url('${url}')`;
    kapakEl.classList.remove("kapak-bos");
  } else {
    kapakEl.style.backgroundImage = "";
    kapakEl.classList.add("kapak-bos");
  }
}

// Kullanıcının bilgisayarından seçtiği görseli sunucuya yükler ve
// sonucu ilgili gizli inputa + önizleme kutusuna yazar.
async function dosyaYukle(dosya, hedefInputId, onizlemeElId, ekstraGeriCagirma) {
  if (!dosya) return;

  const durum = document.getElementById("dpDurum");
  if (durum) durum.innerText = "Yükleniyor...";

  try {
    const dataUrl = await new Promise((cozul, reddet) => {
      const okuyucu = new FileReader();
      okuyucu.onload = () => cozul(okuyucu.result);
      okuyucu.onerror = () => reddet(new Error("Dosya okunamadı"));
      okuyucu.readAsDataURL(dosya);
    });

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const veri = await res.json();

    if (!res.ok) {
      if (durum) durum.innerText = "";
      alert(veri.hata || "Görsel yüklenemedi.");
      return;
    }

    document.getElementById(hedefInputId).value = veri.url;
    // Arka plan görseli yüklenince tür otomatik "resim" olsun ki kayıtta kaçmasın
    if (hedefInputId === "formArkaplanResim") {
      const turEl = document.getElementById("formArkaplanTuru");
      if (turEl) turEl.value = "resim";
    }
    if (onizlemeElId) onizlemeElGuncelle(onizlemeElId, veri.url);
    if (typeof ekstraGeriCagirma === "function") ekstraGeriCagirma();
    canliKaydiTetikle();
    if (durum) {
      durum.innerText = "Görsel yüklendi ✓";
      setTimeout(() => { if (durum.innerText === "Görsel yüklendi ✓") durum.innerText = ""; }, 2000);
    }
  } catch (e) {
    if (durum) durum.innerText = "";
    alert("Görsel yüklenirken bir hata oluştu.");
  }
}

// ---------- Canlı kaydetme (Kaydet tuşu gerekmez) ----------
// Form değerleri değiştikçe debounce ile sunucuya yazılır ve profil görünümü anında güncellenir.

let kayitZamanlayici = null;

function profilVerileriniTopla() {
  return {
    unvan: document.getElementById("formUnvan").value,
    bio: document.getElementById("formBio").value,
    vitrinler: GUNCEL_VITRINLER,
    favoriSarki: GUNCEL_FAVORI_SARKI,
    profilSarkiUrl: document.getElementById("formProfilSarkiUrl").value,
    kapakFoto: document.getElementById("formKapakFoto").value,
    aksanRenk: document.getElementById("formAksanRenk").value,
    arkaplanTuru: document.getElementById("formArkaplanTuru").value,
    arkaplanResim: document.getElementById("formArkaplanResim").value,
    arkaplanRenk1: document.getElementById("formArkaplanRenk1").value,
    arkaplanRenk2: document.getElementById("formArkaplanRenk2").value,
    arkaplanBlur: document.getElementById("formArkaplanBlur").value,
    isimRenkTuru: document.getElementById("formIsimRenkTuru").value,
    isimRenk1: document.getElementById("formIsimRenk1").value,
    isimRenk2: document.getElementById("formIsimRenk2").value,
    unvanRenkTuru: document.getElementById("formUnvanRenkTuru").value,
    unvanRenk1: document.getElementById("formUnvanRenk1").value,
    unvanRenk2: document.getElementById("formUnvanRenk2").value,
  };
}

// Formdaki mevcut değerleri doğrudan profil görünümüne yansıtır.
function profilCanliGuncelle(veri) {
  document.getElementById("pUnvan").innerText = veri.unvan || "Ünvan belirtilmemiş";
  document.getElementById("pBio").innerText =
    veri.bio || "Bu kişi henüz kendini tanıtmamış.";

  metinRengiUygula(
    document.getElementById("pIsim"),
    veri.isimRenkTuru,
    veri.isimRenk1,
    veri.isimRenk2
  );
  metinRengiUygula(
    document.getElementById("pUnvan"),
    veri.unvanRenkTuru,
    veri.unvanRenk1,
    veri.unvanRenk2
  );

  vitrinCiz(veri);

  const hayvanResim = veri.hayvanResmi || GUNCEL_HAYVAN_RESMI || "";
  const hayvanResimEl = document.getElementById("pHayvanResmi");
  if (hayvanResimEl) {
    hayvanResimEl.src = hayvanResim;
    hayvanResimEl.style.display = hayvanResim ? "block" : "none";
  }
  const hayvanBosHint = document.getElementById("hayvanBosHint");
  if (hayvanBosHint) hayvanBosHint.style.display = hayvanResim ? "none" : "block";
  hayvanSilBtnGuncelle();

  gorunumUygula(document.getElementById("profilAlani"), document.getElementById("pKapak"), {
    aksanRenk: veri.aksanRenk,
    arkaplanTuru: veri.arkaplanTuru,
    arkaplanResim: veri.arkaplanResim,
    arkaplanRenk1: veri.arkaplanRenk1,
    arkaplanRenk2: veri.arkaplanRenk2,
    arkaplanBlur: veri.arkaplanBlur,
    kapakFoto: veri.kapakFoto,
  });

  if (typeof kapakOnizlemeGuncelle === "function") kapakOnizlemeGuncelle();
}

// Form değişikliklerini debounce ile sunucuya kaydeder.
function profilOtomatikKaydet() {
  const veri = profilVerileriniTopla();
  // Admin başkasının profilini düzenliyorsa hedef profili gönder
  const hedef = kayitHedefi();
  if (hedef) veri.hedefId = hedef;
  profilCanliGuncelle(veri); // önce görünümü anında yansıt

  if (kayitZamanlayici) clearTimeout(kayitZamanlayici);
  kayitZamanlayici = setTimeout(async () => {
    const durum = document.getElementById("dpDurum");
    if (durum) durum.innerText = "Kaydediliyor...";
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(veri),
      });
      if (!res.ok) throw new Error("Kayıt başarısız");
      const kayitVeri = await res.json();
      // Profil şarkısı değiştiyse oynatıcıyı güncelle (aynı şarkıysa dokunma)
      const sarkiInput = document.getElementById("formProfilSarkiUrl");
      if (sarkiInput) profilSarkiYukle(sarkiInput.value);
      // İlk kez tamamlanan bölümler için XP kazanıldıysa göster
      if (kayitVeri && kayitVeri.kazanilanXp > 0 && BENIM_ID === GORUNTULENEN_ID) {
        GUNCEL_XP = (GUNCEL_XP || 0) + kayitVeri.kazanilanXp;
        seviyeGoster();
        if (durum) {
          durum.innerText = `+${kayitVeri.kazanilanXp} XP kazandın ✓`;
          setTimeout(() => { if (durum && durum.innerText.startsWith("+")) durum.innerText = ""; }, 2200);
        }
      } else if (durum) {
        durum.innerText = "Kaydedildi ✓";
        setTimeout(() => {
          if (durum.innerText === "Kaydedildi ✓") durum.innerText = "";
        }, 1800);
      }
    } catch (e) {
      if (durum) durum.innerText = "Kaydedilemedi";
    }
  }, 500);
}

// Yalnızca kendi profilin düzenlenirken kaydetme tetikler.
function canliKaydiTetikle() {
  if (!buProfiliDuzenleyebilir()) return;
  if (!document.getElementById("formUnvan")) return;
  profilOtomatikKaydet();
}

// Form elemanlarına canlı kayıt dinleyicileri bağlar.
function canliKayitDinleyicileriEkle() {
  if (!buProfiliDuzenleyebilir()) return;
  const dinlenecekler = [
    "formUnvan", "formBio",
    "formProfilSarkiUrl",
    "formKapakFoto", "formAksanRenkOzel",
  ];
  for (const id of dinlenecekler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", canliKaydiTetikle);
  }
  const arkaplan = document.getElementById("formArkaplanTuru");
  if (arkaplan) arkaplan.addEventListener("change", canliKaydiTetikle);
}

// ---------- Görsel seçim + kırpma (profil fotoğrafı, kapak ve arka plan) ----------
let cropHedef = null; // "profil", "arkaplan" veya "kapak"

// Seçilen dosyayı kırpma penceresinde açar. Profil için kare; kapak/arka plan için
// Discord tarzı: sabit banner çerçevesi + fotoğrafı sürükleyip yakınlaşarak seçim.
function cropAc(dosya, hedef) {
  const inputId = hedef === "profil" ? "dosyaProfilFoto" : hedef === "arkaplan" ? "dosyaArkaplan" : "dosyaKapak";
  const inputEl = document.getElementById(inputId);
  if (inputEl) inputEl.value = "";
  if (!dosya) return;
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(dosya.type)) {
    alert("Lütfen PNG, JPEG, GIF veya WEBP formatında bir görsel seç.");
    return;
  }
  const basliklar = {
    profil: "Profil Fotoğrafını Kırp",
    arkaplan: "Arka Plan Görselini Kırp",
    kapak: "Kapak Fotoğrafını Kırp",
  };
  const yardimlar = {
    profil: "",
    arkaplan: "Fotoğrafı sürükleyerek konumlandır, tekerlekle yakınlaş; alttaki önizlemede kartta nasıl görüneceğini gör.",
    kapak: "Fotoğrafı sürükleyerek konumlandır, tekerlekle yakınlaş; alttaki önizlemede banner'ın nasıl görüneceğini gör.",
  };
  const oranlar = {
    profil: 1,
    arkaplan: arkaplanCropOrani(),
    kapak: kapakCropOrani(),
  };

  const cropAlan = document.getElementById("cropAlan");
  const onizleme = document.getElementById("cropPreview");
  if (cropAlan) {
    if (hedef === "profil") {
      cropAlan.style.height = "";
    } else {
      const genislik = cropAlan.clientWidth || 560;
      const hedefYukseklik = Math.min(Math.max(genislik / oranlar[hedef], 160), 380);
      cropAlan.style.height = hedefYukseklik + "px";
    }
  }

  const okuyucu = new FileReader();
  okuyucu.onload = () => {
    const cropResim = document.getElementById("cropResim");
    cropResim.src = okuyucu.result;
    document.getElementById("cropDurum").innerText = "";
    const baslik = document.getElementById("cropBaslik");
    if (baslik) baslik.innerText = basliklar[hedef] || "Görseli Kırp";
    const yardim = document.getElementById("cropYardim");
    if (yardim) {
      yardim.style.display = hedef === "profil" ? "none" : "block";
      yardim.innerText = yardimlar[hedef] || "";
    }
    if (onizleme) onizleme.style.display = hedef === "profil" ? "none" : "block";
    document.getElementById("cropOverlay").style.display = "flex";
    if (typeof Cropper === "undefined") {
      alert("Kırpma aracı yüklenemedi (internet bağlantısı gerekli).");
      document.getElementById("cropOverlay").style.display = "none";
      return;
    }
    if (cropper) cropper.destroy();
    cropHedef = hedef;
    const oran = oranlar[hedef] || 1;
    cropper = new Cropper(cropResim, {
      aspectRatio: oran,
      // viewMode 1: kırpma kutusu görselin içinde kalır; görsel çerçeveyi kaplayacak
      // şekilde büyüyüp sürüklenebilir (Discord tarzı pan/yakınlaşma).
      viewMode: 1,
      autoCropArea: hedef === "profil" ? 1 : 0,
      dragMode: hedef === "profil" ? "crop" : "move",
      background: false,
      ready() {
        if (hedef === "profil") return;
        // Görseli önce tüm alanı kaplayacak kadar yakınlaştır, sonra kırpma
        // kutusunu banner şeklinde sabitle.
        const konteyner = this.getContainerData();
        const tuval = this.getCanvasData();
        const olcek = Math.max(konteyner.width / tuval.width, konteyner.height / tuval.height);
        this.zoomTo(tuval.scaleX * olcek);
        const kutuGenislik = konteyner.width;
        const kutuYukseklik = kutuGenislik / oran;
        this.setCropBoxData({
          left: 0,
          top: Math.max(0, (konteyner.height - kutuYukseklik) / 2),
          width: kutuGenislik,
          height: kutuYukseklik,
        });
        cropOnizlemeGuncelle();
      },
      cropend() {
        if (hedef !== "profil") cropOnizlemeGuncelle();
      },
    });
  };
  okuyucu.readAsDataURL(dosya);
}

// Kırpma seçiminin banner'daki sonucunu alttaki önizleme kutusunda gösterir.
function cropOnizlemeGuncelle() {
  const el = document.getElementById("cropPreview");
  if (!el || !cropper || cropHedef === "profil") return;
  try {
    const veri = cropper.getData();
    const oran = veri.width / veri.height;
    const genislik = 900;
    const yukseklik = Math.max(1, Math.round(genislik / oran));
    const kanvas = cropper.getCroppedCanvas({
      width: genislik,
      height: yukseklik,
      imageSmoothingQuality: "medium",
    });
    el.style.backgroundImage = `url(${kanvas.toDataURL("image/jpeg", 0.85)})`;
  } catch (e) {
    /* yoksay */
  }
}

// Arka plan görselinin profil kartında kaplayacağı görünür alanın en/boy oranı.
function arkaplanCropOrani() {
  const mainframeEl = document.getElementById("profilAlani");
  const kapakEl = document.getElementById("pKapak");
  if (!mainframeEl) return 1.5;
  const w = mainframeEl.clientWidth || 950;
  const kapakH = kapakEl ? kapakEl.offsetHeight : 190;
  const h = mainframeEl.clientHeight || 600;
  const gorselH = Math.max(h - kapakH, 80);
  const oran = w / gorselH;
  return oran >= 0.5 && oran <= 3 ? oran : 1.5;
}

// Kapak fotoğrafının görünür alanının en/boy oranı (geniş yatay şerit).
function kapakCropOrani() {
  const kapakEl = document.getElementById("pKapak");
  if (!kapakEl) return 5;
  const w = kapakEl.clientWidth || 950;
  const h = kapakEl.clientHeight || 190;
  const oran = w / h;
  return oran >= 2 && oran <= 8 ? oran : 5;
}

async function gifGorselYukle(dosya, hedef) {
  const durum = document.getElementById("dpDurum");
  if (durum) durum.innerText = "GIF yükleniyor...";
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const okuyucu = new FileReader();
      okuyucu.onload = () => resolve(okuyucu.result);
      okuyucu.onerror = () => reject(new Error("Dosya okunamadı."));
      okuyucu.readAsDataURL(dosya);
    });
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "GIF yüklenemedi.");

    if (hedef === "profil") {
      const kaydet = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: veri.url, ...(kayitHedefi() ? { hedefId: kayitHedefi() } : {}) }),
      });
      if (!kaydet.ok) throw new Error("GIF profil fotoğrafı kaydedilemedi.");
      if (GUNCEL_PROFIL_FOTO.startsWith("/uploads/")) {
        fetch("/api/delete-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: GUNCEL_PROFIL_FOTO }) }).catch(() => {});
      }
      GUNCEL_PROFIL_FOTO = veri.url;
      document.getElementById("pAvatar").src = veri.url;
      document.getElementById("profilFotoOnizleme").src = veri.url;
      document.getElementById("profilFotoSilBtn").style.display = "inline-block";
    } else {
      const eskiKapak = document.getElementById("formKapakFoto").value;
      document.getElementById("formKapakFoto").value = veri.url;
      kapakOnizlemeGuncelle();
      canliKaydiTetikle();
      if (eskiKapak && eskiKapak.startsWith("/uploads/")) {
        fetch("/api/delete-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: eskiKapak }) }).catch(() => {});
      }
    }
    if (durum) durum.innerText = "GIF kaydedildi ✓";
  } catch (e) {
    alert(e.message || "GIF yüklenemedi.");
    if (durum) durum.innerText = "";
  }
}

function profilFotoSecildi(dosya) {
  if (dosya && dosya.type === "image/gif") return gifGorselYukle(dosya, "profil");
  cropAc(dosya, "profil");
}

function arkaplanFotoSecildi(dosya) {
  cropAc(dosya, "arkaplan");
}

function kapakFotoSecildi(dosya) {
  if (dosya && dosya.type === "image/gif") return gifGorselYukle(dosya, "kapak");
  cropAc(dosya, "kapak");
}

function cropKapat() {
  document.getElementById("cropOverlay").style.display = "none";
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  cropHedef = null;
  const cropAlan = document.getElementById("cropAlan");
  if (cropAlan) cropAlan.style.height = "";
  const onizleme = document.getElementById("cropPreview");
  if (onizleme) {
    onizleme.style.backgroundImage = "";
    onizleme.style.display = "none";
  }
}

async function cropUygula() {
  if (!cropper) return;
  const durum = document.getElementById("cropDurum");
  const kaydetBtn = document.querySelector("#cropOverlay .form-kaydet");
  if (durum) durum.innerText = "Yükleniyor...";
  if (kaydetBtn) kaydetBtn.disabled = true;
  try {
    // Kapak/arka plan için kullanıcı henüz bir alan seçmediyse uyar
    if (cropHedef !== "profil") {
      const seckin = cropper.getData();
      const gorsel = cropper.getImageData();
      const kucukMu = seckin.width < gorsel.naturalWidth * 0.03 || seckin.height < gorsel.naturalHeight * 0.03;
      if (kucukMu) {
        if (kaydetBtn) kaydetBtn.disabled = false;
        if (durum) durum.innerText = "Önce görselin üzerinde sürükleyerek alan seç";
        return;
      }
    }

    let genislik = 400;
    let yukseklik = 400;
    if (cropHedef === "arkaplan" || cropHedef === "kapak") {
      const veri = cropper.getData();
      const oran = veri.width / veri.height;
      const hedefGenislik = Math.min(Math.round(veri.width), 1920);
      genislik = hedefGenislik;
      yukseklik = Math.max(1, Math.round(hedefGenislik / oran));
    }

    const kanvas = cropper.getCroppedCanvas({
      width: genislik,
      height: yukseklik,
      imageSmoothingQuality: "high",
    });
    const dataUrl = kanvas.toDataURL("image/jpeg", 0.9);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const uploadVeri = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadVeri.hata || "Görsel yüklenemedi.");

    if (cropHedef === "arkaplan") {
      document.getElementById("formArkaplanResim").value = uploadVeri.url;
      onizlemeElGuncelle("onizlemeArkaplan", uploadVeri.url);
      canliKaydiTetikle();
    } else if (cropHedef === "kapak") {
      document.getElementById("formKapakFoto").value = uploadVeri.url;
      kapakOnizlemeGuncelle();
      canliKaydiTetikle();
    } else {
      const url = uploadVeri.url;
      const kaydetRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url, ...(kayitHedefi() ? { hedefId: kayitHedefi() } : {}) }),
      });
      if (!kaydetRes.ok) throw new Error("Profil fotoğrafı kaydedilemedi.");

      // eski özel profil fotoğrafını sunucudan temizle
      if (GUNCEL_PROFIL_FOTO && GUNCEL_PROFIL_FOTO.startsWith("/uploads/")) {
        try {
          await fetch("/api/delete-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: GUNCEL_PROFIL_FOTO }),
          });
        } catch (e) {
          /* yoksay */
        }
      }

      GUNCEL_PROFIL_FOTO = url;
      document.getElementById("pAvatar").src = url;
      document.getElementById("profilFotoOnizleme").src = url;
      document.getElementById("profilFotoSilBtn").style.display = "inline-block";
    }

    cropKapat();
    if (durum) {
      durum.innerText = "Kaydedildi ✓";
      setTimeout(() => {
        if (durum.innerText === "Kaydedildi ✓") durum.innerText = "";
      }, 1800);
    }
  } catch (e) {
    if (durum) durum.innerText = e.message || "Kaydedilemedi";
  } finally {
    if (kaydetBtn) kaydetBtn.disabled = false;
  }
}

async function profilFotoSil() {
  if (!confirm("Profil fotoğrafını kaldırıp Discord fotoğrafına dönmek istiyor musun?")) return;
  try {
    if (GUNCEL_PROFIL_FOTO && GUNCEL_PROFIL_FOTO.startsWith("/uploads/")) {
      try {
        await fetch("/api/delete-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: GUNCEL_PROFIL_FOTO }),
        });
      } catch (e) {
        /* yoksay */
      }
    }
    const kaydetRes = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: "", ...(kayitHedefi() ? { hedefId: kayitHedefi() } : {}) }),
    });
    if (!kaydetRes.ok) throw new Error("Kaldırılamadı.");

    GUNCEL_PROFIL_FOTO = "";
    document.getElementById("pAvatar").src = DISCORD_AVATAR;
    document.getElementById("profilFotoOnizleme").src = DISCORD_AVATAR;
    document.getElementById("profilFotoSilBtn").style.display = "none";
  } catch (e) {
    alert(e.message || "Profil fotoğrafı kaldırılamadı.");
  }
}

// ---------- Sevimli bir dost: fotoğraf seçme + yükleme ----------
// "Kaldır" butonu yalnızca profil sahibi ve fotoğraf varsa görünür.
function hayvanSilBtnGuncelle() {
  const btn = document.getElementById("hayvanSilBtn");
  if (!btn) return;
  btn.style.display = buProfiliDuzenleyebilir() && GUNCEL_HAYVAN_RESMI ? "flex" : "none";
}

async function hayvanFotoSil() {
  if (!buProfiliDuzenleyebilir()) return;
  if (!GUNCEL_HAYVAN_RESMI) return;
  if (!confirm("Evcil dost fotoğrafını kaldırmak istiyor musun?")) return;
  const durumEl = document.getElementById("hayvanDurum");
  if (durumEl) durumEl.innerText = "Kaldırılıyor...";
  try {
    if (GUNCEL_HAYVAN_RESMI.startsWith("/uploads/")) {
      try {
        await fetch("/api/delete-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: GUNCEL_HAYVAN_RESMI }),
        });
      } catch (e) { /* yoksay */ }
    }
    const kaydetRes = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hayvanResmi: "", kediResmi: "", ...(kayitHedefi() ? { hedefId: kayitHedefi() } : {}) }),
    });
    if (!kaydetRes.ok) throw new Error("Kaldırılamadı.");

    GUNCEL_HAYVAN_RESMI = "";
    const imgEl = document.getElementById("pHayvanResmi");
    const bosHint = document.getElementById("hayvanBosHint");
    if (imgEl) {
      imgEl.src = "";
      imgEl.style.display = "none";
    }
    if (bosHint) bosHint.style.display = "block";
    hayvanSilBtnGuncelle();
    if (durumEl) {
      durumEl.innerText = "Kaldırıldı ✓";
      setTimeout(() => { if (durumEl.innerText === "Kaldırıldı ✓") durumEl.innerText = ""; }, 2000);
    }
  } catch (e) {
    if (durumEl) durumEl.innerText = "";
    alert(e.message || "Fotoğraf kaldırılamadı.");
  }
}

function hayvanFotoSec() {
  if (!buProfiliDuzenleyebilir()) return;
  const input = document.getElementById("dosyaHayvan");
  if (input) input.click();
}

async function hayvanFotoYukle(dosya) {
  const input = document.getElementById("dosyaHayvan");
  if (input) input.value = "";
  if (!dosya) return;
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(dosya.type)) {
    alert("Lütfen PNG, JPEG, GIF veya WEBP formatında bir görsel seç.");
    return;
  }
  const durumEl = document.getElementById("hayvanDurum");
  if (durumEl) durumEl.innerText = "Yükleniyor...";
  try {
    const dataUrl = await new Promise((cozul, reddet) => {
      const okuyucu = new FileReader();
      okuyucu.onload = () => cozul(okuyucu.result);
      okuyucu.onerror = () => reddet(new Error("Dosya okunamadı"));
      okuyucu.readAsDataURL(dosya);
    });
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const uploadVeri = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadVeri.hata || "Görsel yüklenemedi.");

    const url = uploadVeri.url;
    // eski hayvan fotoğrafı uploads dizinindeyse temizle
    if (GUNCEL_HAYVAN_RESMI && GUNCEL_HAYVAN_RESMI.startsWith("/uploads/")) {
      try {
        await fetch("/api/delete-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: GUNCEL_HAYVAN_RESMI }),
        });
      } catch (e) { /* yoksay */ }
    }
    const kaydetRes = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hayvanResmi: url, ...(kayitHedefi() ? { hedefId: kayitHedefi() } : {}) }),
    });
    if (!kaydetRes.ok) throw new Error("Kaydedilemedi.");

    GUNCEL_HAYVAN_RESMI = url;
    const imgEl = document.getElementById("pHayvanResmi");
    const bosHint = document.getElementById("hayvanBosHint");
    if (imgEl) {
      imgEl.src = url;
      imgEl.style.display = "block";
    }
    if (bosHint) bosHint.style.display = "none";
    hayvanSilBtnGuncelle();
    if (durumEl) {
      durumEl.innerText = "Eklendi ✓";
      setTimeout(() => { if (durumEl.innerText === "Eklendi ✓") durumEl.innerText = ""; }, 2000);
    }
  } catch (e) {
    if (durumEl) durumEl.innerText = "";
    alert(e.message || "Görsel yüklenirken bir hata oluştu.");
  }
}

function htmlEsc(deger) {
  return String(deger || "").replace(/[&<>'"]/g, (karakter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[karakter]));
}

// Yüklenemeyen afiş/görsel yerine film ikonu göster (boş/broken alan kalmasın)
function gorselHataYerineIcon(img) {
  try {
    const yer = document.createElement("span");
    yer.className = "film-poster-yok";
    yer.innerHTML = FILM_IKON;
    img.replaceWith(yer);
  } catch (e) {
    /* yoksay */
  }
}

function galeriListesiCiz(entries) {
  const kutu = document.getElementById("galleryContent");
  if (!kutu) return;
  GALLERY_ENTRIES = Array.isArray(entries) ? entries : [];

  const allowEdit = buProfiliDuzenleyebilir();
  const bosMesaji = allowEdit
    ? "Henüz bir başarı eklenmemiş. Yukarıdaki alanı kullanarak ilk görselini ekle."
    : "Bu üyenin galerisi henüz boş.";

  if (!entries || entries.length === 0) {
    kutu.innerHTML = `<div class="gallery-empty">${bosMesaji}</div>`;
    return;
  }

  kutu.innerHTML = entries
    .map(
      (entry) => `
        <div class="gallery-card">
          <div class="gallery-card-media" onclick="galeriLightboxAc('${htmlEsc(entry.id)}')">
            <img src="${htmlEsc(entry.imageUrl)}" alt="${htmlEsc(entry.description || "Galeri fotoğrafı")}" loading="lazy" />
            <span class="gallery-zoom-hint">Büyüt</span>
            ${allowEdit ? `<button type="button" class="gallery-card-delete" title="Sil" onclick="event.stopPropagation(); galeriSil('${htmlEsc(entry.id)}', '${htmlEsc(entry.imageUrl)}')">×</button>` : ""}
          </div>
          <div class="gallery-card-body">
            <p>${htmlEsc(entry.description || "Açıklama yok.")}</p>
            <span class="gallery-comment-count">${Array.isArray(entry.comments) ? entry.comments.length : 0} yorum</span>
          </div>
        </div>
      `
    )
    .join("");
}

function galeriLightboxAc(entryId) {
  const entry = GALLERY_ENTRIES.find((item) => item.id === entryId);
  if (!entry) return;
  AKTIF_GALERI_ENTRY = entry;
  document.getElementById("galleryLightboxImage").src = entry.imageUrl;
  document.getElementById("galleryLightboxImage").alt = entry.description || "Galeri görseli";
  document.getElementById("galleryLightboxTitle").innerText = "Galeri görseli";
  document.getElementById("galleryLightboxDescription").innerText = entry.description || "Açıklama yok.";
  galeriYorumlariniCiz(entry.comments || []);
  const form = document.getElementById("galleryCommentForm");
  const hint = document.getElementById("galleryCommentHint");
  if (form) form.style.display = BENIM_ID ? "flex" : "none";
  if (hint) hint.innerText = BENIM_ID ? "" : "Yorum yapmak için giriş yapmalısın.";
  document.getElementById("galleryLightbox").style.display = "flex";
  document.body.classList.add("lightbox-acik");
}

function galeriLightboxKapat(event) {
  if (event && event.target !== event.currentTarget) return;
  const lightbox = document.getElementById("galleryLightbox");
  if (lightbox) lightbox.style.display = "none";
  document.body.classList.remove("lightbox-acik");
  AKTIF_GALERI_ENTRY = null;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    galeriLightboxKapat();
    filmModalKapat();
  }
});

function galeriYorumlariniCiz(comments) {
  const kutu = document.getElementById("galleryComments");
  if (!kutu) return;
  if (!comments.length) {
    kutu.innerHTML = '<span class="gallery-comment-empty">Henüz yorum yok.</span>';
    return;
  }
  kutu.innerHTML = comments.map((comment) => `
    <div class="gallery-comment">
      <img src="${htmlEsc(comment.yazanAvatar)}" alt="" />
      <div><strong>${htmlEsc(comment.yazanAd)}</strong><p>${htmlEsc(comment.metin)}</p></div>
    </div>
  `).join("");
}

async function galeriYorumGonder() {
  if (!AKTIF_GALERI_ENTRY || !BENIM_ID) return;
  const input = document.getElementById("galleryCommentText");
  const metin = input ? input.value.trim() : "";
  if (!metin) return;
  try {
    const res = await fetch(`/api/profile/${GORUNTULENEN_ID}/gallery/${encodeURIComponent(AKTIF_GALERI_ENTRY.id)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metin }),
    });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "Yorum gönderilemedi.");
    AKTIF_GALERI_ENTRY.comments = veri.comments || [];
    galeriYorumlariniCiz(AKTIF_GALERI_ENTRY.comments);
    if (input) input.value = "";
    galeriListesiCiz(GALLERY_ENTRIES);
  } catch (e) {
    alert(e.message || "Yorum gönderilemedi.");
  }
}

// Galeride seçilen dosyanın küçük önizlemesini gösterir.
function galeriOnizlemeGuncelle() {
  const fileInput = document.getElementById("galleryFile");
  const preview = document.getElementById("galleryPreview");
  const file = fileInput && fileInput.files[0];
  if (file && preview) {
    preview.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
    preview.classList.add("dolu");
  } else if (preview) {
    preview.style.backgroundImage = "";
    preview.classList.remove("dolu");
  }
}

// Galeriden bir öğeyi (görseli ile birlikte) siler.
async function galeriSil(entryId, imageUrl) {
  if (!GORUNTULENEN_ID) return;
  if (!confirm("Bu görseli silmek istediğine emin misin?")) return;
  const statusEl = document.getElementById("galleryStatus");
  if (statusEl) statusEl.innerText = "Siliniyor...";
  try {
    const res = await fetch(`/api/profile/${GORUNTULENEN_ID}/gallery/${encodeURIComponent(entryId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Silinemedi.");
    if (statusEl) {
      statusEl.innerText = "Silindi ✓";
      setTimeout(() => { if (statusEl.innerText === "Silindi ✓") statusEl.innerText = ""; }, 2000);
    }
    await gallerySayfasiBaslat();
  } catch (e) {
    if (statusEl) statusEl.innerText = "";
    alert(e.message || "Silinemedi.");
  }
}

async function galeriEkle() {
  const fileInput = document.getElementById("galleryFile");
  const descriptionInput = document.getElementById("galleryDescription");
  const statusEl = document.getElementById("galleryStatus");
  const file = fileInput ? fileInput.files[0] : null;

  if (!file) {
    alert("Lütfen bir fotoğraf seç.");
    return;
  }

  if (!GORUNTULENEN_ID) {
    alert("Galeriyi açmak için profil seçimi yok.");
    return;
  }

  if (statusEl) statusEl.innerText = "Yükleniyor...";

  try {
    const dataUrl = await new Promise((cozul, reddet) => {
      const okuyucu = new FileReader();
      okuyucu.onload = () => cozul(okuyucu.result);
      okuyucu.onerror = () => reddet(new Error("Dosya okunamadı"));
      okuyucu.readAsDataURL(file);
    });

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const uploadVeri = await uploadRes.json();

    if (!uploadRes.ok) {
      throw new Error(uploadVeri.hata || "Görsel yüklenemedi.");
    }

    const saveRes = await fetch(`/api/profile/${GORUNTULENEN_ID}/gallery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: uploadVeri.url, description: descriptionInput ? descriptionInput.value : "" }),
    });
    const saveVeri = await saveRes.json();

    if (!saveRes.ok) {
      throw new Error(saveVeri.hata || "Galeriye eklenemedi.");
    }

    if (fileInput) fileInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    const preview = document.getElementById("galleryPreview");
    if (preview) {
      preview.style.backgroundImage = "";
      preview.classList.remove("dolu");
    }
    await gallerySayfasiBaslat();
    if (statusEl) statusEl.innerText = "Başarı eklendi ✓";
    setTimeout(() => {
      if (statusEl && statusEl.innerText === "Başarı eklendi ✓") statusEl.innerText = "";
    }, 2000);
  } catch (e) {
    if (statusEl) statusEl.innerText = "";
    alert(e.message || "Galeriye eklenemedi.");
  }
}

async function gallerySayfasiBaslat() {
  const ben = await navBarDoldur();
  BENIM_ID = ben && ben.girisYapti ? ben.id : null;
  BENIM_ADMIN = ben && ben.girisYapti && ben.admin === true;
  GORUNTULENEN_ID = urlIdOku() || BENIM_ID;

  const ownerEl = document.getElementById("galleryOwnerName");
  const formEl = document.getElementById("galleryForm");
  const formHintEl = document.getElementById("galleryFormHint");
  const statusEl = document.getElementById("galleryStatus");

  if (!GORUNTULENEN_ID) {
    document.getElementById("galleryContent").innerHTML =
      '<div class="gallery-empty">Galeriyi görmek için giriş yapmalısın.</div>';
    return;
  }

  const res = await fetch(`/api/profile/${GORUNTULENEN_ID}/gallery`);
  if (!res.ok) {
    document.getElementById("galleryContent").innerHTML =
      '<div class="gallery-empty">Bu galeriye erişilemedi.</div>';
    return;
  }
  const veri = await res.json();

  if (ownerEl) ownerEl.innerText = veri.uye.kullaniciAdi + " · Galeri";
  document.title = `${veri.uye.kullaniciAdi} · Galeri`;
  const backEl = document.getElementById("galleryBack");
  if (backEl) backEl.href = `/profil?id=${GORUNTULENEN_ID}`;
  const allowEdit = buProfiliDuzenleyebilir();
  if (formEl) formEl.style.display = allowEdit ? "flex" : "none";
  if (formHintEl) {
    formHintEl.innerText = allowEdit
      ? "Bir görsel seç, yanına açıklamasını yaz ve ekle."
      : "Bu galeriye sadece profil sahibi görsel ekleyebilir.";
  }
  if (statusEl) statusEl.innerText = "";

  // Galeri de üyenin şarkısıyla devam eder
  profilSarkiGoster(veri.profil.profilSarkiUrl || "", GORUNTULENEN_ID);

  galeriListesiCiz(veri.profil.galleryEntries || []);
}

// ---------- Üye listesi sayfası ----------
async function uyeListesiYukle() {
  const grid = document.getElementById("uyelerGrid");
  if (!grid) return;
  grid.innerHTML = '<span class="bos-hint uye-yukleniyor">Üyeler yükleniyor…</span>';
  try {
    const controller = new AbortController();
    const zamanlayici = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("/api/members", { signal: controller.signal });
    clearTimeout(zamanlayici);
    if (!res.ok) throw new Error("Üyeler alınamadı.");
    const uyeler = await res.json();

    if (uyeler.length === 0) {
      grid.innerHTML = '<span class="bos-hint">Henüz hiç kimse giriş yapmadı.</span>';
      return;
    }

    grid.innerHTML = uyeler.map((u) => `
      <a href="/profil?id=${encodeURIComponent(u.id)}" class="uye-kart">
        <img src="${htmlEsc(u.profilAvatar || u.avatar)}" alt="${htmlEsc(u.kullaniciAdi)}" loading="lazy"
          onerror="this.onerror=null;this.src='${htmlEsc(u.avatar)}';" />
        <div class="uye-ad">${htmlEsc(u.kullaniciAdi)}</div>
      </a>
    `).join("");
  } catch (e) {
    grid.innerHTML = '<span class="bos-hint uye-yukleniyor">Üyeler şu anda yüklenemedi. Tekrar dene.</span>';
  }
}

// ---------- Film & Dizi Günlüğü (Letterboxd tarzı) ----------
const FILM_DURUM_ETIKET = {
  izledim: "İzledim",
  izliyorum: "İzliyorum",
  "izlemek-istiyorum": "İzlemek istiyorum",
};
const KITAP_DURUM_ETIKET = {
  okudum: "Okudum",
  okuyorum: "Okuyorum",
  "okumak-istiyorum": "Okumak istiyorum",
};
const FILM_IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M7 4v16M17 4v16M2.5 9h19M2.5 15h19"/></svg>';
const KITAP_IKON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 4.5V21M20 19H6.5"/></svg>';
const YILDIZ_SVG = '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 2l2.9 6.26 6.6.8-4.9 4.6 1.3 6.54L12 17.3 6.1 20.2l1.3-6.54-4.9-4.6 6.6-.8z"/></svg>';

let FILM_JURNAL = [];
let FILM_ARAMA_SONUCU = [];
let FILM_SECILI = null;
let FILM_PUAN = null;
let KITAP_JURNAL = [];
let KITAP_ARAMA_SONUCU = [];
let GUNCEL_GUNLUK_SAYFA = 1;
let FILM_KESFET_SAYFA = 1;
let FILM_KESFET_ISTEK = 0;
let FILM_FILTRE = { tur: "tum", kategori: "", yil: "", minPuan: "0", sirala: "popularity.desc" };
const GUNLUK_SAYFA_LIMIT = 10;

// Google Books kapaklarını sunucu proxy'sinden geçir (TMDB afiş proxy'si gibi)
function kitapKapakUrl(url) {
  const deger = String(url || "");
  if (!deger) return "";
  if (deger.startsWith("/api/kitap/kapak?")) return deger;
  try {
    const parsed = new URL(deger, window.location.origin);
    if (/books\.google(usercontent)?\.com$/i.test(parsed.hostname)) {
      return `/api/kitap/kapak?url=${encodeURIComponent(parsed.toString())}`;
    }
  } catch (e) {
    return deger;
  }
  return deger;
}

// Profil sağ panelindeki küçük özet (kayıt sayısı + en fazla 3 afiş)
function filmProfilGoster(filmler, sayi, filmAdet, diziAdet) {
  const kutu = document.getElementById("pFilmler");
  if (!kutu) return;
  const link = document.getElementById("filmlerLink");
  if (link) link.href = `/gunluk?id=${GORUNTULENEN_ID}`;
  if (!filmler || !filmler.length) {
    kutu.innerHTML = '<span class="bos-hint">Henüz film/dizi eklenmemiş.</span>';
    return;
  }
  // Film/dizi sayıları sunucudan (tam listeden) gelir; gelmezse eldeki listeden hesapla
  const filmSayisi = typeof filmAdet === "number" ? filmAdet : filmler.filter((f) => f.tur === "film").length;
  const diziSayisi = typeof diziAdet === "number" ? diziAdet : filmler.filter((f) => f.tur === "dizi").length;
  // Favori film önizlemede ilk sırada görünsün
  const favori = filmler.find((f) => f.favori);
  let gosterilecek = filmler.slice(0, 3);
  if (favori && !gosterilecek.some((f) => f.id === favori.id && f.tur === favori.tur)) {
    gosterilecek = [favori, ...gosterilecek].slice(0, 3);
  }
  kutu.innerHTML = `
    <div class="film-profil-ozet">${sayi} kayıt · ${filmSayisi} film · ${diziSayisi} dizi</div>
    <div class="film-profil-afisler">
      ${gosterilecek.map((f) =>
        f.poster
          ? `<img src="${htmlEsc(filmPosterUrl(f.poster))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
          : `<span class="film-profil-afis-yok">${FILM_IKON}</span>`
      ).join("")}
    </div>`;
}

// Profil sağ panelindeki kitap özeti (kayıt sayısı + en fazla 3 kapak)
function kitapProfilGoster(kitaplar, sayi) {
  const kutu = document.getElementById("pKitaplar");
  if (!kutu) return;
  const link = document.getElementById("kitaplarLink");
  if (link) link.href = `/gunluk?id=${GORUNTULENEN_ID}&mod=kitap`;
  if (!kitaplar || !kitaplar.length) {
    kutu.innerHTML = '<span class="bos-hint">Henüz kitap eklenmemiş.</span>';
    return;
  }
  const favori = kitaplar.find((k) => k.favori);
  let gosterilecek = kitaplar.slice(0, 3);
  if (favori && !gosterilecek.some((k) => k.id === favori.id)) {
    gosterilecek = [favori, ...gosterilecek].slice(0, 3);
  }
  kutu.innerHTML = `
    <div class="film-profil-ozet">${sayi} kayıt · ${sayi} kitap</div>
    <div class="film-profil-afisler">
      ${gosterilecek.map((k) =>
        k.kapak
          ? `<img src="${htmlEsc(kitapKapakUrl(k.kapak))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
          : `<span class="film-profil-afis-yok">${KITAP_IKON}</span>`
      ).join("")}
    </div>`;
}

// ---- Yıldızlı puan (0.5 adımlı, imleçle yarım yıldız seçilebilir) ----
function yildizGuncelle(deger) {
  const dolgu = document.getElementById("yildizDolgu");
  const degerEl = document.getElementById("filmPuanDeger");
  const v = deger == null ? FILM_PUAN : deger;
  if (dolgu) dolgu.style.width = v ? (v / 5) * 100 + "%" : "0%";
  if (degerEl) degerEl.innerText = v ? String(v).replace(".", ",") : "—";
}

(function yildizDinleyicileri() {
  const kutu = document.getElementById("yildizKutu");
  if (!kutu) return;
  kutu.addEventListener("pointermove", (e) => {
    const r = kutu.getBoundingClientRect();
    const oran = (e.clientX - r.left) / r.width;
    yildizGuncelle(Math.max(0.5, Math.min(5, Math.round(oran * 10) / 2)));
  });
  kutu.addEventListener("pointerleave", () => yildizGuncelle(null));
  kutu.addEventListener("click", (e) => {
    const r = kutu.getBoundingClientRect();
    const oran = (e.clientX - r.left) / r.width;
    FILM_PUAN = Math.max(0.5, Math.min(5, Math.round(oran * 10) / 2));
    yildizGuncelle(null);
  });
})();

// Günlükteki kartlarda statik yıldız gösterimi
function puanYildizlariHTML(puan) {
  if (!puan) return '<span class="film-puan-yok">Puansız</span>';
  return `<span class="jp-yildizlar"><span class="jp-taban">${YILDIZ_SVG.repeat(5)}</span><span class="jp-dolgu" style="width:${(puan / 5) * 100}%">${YILDIZ_SVG.repeat(5)}</span></span>`;
}

function gunlukKartHTML(f, kendi) {
  return `
    <div class="film-jurnal-kart gunluk-kart">
      ${f.poster
        ? `<img src="${htmlEsc(filmPosterUrl(f.poster))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
        : `<span class="film-poster-yok film-poster-yok-buyuk">${FILM_IKON}</span>`}
      <div class="film-jurnal-ic">
        <div class="film-jurnal-ad">
          <strong>${htmlEsc(f.ad)}</strong>
          <span class="film-jurnal-tur">${f.tur === "film" ? "Film" : "Dizi"}${f.yil ? ` · ${htmlEsc(f.yil)}` : ""}</span>
        </div>
        <div class="film-jurnal-alt">
          ${puanYildizlariHTML(f.puan)}
          <span class="film-jurnal-durum">${FILM_DURUM_ETIKET[f.durum] || ""}</span>
        </div>
        ${f.yorum ? `<p class="film-jurnal-yorum">${htmlEsc(f.yorum)}</p>` : ""}
      </div>
      ${kendi ? `
        <div class="film-jurnal-butonlar">
          ${f.favori
            ? `<button type="button" class="favori-isaret" title="Favoriden çıkar" onclick="gunlukFavoriYap('${htmlEsc(f.entryId)}')">★ ${f.tur === "film" ? "Favori Film" : "Favori Dizi"}</button>`
            : `<button type="button" class="film-jurnal-favori" title="Favori yap" onclick="gunlukFavoriYap('${htmlEsc(f.entryId)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2l2.9 6.26 6.6.8-4.9 4.6 1.3 6.54L12 17.3 6.1 20.2l1.3-6.54-4.9-4.6 6.6-.8z"/></svg>
              </button>`}
          <button type="button" class="film-jurnal-sil" title="Sil" onclick="gunlukSil('${htmlEsc(f.entryId)}')">×</button>
        </div>` : ""}
    </div>`;
}

// ---------- Film & Dizi Günlüğü sayfası (profil başlığı + favori + liste) ----------
async function gunlukSayfasiBaslat() {
  const ben = await navBarDoldur();
  BENIM_ID = ben && ben.girisYapti ? ben.id : null;
  BENIM_ADMIN = ben && ben.girisYapti && ben.admin === true;
  GORUNTULENEN_ID = urlIdOku() || BENIM_ID;

  if (!GORUNTULENEN_ID) {
    document.getElementById("yukleniyorAlani").innerHTML = `
      <div class="giris-uyari">
        <svg class="seal" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#c9a227" stroke-width="1.6"/>
          <circle cx="24" cy="24" r="17" stroke="#c9a227" stroke-width="1" opacity="0.6"/>
          <path d="M24 12 L27 20 L35 20 L28.5 25 L31 33 L24 28 L17 33 L19.5 25 L13 20 L21 20 Z" fill="#c9a227"/>
        </svg>
        <h2>Giriş Gerekli</h2>
        <p>Günlükleri görüntülemek için Discord ile giriş yapmalısın.</p>
        <a href="/auth/login" class="discord-giris-btn buyuk">Discord ile Giriş Yap</a>
      </div>`;
    return;
  }

  let res = null;
  try {
    res = await apiFetch(`/api/profile/${GORUNTULENEN_ID}`);
  } catch (e) {
    res = null;
  }
  if (!res || !res.ok) {
    document.getElementById("yukleniyorAlani").innerHTML = `
      <div class="giris-uyari">
        <svg class="seal" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#8b2222" stroke-width="1.6"/>
          <circle cx="24" cy="24" r="17" stroke="#8b2222" stroke-width="1" opacity="0.6"/>
          <path d="M24 12 L27 20 L35 20 L28.5 25 L31 33 L24 28 L17 33 L19.5 25 L13 20 L21 20 Z" fill="#8b2222"/>
        </svg>
        <h2>Üye Bulunamadı</h2>
        <p>Bu üye sunucuda değil ya da artık sunucuda bulunmuyor.</p>
        <a href="/uyeler" class="discord-giris-btn buyuk">Üye Listesine Git</a>
      </div>`;
    return;
  }
  const veri = await res.json();

  document.getElementById("yukleniyorAlani").style.display = "none";
  document.getElementById("profilAlani").style.display = "block";

  // Profil başlığı (banner, avatar, isim, seviye, ünvan)
  const profilFoto = veri.profil.avatar || veri.avatar || "";
  document.getElementById("pAvatar").src = profilFoto;
  document.getElementById("pIsim").innerText = veri.kullaniciAdi;
  document.title = `${veri.kullaniciAdi} · Film & Dizi`;
  document.getElementById("pUnvan").innerText = veri.profil.unvan || "Ünvan belirtilmemiş";
  GUNCEL_XP = veri.profil.xp || 0;
  GUNCEL_XP_YAZI = veri.profil.xpYazi || "";
  seviyeGoster();
  // Üyenin şarkısı bu sayfada da çalsın (müzik devam eder)
  profilSarkiGoster(veri.profil.profilSarkiUrl || "", GORUNTULENEN_ID);
  metinRengiUygula(
    document.getElementById("pIsim"),
    veri.profil.isimRenkTuru,
    veri.profil.isimRenk1,
    veri.profil.isimRenk2
  );
  metinRengiUygula(
    document.getElementById("pUnvan"),
    veri.profil.unvanRenkTuru,
    veri.profil.unvanRenk1,
    veri.profil.unvanRenk2
  );
  gorunumUygula(
    document.getElementById("profilAlani"),
    document.getElementById("pKapak"),
    veri.profil
  );

  const backEl = document.getElementById("gunlukBack");
  if (backEl) backEl.href = `/profil?id=${GORUNTULENEN_ID}`;

  // Günlük verileri (film/dizi + kitap)
  try {
    const filmRes = await apiFetch(`/api/profile/${GORUNTULENEN_ID}/filmler`);
    const filmVeri = filmRes.ok ? await filmRes.json() : { filmler: [] };
    FILM_JURNAL = filmVeri.filmler || [];
  } catch (e) {
    FILM_JURNAL = [];
  }
  try {
    const kitapRes = await apiFetch(`/api/profile/${GORUNTULENEN_ID}/kitaplar`);
    const kitapVeri = kitapRes.ok ? await kitapRes.json() : { kitaplar: [] };
    KITAP_JURNAL = kitapVeri.kitaplar || [];
  } catch (e) {
    KITAP_JURNAL = [];
  }
  // ?mod=kitap ile açıldıysa Kitap sekmesiyle başla
  const mod = new URLSearchParams(window.location.search).get("mod");
  if (mod === "kitap") {
    gunlukSekmesi("kitap");
  } else {
    gunlukCiz();
  }
}

function gunlukCiz() {
  gunlukFavoriCiz();
  gunlukListeCiz();
}

function gunlukFavoriCiz() {
  const alan = document.getElementById("favoriFilmAlani");
  if (!alan) return;
  const favori = FILM_JURNAL.find((f) => f.favori);
  const kendi = BENIM_ID === GORUNTULENEN_ID;
  if (!favori) {
    alan.innerHTML = kendi
      ? `<div class="favori-bos"><span>Henüz favori film seçmedin.</span><span class="favori-ipucu">Aşağıdaki listeden bir kayda "Favori Yap" diyerek seçebilirsin.</span></div>`
      : `<div class="favori-bos"><span>Henüz favori film seçilmemiş.</span></div>`;
    return;
  }
  alan.innerHTML = `
    <div class="favori-film-kart">
      ${favori.poster
        ? `<img src="${htmlEsc(filmPosterUrl(favori.poster))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
        : `<div class="favori-poster-yok">${FILM_IKON}</div>`}
      <div class="favori-film-bilgi">
        <div class="favori-film-etiket">${favori.tur === "film" ? "Favori Film" : "Favori Dizi"}</div>
        <h3>${htmlEsc(favori.ad)}</h3>
        <div class="favori-film-meta">${favori.tur === "film" ? "Film" : "Dizi"}${favori.yil ? ` · ${htmlEsc(favori.yil)}` : ""}</div>
        <div class="film-jurnal-alt">
          ${puanYildizlariHTML(favori.puan)}
          <span class="film-jurnal-durum">${FILM_DURUM_ETIKET[favori.durum] || ""}</span>
        </div>
        ${favori.yorum ? `<p class="film-jurnal-yorum">${htmlEsc(favori.yorum)}</p>` : ""}
      </div>
    </div>`;
}

function gunlukListeCiz() {
  const liste = document.getElementById("gunlukListe");
  if (!liste) return;
  const kendi = BENIM_ID === GORUNTULENEN_ID;
  const input = document.getElementById("gunlukArama");
  const q = (input ? input.value : "").trim().toLowerCase();

  // Arama yapılıyorsa sadece "İzledim" dediği kayıtlarda isim aranır
  let gosterilecekler = FILM_JURNAL;
  if (q) {
    gosterilecekler = FILM_JURNAL.filter(
      (f) => f.durum === "izledim" && (f.ad || "").toLowerCase().includes(q)
    );
  }

  if (!gosterilecekler.length) {
    liste.innerHTML = q
      ? '<span class="bos-hint">İzlediği kayıtlarda sonuç bulunamadı.</span>'
      : kendi
        ? '<span class="bos-hint">Henüz hiçbir film/dizi eklememişsin. Üst menüdeki "FİLM & DİZİ" sayfasından arayıp ekleyebilirsin.</span>'
        : '<span class="bos-hint">Bu üyenin henüz film/dizi kaydı yok.</span>';
    return;
  }

  const toplamSayfa = Math.max(1, Math.ceil(gosterilecekler.length / GUNLUK_SAYFA_LIMIT));
  if (GUNCEL_GUNLUK_SAYFA > toplamSayfa) GUNCEL_GUNLUK_SAYFA = toplamSayfa;
  const baslangic = (GUNCEL_GUNLUK_SAYFA - 1) * GUNLUK_SAYFA_LIMIT;
  const sayfaKayitlari = gosterilecekler.slice(baslangic, baslangic + GUNLUK_SAYFA_LIMIT);

  const kartlar = sayfaKayitlari.map((f) => gunlukKartHTML(f, kendi)).join("");
  const ustBilgi = `<div class="gunluk-kayit-sayisi">${gosterilecekler.length} kayıt</div>`;
  liste.innerHTML = ustBilgi + kartlar + gunlukSayfalamaHTML(GUNCEL_GUNLUK_SAYFA, toplamSayfa);
}

function gunlukSayfalamaHTML(sayfa, toplamSayfa, gitFn) {
  if (toplamSayfa <= 1) return "";
  const git = gitFn || "gunlukSayfayaGit";
  let html = '<nav class="gunluk-sayfalama" aria-label="Günlük sayfaları">';
  for (let i = 1; i <= toplamSayfa; i++) {
    html += `<button type="button" class="yorum-sayfa ${i === sayfa ? "aktif" : ""}" onclick="${git}(${i})">${i}</button>`;
  }
  return html + "</nav>";
}

function gunlukSayfayaGit(sayfa) {
  GUNCEL_GUNLUK_SAYFA = Math.max(1, sayfa);
  gunlukListeCiz();
  const liste = document.getElementById("gunlukListe");
  if (liste) liste.scrollIntoView({ behavior: "smooth", block: "start" });
}

function gunlukAramaDegisti() {
  GUNCEL_GUNLUK_SAYFA = 1;
  gunlukListeCiz();
}

async function gunlukFavoriYap(entryId) {
  try {
    const res = await fetch("/api/filmler/favori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "Favori ayarlanamadı.");
    FILM_JURNAL = veri.filmler || FILM_JURNAL;
    gunlukCiz();
  } catch (e) {
    alert(e.message || "Favori ayarlanamadı.");
  }
}

async function gunlukSil(entryId) {
  if (!confirm("Bu kaydı günlüğünden silmek istediğine emin misin?")) return;
  try {
    const res = await fetch(`/api/filmler/${encodeURIComponent(entryId)}`, { method: "DELETE" });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "Silinemedi.");
    FILM_JURNAL = veri.filmler || [];
    gunlukCiz();
  } catch (e) {
    alert(e.message || "Silinemedi.");
  }
}

// ---------- Kitap Günlüğü (günlük sayfasındaki "Kitap" sekmesi) ----------
function kitapGunlukCiz() {
  kitapGunlukFavoriCiz();
  kitapGunlukListeCiz();
}

function kitapGunlukFavoriCiz() {
  const alan = document.getElementById("favoriKitapAlani");
  if (!alan) return;
  const favori = KITAP_JURNAL.find((k) => k.favori);
  const kendi = BENIM_ID === GORUNTULENEN_ID;
  if (!favori) {
    alan.innerHTML = kendi
      ? `<div class="favori-bos"><span>Henüz favori kitap seçmedin.</span><span class="favori-ipucu">Aşağıdaki listeden bir kayda "Favori Yap" diyerek seçebilirsin.</span></div>`
      : `<div class="favori-bos"><span>Henüz favori kitap seçilmemiş.</span></div>`;
    return;
  }
  alan.innerHTML = `
    <div class="favori-film-kart">
      ${favori.kapak
        ? `<img src="${htmlEsc(kitapKapakUrl(favori.kapak))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
        : `<div class="favori-poster-yok">${KITAP_IKON}</div>`}
      <div class="favori-film-bilgi">
        <div class="favori-film-etiket">Favori Kitap</div>
        <h3>${htmlEsc(favori.ad)}</h3>
        <div class="favori-film-meta">Kitap${favori.yazar ? ` · ${htmlEsc(favori.yazar)}` : ""}${favori.yil ? ` · ${htmlEsc(favori.yil)}` : ""}</div>
        <div class="film-jurnal-alt">
          ${puanYildizlariHTML(favori.puan)}
          <span class="film-jurnal-durum">${KITAP_DURUM_ETIKET[favori.durum] || ""}</span>
        </div>
        ${favori.yorum ? `<p class="film-jurnal-yorum">${htmlEsc(favori.yorum)}</p>` : ""}
      </div>
    </div>`;
}

function kitapGunlukKartHTML(k, kendi) {
  return `
    <div class="film-jurnal-kart gunluk-kart">
      ${k.kapak
        ? `<img src="${htmlEsc(kitapKapakUrl(k.kapak))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
        : `<span class="film-poster-yok film-poster-yok-buyuk">${KITAP_IKON}</span>`}
      <div class="film-jurnal-ic">
        <div class="film-jurnal-ad">
          <strong>${htmlEsc(k.ad)}</strong>
          <span class="film-jurnal-tur">Kitap${k.yazar ? ` · ${htmlEsc(k.yazar)}` : ""}${k.yil ? ` · ${htmlEsc(k.yil)}` : ""}</span>
        </div>
        <div class="film-jurnal-alt">
          ${puanYildizlariHTML(k.puan)}
          <span class="film-jurnal-durum">${KITAP_DURUM_ETIKET[k.durum] || ""}</span>
        </div>
        ${k.yorum ? `<p class="film-jurnal-yorum">${htmlEsc(k.yorum)}</p>` : ""}
      </div>
      ${kendi ? `
        <div class="film-jurnal-butonlar">
          ${k.favori
            ? `<button type="button" class="favori-isaret" title="Favoriden çıkar" onclick="gunlukKitapFavoriYap('${htmlEsc(k.entryId)}')">★ Favori Kitap</button>`
            : `<button type="button" class="film-jurnal-favori" title="Favori yap" onclick="gunlukKitapFavoriYap('${htmlEsc(k.entryId)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2l2.9 6.26 6.6.8-4.9 4.6 1.3 6.54L12 17.3 6.1 20.2l1.3-6.54-4.9-4.6 6.6-.8z"/></svg>
              </button>`}
          <button type="button" class="film-jurnal-sil" title="Sil" onclick="gunlukKitapSil('${htmlEsc(k.entryId)}')">×</button>
        </div>` : ""}
    </div>`;
}

function kitapGunlukListeCiz() {
  const liste = document.getElementById("kitapGunlukListe");
  if (!liste) return;
  const kendi = BENIM_ID === GORUNTULENEN_ID;
  const input = document.getElementById("kitapGunlukArama");
  const q = (input ? input.value : "").trim().toLowerCase();

  let gosterilecekler = KITAP_JURNAL;
  if (q) {
    gosterilecekler = KITAP_JURNAL.filter(
      (k) => k.durum === "okudum" && (k.ad || "").toLowerCase().includes(q)
    );
  }

  if (!gosterilecekler.length) {
    liste.innerHTML = q
      ? '<span class="bos-hint">Okuduğu kayıtlarda sonuç bulunamadı.</span>'
      : kendi
        ? '<span class="bos-hint">Henüz hiçbir kitap eklememişsin. Üst menüdeki "FİLM & DİZİ" sayfasından arayıp ekleyebilirsin.</span>'
        : '<span class="bos-hint">Bu üyenin henüz kitap kaydı yok.</span>';
    return;
  }

  const toplamSayfa = Math.max(1, Math.ceil(gosterilecekler.length / GUNLUK_SAYFA_LIMIT));
  if (GUNCEL_GUNLUK_SAYFA > toplamSayfa) GUNCEL_GUNLUK_SAYFA = toplamSayfa;
  const baslangic = (GUNCEL_GUNLUK_SAYFA - 1) * GUNLUK_SAYFA_LIMIT;
  const sayfaKayitlari = gosterilecekler.slice(baslangic, baslangic + GUNLUK_SAYFA_LIMIT);

  const kartlar = sayfaKayitlari.map((k) => kitapGunlukKartHTML(k, kendi)).join("");
  const ustBilgi = `<div class="gunluk-kayit-sayisi">${gosterilecekler.length} kayıt</div>`;
  liste.innerHTML = ustBilgi + kartlar + gunlukSayfalamaHTML(GUNCEL_GUNLUK_SAYFA, toplamSayfa, "kitapGunlukSayfayaGit");
}

function kitapGunlukSayfayaGit(sayfa) {
  GUNCEL_GUNLUK_SAYFA = Math.max(1, sayfa);
  kitapGunlukListeCiz();
  const liste = document.getElementById("kitapGunlukListe");
  if (liste) liste.scrollIntoView({ behavior: "smooth", block: "start" });
}

function kitapGunlukAramaDegisti() {
  GUNCEL_GUNLUK_SAYFA = 1;
  kitapGunlukListeCiz();
}

async function gunlukKitapFavoriYap(entryId) {
  try {
    const res = await fetch("/api/kitaplar/favori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "Favori ayarlanamadı.");
    KITAP_JURNAL = veri.kitaplar || KITAP_JURNAL;
    kitapGunlukCiz();
  } catch (e) {
    alert(e.message || "Favori ayarlanamadı.");
  }
}

async function gunlukKitapSil(entryId) {
  if (!confirm("Bu kaydı günlüğünden silmek istediğine emin misin?")) return;
  try {
    const res = await fetch(`/api/kitaplar/${encodeURIComponent(entryId)}`, { method: "DELETE" });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "Silinemedi.");
    KITAP_JURNAL = veri.kitaplar || [];
    kitapGunlukCiz();
  } catch (e) {
    alert(e.message || "Silinemedi.");
  }
}

// Günlük sayfasındaki Film/Dizi - Kitap sekmesi
function gunlukSekmesi(mod) {
  const kitap = mod === "kitap";
  GUNCEL_GUNLUK_SAYFA = 1;
  const sekmeFilm = document.getElementById("gunlukSekmeFilm");
  const sekmeKitap = document.getElementById("gunlukSekmeKitap");
  const icerikFilm = document.getElementById("gunlukFilmIcerik");
  const icerikKitap = document.getElementById("gunlukKitapIcerik");
  if (sekmeFilm) sekmeFilm.classList.toggle("aktif", !kitap);
  if (sekmeKitap) sekmeKitap.classList.toggle("aktif", kitap);
  if (icerikFilm) icerikFilm.style.display = kitap ? "none" : "";
  if (icerikKitap) icerikKitap.style.display = kitap ? "" : "none";
  if (kitap) {
    document.title = (document.getElementById("pIsim") ? document.getElementById("pIsim").innerText : "") + " · Kitap";
    kitapGunlukCiz();
  } else {
    document.title = (document.getElementById("pIsim") ? document.getElementById("pIsim").innerText : "") + " · Film & Dizi";
    gunlukCiz();
  }
}

function filmModalAc(oge) {
  if (!BENIM_ID) {
    window.location.href = "/auth/login";
    return;
  }
  const kitapModu = oge.tur === "kitap";
  FILM_SECILI = oge;
  document.getElementById("filmModalAd").innerText = oge.ad;
  document.getElementById("filmModalTur").innerText = kitapModu ? "Kitap" : (oge.tur === "film" ? "Film" : "Dizi");
  document.getElementById("filmModalYil").innerText = kitapModu
    ? [oge.yazar, oge.yil].filter(Boolean).join(" · ")
    : (oge.yil || "");
  const tarihEl = document.getElementById("filmModalTarih");
  const puanEl = document.getElementById("filmModalPuan");
  const ozetEl = document.getElementById("filmModalOzet");
  if (tarihEl) tarihEl.innerText = kitapModu ? "" : (oge.tarih ? `Yayın ${oge.tarih}` : "");
  if (puanEl) puanEl.innerText = kitapModu ? "" : (oge.puan ? `IMDb/TMDB ${Number(oge.puan).toFixed(1)}/10` : "");
  if (ozetEl) {
    ozetEl.innerText = kitapModu ? "" : (oge.ozet || "");
    ozetEl.style.display = kitapModu || !oge.ozet ? "none" : "block";
  }
  const gorsel = kitapModu ? oge.kapak : oge.poster;
  const posterEl = document.getElementById("filmModalPoster");
  const yokEl = document.getElementById("filmModalPosterYok");
  if (gorsel) {
    posterEl.src = kitapModu ? kitapKapakUrl(gorsel) : filmPosterUrl(gorsel);
    posterEl.style.display = "block";
    if (yokEl) yokEl.style.display = "none";
  } else {
    posterEl.style.display = "none";
    if (yokEl) {
      yokEl.innerHTML = kitapModu ? KITAP_IKON : FILM_IKON;
      yokEl.style.display = "flex";
    }
  }
  const durumSel = document.getElementById("filmDurum");
  durumSel.innerHTML = kitapModu
    ? '<option value="okudum">Okudum</option><option value="okuyorum">Okuyorum</option><option value="okumak-istiyorum">Okumak istiyorum</option>'
    : '<option value="izledim">İzledim</option><option value="izliyorum">İzliyorum</option><option value="izlemek-istiyorum">İzlemek istiyorum</option>';
  const mevcut = kitapModu
    ? KITAP_JURNAL.find((k) => k.id === oge.id)
    : FILM_JURNAL.find((f) => f.id === oge.id && f.tur === oge.tur);
  durumSel.value = mevcut ? mevcut.durum : (kitapModu ? "okudum" : "izledim");
  const yorumEl = document.getElementById("filmYorum");
  yorumEl.value = mevcut ? mevcut.yorum : "";
  yorumEl.placeholder = kitapModu ? "Bu kitap hakkında ne düşünüyorsun?" : "Bu film/dizi hakkında ne düşünüyorsun?";
  FILM_PUAN = mevcut ? mevcut.puan : null;
  yildizGuncelle(null);
  document.getElementById("filmKaydetBtn").innerText = mevcut ? "Güncelle" : "Kaydet";
  document.getElementById("filmDurumMetni").innerText = "";
  document.getElementById("filmModal").style.display = "flex";
  document.body.classList.add("lightbox-acik");
}

function filmModalKapat(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("filmModal");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("lightbox-acik");
  FILM_SECILI = null;
  FILM_PUAN = null;
}

function filmSec(i) {
  const oge = FILM_ARAMA_SONUCU[i];
  if (oge) filmModalAc(oge);
}

async function filmKaydet() {
  if (!FILM_SECILI) return;
  const kitapModu = FILM_SECILI.tur === "kitap";
  const btn = document.getElementById("filmKaydetBtn");
  const durumEl = document.getElementById("filmDurumMetni");
  if (btn) btn.disabled = true;
  if (durumEl) durumEl.innerText = "Kaydediliyor...";
  const gelen = kitapModu ? {
    id: FILM_SECILI.id,
    ad: FILM_SECILI.ad,
    yazar: FILM_SECILI.yazar || "",
    yil: FILM_SECILI.yil || "",
    kapak: FILM_SECILI.kapak || "",
    durum: document.getElementById("filmDurum").value,
    puan: FILM_PUAN,
    yorum: document.getElementById("filmYorum").value,
  } : {
    id: FILM_SECILI.id,
    tur: FILM_SECILI.tur,
    ad: FILM_SECILI.ad,
    yil: FILM_SECILI.yil || "",
    tarih: FILM_SECILI.tarih || "",
    poster: FILM_SECILI.poster || "",
    katalogPuan: FILM_SECILI.puan || null,
    turler: FILM_SECILI.turler || [],
    ozet: FILM_SECILI.ozet || "",
    durum: document.getElementById("filmDurum").value,
    puan: FILM_PUAN,
    yorum: document.getElementById("filmYorum").value,
  };
  try {
    const res = await fetch(kitapModu ? "/api/kitaplar" : "/api/filmler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gelen),
    });
    const veri = await res.json();
    if (!res.ok) throw new Error(veri.hata || "Kaydedilemedi.");
    if (kitapModu) {
      KITAP_JURNAL = veri.kitaplar || KITAP_JURNAL;
      if (document.getElementById("pKitaplar")) kitapProfilGoster(KITAP_JURNAL, KITAP_JURNAL.length);
    } else {
      FILM_JURNAL = veri.filmler || FILM_JURNAL;
      if (document.getElementById("pFilmler")) {
        filmProfilGoster(
          FILM_JURNAL,
          FILM_JURNAL.length,
          FILM_JURNAL.filter((f) => f.tur === "film").length,
          FILM_JURNAL.filter((f) => f.tur === "dizi").length
        );
      }
    }
    if (durumEl) {
      durumEl.innerText = veri.kazanilanXp > 0 ? `Kaydedildi ✓ +${veri.kazanilanXp} XP` : "Kaydedildi ✓";
      setTimeout(() => { if (durumEl.innerText.startsWith("Kaydedildi")) durumEl.innerText = ""; }, 2200);
    }
    filmModalKapat();
  } catch (e) {
    if (durumEl) durumEl.innerText = "";
    alert(e.message || "Kaydedilemedi.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function filmAramaEnter(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    filmAra();
  }
}

// ---------- Rastgele film zarı ----------
let RASTGELE_FILM = null;
let ZAR_SAYACI = null;

function zarYuzSVG(sayi) {
  const konum = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
  };
  const noktalar = (konum[sayi] || []).map(([r, c]) => `<circle cx="${c * 8 - 4}" cy="${r * 8 - 4}" r="2.3"/>`).join("");
  return `<svg viewBox="0 0 24 24" class="zar-svg">${noktalar}</svg>`;
}

function zarYuzGuncelle() {
  const yuz = document.getElementById("zarYuz");
  if (yuz) yuz.outerHTML = zarYuzSVG(Math.floor(Math.random() * 6) + 1);
}

// Zarın üzerine gelince yüzü sürekli değişir (random olduğunu belli eder)
(function zarDinle() {
  const zar = document.getElementById("rastgeleZar");
  if (!zar) return;
  zar.addEventListener("pointerenter", () => {
    zar.classList.add("zar-beklemede");
    if (!ZAR_SAYACI) ZAR_SAYACI = setInterval(zarYuzGuncelle, 160);
    zarYuzGuncelle();
  });
  zar.addEventListener("pointerleave", () => {
    zar.classList.remove("zar-beklemede");
    clearInterval(ZAR_SAYACI);
    ZAR_SAYACI = null;
    zarYuzGuncelle();
  });
})();

async function rastgeleFilmAc() {
  const zar = document.getElementById("rastgeleZar");
  const modal = document.getElementById("rastgeleModal");
  const kutu = document.getElementById("rastgeleIcerik");
  if (zar) {
    if (zar.disabled) return;
    zar.disabled = true;
    zar.classList.add("zar-yuvarlaniyor");
  }
  if (modal) modal.style.display = "flex";
  if (kutu) kutu.innerHTML = '<span class="bos-hint">Zar atılıyor...</span>';
  document.body.classList.add("lightbox-acik");
  try {
    await rastgeleDoldur();
  } catch (e) {
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Rastgele film şu anda yüklenemedi. Tekrar dene.</span>';
  } finally {
    if (zar) {
      zar.disabled = false;
      zar.classList.remove("zar-yuvarlaniyor");
    }
  }
}

async function rastgeleDoldur() {
  const kutu = document.getElementById("rastgeleIcerik");
  if (!kutu) return;
  kutu.innerHTML = '<span class="bos-hint">Zar atılıyor...</span>';
  const res = await apiFetch("/api/filmler/rastgele");
  if (!res.ok) throw new Error("Rastgele film alınamadı.");
  const f = await res.json();
  RASTGELE_FILM = f;
  kutu.innerHTML = rastgeleKartHTML(f);
}

function rastgeleKartHTML(f) {
  const poster = f.poster
    ? `<img src="${htmlEsc(filmPosterUrl(f.poster))}" alt="${htmlEsc(f.ad)}" onerror="gorselHataYerineIcon(this)" />`
    : `<div class="film-modal-poster-yok" style="display:flex;">${FILM_IKON}</div>`;
  const meta = [f.tur === "film" ? "Film" : "Dizi", f.yil, f.suresi ? `${f.suresi} dk` : ""].filter(Boolean).join(" · ");
  const imdb = f.imdbId ? `<a class="imdb-link" href="https://www.imdb.com/title/${htmlEsc(f.imdbId)}" target="_blank" rel="noopener">IMDb</a>` : "";
  return `
    <div class="rastgele-poster">${poster}</div>
    <div class="rastgele-bilgi">
      <div class="rastgele-etiket">🎲 Rastgele Film</div>
      <h2>${htmlEsc(f.ad)}</h2>
      <div class="rastgele-meta">${meta}</div>
      ${f.turler && f.turler.length ? `<div class="rastgele-turler">${f.turler.map((t) => `<span>${htmlEsc(t)}</span>`).join("")}</div>` : ""}
      <div class="rastgele-puan">
        <span class="rastgele-yildiz">★ ${f.puan ? Number(f.puan).toFixed(1) : "—"}</span>
        <span class="rastgele-oy">/10</span>
        ${imdb}
        ${f.oySayisi ? `<span class="rastgele-oy">${f.oySayisi.toLocaleString("tr-TR")} oy</span>` : ""}
      </div>
      <p class="rastgele-ozet">${htmlEsc(f.ozet) || '<span class="bos-hint">Konu bilgisi bulunamadı.</span>'}</p>
      <div class="rastgele-alt">
        <button type="button" class="form-kaydet" onclick="rastgeleEkle()">Günlüğüne Ekle</button>
        <button type="button" class="form-vazgec" onclick="rastgeleTekrar()">Başka Bir Film</button>
      </div>
    </div>`;
}

async function rastgeleTekrar() {
  try {
    await rastgeleDoldur();
  } catch (e) {
    const kutu = document.getElementById("rastgeleIcerik");
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Rastgele film şu anda yüklenemedi. Tekrar dene.</span>';
  }
}

function rastgeleEkle() {
  if (!RASTGELE_FILM) return;
  rastgeleModalKapat();
  filmModalAc(RASTGELE_FILM);
}

function rastgeleModalKapat(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("rastgeleModal");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("lightbox-acik");
}


function filmKatalogKartHTML(f, i) {
  const kayitli = FILM_JURNAL.some((kayit) => kayit.id === f.id && kayit.tur === f.tur);
  const turler = Array.isArray(f.turler) ? f.turler.slice(0, 2).join(" · ") : "";
  const yayin = f.tarih || f.yil;
  return `
    <button type="button" class="film-kart film-katalog-kart" onclick="filmSec(${i})">
      ${f.poster
        ? `<img src="${htmlEsc(filmPosterUrl(f.poster))}" alt="${htmlEsc(f.ad)}" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
        : `<span class="film-poster-yok">${FILM_IKON}</span>`}
      <span class="film-kart-bilgi">
        <strong>${htmlEsc(f.ad)}</strong>
        <span class="film-kart-meta">${f.tur === "film" ? "Film" : "Dizi"}${yayin ? ` · ${htmlEsc(yayin)}` : ""}</span>
        <span class="film-kart-puan">${f.puan ? `★ ${Number(f.puan).toFixed(1)}` : "Puan yok"}${turler ? ` <i>${htmlEsc(turler)}</i>` : ""}</span>
        ${kayitli ? '<span class="film-kart-ekli">Günlüğünde · Düzenle</span>' : '<span class="film-kart-ekle">+ Günlüğüne ekle</span>'}
      </span>
    </button>`;
}

function filmKesfetSonuclariCiz(sonuc, bilgi) {
  const kutu = document.getElementById("filmSonuclar");
  const sayac = document.getElementById("filmKesfetBilgi");
  if (!kutu) return;
  FILM_ARAMA_SONUCU = Array.isArray(sonuc) ? sonuc : [];
  if (sayac) sayac.innerText = bilgi || "";
  if (!FILM_ARAMA_SONUCU.length) {
    kutu.innerHTML = '<span class="bos-hint">Bu filtrelerle sonuç bulunamadı. Filtreleri biraz genişletmeyi dene.</span>';
    return;
  }
  kutu.innerHTML = FILM_ARAMA_SONUCU.map((f, i) => filmKatalogKartHTML(f, i)).join("");
}

async function filmKategorileriYukle() {
  const kategoriSatir = document.getElementById("filtreKategori");
  if (!kategoriSatir) return;
  try {
    const res = await apiFetch("/api/filmler/kategoriler");
    if (!res.ok) return;
    const veri = await res.json();
    const tur = FILM_FILTRE.tur;
    const liste = tur === "film" ? veri.film : tur === "dizi" ? veri.dizi : [...veri.film, ...veri.dizi]
      .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
    const secili = FILM_FILTRE.kategori;
    kategoriSatir.innerHTML =
      `<button type="button" class="filtre-cip ${!secili ? "secili" : ""}" data-deger="" onclick="filtreSec('kategori','',this)">Tümü</button>` +
      liste.map((item) => `<button type="button" class="filtre-cip ${String(item.id) === secili ? "secili" : ""}" data-deger="${item.id}" onclick="filtreSec('kategori','${item.id}',this)">${htmlEsc(item.ad)}</button>`).join("");
  } catch (e) {
    /* Kategori listesi gelmezse temel katalog yine kullanılabilir. */
  }
}

// Filtre çipi seçilince durumu günceller ve kataloğu yeniden çeker
function filtreSec(alan, deger, cipEl) {
  FILM_FILTRE[alan] = deger;
  if (cipEl) {
    const satir = cipEl.closest(".filtre-cip-satir");
    if (satir) satir.querySelectorAll(".filtre-cip").forEach((c) => c.classList.toggle("secili", c === cipEl));
  }
  if (alan === "tur") {
    // tür değişince kategori listesi türe göre yenilenir, seçili kategori sıfırlanır
    FILM_FILTRE.kategori = "";
    const kategoriSatir = document.getElementById("filtreKategori");
    if (kategoriSatir) kategoriSatir.querySelectorAll(".filtre-cip").forEach((c) => c.classList.toggle("secili", c.dataset.deger === ""));
    filmKategorileriYukle();
  }
  FILM_KESFET_SAYFA = 1;
  filmKesfet();
}

function filmYilFiltresiDoldur() {
  const satir = document.getElementById("filtreYil");
  if (!satir) return;
  const cYil = new Date().getFullYear();
  const secenekler = [{ deger: "", etiket: "Tümü" }];
  for (let i = 0; i < 6; i++) secenekler.push({ deger: String(cYil - i), etiket: String(cYil - i) });
  secenekler.push({ deger: "2010-2019", etiket: "2010'lar" });
  secenekler.push({ deger: "2000-2009", etiket: "2000'ler" });
  secenekler.push({ deger: "1990-1999", etiket: "90'lar" });
  secenekler.push({ deger: "1980-1989", etiket: "80'ler" });
  secenekler.push({ deger: "1970-1979", etiket: "70'ler" });
  satir.innerHTML = secenekler.map((s) =>
    `<button type="button" class="filtre-cip ${!s.deger ? "secili" : ""}" data-deger="${s.deger}" onclick="filtreSec('yil','${s.deger}',this)">${s.etiket}</button>`
  ).join("");
}

async function filmKesfet() {
  const kutu = document.getElementById("filmSonuclar");
  if (!kutu) return;
  const istek = ++FILM_KESFET_ISTEK;
  const tur = FILM_FILTRE.tur;
  const kategori = FILM_FILTRE.kategori;
  const yil = FILM_FILTRE.yil;
  const minPuan = FILM_FILTRE.minPuan;
  const sirala = FILM_FILTRE.sirala;
  kutu.innerHTML = '<span class="bos-hint">Katalog hazırlanıyor...</span>';
  try {
    const query = new URLSearchParams({ tur, kategori, yil, minPuan, sirala, sayfa: FILM_KESFET_SAYFA });
    const res = await apiFetch(`/api/filmler/kesfet?${query}`);
    if (!res.ok) throw new Error("Katalog yüklenemedi.");
    const veri = await res.json();
    if (istek !== FILM_KESFET_ISTEK) return;
    const baslik = document.getElementById("filmKesfetBaslik");
    if (baslik) baslik.innerText = "Şimdi keşfet";
    filmKesfetSonuclariCiz(veri.sonuc, veri.toplam ? `${veri.toplam.toLocaleString("tr-TR")} başlık` : "");
    const sayfalama = document.getElementById("filmKesfetSayfalama");
    const toplamSayfa = Math.min(20, veri.toplamSayfa || 1);
    if (sayfalama && toplamSayfa > 1) {
      sayfalama.innerHTML = Array.from({ length: toplamSayfa }, (_, index) => index + 1)
        .map((sayfa) => `<button type="button" class="yorum-sayfa ${sayfa === FILM_KESFET_SAYFA ? "aktif" : ""}" onclick="filmKesfetSayfayaGit(${sayfa})">${sayfa}</button>`)
        .join("");
    } else if (sayfalama) {
      sayfalama.innerHTML = "";
    }
  } catch (e) {
    if (istek === FILM_KESFET_ISTEK) kutu.innerHTML = '<span class="bos-hint">Katalog şu anda yüklenemedi. Birkaç saniye sonra tekrar dene.</span>';
  }
}

function filmKesfetSayfayaGit(sayfa) {
  FILM_KESFET_SAYFA = Math.max(1, parseInt(sayfa, 10) || 1);
  filmKesfet("sayfa");
  document.getElementById("filmAraKutu")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function filmFiltreleriSifirla() {
  FILM_FILTRE = { tur: "tum", kategori: "", yil: "", minPuan: "0", sirala: "popularity.desc" };
  const beklenenler = {
    filtreTur: "tum",
    filtreKategori: "",
    filtreYil: "",
    filtrePuan: "0",
    filtreSirala: "popularity.desc",
  };
  document.querySelectorAll(".filtre-cip-satir").forEach((satir) => {
    const beklenen = beklenenler[satir.id];
    satir.querySelectorAll(".filtre-cip").forEach((c) => c.classList.toggle("secili", c.dataset.deger === beklenen));
  });
  FILM_KESFET_SAYFA = 1;
  filmKategorileriYukle().then(() => filmKesfet());
}

async function filmAra() {
  const q = document.getElementById("filmAramaInput").value.trim();
  const kutu = document.getElementById("filmSonuclar");
  if (!q) {
    filmKesfet();
    return;
  }
  if (kutu) kutu.innerHTML = '<span class="bos-hint">Aranıyor…</span>';
  try {
    const res = await apiFetch(`/api/filmler/arama?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Arama yapılamadı.");
    const sonuc = await res.json();
    FILM_ARAMA_SONUCU = Array.isArray(sonuc) ? sonuc : [];
    const sayfalama = document.getElementById("filmKesfetSayfalama");
    if (sayfalama) sayfalama.innerHTML = "";
    const baslik = document.getElementById("filmKesfetBaslik");
    if (baslik) baslik.innerText = `“${q}” arama sonuçları`;
    const sayac = document.getElementById("filmKesfetBilgi");
    if (sayac) sayac.innerText = `${FILM_ARAMA_SONUCU.length} sonuç`;
    filmSonuclariCiz();
  } catch (e) {
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Arama şu anda yapılamadı.</span>';
  }
}

function filmSonuclariCiz() {
  const kutu = document.getElementById("filmSonuclar");
  if (!kutu) return;
  if (!FILM_ARAMA_SONUCU.length) {
    kutu.innerHTML = '<span class="bos-hint">Sonuç bulunamadı. Farklı bir isim dene.</span>';
    return;
  }
  kutu.innerHTML = FILM_ARAMA_SONUCU.map((f, i) => filmKatalogKartHTML(f, i)).join("");
}

// Film/Dizi - Kitap arama sekmesi (filmler sayfası)
function aramaSekmesi(mod) {
  const kitap = mod === "kitap";
  const sekmeFilm = document.getElementById("sekmeFilm");
  const sekmeKitap = document.getElementById("sekmeKitap");
  if (sekmeFilm) sekmeFilm.classList.toggle("aktif", !kitap);
  if (sekmeKitap) sekmeKitap.classList.toggle("aktif", kitap);
  const filmIcerik = document.getElementById("filmKatalogIcerik");
  const kitapIcerik = document.getElementById("kitapKatalogIcerik");
  if (filmIcerik) filmIcerik.style.display = kitap ? "none" : "";
  if (kitapIcerik) kitapIcerik.style.display = kitap ? "" : "none";
  const kitapSonuclar = document.getElementById("kitapSonuclar");
  if (kitapSonuclar) kitapSonuclar.innerHTML = "";
  FILM_ARAMA_SONUCU = [];
  KITAP_ARAMA_SONUCU = [];
}

function kitapAramaEnter(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    kitapAra();
  }
}

async function kitapAra() {
  const q = document.getElementById("kitapAramaInput").value.trim();
  const kutu = document.getElementById("kitapSonuclar");
  if (!q) {
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Aramak için bir şeyler yaz.</span>';
    return;
  }
  if (kutu) kutu.innerHTML = '<span class="bos-hint">Aranıyor…</span>';
  try {
    const res = await apiFetch(`/api/kitap/arama?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Arama yapılamadı.");
    const sonuc = await res.json();
    KITAP_ARAMA_SONUCU = Array.isArray(sonuc) ? sonuc : [];
    kitapSonuclariCiz();
  } catch (e) {
    if (kutu) kutu.innerHTML = '<span class="bos-hint">Arama şu anda yapılamadı.</span>';
  }
}

function kitapSonuclariCiz() {
  const kutu = document.getElementById("kitapSonuclar");
  if (!kutu) return;
  if (!KITAP_ARAMA_SONUCU.length) {
    kutu.innerHTML = '<span class="bos-hint">Sonuç bulunamadı. Farklı bir isim dene.</span>';
    return;
  }
  kutu.innerHTML =
    '<div class="film-ara-baslik">Kitap sonuçları</div>' +
    KITAP_ARAMA_SONUCU.map((k, i) => `
      <button type="button" class="film-kart" onclick="kitapSec(${i})">
        ${k.kapak
          ? `<img src="${htmlEsc(kitapKapakUrl(k.kapak))}" alt="" loading="lazy" onerror="gorselHataYerineIcon(this)" />`
          : `<span class="film-poster-yok">${KITAP_IKON}</span>`}
        <span class="film-kart-bilgi">
          <strong>${htmlEsc(k.ad)}</strong>
          <span>${k.yazar ? htmlEsc(k.yazar) : "Kitap"}${k.yil ? ` · ${htmlEsc(k.yil)}` : ""}</span>
        </span>
      </button>
    `).join("");
}

function kitapSec(i) {
  const oge = KITAP_ARAMA_SONUCU[i];
  if (oge) filmModalAc(oge);
}

async function filmlerSayfasiBaslat() {
  const ben = await navBarDoldur();
  BENIM_ID = ben && ben.girisYapti ? ben.id : null;
  BENIM_ADMIN = ben && ben.girisYapti && ben.admin === true;

  const formHintEl = document.getElementById("filmFormHint");
  const backEl = document.getElementById("filmBack");

  if (backEl) {
    backEl.href = "/profil";
    backEl.style.display = BENIM_ID ? "inline-block" : "none";
  }
  if (formHintEl) {
    formHintEl.innerText = BENIM_ID
      ? "İzlediğin veya izlemek istediğin film ve dizileri, okuduğun veya okumak istediğin kitapları ara, puanla, yorumla ve profiline ekle."
      : "Film, dizi ve kitapları arayıp inceleyebilirsin. Kayıt eklemek için Discord ile giriş yapmalısın.";
  }

  // Güncelleme yapılabilmesi için giriş yapan üyenin mevcut günlüklerini bellekte tut
  FILM_JURNAL = [];
  KITAP_JURNAL = [];
  if (BENIM_ID) {
    try {
      const res = await apiFetch(`/api/profile/${BENIM_ID}/filmler`);
      if (res.ok) {
        const veri = await res.json();
        FILM_JURNAL = veri.filmler || [];
      }
    } catch (e) {
      /* yoksay */
    }
    try {
      const res = await apiFetch(`/api/profile/${BENIM_ID}/kitaplar`);
      if (res.ok) {
        const veri = await res.json();
        KITAP_JURNAL = veri.kitaplar || [];
      }
    } catch (e) {
      /* yoksay */
    }
  }
  filmYilFiltresiDoldur();
  await filmKategorileriYukle();
  await filmKesfet();
}

// ---------- Etkinlik Günlüğü (admin) ----------
const LOG_TUR_ETIKET = {
  "film-ekle": "film/dizi ekledi",
  "film-guncelle": "film/dizi güncelledi",
  "favori": "favori film/dizi seçti",
  "kitap-ekle": "kitap ekledi",
  "kitap-guncelle": "kitap güncelledi",
  "kitap-favori": "favori kitap seçti",
  "yorum": "profiline yorum yazdı",
  "galeri-ekle": "galeriye görsel ekledi",
  "galeri-yorum": "galeriye yorum yazdı",
  "pet-besle": "Archie'nin kabını doldurdu",
  "pet-agac": "Archie'nin ağacını değiştirdi",
};

async function logSayfasiBaslat() {
  const ben = await navBarDoldur();
  BENIM_ID = ben && ben.girisYapti ? ben.id : null;
  BENIM_ADMIN = ben && ben.girisYapti && ben.admin === true;
  const liste = document.getElementById("logListe");
  if (!liste) return;

  if (!BENIM_ID || !BENIM_ADMIN) {
    liste.innerHTML = `
      <div class="log-yetki-yok">
        <h2>Yetkin Yok</h2>
        <p>Bu günlük sadece yöneticilere açıktır.</p>
        <a href="/" class="discord-giris-btn buyuk">Ana Sayfaya Dön</a>
      </div>`;
    return;
  }

  try {
    const res = await apiFetch("/api/loglar");
    if (!res.ok) throw new Error("Günlük yüklenemedi.");
    const veri = await res.json();
    logListeCiz(veri.loglar || []);
  } catch (e) {
    liste.innerHTML = '<span class="bos-hint">Günlük yüklenemedi.</span>';
  }
}

function logListeCiz(loglar) {
  const liste = document.getElementById("logListe");
  if (!liste) return;
  if (!loglar.length) {
    liste.innerHTML = '<span class="bos-hint">Henüz kayıt yok.</span>';
    return;
  }
  liste.innerHTML = loglar.map((l) => `
    <div class="log-oge">
      ${l.avatar ? `<img src="${htmlEsc(l.avatar)}" alt="" loading="lazy" onerror="this.style.visibility='hidden';" />` : `<span class="log-avatar-yok"></span>`}
      <div class="log-oge-ic">
        <div class="log-oge-ust">
          <a href="/profil?id=${encodeURIComponent(l.kullaniciId)}" class="log-isim">${htmlEsc(l.kullaniciAd)}</a>
          <span class="log-tur">${LOG_TUR_ETIKET[l.tur] || l.tur || ""}</span>
        </div>
        ${l.detay ? `<div class="log-detay">${htmlEsc(l.detay)}</div>` : ""}
        <div class="log-zaman">${yorumTarihYaz(l.tarih)}</div>
      </div>
    </div>
  `).join("");
}

// ---------- Sunucu Pet'i: Archie (tüm sayfalarda serbest gezen animasyonlu kedi) ----------
// Aseprite'ten alınan frame'ler /pet/ klasöründe. Kedi ekranda üst/alt/sağ/sol gezer,
// kedi ağacına çıkıp uyuyabilir, yemlik/su kabından yer ve içer, iplik topunu kovalar.
const PET_DURUM_ADI = { mutlu: "Mutlu", tok: "Tok", ac: "Aç" };
const PET_DOLDURMA_COOLDOWN_MS = 10 * 60 * 1000;
const PET_KUTU = { w: 130, h: 130 };
const PET_AGAC = { x: 16, y: 14, w: 240, h: 230 };
const PET_KAB_RENK = { 1: "blue", 2: "green", 3: "red" };
let PET_TOP_GORSEL = "ball-red.png";

let PET_DURUM = "mutlu";
let PET_ACLIK = 100;
let PET_SUSUZLUK = 100;
let PET_YEM_DOLU = true;
let PET_SU_DOLU = true;
let PET_YEM_YIYOR = false;
let PET_SU_IYIYOR = false;
let PET_TREE = 1;
let PET_TOPLAM_MAMA = 0;
let PET_TOPLAM_SU = 0;
let PET_GIRIS = false;
let PET_DOLDURABILIR = false;
let PET_COOLDOWN_MS = 0;

let PET_X = 120;
let PET_Y = 30;
let PET_HEDEF = null;
let PET_MODE = "dur"; // hareket | dur | yemek | icki
let PET_ANIM = "sit-front";
let PET_ANIM_FRAME = 0;
let PET_ANIM_SON_ZAMAN = 0;
const PET_FRAME_ONBELLEK = {};
let PET_OTURMA_SURESI = 0;
let PET_SURUCU = null;
let PET_ALAN = { minX: 10, maxX: 700, minY: 10, maxY: 300 };
let PET_AC_ANONSU = false;

let PET_TOP_AKTIF = false;
let PET_TOP_X = 0;
let PET_TOP_Y = 0;
let PET_TOP_ZAMAN = 0;
let PET_TOP_SURUKLENIYOR = false;
let PET_TOP_UCUS = false;
let PET_TOP_VX = 0;
let PET_TOP_VY = 0;
let PET_TOP_RAF = null;
let PET_TOP_SON_ZAMAN = 0;
let PET_TOP_YAKALANDI = false;
let PET_AGAC_USTU = false;
let PET_AGAC_SYNC_YAPILDI = false;

let petKonusmaZamanlayici = null;
let PET_SON_KONUSMA = "";
let PET_SON_KONUSMA_ZAMANI = 0;

function petAlanGuncelle() {
  const w = document.documentElement.clientWidth || window.innerWidth || 900;
  const h = document.documentElement.clientHeight || window.innerHeight || 600;
  PET_ALAN = {
    minX: 10,
    maxX: Math.max(150, w - PET_KUTU.w - 10),
    minY: 10,
    maxY: Math.max(120, h - 64 - PET_KUTU.h - 8),
  };
}

function petAnimAyarla(set, reset) {
  if (PET_ANIM === set && !reset) return;
  PET_ANIM = set;
  if (reset) {
    PET_ANIM_FRAME = 0;
    PET_ANIM_SON_ZAMAN = performance.now();
  }
  petKareGoster();
}

function petKareGoster() {
  const kare = document.getElementById("petKare");
  if (!kare) return;
  const url = `/pet/${PET_ANIM}-${PET_ANIM_FRAME + 1}.png`;
  const onbellek = PET_FRAME_ONBELLEK[url];
  kare.src = onbellek && onbellek.complete ? onbellek.src : url;
}

function petFrameTik() {
  const simdi = performance.now();
  if (!PET_ANIM_SON_ZAMAN) PET_ANIM_SON_ZAMAN = simdi;
  const hareketEdiyor = PET_TOP_SURUKLENIYOR || PET_TOP_UCUS || PET_MODE === "hareket";
  const aralik = hareketEdiyor && PET_HEDEF && PET_HEDEF.mod === "kos" ? 90 : hareketEdiyor ? 150 : 240;
  const gecen = simdi - PET_ANIM_SON_ZAMAN;
  if (gecen < aralik) return;
  const adim = Math.max(1, Math.floor(gecen / aralik));
  PET_ANIM_FRAME = (PET_ANIM_FRAME + adim) % 4;
  PET_ANIM_SON_ZAMAN += adim * aralik;
  petKareGoster();
}

function petFrameOnbellekle() {
  const setler = [
    "walk-down", "walk-left", "walk-right", "walk-up",
    "run-down", "run-left", "run-right", "run-up",
    "sit-front", "sit-back", "lay-front", "lay-left", "sleep", "drink",
  ];
  for (const set of setler) {
    for (let i = 1; i <= 4; i++) {
      const url = `/pet/${set}-${i}.png`;
      const img = new Image();
      img.src = url;
      PET_FRAME_ONBELLEK[url] = img;
    }
  }
}

function petPozisyonUygula() {
  const varlik = document.getElementById("petVarlik");
  if (varlik) {
    varlik.style.left = `${PET_X}px`;
    varlik.style.bottom = `${PET_Y}px`;
  }
}

function petRastgeleNokta() {
  for (let i = 0; i < 25; i++) {
    const x = PET_ALAN.minX + Math.random() * (PET_ALAN.maxX - PET_ALAN.minX);
    const y = PET_ALAN.minY + Math.random() * (PET_ALAN.maxY - PET_ALAN.minY);
    if (x > PET_AGAC.x + PET_AGAC.w + 30) return { x, y };
    if (y > PET_AGAC.y + PET_AGAC.h + 20) return { x, y };
  }
  return { x: PET_ALAN.maxX - 50, y: PET_ALAN.minY + 20 };
}

function petHedefGit(x, y, mod, varis) {
  PET_HEDEF = { x, y, mod, varis };
  PET_MODE = "hareket";
  const dx = x - PET_X;
  const dy = y - PET_Y;
  const yatay = Math.abs(dx) > Math.abs(dy);
  const yon = yatay ? (dx > 0 ? "right" : "left") : (dy > 0 ? "up" : "down");
  petYuruSet((mod === "kos" ? "run-" : "walk-") + yon);
}

function petHedefSec() {
  if (PET_YEM_YIYOR) {
    petHedefGit(PET_AGAC.x + PET_AGAC.w - 50, PET_AGAC.y + 4, "yuru", "yemek");
    return;
  }
  if (PET_SU_IYIYOR) {
    petHedefGit(PET_AGAC.x + PET_AGAC.w + 140, PET_AGAC.y + 6, "yuru", "icki");
    return;
  }
  if (PET_TOP_AKTIF && !PET_TOP_SURUKLENIYOR) {
    petHedefGit(Math.max(PET_ALAN.minX, PET_TOP_X - 55), PET_TOP_Y, "kos", "top");
    return;
  }
  if (Math.random() < 0.2) {
    petHedefGit(PET_AGAC.x + PET_AGAC.w / 2 - PET_KUTU.w / 2, PET_AGAC.y + PET_AGAC.h - 6, "yuru", "agac");
  } else {
    const n = petRastgeleNokta();
    petHedefGit(n.x, n.y, Math.random() < 0.14 ? "kos" : "yuru", "hareket");
  }
}

function petVaris() {
  const v = PET_HEDEF ? PET_HEDEF.varis : "hareket";
  PET_HEDEF = null;
  PET_AGAC_USTU = v === "agac";
  if (v === "yemek") {
    PET_MODE = "yemek";
    petAnimAyarla("sit-front", true);
    petKonusma("Mmm, yemek! 😋");
  } else if (v === "icki") {
    PET_MODE = "icki";
    petAnimAyarla("drink", true);
    petKonusma("Şık şık şık... 💧");
  } else if (v === "agac") {
    PET_MODE = "dur";
    petIdleSec(true);
  } else if (v === "top") {
    PET_MODE = "dur";
    PET_TOP_ZAMAN = Date.now();
    PET_OTURMA_SURESI = 5000;
    petAnimAyarla("sit-front", true);
    if (!PET_TOP_YAKALANDI) {
      PET_TOP_YAKALANDI = true;
      petKonusma("İplik! 😻");
    }
  } else {
    PET_MODE = "dur";
    petIdleSec(false);
  }
}

function petIdleSec(agacta) {
  PET_HEDEF = null;
  const ac = PET_DURUM === "ac";
  let liste;
  if (agacta) liste = [["sleep", 5], ["lay-front", 3], ["lay-left", 2], ["sit-front", 2], ["sit-back", 2]];
  else if (ac) liste = [["sleep", 4], ["sit-front", 3], ["lay-front", 2], ["sit-back", 2], ["lay-left", 1]];
  else liste = [["sit-front", 3], ["sit-back", 2], ["lay-front", 2], ["lay-left", 2], ["sleep", 1]];
  const toplam = liste.reduce((s, o) => s + o[1], 0);
  let r = Math.random() * toplam;
  let sec = liste[0][0];
  for (const [ad, w] of liste) {
    if (r < w) { sec = ad; break; }
    r -= w;
  }
  petAnimAyarla(sec, true);
  PET_OTURMA_SURESI = sec === "sleep" ? 7000 + Math.random() * 7000 : 3500 + Math.random() * 5000;
}

function petTopSpawn() {
  const n = petRastgeleNokta();
  PET_TOP_X = n.x + 50;
  PET_TOP_Y = n.y;
  const top = document.getElementById("petTop");
  if (top) {
    top.innerHTML = `<img src="/pet/${PET_TOP_GORSEL}" alt="">`;
    top.style.left = `${PET_TOP_X}px`;
    top.style.bottom = `${PET_TOP_Y}px`;
    top.style.display = "";
  }
  PET_TOP_AKTIF = true;
}

function petTopSpawnGorsel(img) {
  if (PET_TOP_AKTIF) {
    petKonusma("Archie şu an topu kovalıyor, az sonra!");
    return;
  }
  PET_TOP_GORSEL = img;
  PET_TOP_YAKALANDI = false;
  petTopSpawn();
  petHedefGit(Math.max(PET_ALAN.minX, PET_TOP_X - 55), PET_TOP_Y, "kos", "top");
  petKonusma("Top! Yakalayacağım! 😻");
}

function petYuruSet(set) {
  const ayniAile = PET_ANIM.startsWith("run-") || PET_ANIM.startsWith("walk-");
  petAnimAyarla(set, !ayniAile);
}

function petTopKovala() {
  const hedefX = Math.max(PET_ALAN.minX, PET_TOP_X - 55);
  PET_HEDEF = { x: hedefX, y: PET_TOP_Y, mod: "kos", varis: "top" };
  PET_MODE = "hareket";
}

// Fırlatılan topu sahnede konumlandırır
function petTopKonumUygula() {
  const top = document.getElementById("petTop");
  if (!top) return;
  top.style.left = `${PET_TOP_X}px`;
  top.style.bottom = `${PET_TOP_Y}px`;
}

// Fırlatılan topun fizik döngüsü: hareket, sürtünme, duvar/köşe sekmeleri
function petTopFizikBaslat() {
  if (PET_TOP_RAF) return;
  PET_TOP_SON_ZAMAN = performance.now();
  const adim = (simdi) => {
    const dt = Math.min(0.05, Math.max(0.001, (simdi - PET_TOP_SON_ZAMAN) / 1000));
    PET_TOP_SON_ZAMAN = simdi;
    if (PET_TOP_UCUS) {
      PET_TOP_X += PET_TOP_VX * dt;
      PET_TOP_Y += PET_TOP_VY * dt;
      const surtunme = Math.max(0, 1 - 1.8 * dt);
      PET_TOP_VX *= surtunme;
      PET_TOP_VY *= surtunme;
      const genislik = document.documentElement.clientWidth || window.innerWidth || 900;
      const yukseklik = window.innerHeight || document.documentElement.clientHeight || 600;
      const sinirX = genislik - 56;
      const sinirY = yukseklik - 70;
      const esneklik = 0.72;
      if (PET_TOP_X < 8) {
        PET_TOP_X = 8;
        PET_TOP_VX = Math.abs(PET_TOP_VX) * esneklik;
      } else if (PET_TOP_X > sinirX) {
        PET_TOP_X = sinirX;
        PET_TOP_VX = -Math.abs(PET_TOP_VX) * esneklik;
      }
      if (PET_TOP_Y < 8) {
        PET_TOP_Y = 8;
        PET_TOP_VY = Math.abs(PET_TOP_VY) * esneklik;
      } else if (PET_TOP_Y > sinirY) {
        PET_TOP_Y = sinirY;
        PET_TOP_VY = -Math.abs(PET_TOP_VY) * esneklik;
      }
      if (Math.abs(PET_TOP_VX) < 28 && Math.abs(PET_TOP_VY) < 28) {
        PET_TOP_VX = 0;
        PET_TOP_VY = 0;
        PET_TOP_UCUS = false;
      }
      petTopKonumUygula();
    }
    PET_TOP_RAF = requestAnimationFrame(adim);
  };
  PET_TOP_RAF = requestAnimationFrame(adim);
}

function petSurucuTik() {
  if (PET_TOP_SURUKLENIYOR || PET_TOP_UCUS) {
    petTopKovala();
  }
  if (PET_MODE === "hareket" && PET_HEDEF) {
    const dx = PET_HEDEF.x - PET_X;
    const dy = PET_HEDEF.y - PET_Y;
    const mesafe = Math.hypot(dx, dy);
    if (mesafe < 7) {
      PET_X = PET_HEDEF.x;
      PET_Y = PET_HEDEF.y;
      petVaris();
    } else {
      const hiz = PET_HEDEF.mod === "kos" ? 3.6 : 1.7;
      PET_X += (dx / mesafe) * hiz;
      PET_Y += (dy / mesafe) * hiz;
      const yatay = Math.abs(dx) > Math.abs(dy);
      const yon = yatay ? (dx > 0 ? "right" : "left") : (dy > 0 ? "up" : "down");
      petYuruSet((PET_HEDEF.mod === "kos" ? "run-" : "walk-") + yon);
    }
  } else if (PET_MODE === "dur") {
    if (PET_TOP_AKTIF && PET_TOP_ZAMAN && !PET_TOP_UCUS && Date.now() - PET_TOP_ZAMAN > 5000) {
      PET_TOP_AKTIF = false;
      PET_TOP_ZAMAN = 0;
      const top = document.getElementById("petTop");
      if (top) top.style.display = "none";
    }
    PET_OTURMA_SURESI -= 40;
    if (PET_OTURMA_SURESI <= 0) petHedefSec();
  } else if (PET_MODE === "yemek") {
    if (!PET_YEM_YIYOR) {
      PET_MODE = "dur";
      PET_OTURMA_SURESI = 1200;
      petKonusma("Doydum! 😋");
    }
  } else if (PET_MODE === "icki") {
    if (!PET_SU_IYIYOR) {
      PET_MODE = "dur";
      PET_OTURMA_SURESI = 1200;
      petKonusma("Suyum bitti, şık! 💧");
    }
  }
  petFrameTik();
  petPozisyonUygula();
  const varlik = document.getElementById("petVarlik");
  if (varlik) varlik.classList.toggle("pet-ustte", PET_AGAC_USTU);
}

function petKurulum() {
  if (document.getElementById("petSistemi")) return;
  const kutu = document.createElement("div");
  kutu.id = "petSistemi";
  kutu.className = "pet-sistemi";
  kutu.innerHTML = `
    <div class="pet-sahne" id="petSahne">
      <div class="pet-agac" id="petAgac"><img id="petAgacImg" src="/pet/tree-1.png" alt="Kedi ağacı" /></div>
      <button type="button" class="pet-kap pet-yem-kab" id="petYemKab" onclick="petKapDoldur('yem')" title="Yemliği doldur">
        <img id="petYemImg" src="/pet/bowl-food-full-blue.png" alt="Yemlik" />
      </button>
      <button type="button" class="pet-kap pet-su-kab" id="petSuKab" onclick="petKapDoldur('su')" title="Su kabını doldur">
        <img id="petSuImg" src="/pet/bowl-water-full.png" alt="Su kabı" />
      </button>
      <div class="pet-top" id="petTop" style="display:none;"></div>
      <div class="pet-varlik" id="petVarlik">
        <img class="pet-kare" id="petKare" alt="Archie" />
        <div class="pet-konuisma" id="petKonusma"></div>
      </div>
    </div>
    <div class="pet-panel" id="petPanel">
      <div class="pet-panel-ust">
        <span class="pet-panel-isim">ARCHIE</span>
        <span class="pet-panel-durum" id="petDurumEtiketi">Mutlu</span>
        <button type="button" class="pet-panel-kapat" onclick="petPanelAcKapat()" aria-label="Kapat">×</button>
      </div>
      <div class="pet-agac-secici">
        <span class="pet-agac-etiket">Kedi Ağacı</span>
        <div class="pet-agac-butonlar">
          <button type="button" class="pet-agac-btn" data-tree="1" onclick="petAgacSec(1)"><img src="/pet/tree-1.png" alt="1" /></button>
          <button type="button" class="pet-agac-btn" data-tree="2" onclick="petAgacSec(2)"><img src="/pet/tree-2.png" alt="2" /></button>
          <button type="button" class="pet-agac-btn" data-tree="3" onclick="petAgacSec(3)"><img src="/pet/tree-3.png" alt="3" /></button>
        </div>
      </div>
      <div class="pet-top-secici">
        <span class="pet-agac-etiket">Toplar</span>
        <div class="pet-top-butonlar">
          <button type="button" class="pet-top-btn" onclick="petTopSpawnGorsel('ball-red.png')"><img src="/pet/ball-red.png" alt="Kırmızı top" /></button>
          <button type="button" class="pet-top-btn" onclick="petTopSpawnGorsel('ball-green.png')"><img src="/pet/ball-green.png" alt="Yeşil top" /></button>
          <button type="button" class="pet-top-btn" onclick="petTopSpawnGorsel('yarn-blue.png')"><img src="/pet/yarn-blue.png" alt="Mavi iplik" /></button>
          <button type="button" class="pet-top-btn" onclick="petTopSpawnGorsel('yarn-green.png')"><img src="/pet/yarn-green.png" alt="Yeşil iplik" /></button>
        </div>
      </div>
      <div class="pet-aclik-satir">
        <span class="pet-etiket">Açlık</span>
        <div class="pet-aclik-cubuk"><div class="pet-aclik-doluluk pet-aclik-renk" id="petAclikDoluluk"></div></div>
      </div>
      <div class="pet-aclik-satir">
        <span class="pet-etiket">Susuzluk</span>
        <div class="pet-aclik-cubuk"><div class="pet-aclik-doluluk pet-su-renk" id="petSuDoluluk"></div></div>
      </div>
      <div class="pet-panel-alt">
        <span class="pet-mama-sayisi" id="petMamaSayisi"></span>
        <span class="pet-su-sayisi" id="petSuSayisi"></span>
      </div>
    </div>
    <button type="button" class="pet-panel-acil" id="petPanelAcil" onclick="petPanelAcKapat()" title="Archie'nin bakımı" aria-label="Bakım panelini aç">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.5c-1 0-1.8.8-1.8 1.8 0 .5.2.9.5 1.2.3.4.5.8.5 1.2 0 1-.8 1.8-1.7 1.8z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/></svg>
    </button>`;
  document.body.appendChild(kutu);
  petTopSurukleme();
  petAlanGuncelle();
  window.addEventListener("resize", petAlanGuncelle);
  petFrameOnbellekle();
  petAnimAyarla("sit-front", true);
  petKareGoster();
  petPozisyonUygula();
  petVeriYukle();
  petSurucuBaslat();
}

function petSurucuBaslat() {
  if (PET_SURUCU) return;
  PET_SURUCU = setInterval(petSurucuTik, 40);
}

async function petVeriYukle() {
  try {
    const res = await apiFetch("/api/pet", {}, 8000);
    if (!res.ok) return;
    const v = await res.json();
    PET_ACLIK = v.aclik;
    PET_SUSUZLUK = v.susuzluk;
    PET_YEM_DOLU = v.yemDolu;
    PET_SU_DOLU = v.suDolu;
    const yemYiyor = v.yemYiyor;
    const suIyiyor = v.suIyiyor;
    PET_TREE = v.tree;
    PET_DURUM = v.durum || "mutlu";
    PET_TOPLAM_MAMA = v.toplamMama;
    PET_TOPLAM_SU = v.toplamSu;
    PET_GIRIS = !!v.ben;
    if (v.ben) {
      PET_DOLDURABILIR = v.ben.doldurabilir;
      PET_COOLDOWN_MS = v.ben.kalanMs || 0;
    }
    petArayuzGuncelle();
    if (PET_GIRIS && !PET_AGAC_SYNC_YAPILDI) {
      PET_AGAC_SYNC_YAPILDI = true;
      try {
        const pref = parseInt(localStorage.getItem("congress.petTree"), 10);
        if ([1, 2, 3].includes(pref) && pref !== PET_TREE) {
          fetch("/api/pet/tree", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tree: pref }),
          })
            .then((r) => r.json())
            .then((v2) => {
              if (v2.basarili) {
                PET_TREE = pref;
                petArayuzGuncelle();
              }
            })
            .catch(() => {});
        }
      } catch (e) { /* yoksay */ }
    }
    if ((yemYiyor || suIyiyor) && PET_MODE !== "yemek" && PET_MODE !== "icki" && !(PET_HEDEF && (PET_HEDEF.varis === "yemek" || PET_HEDEF.varis === "icki"))) {
      PET_MODE = "dur";
      PET_OTURMA_SURESI = 1;
    }
    if (PET_DURUM === "ac" && !PET_AC_ANONSU) {
      PET_AC_ANONSU = true;
      petKonusma("Miyav, karnım aç!");
      setTimeout(() => { PET_AC_ANONSU = false; }, 60000);
    }
  } catch (e) {
    /* pet hatası sayfayı bozmasın */
  }
}

function petArayuzGuncelle() {
  const aclikDoluluk = document.getElementById("petAclikDoluluk");
  if (aclikDoluluk) aclikDoluluk.style.width = `${PET_ACLIK}%`;
  const suDoluluk = document.getElementById("petSuDoluluk");
  if (suDoluluk) suDoluluk.style.width = `${PET_SUSUZLUK}%`;
  const etiket = document.getElementById("petDurumEtiketi");
  if (etiket) etiket.textContent = PET_DURUM_ADI[PET_DURUM] || PET_DURUM;
  const mamaSayi = document.getElementById("petMamaSayisi");
  if (mamaSayi) mamaSayi.textContent = `🍖 ${PET_TOPLAM_MAMA}`;
  const suSayi = document.getElementById("petSuSayisi");
  if (suSayi) suSayi.textContent = `💧 ${PET_TOPLAM_SU}`;

  const agacImg = document.getElementById("petAgacImg");
  if (agacImg) agacImg.src = `/pet/tree-${PET_TREE}.png`;
  document.querySelectorAll(".pet-agac-btn").forEach((b) => {
    b.classList.toggle("aktif", parseInt(b.dataset.tree, 10) === PET_TREE);
  });

  const renk = PET_KAB_RENK[PET_TREE] || "blue";
  const yemImg = document.getElementById("petYemImg");
  if (yemImg) yemImg.src = `/pet/bowl-food-${PET_YEM_DOLU ? "full" : "empty"}-${renk}.png`;
  const suImg = document.getElementById("petSuImg");
  if (suImg) suImg.src = `/pet/bowl-water-${PET_SU_DOLU ? "full" : "empty"}.png`;
}

function petPanelAcKapat() {
  const panel = document.getElementById("petPanel");
  const acil = document.getElementById("petPanelAcil");
  if (!panel) return;
  const acik = panel.classList.toggle("acik");
  if (acil) acil.classList.toggle("kapali", acik);
}

async function petAgacSec(tree) {
  if (!PET_GIRIS) {
    window.location.href = "/auth/login";
    return;
  }
  if (tree === PET_TREE) return;
  try {
    const res = await fetch("/api/pet/tree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tree }),
    });
    const v = await res.json();
    if (v.basarili) {
      PET_TREE = tree;
      try { localStorage.setItem("congress.petTree", String(tree)); } catch (e) { /* yoksay */ }
      petArayuzGuncelle();
      petKonusma("Yeni ağacım! 🎄");
    }
  } catch (e) {
    /* yoksay */
  }
}

async function petKapDoldur(tur) {
  if (!PET_GIRIS) {
    window.location.href = "/auth/login";
    return;
  }
  const btn = document.getElementById(tur === "yem" ? "petYemKab" : "petSuKab");
  if (!btn || btn.classList.contains("mesgul")) return;
  btn.classList.add("mesgul");
  try {
    const res = await fetch(`/api/pet/${tur}`, { method: "POST" });
    const v = await res.json();
    if (v.hata) {
      petKonusma(v.hata);
      if (v.kalanMs) PET_COOLDOWN_MS = v.kalanMs;
    } else if (v.basarili) {
      PET_YEM_DOLU = v.yemDolu;
      PET_SU_DOLU = v.suDolu;
      PET_TOPLAM_MAMA = v.toplamMama;
      PET_TOPLAM_SU = v.toplamSu;
      petKalpler();
      petKonusma(tur === "yem" ? "Miyav! Yemek geldi ❤" : "Şık şık, taze su! ❤");
      if (v.kazanilanXp > 0) petXpGoster(`+${v.kazanilanXp} XP`);
      if (v.rozet) petXpGoster(`🎉 ${v.rozet.ad} rozeti!`);
      if (v.ben) {
        PET_DOLDURABILIR = v.ben.doldurabilir;
        PET_COOLDOWN_MS = v.ben.kalanMs || 0;
      }
      petArayuzGuncelle();
    }
  } catch (e) {
    petKonusma("İşlem yapılamadı, tekrar dene.");
  } finally {
    btn.classList.remove("mesgul");
  }
}

function petTopSurukleme() {
  const top = document.getElementById("petTop");
  if (!top) return;
  let izler = [];
  top.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    PET_TOP_UCUS = false;
    PET_TOP_VX = 0;
    PET_TOP_VY = 0;
    PET_TOP_SURUKLENIYOR = true;
    PET_TOP_AKTIF = true;
    PET_TOP_ZAMAN = 0;
    izler = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    try { top.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
  });
  top.addEventListener("pointermove", (e) => {
    if (!PET_TOP_SURUKLENIYOR) return;
    const yukseklik = window.innerHeight || document.documentElement.clientHeight;
    const genislik = document.documentElement.clientWidth || window.innerWidth || 900;
    let x = e.clientX - 24;
    let y = yukseklik - e.clientY - 24;
    x = Math.max(8, Math.min(x, genislik - 44));
    y = Math.max(8, Math.min(y, yukseklik - 70));
    PET_TOP_X = x;
    PET_TOP_Y = y;
    petTopKonumUygula();
    izler.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (izler.length > 8) izler.shift();
    petTopKovala();
  });
  const topBirakildi = () => {
    PET_TOP_SURUKLENIYOR = false;
    let vx = 0, vy = 0, hiz = 0;
    if (izler.length >= 2) {
      const ilk = izler[0];
      const son = izler[izler.length - 1];
      const dt = (son.t - ilk.t) / 1000;
      if (dt > 0.02) {
        vx = (son.x - ilk.x) / dt;
        vy = (son.y - ilk.y) / dt;
        hiz = Math.hypot(vx, vy);
      }
    }
    izler = [];
    if (hiz > 700) {
      // Fırlatma: hızı oynanabilir sınıra ölçekle ve duvarlarda sektir
      const olcek = Math.min(1, 3400 / Math.max(1, hiz));
      PET_TOP_VX = vx * olcek * 0.85;
      PET_TOP_VY = vy * olcek * 0.85;
      PET_TOP_UCUS = true;
      petTopFizikBaslat();
      petKonusma("Top fırladı! 😆");
    } else {
      PET_TOP_UCUS = false;
      PET_TOP_VX = 0;
      PET_TOP_VY = 0;
    }
    if (PET_MODE === "top-oyna") {
      PET_MODE = "dur";
      PET_TOP_ZAMAN = Date.now();
      PET_OTURMA_SURESI = 5000;
      petAnimAyarla("sit-front", true);
    }
  };
  top.addEventListener("pointerup", topBirakildi);
  top.addEventListener("pointercancel", topBirakildi);
}

function petKalpler(adet) {
  const sahne = document.getElementById("petSahne");
  if (!sahne) return;
  const sayac = adet || 6;
  const ikonlar = ["❤", "💖", "💗", "💕"];
  for (let i = 0; i < sayac; i++) {
    const kalp = document.createElement("span");
    kalp.className = "pet-kalp";
    kalp.textContent = ikonlar[i % ikonlar.length];
    kalp.style.left = `${PET_X + 30 + Math.random() * 40}px`;
    kalp.style.bottom = `${PET_Y + 110}px`;
    kalp.style.animationDelay = `${Math.random() * 0.4}s`;
    sahne.appendChild(kalp);
    setTimeout(() => kalp.remove(), 1800);
  }
}

function petXpGoster(metin) {
  const sahne = document.getElementById("petSahne");
  if (!sahne) return;
  const el = document.createElement("div");
  el.className = "pet-xp-uc";
  el.textContent = metin;
  el.style.left = `${PET_X + 20 + Math.random() * 40}px`;
  el.style.bottom = `${PET_Y + 140}px`;
  sahne.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function petKonusma(metin) {
  const el = document.getElementById("petKonusma");
  if (!el) return;
  const simdi = Date.now();
  if (PET_SON_KONUSMA === metin && simdi - PET_SON_KONUSMA_ZAMANI < 2000) return;
  PET_SON_KONUSMA = metin;
  PET_SON_KONUSMA_ZAMANI = simdi;
  el.innerHTML = htmlEsc(metin);
  el.classList.add("gorunur");
  clearTimeout(petKonusmaZamanlayici);
  petKonusmaZamanlayici = setTimeout(() => el.classList.remove("gorunur"), 3500);
}

// ---------- Oynatıcıyı başlat (dosya sonunda; tüm tanımlar hazır olduktan sonra) ----------
try {
  profilPlayerOlustur();
} catch (e) {
  /* oynatıcı sorunu sayfayı bozmasın */
}
setInterval(() => {
  if (GUNCEL_PLAYER && GUNCEL_PLAYER_OYNUYOR) muzikKaydet();
}, 5000);
try {
  petKurulum();
} catch (e) {
  /* pet sorunu sayfayı bozmasın */
}
setInterval(petVeriYukle, 5000);

