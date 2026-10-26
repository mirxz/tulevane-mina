// Pensioniea samm: töötan edasi (kõigil, mitte ainult soodustusega) ja riiklik pension täis / pool / edasi.
// Kasutus: node tests/elukaar-ui-too-ja-pool.mjs [URL] [--pilt failinimi.png]
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const CHART = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
const shot = process.argv.includes("--pilt") ? process.argv[process.argv.indexOf("--pilt") + 1] : null;
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext();
await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => { if (!/Chart is not defined/.test(e.message)) errs.push(e.message); });

// Näide: naine 1961, riiklik 1065 €, palk 2500 €, III sammas.
const base = { birthYear: 1961, sex: "N", p1Monthly: 1065, p2: 0, p3: 38724, p3Joined: "before", grossMonthly: 2500, p2Rate: "0", p3Monthly: 500, pensionAgeYears: 65 };
async function setup(vals, radios = {}) {
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  await page.evaluate(([v, r]) => {
    for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    for (const [name, val] of Object.entries(r)) { const el = document.querySelector(`input[name=${name}][value="${val}"]`); if (el) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); } }
  }, [vals, radios]);
}
const go = (n) => page.evaluate((n) => { const b = document.querySelector(`#path [data-goto="${n}"]`); if (b) b.click(); return !!b; }, n);
const pick = (name, val) => page.evaluate(([n, v]) => { const el = document.querySelector(`input[name=${n}][value="${v}"]`); el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); }, [name, val]);
const inp = () => page.evaluate(() => window.__elukaar.readInput());
const hidden = (id) => page.evaluate((i) => document.getElementById(i).classList.contains("d-none"), id);

await setup(base);
await go(6);
// 1. Töötamise valik on nähtav ka ilma soodustuseta.
check(!(await hidden("soodusWorkWrap")), "töötamise valik on kõigil");
let i = await inp();
check(i.workOn === false && i.workUntil === undefined, "vaikimisi ei tööta");
await pick("soodusWork", "yes");
i = await inp();
check(i.workOn === true && i.workUntil === 66 && i.soodusWork === false, "töötan: vaikimisi 1 aasta (66), soodusWork ainult soodustusega: " + JSON.stringify({ w: i.workOn, u: i.workUntil }));
check(!(await hidden("workUntilWrap")), "töö lõpu valik on nähtav");

// 2. Täis / pool / edasi.
check(await page.evaluate(() => document.querySelector("input[name=p1Mode]:checked").value) === "full" && await hidden("deferYearsWrap"), "vaikimisi kohe täis, aastaid ei küsita");
await pick("p1Mode", "half");
i = await inp();
check(i.half === 1 && i.deferral === 0, "pool: 1 aasta, edasilükkamist pole: " + JSON.stringify({ h: i.half, d: i.deferral }));
check(!(await hidden("deferYearsWrap")) && /poole/.test(await page.evaluate(() => document.getElementById("deferYearsLegend").textContent)), "pool: küsib aastaid");
await pick("defer", "3");
i = await inp();
check(i.half === 3 && i.deferral === 0, "pool 3 aastat");
await pick("p1Mode", "defer");
i = await inp();
check(i.deferral === 3 && i.half === 0, "edasi: aastad jäävad (3)");
await pick("p1Mode", "full");
i = await inp();
check(i.deferral === 0 && i.half === 0 && await hidden("deferYearsWrap"), "täis: kõik nulli");
// Vana viis (raadio defer otse) töötab edasi: edasilükkamine ja režiim sünkroonis.
await pick("defer", "2");
i = await inp();
check(i.deferral === 2 && await page.evaluate(() => document.querySelector("input[name=p1Mode]:checked").value) === "defer", "defer raadio → režiim „edasi“");
if (shot) { await pick("p1Mode", "half"); await page.evaluate(() => document.getElementById("h6").scrollIntoView()); await page.screenshot({ path: shot, fullPage: false }); }

// 3. Eripensioniga on valik lukus (pool ei kehti).
await setup({ ...base, spHas: "yes" });
await go(6);
check(await page.evaluate(() => document.getElementById("deferSet").disabled), "eripensioniga täis/pool/edasi lukus");

check(errs.length === 0, "lehel vigu pole: " + errs.join("; "));
await browser.close();
console.log(`\nTöö ja pool pensioni (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
