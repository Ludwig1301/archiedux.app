// ---------- Okey 101 ----------
let okeySocket = null;
let OKEY_OYUN = null;
let OKEY_SECILI = new Set();
let OKEY_GRUPLAR = [];
let OKEY_EL_SIRASI = []; // ıstakadaki taş sırası (elle dizilebilir)
let SURUKLE = null; // aktif sürükleme

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
    OKEY_SECILI.clear();
    OKEY_GRUPLAR = [];
    // ıstaka sırasını koru, yeni taşları sona ekle
    const ben = durum.oyuncular.find((o) => o.ben);
    const eldekiler = new Set((ben ? ben.el : []).map((t) => t.id));
    OKEY_EL_SIRASI = OKEY_EL_SIRASI.filter((id) => eldekiler.has(id));
    for (const t of ben ? ben.el : []) {
      if (!OKEY_EL_SIRASI.includes(t.id)) OKEY_EL_SIRASI.push(t.id);
    }
    okeyRender(durum);
  });
  const kodEl = document.getElementById("okeyOdaKodu");
  if (kodEl) kodEl.addEventListener("keydown", (e) => { if (e.key === "Enter") okeyKatil(); });
  // sürükle-bırak için global dinleyiciler
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
function okeyAc() { okeySocket.emit("okey-ac", { gruplar: OKEY_GRUPLAR }, hataGoster); }
function okeyBitir() { okeySocket.emit("okey-bitir", { gruplar: OKEY_GRUPLAR }, hataGoster); }
function okeyYeniden() { location.reload(); }

// ---------- Dizme ----------
function okeySiraladiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const harita = {};
  for (const t of ben.el) harita[t.id] = t;
  OKEY_EL_SIRASI.sort(
    (a, b) => (RENK_SIRA[harita[a].renk] - RENK_SIRA[harita[b].renk]) || harita[a].num - harita[b].num
  );
  okeyRender(OKEY_OYUN);
}

function okeyCiftDiz() {
  const ben = OKEY_OYUN && OKEY_OYUN.oyuncular.find((o) => o.ben);
  if (!ben) return;
  const harita = {};
  for (const t of ben.el) harita[t.id] = t;
  OKEY_EL_SIRASI.sort(
    (a, b) => (harita[a].num - harita[b].num) || (RENK_SIRA[harita[a].renk] - RENK_SIRA[harita[b].renk])
  );
  okeyRender(OKEY_OYUN);
}

// ---------- Gruplama ----------
function okeyGrupGeri() {
  OKEY_GRUPLAR.pop();
  okeyRender(OKEY_OYUN);
}

function okeyGrupSil(grupIdx) {
  OKEY_GRUPLAR.splice(grupIdx, 1);
  okeyRender(OKEY_OYUN);
}

function okeyGrupEkleTile(tileId, grupIdx) {
  if (grupIdx !== undefined && OKEY_GRUPLAR[grupIdx]) {
    if (!OKEY_GRUPLAR[grupIdx].includes(tileId)) OKEY_GRUPLAR[grupIdx].push(tileId);
  } else {
    OKEY_GRUPLAR.push([tileId]);
  }
  okeyRender(OKEY_OYUN);
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
  SURUKLE = { tileId, tile, ghost };
  const kaynak = document.querySelector(`.okey-el .okey-tas[data-id="${tileId}"]`);
  if (kaynak) kaynak.classList.add("suruklenirken");
}

function okeySurukleHareket(e) {
  if (!SURUKLE) return;
  SURUKLE.ghost.style.left = e.clientX - 22 + "px";
  SURUKLE.ghost.style.top = e.clientY - 30 + "px";
  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const cop = alt && alt.closest("#okeyCopBolge");
  document.querySelectorAll(".okey-bolge.hedef").forEach((el) => el.classList.remove("hedef"));
  if (atis) atis.classList.add("hedef");
  else if (cop) cop.classList.add("hedef");
}

function okeySurukleBitir(e) {
  if (!SURUKLE) return;
  const { tileId, tile, ghost } = SURUKLE;
  SURUKLE = null;
  if (ghost) ghost.remove();
  const kaynak = document.querySelector(`.okey-el .okey-tas[data-id="${tileId}"]`);
  if (kaynak) kaynak.classList.remove("suruklenirken");
  document.querySelectorAll(".okey-bolge.hedef").forEach((el) => el.classList.remove("hedef"));

  const alt = document.elementFromPoint(e.clientX, e.clientY);
  const atis = alt && alt.closest("#okeyAtisBolge");
  const cop = alt && alt.closest("#okeyCopBolge");
  const grupKutu = alt && alt.closest("#okeyGruplar");
  const grupOge = alt && alt.closest(".okey-grup");
  const hedefTas = alt && alt.closest(".okey-el .okey-tas");

  if (atis) {
    okeyTasAt(tileId);
  } else if (grupOge) {
    const idx = [...document.querySelectorAll("#okeyGruplar .okey-grup")].indexOf(grupOge);
    okeyGrupEkleTile(tileId, idx);
  } else if (grupKutu) {
    okeyGrupEkleTile(tileId);
  } else if (hedefTas) {
    const hedefId = parseInt(hedefTas.dataset.id, 10);
    if (hedefId !== tileId) {
      const a = OKEY_EL_SIRASI.indexOf(tileId);
      const b = OKEY_EL_SIRASI.indexOf(hedefId);
      [OKEY_EL_SIRASI[a], OKEY_EL_SIRASI[b]] = [OKEY_EL_SIRASI[b], OKEY_EL_SIRASI[a]];
      okeyRender(OKEY_OYUN);
    }
  }
  // cop'a bırakmak bir şey yapmaz; sadece çekmek için tıklanır
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

function tasAd(t) {
  if (t.sahte) return "Sahte okey";
  if (t.okey) return `OKEY ${RENK_ADI[t.renk]} ${t.num}`;
  return `${RENK_ADI[t.renk]} ${t.num}`;
}

function oyuncuKartHTML(o, siraMi) {
  const avatar = o.avatar || "";
  return `
    <div class="okey-oyuncu-kart ${siraMi ? "sira" : ""}" title="${o.ad}">
      ${avatar ? `<img class="okey-avatar" src="${avatar}" alt="" />` : '<span class="okey-avatar">🤖</span>'}
      <span class="okey-oyuncu-tas"><span>${o.elSayisi}</span> taş</span>
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

  document.getElementById("okeyOyuncuUst").innerHTML = oyuncuKartHTML(ust, durum.tur === (benIdx + 2) % 4);
  document.getElementById("okeyOyuncuSol").innerHTML = oyuncuKartHTML(sol, durum.tur === (benIdx + 3) % 4);
  document.getElementById("okeyOyuncuSag").innerHTML = oyuncuKartHTML(sag, durum.tur === (benIdx + 1) % 4);

  const desteEl = document.getElementById("okeyDeste");
  desteEl.innerHTML = `DESTE<br/>${durum.desteSayisi}`;
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

  // Benim ıstakam
  const benimSira = durum.durum === "oynaniyor" && durum.tur === benIdx;
  const el = document.getElementById("okeyEl");
  const grupta = new Set(OKEY_GRUPLAR.flat());
  const harita = {};
  for (const t of ben.el || []) harita[t.id] = t;
  const siraliIdler = OKEY_EL_SIRASI.filter((id) => harita[id]);
  el.innerHTML = siraliIdler
    .map(
      (id) => {
        const t = harita[id];
        return `
    <div class="okey-tas ${grupta.has(id) ? "okey-tas-grupta" : ""} ${benimSira ? "tiklanabilir" : ""}"
      style="--tas-renk:${tasRengi(t)}" data-id="${id}"
      onpointerdown="okeySurukleBasla(event, ${id})"
      title="${tasAd(t)}">${tasIc(t)}</div>
  `;
      }
    )
    .join("");

  // Gruplar
  const gruplar = document.getElementById("okeyGruplar");
  gruplar.innerHTML = OKEY_GRUPLAR.length
    ? OKEY_GRUPLAR.map(
        (g, gi) => `<span class="okey-grup" onclick="okeyGrupSil(${gi})" title="Grup kaldır">${g
          .map((tid) => {
            const t = harita[tid];
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
      <span class="okey-sonuc-puan">${s.puan !== undefined ? s.puan + " puan" : ""}</span>
      <span class="okey-sonuc-xp">+${s.kazanilan} XP</span>
    </div>
  `
    )
    .join("");
}
