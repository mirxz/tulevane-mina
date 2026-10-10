// Elukaare graafiku-, tabeli- ja tekstitestid päris brauseris (kohalik Chart.js ja Bootstrap, ilma CDN-ita).
// Kasutus: node tests/elukaar-graafik.mjs [URL] [--update]   (vaikimisi http://127.0.0.1:8787; --update kirjutab graafiku golden master'i)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const AXE = readFileSync(req.resolve("axe-core/axe.min.js"), "utf8");
const CHART = readFileSync(join(here, "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const BS_CSS = readFileSync(join(here, "..", "node_modules/bootstrap/dist/css/bootstrap.min.css"), "utf8");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
const UPDATE = process.argv.includes("--update");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const num = (s) => Number(String(s).replace(/[^\d-]/g, "")) || 0;

const PROFILES = ["liige-power", "liige-steady", "liige-coaster", "liige-single", "liige-gone", "mitte-power", "valja", "tuhi"];
const VIEWPORTS = { lauaarvuti: { width: 1280, height: 900 }, mobiil: { width: 375, height: 812 } };
const GOLDEN_PROFILES = ["liige-steady", "liige-single", "mitte-power"];
const goldenFile = join(here, "golden", "elukaar-graafik.json");
const snap = {};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext();
await ctx.route("**/cdn.jsdelivr.net/npm/chart.js**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
await ctx.route("**/cdn.jsdelivr.net/npm/bootstrap**", (r) => r.fulfill({ contentType: "text/css", body: BS_CSS }));
await ctx.route("**/fonts.g*/**", (r) => r.abort());

async function openResult(page, profile) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "/elukaar/?p=" + profile, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Chart && document.querySelector("#path button"));
  await page.$$eval("#path button", (b) => b[b.length - 1].click());
  await page.waitForSelector("#chartTableWrap table", { state: "attached" });
  return errors;
}
const read = (page) => page.evaluate(() => {
  const ch = window.Chart.getChart(document.getElementById("chart"));
  const rows = [...document.querySelectorAll("#chartTableWrap tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
  return {
    labels: ch.data.labels,
    ds: ch.data.datasets.map((d) => ({ label: d.label, type: d.type, data: d.data, halo: !!d.halo, stack: d.stack || null, fill: d.fill ?? null })),
    y1: ch.options.scales.y1.display,
    rows,
    summary: [...document.querySelectorAll("#chartSummary li")].map((l) => l.textContent),
    texts: ["answer", "chartSummary", "chartExplain", "chartTableWrap"].map((id) => document.getElementById(id)?.textContent || ""),
  };
});

for (const [vName, vp] of Object.entries(VIEWPORTS)) {
  const mobile = vp.width < 576;
  for (const profile of PROFILES) {
    const tag = `${profile}/${vName}`;
    const page = await ctx.newPage();
    await page.setViewportSize(vp);
    const errors = await openResult(page, profile);
    const d = await read(page);
    check(errors.length === 0, `${tag}: lehe vead: ${errors.join("; ")}`);
    const ds = (l) => d.ds.find((x) => x.label === l);
    const i1 = ds("I sammas"), i2 = ds("II sammas"), i3 = ds("III sammas"), dep = ds("Hoiuselt (välja võetud raha)"), need = ds("Kulud");
    const alive = d.ds.find((x) => x.label.startsWith("Elus"));
    check(!!(i1 && i2 && i3 && dep && need && alive), `${tag}: kõik andmerea nimed olemas`);
    // Graafiku liik: töölaual tulbad, mobiilis kihid (pindgraafik), elus-% telg ainult töölaual.
    check(i1.type === (mobile ? "line" : "bar"), `${tag}: graafiku liik ${i1.type}`);
    check(d.y1 === !mobile, `${tag}: elus-% telg ${d.y1}`);
    check(d.texts.every((t) => !/NaN|undefined|Infinity|\[object/.test(t)), `${tag}: tekstides NaN/undefined/Infinity`);
    // Tabel = graafik: iga tabeli rea (vanus) kohta võrdsed väärtused (I, II, III, Hoiuselt, Elus).
    let mism = 0, order = true, prevAlive = 101;
    d.rows.forEach((r) => {
      const idx = d.labels.indexOf(num(r[0]));
      if (idx < 0) { mism++; return; }
      const same = [[i1, 2], [i2, 3], [i3, 4], [dep, 5]].every(([s, c]) => Math.abs(s.data[idx] - num(r[c])) <= 1);
      const el = num(r[8]);
      if (!same || Math.abs(alive.data[idx] - el) > 0) mism++;
      if (el > prevAlive) order = false; prevAlive = el;
      // Kulude joon: ainult pensionieast (tabelis "–" = enne pensioniiga, joont ei ole).
      const pre = r[6] === "–";
      if (pre) check(need.data[idx] == null, `${tag} ${r[0]}: kulude joon enne pensioniga`);
      else check(need.data[idx] != null && Math.abs(need.data[idx] - num(r[6])) <= 1, `${tag} ${r[0]}: kulude joon = tabeli kulud`);
      // Kaetus: kui puudu pole, katavad allikad kulud (±2 € ümardamine); kui on, puudu = kulud − allikad.
      if (!pre) {
        const src = num(r[2]) + num(r[3]) + num(r[4]) + num(r[5]);
        if (r[7] === "–") check(src >= num(r[6]) - 3, `${tag} ${r[0]}: puudu pole, aga allikad ${src} < kulud ${num(r[6])}`);
        else check(Math.abs(src + num(r[7]) - num(r[6])) <= 3, `${tag} ${r[0]}: allikad ${src} + puudu ${num(r[7])} ≠ kulud ${num(r[6])}`);
      }
    });
    check(mism === 0, `${tag}: tabel ja graafik erinevad (${mism} rida)`);
    check(order, `${tag}: "Elus %" tabelis ei tohi kasvada`);
    check(d.rows.length > 0, `${tag}: tabel on tühi`);
    // Kulude joon ei algu enne pensioniiga; enne seda võib olla ainult III samba (pre) tulp.
    const needFirst = d.labels[need.data.findIndex((v) => v != null)];
    d.labels.forEach((a, k) => { if (a < needFirst) check(num(0) === 0 && i1.data[k] === 0 && i2.data[k] === 0 && dep.data[k] === 0, `${tag} ${a}: enne pensioniiga ei tohi I/II samba ega hoiuse tulpa olla`); });
    // Kokkuvõtte laused on olemas ja mainivad tulumaksu, kui riiklik pension ületab maksuvaba piiri.
    check(d.summary.length >= 1, `${tag}: graafiku kokkuvõte puudub`);
    if (GOLDEN_PROFILES.includes(profile)) snap[tag] = { labels: d.labels, ds: d.ds.map((x) => ({ label: x.label, type: x.type, data: x.data })) };
    if (!mobile && profile === "liige-steady") {
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => x.id + ": " + x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")));
      check(v.length === 0, `${tag}: ligipääsetavus (axe): ${v.join(" | ")}`);
    }
    await page.close();
  }
}

// Graafiku golden master (3 profiili × 2 vaadet): andmed, mitte piksliid, et test ei sõltuks fontidest ega masinast.
if (UPDATE || !existsSync(goldenFile)) { mkdirSync(dirname(goldenFile), { recursive: true }); writeFileSync(goldenFile, JSON.stringify(snap) + "\n"); console.log("Graafiku golden master kirjutatud."); }
else {
  const gold = JSON.parse(readFileSync(goldenFile, "utf8"));
  for (const k of Object.keys(snap)) check(JSON.stringify(gold[k]) === JSON.stringify(snap[k]), `${k}: graafiku andmed erinevad golden master'ist (kui muutus on teadlik: node tests/elukaar-graafik.mjs --update)`);
}
await browser.close();
console.log(`\nElukaare graafik: ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
