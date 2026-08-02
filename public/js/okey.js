// ---------- Okey 101 ----------
let okeySocket = null;
let OKEY_OYUN = null;
let OKEY_SECILI = new Set();
let OKEY_GRUPLAR = [];

const RENK_ISARET = { k: "🔴", m: "🔵", s: "⚫", y: "🟢" };
const RENK_ADI = { k: "kırmızı", m: "mavi", s: "siyah", y: "yeşil" };
const RENK_RENK = { k: "#d33f3f", m: "#2a6fdb", s: "#2b2b33", y: "#1f9d57" };

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
    document.getElementById("okeyKodGoster").style.display = "flex";
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
    document.getElementById("okeyKodGoster").style.display = "flex";
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
    setTimeout(() => { if (el.innerText === m) el.innerText = ""; }, 3000);
  }
}

// ---------- Çizim ----------
function tasRengi(t) {
  return RENK_RENK[t.renk] || "#999";
}

function tasIc(t) {
  if (t.sahte) return `<span class="okey-tas-ic sahte">★</span>`;
  if (t.okey) return `<span class="okey-tas-ic okey-tasi" style="color:${tasRengi(t)}">${t.num}</span>`;
  return `<span class="okey-tas-ic" style="color:${tasRengi(t)}">${t.num}</span>`;
}

function tasKutu(t, ekstra) {
  return `<div class="okey-tas ${ekstra || ""}" style="--tas-renk:${tasRengi(t)}" title="${tasAd(t)}">${tasIc(t)}</div>`;
}

function tasAd(t) {
  if (t.sahte) return "Sahte okey";
  if (t.okey) return `OKEY ${RENK_ADI[t.renk]} ${t.num}`;
  return `${RENK_ADI[t.renk]} ${t.num}`;
}

function oyuncuKartHTML(o, siraMi, kendi) {
  const avatar = o.avatar || "";
  return `
    <div class="okey-oyuncu-kart ${siraMi ? "sira" : ""} ${kendi ? "ben-kart" : ""}">
      ${avatar ? `<img class="okey-avatar" src="${avatar}" alt="" />` : '<span class="okey-avatar">🤖</span>'}
      <div class="okey-oyuncu-bilgi">
        <span class="okey-oyuncu-ad">${kendi ? "Sen" : o.ad}</span>
        <span class="okey-oyuncu-tas">${o.elSayisi} taş${o.acildi ? " · açtı" : ""}</span>
      </div>
      ${siraMi ? '<span class="okey-sira-ok">🎯</span>' : ""}
    </div>
  `;
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

  const okeyTas = { renk: durum.okeyRenk, num: durum.okeyNum, okey: true };
  document.getElementById("okeyOkeyTas").innerHTML = tasIc(okeyTas);
  document.getElementById("okeyOkeyTas").style.setProperty("--tas-renk", RENK_RENK[durum.okeyRenk] || "#999");

  const siraBilgi = document.getElementById("okeySiraBilgi");
  if (siraBilgi) {
    if (durum.durum === "oynaniyor" && durum.tur === benIdx) {
      siraBilgi.innerHTML = durum.cekimGerekli
        ? '<span class="sen">🎯 Sıra sende — çek!</span>'
        : '<span class="sen">🎯 Sıra sende — at!</span>';
    } else {
      const aktif = durum.oyuncular[durum.tur];
      siraBilgi.innerHTML = `${aktif ? aktif.ad : "..."} oynuyor...`;
    }
  }

  document.getElementById("okeyOyuncuUst").innerHTML = oyuncuKartHTML(ust, durum.tur === (benIdx + 2) % 4, false);
  document.getElementById("okeyOyuncuSol").innerHTML = oyuncuKartHTML(sol, durum.tur === (benIdx + 3) % 4, false);
  document.getElementById("okeyOyuncuSag").innerHTML = oyuncuKartHTML(sag, durum.tur === (benIdx + 1) % 4, false);
  document.getElementById("okeyOyuncuBen").innerHTML = oyuncuKartHTML(ben, durum.tur === benIdx, true);

  const desteEl = document.getElementById("okeyDeste");
  desteEl.innerText = `DESTE\n${durum.desteSayisi}`;
  desteEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli);
  desteEl.onclick = (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli) ? okeyDesteCek : null;

  const copEl = document.getElementById("okeyCop");
  copEl.innerHTML = durum.coplerUst ? tasIc(durum.coplerUst) : "—";
  copEl.style.setProperty("--tas-renk", durum.coplerUst ? tasRengi(durum.coplerUst) : "#999");
  copEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst);
  copEl.onclick = (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst) ? okeyCopCek : null;

  const gostEl = document.getElementById("okeyGosterge");
  gostEl.innerHTML = durum.gosterilen ? tasIc(durum.gosterilen) : "—";
  gostEl.style.setProperty("--tas-renk", durum.gosterilen ? tasRengi(durum.gosterilen) : "#999");

  const masaKutu = document.getElementById("okeyMasalar");
  masaKutu.innerHTML = durum.oyuncular
    .map(
      (o) => `
    <div class="okey-masa-satir">
      <span class="okey-masa-ad">${o.ad}${o.acildi ? ' <span style="color:#6fd36f">açtı</span>' : ""}</span>
      <div class="okey-masa-gruplar">${
        o.masa && o.masa.length
          ? o.masa.map((g) => `<span class="okey-grup">${g.map((t) => tasKutu(t, "mini")).join("")}</span>`).join("")
          : '<span style="opacity:0.4">—</span>'
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
      style="--tas-renk:${tasRengi(t)}" data-id="${t.id}" onclick="okeyTasTikla(${t.id})" title="${tasAd(t)}">${tasIc(t)}</div>
  `
    )
    .join("");

  const gruplar = document.getElementById("okeyGruplar");
  gruplar.innerHTML = OKEY_GRUPLAR.length
    ? OKEY_GRUPLAR.map(
        (g) => `<span class="okey-grup">${g
          .map((tid) => {
            const t = (ben.el || []).find((x) => x.id === tid);
            return t ? tasKutu(t, "mini") : "";
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
