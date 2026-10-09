// Tulevane Mina – häkatoni prototüüp 9.10: kolm vaadet samale plaanile.
// JTBD: „Kui pean otsustama, millal ja kuidas oma pensioniraha kasutama hakata, tahan näha, kas mu plaan katab vajaduse
// elu lõpuni, et teha otsus, mida ma enam hiljem ei kahetse.“ Emotsioon: „Kui olen vana, ei peaks koonerdama.“
// Vaated: kalk (klassikaline kalkulaator), kaar (elustandard elukaarel + otsustuspunktid), korv (millist ostukorvi saan endale lubada).
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
  pohi: 800, korv: new Set(["reis", "lapsed"]), fb: {}, saadetud: false, viga: "",
};
const inp = () => ({ ...ui.s, k: ui.k, W: ui.W ?? pensioniiga(ui.s.sunniaasta), viis: ui.viis, vajadus: ui.vaade === "korv" ? korvSumma() : ui.s.vajadus });
const korvSumma = () => ui.pohi + KORV.filter((i) => ui.korv.has(i.id)).reduce((a, i) => a + i.hind, 0);

// ---------- vaated ----------
function render() {
  const prev = ui._last;
  const focusKey = document.activeElement?.dataset?.k, focusIn = document.activeElement?.dataset?.in;
  app.innerHTML = (ui.viga ? `<p class="note" role="alert">${esc(ui.viga)}</p>` : "") + ({ algus, vaade, tagasiside, aitah })[ui.ekraan]();
  app.querySelectorAll("[data-act]").forEach((el) => (el.dataset.k = [el.dataset.act, el.dataset.v || ""].join("|")));
  const key = ui.ekraan + ui.vaade;
  if (key !== prev) { ui._last = key; const h = app.querySelector("h1, h2"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  else if (focusIn) { const el = app.querySelector(`[data-in="${focusIn}"]`); if (el) { el.focus({ preventScroll: true }); try { const n = el.value.length; el.setSelectionRange?.(n, n); } catch {} } }
  else if (focusKey) { const el = [...app.querySelectorAll("[data-k]")].find((x) => x.dataset.k === focusKey); if (el) el.focus({ preventScroll: true }); }
}

const num = (id, label, val, opts = "") => `<label class="f">${label}<input type="number" inputmode="numeric" data-in="${id}" value="${val}" ${opts}></label>`;
const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join("")}</div>`;
const scale = (act, cur, lo, hi) => `<div class="scale" role="group">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-act="${act}" data-v="${n}" aria-pressed="${cur === n}" aria-label="${n} viiest">${n}</button>`).join("")}</div><div class="scale-l"><span>${lo}</span><span>${hi}</span></div>`;

function algus() {
  const s = ui.s, R = pensioniiga(s.sunniaasta);
  return `<section class="hero"><h1>Kas su plaan katab vajaduse elu lõpuni?</h1>
  <p>Kui pead otsustama, millal ja kuidas pensioniraha kasutama hakata, näitame, kui kaugele su raha jätkub. Ja kas sa ei koonerda asjata.</p>
  <p class="small">Kasutame ainult neid andmeid, mis siia sisestad. Need jäävad sinu telefoni, me ei salvesta neid.</p></section>
  <section class="card" aria-labelledby="h-sina"><h2 id="h-sina">Sinu andmed</h2>
  <div class="grid2">${num("sunniaasta", "Sünniaasta", s.sunniaasta, 'min="1941" max="1996"')}
  <div class="f" style="font-size:14px">Sugu (eluea statistika jaoks)${seg("sugu", [["M", "Mees"], ["N", "Naine"]], s.sugu)}</div></div>
  <p class="small">Sinu pensioniiga on ligikaudu <b>${R}</b> aastat.</p>
  ${num("pension", "Oodatav riiklik pension õigel ajal, € kuus", s.pension, 'min="0" max="5000" step="10"')}
  <p class="small">Vaata oma prognoosi Sotsiaalkindlustusameti iseteenindusest. Näide: 800 €.</p>
  <div class="grid2">${num("sammas", "II ja III samba vara kokku, €", s.sammas, 'min="0" step="1000"')}${num("sast", "Muud säästud, €", s.sast, 'min="0" step="1000"')}</div>
  ${num("sissemakse", "Sissemakse sammastesse kuni väljamakseni, € kuus", s.sissemakse, 'min="0" step="10"')}
  <div class="f" style="font-size:14px">Fond${seg("fond", [["indeks", "Indeksfond (tasu 0,3%)"], ["kallis", "Kallis fond (1%)"]], s.fond)}</div></section>
  <section class="card" aria-labelledby="h-enne"><h2 id="h-enne">Enne kui vaatame</h2>
  <p style="margin:0">Kui kindel oled praegu, et su raha jätkub elu lõpuni?</p>${scale("enne", ui.kindlusEnne, "Üldse mitte", "Väga kindel")}</section>
  <button type="button" class="btn block" data-act="alusta">Näita minu plaani</button>`;
}

function otsused(p, kompaktne) {
  const R = p.R, Wmin = Math.max(60, p.vanus), Wopts = [];
  for (let w = Wmin; w <= R + 5; w++) Wopts.push(w);
  return `<div class="grid2">
  <label class="f">Riiklik pension algab<select data-in="k">${[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((k) => `<option value="${k}" ${k === ui.k ? "selected" : ""}>${R + k} a${k ? ` (${Math.abs(k)} a ${k < 0 ? "varem" : "hiljem"}, ${k < 0 ? "−" : "+"}${Math.abs(Math.round(COEF[k] * 1000) / 10).toString().replace(".", ",")}%)` : " (õigel ajal)"}</option>`).join("")}</select></label>
  <label class="f">Sammaste väljamakse algab<select data-in="W">${Wopts.map((w) => `<option value="${w}" ${w === p.W ? "selected" : ""}>${w} a</option>`).join("")}</select></label></div>
  <div class="f" style="font-size:14px">Kuidas sammastest raha võtad${seg("viis", [["fondipension", "Igakuiselt (fondipension, maksuvaba)"], ["korraga", "Korraga (10% tulumaks)"]], ui.viis)}</div>
  ${kompaktne ? "" : `<p class="small">Fondipension jagab samba vara su eeldatava allesjäänud elueaga; ülejäänu kasvab edasi. Korraga võetud raha läheb säästudesse.</p>`}`;
}

function verdict(p, vajadus) {
  const L = p.lubatav, yle = L - vajadus;
  const pea = p.katab
    ? `<div class="verdict ok"><b>Plaan katab vajaduse elu lõpuni.</b><span>Raha jätkub vähemalt ${p.turv}-aastaseks. Nii kaua elab 10% sinuvanustest.</span></div>`
    : (() => { const pu = p.read.filter((r) => r.puudu > 1).map((r) => r.vanus), a = pu[0], z = pu.at(-1), ajut = z < p.turv - 1;
        return `<div class="verdict no"><b>${ajut ? `Raha jääb puudu ${a === z ? a + "-aastaselt" : a + "–" + z + "-aastaselt"}, hiljem jätkub.` : `Raha jääb puudu alates ${a}-aastasest.`}</b><span>${ajut ? "Puudujääk tekib enne, kui kõik sissetulekud on alanud. " : ""}Tõenäosus, et elad ${a}-aastaseks: ${Math.round(p.elusOtsas * 100)}%.</span></div>`; })();
  const kooner = p.katab && yle >= 50 ? `<p style="margin:0">Ära koonerda: sa võiksid kulutada <b>${eur(yle)}</b> kuus rohkem ja raha jätkuks ikka.</p>` : "";
  return pea + kooner;
}

function vaade() {
  const p = plaan(inp()), v = ui.vaade, vaj = inp().vajadus;
  let h = `<div class="between"><h1 style="font-size:24px;line-height:32px">${NIMI[v]}</h1><span class="chip">${p.vanus}-aastane, pension ${p.R}</span></div>`;
  if (v === "kalk") h += kalk(p, vaj);
  if (v === "kaar") h += kaar(p, vaj);
  if (v === "korv") h += korv(p, vaj);
  h += `<details class="ass card"><summary>Mida mudel eeldab</summary><ul class="small" style="margin:0;padding-left:18px">
  <li>Kõik summad on tänases rahas.</li><li>Eluiga: Eurostati 2023 keskmine (mees 15,9, naine 21,1 aastat 65-aastaselt), sinu tervist ei arvestata.</li>
  <li>Fondi reaaltootlus pärast tasu: indeks ${(EELDUSED.fond.indeks * 100).toFixed(1).replace(".", ",")}%, kallis fond ${(EELDUSED.fond.kallis * 100).toFixed(1).replace(".", ",")}% aastas, igal aastal sama.</li>
  <li>Riiklik pension kasvab ${(EELDUSED.pensionKasv * 100).toFixed(1).replace(".", ",")}% aastas üle inflatsiooni. Paindliku pensioni kordajad: Sotsiaalkindlustusamet.</li>
  <li>„Elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest. Pensioniiga on ligikaudne.</li>
  <li>See on häkatoni prototüüp, mitte investeerimisnõu.</li></ul></details>
  <button type="button" class="btn block" data-act="valmis">Valmis, vastan kolmele küsimusele</button>`;
  return h;
}

function kalk(p, vaj) {
  return `<section class="card" aria-labelledby="h-k"><h2 id="h-k">Sinu otsused</h2>
  ${num("vajadus", "Mida vajad pensionil kuus, €", ui.s.vajadus, 'min="0" step="50"')}${otsused(p)}</section>
  <section class="card" aria-labelledby="h-t" aria-live="polite"><h2 id="h-t">Tulemus</h2>
  <div class="kv"><span>Riiklik pension (${p.RP} a)</span><span>${eur(p.riikKuu)}</span><span>Sammastest (${p.W} a)</span><span>${p.korraga ? "korraga" : eur(p.sambaKuu)}</span>
  <span><b>Sissetulek kuus</b></span><span>${eur(p.kuuSissetulek)}</span><span>Sinu vajadus</span><span>${eur(vaj)}</span>
  <span>Turvaliselt saad kulutada</span><span>${eur(p.lubatav)}</span></div>${verdict(p, vaj)}</section>`;
}

function kaar(p, vaj) {
  const rows = p.read.filter((r) => r.vanus >= Math.min(p.RP, p.W) - 2 && r.vanus <= 100);
  const W = 360, H = 260, L = 40, T = 14, B = 34, Rr = 8;
  const max = Math.max(vaj, ...rows.map((r) => r.riik + r.samba + r.saastust + r.puudu)) * 1.15;
  const bw = (W - L - Rr) / rows.length, y = (v) => T + (H - T - B) * (1 - v / max), X = (i) => L + i * bw;
  const step = max > 3000 ? 1000 : max > 1500 ? 500 : 250, ticks = []; for (let t = 0; t <= max; t += step) ticks.push(t);
  const ix = (a) => rows.findIndex((r) => r.vanus === a);
  const marks0 = (p.W === p.RP ? 1 : 2) + 2 + (p.otsas ? 1 : 0);
  let svg = `<svg viewBox="0 0 ${W} ${H + 36 + marks0 * 14}" role="img" aria-labelledby="kaar-t kaar-d"><title id="kaar-t">Sinu elustandard elukaarel</title><desc id="kaar-d">Tulpdiagramm sissetulekust vanuse järgi, joon näitab vajadust.</desc>
  <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fdf1dc"/><rect width="3" height="6" fill="#e69f00"/></pattern></defs>`;
  for (const t of ticks) svg += `<line x1="${L}" x2="${W - Rr}" y1="${y(t)}" y2="${y(t)}" stroke="#e3e8ee"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#50565b">${t}</text>`;
  rows.forEach((r, i) => {
    const x = X(i) + 1, w = Math.max(1, bw - 2); let base = 0;
    const seg2 = (v, fill, op = 1) => { if (v <= 0) return ""; const s = `<rect x="${x}" y="${y(base + v)}" width="${w}" height="${y(base) - y(base + v)}" fill="${fill}" fill-opacity="${op}"/>`; base += v; return s; };
    svg += seg2(r.riik, "#002f63") + seg2(r.samba, "#0072b2") + seg2(r.saastust, "#7fb6dc") + seg2(r.puudu, "url(#hatch)");
    if (r.vanus % 5 === 0) svg += `<text x="${X(i) + bw / 2}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="#50565b">${r.vanus}</text>`;
  });
  svg += `<line x1="${L}" x2="${W - Rr}" y1="${y(vaj)}" y2="${y(vaj)}" stroke="#a64b00" stroke-width="2" stroke-dasharray="6 4"/><text x="${W - Rr}" y="${y(vaj) - 6}" text-anchor="end" font-size="11.5" font-weight="600" fill="#a64b00" paint-order="stroke" stroke="#fff" stroke-width="4">vajadus ${Math.round(vaj)} €</text>`;
  const pool = (rows.find((r) => r.elus <= 0.5) || rows.at(-1)).vanus;
  const marks = p.W === p.RP ? [[p.W, "Pension ja sambad"]] : [[p.W, p.korraga ? "Sambad korraga" : "Sambad"], [p.RP, "Riiklik pension"]];
  marks.push([pool, "Pooled elavad kauem"], [p.turv, "10% elab kauem"]);
  if (p.otsas) marks.push([p.otsas, "Raha otsas"]);
  marks.forEach(([a, t], j) => { const i = ix(a); if (i < 0) return; const x = X(i); const right = x > W * 0.62; svg += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B + 22 + j * 14}" stroke="#293036" stroke-width="1" ${j > 1 ? 'stroke-dasharray="3 3"' : ""}/><text x="${right ? x - 3 : x + 3}" y="${H - B + 32 + j * 14}" text-anchor="${right ? "end" : "start"}" font-size="11" font-weight="600" fill="#293036">${t} ${a}</text>`; });
  svg += `</svg>`;
  return `<section class="card" aria-labelledby="h-e"><h2 id="h-e">Sinu elustandard pensionil</h2>
  <div class="chart-wrap" tabindex="0" role="region" aria-label="Elukaare graafik">${svg}</div>
  <ul class="legend"><li><i style="background:#002f63"></i>Riiklik pension</li><li><i style="background:#0072b2"></i>Sammastest</li><li><i style="background:#7fb6dc"></i>Säästudest</li><li><i style="background:repeating-linear-gradient(45deg,#e69f00 0 3px,#fdf1dc 3px 6px)"></i>Puudu</li></ul>
  ${verdict(p, vaj)}</section>
  <section class="card" aria-labelledby="h-o"><h2 id="h-o">Otsustuspunktid</h2>${num("vajadus", "Mida vajad pensionil kuus, €", ui.s.vajadus, 'min="0" step="50"')}${otsused(p)}</section>`;
}

function korv(p, vaj) {
  const L = p.lubatav, pct = Math.min(100, (vaj / Math.max(1, L)) * 100), over = vaj > L;
  const mahub = KORV.filter((i) => !ui.korv.has(i.id) && vaj + i.hind <= L).map((i) => i.nimi.toLowerCase());
  let h = `<section class="card" aria-labelledby="h-kv"><h2 id="h-kv">Millist ostukorvi saad endale lubada?</h2>
  <p class="small">Pane korvi, mida tahad pensionil teha. Hinnad on näited tänases rahas, kuus.</p>
  <div class="items"><div class="item fixed"><span class="ic" aria-hidden="true">🏠</span><span>Põhikulud: kodu, toit, kommunaalid, ravimid</span><span class="pr"><label class="sr" for="pohi">Põhikulud eurodes</label><input id="pohi" type="number" inputmode="numeric" data-in="pohi" value="${ui.pohi}" min="0" step="50" style="width:96px"> €</span></div>`;
  for (const i of KORV) h += `<button type="button" class="item" data-act="korv" data-v="${i.id}" aria-pressed="${ui.korv.has(i.id)}"><span class="ic" aria-hidden="true">${i.ic}</span><span>${esc(i.nimi)}</span><span class="pr">${i.hind} €</span></button>`;
  h += `</div></section>
  <section class="card" aria-labelledby="h-v">${verdict(p, vaj)}
  ${!over && mahub.length ? `<p class="small" style="margin:0">Mahub veel: ${esc(mahub.slice(0, 3).join(", "))}.</p>` : ""}</section>
  <section class="card sticky" aria-labelledby="h-m" aria-live="polite" style="gap:8px;padding:12px 16px"><div class="between"><h2 id="h-m" style="font-size:17px;line-height:22px">Korv ${eur(vaj)} kuus</h2><span class="chip">plaan kannab ${eur(L)}</span></div>
  <div class="meter" role="img" aria-label="Korv ${Math.round(pct)}% plaanist"><div class="fill ${over ? "over" : ""}" style="width:${pct}%"></div></div>
  <p class="${over ? "bad" : "ok"}" style="margin:0;font-size:14px" id="h-v">${over ? `Ei mahu: raha jääb puudu ${p.otsas}-aastaselt` : `Mahub, vaba ruumi ${eur(L - vaj)} kuus`}</p></section>
  <section class="card" aria-labelledby="h-oo"><h2 id="h-oo">Muuda otsuseid</h2><p class="small">Vaata, kuidas pensioni ajastus ja väljamakse viis muudavad korvi suurust.</p>${otsused(p, true)}</section>`;
  return h;
}

function tagasiside() {
  const f = ui.fb, muud = ui.nahtud.length > 1;
  return `<section class="card" aria-labelledby="h-fb"><h1 id="h-fb" style="font-size:24px;line-height:32px">Kolm küsimust</h1>
  <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font-weight:600;margin-bottom:6px">1. Kas sinu plaan katab vajaduse elu lõpuni?</legend>
  ${seg("katab", [["jah", "Jah"], ["ei", "Ei"], ["eitea", "Ei tea"]], f.katab)}</fieldset>
  <div style="display:grid;gap:6px"><p style="margin:0;font-weight:600">2. Kui kindel oled nüüd oma otsuses?</p>${scale("kindlus", f.kindlus, "Üldse mitte", "Väga kindel")}</div>
  <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font-weight:600;margin-bottom:6px">3. Kumb hirm on sul suurem?</legend>
  <div class="grid2">${[["otsa", "Et raha saab otsa"], ["elamata", "Et jään elamata, koonerdan"], ["molemad", "Mõlemad"], ["kumbki", "Kumbki"]].map(([v, l]) => `<button type="button" class="opt" data-act="hirm" data-v="${v}" aria-pressed="${f.hirm === v}">${l}</button>`).join("")}</div></fieldset>
  ${muud ? `<div class="f" style="font-size:14px">Milline vaade aitas kõige rohkem?${seg("eelistus", ui.nahtud.map((v) => [v, NIMI[v]]), f.eelistus)}</div>` : ""}
  <label class="f">Mis aitas või segas? (valikuline)<textarea data-in="kommentaar" maxlength="280" rows="3" style="font:inherit;padding:8px 12px;border:1px solid var(--border-2);border-radius:var(--r)">${esc(f.kommentaar || "")}</textarea></label>
  <p class="small" style="margin:0">Salvestame ainult need vastused ja vaate nime, mitte sinu sisestatud summasid.</p>
  <button type="button" class="btn block" data-act="saada">Saada vastused</button></section>`;
}

function aitah() {
  const muud = VAATED.filter((v) => !ui.nahtud.includes(v));
  const jaga = `<section class="card"><h2>Tead kedagi, kes peaks oma plaani vaatama?</h2><p style="margin:0 0 12px">Saada see talle. Ei küsi nime ega e-posti ja ei salvesta sisestatud summasid.</p><button type="button" class="btn out block" data-act="jaga">Jaga linki</button><p class="small" id="jaga-teade" role="status" style="margin:8px 0 0"></p></section>`;
  return `<section class="hero"><h1>Aitäh!</h1><p>Sinu vastus aitab meil leida, milline vaade aitab pensioniotsust teha nii, et seda hiljem ei kahetse.</p></section>
  ${muud.length ? `<section class="card"><h2>Vaata sama plaani teisiti</h2><div class="grid2">${muud.map((v) => `<button type="button" class="opt" data-act="vaata" data-v="${v}"><b>${NIMI[v]}</b></button>`).join("")}</div></section>` : `<section class="card"><p style="margin:0">Nägid kõiki kolme vaadet. Räägi meile häkatonil, mis jäi meelde!</p></section>`}
  ${jaga}`;
}

// ---------- sündmused ----------
const H = {
  sugu: (v) => { ui.s.sugu = v; render(); },
  fond: (v) => { ui.s.fond = v; render(); },
  enne: (v) => { ui.kindlusEnne = Number(v); render(); },
  alusta: () => { ui.viga = ""; const a = ui.s.sunniaasta; if (!(a >= 1941 && a <= 1996)) { ui.viga = "Sünniaasta peab olema vahemikus 1941–1996."; render(); return; } ui.ekraan = "vaade"; if (!ui.nahtud.includes(ui.vaade)) ui.nahtud.push(ui.vaade); track("start", { enne: ui.kindlusEnne }); render(); say(NIMI[ui.vaade] + " avatud."); },
  viis: (v) => { ui.viis = v; render(); },
  korv: (v) => { ui.korv.has(v) ? ui.korv.delete(v) : ui.korv.add(v); render(); const p = plaan(inp()); say(`Korv ${Math.round(korvSumma())} eurot. ${p.katab ? "Plaan katab." : "Raha jääb puudu."}`); },
  valmis: () => { ui.ekraan = "tagasiside"; ui.fb = {}; render(); },
  katab: (v) => { ui.fb.katab = v; render(); },
  kindlus: (v) => { ui.fb.kindlus = Number(v); render(); },
  hirm: (v) => { ui.fb.hirm = v; render(); },
  eelistus: (v) => { ui.fb.eelistus = v; render(); },
  saada: async () => {
    const f = ui.fb;
    if (!f.katab || !f.kindlus || !f.hirm) { ui.viga = "Vasta palun kolmele küsimusele."; render(); return; }
    ui.viga = ""; const p = plaan(inp());
    const oige = f.katab === "eitea" ? 0 : (f.katab === "jah") === p.katab ? 1 : 0;
    track("feedback", { vastus: { katab: f.katab, oige, enne: ui.kindlusEnne || 0, kindlus: f.kindlus, hirm: f.hirm, eelistus: f.eelistus || "", nahtud: ui.nahtud.join(","), kommentaar: (f.kommentaar || "").slice(0, 280) } });
    ui.ekraan = "aitah"; render();
  },
  jaga: async () => {
    const url = location.origin + "/?k=jagatud";
    const text = "Kas sinu pensioniplaan katab vajaduse elu lõpuni? Proovi 2-minutilist häkatoni prototüüpi (ei küsi nime ega e-posti):";
    const teade = (t) => { const el = document.getElementById("jaga-teade"); if (el) el.textContent = t; say(t); };
    track("share");
    try {
      if (navigator.share) { await navigator.share({ title: "Tulevane Mina", text, url }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + url); teade("Link kopeeritud. Kleebi see sõnumisse."); }
    catch { teade("Kopeeri link käsitsi: " + url); }
  },
  vaata: (v) => { ui.vaade = v; if (!ui.nahtud.includes(v)) ui.nahtud.push(v); ui.ekraan = "vaade"; track("start", { enne: ui.kindlusEnne }); render(); },
};
app.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && H[b.dataset.act]) H[b.dataset.act](b.dataset.v, b); });
const setIn = (t) => {
  const k = t.dataset.in; if (!k) return false;
  if (k === "kommentaar") { ui.fb.kommentaar = t.value; return false; }
  const n = Number(t.value); if (t.value === "" || !isFinite(n)) return false;
  if (k === "k") ui.k = n; else if (k === "W") ui.W = n; else if (k === "pohi") ui.pohi = Math.max(0, n); else ui.s[k] = Math.max(0, n);
  return true;
};
app.addEventListener("change", (e) => { if (setIn(e.target) && (ui.ekraan === "vaade" || e.target.dataset.in === "sunniaasta")) render(); });
app.addEventListener("input", (e) => { if (e.target.tagName === "INPUT" && setIn(e.target) && ui.ekraan === "vaade" && e.target.dataset.in !== "sunniaasta") { clearTimeout(ui._t); ui._t = setTimeout(render, 350); } });
render();
