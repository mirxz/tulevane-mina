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
// Lapsed: rühmade arv → sünniaastad (vorm küsib iga lapse sünniaastat; 2024 = alla 3-aastane).
const KID_YEAR = { kidsB1991: 1985, kidsB2012: 2000, kidsB2013: 2015, kidsB2021: 2024 };
function expandKids(v) {
  const out = {}, births = [];
  for (const [k, val] of Object.entries(v)) { if (k in KID_YEAR) for (let i = 0; i < val; i++) births.push(KID_YEAR[k]); else out[k] = val; }
  if (births.length) { out.kidsCount = births.length; births.forEach((y, i) => { out["kidsBorn" + i] = y; }); }
  return out;
}
async function setup(vals) {
  vals = expandKids(vals);
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
await setup({ ...base, spHas: "yes", spMonthly: 1000, spStartAge: 65 }); await toResult();
legend = await page.evaluate(() => Chart.getChart(document.getElementById("chart")).data.datasets.find((d) => d.label === "Eripension").data.some((v) => v > 0));
check(legend === true, "eripension on graafikul");
check(/Eripension/.test(await text("#chartTableWrap")), "tabelis on eripensioni tulp");
check(/eripension 1000? ?€ kuus|eripension 1 000 €|eripension/.test(await text("#recap")), "kokkuvõte mainib eripensioni");
check(/Eripension/.test(await text("#chartSummary")) , "graafiku kokkuvõte mainib eripensioni ja maksu");
const body = await page.evaluate(() => document.body.innerText);
check(/on riiklik pension \(I sammas\)\. Kahte riiklikku pensioni korraga ei maksta/.test(body), "otsusekaardil on eripensioni selgitus (suurem kahest)");
check(!/mitte I samba osa|maksustab riikliku pensioniga ühiselt/.test(body), "vana vale selgitus on eemaldatud");
check(/suurem kahest/.test(await text("#chartSummary")), "graafiku kokkuvõte ütleb, et makstakse suurem kahest");
const inp = await page.evaluate(() => window.__elukaar.readInput());
check(inp.spMonthly === 1000, "readInput annab eripensioni summa");

// 2b. Algusvanus: lahter on nähtav ainult eripensioniga ja jõuab mootorisse.
await setup(base);
check(await page.evaluate(() => document.getElementById("spStartWrap").classList.contains("d-none")), "ilma eripensionita algusvanuse lahtrit pole");
await setup({ ...base, spHas: "yes", spMonthly: 1500, spStartAge: 58 });
check(!(await page.evaluate(() => document.getElementById("spStartWrap").classList.contains("d-none"))), "eripensioniga on algusvanuse lahter nähtav");
let si = await page.evaluate(() => window.__elukaar.readInput());
check(si.spStartAge === 58, "readInput annab algusvanuse");
await toResult();
const spBars = await page.evaluate(() => { const c = Chart.getChart(document.getElementById("chart")); const d = c.data.datasets.find((x) => x.label === "Eripension"); return c.data.labels.map((l, i) => [String(l), d.data[i]]); });
check(spBars.some(([l, v]) => /58|59|60/.test(l) && v > 0), "graafikul on eripension enne pensioniiga (58-st)");
check(/alates 58-aastaselt/.test(await page.evaluate(() => document.body.innerText)), "otsusekaart näitab algusvanust");

// 2d. Eripensioni samm teekonnal oma vanuse kohal (infograafik), töö valik ja kohustuslik algusvanus.
const labels = () => page.evaluate(() => [...document.querySelectorAll("#path .path-label")].map((e) => e.textContent));
await setup(base);
check(await page.evaluate(() => !document.querySelector('#path [data-goto="9"]')), "ilma eripensionita pole eripensioni sammu");
await setup({ ...base, spHas: "yes", spMonthly: 1500, spStartAge: 40 });
let L = await labels();
check(L[1] === "40 a", "40 a samm on kohe pärast „Sina“: " + L.join(", "));
await page.evaluate(() => document.getElementById("nextBtn").click());
check(await page.evaluate(() => !document.querySelector('section[data-step="9"]').hidden), "Edasi viib Sinast eripensioni sammu");
check(/40-aastaselt \(2016\) algas sinu eripension/.test(await text("#spIntro")), "eripensioni sammu tekst: " + (await text("#spIntro")));
check(/suurem/.test(await text("#spPaTxt")), "eripensioni samm selgitab pensioniiga (suurem kahest)");
await setup({ ...base, spHas: "yes", spMonthly: 1500, spStartAge: 58 });
L = await labels();
{ const ii = (await page.evaluate(() => window.__elukaar.readInput().pensionAgeYears)) - 5 + " a"; // II samba samm: pensioniiga − 5 (RPKS § 7 valem)
  check(L.indexOf("58 a") > 0 && L.indexOf("58 a") < L.indexOf(ii), "58 a samm on enne II samba sammu (" + ii + "): " + L.join(", ")); }
await setup({ ...base, spHas: "yes", spMonthly: 1500, spStartAge: 58 });
const potWork = await page.evaluate(() => window.__elukaar.readInput());
check(potWork.spWork === true, "vaikimisi töötad edasi");
await page.evaluate(() => { const r = document.querySelector('input[name="spWork"][value="no"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
check((await page.evaluate(() => window.__elukaar.readInput())).spWork === false, "„Ei tööta“ jõuab mootorisse");
// Palk eripensioni ajal: vaikimisi sama; „muutub“ avab lahtri ja uus palk jõuab mootorisse (II sammas väiksem).
const young = { ...base, birthYear: 1990, spHas: "yes", spMonthly: 1500, spStartAge: 40 };
await setup(young);
check(await page.evaluate(() => document.getElementById("spGrossWrap").classList.contains("d-none")), "vaikimisi uue palga lahtrit pole");
check((await page.evaluate(() => window.__elukaar.readInput())).spGross === undefined, "vaikimisi palk jääb samaks");
await page.evaluate(() => { const r = document.querySelector('input[name="spPay"][value="change"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
check(await page.evaluate(() => !document.getElementById("spGrossWrap").classList.contains("d-none") && document.getElementById("spGross").required && !document.getElementById("spGross").classList.contains("is-invalid")), "„Brutopalk muutub“ avab kohustusliku lahtri (viga mitte kohe)");
const potBefore = await page.evaluate(() => document.querySelector("#metrics, .summary-bar, body").innerText.match(/([\d\s ]+) €\s*sammastes/)?.[1]);
await page.evaluate(() => { const e = document.getElementById("spGross"); e.value = "1500"; e.dispatchEvent(new Event("input", { bubbles: true })); });
const yi = await page.evaluate(() => window.__elukaar.readInput());
check(yi.spGross === 1500, "uus palk jõuab mootorisse");
check(/II sambasse laekub 120 € kuus \(4% sinult \+ 4% riigilt\)/.test(await text("#spIIYes")), "töötades: II samba summa uuest palgast: " + (await text("#spIIYes")));
check(/II sambasse laekub 0 € kuus/.test(await text("#spIINo")), "ei tööta: II sambasse 0 €");
const potAfter = await page.evaluate(() => document.body.innerText.match(/([\d\s ]+) €\s*sammastes/)?.[1]);
check(potBefore && potAfter && parseInt(potAfter.replace(/\D/g, "")) < parseInt(potBefore.replace(/\D/g, "")), "väiksem palk annab pensionieas väiksema samba: " + potBefore + " → " + potAfter);
await page.evaluate(() => { const r = document.querySelector('input[name="spWork"][value="no"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
check(await page.evaluate(() => document.getElementById("spPaySet").classList.contains("d-none")), "„Ei tööta“ korral palga küsimust pole");
// Pealkiri: minevikus alanud eripension.
await setup({ ...base, birthYear: 1966, spHas: "yes", spMonthly: 1500, spStartAge: 50 });
check(/Saad eripensioni/.test(await text("#hSp")) && /algas/.test(await text("#spIntro")), "juba alanud eripension: „Saad eripensioni“, „algas“");
check(/Muuda/.test(await text("#spIntro")), "summa juures on Muuda");

// Minevikus alanud eripension (59-aastane, algus 40): valikud lukus, edasi praegune olukord.
await setup({ ...base, birthYear: 1967, spHas: "yes", spMonthly: 1500, spStartAge: 40 });
await page.evaluate(() => { const r = document.querySelector('input[name="spWork"][value="no"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
const past = await page.evaluate(() => ({ note: !document.getElementById("spPastNote").classList.contains("d-none"), txt: document.getElementById("spPastNote").textContent, work: document.getElementById("spWorkSet").classList.contains("d-none"), pay: document.getElementById("spPaySet").classList.contains("d-none"), amount: !!document.getElementById("spMonthly").offsetParent || document.querySelector('section[data-step="9"]').hidden, label: document.getElementById("spMonthlyLabel").textContent, i: window.__elukaar.readInput() }));
check(past.note && /tegid juba 40-aastaselt/.test(past.txt) && /muuta ei saa/.test(past.txt), "minevik: lukus märkus: " + past.txt);
check(past.work && past.pay, "minevik: töö ja palga valikuid ei näidata");
check(await page.evaluate(() => document.getElementById("spCalcHint").classList.contains("d-none") && document.getElementById("spSameJobNote").classList.contains("d-none")), "minevik: tuleviku vihjeid ei näidata");
check(past.label === "Sinu eripension praegu", "minevik: summa on „praegu“");
check(past.i.spWork === true && past.i.spGross === undefined, "minevik: edasi praegune palk (vana raadionupp ei loe)");
check(/töötad, brutopalk 3000 € kuus, II sambasse laekub kuni pensionini 240 € kuus/.test(past.txt), "minevik: praegune olukord märkuses");
await setup({ ...base, birthYear: 1967, grossMonthly: 0, spHas: "yes", spMonthly: 1500, spStartAge: 40 });
const past0 = await page.evaluate(() => ({ txt: document.getElementById("spPastNote").textContent, i: window.__elukaar.readInput() }));
check(past0.i.spWork === false && /ei tööta, II sambasse ei laeku/.test(past0.txt), "minevik, palk 0: ei tööta");

// Eripension + soodustus (1. vaade): valik suurem kahest toimub soodustusega vanuses.
await setup({ ...base, spHas: "yes", spMonthly: 800, spStartAge: 50, kidsHas: "yes", kidsB2012: 4 });
const paS = (await page.evaluate(() => window.__elukaar.readInput())).pensionAgeYears - 3;
check(new RegExp(paS + "-aastaselt \\(\\d{4}\\), soodustingimustel 3 a varem, on sul õigus ka vanaduspensionile").test(await text("#spPaTxt")), "eripension + soodustus: " + (await text("#spPaTxt")));
await setup({ ...base, spHas: "yes", spMonthly: 800, spStartAge: 50 });
check(!/soodustingimustel/.test(await text("#spPaTxt")), "ilma soodustuseta tavaline pensioniiga");

// Kohustuslikud väljad: viga ei ole kohe näha; edasi minnes jääb samm alles, viga + fookus väljal; hilisemad sammud rajal lukus.
await setup({ ...base, spHas: "yes" });
const r0 = await page.evaluate(() => ({ inv: document.getElementById("spStartAge").classList.contains("is-invalid"), note: !document.querySelector('section[data-step="0"] .req-note').classList.contains("d-none"), lock: document.querySelectorAll("#path li.locked").length, star: !!document.querySelector('label[for="spStartAge"] .req') }));
check(!r0.inv, "algusvanus: viga pole kohe näha");
check(r0.note && r0.star, "kohustuslikkuse selgitus ja tärn");
check(r0.lock > 0, "hilisemad sammud on rajal lukus");
await page.evaluate(() => document.getElementById("nextBtn").click());
const r1 = await page.evaluate(() => ({ step0: !document.querySelector('section[data-step="0"]').hidden, inv: document.getElementById("spStartAge").classList.contains("is-invalid"), aria: document.getElementById("spStartAge").getAttribute("aria-invalid"), err: document.querySelector('section[data-step="0"] .req-error').textContent, focus: document.activeElement.id }));
check(r1.step0 && r1.inv && r1.aria === "true" && /Eripension alates/.test(r1.err) && r1.focus === "spStartAge", "edasi: jääb sammu, viga ja fookus: " + JSON.stringify(r1));
await page.evaluate(() => { const e = document.getElementById("spStartAge"); e.value = "55"; e.dispatchEvent(new Event("input", { bubbles: true })); });
check(await page.evaluate(() => document.querySelectorAll("#path li.locked").length) > 0, "eripensioni summa puudub: tulemus ikka lukus");
await page.evaluate(() => document.getElementById("nextBtn").click());
check(await page.evaluate(() => !document.querySelector('section[data-step="9"]').hidden && !document.getElementById("spMonthly").classList.contains("is-invalid")), "algusvanus täidetud: eripensioni samm avaneb, summa viga pole kohe");

// 1. vaates ainult jah/ei ja algusvanus; summa on eripensioni sammus.
await setup({ ...base, spHas: "yes", spStartAge: 45 });
check(await page.evaluate(() => !!document.querySelector('#path [data-goto="9"]')), "„jah“ toob eripensioni sammu teekonnale ka ilma summata");
check(await page.evaluate(() => !!document.querySelector('section[data-step="9"] #spMonthly') && !document.querySelector('section[data-step="0"] #spMonthly')), "summa lahter on eripensioni sammus");
check((await page.evaluate(() => window.__elukaar.readInput())).deferral === 0 && await page.evaluate(() => !document.getElementById("deferLocked").classList.contains("d-none")), "„jah“ lukustab edasilükkamise ka ilma summata");
check(/\d\d-aastane · \d{4}/.test(await text("#kSp")) && !(await page.evaluate(() => document.getElementById("spStartYear"))), "eripensioni aasta on sammu päises, välja juures kordust pole");
await setup({ ...base, spHas: "no", spMonthly: 1500 });
check((await page.evaluate(() => window.__elukaar.readInput())).spMonthly === 0, "„ei“ korral eripensioni summat ei arvestata");
await setup({ ...base, spHas: "yes", spMonthly: 1500, spStartAge: "" });
check(await page.evaluate(() => document.getElementById("spStartAge").required && !document.getElementById("spStartAge").classList.contains("is-invalid")), "tühi algusvanus on kohustuslik, aga viga pole kohe");

// 2c. Edasilükkamine on eripensioniga lukus ja paindlik pension võrdlusest väljas.
await setup({ ...base, spHas: "yes", spMonthly: 800, spStartAge: 65 });
const lock = await page.evaluate(() => ({ note: !document.getElementById("deferLocked").classList.contains("d-none"), txt: document.getElementById("deferLockedTxt").textContent, hidden: document.getElementById("deferSet").disabled }));
check(lock.note && lock.hidden && /eripension/i.test(lock.txt) && (await page.evaluate(() => document.getElementById("deferSet").classList.contains("d-none"))), "edasilükkamine on lukus koos põhjusega, valikud peidus");
// Pensioniea sammus: eripension või vanaduspension (suurem märgitud, vaikimisi suurem, saab valida väiksema).
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
const fpc = await page.evaluate(() => ({ shown: !document.getElementById("fpChoiceWrap").classList.contains("d-none"), opts: [...document.querySelectorAll('input[name="fpChoice"]')].map((r) => r.value + (r.checked ? "*" : "")), badge: document.querySelector('input[name="fpChoice"][value="oldAge"]').closest("label").textContent }));
check(fpc.shown && fpc.opts.join(",") === "special,oldAge*" && /suurem/.test(fpc.badge), "pensioniea sammus valik, vanaduspension (1000 €) suurem ja valitud: " + JSON.stringify(fpc));
await page.evaluate(() => { const r = document.querySelector('input[name="fpChoice"][value="special"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
check((await page.evaluate(() => window.__elukaar.readInput())).firstPillarChoice === "special", "valik eripension jõuab mootorisse");
await page.evaluate(() => { const r = document.querySelector('input[name="defer"][value="2"]'); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); } });
check((await page.evaluate(() => window.__elukaar.readInput())).deferral === 0, "eripensioniga on edasilükkamine alati 0");
await toResult();
check(!/Paindlik pension/.test(await text("#compare")), "võrdluses pole paindlikku pensioni");
await setup(base);
check(await page.evaluate(() => document.getElementById("deferLocked").classList.contains("d-none") && !document.getElementById("deferSet").classList.contains("d-none")), "ilma eripensionita on edasilükkamine avatud");

// 3. Soodustingimustel: pensioniiga väheneb valitud aastate võrra, kõik valikud töötavad vigadeta.
// Alus: lapsed (3/4/5 last, puudega laps) või tervist kahjustav töö (nimekiri 1/2); teine vanem kasutab → 0.
for (const [val, yrs, vals] of [["3 last", 1, { kidsHas: "yes", kidsB2012: 3 }], ["4 last", 3, { kidsHas: "yes", kidsB1991: 1, kidsB2012: 3 }], ["5 last", 5, { kidsHas: "yes", kidsB2013: 5 }], ["puudega laps", 5, { kidsHas: "yes", kidsB2012: 1, kidsDisabled: "yes" }], ["nimekiri 2", 5, { hazard: "list2" }], ["nimekiri 1", 10, { hazard: "list1" }]]) {
  await setup({ ...base, ...vals });
  const i = await page.evaluate(() => window.__elukaar.readInput());
  check(i.pensionAgeYears >= 65 && i.pensionAgeYears <= 68, "soodus " + val + ": tavaline pensioniiga jääb samaks: " + i.pensionAgeYears);
  check(i.soodus === yrs, "soodus " + val + ": readInput.soodus");
  await toResult();
  check((await text("#chartTableWrap")).length > 100, "soodus " + val + ": tulemus joonistub");
  check(/Soodustingimustel vanaduspension/.test(await page.evaluate(() => document.body.innerText)), "soodus " + val + ": otsusekaardil on rida");
}
await setup({ ...base, kidsHas: "yes", kidsB2012: 5, kidsEarlyUser: "other" });
check((await page.evaluate(() => window.__elukaar.readInput())).soodus === 0 && /kasutab teine vanem/.test(await text("#soodusSummary")), "teine vanem kasutab: soodustust pole");
// Laste pensionilisa: prognoosi küsimus ja lisa ainult „ei“ korral.
await setup({ ...base, kidsHas: "yes", kidsB2012: 2 });
check(await page.evaluate(() => !document.getElementById("kidsForecastWrap").classList.contains("d-none")) && /vali „jah“/.test(await text("#kidsForecastHint")), "pensionilisa küsimus ja püsiv juhend: " + (await text("#kidsForecastHint")));
const pk = await page.evaluate(() => window.__elukaar.readInput());
check(pk.kids.inForecast === "unknown" && pk.soodus === 0, "vaikimisi „ei tea“");
// Kaks õigust eraldi: 2 last → ainult pensionilisa valik; 3 last → mõlemad; 2013+ II sambaga → kumbagi pole.
const vis = () => page.evaluate(() => [!document.getElementById("kidsEarlyWrap").classList.contains("d-none"), !document.getElementById("kidsSupWrap").classList.contains("d-none")]);
check(JSON.stringify(await vis()) === "[false,true]", "2 last: ainult pensionilisa valik");
await setup({ ...base, kidsHas: "yes", kidsB2012: 3 });
check(JSON.stringify(await vis()) === "[true,true]", "3 last: mõlemad valikud");
await setup({ ...base, kidsHas: "yes", kidsB2013: 2 });
check(JSON.stringify(await vis()) === "[false,false]", "2013+ ja II sammas: valikuid pole");
await setup({ ...base, kidsHas: "yes", kidsB2012: 4, kidsEarlyUser: "other", kidsSupUser: "me" });
const sp2 = await page.evaluate(() => window.__elukaar.readInput());
check(sp2.soodus === 0 && sp2.kids.supUser === "me", "õigused jagatud: varem pensionile teine vanem, lisa mina");
await setup({ ...base, kidsHas: "yes", kidsB2012: 2 });
await toResult();
check(/Laste pensionilisa/.test(await page.evaluate(() => document.body.innerText)) && /ei arvestatud/.test(await page.evaluate(() => document.getElementById("decisionMap").textContent)), "otsusekaart: lisa ei arvestatud");
await setup({ ...base, kidsHas: "yes", kidsB2012: 2, kidsInForecast: "no" });
await toResult();
check(/\+73 € kuus/.test(await page.evaluate(() => document.getElementById("decisionMap").textContent)), "otsusekaart: lisa +73 € kuus");
// 1. vaade on grupeeritud.
check(await page.evaluate(() => [...document.querySelectorAll('section[data-step="0"] fieldset.field-group > legend')].map((l) => l.childNodes[0].textContent.trim()).join("|")) === "Sina|Riiklik pension|Sambad ja töö|Lapsed|Tööga seotud erijuhud", "1. vaate grupid");

// 3b. Soodustusega pensioni samm asendab pensioniea sammu; II samba samm jääb tavalise pensioniea järgi.
await setup({ ...base, kidsHas: "yes", kidsB2012: 4 });
const i3 = await page.evaluate(() => window.__elukaar.readInput());
const L3 = await page.evaluate(() => [...document.querySelectorAll("#path .path-label")].map((e) => e.textContent));
check(L3.includes((i3.pensionAgeYears - 3) + " a") && !L3.includes(i3.pensionAgeYears + " a") && L3.includes((i3.pensionAgeYears - 5) + " a"), "soodus 3: rajal " + (i3.pensionAgeYears - 3) + " a, mitte " + i3.pensionAgeYears + " a; II samba samm alles: " + L3.join(", "));
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
const st6 = await page.evaluate(() => ({ h: document.getElementById("h6").textContent, note: document.getElementById("soodusNote").textContent, lock: !document.getElementById("deferLocked").classList.contains("d-none"), btn: document.getElementById("deferLockedBtn").textContent }));
check(st6.h === "Soodustingimustel pensionile" && /riiklikku pensioni ei vähendata/i.test(st6.note) && /700 € kuus, siis 776 €/.test(st6.note), "soodus 3: sammu pealkiri ja märkus: " + st6.note);
check(st6.lock && st6.btn === "Muuda varem pensionile minekut", "soodus 3: edasilükkamine lukus, nupp „Muuda varem pensionile minekut“");
check(new RegExp("sammastes " + (i3.pensionAgeYears - 3) + "-aastaselt").test(await page.evaluate(() => document.body.innerText)), "alumine riba: sammas soodustusega vanuses");
await setup({ ...base, hazard: "list1" });
const i10 = await page.evaluate(() => window.__elukaar.readInput());
const L10 = await page.evaluate(() => [...document.querySelectorAll("#path .path-label")].map((e) => e.textContent));
check(L10.indexOf((i10.pensionAgeYears - 10) + " a") < L10.indexOf((i10.pensionAgeYears - 5) + " a"), "soodus 10: pensioni samm enne II samba sammu: " + L10.join(", "));
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
check(/II sammas avaneb alles/.test(await text("#soodusNote")), "soodus 10: märkus II samba avanemisest");
check(await page.evaluate(() => !document.getElementById("soodusWorkWrap").classList.contains("d-none")) && /tervist kahjustav/i.test(await page.evaluate(() => document.getElementById("soodusSummary").textContent)), "nimekiri 1: 55 a sammus töö jätkamise valik, kokkuvõte nimetab alust");

// 3c. Töö soodustusega pensioni ajal: vaikimisi ei tööta; „Töötan edasi“ avab töö lõpu; ilma tööta III samba sissemakse valik.
await setup({ ...base, kidsHas: "yes", kidsB2012: 4, p3: 5000, p3Joined: "before", p3Monthly: 100 });
let si3 = await page.evaluate(() => window.__elukaar.readInput());
check(si3.soodusWork === false && si3.workUntil === undefined, "soodus: vaikimisi ei tööta");
check(await page.evaluate(() => !document.getElementById("soodusWorkWrap").classList.contains("d-none") && document.getElementById("workUntilWrap").classList.contains("d-none") && !document.getElementById("p3AfterSet").classList.contains("d-none")), "ei tööta: III samba sissemakse küsimus, töö lõppu pole");
await page.evaluate(() => { const r = document.querySelector('input[name="p3AfterMode"][value="change"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); const e = document.getElementById("p3After"); e.value = "0"; e.dispatchEvent(new Event("input", { bubbles: true })); });
check((await page.evaluate(() => window.__elukaar.readInput())).p3After === 0, "III samba sissemakse 0 jõuab mootorisse");
await page.evaluate(() => { const r = document.querySelector('input[name="soodusWork"][value="yes"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
si3 = await page.evaluate(() => window.__elukaar.readInput());
check(si3.soodusWork === true && si3.workUntil === si3.pensionAgeYears && si3.p3After === undefined, "töötan: töö lõpp vaikimisi tavaline pensioniiga: " + JSON.stringify({ w: si3.workUntil, pa: si3.pensionAgeYears }));
check(await page.evaluate(() => !document.getElementById("workUntilWrap").classList.contains("d-none") && document.getElementById("p3AfterSet").classList.contains("d-none")), "töötan: töö lõpu valik, III küsimust pole");
check(/tõstab iga tööaasta pensioni u [\d,]+ € kuus/.test(await text("#soodusAccrualTxt")), "töötan: pensioni tõus kuus: " + (await text("#soodusAccrualTxt")));
await toResult();
check(/töötad: palk katab kulud/.test(await text("#chartSummary")), "tulemus: graafiku kokkuvõte selgitab töötamist");
check(/töötan kuni \d+-aastaseks/.test(await text("#recap")), "kokkuvõte: töötan kuni");

// 4. Varem pensionile: valiku all on vanus, millal pensionile lähed (pensioniea vihje on muutumatu).
await setup({ ...base, kidsHas: "yes", kidsB2012: 4 });
check(/\d\d-aastaselt/.test(await text("#soodusNote")) && !/\d/.test(await text("#soodusYearsHint")), "varem pensionile: vanus pensionile mineku sammus, välja juhend püsiv (numbriteta)");

// Teine otsustuskoht pensionieas: varem jätkasid eripensioniga, pensioni ajal töö tõstab vanaduspensioni.
const pick = (name, v) => page.evaluate(([n, x]) => { const r = document.querySelector('input[name="' + n + '"][value="' + x + '"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }, [name, v]);
await setup({ ...base, kidsHas: "yes", kidsB2012: 5, kidsInForecast: "no", spHas: "yes", spMonthly: 1150, spStartAge: 55 });
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
const fp1 = await page.evaluate(() => ({ opts: [...document.querySelectorAll('input[name="fpChoice"]')].map((r) => r.value + (r.checked ? "*" : "")), old: document.querySelector('input[name="fpChoice"][value="oldAge"]').closest("label").textContent }));
check(/lisasime u/.test(fp1.old), "pensionilisa märge (lisatud): " + fp1.old);
const shownPa = () => page.evaluate(() => !document.getElementById("fpChoicePaWrap").classList.contains("d-none"));
if (fp1.opts.includes("special*")) {
  check(!(await shownPa()), "ilma tööta: vanaduspension pensionieas sama, teist valikut pole: " + fp1.opts);
} else check(true, "");
await pick("fpChoice", "special");
await pick("soodusWork", "yes");
const pa2 = await page.evaluate(() => ({ shown: !document.getElementById("fpChoicePaWrap").classList.contains("d-none"), step: document.getElementById("fpChoicePaWrap").closest("section").dataset.step, intro: document.getElementById("fpChoicePaIntro").textContent, opts: [...document.querySelectorAll('input[name="fpChoicePa"]')].map((r) => r.value + (r.checked ? "*" : "")) }));
check(pa2.shown && pa2.step === "7" && /töötatud aastad tõstavad/.test(pa2.intro), "eripension varem + töö: pensionieas uus valik pensionipõlve sammus: " + JSON.stringify(pa2));
check(pa2.opts.length === 2 && pa2.opts.some((o) => o.endsWith("*")), "pensionieas üks valik valitud: " + pa2.opts);
await pick("fpChoicePa", "special");
check((await page.evaluate(() => window.__elukaar.readInput())).firstPillarChoicePa === "special", "pensioniea valik jõuab mootorisse");
await pick("fpChoice", "oldAge");
check(!(await shownPa()), "varem vanaduspension: pensionieas uut valikut pole");
await setup({ ...base, kidsHas: "yes", kidsB2012: 5, kidsInForecast: "yes", spHas: "yes", spMonthly: 900, spStartAge: 55 });
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
check(/on SKA prognoosis/.test(await page.evaluate(() => document.querySelector('input[name="fpChoice"][value="oldAge"]').closest("label").textContent)), "pensionilisa märge ka siis, kui prognoos sisaldab");
// KKK: eripensioni ja laste pensioni võrdlus (pere rida), fondipensioni küsimused selles vaates peidus.
await setup({ ...base, kidsHas: "yes", kidsB2012: 5, kidsInForecast: "no", spHas: "yes", spMonthly: 1300, spStartAge: 55 });
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
const spq = await page.evaluate(() => ({ item: !document.getElementById("spCompareItem").classList.contains("d-none"), link: !document.getElementById("spCompareLink").classList.contains("d-none"),
  rows: document.querySelectorAll("#spCompare tbody tr").length, txt: document.getElementById("spCompare").textContent,
  visible: [...document.querySelectorAll("#faq65 details.faq-item")].filter((d) => !d.classList.contains("d-none")).map((d) => d.id) }));
check(spq.item && spq.link && spq.rows === 3 && /Pere kokku/.test(spq.txt) && /paralleelselt kasutada teine vanem/.test(spq.txt) && /eripensionile ei lisandu/.test(spq.txt), "eripension vs laste pension: KKK võrdlus pere reaga: " + JSON.stringify({ rows: spq.rows }));
check(spq.visible.join() === "spCompareItem", "valiku vaates KKK-s ainult võrdlus: " + spq.visible.join());
await setup(base);
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
check(await page.evaluate(() => [...document.querySelectorAll("#faq65 details.faq-fond")].some((d) => !d.classList.contains("d-none")) && document.getElementById("spCompareItem").classList.contains("d-none")), "tavaline pensioniiga samba valikuga: fondipensioni KKK nähtav");
await setup({ ...base, kidsHas: "yes", kidsB2012: 5 });
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
check(await page.evaluate(() => [...document.querySelectorAll("#faq65 details.faq-fond")].some((d) => !d.classList.contains("d-none")) && !document.querySelector("#faq65 details.faq-ah").classList.contains("d-none")), "5 a varem, III samba valik lukus (ainult info): fondipensioni KKK ja aastahinne nähtavad");
check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nEripension (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
