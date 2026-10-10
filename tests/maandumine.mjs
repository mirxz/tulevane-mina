// Maandumisleht (/) ja algandmete profiilid (/elukaar/?p=...). Kasutus: node tests/maandumine.mjs <URL>   (vaikimisi http://127.0.0.1:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const url = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };
async function a11y(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}
const PROFIILID = { "konto-naidis": 1968, "tuhi": 1986, "valja": 1986, "liige-power": 1984, "liige-steady": 1984, "liige-coaster": 1985, "liige-single": 1980, "liige-gone": 1978, "mitte-power": 1987, "mitte-steady": 1989, "mitte-coaster": 1990, "mitte-single": 1990, "mitte-gone": 1991 };
for (const vp of [{ name: "telefon", width: 375, height: 812 }, { name: "arvuti", width: 1280, height: 800 }]) {
  console.log(`\nMaandumisleht, ${vp.name}`);
  const page = await browser.newPage({ viewport: vp, reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "/", { waitUntil: "domcontentloaded" });
  check((await page.textContent("h1")) === "Tulevane Mina" && (await page.textContent("main")).includes("Kuhu sa sattusid"), "pealkiri ja selgitus");
  check((await page.locator("#level1 > li").count()) === 4, "neli valikut");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "ei kerita külgsuunas");
  const hrefs = await page.locator("#level1 a.profile").evaluateAll((l) => l.map((a) => a.getAttribute("href")));
  check(JSON.stringify(hrefs) === JSON.stringify(["/elukaar/?p=konto-naidis", "/elukaar/?p=liige-steady", "/elukaar/?p=mitte-single", "/elukaar/?p=valja"]), "neli valikut viivad õigetele profiilidele");
  check((await page.locator("#lvl-liige, #lvl-mitte, #btn-liige").count()) === 0, "teist taset enam pole");
  await a11y(page, "algpunkti valik");
  check(errors.length === 0, "lehel pole JS-vigu" + (errors.length ? ": " + errors[0] : ""));
  await page.close();
}
console.log("\nProfiilid viivad elukaarde ja täidavad algandmed");
for (const [id, aasta] of Object.entries(PROFIILID)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "/elukaar/?p=" + id, { waitUntil: "domcontentloaded" });
  const v = await page.inputValue("#birthYear");
  check(v === String(aasta) && (await page.isVisible("#profileNote")) && errors.length === 0, id + ": sünniaasta " + v + ", märge nähtav, vigu pole" + (errors.length ? " (" + errors[0] + ")" : ""));
  await page.close();
}
{
  const page = await browser.newPage();
  await page.goto(url + "/");
  await page.click('#level1 a.profile >> nth=2');
  await page.waitForURL("**/elukaar/?p=mitte-single");
  await page.goto(url + "/elukaar/?p=valja");
  check((await page.inputValue("#p2")) === "0" && (await page.inputValue("#p3")) === "0" && (await page.inputValue("#p2Rate")) === "0", "II samba välja võtnud: II ja III sammas 0, sissemakseid pole");
  await page.goto(url + "/elukaar/?p=liige-steady");
  check((await page.inputValue("#p2")) === "30414", "liige-steady: II sammas täidetud");
    await page.fill("#p2", "20000");
  check((await page.inputValue("#p2")) === "20000", "täidetud välja saab muuta");
  await page.goto(url + "/elukaar/?p=ei-ole"); check(!(await page.isVisible("#profileNote")), "tundmatu profiil ei täida midagi");
  await page.goto(url + "/elukaar/"); check(!(await page.isVisible("#profileNote")), "ilma profiilita vana käitumine");
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
