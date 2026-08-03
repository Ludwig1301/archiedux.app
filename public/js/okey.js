// ---------- Okey 101 ----------
const OKEY_SLOT_SATIR = 12;
const OKEY_SLOT_TOPLAM = 24;

let okeySocket = null;
let OKEY_OYUN = null;
let OKEY_RAK = new Array(OKEY_SLOT_TOPLAM).fill(null); // slot matrisi: [null, {tas}, null...] — boşluklar korunur
let OKEY_GRUPLAR = []; // [{id, type:'group', tiles:[], slotlar:[], totalSum, tip}]
let SURUKLE = null;
let BEKLENEN_SLOT = null; // çöpten çekilen taşın konacağı slot

const RENK_ADI = { k: "kırmızı", m: "mavi", s: "siyah", y: "yeşil" };
const RENK_SIRA = { k: 0, m: 1, s: 2, y: 3 };
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
    const ben = durum.oyuncular.find((o) => o.ben);
    rakGuncelle(ben);
    okeyRender(durum);
  });
  const kodEl = document.getElementById("okeyOdaKodu");
  if (kodEl) kodEl.addEventListener("keydown", (e) => { if (e.key === "Enter") okeyKatil(); });
  document.addEventListener("pointermove", okeySurukleHareket);
  document.addEventListener("pointerup", okeySurukleBitir);
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
function okeyDesteCek() {
  BEKLENEN_SLOT = OKEY_RAK.findIndex((x) => x === null);
  okeySocket.emit("okey-deste-cek", {}, hataGoster);
}
function okeyCopCek() {
  okeySocket.emit("okey-cop-cek", {}, hataGoster);
}
function okeyTasAt(tileId) { okeySocket.emit("okey-tas-at", { tileId }, hataGoster); }
function okeyAc() {
  const a = grupAnaliz();
  const gruplar = a.ciftGruplar.length >= 5 ? a.ciftGruplar : a.seriGruplar;
  okeySocket.emit("okey-ac", { gruplar }, hataGoster);
}
function okeyIsle() {
  const a = grupAnaliz();
  const tasIds = [...new Set([...a.seriGruplar.flat(), ...a.ciftGruplar.flat()])];
  okeySocket.emit("okey-isle", { tasIds }, hataGoster);
}
function okeyBitir() {
  const a = grupAnaliz();
  okeySocket.emit("okey-bitir", { gruplar: a.seriGruplar }, hataGoster);
}
function okeyYeniden() { location.reload(); }

// ---------- Istaka (slot matrisi) ----------
function rakGuncelle(ben) {
  const eldekiler = new Set((ben ? ben.el : []).map((t) => t.id));
  for (let i = 0; i < OKEY_SLOT_TOPLAM; i++) {
    if (OKEY_RAK[i] && !eldekiler.has(OKEY_RAK[i].id)) OKEY_RAK[i] = null;
  }
  const yeni = (ben ? ben.el : []).filter((t) => !OKEY_RAK.some((s) => s && s.id === t.id));
  for (const t of yeni) {
    let idx = -1;
    if (BEKLENEN_SLOT !== null && !OKEY_RAK[BEKLENEN_SLOT]) {
      idx = BEKLENEN_SLOT;
      BEKLENEN_SLOT = null;
    } else {
      idx = OKEY_RAK.findIndex((x) => x === null);
    }
    if (idx === -1) break;
    OKEY_RAK[idx] = t;
  }
  BEKLENEN_SLOT = null;
  gruplariYenile();
}

// Taşı ıstakada bir slottan başka bir slota taşı (boşluklar korunur)
function okeyRakTasi(tileId, hedefIdx) {
  let kaynak = -1;
  for (let i = 0; i < OKEY_SLOT_TOPLAM; i++) {
    if (OKEY_RAK[i] && OKEY_RAK[i].id === tileId) { kaynak = i; break; }
  }
  if (kaynak === -1 || kaynak === hedefIdx) return;
  const tas = OKEY_RAK[kaynak];
  const hedefTas = OKEY_RAK[hedefIdx];
  OKEY_RAK[kaynak] = hedefTas;
  OKEY_RAK[hedefIdx] = tas;
  gruplariYenile();
  okeyRender(OKEY_OYUN);
}

function okeySiraladiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const taslar = OKEY_RAK.filter((x) => x !== null);
  taslar.sort((a, b) => (RENK_SIRA[a.renk] - RENK_SIRA[b.renk]) || a.num - b.num);
  OKEY_RAK.fill(null);
  taslar.forEach((t, i) => { if (i < OKEY_SLOT_TOPLAM) OKEY_RAK[i] = t; });
  gruplariYenile();
  okeyRender(OKEY_OYUN);
}

function okeyCiftDiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const taslar = OKEY_RAK.filter((x) => x !== null);
  taslar.sort((a, b) => (a.num - b.num) || (RENK_SIRA[a.renk] - RENK_SIRA[b.renk]));
  OKEY_RAK.fill(null);
  taslar.forEach((t, i) => { if (i < OKEY_SLOT_TOPLAM) OKEY_RAK[i] = t; });
  gruplariYenile();
  okeyRender(OKEY_OYUN);
}

// ---------- Gruplama ----------
function tasDegeri(t) {
  return t.sahte || t.okey ? 0 : t.num;
}

function satirMeldleri(satir) {
  const bas = satir * OKEY_SLOT_SATIR;
  const gruplar = [];
  let i = 0;
  while (i < OKEY_SLOT_SATIR) {
    const t0 = OKEY_RAK[bas + i];
    if (!t0) { i++; continue; }
    let perLen = 1;
    for (let k = i + 1; k < OKEY_SLOT_SATIR && OKEY_RAK[bas + k]; k++) {
      const tk = OKEY_RAK[bas + k];
      if (tk.renk === t0.renk && tk.num === t0.num + (k - i)) perLen++;
      else break;
    }
    let setLen = 1;
    for (let k = i + 1; k < OKEY_SLOT_SATIR && OKEY_RAK[bas + k]; k++) {
      if (OKEY_RAK[bas + k].num === t0.num) setLen++;
      else break;
    }
    let ciftLen = 1;
    const yan = OKEY_RAK[bas + i + 1];
    if (yan && yan.renk === t0.renk && yan.num === t0.num) ciftLen = 2;

    let secilen = null;
    if (perLen >= 3) secilen = { len: perLen };
    if (setLen >= 3 && (!secilen || setLen > secilen.len)) secilen = { len: setLen };
    if (!secilen && ciftLen === 2) secilen = { len: 2, cift: true };

    if (secilen) {
      const slotlar = [];
      const tiles = [];
      for (let k = 0; k < secilen.len; k++) {
        slotlar.push(bas + i + k);
        tiles.push(OKEY_RAK[bas + i + k]);
      }
      gruplar.push({
        id: "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: "group",
        tiles,
        slotlar,
        totalSum: tiles.reduce((s, t) => s + tasDegeri(t), 0),
        tip: secilen.cift ? "cift" : "seri",
      });
      i += secilen.len;
    } else {
      i++;
    }
  }
  return gruplar;
}

function gruplariYenile() {
  OKEY_GRUPLAR = satirMeldleri(0).concat(satirMeldleri(1));
}

function okeyGrupDagit(id) {
  OKEY_GRUPLAR = OKEY_GRUPLAR.filter((g) => g.id !== id);
  okeyRender(OKEY_OYUN);
}

function grupAnaliz() {
  const seriGruplar = OKEY_GRUPLAR.filter((g) => g.tip === "seri").map((g) => g.tiles.map((t) => t.id));
  const ciftGruplar = OKEY_GRUPLAR.filter((g) => g.tip === "cift").map((g) => g.tiles.map((t) => t.id));
  return { seriGruplar, ciftGruplar };
}

// ---------- Sürükle-Bırak ----------
function okeySurukleBasla(e, tileId) {
  if (e.button !== 0) return;
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const tile = ben.el.find((t) => t.id === tileId);
  if (!tile) return;
  e.preventDefault();
  const ghost = document.createElement("div");
  ghost.className = "okey-tas okey-tas-hayalet";
  ghost.style.setProperty("--tas-renk", tasRengi(tile));
  ghost.innerHTML = tasIc(tile);
  ghost.style.left = e.clientX - 22 + "px";
  ghost.style.top = e.clientY - 30 + "px";
  document.body.appendChild(ghost);
  SURUKLE = { tileId, kaynak: "rak", ghost };
  const kaynak = document.querySelector(`.okey-rak-hucre .okey-tas[data-id="${tileId}"], .group-wrapper .okey-tas[data-id="${tileId}"]`);
  if (kaynak) kaynak.style.opacity = "0.25";
}

// Sol drop zone'daki (çöp) taşı sürükleme — ıstakadaki boş slota bırakınca çeker
function okeyCopSurukleBasla(e) {
  if (e.button !== 0) return;
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const benIdx = OKEY_OYUN.oyuncular.findIndex((o) => o.ben);
  if (OKEY_OYUN.durum !== "oynaniyor" || OKEY_OYUN.tur !== benIdx || !OKEY_OYUN.cekimGerekli || !OKEY_OYUN.coplerUst) return;
  e.preventDefault();
  const tile = OKEY_OYUN.coplerUst;
  const ghost = document.createElement("div");
  ghost.className = "okey-tas okey-tas-hayalet";
  ghost.style.setProperty("--tas-renk", tasRengi(tile));
  ghost.innerHTML = tasIc(tile);
  ghost.style.left = e.clientX - 22 + "px";
  ghost.style.top = e.clientY - 30 + "px";
  document.body.appendChild(ghost);
  SURUKLE = { tileId: null, kaynak: "cop", ghost };
}

function okeySurukleHareket(e) {
  if (!SURUKLE) return;
  SURUKLE.ghost.style.left = e.clientX - 22 + "px";
  SURUKLE.ghost.style.top = e.clientY - 30 + "px";
  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const hucre = alt && alt.closest(".okey-rak-hucre");
  document.querySelectorAll("#okeyAtisBolge.hedef").forEach((el) => el.classList.remove("hedef"));
  if (atis) atis.classList.add("hedef");
  if (hucre) hucre.classList.add("hedef");
}

function okeySurukleBitir(e) {
  if (!SURUKLE) return;
  const { tileId, kaynak, ghost } = SURUKLE;
  SURUKLE = null;
  if (ghost) ghost.remove();
  const kaynakEl = document.querySelector(`.okey-rak-hucre .okey-tas[data-id="${tileId}"], .group-wrapper .okey-tas[data-id="${tileId}"]`);
  if (kaynakEl) kaynakEl.style.opacity = "";
  document.querySelectorAll(".okey-rak-hucre.hedef").forEach((el) => el.classList.remove("hedef"));
  document.querySelectorAll("#okeyAtisBolge.hedef").forEach((el) => el.classList.remove("hedef"));

  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const hucre = alt && alt.closest(".okey-rak-hucre");

  if (kaynak === "cop") {
    if (hucre) {
      BEKLENEN_SLOT = parseInt(hucre.dataset.hucre, 10);
      okeyCopCek();
    }
    return;
  }

  if (atis) {
    okeyTasAt(tileId);
  } else if (hucre) {
    okeyRakTasi(tileId, parseInt(hucre.dataset.hucre, 10));
  }
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
  if (t.okey) return `<span class="okey-tas-ic okey-tasi okey-tas-okeytasi" style="color:${tasRengi(t)}">${t.num}</span>`;
  return `<span class="okey-tas-ic" style="color:${tasRengi(t)}">${t.num}</span>`;
}

function tasDrag(t, benimSira) {
  return `<div class="okey-tas ${benimSira ? "tiklanabilir" : ""}" data-id="${t.id}"
    onpointerdown="okeySurukleBasla(event, ${t.id})" title="${tasAd(t)}"
    style="--tas-renk:${tasRengi(t)}">${tasIc(t)}</div>`;
}

function tasKutu(t, ekstra) {
  return `<div class="okey-tas ${ekstra || ""}" style="--tas-renk:${tasRengi(t)}" title="${tasAd(t)}">${tasIc(t)}</div>`;
}

function tasAd(t) {
  if (t.sahte) return "Sahte okey";
  if (t.okey) return `OKEY ${RENK_ADI[t.renk]} ${t.num}`;
  return `${RENK_ADI[t.renk]} ${t.num}`;
}

function oyuncuKartHTML(o, siraMi) {
  const avatar = o.avatar || "";
  const atilan = (o.atilan || []).slice(-8);
  const etiket = o.acildi ? (o.acilisTipi === "cift" ? '<span class="okey-acildi">çift açtı</span>' : '<span class="okey-acildi">açtı</span>') : "";
  return `
    <div class="okey-seat">
      <div class="okey-oyuncu-kart ${siraMi ? "sira" : ""}">
        ${avatar ? `<img class="okey-avatar" src="${avatar}" alt="" />` : '<span class="okey-avatar">🤖</span>'}
        <span class="okey-oyuncu-tas"><span>${o.elSayisi}</span> taş</span>
        ${siraMi ? '<span class="okey-sira-ok">🎯</span>' : ""}
      </div>
      ${etiket}
      <div class="okey-seat-cop" title="Attığı taşlar">
        ${atilan.length ? atilan.map((t) => tasKutu(t, "mini")).join("") : '<span class="okey-seat-cop-bos">·</span>'}
      </div>
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
  try {
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
        siraBilgi.innerHTML = '<span class="sen">Rakip oynuyor...</span>';
      }
    }

    document.getElementById("okeyOyuncuUst").innerHTML = oyuncuKartHTML(ust, durum.tur === (benIdx + 2) % 4);
    document.getElementById("okeyOyuncuSol").innerHTML = oyuncuKartHTML(sol, durum.tur === (benIdx + 3) % 4);
    document.getElementById("okeyOyuncuSag").innerHTML = oyuncuKartHTML(sag, durum.tur === (benIdx + 1) % 4);

    const desteEl = document.getElementById("okeyDeste");
    desteEl.innerHTML = `DESTE<br/>${durum.desteSayisi}`;
    desteEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli);
    desteEl.onclick = (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli) ? okeyDesteCek : null;

    const gostEl = document.getElementById("okeyGosterge");
    gostEl.innerHTML = durum.gosterilen ? tasIc(durum.gosterilen) : "—";
    gostEl.style.setProperty("--tas-renk", durum.gosterilen ? tasRengi(durum.gosterilen) : "#999");

    // Sol drop zone: ortadaki taş (çöp) — sürükleyip ıstaka boş slotuna bırakınca çekilir
    const copEl = document.getElementById("okeyCop");
    if (durum.coplerUst) {
      copEl.innerHTML = `<div class="okey-tas tiklanabilir" style="--tas-renk:${tasRengi(durum.coplerUst)}"
        onpointerdown="okeyCopSurukleBasla(event)" title="Istakana sürükle (çöpten al)">${tasIc(durum.coplerUst)}</div>`;
    } else {
      copEl.innerHTML = '<span style="opacity:0.4">—</span>';
    }
    copEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst);

    // Sağ drop zone: taş atma — ıstakadan buraya sürükle
    const atisEl = document.getElementById("okeyAtis");
    atisEl.innerHTML = durum.coplerUst ? tasKutu(durum.coplerUst, "mini") : "📤";

    const masaKutu = document.getElementById("okeyMasalar");
    masaKutu.innerHTML = durum.oyuncular
      .map(
        (o) => `
    <div class="okey-masa-satir">
      ${o.avatar ? `<img class="okey-avatar kucuk" src="${o.avatar}" alt="" />` : '<span class="okey-avatar kucuk">🤖</span>'}
      ${o.acildi ? (o.acilisTipi === "cift" ? '<span style="color:#6fd36f">çift açtı</span>' : '<span style="color:#6fd36f">açtı</span>') : ""}
      <div class="okey-masa-gruplar">${
        o.masa && o.masa.length
          ? o.masa.map((g) => `<span class="okey-grup">${g.map((t) => tasKutu(t, "mini")).join("")}</span>`).join("")
          : '<span style="opacity:0.4">—</span>'
      }</div>
    </div>
  `
      )
      .join("");

    // Istaka: slot matrisi render (grup kapsayıcılar dahil)
    const benimSira = durum.durum === "oynaniyor" && durum.tur === benIdx;
    gruplariYenile();
    const grupHaritasi = {};
    for (const g of OKEY_GRUPLAR) for (const s of g.slotlar) grupHaritasi[s] = g;

    const kutu = document.getElementById("okeyEl");
    let html = "";
    let i = 0;
    while (i < OKEY_SLOT_TOPLAM) {
      const satir = Math.floor(i / OKEY_SLOT_SATIR);
      const sutun = i % OKEY_SLOT_SATIR;
      const g = grupHaritasi[i];
      if (g && g.slotlar[0] === i) {
        const genislik = g.slotlar.length;
        html += `<div class="group-wrapper ${g.tip === "cift" ? "cift" : "seri"}"
          style="grid-column:${sutun + 1} / span ${genislik}; grid-row:${satir + 1};">
          ${g.tiles.map((t) => tasDrag(t, benimSira)).join("")}
          <div class="group-info-bar">
            <span class="group-sum">toplam ${g.totalSum}</span>
            <button class="group-ungroup" onclick="okeyGrupDagit('${g.id}')" title="Grubu dağıt">×</button>
          </div>
        </div>`;
        i += genislik;
      } else if (!g && OKEY_RAK[i]) {
        html += `<div class="okey-rak-hucre" data-hucre="${i}">${tasDrag(OKEY_RAK[i], benimSira)}</div>`;
        i++;
      } else {
        html += `<div class="okey-rak-hucre" data-hucre="${i}"></div>`;
        i++;
      }
    }
    kutu.innerHTML = html;
  } catch (e) {
    console.error("Okey render hatası:", e);
  }
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
      <span class="okey-sonuc-puan">${s.puan !== undefined ? s.puan + " puan" : ""}</span>
      <span class="okey-sonuc-xp">+${s.kazanilan} XP</span>
    </div>
  `
    )
    .join("");
}
