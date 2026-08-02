// ---------- Okey 101 ----------
let okeySocket = null;
let OKEY_OYUN = null;
let OKEY_SECILI = new Set();
let OKEY_GRUPLAR = [];

const RENK_ISARET = { k: "🔴", m: "🔵", s: "⚫", y: "🟢" };
const RENK_ADI = { k: "kırmızı", m: "mavi", s: "siyah", y: "yeşil" };
const RENK_RENK = { k: "#e05a5a", m: "#5a8ae0", s: "#d6d6de", y: "#6fd36f" };

function okeySayfasiBaslat() {
  navBarDoldur();
  liderlikYukle();
  okeySocket = io();
  okeySocket.on("connect_error", () => {
    document.getElementById("okeyDurum").innerText = "Okey oynamak için giriş yapmalısın.";
  });
  okeySocket.on("okey-guncelle", (durum) => {
    OKEY_OYUN = durum;
    OKEY_SECILI.clear();
    OKEY_GRUPLAR = [];
    okeyRender(durum);
  });
  const kodEl = document.getElementById("okeyOdaKodu");
  if (kodEl) kodEl.addEventListener("keydown", (e) => { if (e.key === "Enter") okeyKatil(); });
}

async function liderlikYukle() {
  try {
    const res = await fetch("/api/okey/leaderboard");
    const liste = await res.json();
    const kutu = document.getElementById("okeyLiderlik");
    if (!liste.length) {
      kutu.innerHTML = '<span class="bos-hint">Henüz oyun oynanmadı — ilk ol!</span>';
      return;
    }
    kutu.innerHTML = liste
      .map(
        (u, i) => `
      <div class="okey-lider-satir">
        <span class="okey-lider-sira">${i + 1}</span>
        <img src="${u.avatar}" class="okey-lider-avatar" alt="" />
        <span class="okey-lider-ad">${u.ad}</span>
        <span class="okey-lider-stats">🏆${u.bir} 🥈${u.iki} 🥉${u.uc} · ${u.oyun} oyun</span>
      </div>
    `
      )
      .join("");
  } catch (e) {
    /* yoksay */
  }
}

// ---------- Aksiyonlar ----------
function okeyOlustur() {
  okeySocket.emit("okey-olustur", {}, (cevap) => {
    if (cevap && cevap.hata) return mesajGoster(cevap.hata);
    document.getElementById("okeyKodGoster").style.display = "block";
    document.getElementById("okeyKod").innerText = cevap.kod;
    document.getElementById("okeyDurum").innerText = "";
  });
}

function okeyKatil() {
  const kod = document.getElementById("okeyOdaKodu").value.trim().toUpperCase();
  if (!kod) return;
  okeySocket.emit("okey-katil", { kod }, (cevap) => {
    if (cevap && cevap.hata) {
      document.getElementById("okeyDurum").innerText = cevap.hata;
      return;
    }
    document.getElementById("okeyDurum").innerText = "";
    document.getElementById("okeyKodGoster").style.display = "block";
    document.getElementById("okeyKod").innerText = cevap.kod;
  });
}

function okeyBotEkle() {
  okeySocket.emit("okey-bot-ekle", {}, (cevap) => {
    if (cevap && cevap.hata) mesajGoster(cevap.hata);
  });
}

function okeyCik() {
  okeySocket.emit("okey-cik");
  location.reload();
}
function okeyDesteCek() { okeySocket.emit("okey-deste-cek", {}, hataGoster); }
function okeyCopCek() { okeySocket.emit("okey-cop-cek", {}, hataGoster); }
function okeyTasAt(tileId) { okeySocket.emit("okey-tas-at", { tileId }, hataGoster); }
function okeyAc() { okeySocket.emit("okey-ac", { gruplar: OKEY_GRUPLAR }, hataGoster); }
function okeyBitir() { okeySocket.emit("okey-bitir", { gruplar: OKEY_GRUPLAR }, hataGoster); }
function okeyYeniden() { location.reload(); }

function okeyGrupEkle() {
  if (OKEY_SECILI.size === 0) return;
  OKEY_GRUPLAR.push([...OKEY_SECILI]);
  OKEY_SECILI.clear();
  okeyRender(OKEY_OYUN);
}
function okeyGrupGeri() {
  OKEY_GRUPLAR.pop();
  okeyRender(OKEY_OYUN);
}

function okeyTasTikla(tileId) {
  const grupta = new Set(OKEY_GRUPLAR.flat());
  if (grupta.has(tileId)) return;
  if (OKEY_SECILI.has(tileId)) OKEY_SECILI.delete(tileId);
  else OKEY_SECILI.add(tileId);
  okeyRender(OKEY_OYUN);
}

function hataGoster(cevap) {
  if (cevap && cevap.hata) mesajGoster(cevap.hata);
}
function mesajGoster(m) {
  const el = document.getElementById("okeyMesaj");
  if (el) {
    el.innerText = m;
    setTimeout(() => { if (el.innerText === m) el.innerText = ""; }, 2500);
  }
}

// ---------- Çizim ----------
function tasHTML(t) {
  if (t.sahte) return `<span class="okey-tas-ic sahte">★</span>`;
  if (t.okey) return `<span class="okey-tas-ic okey-tasi" style="color:${RENK_RENK[t.renk]}">${t.num}</span>`;
  return `<span class="okey-tas-ic" style="color:${RENK_RENK[t.renk]}">${RENK_ISARET[t.renk]} ${t.num}</span>`;
}

function tasAd(t) {
  if (t.sahte) return "Sahte okey";
  if (t.okey) return `OKEY ${RENK_ADI[t.renk]} ${t.num}`;
  return `${RENK_ADI[t.renk]} ${t.num}`;
}

function okeyRender(durum) {
  const lobi = document.getElementById("okeyLobi");
  const oyun = document.getElementById("okeyOyun");
  const sonuc = document.getElementById("okeySonuc");

  if (durum.durum === "bitti") {
    lobi.style.display = "none";
    oyun.style.display = "none";
    sonuc.style.display = "block";
    okeySonucCiz(durum);
    liderlikYukle();
    return;
  }
  if (durum.durum === "bekliyor") {
    lobi.style.display = "block";
    oyun.style.display = "none";
    sonuc.style.display = "none";
    const d = document.getElementById("okeyDurum");
    if (d) {
      d.innerText = "Odada: " + durum.oyuncular.map((o) => o.ad).join(", ") +
        (durum.oyuncular.length < 4 ? ` (${durum.oyuncular.length}/4) — 4 kişi olunca başlar` : " — başlıyor...");
    }
    return;
  }
  lobi.style.display = "none";
  sonuc.style.display = "none";
  oyun.style.display = "block";
  okeyTahtaCiz(durum);
}

function okeyTahtaCiz(durum) {
  const benIdx = durum.oyuncular.findIndex((o) => o.ben);
  if (benIdx === -1) return;
  const ben = durum.oyuncular[benIdx];
  const sag = durum.oyuncular[(benIdx + 1) % 4];
  const ust = durum.oyuncular[(benIdx + 2) % 4];
  const sol = durum.oyuncular[(benIdx + 3) % 4];

  document.getElementById("okeyGosterge").innerHTML = durum.gosterilen
    ? "Gösterge: " + tasHTML(durum.gosterilen)
    : "";
  document.getElementById("okeyBilgi").innerHTML =
    `Okey: <strong>${RENK_ISARET[durum.okeyRenk]} ${durum.okeyNum}</strong>` +
    (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli
      ? ' <span class="okey-sira-sen">· Sıra sende: çek</span>'
      : "");

  document.getElementById("okeyRakipUst").innerHTML =
    `🔼 ${ust.ad} <span class="okey-tas-sayisi">${ust.elSayisi}</span>${ust.acildi ? ' <span class="okey-acildi">açtı</span>' : ""}`;
  document.getElementById("okeyRakipSol").innerHTML =
    `◀ ${sol.ad} <span class="okey-tas-sayisi">${sol.elSayisi}</span>`;
  document.getElementById("okeyRakipSag").innerHTML =
    `${sag.ad} <span class="okey-tas-sayisi">${sag.elSayisi}</span> ▶`;

  const desteEl = document.getElementById("okeyDeste");
  desteEl.innerText = `DESTE (${durum.desteSayisi})`;
  desteEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli);
  desteEl.onclick = (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli) ? okeyDesteCek : null;

  const copEl = document.getElementById("okeyCop");
  copEl.innerHTML = durum.coplerUst ? tasHTML(durum.coplerUst) : "—";
  copEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst);
  copEl.onclick = (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst) ? okeyCopCek : null;

  const masaKutu = document.getElementById("okeyMasalar");
  masaKutu.innerHTML = durum.oyuncular
    .map(
      (o) => `
    <div class="okey-masa-satir">
      <span class="okey-masa-ad">${o.ad}${o.acildi ? ' <span class="okey-acildi">açtı</span>' : ""}</span>
      <div class="okey-masa-gruplar">${
        o.masa && o.masa.length
          ? o.masa.map((g) => `<span class="okey-grup">${g.map(tasHTML).join("")}</span>`).join("")
          : '<span class="okey-masa-bos">—</span>'
      }</div>
    </div>
  `
    )
    .join("");

  const cekBtn = document.getElementById("okeyCekBtn");
  const copCekBtn = document.getElementById("okeyCopCekBtn");
  const benimSira = durum.durum === "oynaniyor" && durum.tur === benIdx;
  cekBtn.style.display = benimSira && durum.cekimGerekli && durum.desteSayisi > 0 ? "inline-flex" : "none";
  copCekBtn.style.display = benimSira && durum.cekimGerekli && durum.coplerUst ? "inline-flex" : "none";

  const el = document.getElementById("okeyEl");
  const grupta = new Set(OKEY_GRUPLAR.flat());
  const siraliEl = [...(ben.el || [])].sort(
    (a, b) => (a.renk || "").localeCompare(b.renk || "") || a.num - b.num
  );
  el.innerHTML = siraliEl
    .map(
      (t) => `
    <div class="okey-tas ${OKEY_SECILI.has(t.id) ? "secili" : ""} ${grupta.has(t.id) ? "grupta" : ""} ${benimSira ? "tiklanabilir" : ""}"
      data-id="${t.id}" onclick="okeyTasTikla(${t.id})" title="${tasAd(t)}">${tasHTML(t)}</div>
  `
    )
    .join("");

  const gruplar = document.getElementById("okeyGruplar");
  gruplar.innerHTML = OKEY_GRUPLAR.length
    ? OKEY_GRUPLAR.map(
        (g) => `<span class="okey-grup">${g
          .map((tid) => {
            const t = (ben.el || []).find((x) => x.id === tid);
            return t ? tasHTML(t) : "";
          })
          .join("")}</span>`
      ).join("")
    : "";
}

function okeySonucCiz(durum) {
  document.getElementById("okeySonucBaslik").innerText =
    durum.kazanan ? "Oyun Bitti 🎉" : "Oyun Bitti";
  document.getElementById("okeySonucListe").innerHTML = (durum.sonuc || [])
    .sort((a, b) => a.derece - b.derece)
    .map(
      (s) => `
    <div class="okey-sonuc-satir derece-${s.derece}">
      <span class="okey-sonuc-derece">${s.derece}.</span>
      <span class="okey-sonuc-ad">${s.ad}</span>
      <span class="okey-sonuc-xp">+${s.kazanilan} XP</span>
    </div>
  `
    )
    .join("");
}
