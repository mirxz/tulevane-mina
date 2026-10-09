// Tulevane Mina – häkatoni prototüüp 9.10: kolm vaadet samale plaanile.
// JTBD: „Kui pean otsustama, millal ja kuidas oma pensioniraha kasutama hakata, tahan näha, kas mu plaan katab vajaduse
// elu lõpuni, et teha otsus, mida ma enam hiljem ei kahetse.“ Emotsioon: „Kui olen vana, ei peaks koonerdama.“
// Üks plaan, kolm vahekaarti: kalk (arvud), kaar (elustandard elukaarel + otsustuspunktid), korv (millist ostukorvi saan endale lubada).
// Sisendid jäävad telefoni; serverisse läheb ainult vaade, sündmus ja tagasiside (/api/p).
import { plaan, pensioniiga, COEF, EELDUSED, eur } from "./mudel.js";

const app = document.getElementById("app");
const VAATED = ["kalk", "kaar", "korv"];
const NIMI = { kalk: "Kalkulaator", kaar: "Elukaar", korv: "Ostukorv" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const say = (t) => { const el = document.getElementById("teade"); el.textContent = ""; setTimeout(() => (el.textContent = t), 30); };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// loos: ?vaade= link või juhuslik ja meelde jäetud
const LOOS = (() => {
  const q = new URLSearchParams(location.search).get("vaade");
  if (VAATED.includes(q)) return { vaade: q, src: "link" };
  let v = store.get("plaan-loos");
  if (!VAATED.includes(v)) { v = VAATED[Math.floor(Math.random() * 3)]; store.set("plaan-loos", v); }
  return { vaade: v, src: v };
})();
// allikas: ?k=reklaam|fb|lkd… (esimene kord jääb meelde), et teada, mis kanal inimesi tõi
const ALK = (() => {
  const q = (new URLSearchParams(location.search).get("k") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  const old = store.get("plaan-allikas");
  if (old) return old;
  if (q) { store.set("plaan-allikas", q); return q; }
  return "";
})();
const SID = (() => { let s = store.get("plaan-sid"); if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); store.set("plaan-sid", s); } return s; })();
function track(ev, extra = {}) {
  try { fetch("/api/p", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sid: SID, ev, loos: LOOS.src, vaade: ui.vaade, alk: ALK, ...extra }), keepalive: true }); } catch {}
}

const KORV = [
  { id: "reis", ic: "✈️", nimi: "Reis kord aastas", hind: 150 },
  { id: "lapsed", ic: "🎁", nimi: "Lapselapsed: kingitused ja ühised päevad", hind: 60 },
  { id: "maakodu", ic: "🏡", nimi: "Maakodu või aed", hind: 100 },
  { id: "kultuur", ic: "🎭", nimi: "Teater, kontserdid, kursused", hind: 60 },
  { id: "auto", ic: "🚗", nimi: "Oma auto", hind: 180 },
  { id: "toit", ic: "🍽️", nimi: "Restoranid ja hea toit", hind: 100 },
  { id: "abi", ic: "🧹", nimi: "Abi kodus: koristus, hooldus", hind: 150 },
  { id: "anne", ic: "💛", nimi: "Annetused ja heategevus", hind: 40 },
];

const ui = {
  ekraan: "algus", vaade: LOOS.vaade, nahtud: [], kindlusEnne: null, k: 0, W: null, viis: "fondipension",
  s: { sunniaasta: 1968, sugu: "M", pension: 800, sammas: 40000, sast: 20000, sissemakse: 150, fond: "indeks", vajadus: 1200 },
  lisa: new Set(), toit: {}, fb: {}, saadetud: false, viga: "", ava: false,
};
const lisaSumma = () => KORV.filter((i) => ui.lisa.has(i.id)).reduce((a, i) => a + i.hind, 0);
// Toidukorv (näitehinnad, € kuus ühe inimese kohta). Põhivajaduses on toit „tavalisel“ tasemel; valik lisab või vähendab vahet.
const TOIT = [
  { id: "piim", ic: "🥛", nimi: "Piim", t: [["Kilepiim", 20], ["Pakipiim", 28], ["Öko pakipiim", 40]] },
  { id: "vorst", ic: "🥓", nimi: "Vorst ja sink", t: [["Vorst", 22], ["Sink", 36], ["Talusink", 54]] },
  { id: "leib", ic: "🍞", nimi: "Leib", t: [["Poeleib", 12], ["Seemneleib", 18], ["Pagari leib", 30]] },
  { id: "liha", ic: "🍗", nimi: "Liha", t: [["Kanakints", 24], ["Kanafilee", 38], ["Mahe liha", 60]] },
  { id: "kala", ic: "🐟", nimi: "Kala", t: [["Konserv", 12], ["Värske lõhe", 26], ["Kalapoe kala", 42]] },
  { id: "aed", ic: "🥕", nimi: "Köögi- ja puuviljad", t: [["Odavad, hooajal", 26], ["Tavaline valik", 40], ["Kohalik ja mahe", 60]] },
  { id: "juust", ic: "🧀", nimi: "Juust", t: [["Odav juust", 12], ["Hea juust", 20], ["Käsitööjuust", 32]] },
  { id: "kohv", ic: "☕", nimi: "Kohv ja tee", t: [["Odav kohv", 8], ["Hea kohv", 14], ["Röstikoja kohv", 24]] },
  { id: "magus", ic: "🍫", nimi: "Magus", t: [["Odav šokolaad", 10], ["Hea šokolaad", 18], ["Mahe šokolaad", 30]] },
];
const tase = (id) => ui.toit[id] ?? 1;
const toitSumma = () => TOIT.reduce((a, i) => a + i.t[tase(i.id)][1], 0);
const toitDelta = () => toitSumma() - TOIT.reduce((a, i) => a + i.t[1][1], 0);
const inp = () => ({ ...ui.s, k: ui.k, W: ui.W ?? pensioniiga(ui.s.sunniaasta), viis: ui.viis, vajadus: ui.s.vajadus + lisaSumma() + toitDelta() });
const TAB = { kalk: "Arvud", kaar: "Elukaar", korv: "Ostukorv" };
const proc = (x) => (Math.round(Math.abs(x) * 1000) / 10).toString().replace(".", ",") + "%";

// ---------- põhi ----------
function render() {
  const prev = ui._last;
  const focusKey = document.activeElement?.dataset?.k, focusIn = document.activeElement?.dataset?.in;
  app.innerHTML = (ui.viga ? `<p class="note" role="alert">${esc(ui.viga)}</p>` : "") + (ui.ekraan === "algus" ? algus() : plaanEkraan());
  app.querySelectorAll("[data-act]").forEach((el) => (el.dataset.k = [el.dataset.act, el.dataset.id || "", el.dataset.v || ""].join("|")));
  if (ui.ekraan === "plaan" && ui.vaade === "kaar" && ui._ch) chartTip(Math.max(ui._ch.a0, Math.min(100, ui._chAge ?? ui._ch.turv)), true);
  const key = ui.ekraan;
  if (key !== prev) { const first = prev === undefined; ui._last = key; const h = app.querySelector("h1"); if (h && !first) { h.tabIndex = -1; h.focus({ preventScroll: true }); } if (!first) window.scrollTo(0, 0); }
  else if (focusIn) { const el = app.querySelector(`[data-in="${focusIn}"]`); if (el) { el.focus({ preventScroll: true }); try { const n = el.value.length; el.setSelectionRange?.(n, n); } catch {} } }
  else if (focusKey) { const el = [...app.querySelectorAll("[data-k]")].find((x) => x.dataset.k === focusKey); if (el) el.focus({ preventScroll: true }); }
}

const num = (id, label, val, opts = "", hint = "") => `<label class="f">${label}<input type="number" inputmode="numeric" data-in="${id}" value="${val}" ${opts}>${hint ? `<span class="hint">${hint}</span>` : ""}</label>`;
const seg = (act, opts, cur, label = "") => `<div class="seg" role="group" ${label ? `aria-label="${esc(label)}"` : ""}>${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join("")}</div>`;
const scale = (act, cur, lo, hi) => `<div class="scale" role="group">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-act="${act}" data-v="${n}" aria-pressed="${cur === n}" aria-label="${n} viiest">${n}</button>`).join("")}</div><div class="scale-l"><span>${lo}</span><span>${hi}</span></div>`;

// ---------- algus ----------
function algus() {
  const s = ui.s, R = pensioniiga(s.sunniaasta);
  return `<section class="hero"><h1>Kas su plaan katab vajaduse elu lõpuni?</h1>
  <p>Vasta kolmele küsimusele. Näitame, kui kaugele su raha jätkub ja kas sa koonerdad asjata.</p></section>
  <section class="card" aria-label="Sinu andmed">
  <div class="grid2">${num("sunniaasta", "Sünniaasta", s.sunniaasta, 'min="1941" max="1996"')}
  <div class="f">Sugu <span class="hint">eluea statistika jaoks</span>${seg("sugu", [["M", "Mees"], ["N", "Naine"]], s.sugu, "Sugu")}</div></div>
  ${num("pension", "Riiklik pension kuus, €", s.pension, 'min="0" max="5000" step="10"', `Õigel ajal (${R}-aastaselt). Prognoosi leiad Sotsiaalkindlustusameti iseteenindusest.`)}
  ${num("vajadus", "Mida vajad pensionil kuus, €", s.vajadus, 'min="0" step="50"', "Kodu, toit, kommunaalid, ravimid. Reisid ja muu lisad hiljem ostukorvis.")}
  <details class="det"${ui.ava ? " open" : ""}><summary><span>Täpsusta sambaid ja sääste</span><span class="small">praegu ${eur(s.sammas)} ja ${eur(s.sast)}</span></summary><div class="det-in">${tapsem()}</div></details>
  <div class="f"><span>Kui kindel oled praegu, et su raha jätkub elu lõpuni? <span class="hint">valikuline</span></span>${scale("enne", ui.kindlusEnne, "Üldse mitte", "Väga kindel")}</div>
  <button type="button" class="btn block" data-act="alusta">Näita minu plaani</button>
  <p class="small">Sisestatud summad jäävad sinu telefoni. Salvestame ainult vaated ja tagasiside vastused.</p></section>`;
}
function tapsem(p) {
  const s = ui.s;
  let w = "";
  if (p) { const Wopts = []; for (let x = Math.max(60, p.vanus); x <= p.R + 5; x++) Wopts.push(x); w = `<label class="f">Sammaste väljamakse algab<select data-in="W">${Wopts.map((x) => `<option value="${x}" ${x === p.W ? "selected" : ""}>${x} a</option>`).join("")}</select></label>`; }
  return `<div class="grid2">${num("sammas", "II ja III samba vara, €", s.sammas, 'min="0" step="1000"')}${num("sast", "Muud säästud, €", s.sast, 'min="0" step="1000"')}</div>
  ${num("sissemakse", "Sissemakse sammastesse enne väljamakset, € kuus", s.sissemakse, 'min="0" step="10"')}
  <div class="f">Fond${seg("fond", [["indeks", "Indeksfond (0,3%)"], ["kallis", "Kallis fond (1%)"]], s.fond, "Fond")}</div>${w}`;
}

// ---------- plaan ----------
function samm(p) {
  const R = p.R, k = ui.k;
  const eff = k === 0 ? "Õigel ajal, kordaja 100%" : `${k < 0 ? "−" : "+"}${proc(COEF[k])} igakuisele pensionile`;
  return `<section class="card" aria-labelledby="l-k"><h2 id="l-k" style="font-size:18px;line-height:26px">Millal lähed riiklikule pensionile?</h2>
  <div class="step" role="group" aria-labelledby="l-k"><button type="button" data-act="kmuuda" data-v="-1" aria-label="Üks aasta varem" ${k <= -5 ? "disabled" : ""}>−</button>
  <output><b>${R + k}-aastaselt</b><span>${eff}</span></output>
  <button type="button" data-act="kmuuda" data-v="1" aria-label="Üks aasta hiljem" ${k >= 5 ? "disabled" : ""}>+</button></div></section>`;
}
function veel(p) {
  return `<section class="card" aria-labelledby="h-o"><h2 id="h-o" style="font-size:18px;line-height:26px">Muuda veel</h2>
  ${num("vajadus", "Põhivajadus kuus, €", ui.s.vajadus, 'min="0" step="50"')}
  <div class="f"><span>Kuidas sammastest raha võtad</span>${seg("viis", [["fondipension", "Igakuiselt"], ["korraga", "Korraga (−10%)"]], ui.viis, "Väljamakse viis")}
  <span class="hint">${ui.viis === "fondipension" ? "Fondipension on maksuvaba ja jagab samba vara elu peale laiali." : "Korraga võetud raha maksustatakse 10% ja läheb säästudesse."}</span></div>
  <details class="det"><summary>Täpsemalt: sambad, säästud, fond</summary><div class="det-in">${tapsem(p)}</div></details></section>`;
}

function verdict(p, vaj) {
  const L = p.lubatav, yle = L - vaj;
  let ikoon, kl, tit, alt, extra = "";
  if (p.katab) {
    ikoon = "✓"; kl = "ok"; tit = "Jah, plaan katab vajaduse elu lõpuni.";
    alt = `Raha jätkub vähemalt ${p.turv}-aastaseks. Nii kaua elab 10% sinuvanustest.` + "";
    extra = yle >= 50 ? `<b>Ära koonerda:</b> võiksid kulutada ${eur(yle)} kuus rohkem.` : "Vajadus on plaani piiril.";
  } else {
    const pu = p.read.filter((r) => r.puudu > 1).map((r) => r.vanus), a = pu[0], z = pu.at(-1), ajut = z < p.turv - 1;
    ikoon = "!"; kl = "no";
    tit = ajut ? `Raha jääb puudu ${a === z ? a + "-aastaselt" : a + "–" + z + "-aastaselt"}.` : `Raha jääb puudu alates ${a}-aastasest.`;
    alt = ajut ? "Hiljem jätkub, aga vahepeal tuleb midagi muuta." : `Tõenäosus, et elad ${a}-aastaseks: ${Math.round(p.elusOtsas * 100)}%. Proovi pensionit edasi lükata või vajadust vähendada.`;
  }
  return `<section class="vd ${kl}" aria-live="polite"><div class="vd-i" aria-hidden="true">${ikoon}</div><div><h1>${tit}</h1><p>${alt}</p>${extra ? `<p class="vd-x">${extra}</p>` : ""}</div>
  <dl class="vd-n"><div><dt>Sinu vajadus</dt><dd>${eur(vaj)}</dd></div><div><dt>Plaan kannab</dt><dd>${eur(L)}</dd></div></dl></section>`;
}

function plaanEkraan() {
  const p = plaan(inp()), v = ui.vaade, vaj = inp().vajadus;
  const tabs = `<div class="tabs" role="tablist" aria-label="Vaata plaani kolmel viisil">${Object.entries(TAB).map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-selected="${v === k}" aria-controls="panel" tabindex="${v === k ? 0 : -1}" data-act="tab" data-v="${k}">${l}</button>`).join("")}</div>`;
  const body = v === "kalk" ? kalk(p, vaj) : v === "kaar" ? kaar(p, vaj) : korv(p, vaj);
  return `<div class="between"><button type="button" class="lnk" data-act="tagasi">← Muuda andmeid</button><span class="chip">${p.vanus}-aastane, pension ${p.R}</span></div>
  ${verdict(p, vaj)}${samm(p)}
  <section aria-labelledby="h-v"><h2 id="h-v" class="sr">Vaata sama plaani kolmel viisil</h2><p class="small" style="margin:0 0 8px">Sama plaan kolmel viisil. Vaheta vahekaarti, et näha seda teisiti.</p>${tabs}
  <div id="panel" role="tabpanel" aria-labelledby="tab-${v}" class="panel">${body}</div></section>
  ${veel(p)}${eeldused()}${ui.saadetud ? aitah() : tagasiside(p)}`;
}

function kalk(p, vaj) {
  const lisa = lisaSumma();
  return `<div class="kv"><span>Riiklik pension (${p.RP}-aastaselt)</span><span>${eur(p.riikKuu)}</span>
  <span>Sammastest (${p.W}-aastaselt)</span><span>${p.korraga ? "korraga" : eur(p.sambaKuu)}</span>
  <span><b>Sissetulek kuus</b></span><span>${eur(p.kuuSissetulek)}</span>
  <span>Põhivajadus</span><span>${eur(ui.s.vajadus)}</span>${lisa ? `<span>Ostukorvi lisad</span><span>${eur(lisa)}</span>` : ""}
  <span><b>Turvaliselt saad kulutada</b></span><span>${eur(p.lubatav)}</span></div>
  <p class="small">„Turvaliselt“ tähendab, et raha jätkub vanuseni ${p.turv}, milleni jõuab 10% sinuvanustest.</p>`;
}

function kaar(p, vaj) {
  // FT visual vocabulary: aegrida (pindgraafik) + sama telje väike graafik (ellujäämine); otse märgistus, hõre ruudustik.
  const a0 = Math.min(p.RP, p.W), rows = p.read.filter((r) => r.vanus >= a0 && r.vanus <= 100);
  const W = 360, L = 40, Rr = 12, T = 60, H1 = 176, GAP = 30, H2 = 54, AX = 22, H = T + H1 + GAP + H2 + AX;
  const own = (r) => r.riik + r.samba, mid = (r) => own(r) + r.saastust, top = (r) => mid(r) + r.puudu;
  const max = Math.max(vaj, ...rows.map(top)) * 1.1;
  const step = max > 3000 ? 1000 : max > 1500 ? 500 : 250, ticks = []; for (let t = step; t <= max; t += step) ticks.push(t);
  const X = (a) => L + ((a - a0) / (100 - a0)) * (W - L - Rr), Y = (v) => T + H1 * (1 - v / max), Y2 = (f) => T + H1 + GAP + H2 * (1 - f);
  const pool = (rows.find((r) => r.elus <= 0.5) || rows.at(-1)).vanus;
  const INK = "#293036", MUTE = "#50565b", GRID = "#e3e8ee", BLUE = "#0072b2", BLUE1 = "#cfe4f3", BLUE2 = "#85bbdf";
  // pensioni/samba algus on astmeline: suur hüpe aastate vahel joonistatakse püstjoonena, mitte kaldu
  const pts = (f) => { const o = []; rows.forEach((r, i) => { const jump = i && [own, mid, top].some((g) => Math.abs(g(r) - g(rows[i - 1])) > 0.1 * max); if (jump) o.push([X(r.vanus), f(rows[i - 1])]); o.push([X(r.vanus), f(r)]); }); return o; };
  const fmt = (a) => a.map(([x, y]) => `${x.toFixed(1)},${Y(y).toFixed(1)}`);
  const area = (hi, lo, fill) => `<polygon points="${fmt(pts(hi)).concat(fmt(pts(lo)).reverse()).join(" ")}" fill="${fill}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="kaar-t kaar-d"><title id="kaar-t">Sinu kuine raha pensionil vanuse järgi</title><desc id="kaar-d">Pindgraafik: oma sissetulek (pension ja sambad), kate säästudest ja puudu jääv osa kuus vanuse järgi, võrdluses sinu vajadusega. All väike graafik: tõenäosus, et oled siis elus. Täpsed numbrid on andmetabelis.</desc>
  <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fdf1dc"/><rect width="2.5" height="6" fill="#e69f00"/></pattern></defs>`;
  // ruudustik (hõre, hairline) + ühik
  svg += `<text x="${L - 6}" y="${T - 10}" text-anchor="end" font-size="11" fill="${MUTE}">€ kuus</text>`;
  for (const t of ticks) svg += `<line x1="${L}" x2="${W - Rr}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}" stroke-width="1"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" fill="${MUTE}">${t}</text>`;
  // ribad: oma sissetulek, säästudest, puudu
  svg += area(own, () => 0, BLUE1) + area(mid, own, BLUE2) + area(top, mid, "url(#hatch)");
  svg += `<polyline points="${fmt(pts(own)).join(" ")}" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linejoin="round"/>`;
  svg += `<line x1="${L}" x2="${W - Rr}" y1="${Y(0)}" y2="${Y(0)}" stroke="${MUTE}" stroke-width="1"/><text x="${L - 6}" y="${Y(0) + 4}" text-anchor="end" font-size="11" fill="${MUTE}">0</text>`;
  // vajaduse joon, otse märgistus
  svg += `<line x1="${L}" x2="${W - Rr}" y1="${Y(vaj)}" y2="${Y(vaj)}" stroke="${INK}" stroke-width="2"/>`;
  svg += `<text x="${W - Rr}" y="${Y(vaj) - 7}" text-anchor="end" font-size="12" font-weight="700" fill="${INK}" paint-order="stroke" stroke="#fff" stroke-width="4">Vajadus ${eur(vaj)}</text>`;
  // vertikaalid läbi mõlema paneeli + sildid üleval (kaks rida, ei põrku)
  const guide = (a, txt, row) => { const ly = T - 28 - row * 15; return `<line x1="${X(a)}" x2="${X(a)}" y1="${ly + 4}" y2="${T + H1 + GAP + H2}" stroke="${INK}" stroke-width="1" opacity=".55"/><text x="${X(a) - 4}" y="${ly}" text-anchor="end" font-size="11" font-weight="600" fill="${INK}">${txt}</text>`; };
  svg += guide(pool, `Pooled elavad kauem kui ${pool}`, 0);
  if (p.turv < 100) svg += guide(p.turv, `10% elab kauem kui ${p.turv}: „elu lõpuni“`, 1);
  // raha otsas: ring ees vajaduse joonel
  if (p.otsas && p.otsas <= 100) { const x = X(p.otsas), y = Y(vaj); svg += `<circle cx="${x}" cy="${y}" r="6" fill="#a64b00" stroke="#fff" stroke-width="2"/><text x="${Math.min(x + 9, W - Rr - 76)}" y="${y + 20}" font-size="11.5" font-weight="700" fill="#a64b00" paint-order="stroke" stroke="#fff" stroke-width="4">Raha otsas ${p.otsas}</text>`; }
  // väike paneel: tõenäosus, et oled elus
  const pr = rows.map((r) => `${X(r.vanus).toFixed(1)},${Y2(r.elus).toFixed(1)}`);
  svg += `<text x="${L - 6}" y="${T + H1 + GAP - 8}" text-anchor="end" font-size="11" fill="${MUTE}">Elus</text>`;
  for (const f of [1, 0.5, 0.1]) svg += `<line x1="${L}" x2="${W - Rr}" y1="${Y2(f)}" y2="${Y2(f)}" stroke="${GRID}" stroke-width="1"/><text x="${L - 6}" y="${Y2(f) + 4}" text-anchor="end" font-size="11" fill="${MUTE}">${Math.round(f * 100)}%</text>`;
  svg += `<polygon points="${pr.join(" ")} ${X(100)},${Y2(0)} ${X(a0)},${Y2(0)}" fill="#dfe5eb"/><polyline points="${pr.join(" ")}" fill="none" stroke="${MUTE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><line x1="${L}" x2="${W - Rr}" y1="${Y2(0)}" y2="${Y2(0)}" stroke="${MUTE}" stroke-width="1"/>`;
  for (let a = Math.ceil(a0 / 5) * 5; a <= 100; a += 5) svg += `<text x="${X(a)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${MUTE}">${a}</text>`;
  svg += `<line id="ch-line" x1="0" x2="0" y1="${T - 4}" y2="${T + H1 + GAP + H2}" stroke="${INK}" stroke-width="1" visibility="hidden"/></svg>`;
  ui._ch = { a0, rows, W, L, Rr, vaj, turv: Math.min(100, p.turv) };
  const pt = [[p.W, p.W === p.RP ? "Pension ja sambad algavad" : (p.korraga ? "Sambad korraga" : "Sambad algavad"), p.W === p.RP ? `${eur(p.kuuSissetulek)} kuus` : eur(p.sambaKuu) + " kuus"]];
  if (p.W !== p.RP) pt.push([p.RP, "Riiklik pension algab", eur(p.riikKuu) + " kuus"]);
  pt.sort((a, b) => a[0] - b[0]);
  pt.push([pool, "Pooled sinuvanustest elavad kauem", "keskmine eluiga"], [p.turv, "10% elab kauem: „elu lõpuni“", "siia planeerime"]);
  if (p.otsas) pt.push([p.otsas, "Raha saab otsa", `tõenäosus elada nii kaua ${Math.round(p.elusOtsas * 100)}%`]);
  const tr = rows.filter((r) => r.vanus % 5 === 0 || r.vanus === a0).map((r) => `<tr><th scope="row">${r.vanus}</th><td>${eur(own(r))}</td><td>${eur(r.saastust)}</td><td>${eur(r.puudu)}</td><td>${Math.round(r.elus * 100)}%</td></tr>`).join("");
  return `<div class="chart-fig"><p class="ch-t">Kui palju raha sul pensionil kuus on</p><p class="ch-s">Tänases rahas. Puudu jääb see osa vajadusest, mida ei kata ei pension, sambad ega säästud.</p>
  <div class="chart-wrap" id="chart" tabindex="0" role="group" aria-label="Graafik. Nooleklahvidega saad vaadata vanuseid.">${svg}</div>
  <div id="ch-tip" class="ch-tip" aria-live="off"><p class="ph">Puuduta graafikut või vali sellel nooleklahvidega vanus, et näha täpseid numbreid.</p></div>
  <ul class="legend"><li><i style="background:${BLUE1};box-shadow:inset 0 2px 0 ${BLUE}"></i>Pension ja sambad</li><li><i style="background:${BLUE2}"></i>Katab säästudest</li>${rows.some((r) => r.puudu > 0.5) ? `<li><i style="background:repeating-linear-gradient(45deg,#e69f00 0 2.5px,#fdf1dc 2.5px 6px)"></i>Puudu</li>` : ""}<li><i class="ln"></i>Vajadus</li></ul></div>
  <details class="det"><summary>Andmed tabelina</summary><div class="tw"><table class="tbl"><thead><tr><th scope="col">Vanus</th><th scope="col">Pension + sambad</th><th scope="col">Säästudest</th><th scope="col">Puudu</th><th scope="col">Elus</th></tr></thead><tbody>${tr}</tbody></table></div></details>
  <h3>Otsustuspunktid</h3><ol class="pts">${pt.map(([a, t, s]) => `<li><b>${a}</b><span>${t}<small>${s}</small></span></li>`).join("")}</ol>`;
}

// graafiku vihje: osuta või nooleklahvid → kõik numbrid selle vanuse kohta (tabel katab sama sisu ilma vihjeta)
function chartTip(age, quiet) {
  const c = ui._ch, wrap = document.getElementById("chart"); if (!c || !wrap) return;
  const r = c.rows.find((x) => x.vanus === age); if (!r) return;
  ui._chAge = age;
  const svg = wrap.querySelector("svg"), line = document.getElementById("ch-line"), tip = document.getElementById("ch-tip");
  const xv = c.L + ((age - c.a0) / (100 - c.a0)) * (c.W - c.L - c.Rr);
  line.setAttribute("x1", xv); line.setAttribute("x2", xv); line.setAttribute("visibility", "visible");
  tip.textContent = "";
  const add = (k, v, cls = "") => { const d = document.createElement("div"); d.className = "tr " + cls; const a = document.createElement("span"); a.textContent = k; const b = document.createElement("b"); b.textContent = v; d.append(a, b); return d; };
  const h = document.createElement("div"); h.className = "th"; h.textContent = age + "-aastaselt, elus " + Math.round(r.elus * 100) + "%"; tip.append(h);
  const g = document.createElement("div"); g.className = "g";
  g.append(add("Pension ja sambad", eur(r.riik + r.samba)), add("Katab säästudest", eur(r.saastust)), add("Puudu", eur(r.puudu), r.puudu > 0.5 ? "bad" : ""), add("Sinu vajadus", eur(c.vaj)));
  tip.append(g);
  if (!quiet) say(`${age}-aastaselt: ${eur(r.riik + r.samba)} pensioni ja sammastest, ${eur(r.saastust)} säästudest${r.puudu > 0.5 ? ", " + eur(r.puudu) + " puudu" : ""}.`);
}
const ageAt = (e) => { const c = ui._ch, svg = document.querySelector("#chart svg"); if (!c || !svg) return null; const b = svg.getBoundingClientRect(), xv = ((e.clientX - b.left) / b.width) * c.W; return Math.max(c.a0, Math.min(100, Math.round(c.a0 + ((xv - c.L) / (c.W - c.L - c.Rr)) * (100 - c.a0)))); };
app.addEventListener("pointermove", (e) => { if (e.target.closest?.("#chart")) { const a = ageAt(e); if (a != null) chartTip(a); } });
app.addEventListener("pointerdown", (e) => { if (e.target.closest?.("#chart")) { const a = ageAt(e); if (a != null) chartTip(a); } });
app.addEventListener("pointerleave", () => {}, true);
app.addEventListener("keydown", (e) => { if (e.target.id !== "chart" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return; const c = ui._ch; e.preventDefault(); const cur = ui._chAge ?? c.a0; chartTip(e.key === "Home" ? c.a0 : e.key === "End" ? 100 : Math.max(c.a0, Math.min(100, cur + (e.key === "ArrowRight" ? 1 : -1)))); });

function korv(p, vaj) {
  const L = p.lubatav, base = ui.s.vajadus, lisa = lisaSumma(), td = toitDelta(), over = vaj > L;
  const pct = Math.min(100, (vaj / Math.max(1, L)) * 100), ruum = L - vaj;
  const sg = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(Math.round(n)) + " €";
  const par = TOIT.filter((i) => tase(i.id) > 1).length, kok = TOIT.filter((i) => tase(i.id) < 1).length;
  const rida = (i) => { const t = tase(i.id), d = i.t[t][1] - i.t[1][1];
    return `<div class="gi"><div class="gi-h"><span class="ic" aria-hidden="true">${i.ic}</span><b>${i.nimi}</b><span class="dl ${d > 0 ? "up" : d < 0 ? "dn" : ""}">${sg(d)}</span></div>
    <div class="g3" role="group" aria-label="${esc(i.nimi)}: vali tase">${i.t.map(([n, h], k) => `<button type="button" data-act="toit" data-id="${i.id}" data-v="${k}" aria-pressed="${t === k}"><span>${n}</span><b>${h} €</b></button>`).join("")}</div></div>`; };
  return `<div class="gh"><p class="lead" style="margin:0"><b>Kui olen vana, ei peaks koonerdama.</b> Vali, mida paned oma toidukorvi. Põhivajaduses on toit tavalisel tasemel, muutused lähevad otse tulemusse.</p>
  <div class="gk"><div class="gk-t"><span>Toit kuus</span><b>${eur(toitSumma())}</b></div>
  <div class="gk-s">${par ? `${par} ${par === 1 ? "asi" : "asja"} paremaks` : ""}${par && kok ? " · " : ""}${kok ? `${kok} ${kok === 1 ? "asi" : "asja"} odavamaks` : ""}${!par && !kok ? "Kõik tavalisel tasemel" : ""}</div></div>
  <div class="row"><button type="button" class="btn" data-act="parim">✨ Täida parim, mis mahub</button><button type="button" class="btn out" data-act="nulli">Nulli</button></div>
  <div class="gl" aria-hidden="true"><span>Koonerdan</span><span>Tavaline</span><span>Lubasin endale</span></div></div>
  <div class="gis">${TOIT.map(rida).join("")}</div>
  <p class="small" style="margin:0">Hinnad on näited ühe inimese kohta kuus, mitte kellegi poe hinnad. Põhivajadus ${eur(base)}${td ? `, toidu muutus ${sg(td)}` : ""}${lisa ? `, muud lisad ${eur(lisa)}` : ""}.</p>
  <details class="det"${lisa ? " open" : ""}><summary>Veel: reis, maakodu, teater jne${lisa ? ` · ${eur(lisa)}` : ""}</summary><div class="det-in"><div class="tiles">${KORV.map((i) => `<button type="button" class="tile" data-act="korv" data-v="${i.id}" aria-pressed="${ui.lisa.has(i.id)}"><span class="ic" aria-hidden="true">${i.ic}</span><span class="nm">${esc(i.nimi)}</span><span class="pr">${i.hind} €</span></button>`).join("")}</div></div></details>
  <div class="bk" aria-live="polite"><div class="between"><b>Kokku vajadus ${eur(vaj)}</b><span class="small">plaan kannab ${eur(L)}</span></div>
  <div class="meter" role="img" aria-label="Kulutused on ${Math.round(pct)}% plaani kandevõimest"><div class="fill ${over ? "over" : ""}" style="width:${pct}%"></div></div>
  <p class="${over ? "bad" : "ok"}">${over ? `Ei mahu: raha jääb puudu ${p.otsas}-aastaselt. Vali odavam tase või lükka pensioni edasi.` : `Mahub. Vaba ruumi on veel ${eur(ruum)} kuus.`}</p></div>`;
}

function eeldused() {
  return `<details class="det card"><summary>Mida mudel eeldab</summary><ul class="small" style="margin:8px 0 0;padding-left:18px">
  <li>Kõik summad on tänases rahas.</li><li>Eluiga: Eurostati 2023 keskmine (mees 15,9, naine 21,1 aastat 65-aastaselt), sinu tervist ei arvestata.</li>
  <li>Fondi reaaltootlus pärast tasu: indeks ${(EELDUSED.fond.indeks * 100).toFixed(1).replace(".", ",")}%, kallis fond ${(EELDUSED.fond.kallis * 100).toFixed(1).replace(".", ",")}% aastas, igal aastal sama.</li>
  <li>Riiklik pension kasvab ${(EELDUSED.pensionKasv * 100).toFixed(1).replace(".", ",")}% aastas üle inflatsiooni. Paindliku pensioni kordajad: Sotsiaalkindlustusamet.</li>
  <li>„Elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest. Pensioniiga on ligikaudne.</li>
  <li>See on häkatoni prototüüp, mitte investeerimisnõu ega Tuleva ametlik teenus.</li></ul></details>`;
}

function tagasiside(p) {
  const f = ui.fb, muud = ui.nahtud.length > 1;
  return `<section class="card" aria-labelledby="h-fb"><h2 id="h-fb">Aita meil seda paremaks teha</h2><p class="small" style="margin:0">Kolm lühikest küsimust, umbes pool minutit.</p>
  <fieldset class="fs"><legend>1. Kas sinu plaan katab vajaduse elu lõpuni?</legend>${seg("katab", [["jah", "Jah"], ["ei", "Ei"], ["eitea", "Ei tea"]], f.katab, "Kas plaan katab")}</fieldset>
  <div class="fs"><p class="lg">2. Kui kindel oled nüüd oma otsuses?</p>${scale("kindlus", f.kindlus, "Üldse mitte", "Väga kindel")}</div>
  <fieldset class="fs"><legend>3. Kumb hirm on sul suurem?</legend><div class="grid2">${[["otsa", "Et raha saab otsa"], ["elamata", "Et jään elamata"], ["molemad", "Mõlemad"], ["kumbki", "Kumbki"]].map(([v, l]) => `<button type="button" class="opt" data-act="hirm" data-v="${v}" aria-pressed="${f.hirm === v}">${l}</button>`).join("")}</div></fieldset>
  ${muud ? `<div class="f">Milline vaade oli kõige selgem?${seg("eelistus", ui.nahtud.map((v) => [v, TAB[v]]), f.eelistus, "Selgeim vaade")}</div>` : ""}
  <label class="f">Mis aitas või segas? <span class="hint">valikuline</span><textarea data-in="kommentaar" maxlength="280" rows="3">${esc(f.kommentaar || "")}</textarea></label>
  <button type="button" class="btn block" data-act="saada">Saada vastused</button></section>`;
}

function aitah() {
  return `<section class="card" aria-labelledby="h-ai"><h2 id="h-ai">Aitäh!</h2><p style="margin:0">Sinu vastus aitab meil leida, milline vaade aitab pensioniotsust teha nii, et seda hiljem ei kahetse.</p>
  <h3>Tead kedagi, kes peaks oma plaani vaatama?</h3><p class="small" style="margin:0">Saada see talle. Ei küsi nime ega e-posti.</p>
  <button type="button" class="btn out block" data-act="jaga">Jaga linki</button><p class="small" id="jaga-teade" role="status" style="margin:0"></p></section>`;
}

// ---------- sündmused ----------
const sisene = (t) => { ui.vaade = t; if (!ui.nahtud.includes(t)) ui.nahtud.push(t); track("start", { enne: ui.kindlusEnne }); };
const H = {
  sugu: (v) => { ui.s.sugu = v; render(); },
  fond: (v) => { ui.s.fond = v; render(); },
  enne: (v) => { ui.kindlusEnne = Number(v); render(); },
  viis: (v) => { ui.viis = v; render(); },
  alusta: () => {
    ui.viga = ""; const a = ui.s.sunniaasta;
    if (!(a >= 1941 && a <= 1996)) { ui.viga = "Sünniaasta peab olema vahemikus 1941–1996."; render(); return; }
    ui.ekraan = "plaan"; sisene(ui.vaade); render(); say("Plaan valmis. " + TAB[ui.vaade] + " avatud.");
  },
  tagasi: () => { ui.ekraan = "algus"; ui.ava = false; render(); },
  tab: (v) => { if (v === ui.vaade) return; sisene(v); render(); say(TAB[v] + " avatud."); },
  kmuuda: (d) => { ui.k = Math.max(-5, Math.min(5, ui.k + Number(d))); render(); },
  toit: (v, b) => { ui.toit[b.dataset.id] = Number(v); render(); const i = TOIT.find((x) => x.id === b.dataset.id); say(`${i.nimi}: ${i.t[Number(v)][0]}. ${plaan(inp()).katab ? "Plaan katab." : "Raha jääb puudu."}`); },
  nulli: () => { ui.toit = {}; ui.lisa = new Set(); render(); say("Korv nullitud, kõik tavalisel tasemel."); },
  parim: () => {
    // alustame kõige odavamast korvist ja täidame odavaimad parandused, kuni plaan veel kannab
    const p0 = plaan(inp()), L = p0.lubatav, fixed = ui.s.vajadus + lisaSumma();
    const t = Object.fromEntries(TOIT.map((i) => [i.id, 0]));
    const cost = () => fixed + TOIT.reduce((a, i) => a + i.t[t[i.id]][1], 0) - TOIT.reduce((a, i) => a + i.t[1][1], 0);
    for (;;) {
      const opts = TOIT.filter((i) => t[i.id] < 2).map((i) => ({ i, d: i.t[t[i.id] + 1][1] - i.t[t[i.id]][1] })).filter((o) => cost() + o.d <= L).sort((a, b) => a.d - b.d);
      if (!opts.length) break; t[opts[0].i.id]++;
    }
    ui.toit = t; render();
    const n = TOIT.filter((i) => t[i.id] > 0).length;
    say(cost() > L ? "Ka odavaim korv ei mahu. Lükka pensioni edasi." : `Täitsin parima korvi, mis mahub: ${n} asja paremal tasemel.`);
  },
  korv: (v) => { ui.lisa.has(v) ? ui.lisa.delete(v) : ui.lisa.add(v); render(); const p = plaan(inp()); say(`Korv ${eur(lisaSumma())}. ${p.katab ? "Plaan katab." : "Raha jääb puudu."}`); },
  katab: (v) => { ui.fb.katab = v; render(); },
  kindlus: (v) => { ui.fb.kindlus = Number(v); render(); },
  hirm: (v) => { ui.fb.hirm = v; render(); },
  eelistus: (v) => { ui.fb.eelistus = v; render(); },
  saada: () => {
    const f = ui.fb;
    if (!f.katab || !f.kindlus || !f.hirm) { ui.viga = "Vasta palun kolmele küsimusele."; render(); document.getElementById("h-fb")?.scrollIntoView({ block: "start" }); return; }
    ui.viga = ""; const p = plaan(inp());
    const oige = f.katab === "eitea" ? 0 : (f.katab === "jah") === p.katab ? 1 : 0;
    track("feedback", { vastus: { katab: f.katab, oige, enne: ui.kindlusEnne || 0, kindlus: f.kindlus, hirm: f.hirm, eelistus: f.eelistus || "", nahtud: ui.nahtud.join(","), kommentaar: (f.kommentaar || "").slice(0, 280) } });
    ui.saadetud = true; render(); document.getElementById("h-ai")?.scrollIntoView({ block: "center" }); say("Aitäh, vastus saadetud.");
  },
  jaga: async () => {
    const url = location.origin + "/?k=jagatud";
    const text = "Kas sinu pensioniplaan katab vajaduse elu lõpuni? Proovi 2-minutilist häkatoni prototüüpi (ei küsi nime ega e-posti):";
    const teade = (t) => { const el = document.getElementById("jaga-teade"); if (el) el.textContent = t; say(t); };
    track("share");
    try { if (navigator.share) { await navigator.share({ title: "Tulevane Mina", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + url); teade("Link kopeeritud. Kleebi see sõnumisse."); }
    catch { teade("Kopeeri link käsitsi: " + url); }
  },
};
app.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && H[b.dataset.act]) H[b.dataset.act](b.dataset.v, b); });
app.addEventListener("keydown", (e) => {
  const t = e.target.closest?.("[role=tab]"); if (!t || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const ks = Object.keys(TAB), i = ks.indexOf(t.dataset.v), n = ks[(i + (e.key === "ArrowRight" ? 1 : ks.length - 1)) % ks.length];
  e.preventDefault(); H.tab(n); app.querySelector(`#tab-${n}`)?.focus();
});
const setIn = (t) => {
  const k = t.dataset.in; if (!k) return false;
  if (k === "kommentaar") { ui.fb.kommentaar = t.value; return false; }
  const n = Number(t.value); if (t.value === "" || !isFinite(n)) return false;
  if (k === "W") ui.W = n; else ui.s[k] = Math.max(0, n);
  return true;
};
app.addEventListener("toggle", (e) => { if (ui.ekraan === "algus" && e.target.matches?.("details.det")) ui.ava = e.target.open; }, true);
app.addEventListener("change", (e) => { if (setIn(e.target) && (ui.ekraan === "plaan" || e.target.dataset.in === "sunniaasta")) render(); });
app.addEventListener("input", (e) => { if (e.target.tagName === "INPUT" && setIn(e.target) && ui.ekraan === "plaan" && e.target.dataset.in !== "sunniaasta") { clearTimeout(ui._t); ui._t = setTimeout(render, 350); } });
render();
