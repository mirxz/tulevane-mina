// Laste väljad (TLV-18, RPKS § 24 lg 1¹, KoPS § 10): iga lapse sünniaasta (ja vajadusel kuu), rühmad arvutab leht ise,
// alla 3-aastase lapse eest riigi sissemakse II sambasse.
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

const rows = () => page.evaluate(() => document.querySelectorAll("#kidsList .kid-row").length);
const monthShown = (i) => page.evaluate((i) => !document.getElementById("kidsMonth" + i).closest(".kid-month").classList.contains("d-none"), i);
const Y = new Date().getFullYear();

await set({ birthYear: 1994, p2Rate: "0.06", grossMonthly: 2500, kidsHas: "yes" });
await refresh();
check(await page.evaluate(() => !document.getElementById("kidsB1991") && !document.getElementById("kidsU3")), "vanu rühmavälju enam pole");
check((await rows()) === 1, "vaikimisi 1 lapse rida");
await set({ kidsCount: 25 });
check((await rows()) === 25, "laste arv ei ole piiratud (25 rida)");
await set({ kidsCount: 3 });
check((await rows()) === 3, "3 last → 3 rida");
check(!(await hidden("kidsMissingWrap")), "ilma sünniaastata näitab meeldetuletust");
let k = await kids();
check(k.bUnknown === 3 && (await page.evaluate(() => window.__elukaar.readInput().soodus)) === 1, "sünniaastata lapsed loevad varem pensionile mineku õiguse juures: " + JSON.stringify(k));

await set({ kidsBorn0: 1985, kidsBorn1: 2000, kidsBorn2: 2015 });
await refresh();
k = await kids();
check(k.b1991 === 1 && k.b2012 === 1 && k.b2013 === 1 && k.bUnknown === 0, "rühmad sünniaasta järgi: " + JSON.stringify(k));
check(await hidden("kidsMissingWrap"), "kõigi sünniaastatega meeldetuletust pole");
check(!(await monthShown(0)) && !(await monthShown(1)) && !(await monthShown(2)), "kuud ei küsita, kui pole vaja");

// 2021: aug/sept piir.
await set({ kidsBorn2: 2021 });
check(await monthShown(2), "2021. a: küsib kuud");
await set({ kidsMonth2: 8 });
check((await kids()).b2013 === 1, "aug 2021 → 2013–aug 2021 rühm");
await set({ kidsMonth2: 9 });
k = await kids();
check(k.b2021 === 1 && k.b2013 === 0 && k.u3 === 0, "sept 2021 → sept 2021+ rühm, üle 3 a: " + JSON.stringify(k));

// Alla 3-aastane: riigi sissemakse II sambasse.
await set({ kidsBorn2: Y - 1, kidsMonth2: "" });
await refresh();
check(await monthShown(2), "alla 3-aastane: küsib kuud");
k = await kids();
check(k.u3 === 1 && k.u3Left[0] === undefined, "ilma kuuta alla 3-aastane: " + JSON.stringify(k));
check(!(await hidden("kidsU3Wrap")), "II samba vihje nähtav");
const hint = await page.evaluate(() => document.getElementById("kidsU3Hint").textContent);
check(/II sambasse veel u/.test(hint) && /18 kuud/.test(hint) && /76,12/.test(hint), "vihje: riigi sissemakse, 18 kuu eeldus ja SKA summa: " + hint);
const back = 6, d = new Date(); d.setMonth(d.getMonth() - back);
await set({ kidsBorn2: d.getFullYear(), kidsMonth2: d.getMonth() + 1 });
await refresh();
k = await kids();
check(k.u3 === 1 && k.u3Left[0] === 36 - back, "sünnikuust jäänud kuud: " + JSON.stringify(k.u3Left));
check(!/18 kuud/.test(await page.evaluate(() => document.getElementById("kidsU3Hint").textContent)), "kuuga vihjes 18 kuu eeldust pole");
check(!!(await page.evaluate(() => document.getElementById("kidsSupWrap") && !document.getElementById("kidsSupWrap").classList.contains("d-none"))), "„Pensionilisa või II samba lisamakset saab“ nähtav");

// RPKS § 24 lg 6: üle 3-aastane sept 2021+ laps → küsitakse riigi II samba lisamakse kuid; 12 kuud → 2/3 lisast.
await set({ kidsBorn2: 2021, kidsMonth2: 10 });
await refresh();
check(await page.evaluate(() => !document.getElementById("kidsII2").closest(".kid-ii").classList.contains("d-none")) && !(await hidden("kidsIIWrap")), "okt 2021 laps: lisamakse kuude väli nähtav");
check(await page.evaluate(() => document.getElementById("kidsII0").closest(".kid-ii").classList.contains("d-none")), "1985 laps: lisamakse välja pole");
await set({ kidsII2: 12 });
const k12 = await kids();
check(k12.iiMonths.length === 1 && k12.iiMonths[0] === 12, "lisamakse kuud jõuavad mootorisse: " + JSON.stringify(k12.iiMonths));
await set({ kidsII2: "" });
// Arvu vähendamine jätab alles olemasolevad sünniaastad.
await set({ kidsCount: 2 });
check((await rows()) === 2 && (await page.evaluate(() => document.getElementById("kidsBorn1").value)) === "2000", "arvu vähendades jäävad väärtused alles");

await page.click('button[data-help="kids"]').catch(() => {});
const help = await page.evaluate(() => (document.getElementById("helpDialog") || {}).textContent || "");
check(/KoPS § 10/.test(help) && /enne 1983/.test(help), "selgitus viitab seadusele ja 1983 tingimusele");
await page.keyboard.press("Escape");

// Mitu aastat varem: 0 … õiguse maksimum (4 last → kuni 3 a), vaikimisi maksimum.
await set({ kidsCount: 4 });
await set({ kidsBorn0: 2000, kidsBorn1: 2000, kidsBorn2: 2000, kidsBorn3: 2000 });
await refresh();
const opts = await page.evaluate(() => [...document.querySelectorAll("#soodusYears option")].map((o) => o.value));
check(!(await hidden("soodusYearsWrap")) && opts.join() === "0,1,2,3,4,5", "4 last: valikud 0 … 5: " + opts.join());
const optTxt = await page.evaluate(() => [...document.querySelectorAll("#soodusYears option")].map((o) => o.textContent));
check(/vähendamata \(kõige varem\)/.test(optTxt[3]) && /paindlik pension −25,5%/.test(optTxt[4]), "3 a vähendamata, 4 a paindlik −25,5%: " + optTxt.join(" | "));
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 3, "vaikimisi kõige varem (3 a)");
await set({ soodusYears: 1 });
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 1, "valin 1 a varem");
await set({ soodusYears: 0 });
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 0, "valin tavalise pensioniea");
await page.evaluate(() => document.querySelector('button[data-help="soodusYears"]').click());
const sh = await page.evaluate(() => document.getElementById("helpDialog").textContent);
check(/ei vähendata/.test(sh) && /vähendatakse eluks ajaks/.test(sh) && /−19,88%/.test(sh) && /664 €/.test(sh), "„?“ selgitab soodustust ja paindlikku pensioni varem");
await page.keyboard.press("Escape");
await set({ kidsCount: 0, soodusYears: "" });
await refresh();

// Paindlik pension varem: väli on alati nähtav, vaikimisi 0, valik toob vähenduse.
check(!(await hidden("soodusYearsWrap")) && (await page.evaluate(() => window.__elukaar.readInput().soodus)) === 0, "ilma soodustuseta: väli nähtav, vaikimisi 0");
await set({ soodusYears: 3 });
await refresh();
const fx = await page.evaluate(() => { const i = window.__elukaar.readInput(); return { s: i.soodus, f: i.flexEarly, h: document.getElementById("soodusYearsHint").textContent }; });
check(fx.s === 3 && fx.f === 3 && /19,88%/.test(fx.h), "3 a varem ilma soodustuseta: paindlik, vähendus 19,88%: " + JSON.stringify(fx));
await set({ soodusYears: "" });
await refresh();

// Tervist kahjustav töö, nimekiri nr 1 (SVPS § 3, TLV-88): tööaastad ja allmaatöö.
check(await hidden("hazardYearsWrap"), "nimekirja nr 1 aastad peidus, kui raske tööd pole");
await set({ hazard: "list1", hazardYears: 20, undergroundYears: 5 });
await refresh();
const hz = await page.evaluate(() => { const i = window.__elukaar.readInput(); return { y: i.hazardYears, u: i.undergroundYears, hint: document.getElementById("hazardYearsHint").textContent }; });
check(!(await hidden("hazardYearsWrap")) && !(await hidden("undergroundWrap")), "nimekiri nr 1: aastate väljad nähtavad");
check(hz.y === 20 && hz.u === 5 && /SVPS § 3/.test(hz.hint), "aastad jõuavad mootorisse ja vihje näitab lisa: " + JSON.stringify(hz));
await set({ hazardYears: 5 });
await refresh();
const hz5 = await page.evaluate(() => ({ s: window.__elukaar.readInput().soodus, hint: document.getElementById("hazardYearsHint").textContent }));
check(hz5.s === 10 && /Pensionilisa u/.test(hz5.hint) && /vähemalt 10 aastat/.test(hz5.hint), "nimekiri nr 1, 5 a: valik jääb inimesele, vihje hoiatab: " + JSON.stringify(hz5));
await set({ soodusYears: 7 });
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 7, "nimekiri nr 1: saab valida 7 a varem");
await set({ soodusYears: "" });
await set({ hazard: "list2" });
await refresh();
check(await hidden("hazardYearsWrap") && (await page.evaluate(() => window.__elukaar.readInput().hazardYears)) === 0, "nimekiri nr 2: väljad peidus, lisa pole");

check(errs.length === 0, "lehel pole JS vigu: " + errs.join("; "));
await browser.close();
console.log(`Lapsed (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
