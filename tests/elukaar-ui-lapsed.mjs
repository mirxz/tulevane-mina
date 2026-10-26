// Laste väljad (TLV-18, RPKS § 24 lg 1¹, KoPS § 10): sünniaja grupid, „neist alla 3-aastased“ ja riigi sissemakse II sambasse.
// Kasutus: node tests/elukaar-ui-lapsed.mjs [URL]
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
await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__elukaar);

const set = (vals) => page.evaluate((v) => {
  for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
}, vals);
const kids = () => page.evaluate(() => window.__elukaar.readInput().kids);
// Väljade nähtavus uueneb lehe uuendamisel; vaheta sammu, et update jookseks.
const refresh = () => page.evaluate(() => { const b = document.querySelector('#path [data-goto="1"]'); if (b) b.click(); const a = document.querySelector('#path [data-goto="0"]'); if (a) a.click(); });
const hidden = (id) => page.evaluate((id) => document.getElementById(id).classList.contains("d-none"), id);

await set({ birthYear: 1994, p2Rate: "0.06", grossMonthly: 2500, kidsHas: "yes" });
await refresh();
check(await page.evaluate(() => !!document.getElementById("kidsB2021")), "väli „sept 2021 või hiljem“ on olemas");
check(/aug 2021/.test(await page.evaluate(() => document.querySelector('label[for="kidsB2013"]').textContent)), "2013 grupp lõpeb aug 2021");
check(await hidden("kidsU3Wrap"), "„neist alla 3-aastased“ peidus, kui 2021+ lapsi pole");

await set({ kidsB2021: 2, kidsU3: 5 });
await refresh();
const k = await kids();
check(k.b2021 === 2 && k.u3 === 2, "alla 3-aastaseid ei saa olla rohkem kui 2021+ lapsi: " + JSON.stringify(k));
check(!(await hidden("kidsU3Wrap")), "„neist alla 3-aastased“ nähtav");
const hint = await page.evaluate(() => document.getElementById("kidsU3Hint").textContent);
check(/II sambasse veel u/.test(hint), "vihje näitab riigi sissemakset: " + hint);
check(!(await hidden("kidsSupWrap")), "„Pensionilisa või II samba lisamakset saab“ nähtav");
// Sünnikuu iga alla 3-aastase lapse kohta: jäänud kuud = 36 − vanus kuudes.
check(await page.evaluate(() => document.querySelectorAll('#kidsU3Births input[type="month"]').length) === 2, "kaks sünnikuu välja");
check(/18 kuud/.test(hint) && /76,12/.test(hint), "ilma sünnikuuta vihje ütleb 18 kuud ja SKA summa");
const ym = (back) => { const d = new Date(); d.setMonth(d.getMonth() - back); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
await set({ kidsU3Born0: ym(6), kidsU3Born1: ym(30) });
const k2 = await kids();
check(k2.u3Left[0] === 30 && k2.u3Left[1] === 6, "jäänud kuud sünnikuust: " + JSON.stringify(k2.u3Left));
await refresh();
check(!/18 kuud/.test(await page.evaluate(() => document.getElementById("kidsU3Hint").textContent)), "sünnikuudega vihjes 18 kuu eeldust pole");

await set({ kidsB2013: 1 });
await refresh();
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 1, "3 last (sh 2021+) → 1 a varem");

await page.click('button[data-help="kids"]').catch(() => {});
const help = await page.evaluate(() => (document.getElementById("helpDialog") || {}).textContent || "");
check(/KoPS § 10/.test(help) && /enne 1983/.test(help), "selgitus viitab seadusele ja 1983 tingimusele");

// Mitu aastat varem: 0 … õiguse maksimum (4 last → kuni 3 a), vaikimisi maksimum.
await set({ kidsB2012: 4, kidsB2013: 0, kidsB2021: 0 });
await refresh();
const opts = await page.evaluate(() => [...document.querySelectorAll("#soodusYears option")].map((o) => o.value));
check(!(await hidden("soodusYearsWrap")) && opts.join() === "3,2,1,0", "4 last: valikud 3, 2, 1, 0: " + opts.join());
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 3, "vaikimisi kõige varem (3 a)");
await set({ soodusYears: 1 });
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 1, "valin 1 a varem");
await set({ soodusYears: 0 });
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 0, "valin tavalise pensioniea");
await page.evaluate(() => document.querySelector('button[data-help="soodusYears"]').click());
check(/vähenduskordajat ei rakendata/.test(await page.evaluate(() => document.getElementById("helpDialog").textContent)), "„?“ selgitab, miks pension väheneb");
await page.keyboard.press("Escape");
await set({ kidsB2012: 0, soodusYears: "" });
await refresh();

// Tervist kahjustav töö, nimekiri nr 1 (SVPS § 3, TLV-88): tööaastad ja allmaatöö.
check(await hidden("hazardYearsWrap"), "nimekirja nr 1 aastad peidus, kui raske tööd pole");
await set({ hazard: "list1", hazardYears: 20, undergroundYears: 5 });
await refresh();
const hz = await page.evaluate(() => { const i = window.__elukaar.readInput(); return { y: i.hazardYears, u: i.undergroundYears, hint: document.getElementById("hazardYearsHint").textContent }; });
check(!(await hidden("hazardYearsWrap")) && !(await hidden("undergroundWrap")), "nimekiri nr 1: aastate väljad nähtavad");
check(hz.y === 20 && hz.u === 5 && /SVPS § 3/.test(hz.hint), "aastad jõuavad mootorisse ja vihje näitab lisa: " + JSON.stringify(hz));
await set({ hazard: "list2" });
await refresh();
check(await hidden("hazardYearsWrap") && (await page.evaluate(() => window.__elukaar.readInput().hazardYears)) === 0, "nimekiri nr 2: väljad peidus, lisa pole");

check(errs.length === 0, "lehel pole JS vigu: " + errs.join("; "));
await browser.close();
console.log(`Lapsed (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
