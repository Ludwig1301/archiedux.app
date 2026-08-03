// ---------- Okey 101 ----------
const OKEY_SLOT_SATIR = 20;
const OKEY_SLOT_TOPLAM = 40;

let okeySocket = null;
let OKEY_OYUN = null;
let OKEY_RAK = new Array(OKEY_SLOT_TOPLAM).fill(null); // slot matrisi: [null, {tas}, null...] — boşluklar korunur
let OKEY_GRUPLAR = []; // [{id, type:'group', tiles:[], slotlar:[], totalSum, tip}]
const OKEY_GRUPLAMA_ENGELI = new Set();
let SURUKLE = null;
let BEKLENEN_SLOT = null; // çöpten çekilen taşın konacağı slot
let playerSelfDiscard = [];
let playerLeftDiscard = [];
let playerTopDiscard = [];
let playerRightDiscard = [];

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

  // İlk dağıtımda 21/22 taşı iki satıra dengeli yerleştir; sonrasında boşlukları koru.
  const ilkDagitim = OKEY_RAK.every((slot) => slot === null) && yeni.length > 0;
  if (ilkDagitim) {
    const altAdet = Math.ceil(yeni.length / 2);
    const ustAdet = yeni.length - altAdet;
    const altBas = Math.floor((OKEY_SLOT_SATIR - altAdet) / 2);
    const ustBas = Math.floor((OKEY_SLOT_SATIR - ustAdet) / 2);
    yeni.forEach((tas, i) => {
      const ust = i >= altAdet;
      const sutun = (ust ? ustBas + i - altAdet : altBas + i);
      OKEY_RAK[(ust ? OKEY_SLOT_SATIR : 0) + sutun] = tas;
    });
    BEKLENEN_SLOT = null;
    gruplariYenile();
    return;
  }

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
  const mevcut = new Set((ben ? ben.el : []).map((t) => t.id));
  OKEY_GRUPLAR = OKEY_GRUPLAR.filter((g) => g.tiles.every((t) => mevcut.has(t.id)));
}

// Taşı ıstakada bir slottan başka bir slota taşı (boşluklar korunur)
function okeyRakTasi(tileId, hedefIdx) {
  let kaynak = -1;
  for (let i = 0; i < OKEY_SLOT_TOPLAM; i++) {
    if (OKEY_RAK[i] && OKEY_RAK[i].id === tileId) { kaynak = i; break; }
  }
  if (kaynak === -1 || kaynak === hedefIdx) return;
  if (OKEY_RAK[hedefIdx]) return;
  const tas = OKEY_RAK[kaynak];
  const grup = OKEY_GRUPLAR.find((g) => g.tiles.some((t) => t.id === tileId));
  if (grup) OKEY_GRUPLAR = OKEY_GRUPLAR.filter((g) => g.id !== grup.id);
  OKEY_RAK[kaynak] = null;
  OKEY_RAK[hedefIdx] = tas;
  OKEY_GRUPLAMA_ENGELI.delete(tileId);
  okeyRender(OKEY_OYUN);
}

function okeySiraladiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const taslar = OKEY_RAK.filter((x) => x !== null);
  const { groups, remaining } = seriGruplariBul(taslar);
  dizimleriIstakayaYerlestir(groups, remaining);
  okeyRender(OKEY_OYUN);
}

function okeyCiftDiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const taslar = OKEY_RAK.filter((x) => x !== null);
  const { groups, remaining } = ciftGruplariBul(taslar);
  dizimleriIstakayaYerlestir(groups, remaining);
  okeyRender(OKEY_OYUN);
}

// ---------- Gruplama ----------
function tasDegeri(t) {
  return t.sahte || t.okey ? 0 : t.num;
}

function otomatikGruplamaTasMi(t) {
  return !!t && !t.okey && !t.sahte && Number.isInteger(t.num) && t.num >= 1 && t.num <= 13;
}

function yeniGrup(tiles, slotlar, tip) {
  return {
    id: "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: "group",
    tiles,
    slotlar,
    totalSum: tiles.reduce((s, t) => s + tasDegeri(t), 0),
    tip,
  };
}

function seriGruplariBul(taslar) {
  const adaylar = [];
  const renkGruplari = {};
  taslar.filter(otomatikGruplamaTasMi).forEach((t) => {
    (renkGruplari[t.renk] ||= {})[t.num] ||= [];
    renkGruplari[t.renk][t.num].push(t);
  });

  for (const [renk, sayilar] of Object.entries(renkGruplari)) {
    const nums = Object.keys(sayilar).map(Number).sort((a, b) => a - b);
    let run = [];
    const ekle = () => {
      if (run.length >= 3) adaylar.push({ tiles: run.flatMap((n) => sayilar[n].slice(0, 1)), oncelik: 0 });
      run = [];
    };
    nums.forEach((num, i) => {
      if (!run.length || num === nums[i - 1] + 1) run.push(num);
      else { ekle(); run = [num]; }
    });
    ekle();
  }

  const numGruplari = {};
  taslar.filter(otomatikGruplamaTasMi).forEach((t) => {
    (numGruplari[t.num] ||= {})[t.renk] ||= t;
  });
  Object.values(numGruplari).forEach((renkler) => {
    const tiles = Object.values(renkler);
    if (tiles.length >= 3) adaylar.push({ tiles, oncelik: 1 });
  });

  adaylar.sort((a, b) => (b.tiles.length - a.tiles.length) || (a.oncelik - b.oncelik));
  const kullanilan = new Set();
  const groups = [];
  adaylar.forEach((aday) => {
    if (aday.tiles.some((t) => kullanilan.has(t.id))) return;
    aday.tiles.forEach((t) => kullanilan.add(t.id));
    groups.push({ tiles: aday.tiles, tip: "seri" });
  });
  return { groups, remaining: taslar.filter((t) => !kullanilan.has(t.id)) };
}

function ciftGruplariBul(taslar) {
  const eslesmeler = {};
  taslar.filter(otomatikGruplamaTasMi).forEach((t) => {
    const anahtar = `${t.renk}:${t.num}`;
    (eslesmeler[anahtar] ||= []).push(t);
  });
  const groups = [];
  const kullanilan = new Set();
  Object.values(eslesmeler).forEach((liste) => {
    for (let i = 0; i + 1 < liste.length; i += 2) {
      const tiles = liste.slice(i, i + 2);
      tiles.forEach((t) => kullanilan.add(t.id));
      groups.push({ tiles, tip: "cift" });
    }
  });
  return { groups, remaining: taslar.filter((t) => !kullanilan.has(t.id)) };
}

function dizimleriIstakayaYerlestir(groups, remaining) {
  OKEY_RAK.fill(null);
  OKEY_GRUPLAR = [];
  OKEY_GRUPLAMA_ENGELI.clear();
  let slot = 0;
  const yerlestirilebilirBas = (uzunluk) => {
    const sutun = slot % OKEY_SLOT_SATIR;
    if (sutun + uzunluk > OKEY_SLOT_SATIR) slot += OKEY_SLOT_SATIR - sutun;
    return slot;
  };
  groups.forEach(({ tiles, tip }) => {
    const bas = yerlestirilebilirBas(tiles.length);
    const slotlar = tiles.map((tas, i) => {
      OKEY_RAK[bas + i] = tas;
      return bas + i;
    });
    OKEY_GRUPLAR.push(yeniGrup(tiles, slotlar, tip));
    slot = bas + tiles.length;
  });
  remaining.forEach((tas) => {
    const bas = yerlestirilebilirBas(1);
    OKEY_RAK[bas] = tas;
    slot = bas + 1;
  });
}

function gruplariYenile() {
  // Gruplar yalnızca otomatik dizme butonlarıyla oluşturulur; boşlukları tarayıp
  // çiftleri veya tesadüfi komşu taşları kendiliğinden grup yapma.
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
  const bosHucre = hucre && !hucre.querySelector(".okey-tas");
  if (SURUKLE.slot && SURUKLE.slot !== bosHucre) {
    SURUKLE.slot.dispatchEvent(new Event("dragleave"));
  }
  if (bosHucre && SURUKLE.slot !== bosHucre) {
    bosHucre.dispatchEvent(new Event("dragenter"));
  }
}

function okeySurukleBitir(e) {
  if (!SURUKLE) return;
  const { tileId, kaynak, ghost, slot } = SURUKLE;
  SURUKLE = null;
  if (ghost) ghost.remove();
  const kaynakEl = document.querySelector(`.okey-rak-hucre .okey-tas[data-id="${tileId}"], .group-wrapper .okey-tas[data-id="${tileId}"]`);
  if (kaynakEl) kaynakEl.style.opacity = "";
  if (slot) slot.dispatchEvent(new Event("drop"));
  document.querySelectorAll(".okey-rak-hucre.highlight-slot").forEach((el) => el.classList.remove("highlight-slot"));
  document.querySelectorAll("#okeyAtisBolge.hedef").forEach((el) => el.classList.remove("hedef"));

  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const hucre = alt && alt.closest(".okey-rak-hucre");

  if (kaynak === "cop") {
    if (hucre && !hucre.querySelector(".okey-tas")) {
      BEKLENEN_SLOT = parseInt(hucre.dataset.hucre, 10);
      okeyCopCek();
    }
    return;
  }

  if (atis) {
    okeyTasAt(tileId);
  } else if (hucre && !hucre.querySelector(".okey-tas")) {
    okeyRakTasi(tileId, parseInt(hucre.dataset.hucre, 10));
  }
}

function slotHighlightListenersEkle() {
  document.querySelectorAll(".okey-rak-hucre").forEach((slot) => {
    slot.addEventListener("dragenter", () => {
      if (SURUKLE && !slot.querySelector(".okey-tas")) {
        slot.classList.add("highlight-slot");
        SURUKLE.slot = slot;
      }
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("highlight-slot");
      if (SURUKLE && SURUKLE.slot === slot) SURUKLE.slot = null;
    });
    slot.addEventListener("drop", () => {
      slot.classList.remove("highlight-slot");
      if (SURUKLE && SURUKLE.slot === slot) SURUKLE.slot = null;
    });
  });
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

function oyuncuKartHTML(o, siraMi, discard) {
  const avatar = o.avatar || "";
  const sonAtis = discard && discard.length ? discard[discard.length - 1] : null;
  const etiket = o.acildi ? (o.acilisTipi === "cift" ? '<span class="okey-acildi">çift açtı</span>' : '<span class="okey-acildi">açtı</span>') : "";
  return `
    <div class="okey-seat">
      <div class="okey-oyuncu-kart ${siraMi ? "sira" : ""}">
        ${avatar ? `<img class="okey-avatar" src="${avatar}" alt="" />` : '<span class="okey-avatar">🤖</span>'}
        <span class="okey-oyuncu-tas"><span>${o.elSayisi}</span> taş</span>
        ${siraMi ? '<span class="okey-sira-ok">🎯</span>' : ""}
      </div>
      ${etiket}
      <div class="discard_pile okey-seat-cop" title="Son attığı taş">
        ${sonAtis ? tasKutu(sonAtis, "mini") : '<span class="okey-seat-cop-bos">·</span>'}
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
  oyun.style.display = "flex";
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
    playerSelfDiscard = Array.isArray(ben.atilan) ? ben.atilan : [];
    playerLeftDiscard = Array.isArray(sol.atilan) ? sol.atilan : [];
    playerTopDiscard = Array.isArray(ust.atilan) ? ust.atilan : [];
    playerRightDiscard = Array.isArray(sag.atilan) ? sag.atilan : [];

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

    document.getElementById("okeyOyuncuUst").innerHTML = oyuncuKartHTML(ust, durum.tur === (benIdx + 2) % 4, playerTopDiscard);
    document.getElementById("okeyOyuncuSol").innerHTML = oyuncuKartHTML(sol, durum.tur === (benIdx + 3) % 4, playerLeftDiscard);
    document.getElementById("okeyOyuncuSag").innerHTML = oyuncuKartHTML(sag, durum.tur === (benIdx + 1) % 4, playerRightDiscard);

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
    slotHighlightListenersEkle();
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
