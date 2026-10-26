// A2-2 tulemuses: riikliku pensioni edasilükkamine + elan sammastest. Kui raha ei jätku, pakub tulemus väiksemat
// edasilükkamist nupuga „Muuda valik“, mis muudab valiku kohe. Graafiku kokkuvõte näitab silla fondipensioni ja lisaväljamakset.
// Kasutus: node tests/elukaar-ui-edasilykkamine.mjs [URL]
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
async function setup(vals, radios) {
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__elukaar);
  await page.evaluate(([v, r]) => {
    for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    for (const [name, val] of Object.entries(r)) { const el = document.querySelector(`input[name=${name}][value="${val}"]`); if (el) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); } }
  }, [vals, radios]);
  await page.evaluate(() => { const n = document.querySelectorAll("main .chapter").length - 1; document.querySelector(`#path [data-goto="${n}"]`).click(); });
}
const warn = () => page.evaluate(() => { const b = document.getElementById("actionWarn"); const btn = b.querySelector("[data-set-defer]"); return { shown: !b.classList.contains("d-none"), text: b.textContent, d: btn ? +btn.dataset.setDefer : null, tag: btn ? btn.tagName : null }; });

// Otsi profiil, kus 5 a edasilükkamine ei kanna, aga väiksem kannab.
let hit = null;
outer: for (const p2 of [15000, 25000, 40000, 60000]) for (const pkg of ["mugav", "optimaalne", "kokkuhoidlik"]) {
  await setup({ birthYear: 1966, p1Monthly: 1000, p2, p3: 0, p3Joined: "none", p3Monthly: 0, grossMonthly: 0 }, { payout: "fund", defer: "5", pkg });
  const w = await warn();
  if (w.d !== null) { hit = { p2, pkg, w }; break outer; }
}
check(hit !== null, "leidub profiil, kus tulemus pakub väiksemat edasilükkamist");
if (hit) {
  check(hit.w.shown && /5 a edasilükkamisega ei jätku/.test(hit.w.text) && hit.w.d < 5, "hoiatus selgitab ja pakub " + hit.w.d + " a");
  check(hit.w.tag === "BUTTON" && /Muuda valik/.test(hit.w.text), "„Muuda valik“ on nupp");
  check(/elad sammastest: fondipension keskmiselt [\d\s ]+ € kuus/.test(await page.evaluate(() => document.getElementById("chartSummary").textContent)), "graafiku kokkuvõte näitab silda");
  await page.evaluate(() => document.querySelector("#actionWarn [data-set-defer]").click());
  check((await page.evaluate(() => window.__elukaar.readInput())).deferral === hit.w.d, "nupp muutis valiku kohe: " + hit.w.d + " a");
  const after = await warn();
  check(!after.shown || after.d === null, "pärast muutmist ei paku sama soovitust uuesti");
}
// Edasilükkamise märkus: SKA eeldab, et edasilükatud aastatel töötad edasi; Elukaar lisab staaži ainult „Töötan edasi“ valikuga.
const note = () => page.evaluate(() => document.getElementById("deferWorkNote").textContent);
const base = { birthYear: 1990, p1Monthly: 865, p2: 33825, p3: 0, p3Joined: "none", p3Monthly: 0, grossMonthly: 4000 };
await setup(base, { p1Mode: "defer", defer: "3", soodusWork: "no" });
let n = await note();
check(/eeldavad, et vahepeal ei tööta/.test(n) && /„Töötan edasi“/.test(n) && /SKA/.test(n) && /u 1\d(,\d)? € kuus/.test(n), "ei tööta: märkus selgitab SKA eeldust: " + n);
check((await page.evaluate(() => window.__elukaar.readInput())).workOn === false, "vaikimisi ei tööta (käitumine ei muutunud)");
await setup(base, { p1Mode: "defer", defer: "3", soodusWork: "yes" });
n = await note();
{ const pa = (await page.evaluate(() => window.__elukaar.readInput())).pensionAgeYears; // RPKS § 7 valem
  check(new RegExp("Töötad " + (pa + 1) + "-aastaseks").test(n) && new RegExp((pa + 3) + "-aastaseks").test(n), "töötab 1 a: märkus pakub tööd kogu edasilükatud aja: " + n); }
await setup(base, { p1Mode: "full", soodusWork: "no" });
check((await note()) === "", "kohe täis: märkust pole");
check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nEdasilükkamine (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
