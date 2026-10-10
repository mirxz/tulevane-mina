// Tulevane Mina kalkulaator. Mootor: ./mootor.js (Meelise tuleva-tulevik). Andmekihid: ./andmed/kihid.js.
// Olek: S.v = väärtused, S.src = millisest kihist väärtus tuleb, S.def = alguspunkti vaikeväärtused (taastamiseks).
import * as P from "./mootor.js";
import { ELUTABEL as T } from "./andmed/elutabel.js";
import { riiklikPension, vaikimisiStaaz, vaikimisiVarasemKoef } from "./riiklik.js";
import { RIIK, KIHID, KULUD_KAT, KULUD_META, kuludKokku, FONDITASUD, ALGUSPUNKTID, URI_VAIKIMISI, VARAJAOTUS, TULEVA_FAKTID, varaKohtTurul } from "./andmed/kihid.js";

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("et-EE", { maximumFractionDigits: 0 });
const eur = (v) => nf.format(Math.round(v)).replace(/ /g, " ") + " €";
const pct = (v) => Math.round(v * 100) + "%";
const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString("et-EE");
const pc1 = (v) => (Math.round(v * 1000) / 10).toLocaleString("et-EE") + "%";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Sisendite kirjeldus ----------
const SIGNAL = { sina: "Sina" };
const F = {
  sunniaasta: { l: "Sünniaasta", t: "num", min: 1940, max: 2008, step: 1, ad: "a", help: "Sünniaastast arvutame vanuse, pensioniea reegli ja ellujäämise tõenäosused." },
  sugu: { l: "Sugu", t: "sel", opts: [["N", "Naine"], ["M", "Mees"]], help: "Elada jäänud aastad ja ellujäämise tõenäosus sõltuvad soost (Statistikaamet). Meeste eluiga on lühem, mistõttu fondipensioni maksuvaba periood on lühem." },
  pensionAge: { l: "Pensioniiga", t: "sel", opts: [[65, "65 a"], [66, "66 a"], [67, "67 a"], [68, "68 a"]], help: "Riiklik pension ja väljamaksete algus. Pensioniiga arvutatakse igal aastal uuesti Statistikaameti eluea järgi, seega nooremate jaoks on see ligikaudne." },
  p3Before2021: { l: "III sambaga liitusid", t: "sel", opts: [["1", "enne 2021"], ["0", "2021 või hiljem"]], help: "Enne 2021 liitunul avaneb III sammas 55-aastaselt, hiljem liitunul 60-aastaselt." },
  p2: { l: "II samba vara", t: "num", min: 0, step: 500, ad: "€", help: "Sinu II samba fondide väärtus täna." },
  p3: { l: "III samba vara", t: "num", min: 0, step: 500, ad: "€", help: "Sinu III samba fondide väärtus täna." },
  savings: { l: "Muud säästud", t: "num", min: 0, step: 500, ad: "€", help: "Hoius, aktsiad, fondid väljaspool sambaid. Kasutatakse vajaduse katmiseks pärast riiklikku pensioni ja samba väljamakset." },
  gross: { l: "Brutopalk", t: "num", min: 0, step: 100, ad: "€ kuus", help: "Sissemaksed arvutatakse brutopalgast." },
  p2Rate: { l: "Sinu panus brutopalgast", t: "seg", opts: [[0, "Puudub"], [0.02, "2%"], [0.04, "4%"], [0.06, "6%"]], help: "II samba makse protsent. Riik lisab oma 4% sotsiaalmaksust, kui makse on 2%, 4% või 6%." },
  p3Monthly: { l: "III sambasse", t: "num", min: 0, step: 10, ad: "€ kuus", help: "Sinu igakuine III samba sissemakse. Riik tagastab tulumaksu (22%) kuni 6 000 € aastas või 15% aastatulust." },
  wageGrowth: { l: "Palga reaalkasv", t: "sel", opts: [[0, "ei kasva"], [0.01, "1% aastas"], [0.02, "2% aastas"]], help: "Kui palk kasvab inflatsioonist kiiremini, kasvavad ka sissemaksed." },
  p1Mode: { l: "Riiklik pension", t: "seg", opts: [["calc", "Valemiga"], ["manual", "Sisesta ise"]], help: "Arvutame riikliku pensioni seaduse valemiga (baasosa + aastahind × staažiaastad ja koefitsiendid), sinu palga ja pensionieaga. Kui tead täpset summat (SKA kalkulaator või Pensionikeskus), vali „Sisesta ise“." },
  staaz: { l: "Staaž enne 1999", t: "num", min: 0, max: 45, step: 1, ad: "aastat", help: "Staažiaastad kuni 31.12.1998 (tööraamat). Iga aasta annab 10,477 € pensionile." },
  varasemKoef: { l: "Seni kogutud koefitsiendid", t: "num", min: 0, max: 60, step: 0.5, ad: "aasta × koef", help: "Aastate summa 1999–2025, iga aasta kaalutud koefitsiendiga (1,0 = keskmine sotsiaalmaks). Täpse summa näed SKA iseteenindusest. Vaikimisi eeldame, et suhteline palk on olnud sama mis täna." },
  p1Growth: { l: "Pensioni reaalne indekseerimine", t: "sel", opts: [[0, "0% aastas"], [0.005, "0,5% aastas"], [0.01, "1% aastas"], [0.015, "1,5% aastas"], [0.02, "2% aastas"]], help: "Pensioni indekseeritakse igal 1. aprillil: 80% sotsiaalmaksu kasv + 20% tarbijahinnaindeks. Tänastes eurodes tähendab see pensioni kasvu palkade reaalkasvu 80% võrra. See on suurim ebakindlus riiklikus pensionis." },
  p1Monthly: { l: "Riiklik pension tänaste väärtustega", t: "num", min: 0, step: 10, ad: "€ kuus", link: ["https://iseteenindus.sotsiaalkindlustusamet.ee/self-service/pension-calculator", "SKA kalkulaatorist"], help: "Kuusumma 1. aprilli 2026 väärtustega (aastahind 10,477 €), mida me indekseerime. Sõltub sinu staažist ja sotsiaalmaksust." },
  realReturn: { l: "Eeldatav tootlus aastas", t: "range", min: 0, max: 0.06, step: 0.005, help: "Tootlus pärast inflatsiooni (reaaltootlus). Aktsiate ajalooline reaaltootlus on olnud kõrgem, aga tulevikku ei saa garanteerida." },
  fond: { l: "Fond", t: "sel", opts: FONDITASUD.map((f) => [f.id, f.nimi + " (" + (f.tasu * 100).toLocaleString("et-EE") + "%)"]), help: "Fondi tasu vähendab tootlust igal aastal. Tuleva fondi tasu on 0,28%, Eesti II samba fondide keskmine 0,74%." },
  horizon: { l: "„Elu lõpuni“ tähendab", t: "sel", opts: [[0.25, "vanust, milleni elab 25%"], [0.10, "vanust, milleni elab 10%"], [0.05, "vanust, milleni elab 5%"]], help: "Plaan peab katma vanuseni, milleni jõuab elusalt valitud osa sinuvanustest. Mida väiksem osa, seda hoolikam plaan." },
  household: { l: "Leibkond", t: "sel", opts: [["uksi", "Elan üksi"], ["paar", "Elan paaris (minu osa)"]], help: "Statistikaameti kulud on eraldi üksi ja paaris elavatele pensionäridele." },
  need: { l: "Vajan kokku", t: "num", min: 0, step: 10, ad: "€ kuus", help: "Kui palju raha kuus pensionil vajad, tänastes eurodes. Vaikimisi on pensionäride keskmised kulud, mitte sinu enda." },
};
const GRUPID = [
  { id: "sina", nimi: "Sina", v: ["sunniaasta", "sugu", "pensionAge", "p3Before2021"], ava: true },
  { id: "raha", nimi: "Raha täna", v: ["p2", "p3", "savings"], ava: true },
  { id: "sissetulek", nimi: "Palk ja sissemaksed", v: ["gross", "p2Rate", "p3Monthly", "wageGrowth"], ava: true },
  { id: "riik", nimi: "Riiklik pension (SKA valem)", v: ["p1Mode", "staaz", "varasemKoef", "p1Growth", "p1Monthly"], ava: false, riik: true },
  { id: "eeldus", nimi: "Tootlus ja tasud", v: ["realReturn", "fond", "horizon"], ava: false },
  { id: "vajadus", nimi: "Mida vajad pensionil", v: ["household", "need"], ava: false, kulud: true },
];

// ---------- Olek ----------
const S = { v: {}, src: {}, mark: {}, def: null, cats: [], start: "mitte-steady", scen: "B", open: {} };
GRUPID.forEach((g) => (S.open[g.id] = g.ava));

function ruleAge() { return P.pensionAge(S.v.sunniaasta || 1986).years; }
function fillNeed(kind) {
  S.cats = KULUD_KAT.map((c) => c[S.v.household]);
  S.v.need = kuludKokku(S.v.household);
  S.src.need = "statistika";
  S.mark.need = "Statistikaamet LE205: " + KULUD_META.leibkonnad[S.v.household] + ", uuring " + KULUD_META.uuringuaasta + ", hinnad " + KULUD_META.hinnad + ". Pensionärid kulutavad nii palju, kui sissetulek lubab. Sinu vajadus võib olla suurem.";
  if (kind) S.def.v.need = S.v.need;
}
function deriveDefaults() {
  const by = S.v.sunniaasta, g = S.v.gross || 0;
  const d = {
    staaz: [vaikimisiStaaz(by), "Vaikimisi: tööle asumisest (19-aastaselt) kuni 1998, max 40 aastat. Tead täpsemalt, siis kirjuta üle."],
    varasemKoef: [Math.round(vaikimisiVarasemKoef(by, g) * 10) / 10, "Vaikimisi eeldus: sinu suhteline palk on olnud 1999.–2025. aastal sama mis täna (palk " + eur(g) + "). Täpse summa näed SKA iseteenindusest."],
  };
  for (const [k, [v, m]] of Object.entries(d)) {
    if (S.src[k] === "sina") continue;
    S.v[k] = v; S.src[k] = "eeldus"; S.mark[k] = m;
    if (S.def) { S.def.v[k] = v; S.def.src[k] = "eeldus"; S.def.mark[k] = m; }
  }
}
function applyStart(id) {
  const ap = ALGUSPUNKTID.find((a) => a.id === id) || ALGUSPUNKTID[0];
  S.start = ap.id; S.v = {}; S.src = {}; S.mark = {};
  for (const [k, x] of Object.entries(URI_VAIKIMISI)) { S.v[k] = x.v; S.src[k] = x.kiht; S.mark[k] = x.mark; }
  for (const [k, v] of Object.entries(ap.v)) { S.v[k] = v; S.src[k] = ap.kiht; S.mark[k] = ""; }
  if (ap.v.pensionAge === undefined) { S.v.pensionAge = ruleAge(); S.src.pensionAge = "seadus"; S.mark.pensionAge = "Pensioniea reegel sünniaasta järgi (ligikaudne)."; }
  S.def = { v: {}, src: {}, mark: {} };
  deriveDefaults();
  fillNeed();
  S.def.v = { ...S.v }; S.def.src = { ...S.src }; S.def.mark = { ...S.mark };
}

// ---------- Vorm ----------
function chipHTML(k) {
  const id = S.src[k];
  const nimi = id === "sina" ? "Sina" : (KIHID[id] ? KIHID[id].chip : id);
  return '<span class="chip ' + id + '">' + esc(nimi) + "</span>";
}
function startDetail(ap) {
  const p = ap.pers;
  if (!p) return "<p><strong>" + esc(ap.nimi) + "</strong>: " + esc(ap.kirjeldus) + ". Alguspunkti vahetamine kustutab sinu muudatused.</p>";
  const rows = [
    ["Inimesi grupis", nf.format(p.inimesi).replace(/\u00a0/g, " ") + " (" + pc1(p.osa) + " " + (ap.grupp === "liige" ? "liikmetest" : "mitteliikmetest") + ")"],
    ["Osa grupi kogu varast", pc1(p.aumOsa)],
    ["Lahkunud (raha välja võtnud või viinud)", pct(p.lahkunud)],
    ["Mediaanvanus", p.vanus + " a"],
    ["Mediaanpalk", eur(p.palk) + " kuus"],
    ["Keskmine vara Tuleva fondides", eur(p.aum)],
    ["III samba sissemakse", p.p3Aastas ? eur(p.p3Aastas) + " aastas" : "aruandes puudub"],
    ["Maksab II sambasse kõrgemat määra", pct(p.korgem)],
  ];
  return "<p><strong>" + esc(ap.nimi) + " (" + esc(ap.eesti) + ")</strong>. Need on <em>grupi keskmised</em> Tuleva aruandest, mitte ühe inimese andmed.</p><dl>" +
    rows.map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>").join("") + "</dl>" +
    (p.markus ? '<p class="hint">' + esc(p.markus) + "</p>" : "") +
    '<p class="hint">Allikas: ' + esc(ap.allikas) + ". Alguspunkti vahetamine kustutab sinu muudatused.</p>";
}
function buildForm() {
  const kaart = (a) => '<button type="button" class="pc" data-start="' + a.id + '" aria-pressed="false"><b>' + esc(a.lyhi) + '</b><span class="e">' + esc(a.eesti) + '</span>' +
    (a.pers ? '<span class="f">' + a.pers.vanus + " a · palk " + eur(a.pers.palk) + "<br>vara " + eur(a.pers.aum) + '</span><span class="o">' + pc1(a.pers.osa) + " grupist</span>" : "") + "</button>";
  const grupp = (id, nimi) => '<h3 class="gh">' + nimi + '</h3><div class="pk">' + ALGUSPUNKTID.filter((a) => a.grupp === id).map(kaart).join("") + "</div>";
  $("start").innerHTML =
    '<p class="l" id="startL">Alusta tüüpilisest kogujast</p>' +
    '<div role="group" aria-labelledby="startL">' + grupp("mitteliige", "Tuleva mitteliikmed") + grupp("liige", "Tuleva liikmed") + grupp("muu", "Muud alguspunktid") + "</div>" +
    '<div class="pd" id="startDetail" aria-live="polite"></div>';
  document.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => { applyStart(b.dataset.start); syncForm(true); update(); }));

  $("groups").innerHTML = GRUPID.map((g) =>
    '<div class="grp" data-g="' + g.id + '"><button type="button" class="h" aria-expanded="' + S.open[g.id] + '" aria-controls="gb-' + g.id + '">' +
    '<span class="t">' + esc(g.nimi) + '</span><span class="cnt" id="gc-' + g.id + '"></span>' +
    '<svg class="chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
    '<div class="body" id="gb-' + g.id + '"' + (S.open[g.id] ? "" : " hidden") + '><div class="panel">' + g.v.map(fieldHTML).join("") +
    (g.riik ? '<div class="pb" id="p1Break"></div>' : "") + (g.kulud ? '<details id="catsBox"><summary class="linkbtn" style="display:inline-block;margin-top:12px">Kulud kategooriate kaupa</summary><div class="cats" id="cats"></div></details>' : "") +
    "</div></div></div>").join("");

  document.querySelectorAll(".grp > button.h").forEach((b) => b.addEventListener("click", () => {
    const g = b.parentElement.dataset.g; S.open[g] = !S.open[g];
    b.setAttribute("aria-expanded", S.open[g]); $("gb-" + g).hidden = !S.open[g];
  }));
  GRUPID.forEach((g) => g.v.forEach(wireField));
  $("cats").innerHTML = KULUD_KAT.map((c, i) =>
    '<div><label for="cat' + i + '">' + esc(c.nimi) + '</label><div class="ig"><input id="cat' + i + '" type="number" min="0" step="5" inputmode="numeric"><span class="ad">€</span></div></div>').join("");
  KULUD_KAT.forEach((c, i) => $("cat" + i).addEventListener("input", () => {
    S.cats[i] = Math.max(0, parseFloat($("cat" + i).value) || 0);
    S.v.need = S.cats.reduce((a, x) => a + x, 0); S.src.need = "sina"; S.mark.need = "Sinu enda sisestatud kulud.";
    syncForm(false, "cat" + i); update();
  }));
}
function fieldHTML(k) {
  const f = F[k];
  let ctl = "";
  if (f.t === "num") ctl = '<div class="ig"><input id="f-' + k + '" type="number" inputmode="numeric" min="' + f.min + '"' + (f.max ? ' max="' + f.max + '"' : "") + ' step="' + f.step + '"><span class="ad">' + esc(f.ad) + "</span></div>";
  else if (f.t === "sel") ctl = '<select id="f-' + k + '" class="sm">' + f.opts.map(([v, n]) => '<option value="' + v + '">' + esc(n) + "</option>").join("") + "</select>";
  else if (f.t === "seg") ctl = '<div class="seg" role="radiogroup" aria-label="' + esc(f.l) + '">' + f.opts.map(([v, n], i) => '<input type="radio" name="f-' + k + '" id="f-' + k + "-" + i + '" value="' + v + '"><label for="f-' + k + "-" + i + '">' + esc(n) + "</label>").join("") + "</div>";
  else if (f.t === "range") ctl = '<div class="range"><input id="f-' + k + '" type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" aria-label="' + esc(f.l) + '"><output id="o-' + k + '" for="f-' + k + '"></output><span class="mark">aktsiate ajalooline tootlus ~7% (enne inflatsiooni)</span></div>';
  const lab = f.t === "seg" ? "" : ' for="f-' + k + '"';
  return '<div class="f" data-k="' + k + '"><div class="lab"><label' + lab + '>' + esc(f.l) + '</label><button type="button" class="q" aria-label="Mis see on? ' + esc(f.l) + '" aria-expanded="false" data-help="' + k + '">?</button>' +
    (f.link ? ' <a class="linkbtn" href="' + f.link[0] + '" target="_blank" rel="noopener">' + esc(f.link[1]) + "</a>" : "") + "</div>" +
    ctl + '<div class="src" id="s-' + k + '"></div><p class="hint" id="h-' + k + '" hidden style="grid-column:1/-1;margin:0">' + esc(f.help) + "</p></div>";
}
function wireField(k) {
  const f = F[k];
  const set = (val) => {
    S.v[k] = val; S.src[k] = "sina"; S.mark[k] = "Sinu sisestatud väärtus.";
    if (k === "sunniaasta" && S.src.pensionAge === "seadus") S.v.pensionAge = ruleAge();
    if (k === "sunniaasta" || k === "gross") deriveDefaults();
    if (k === "household" && S.src.need === "statistika") fillNeed();
    syncForm(false, "f-" + k); update();
  };
  const help = document.querySelector('[data-help="' + k + '"]');
  help.addEventListener("click", () => { const h = $("h-" + k); h.hidden = !h.hidden; help.setAttribute("aria-expanded", String(!h.hidden)); });
  if (f.t === "seg") document.querySelectorAll('input[name="f-' + k + '"]').forEach((r) => r.addEventListener("change", () => set(k === "p1Mode" ? r.value : parseFloat(r.value))));
  else {
    const el = $("f-" + k);
    el.addEventListener("input", () => {
      if (f.t === "num") { const n = parseFloat(el.value); if (isNaN(n)) { if (k === "sunniaasta") return; set(0); return; } set(k === "need" ? Math.max(0, n) : n); if (k === "need") { S.cats = KULUD_KAT.map(() => 0); } }
      else if (f.t === "range") set(parseFloat(el.value));
    });
    if (f.t === "sel") el.addEventListener("change", () => {
      const raw = el.value;
      set(k === "p3Before2021" ? raw === "1" : (["pensionAge", "wageGrowth", "horizon"].includes(k) ? parseFloat(raw) : raw));
    });
  }
}
function resetField(k) {
  S.v[k] = S.def.v[k]; S.src[k] = S.def.src[k]; S.mark[k] = S.def.mark[k];
  if (k === "need") { fillNeed(); }
  if (k === "sunniaasta" && S.src.pensionAge === "seadus") S.v.pensionAge = ruleAge();
  if (k === "sunniaasta" || k === "gross") deriveDefaults();
  syncForm(true); update();
}
function syncForm(all, keepFocus) {
  const ap = ALGUSPUNKTID.find((a) => a.id === S.start);
  document.querySelectorAll("[data-start]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.start === S.start)));
  $("startDetail").innerHTML = startDetail(ap);
  const counts = {};
  for (const g of GRUPID) {
    counts[g.id] = { sina: 0, vaikimisi: 0 };
    for (const k of g.v) {
      const f = F[k], v = S.v[k];
      if (keepFocus !== "f-" + k) {
        if (f.t === "num") $("f-" + k).value = v === 0 && k !== "sunniaasta" ? "0" : String(v);
        else if (f.t === "sel") $("f-" + k).value = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
        else if (f.t === "range") $("f-" + k).value = String(v);
        else if (f.t === "seg") document.querySelectorAll('input[name="f-' + k + '"]').forEach((r) => (r.checked = String(r.value) === String(v)));
      }
      if (f.t === "range") {
        const out = $("o-" + k), inp = $("f-" + k);
        out.textContent = pc1(v);
        const frac = (v - f.min) / (f.max - f.min);
        out.style.left = "calc(" + (frac * 100) + "% + " + (22 - frac * 44) + "px)";
      }
      const hide = (S.v.p1Mode === "manual" && (k === "staaz" || k === "varasemKoef")) || (S.v.p1Mode !== "manual" && k === "p1Monthly");
      document.querySelector('.f[data-k="' + k + '"]').hidden = hide;
      const sEl = $("s-" + k);
      const touched = S.src[k] === "sina";
      counts[g.id][touched ? "sina" : "vaikimisi"]++;
      let extra = "";
      if (k === "pensionAge") extra = " Reegli järgi " + P.pensionAge(S.v.sunniaasta || 1986).label + ".";
      if (k === "sunniaasta") extra = " Vanus täna: " + (P.CURRENT_YEAR - (S.v.sunniaasta || 0)) + ".";
      sEl.innerHTML = chipHTML(k) + "<span>" + esc((touched ? "" : (S.mark[k] || "")) ) + esc(extra) + "</span>" +
        (touched && S.def.v[k] !== undefined && S.def.v[k] !== S.v[k] ? ' <button type="button" class="reset" data-reset="' + k + '">Taasta: ' + esc(KIHID[S.def.src[k]] ? KIHID[S.def.src[k]].chip : "") + "</button>" : "");
    }
    $("gc-" + g.id).textContent = counts[g.id].sina ? counts[g.id].sina + " sinu" : "vaikeväärtused";
  }
  document.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => resetField(b.dataset.reset)));
  // kategooriad
  KULUD_KAT.forEach((c, i) => { if (keepFocus !== "cat" + i) $("cat" + i).value = S.cats[i] ? String(S.cats[i]) : (S.src.need === "sina" ? "" : "0"); });
}

// ---------- Arvutus ----------
function riikArvutus() {
  const manual = S.v.p1Mode === "manual";
  const rho = S.v.p1Growth || 0;
  const r = riiklikPension({ birthYear: S.v.sunniaasta, gross: S.v.gross || 0, pensionAge: S.v.pensionAge, staaz: S.v.staaz, varasemKoef: S.v.varasemKoef, rho });
  return { manual, rho, r, tana: manual ? S.v.p1Monthly : r.tana };
}
function mootoriSisend() {
  const tasu = (FONDITASUD.find((f) => f.id === S.v.fond) || FONDITASUD[0]).tasu;
  return {
    birthYear: S.v.sunniaasta, sex: S.v.sugu, p1Monthly: riikArvutus().tana, p1Growth: S.v.p1Growth || 0, p2: S.v.p2, p3: S.v.p3, p3Before2021: !!S.v.p3Before2021,
    needMonthly: S.v.need, realReturn: S.v.realReturn, pensionAgeYears: S.v.pensionAge, grossMonthly: S.v.gross,
    p2Rate: S.v.p2Rate, p3Monthly: S.v.p3Monthly, fee: tasu, wageGrowth: S.v.wageGrowth, savings: S.v.savings, horizon: S.v.horizon,
  };
}
function skenaariumid() {
  const d = parseInt($("deferral").value, 10);
  return P.SCENARIOS.map((s) => (s.id === "C" ? { ...s, deferral: d } : s));
}
let LAST = null;
function update() {
  const inp = mootoriSisend();
  const age = P.CURRENT_YEAR - inp.birthYear;
  if (!(inp.birthYear >= 1940 && inp.birthYear <= 2008)) { $("answer").className = "answer warn"; $("answer").textContent = "Sisesta sünniaasta vahemikus 1940–2008."; return; }
  const defs = skenaariumid();
  const results = defs.map((s) => ({ ...P.simulate(inp, T, s), sustainable: P.sustainableNeed(inp, T, s) }));
  const act = defs.findIndex((s) => s.id === S.scen);
  const r = results[act];
  LAST = { inp, defs, results, r, age };
  $("deferRow").hidden = S.scen !== "C";
  renderRiik();
  renderAnswer(r, inp); renderMetrics(r); renderTabs(defs); renderChart(r, inp); renderCompare(defs, results);
  renderRank(); renderTimeline(inp); renderLayers(); renderAssumptions(r);
}
function renderRiik() {
  const k = riikArvutus(), R = k.r, el = $("p1Break");
  const row = (a, b, c) => "<tr><th scope=\"row\">" + esc(a) + "</th><td>" + esc(b) + "</td><td>" + esc(c) + "</td></tr>";
  const ind = k.manual ? k.tana * Math.pow(1 + k.rho, Math.max(0, S.v.pensionAge - (P.CURRENT_YEAR - S.v.sunniaasta))) : R.pensionile;
  let h = "<h4>Sinu riiklik pension</h4>";
  if (!k.manual) {
    h += '<table><caption class="sr">Riikliku pensioni osad tänastes eurodes</caption><thead><tr><th scope="col">Osa</th><th scope="col">Arvutus</th><th scope="col">€ kuus</th></tr></thead><tbody>' +
      row("Baasosa", "kõigile sama", eur(R.osad.baas)) +
      row("Staažiosa", S.v.staaz + " a × " + RIIK.aastahind.toString().replace(".", ",") + " €", eur(R.osad.staaz)) +
      row("Seni kogutud", fmt1(S.v.varasemKoef) + " × " + RIIK.aastahind.toString().replace(".", ",") + " €", eur(R.osad.varasem)) +
      row("Tulevik pensionini", fmt1(R.tulevikAastaid) + " a × koef " + fmt1(R.U), eur(R.osad.tulevik)) +
      "</tbody><tfoot><tr><th scope=\"row\" colspan=\"2\">Kokku tänaste väärtustega</th><td>" + eur(R.tana) + "</td></tr></tfoot></table>";
  }
  h += "<p>" + (k.manual ? "Sinu sisestatud " + eur(k.tana) + " tänaste väärtustega" : "Tänaste väärtustega " + eur(R.tana)) + ". Pensionile jäädes (" + S.v.pensionAge + ") on see indekseeritult " + (k.rho ? "umbes " + eur(ind) + " tänastes eurodes" : "sama") + " ning kasvab pärast seda " + pc1(k.rho) + " aastas. Keskmine vanaduspension täna on " + eur(RIIK.keskmineVanaduspension) + ".</p>";
  el.innerHTML = h;
}
function renderAnswer(r, inp) {
  const need = eur(inp.needMonthly), p = [];
  let warn = false;
  if (r.coversNeedUntil === null) p.push("Sinu vajadus (" + need + " kuus) on kaetud <strong>kuni 100. eluaastani</strong>.");
  else if (r.coversNeedUntil <= r.pensionStartAge) { warn = true; p.push("Sinu vajadus (" + need + " kuus) <strong>ei ole kaetud juba pensioni alguses</strong>."); }
  else { warn = r.coversNeedUntil <= r.horizonAge; p.push("Sinu vajadus (" + need + " kuus) on kaetud <strong>kuni " + r.coversNeedUntil + ". eluaastani</strong>. Sinusugusest 100 inimesest elab " + r.coversNeedUntil + "-aastaseks " + Math.round(r.aliveAtShortfall * 100) + "."); }
  if (r.moneyEndAge === null) p.push("Samba raha ei saa enne 100. eluaastat otsa.");
  else p.push("Samba ja hoiuse raha lõpeb " + r.moneyEndAge + "-aastaselt, edasi jääb riiklik pension " + eur(r.incomeAfterMoney) + " kuus.");
  p.push("<strong>Elu lõpuni</strong> (" + r.horizonAge + ". eluaastani) kannab see plaan kuni <strong>" + eur(r.sustainable) + " kuus</strong>.");
  $("answer").className = "answer" + (warn ? " warn" : "");
  $("answer").innerHTML = p.join(" ");
}
function renderMetrics(r) {
  const t = [
    [r.coversNeedUntil === null ? "100+" : r.coversNeedUntil + " a", "vajadus kaetud kuni", r.coversNeedUntil !== null && r.coversNeedUntil <= r.horizonAge],
    [r.moneyEndAge === null ? "ei lõpe" : r.moneyEndAge + " a", "samba ja hoiuse raha lõpeb", false],
    [eur(r.spendAt90), "kuus 90-aastaselt", false],
    [eur(r.sustainable), "kannab elu lõpuni (" + r.horizonAge + " a)", false],
  ];
  $("metrics").innerHTML = t.map(([v, k, red]) => '<div class="metric"><div class="v' + (red ? " red" : "") + '">' + v + '</div><div class="k">' + k + "</div></div>").join("");
}
function renderTabs(defs) {
  $("tabs").innerHTML = defs.map((s) => '<button type="button" aria-pressed="' + (s.id === S.scen) + '" data-id="' + s.id + '"><b>' + s.id + ". " + esc(s.name) + "</b><span>" + esc(s.short) + "</span></button>").join("");
  $("tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { S.scen = b.dataset.id; update(); }));
}

// ---------- Graafik (SVG) ----------
const COL = { i1: "#002f63", i23: "#00aeea", dep: "#9fd8f0", need: "#db2200", alive: "#6b7074" };
let CH = null;
function renderChart(r, inp) {
  const pa = r.pensionStartAge;
  const rows = r.rows.filter((x) => x.age >= pa - 2);
  const W = 640, H = 300, m = { l: 48, r: 40, t: 12, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const top = Math.max(inp.needMonthly, ...rows.map((x) => x.i1 + x.i23 + x.dep)) * 1.12 || 1000;
  const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const ymax = nice(top);
  const bw = iw / rows.length;
  const x = (i) => m.l + i * bw, y = (v) => m.t + ih - (v / ymax) * ih;
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = (ymax / 4) * k; g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e0e6ec"/><text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#6b7074">' + nf.format(v) + "</text>"; }
  for (let k = 0; k <= 4; k++) { g += '<text x="' + (W - m.r + 6) + '" y="' + (m.t + ih - (ih / 4) * k + 4) + '" font-size="11" fill="#6b7074">' + k * 25 + "%</text>"; }
  rows.forEach((d, i) => {
    let acc = 0;
    [["i1", d.i1], ["i23", d.i23], ["dep", d.dep]].forEach(([key, v]) => {
      if (v <= 0) return;
      g += '<rect x="' + (x(i) + 1) + '" y="' + y(acc + v) + '" width="' + Math.max(1, bw - 2) + '" height="' + (y(acc) - y(acc + v)) + '" fill="' + COL[key] + '"/>'; acc += v;
    });
    if (i % Math.ceil(rows.length / 10) === 0) g += '<text x="' + (x(i) + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#6b7074">' + d.age + "</text>";
  });
  g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(inp.needMonthly) + '" y2="' + y(inp.needMonthly) + '" stroke="' + COL.need + '" stroke-width="2" stroke-dasharray="6 4"/>';
  g += '<polyline fill="none" stroke="' + COL.alive + '" stroke-width="2" points="' + rows.map((d, i) => (x(i) + bw / 2) + "," + (m.t + ih - d.alive * ih)).join(" ") + '"/>';
  g += '<line id="cur" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="#002f63" stroke-width="1" visibility="hidden"/>';
  $("chart").innerHTML = g;
  $("legend").innerHTML = [["i1", "Riiklik pension"], ["i23", "II ja III sammas"], ["dep", "Hoius ja säästud"]].map(([k, n]) => '<span><i style="background:' + COL[k] + '"></i>' + n + "</span>").join("") +
    '<span><i style="background:' + COL.need + '"></i>Vajadus</span><span><i style="background:' + COL.alive + '"></i>Tõenäosus olla elus (parem telg)</span>';
  CH = { rows, m, iw, bw, W, idx: Math.min(rows.length - 1, rows.findIndex((d) => d.age >= pa) < 0 ? 0 : rows.findIndex((d) => d.age >= pa)) };
  showAt(CH.idx, false);
}
function showAt(i, mark) {
  if (!CH) return;
  i = Math.max(0, Math.min(CH.rows.length - 1, i)); CH.idx = i;
  const d = CH.rows[i], cx = CH.m.l + i * CH.bw + CH.bw / 2, cur = $("chart").querySelector("#cur");
  cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); cur.setAttribute("visibility", "visible");
  $("readout").innerHTML = "<strong>" + d.age + "-aastaselt (" + d.year + ")</strong>: riiklik " + eur(d.i1) + " · II ja III " + eur(d.i23) + " · hoiuselt " + eur(d.dep) + " · vajadus " + eur(LAST.inp.needMonthly) +
    (d.shortfall > 0.5 ? ' · <strong style="color:#db2200">puudu ' + eur(d.shortfall) + "</strong>" : "") + " · elus " + pct(d.alive);
}
function chartPointer(e) {
  if (!CH) return; const r = $("chart").getBoundingClientRect();
  const px = ((e.clientX - r.left) / r.width) * CH.W;
  showAt(Math.floor((px - CH.m.l) / CH.bw));
}
$("chart").addEventListener("pointermove", chartPointer);
$("chart").addEventListener("click", chartPointer);
$("chart").addEventListener("keydown", (e) => {
  if (!CH) return;
  if (e.key === "ArrowRight") { showAt(CH.idx + 1); e.preventDefault(); }
  if (e.key === "ArrowLeft") { showAt(CH.idx - 1); e.preventDefault(); }
});

// ---------- Võrdlus, asukoht, otsuste kaart, kihid ----------
function renderCompare(defs, results) {
  const rows = [
    ["Vajadus kaetud kuni", (r) => (r.coversNeedUntil === null ? 101 : r.coversNeedUntil), (v) => (v > 100 ? "100+" : v + " a"), "max"],
    ["Samba raha lõpeb", (r) => (r.moneyEndAge === null ? 101 : r.moneyEndAge), (v) => (v > 100 ? "ei lõpe" : v + " a"), "max"],
    ["Kuus 90-aastaselt", (r) => r.spendAt90, eur, "max"],
    ["Kannab elu lõpuni, kuus", (r) => r.sustainable, eur, "max"],
    ["Oodatav kogukulutus", (r) => r.expectedLifetime, eur, "max"],
  ];
  const head = "<thead><tr><th></th>" + defs.map((s) => "<th>" + s.id + ". " + esc(s.name) + "</th>").join("") + "</tr></thead>";
  const body = rows.map(([label, get, fmt]) => {
    const vals = results.map(get), top = Math.max(...vals), uniq = vals.filter((v) => v === top).length < vals.length;
    return '<tr><th scope="row" style="font-weight:400">' + label + "</th>" + vals.map((v) => '<td class="' + (uniq && v === top ? "best" : "") + '">' + fmt(v) + "</td>").join("") + "</tr>";
  }).join("");
  $("compare").innerHTML = head + "<tbody>" + body + "</tbody>";
}
function renderRank() {
  const x = (S.v.p2 || 0) + (S.v.p3 || 0), k = varaKohtTurul(x);
  let t;
  if (x <= 0) t = "Sinu II ja III samba vara on täna 0 €. Sellised on <strong>" + pct(k.nullis) + "</strong> Eesti kogujatest.";
  else t = "Sinu II ja III samba vara (" + eur(x) + ") on suurem kui vähemalt <strong>" + pct(k.vahemalt) + "</strong> Eesti kogujatest (kõik vanused kokku).";
  $("rank").innerHTML = '<p style="margin:0">' + t + '</p><div class="bar" aria-hidden="true"><i style="width:' + Math.round(k.vahemalt * 100) + '%"></i><b style="left:calc(' + Math.round(k.vahemalt * 100) + '% - 1px)"></b></div>' +
    '<p class="hint">Eesti kõigil kogujatel on vara mediaan ' + eur(VARAJAOTUS.mediaan) + ", neil, kellel vara on, " + eur(VARAJAOTUS.mediaanNullita) + ". Tuleva liikmete keskmine vara on " + eur(TULEVA_FAKTID.keskmineLiige) + ", mitteliikmetel " + eur(TULEVA_FAKTID.keskmineMitteliige) + ". Vanuse lõiget raportis ei ole, seega sinuvanuste võrdlus puudub.</p>" +
    '<p class="hint">Mida teised teevad: Tuleva fondidest pensionieas välja võetud rahast on umbes <strong>' + pct(TULEVA_FAKTID.uhekordneOsa) + '</strong> ühekordsed väljamaksed (eurodes, jaanuar 2023 – märts 2026). See on viis A.</p>' +
    '<p class="hint">Allikad: ' + esc(VARAJAOTUS.allikas) + "; savers_analysis; fund_flow_analysis.</p>";
}
function renderTimeline(inp) {
  $("timeline").innerHTML = P.decisionMap(inp).map((d) =>
    '<li><div class="when">' + d.age + "-aastaselt · " + d.year + (d.year < P.CURRENT_YEAR ? '<span class="past">avanenud</span>' : "") + '</div><div style="font-weight:500">' + esc(d.title) + "</div><p>" + esc(d.text) + "</p></li>").join("");
}
function renderLayers() {
  const order = ["sina", "konto", "tuleva", "statistika", "seadus", "eeldus"];
  const by = {};
  for (const id of order) by[id] = [];
  Object.keys(F).forEach((k) => { const s = S.src[k]; if (by[s]) by[s].push(F[k].l); });
  $("kihid").innerHTML = order.map((id) => {
    const L = KIHID[id], used = by[id];
    return '<li><div class="hd"><span class="chip ' + id + '">' + esc(L.chip) + "</span><span>" + esc(L.nimi) + '</span><span class="n">' + used.length + " sisendit</span></div>" +
      "<p>" + esc(L.allikas) + "</p>" +
      (used.length ? '<div class="used">Selles kalkulaatoris: ' + esc(used.join(", ")) + ".</div>" : "") +
      (L.sisu.length ? "<details><summary class=\"hint\" style=\"cursor:pointer\">Mis selles kihis on</summary><ul>" + L.sisu.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul></details>" : "") + "</li>";
  }).join("");
}
function renderAssumptions(r) {
  const tasu = (FONDITASUD.find((f) => f.id === S.v.fond) || FONDITASUD[0]);
  $("eeldused").innerHTML = [
    "Summad on tänastes eurodes. Riiklik pension on indekseeritud, samba vara kasvab reaaltootlusega " + pc1(S.v.realReturn) + ", millest on maha arvatud fondi tasu " + pc1(tasu.tasu) + ".",
    "Sissemaksed jätkuvad pensionini (II sammas: sinu makse + riigi 4%, III sammas: sinu kuumakse). Palga reaalkasv " + pc1(S.v.wageGrowth) + " aastas.",
    "Kulude vaikeväärtus: Statistikaamet LE205 (uuring " + KULUD_META.uuringuaasta + ", hinnad " + KULUD_META.hinnad + "). See näitab, mida pensionärid keskmiselt kulutavad, mitte seda, mida sina vajad.",
    "Igal aastal kulutad oma vajaduse: esmalt riiklik pension, siis samba plaanijärgne väljamakse, siis hoius, siis lisaväljamakse sambast (10% tulumaks). Ülejääk läheb hoiusele.",
    "„Elu lõpuni“ on vanus, milleni jõuab elusalt " + pct(S.v.horizon) + " sinuvanustest (praegu " + r.horizonAge + "). Statistikaamet RV046, " + T.aasta + "; perioodi elutabel pigem alahindab tegelikku eluiga.",
    "Riiklik pension: baasosa " + RIIK.baasosa.toString().replace(".", ",") + " € + " + RIIK.aastahind.toString().replace(".", ",") + " € × (staažiaastad + aastakoefitsientide summa), 1. aprilli 2026 väärtustega. Koefitsient = sinu palk ÷ keskmine sotsiaalmaksu aluseks olev palk (aastas " + RIIK.keskmineSotsmaksPk.toString().replace(".", ",") + " €); alates 2021 on pooled palgaosa ja pooled võrdne osa. Indekseerimine " + pc1(S.v.p1Growth || 0) + " aastas on projekti eeldus, mitte seadus.",
    "Edasilükkamise tõusud on SKA 2026 keskmised. Pensionäri maksuvaba tulu ja kindlustuslepingut ei arvestata.",
    "Tuleva aruannete numbrid on grupikeskmised avalikest agregaatidest. Need ei kirjelda sind ja neid ei tohi avalikult kasutada ilma Tuleva loata.",
  ].map((s) => "<li>" + esc(s) + "</li>").join("");
}

$("deferral").addEventListener("change", update);
applyStart(S.start);
buildForm();
syncForm(true);
update();
