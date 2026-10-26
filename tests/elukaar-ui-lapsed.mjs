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
check(await page.evaluate(() => !document.getElementById("kidsII2").closest(".kid-ii").classList.contains("d-none")), "okt 2021 laps: lisamakse kuude väli nähtav");
check((await page.evaluate(() => document.getElementById("kidsII2").value)) === "36", "II sambas: eeltäidetud 36 kuud");
check(await page.evaluate(() => document.getElementById("kidsII0").closest(".kid-ii").classList.contains("d-none")), "1985 laps: lisamakse välja pole");
await page.evaluate(() => { const e = document.getElementById("kidsII2"); e.value = "12"; e.dispatchEvent(new Event("input", { bubbles: true })); });
const k12 = await kids();
check(k12.iiMonths.length === 1 && k12.iiMonths[0] === 12, "lisamakse kuud jõuavad mootorisse: " + JSON.stringify(k12.iiMonths));
await set({ kidsII2: "" });
// Sünniaasta: ainult 4 numbrit, vale aasta → veateade, ei arvestata.
check((await page.evaluate(() => document.getElementById("kidsBorn0").maxLength)) === 4, "sünniaasta väljal kuni 4 numbrit");
await page.fill("#kidsBorn0", "1907");
await page.locator("#kidsBorn0").blur();
await refresh();
const bad = await page.evaluate(() => ({ inv: document.getElementById("kidsBorn0").getAttribute("aria-invalid"), msg: document.getElementById("kidsBornErr0").textContent, k: window.__elukaar.readInput().kids.bUnknown }));
check(bad.inv === "true" && /1930/.test(bad.msg) && bad.k >= 1, "1907: veateade ja last ei arvestata sünniajaga: " + JSON.stringify(bad));
await page.fill("#kidsBorn0", "1985");
await page.locator("#kidsBorn0").blur();
check((await page.evaluate(() => document.getElementById("kidsBorn0").getAttribute("aria-invalid"))) === null, "1985: veateade kaob");
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
const fx = await page.evaluate(() => { const i = window.__elukaar.readInput(); return { s: i.soodus, f: i.flexEarly, h: document.getElementById("soodusNote").textContent }; });
check(fx.s === 3 && fx.f === 3 && /19,88%/.test(fx.h), "3 a varem ilma soodustuseta: paindlik, vähendus 19,88%: " + JSON.stringify(fx));
await set({ soodusYears: "" });
await refresh();

// Tervist kahjustav töö, nimekiri nr 1 (SVPS § 3, TLV-88): tööaastad ja allmaatöö.
check(await hidden("hazardYearsWrap"), "nimekirja nr 1 aastad peidus, kui raske tööd pole");
await set({ hazard: "list1", hazardYears: 20, undergroundYears: 5 });
await refresh();
const hz = await page.evaluate(() => { const i = window.__elukaar.readInput(); return { y: i.hazardYears, u: i.undergroundYears, hint: document.getElementById("soodusNote").textContent }; });
check(!(await hidden("hazardYearsWrap")) && !(await hidden("undergroundWrap")), "nimekiri nr 1: aastate väljad nähtavad");
check(hz.y === 20 && hz.u === 5 && /SVPS § 3/.test(hz.hint), "aastad jõuavad mootorisse ja vihje näitab lisa: " + JSON.stringify(hz));
await set({ hazardYears: 5 });
await refresh();
const hz5 = await page.evaluate(() => ({ s: window.__elukaar.readInput().soodus, hint: document.getElementById("soodusNote").textContent }));
check(hz5.s === 10 && /lisab vanaduspensionile u/.test(hz5.hint) && /vähemalt 10 aastat/.test(hz5.hint), "nimekiri nr 1, 5 a: valik jääb inimesele, vihje hoiatab: " + JSON.stringify(hz5));
await set({ soodusYears: 7 });
check((await page.evaluate(() => window.__elukaar.readInput().soodus)) === 7, "nimekiri nr 1: saab valida 7 a varem");
await set({ soodusYears: "" });
await set({ hazard: "list2" });
await refresh();
check(await hidden("hazardYearsWrap") && (await page.evaluate(() => window.__elukaar.readInput().hazardYears)) === 0, "nimekiri nr 2: väljad peidus, lisa pole");

// Tööga seotud erijuhud: linnukesed (päris klõps: brauser saadab enne „input“, siis „change“) avavad väljad.
await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__elukaar);
const vis = (id) => page.evaluate((i) => !document.getElementById(i).classList.contains("d-none"), id);
const on = (id) => page.evaluate((i) => document.getElementById(i).checked, id);
check(await vis("kidsHasWrap") && !(await vis("hazardRow")) && !(await vis("rescueWrap")), "lapsed eraldi plokis, tööga seotud väljad peidus");
await page.click("#cHazard");
check((await on("cHazard")) && (await vis("hazardRow")) && (await page.evaluate(() => document.getElementById("hazard").value)) === "list1", "klõps: tervist kahjustav töö, nimekiri nr 1");
await page.click("#cHazard");
check(!(await on("cHazard")) && !(await vis("hazardRow")) && (await page.evaluate(() => document.getElementById("hazard").value)) === "no", "klõps uuesti: maha");
await page.click("#cSp");
check((await on("cSp")) && (await page.evaluate(() => document.getElementById("spHas").value)) === "yes", "klõps: eripension");
await page.click("#cSp");
await page.click("#cRescue");
check((await on("cRescue")) && (await vis("rescueWrap")), "klõps: päästeteenistus");
await page.fill("#rescueYears", "22");
const rs = await page.evaluate(() => ({ y: window.__elukaar.readInput().rescueYears, h: document.getElementById("soodusNote").textContent }));
check(rs.y === 22 && /25%/.test(rs.h), "päästja 22 a: +25%: " + JSON.stringify(rs));
const pl = await page.evaluate(() => [...document.querySelectorAll("#path .path-label")].map((e) => e.textContent));
check(pl.some((x) => / a sambad$/.test(x)) && pl.some((x) => / a pension$/.test(x)), "sama vanus kahel sammul: sildid eristuvad: " + pl.join(", "));
check(/ootel/.test(rs.h) && /sõltuvad staažist/.test(await page.evaluate(() => document.getElementById("rescueHint").textContent)), "pensionile mineku sammus ootetoetus; välja juhend püsiv");
const ro = await page.evaluate(() => [...document.querySelectorAll("#soodusYears option")].map((o) => o.textContent));
check(/vähendamata \(kõige varem\)/.test(ro[5]), "päästja 22 a: 5 a varem vähendamata: " + ro[5]);
await page.click("#cCivil");
check(await vis("civilNote") && /Olen töötanud vähemalt 10 aastat avalikus teenistuses/.test(await page.evaluate(() => document.getElementById("civilNote").textContent)), "ametnik: juhend lisada SKA prognoosi");
check((await page.evaluate(() => window.__elukaar.readInput().civilYears)) === 0, "ametniku suurendust Elukaar ise ei lisa (on SKA prognoosis)");
// Eripension ilma muu õiguseta: varem mineku valiku asemel selgitus.
await page.click("#cRescue");
await page.click("#cSp");
check(!(await vis("soodusYearsWrap")) && (await vis("soodusSpNote")) && (await page.evaluate(() => window.__elukaar.readInput().soodus)) === 0, "eripension: varem mineku valikut pole, on selgitus");
await page.click("#cSp");
check(await vis("soodusYearsWrap"), "eripensioni linnuke maha: valik tagasi");
check(await page.evaluate(() => /lõpevad mõne kuu pärast sinu ja riigi sissemaksed/.test(document.getElementById("p2WorkTip").textContent)), "II samba töötamise vihje tekst");
await page.click("#cOther");
check(await vis("otherNote"), "muu erijuht: info nähtav");
await set({ spHas: "yes" });
await refresh();
check(await on("cSp"), "eripension valitud mujalt → linnuke sees");

// Päästja ootetoetus või laste eest pension (TLV-105): valik ainult siis, kui mõlemad õigused on sinul.
await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__elukaar);
await set({ birthYear: 1975, kidsHas: "yes", kidsCount: 4 });
await set({ kidsBorn0: 1998, kidsBorn1: 2000, kidsBorn2: 2002, kidsBorn3: 2004 });
check(!(await vis("rescueBasisWrap")), "ainult lapsed: ootetoetuse valikut pole");
await page.click("#cRescue");
await page.fill("#rescueYears", "20");
await refresh();
const rb = await page.evaluate(() => ({ v: document.querySelector('input[name="rescueBasis"]:checked').value, mix: !document.getElementById("rbMix").classList.contains("d-none"), step: document.getElementById("rescueBasisWrap").closest("section").dataset.step, t: document.getElementById("rbMixTxt").textContent, i: window.__elukaar.readInput(), n: document.getElementById("soodusNote").textContent }));
check(await vis("rescueBasisWrap") && rb.mix && rb.v === "mix" && rb.step === "6", "lapsed 3 a + päästja 5 a: kaardid pensionile mineku sammus, vaikimisi järjest: " + JSON.stringify({ v: rb.v, step: rb.step }));
check(rb.i.rescueBasis === "mix" && rb.i.soodus === 5 && /Ootetoetus 2 a/.test(rb.t) && /ilma laste pensionilisata/.test(rb.n), "järjest: 5 a varem, kaart ja märkus selgitavad: " + rb.t);
await page.evaluate(() => { document.querySelector('#path [data-goto="6"]').click(); });
const cmp = await page.evaluate(() => ({ rows: document.querySelectorAll("#rbCompare tbody tr").length, faq: !document.getElementById("faq65").classList.contains("d-none") && !document.getElementById("rbCompareItem").classList.contains("d-none") && !!document.querySelector("#rbCompareLink a") && [...document.querySelectorAll("#faq65 details.faq-item")].filter((d) => !d.classList.contains("d-none")).length === 1, best: document.querySelectorAll("#rbCompare .badge").length, txt: document.getElementById("rbCompare").textContent }));
check(cmp.rows === 4 && /Pere kokku/.test(cmp.txt) && /teise vanema u/.test(cmp.txt) && /pole arvestatud/.test(cmp.txt) && cmp.faq && cmp.best >= 1 && /2 a kauem palka/.test(cmp.txt) && /✓ sinu valik/.test(cmp.txt.replace(/\s+/g, " ")), "võrdlustabel KKK-s, ülal viide: 3 varianti + pere rida, lisa veerg, „kõige rohkem“ märgitud (võrdsel mitu): " + JSON.stringify({ rows: cmp.rows, faq: cmp.faq, best: cmp.best }));
check(/kui lastel on teine vanem, kellel on kasulik.*soodustingimustel pensionile 3 a varem.*korduma kippuvad küsimused/.test(await page.evaluate(() => document.getElementById("soodusNote").textContent)) && /pension 63–65 a olla/.test(cmp.txt) && /Pensionilisa saab/.test(cmp.txt), "nõuanne lühike + viide, üksikasjad (63–65 a, pensionilisa) KKK-s");
await page.click('input[name="rescueBasis"][value="pension"]');
const rp = await page.evaluate(() => ({ i: window.__elukaar.readInput(), n: document.getElementById("soodusNote").textContent }));
check(rp.i.soodus === 3 && !/Kes maksab/.test(rp.n), "laste eest pension: 3 a varem, toetust pole: " + rp.i.soodus);
await page.click('input[name="rescueBasis"][value="toetus"]');
check(/kuni \d+-aastaseks saamiseni/.test(await page.evaluate(() => document.getElementById("soodusNote").textContent)), "ainult ootetoetus kuni pensionieani");
await page.evaluate(() => { document.querySelector('#path [data-goto="0"]').click(); });
await set({ kidsEarlyUser: "other" });
await refresh();
check(!(await vis("rescueBasisWrap")) && (await page.evaluate(() => window.__elukaar.readInput().rescueBasis)) === undefined, "laste õigus teisel vanemal: valikut pole");
check(!(await hidden("faq65")) && (await hidden("rbCompareItem")) && (await page.evaluate(() => !document.querySelector("#faq65 details.faq-ah").classList.contains("d-none"))), "valikuta: aastahinde KKK nähtav, võrdluse kirjet pole (fondipensioni KKK ainult samba valikuga)");
check(errs.length === 0, "lehel pole JS vigu: " + errs.join("; "));
await browser.close();
console.log(`Lapsed (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
