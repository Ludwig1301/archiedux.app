// ---------- Navbar: giriş durumuna göre sağ üstü doldur ----------
async function navBarDoldur() {
  const navSag = document.getElementById("navSag");
  if (!navSag) return;

  const res = await fetch("/api/me");
  const veri = await res.json();

  if (veri.girisYapti) {
    navSag.innerHTML = `
      <a href="profile.html?id=${veri.id}">${veri.kullaniciAdi}</a>
      <a href="/auth/logout" class="cikis-link">Çıkış</a>
    `;
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

// ---------- Spotify (Lanyard) - herhangi bir Discord ID için ----------
async function spotifyYukle(discordId) {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
    const json = await res.json();
    const veri = json.data;

    const kutu = document.getElementById("spotifyKutusu");
    if (!kutu) return;

    if (veri && veri.listening_to_spotify) {
      kutu.style.display = "block";
      document.getElementById("spotifyResim").src = veri.spotify.album_art_url;
      document.getElementById("spotifySarki").innerText = veri.spotify.song;
      document.getElementById("spotifySanatci").innerText = veri.spotify.artist;
    } else {
      kutu.style.display = "none";
    }
  } catch (e) {
    console.warn("Lanyard verisi alınamadı (kullanıcı Lanyard'a kayıtlı olmayabilir):", e);
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

// ---------- Profil sayfası ----------
let GORUNTULENEN_ID = null;
let BENIM_ID = null;
let DISCORD_AVATAR = "";
let GUNCEL_PROFIL_FOTO = "";
let GUNCEL_HAYVAN_RESMI = "";
let cropper = null;

function urlIdOku() {
  return new URLSearchParams(window.location.search).get("id");
}

async function profilSayfasiBaslat() {
  const ben = await navBarDoldur();
  BENIM_ID = ben && ben.girisYapti ? ben.id : null;

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

  const res = await fetch(`/api/profile/${GORUNTULENEN_ID}`);
  if (!res.ok) {
    document.getElementById("yukleniyorAlani").innerHTML = `
      <div class="giris-uyari">
        <svg class="seal" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#8b2222" stroke-width="1.6"/>
          <circle cx="24" cy="24" r="17" stroke="#8b2222" stroke-width="1" opacity="0.6"/>
          <path d="M24 12 L27 20 L35 20 L28.5 25 L31 33 L24 28 L17 33 L19.5 25 L13 20 L21 20 Z" fill="#8b2222"/>
        </svg>
        <h2>Üye Bulunamadı</h2>
        <p>Bu üye sunucuda değil ya da artık sunucuda bulunmuyor.</p>
        <a href="members.html" class="discord-giris-btn buyuk">Üye Listesine Git</a>
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
  document.getElementById("pUnvan").innerText = veri.profil.unvan || "Ünvan belirtilmemiş";
  document.getElementById("pBio").innerText =
    veri.profil.bio || "Bu kişi henüz kendini tanıtmamış.";

  gorunumUygula(
    document.getElementById("profilAlani"),
    document.getElementById("pKapak"),
    veri.profil
  );

  if (veri.profil.vitrinBaslik) {
    document.getElementById("pVitrin").innerHTML = `
      ${veri.profil.vitrinResim ? `<img src="${veri.profil.vitrinResim}" class="proje" />` : ""}
      <div class="proje-detay">
        <h3>${veri.profil.vitrinBaslik}</h3>
        <p>${veri.profil.vitrinAciklama || ""}</p>
      </div>
    `;
  }

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
    galeriLink.href = `gallery.html?id=${GORUNTULENEN_ID}`;
  }

  // sadece kendi profiliyse düzenle butonu ve yorum formu görünsün
  if (BENIM_ID === GORUNTULENEN_ID) {
    document.getElementById("duzenleBtn").style.display = "inline-block";
    document.getElementById("kapakDegistirBtn").style.display = "flex";
  }
  if (BENIM_ID) {
    document.getElementById("yorumFormAlani").style.display = "flex";
  }
  // "Sevimli Dost" butonu yalnızca profil sahibine gösterilir
  const hayvanBtn = document.getElementById("hayvanBtn");
  if (hayvanBtn) {
    hayvanBtn.style.display = BENIM_ID === GORUNTULENEN_ID ? "flex" : "none";
  }

  yorumlariCiz(veri.profil.yorumlar || []);
  spotifyYukle(GORUNTULENEN_ID);

  // düzenleme formunu mevcut verilerle önceden doldur
  document.getElementById("formUnvan").value = veri.profil.unvan || "";
  document.getElementById("formBio").value = veri.profil.bio || "";
  document.getElementById("formVitrinBaslik").value = veri.profil.vitrinBaslik || "";
  document.getElementById("formVitrinAciklama").value = veri.profil.vitrinAciklama || "";
  document.getElementById("formVitrinResim").value = veri.profil.vitrinResim || "";
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

  onizlemeElGuncelle("onizlemeVitrin", veri.profil.vitrinResim);
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

function yorumlariCiz(yorumlar) {
  const kutu = document.getElementById("yorumListesi");
  if (!kutu) return;
  if (yorumlar.length === 0) {
    kutu.innerHTML = '<span class="bos-hint">Henüz yorum yok.</span>';
    return;
  }
  kutu.innerHTML = yorumlar
    .map(
      (y) => `
      <div class="yorum">
        <img src="${y.yazanAvatar}" class="yorum-avatar" />
        <div>
          <div class="yorum-yazar">${y.yazanAd}</div>
          <div class="yorum-metin">${y.metin}</div>
        </div>
      </div>
    `
    )
    .join("");
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

  const veri = await res.json();
  document.getElementById("yorumMetni").value = "";
  yorumlariCiz(veri.yorumlar);
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
    vitrinBaslik: document.getElementById("formVitrinBaslik").value,
    vitrinAciklama: document.getElementById("formVitrinAciklama").value,
    vitrinResim: document.getElementById("formVitrinResim").value,
    kapakFoto: document.getElementById("formKapakFoto").value,
    aksanRenk: document.getElementById("formAksanRenk").value,
    arkaplanTuru: document.getElementById("formArkaplanTuru").value,
    arkaplanResim: document.getElementById("formArkaplanResim").value,
    arkaplanRenk1: document.getElementById("formArkaplanRenk1").value,
    arkaplanRenk2: document.getElementById("formArkaplanRenk2").value,
    arkaplanBlur: document.getElementById("formArkaplanBlur").value,
  };
}

// Formdaki mevcut değerleri doğrudan profil görünümüne yansıtır.
function profilCanliGuncelle(veri) {
  document.getElementById("pUnvan").innerText = veri.unvan || "Ünvan belirtilmemiş";
  document.getElementById("pBio").innerText =
    veri.bio || "Bu kişi henüz kendini tanıtmamış.";

  const vitrin = document.getElementById("pVitrin");
  if (veri.vitrinBaslik) {
    vitrin.innerHTML = `
      ${veri.vitrinResim ? `<img src="${veri.vitrinResim}" class="proje" />` : ""}
      <div class="proje-detay">
        <h3>${veri.vitrinBaslik}</h3>
        <p>${veri.vitrinAciklama || ""}</p>
      </div>
    `;
  } else {
    vitrin.innerHTML = '<span class="bos-hint">Henüz bir proje eklenmemiş.</span>';
  }

  const hayvanResim = veri.hayvanResmi || GUNCEL_HAYVAN_RESMI || "";
  const hayvanResimEl = document.getElementById("pHayvanResmi");
  if (hayvanResimEl) {
    hayvanResimEl.src = hayvanResim;
    hayvanResimEl.style.display = hayvanResim ? "block" : "none";
  }
  const hayvanBosHint = document.getElementById("hayvanBosHint");
  if (hayvanBosHint) hayvanBosHint.style.display = hayvanResim ? "none" : "block";

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
      if (durum) {
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
  if (BENIM_ID !== GORUNTULENEN_ID) return;
  if (!document.getElementById("formUnvan")) return;
  profilOtomatikKaydet();
}

// Form elemanlarına canlı kayıt dinleyicileri bağlar.
function canliKayitDinleyicileriEkle() {
  if (BENIM_ID !== GORUNTULENEN_ID) return;
  const dinlenecekler = [
    "formUnvan", "formBio",
    "formVitrinBaslik", "formVitrinAciklama", "formVitrinResim",
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

function profilFotoSecildi(dosya) {
  cropAc(dosya, "profil");
}

function arkaplanFotoSecildi(dosya) {
  cropAc(dosya, "arkaplan");
}

function kapakFotoSecildi(dosya) {
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
        body: JSON.stringify({ avatar: url }),
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
      body: JSON.stringify({ avatar: "" }),
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
function hayvanFotoSec() {
  if (BENIM_ID !== GORUNTULENEN_ID) return;
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
      body: JSON.stringify({ hayvanResmi: url }),
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
    if (durumEl) {
      durumEl.innerText = "Eklendi ✓";
      setTimeout(() => { if (durumEl.innerText === "Eklendi ✓") durumEl.innerText = ""; }, 2000);
    }
  } catch (e) {
    if (durumEl) durumEl.innerText = "";
    alert(e.message || "Görsel yüklenirken bir hata oluştu.");
  }
}

function galeriListesiCiz(entries) {
  const kutu = document.getElementById("galleryContent");
  if (!kutu) return;

  const allowEdit = BENIM_ID === GORUNTULENEN_ID;
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
          <div class="gallery-card-media">
            <img src="${entry.imageUrl}" alt="${entry.description || "Galeri fotoğrafı"}" />
            ${allowEdit ? `<button type="button" class="gallery-card-delete" title="Sil" onclick="galeriSil('${entry.id}', '${entry.imageUrl}')">×</button>` : ""}
          </div>
          <div class="gallery-card-body">
            <p>${entry.description || "Açıklama yok."}</p>
          </div>
        </div>
      `
    )
    .join("");
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
  const backEl = document.getElementById("galleryBack");
  if (backEl) backEl.href = `profile.html?id=${GORUNTULENEN_ID}`;
  const allowEdit = BENIM_ID === GORUNTULENEN_ID;
  if (formEl) formEl.style.display = allowEdit ? "flex" : "none";
  if (formHintEl) {
    formHintEl.innerText = allowEdit
      ? "Bir görsel seç, yanına açıklamasını yaz ve ekle."
      : "Bu galeriye sadece profil sahibi görsel ekleyebilir.";
  }
  if (statusEl) statusEl.innerText = "";

  galeriListesiCiz(veri.profil.galleryEntries || []);
}

// ---------- Üye listesi sayfası ----------
async function uyeListesiYukle() {
  const grid = document.getElementById("uyelerGrid");
  if (!grid) return;

  const res = await fetch("/api/members");
  const uyeler = await res.json();

  if (uyeler.length === 0) {
    grid.innerHTML = '<span class="bos-hint">Henüz hiç kimse giriş yapmadı.</span>';
    return;
  }

  grid.innerHTML = uyeler
    .map(
      (u) => `
    <a href="profile.html?id=${u.id}" class="uye-kart">
      <img src="${u.avatar}" />
      <div class="uye-ad">${u.kullaniciAdi}</div>
    </a>
  `
    )
    .join("");
}
