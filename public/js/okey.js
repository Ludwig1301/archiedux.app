// ---------- Okey 101 ----------
let okeySocket = null;
let OKEY_OYUN = null;
let OKEY_EL_SIRASI = []; // ıstakadaki taş sırası
let SURUKLE = null;

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
function okeyDesteCek() { okeySocket.emit("okey-deste-cek", {}, hataGoster); }
function okeyCopCek() { okeySocket.emit("okey-cop-cek", {}, hataGoster); }
function okeyTasAt(tileId) { okeySocket.emit("okey-tas-at", { tileId }, hataGoster); }
function okeyAc() { okeySocket.emit("okey-ac", { gruplar: mevcutGruplar() }, hataGoster); }
function okeyBitir() { okeySocket.emit("okey-bitir", { gruplar: mevcutGruplar() }, hataGoster); }
function okeyYeniden() { location.reload(); }

// ---------- Istaka ----------
function rakGuncelle(ben) {
  const eldekiler = new Set((ben ? ben.el : []).map((t) => t.id));
  OKEY_EL_SIRASI = OKEY_EL_SIRASI.filter((id) => eldekiler.has(id));
  for (const t of ben ? ben.el : []) {
    if (!OKEY_EL_SIRASI.includes(t.id)) OKEY_EL_SIRASI.push(t.id);
  }
}

function okeyRakEkle(tileId, hedefId) {
  const a = OKEY_EL_SIRASI.indexOf(tileId);
  if (a === -1) return;
  OKEY_EL_SIRASI.splice(a, 1);
  const b = OKEY_EL_SIRASI.indexOf(hedefId);
  if (b === -1) OKEY_EL_SIRASI.push(tileId);
  else OKEY_EL_SIRASI.splice(b, 0, tileId);
  okeyRender(OKEY_OYUN);
}

function okeySiraladiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const harita = {};
  for (const t of ben.el) harita[t.id] = t;
  const ids = OKEY_EL_SIRASI.filter((id) => harita[id]);
  ids.sort((a, b) => (RENK_SIRA[harita[a].renk] - RENK_SIRA[harita[b].renk]) || harita[a].num - harita[b].num);
  OKEY_EL_SIRASI = ids;
  okeyRender(OKEY_OYUN);
}

function okeyCiftDiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const harita = {};
  for (const t of ben.el) harita[t.id] = t;
  const ids = OKEY_EL_SIRASI.filter((id) => harita[id]);
  ids.sort((a, b) => (harita[a].num - harita[b].num) || (RENK_SIRA[harita[a].renk] - RENK_SIRA[harita[b].renk]));
  OKEY_EL_SIRASI = ids;
  okeyRender(OKEY_OYUN);
}

// ---------- Otomatik gruplama ----------
function bulEnUzunMeld(taslar, s) {
  const t0 = taslar[s];
  if (!t0) return 0;
  let cift = 1;
  for (let k = s + 1; k < taslar.length && taslar[k].num === t0.num; k++) cift++;
  let per = 1;
  for (let k = s + 1; k < taslar.length && taslar[k].renk === t0.renk && taslar[k].num === t0.num + (k - s); k++) per++;
  const enUzun = Math.max(cift >= 3 ? cift : 0, per >= 3 ? per : 0);
  return enUzun;
}

function mevcutGruplar() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return [];
  const harita = {};
  for (const t of ben.el || []) harita[t.id] = t;
  const ids = OKEY_EL_SIRASI.filter((id) => harita[id]);
  const taslar = ids.map((id) => harita[id]);
  const gruplar = [];
  let s = 0;
  while (s < ids.length) {
    const len = bulEnUzunMeld(taslar, s);
    if (len >= 3) {
      gruplar.push(ids.slice(s, s + len));
      s += len;
    } else {
      s++;
    }
  }
  return gruplar;
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
  SURUKLE = { tileId, ghost };
  const kaynak = document.querySelector(`#okeyEl .okey-tas[data-id="${tileId}"]`);
  if (kaynak) kaynak.style.opacity = "0.25";
}

function okeySurukleHareket(e) {
  if (!SURUKLE) return;
  SURUKLE.ghost.style.left = e.clientX - 22 + "px";
  SURUKLE.ghost.style.top = e.clientY - 30 + "px";
  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const hedefTas = alt && alt.closest("#okeyEl .okey-tas");
  document.querySelectorAll("#okeyAtisBolge.hedef").forEach((el) => el.classList.remove("hedef"));
  if (atis) atis.classList.add("hedef");
}

function okeySurukleBitir(e) {
  if (!SURUKLE) return;
  const { tileId, ghost } = SURUKLE;
  SURUKLE = null;
  if (ghost) ghost.remove();
  const kaynak = document.querySelector(`#okeyEl .okey-tas[data-id="${tileId}"]`);
  if (kaynak) kaynak.style.opacity = "";
  document.querySelectorAll("#okeyAtisBolge.hedef").forEach((el) => el.classList.remove("hedef"));

  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const hedefTas = alt && alt.closest("#okeyEl .okey-tas");
  const elKutu = alt && alt.closest("#okeyEl");

  if (atis) {
    okeyTasAt(tileId);
  } else if (hedefTas) {
    okeyRakEkle(tileId, parseInt(hedefTas.dataset.id, 10));
  } else if (elKutu) {
    const a = OKEY_EL_SIRASI.indexOf(tileId);
    if (a !== -1) {
      OKEY_EL_SIRASI.splice(a, 1);
      OKEY_EL_SIRASI.push(tileId);
      okeyRender(OKEY_OYUN);
    }
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

function tasKutu(t, ekstra) {
  return `<div class="okey-tas ${ekstra || ""}" style="--tas-renk:${tasRengi(t)}" title="${tasAd(t)}">${tasIc(t)}</div>`;
}

function tasDrag(t, benimSira) {
  return `<div class="okey-tas ${benimSira ? "tiklanabilir" : ""}" data-id="${t.id}"
    onpointerdown="okeySurukleBasla(event, ${t.id})" title="${tasAd(t)}"
    style="--tas-renk:${tasRengi(t)}">${tasIc(t)}</div>`;
}

function tasAd(t) {
  if (t.sahte) return "Sahte okey";
  if (t.okey) return `OKEY ${RENK_ADI[t.renk]} ${t.num}`;
  return `${RENK_ADI[t.renk]} ${t.num}`;
}

function oyuncuKartHTML(o, siraMi) {
  const avatar = o.avatar || "";
  const atilan = (o.atilan || []).slice(-8);
  return `
    <div class="okey-seat">
      <div class="okey-oyuncu-kart ${siraMi ? "sira" : ""}">
        ${avatar ? `<img class="okey-avatar" src="${avatar}" alt="" />` : '<span class="okey-avatar">🤖</span>'}
        <span class="okey-oyuncu-tas"><span>${o.elSayisi}</span> taş</span>
        ${siraMi ? '<span class="okey-sira-ok">🎯</span>' : ""}
      </div>
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

    // Çöp: sadece en üstteki (çekilebilir) taş
    const copEl = document.getElementById("okeyCop");
    copEl.innerHTML = durum.coplerUst ? tasKutu(durum.coplerUst, "") : '<span style="opacity:0.4">—</span>';
    copEl.classList.toggle("tiklanabilir", durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst);
    copEl.onclick = (durum.durum === "oynaniyor" && durum.tur === benIdx && durum.cekimGerekli && durum.coplerUst) ? okeyCopCek : null;

    // Açılan masalar
    const masaKutu = document.getElementById("okeyMasalar");
    masaKutu.innerHTML = durum.oyuncular
      .map(
        (o) => `
    <div class="okey-masa-satir">
      ${o.avatar ? `<img class="okey-avatar kucuk" src="${o.avatar}" alt="" />` : '<span class="okey-avatar kucuk">🤖</span>'}
      ${o.acildi ? '<span style="color:#6fd36f">açtı</span>' : ""}
      <div class="okey-masa-gruplar">${
        o.masa && o.masa.length
          ? o.masa.map((g) => `<span class="okey-grup">${g.map((t) => tasKutu(t, "mini")).join("")}</span>`).join("")
          : '<span style="opacity:0.4">—</span>'
      }</div>
    </div>
  `
      )
      .join("");

    // Istaka (temiz, hücresiz)
    const benimSira = durum.durum === "oynaniyor" && durum.tur === benIdx;
    const harita = {};
    for (const t of ben.el || []) harita[t.id] = t;
    const ids = OKEY_EL_SIRASI.filter((id) => harita[id]);
    const grupta = new Set(mevcutGruplar().flat());

    let elHtml = "";
    let i = 0;
    while (i < ids.length) {
      const id = ids[i];
      const t = harita[id];
      if (grupta.has(id)) {
        let j = i;
        const gTaslar = [];
        while (j < ids.length && grupta.has(ids[j])) {
          gTaslar.push(harita[ids[j]]);
          j++;
        }
        elHtml += `<span class="okey-grup-kapsayici">${gTaslar.map((x) => tasDrag(x, benimSira)).join("")}</span>`;
        i = j;
      } else {
        elHtml += tasDrag(t, benimSira);
        i++;
      }
    }
    document.getElementById("okeyEl").innerHTML = elHtml;
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
