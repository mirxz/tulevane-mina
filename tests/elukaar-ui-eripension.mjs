// Eripension ja soodustingimustel vanaduspension elukaare kasutajaliideses.
// Kasutus: node tests/elukaar-ui-eripension.mjs [URL]
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const CHART = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext();
await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const base = { birthYear: 1976, sex: "M", p1Monthly: 1000, p2: 40000, p3: 0, p3Joined: "none", grossMonthly: 3000, p2Rate: "0.04", p3Monthly: 0 };
async function setup(vals) {
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__elukaar);
  await page.evaluate((v) => {
    for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
  }, vals);
}
const toResult = () => page.evaluate(() => { const n = document.querySelectorAll("main .chapter").length - 1; document.querySelector(`#path [data-goto="${n}"]`).click(); });
const text = (sel) => page.evaluate((s) => (document.querySelector(s) || {}).textContent || "", sel);

// 1. Ilma eripensionita pole graafikul eripensioni ega tabelis tulpa.
await setup(base); await toResult();
let legend = await page.evaluate(() => Chart.getChart(document.getElementById("chart")).data.datasets.filter((d) => d.label === "Eripension").length);
check(legend === 0, "ilma eripensionita pole graafikul eripensioni andmerida");
check(!/Eripension/.test(await text("#chartTableWrap")), "ilma eripensionita pole tabelis eripensioni tulpa");

// 2. Eripension: graafikul, tabelis, kokkuvõttes, otsusekaardil ja tekstis.
await setup({ ...base, spMonthly: 1000 }); await toResult();
legend = await page.evaluate(() => Chart.getChart(document.getElementById("chart")).data.datasets.find((d) => d.label === "Eripension").data.some((v) => v > 0));
check(legend === true, "eripension on graafikul");
check(/Eripension/.test(await text("#chartTableWrap")), "tabelis on eripensioni tulp");
check(/eripension 1000? ?€ kuus|eripension 1 000 €|eripension/.test(await text("#recap")), "kokkuvõte mainib eripensioni");
check(/Eripension/.test(await text("#chartSummary")) , "graafiku kokkuvõte mainib eripensioni ja maksu");
const body = await page.evaluate(() => document.body.innerText);
check(/eraldi seaduse alusel makstav pension, mitte I samba osa/.test(body), "otsusekaardil on eripensioni selgitus");
const inp = await page.evaluate(() => window.__elukaar.readInput());
check(inp.spMonthly === 1000, "readInput annab eripensioni summa");

// 3. Soodustingimustel: pensioniiga väheneb valitud aastate võrra, kõik valikud töötavad vigadeta.
for (const [val, yrs] of [["1", 1], ["3", 3], ["5", 5], ["10", 10]]) {
  await setup({ ...base, soodus: val });
  const i = await page.evaluate(() => window.__elukaar.readInput());
  check(i.pensionAgeYears === 65 - yrs || i.pensionAgeYears === 66 - yrs || i.pensionAgeYears === 67 - yrs || i.pensionAgeYears === 68 - yrs, "soodus " + val + ": pensioniiga " + i.pensionAgeYears);
  check(i.soodus === yrs, "soodus " + val + ": readInput.soodus");
  await toResult();
  check((await text("#chartTableWrap")).length > 100, "soodus " + val + ": tulemus joonistub");
  check(/Soodustingimustel vanaduspension/.test(await page.evaluate(() => document.body.innerText)), "soodus " + val + ": otsusekaardil on rida");
}
// 4. Pensioniea vihje näitab soodustingimustel iga.
await setup({ ...base, soodus: "3" });
check(/soodustingimustel \d\d a/.test(await text("#paHint")), "pensioniea vihje näitab soodustingimustel iga");
check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nEripension (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
