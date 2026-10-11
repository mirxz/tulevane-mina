// Elukaare valikute loogika (Kadi muudatused 11.10): lukustatud valikud puuduva samba korral, II ja III samba fondipension eraldi lepingutena,
// C vaikimisi uus leping igal aastal, kokkuvõtte ja otsusekaardi filtreerimine.
// Kasutus: node tests/elukaar-ui-valikud.mjs [URL]
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
await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART })); // kohalik Chart.js: tulemuse vaade vajab seda
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => { if (!/Chart is not defined/.test(e.message)) errs.push(e.message); });

const base = { birthYear: 1968, sex: "M", p1Monthly: 1000, p2: 40000, p3: 20000, p3Joined: "before", grossMonthly: 3000, p2Rate: "0.06", p3Monthly: 200, pensionAgeYears: 65 };
async function setup(vals, radios = {}) {
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  await page.evaluate(([v, r]) => {
    for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    for (const [name, val] of Object.entries(r)) { const el = document.querySelector(`input[name=${name}][value="${val}"]`); if (el) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); } }
  }, [vals, radios]);
}
// Mine sammu juurde läbi raja (nagu kasutaja); tagastab seisundi.
const go = (n) => page.evaluate((n) => { const b = document.querySelector(`#path [data-goto="${n}"]`); if (b) b.click(); return !!b; }, n);
const q = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? { disabled: !!e.disabled, hidden: e.classList.contains("d-none") || !!e.closest("[hidden]"), off: e.classList.contains("is-off"), text: e.textContent.trim(), cls: e.className } : null; }, sel);
const checked = (name) => page.evaluate((n) => (document.querySelector(`input[name=${n}]:checked`) || {}).value, name);
const lastStep = () => page.evaluate(() => document.querySelectorAll("main .chapter").length - 1);

// 1. II sammas puudub (summa 0, sissemakse puudub): valikud lukus, märkus ütleb miks, kokkuvõte ei maini II sammast.
await setup({ ...base, p2: 0, p2Rate: "0" });
await go(5);
let s = await q("#p2At60Set"), n = await q("#p2At60Note");
check(s && s.disabled && s.off, "II puudub: 60 a II valik on lukus (disabled + is-off)");
check(n && !n.hidden && /II sambas ei ole kogutud midagi, valik puudub/.test(n.text), "II puudub: kollane märkus 60 a sammus");
await go(6);
s = await q("#payoutPaSet"); n = await q("#paIINote");
check(s && s.disabled, "II puudub: pensioniea II valik on lukus");
check(n && !n.hidden && /II sambas ei ole kogutud midagi/.test(n.text), "II puudub: märkus pensioniea sammus");
await go(7);
n = await q("#contractLocked");
check(n && !n.hidden && /II sambas ei ole kogutud midagi/.test(n.text), "II puudub: märkus 66+ sammus");
await go(await lastStep());
const recap = await q("#recap");
check(recap && !/(^|[^I])II sammas/.test(recap.text) && /III sammas/.test(recap.text), "II puudub: kokkuvõte ei maini II sammast, III on olemas");
const map = await page.evaluate(() => document.body.innerText);
check(!/II samba raha saab välja võtta 22%/.test(map), "II puudub: otsusekaart ei räägi II samba väljavõtmisest");

// 2. III sammas puudub: III valikud lukus.
await setup({ ...base, p3: 0, p3Monthly: 0 }, { p3has: "no" });
await go(5);
s = await q("#p3At60Set"); n = await q("#p3At60Note");
check(s && s.disabled && s.off, "III puudub: 60 a III valik on lukus");
check(n && !n.hidden && /III sambas ei ole kogutud midagi, valik puudub/.test(n.text), "III puudub: kollane märkus");
await go(await lastStep());
check(!/III sammas/.test((await q("#recap")).text), "III puudub: kokkuvõte ei maini III sammast");

// 3. Mõlemad on olemas ja mõlemad fondipensionina: kaks eraldi lepingu valikut.
await setup(base, { p3plan: "fund", payout: "fund" });
await go(7);
s = await q("#contractSet"); let s3 = await q("#contract3Set");
check(s && !s.hidden && !s.disabled, "II fondipension: II lepingu valik on nähtav ja aktiivne");
check(s3 && !s3.hidden && !s3.disabled, "III fondipension: III lepingu valik on nähtav ja aktiivne");
check(await checked("contract3") === "once", "III samba vaikevalik on „Üks leping“");
await go(await lastStep());
check(/III samba fondipension ühe lepinguga/.test((await q("#recap")).text), "kokkuvõte näitab III lepingut");

// 4. Ainult III fondipensionina (II kasvab): ainult III lepingu valik.
await setup(base, { p3plan: "fund", payout: "grow" });
await go(7);
s3 = await q("#contract3Set");
check(s3 && !s3.hidden && !s3.disabled, "ainult III fondipension: III lepingu valik näha");
check((await q("#contractLocked")).hidden === false, "ainult III fondipension: II leping on lukus (märkus)");

// 5. Riikliku pensioni edasilükkamine: C vaikimisi uus leping igal aastal, kasutaja valik jääb kehtima.
await setup(base, { payout: "fund", defer: "2" });
await go(7);
check(await checked("contract") === "yearly", "edasilükkamine: lepingu vaikevalik on „Uus leping igal aastal“");
await go(await lastStep());
check(/uue lepinguga igal aastal/.test((await q("#recap")).text), "edasilükkamine: kokkuvõte ütleb „uue lepinguga igal aastal“");
await go(7);
await page.evaluate(() => { const el = document.querySelector('input[name=contract][value="once"]'); el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
await go(await lastStep());
check(/ühe lepinguga/.test((await q("#recap")).text), "edasilükkamine: kasutaja valitud „Üks leping“ jõuab kokkuvõttesse");
// Vaikevalik ei tohi kasutaja valikut üle kirjutada, kui edasilükkamist muudetakse.
await go(6); await page.evaluate(() => { const el = document.querySelector('input[name=defer][value="0"]'); if (el) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); } });
check(await checked("contract") === "once", "kasutaja valik „Üks leping“ jääb pärast edasilükkamise muutmist");

// 6. Ilma edasilükkamiseta fondipension: vaikimisi üks leping (B), nagu varem.
await setup(base, { payout: "fund" });
await go(7);
check(await checked("contract") === "once", "ilma edasilükkamiseta on vaikimisi „Üks leping“");

check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nElukaare valikud: ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
