// Samm „Sina“ nimekirjana ja tulemuste lehe kiirmuutmine.
// Kasutus: node tests/elukaar-ui-nimekiri.mjs [URL]
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const NM = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules");
const CHART = readFileSync(join(NM, "chart.js/dist/chart.umd.js"), "utf8");
const BOOTSTRAP = readFileSync(join(NM, "bootstrap/dist/css/bootstrap.min.css"), "utf8"); // paigutuse kontroll vajab päris stiile
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errs = [];
const open = async (q, vp) => {
  const ctx = await browser.newContext({ viewport: vp || { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
  await ctx.route("**/cdn.jsdelivr.net/**", (r) => (/\.css$/.test(r.request().url()) ? r.fulfill({ contentType: "text/css", body: BOOTSTRAP }) : r.fulfill({ contentType: "application/javascript", body: CHART })));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url + "/elukaar/" + (q || ""), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__elukaar);
  await page.waitForTimeout(300); // esimene joonistus (go(0)) käib pärast testikonksu
  return page;
};
const openSecs = (page) => page.evaluate(() => [...document.querySelectorAll("#sinaList > li")].filter((li) => !li.querySelector(".opt-body").hidden).map((li) => li.dataset.sec).join(","));

// Nullist: kõik põhiosad lahti, lapsed ja erijuhud kinni „+ Lisa“ nupuga; eeltäite märkust pole.
let page = await open();
check((await openSecs(page)) === "me,state,p2,p3", "nullist: põhiosad lahti: " + (await openSecs(page)));
check(await page.evaluate(() => /Lisa lapsed/.test(document.getElementById("add-kids").textContent) && /Lisa erijuht/.test(document.getElementById("add-work").textContent)), "lisa-nupud");
// TARA: sünniaasta ja sugu on alati eeltäidetud, muud väljad tühjad; „Edasi“ lukus, mootor ei kuku.
check(await page.evaluate(() => ["birthYear", "sex"].every((id) => document.getElementById(id).classList.contains("is-prefilled")) && ["p1Monthly", "grossMonthly", "p2", "p3", "p3Monthly"].every((id) => document.getElementById(id).value === "")), "TARA: sünniaasta ja sugu eeltäidetud, muu tühi");
check(await page.evaluate(() => !document.getElementById("nextBtn").disabled && /riiklik pension/.test(document.getElementById("nextHint").textContent) && /Täitmata/.test(document.querySelector('[data-sec="state"] .opt-sum').textContent) && window.__elukaar.readInput().p1Monthly === 0), "tühjad väljad: edasi lukus, mootor töötab");
// Teekond: lukus sammu silt on loetava kontrastiga (pole poolläbipaistev).
check(await page.evaluate(() => { const l = document.querySelector("#path li.locked .path-label"); return !!l && (getComputedStyle(l).opacity === "1" && getComputedStyle(l).color === "rgb(0, 47, 99)"); }), "rajal sildid kontrastsed");
await page.evaluate(() => { for (const [id, v] of Object.entries({ p1Monthly: 900, grossMonthly: 2200, p2: 25000, p3: 5000, p3Monthly: 0 })) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); } });
check(await page.evaluate(() => !document.getElementById("nextHint").textContent), "täidetud: vihjet pole");
// Nupu nähtav nimi on unikaalne; sulgemisel kokkuvõte linnukesega.
check(await page.evaluate(() => { const b = document.getElementById("toggle-p3"); return b.firstChild.textContent === "Sulge" && b.querySelector(".visually-hidden").textContent === " III sammas"; }), "Sina: nähtav „Sulge“, täisnimi ekraanilugejale");
await page.click("#toggle-p3");
check(await page.evaluate(() => document.getElementById("body-p3").hidden && document.getElementById("toggle-p3").textContent === "Muuda III sammast" && document.getElementById("toggle-p3").firstChild.textContent === "Muuda" && document.activeElement.id === "toggle-p3" && /5\s?000 €/.test(document.querySelector('[data-sec="p3"] .opt-sum').textContent)), "III sammas kinni: kokkuvõte ja „Muuda III sammast“");
// Kohustuslikud väljad: sõna „kohustuslik“ sildis (mitte tärn), selgitus sammu alguses.
check(await page.evaluate(() => /kohustuslik/.test(document.querySelector('label[for="grossMonthly"] .req').textContent) && !document.querySelector('[data-step="0"] .req-note').classList.contains("d-none") && !/\*/.test(document.querySelector('[data-step="0"] .req-note').textContent)), "kohustuslik-märge ja selgitus");
// Tühjaks jäetud väli: punane äär ja veateade välja nimega abiteksti all.
await page.fill("#grossMonthly", ""); await page.focus("#grossMonthly"); await page.press("#grossMonthly", "Tab");
check(await page.evaluate(() => { const el = document.getElementById("grossMonthly"), fb = document.getElementById("grossMonthlyErr"); return el.classList.contains("is-invalid") && fb.textContent === "Brutopalga väli on kohustuslik." && fb.previousElementSibling.id === "grossUnit" && el.getAttribute("aria-describedby").includes("grossMonthlyErr"); }), "tühi väli: viga nimega abiteksti all");
await page.fill("#grossMonthly", "2200");
check(await page.evaluate(() => !document.getElementById("grossMonthly").classList.contains("is-invalid")), "täites viga kaob");
// Lisamata valikulise osa selgitus on tavalist värvi (mitte „Täitmata“ värvi).
check(await page.evaluate(() => !document.querySelector('[data-sec="kids"] .opt-sum').classList.contains("is-empty")), "lapsed: selgitus pole hoiatusvärviga");
// Viga välja lahkumisel, parandamisel kaob kohe. „Edasi“ on aktiivne: täitmata väljaga jääb samm alles ja fookus läheb
// sammu alguse veateatele (lingid väljadele); edenemise real veateksti pole.
await page.fill("#p1Monthly", "");
await page.click("#nextBtn");
check(await page.evaluate(() => { const b = document.activeElement; return !document.querySelector('section[data-step="0"]').hidden && b.classList.contains("req-error") && b.getAttribute("role") === "alert" && !!b.querySelector('a[href="#p1Monthly"]') && document.getElementById("p1MonthlyErr").textContent === "Riikliku pensioni väli on kohustuslik."; }), "edasi täitmata väljaga: fookus veateatel, lingid väljadele");
check(await page.evaluate(() => !/viga/i.test(document.getElementById("sinaProgress").textContent)), "edenemise real pole veateksti");
await page.click('section[data-step="0"] .req-error a[href="#p1Monthly"]');
check(await page.evaluate(() => document.activeElement.id === "p1Monthly"), "veateate link viib väljale");
await page.fill("#birthYear", "1900"); await page.press("#birthYear", "Tab");
check(await page.evaluate(() => document.getElementById("birthYear").getAttribute("aria-invalid") === "true" && /1930–2008/.test(document.getElementById("birthYearErr").textContent)), "vale sünniaasta: viga väljal");
await page.fill("#birthYear", "1985");
check(await page.evaluate(() => document.getElementById("birthYear").getAttribute("aria-invalid") === "false" && document.getElementById("birthYearErr").textContent === ""), "parandus: viga kaob kohe");
await page.fill("#p1Monthly", "900");
check(await page.evaluate(() => !document.getElementById("p1Monthly").classList.contains("is-invalid")), "korras: viga kadunud");
// Lapsed: lisa → lahti, eemalda → kinni ja „ei“.
await page.click("#add-kids");
check(await page.evaluate(() => document.activeElement.id === "toggle-kids" && document.activeElement.getAttribute("aria-expanded") === "true"), "lisa lapsed: fookus jääb nupule (nüüd „Sulge“)");
check(await page.evaluate(() => document.getElementById("kidsHas").value === "yes" && document.getElementById("kidsHasWrap").classList.contains("d-none") && document.querySelectorAll("#kidsList .kid-row").length === 1), "lisa lapsed: 8 a küsimust pole, kohe laste arv ja sünniaasta");
// Tulevane laps on lubatud; pensionile minekuks alla 8 aasta kasvatatud last ei arvestata ja märkus ütleb seda.
await page.evaluate(() => { const by = +document.getElementById("birthYear").value, el = document.getElementById("kidsBorn0"); el.value = String(by + 60); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
check(await page.evaluate(() => { const k = window.__elukaar.readInput().kids; return document.getElementById("kidsBorn0").getAttribute("aria-invalid") === null && k.late === 1 && !document.getElementById("kidsLateWrap").classList.contains("d-none"); }), "tulevane laps lubatud, alla 8 a pensioni alguseks ei arvestata");
await page.click("#removeKids");
check(await page.evaluate(() => document.getElementById("kidsHas").value === "no" && document.getElementById("body-kids").hidden && document.activeElement.id === "add-kids"), "eemalda lapsed: lähtestab, fookus lisa-nupul");
await page.context().close();

// Eeltäidetud profiil: kolm esimest osa lahti, märkus nähtav. (Selle profiiliga ei kanna „Mugav“ elu lõpuni: kaartidel on muutus.)
page = await open("?p=mitte-coaster");
check((await openSecs(page)) === "me,state,p2", "profiil: kolm esimest lahti: " + (await openSecs(page)));
check(await page.evaluate(() => !document.getElementById("prefillNote").classList.contains("d-none") && /riiklikest andmekogudest/.test(document.getElementById("prefillNote").textContent)), "profiil: eeltäite märkus");

// Tulemuste leht: read pealkirja ja valikuga; „Muuda“ tõstab sammu valikud rea alla (üks komplekt, mitte koopia).
await page.evaluate(() => document.querySelector('#path [data-goto="10"]').click());
const rows = await page.evaluate(() => [...document.querySelectorAll("#recap li[data-row] h5")].map((h) => h.textContent));
check(rows[0] === "Sinu andmed" && rows[1] === "II samba tootlus" && rows[2] === "III samba tootlus" && rows.includes("Kulud pensionil"), "read: " + rows.join(" | "));
check(await page.evaluate(() => document.querySelector('[data-row="0"] button').textContent === "Muuda sammus „Sina“"), "Sinu andmed: nupp sammule");
check(await page.evaluate(() => { const b = document.getElementById("res-5"); return b.textContent.startsWith("Muuda") && b.querySelector(".visually-hidden") && getComputedStyle(b).whiteSpace === "nowrap" && b.getAttribute("aria-expanded") === "false"; }), "Muuda: nähtav lühike, ekraanilugejale täisnimi");
await page.click("#res-5");
check(await page.evaluate(() => document.activeElement.id === "res-5" && document.activeElement.textContent.startsWith("Sulge")), "Muuda: fookus jääb rea nupule");
check(await page.evaluate(() => !!document.querySelector("#rp-5 #sb-5") && document.querySelectorAll('input[name="payout"]').length === 3 && document.getElementById("res-5").getAttribute("aria-expanded") === "true"), "valikud on tõstetud rea alla (üks komplekt)");
const before = await page.evaluate(() => document.getElementById("answer").textContent);
await page.click('#rp-5 input[name="payout"][value="lump"]');
check(await page.evaluate((b) => document.getElementById("answer").textContent !== b && window.__elukaar.readInput().payout === "lump" && !!document.getElementById("rp-5") && /korraga/.test(document.querySelector('[data-row="5"] .res-now').textContent), before), "valik arvutab kohe ümber, paneel jääb lahti");
await page.click("#res-8");
check(await page.evaluate(() => !!document.getElementById("rp-5") && !!document.getElementById("rp-8")), "mitu rida võib olla lahti");
// Igal kaardil tulemus; valitud kaardil „· praegu“, teistel muutus märgiga (mitte ainult värviga).
const oc = await page.evaluate(() => [...document.querySelectorAll('#rp-8 .choice')].map((l) => ({ v: l.querySelector("input").value, on: l.querySelector("input").checked, t: (l.querySelector(".outcome") || {}).textContent || "" })));
check(oc.length === 3 && oc.every((o) => /^Raha jätkub /.test(o.t)) && oc.filter((o) => o.on).every((o) => /· praegu$/.test(o.t)), "kulukaartidel tulemus: " + JSON.stringify(oc));
check(oc.some((o) => !o.on && /[+−]\d+ a võrreldes praegusega/.test(o.t)), "valimata kaardil muutus aastates märgiga");
const muuga = oc.find((o) => o.v === "mugav").t.replace(/ võrreldes.*| · praegu/, "");
await page.click('#rp-8 input[name="pkg"][value="mugav"]');
check(await page.evaluate((m) => document.querySelector('#rp-8 input[value="mugav"]').closest(".choice").querySelector(".outcome").textContent.startsWith(m.replace(/ [+−]\d+ a$/, "")), muuga), "valitud kaardi tulemus = eelnevalt näidatud tulemus");
await page.keyboard.press("Escape");
check(await page.evaluate(() => !document.getElementById("rp-8") && document.activeElement.id === "res-8"), "Esc sulgeb, fookus Muuda nupul");
// Fondi tootlus: sama väärtus mis sammus „Sina“.
// II ja III samba tootlus eraldi read, sama väärtus mis sammus „Sina“; III tootlus jõuab mootorisse eraldi.
await page.click("#res-fund2");
await page.click('#rp-fund2 input[value="index"]');
check(await page.evaluate(() => document.getElementById("fundCur").value === "index" && !/vahet/i.test(document.getElementById("rp-fund2").textContent)), "II samba tootlus muudab fundCur, fondivahetust ei mainita");
await page.click("#res-fund3");
await page.click('#rp-fund3 input[value="cons"]');
check(await page.evaluate(() => { const i = window.__elukaar.readInput(); return document.getElementById("fund3Cur").value === "cons" && i.realReturn === 0.04 && i.realReturn3 === 0 && /III samba tootlus/.test(document.querySelector('[data-row="fund3"] h5').textContent); }), "III samba tootlus eraldi: II 4%, III 0%");
check(await page.evaluate(() => !document.querySelector("#recap [data-res-done]") && !/Valmis/.test(document.getElementById("recap").textContent)), "paneelis „Valmis“ nuppu pole");
await page.click("#res-5");
check(await page.evaluate(() => document.getElementById("sb-5").parentNode.dataset.step === "5" && document.activeElement.id === "res-5" && document.getElementById("res-5").textContent.startsWith("Muuda")), "Sulge: valikud tagasi sammus");
// Sammule minnes on kõik valikud oma sammus.
await page.click("#res-6");
await page.evaluate(() => document.querySelector('#path [data-goto="6"]').click());
check(await page.evaluate(() => [3, 4, 5, 6, 7, 8, 9].every((i) => document.getElementById("sb-" + i).parentNode.dataset.step === String(i)) && !document.querySelector('section[data-step="6"]').hidden), "sammule minnes valikud tagasi");
await page.context().close();

// Eripensioni rida: sama sammu (9) valikud rea all.
page = await open("?p=liige-steady");
await page.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  set("spHas", "yes"); set("spStartAge", "50"); set("spMonthly", "1000"); });
await page.evaluate(() => document.querySelector('#path [data-goto="10"]').click());
check(await page.evaluate(() => document.querySelector('[data-row="9"] h5').textContent === "Eripension"), "eripensioni rida tulemuste lehel");
await page.click("#res-9");
await page.click('#rp-9 input[name="spWork"][value="no"]');
// Rea all välja trükkides jääb fookus ja väärtus (ümberjoonistus ei katkesta sisestust).
await page.click("#spMonthly", { clickCount: 3 }); await page.keyboard.type("1234", { delay: 30 });
check(await page.evaluate(() => document.getElementById("spMonthly").value === "1234" && document.activeElement.id === "spMonthly"), "trükkimine rea all: väärtus ja fookus jäävad");
check(await page.evaluate(() => !!document.querySelector("#rp-9 #sb-9") && window.__elukaar.readInput().spWork === false && /ei tööta/.test(document.querySelector('[data-row="9"] .res-now').textContent)), "eripensioni valik rea all muudab tulemust");
await page.context().close();

// Varane väljavõtt (samm 3) rea all; II välja võtnul (uuesti ei liitu) 60 a ja pensioniea II valikut ei pakuta ka kiirmuutmises.
page = await open("?p=liige-steady");
await page.evaluate(() => document.querySelector('#path [data-goto="10"]').click());
check(await page.evaluate(() => document.querySelector('[data-row="3"] h5').textContent === "Raha välja enne pensioniiga" && /Ei võta/.test(document.querySelector('[data-row="3"] .res-now').textContent)), "varase väljavõtu rida");
await page.click("#res-3");
await page.click('#rp-3 input[name="p2Early"][value="yes"]');
await page.fill("#p2EarlyAge", "52"); await page.press("#p2EarlyAge", "Tab");
check(await page.evaluate(() => { const i = window.__elukaar.readInput(); return !!document.querySelector("#rp-3 #sb-3") && i.p2Gone && !i.p2Has && i.payout === "grow" && /52-aastaselt/.test(document.querySelector('[data-row="3"] .res-now').textContent); }), "väljavõtt rea all jõuab mootorisse");
await page.click("#res-5");
check(await page.evaluate(() => document.getElementById("p2At60Set").disabled && ![...document.querySelectorAll('#p2At60Set .choice')].some((l) => l.querySelector(".outcome")) && !/(^|[^I])II sammas/.test(document.querySelector('[data-row="5"] h5').textContent)), "60 a: II valik lukus, kaartidel tulemust pole");
await page.click("#res-6");
check(await page.evaluate(() => { const f = document.getElementById("payoutPaSet"); return (f.disabled || f.classList.contains("d-none")) && !f.querySelector(".outcome"); }), "pensionieas II valikut ei pakuta");
// Märkuse link 3. sammu avab tulemuste lehel rea 3, mitte ei vii sammule.
await page.click('#p2At60Note [data-goto="3"]');
check(await page.evaluate(() => !document.querySelector('section[data-step="10"]').hidden && !!document.getElementById("rp-3") && document.activeElement.id === "res-3"), "link 3. sammu avab rea 3");
// Fondipension maksab kuludest rohkem: soovitus, „Muuda“ avab rea; tuleviku hindades fondide kasv; jäägi „?“.
page = await open();
await page.evaluate(() => {
  const s = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const pick = (n, v) => { const r = document.querySelector('input[name="' + n + '"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); };
  s("birthYear", 1990); s("p1Monthly", 850); s("grossMonthly", 3900); s("p2Rate", "0.06"); s("p2", 50000); s("p3", 30000); s("p3Monthly", 500); s("fundCur", "index"); s("fund3Cur", "index");
  pick("payout", "fund"); pick("p3pa", "fund");
});
await page.evaluate(() => document.querySelector('#path [data-goto="10"]').click());
check(await page.evaluate(() => { const b = document.getElementById("surplusTip"); return !b.classList.contains("d-none") && /rohkem, kui kulud vajavad/.test(b.textContent) && /hoiusel/.test(b.textContent); }), "ülejäägi soovitus nähtav");
await page.click("#surplusTip [data-open-row]");
check(await page.evaluate(() => document.activeElement.id === "res-5" && !!document.getElementById("rp-5")), "soovituse „Muuda“ avab rea 5");
await page.click("#nominalToggle");
check(await page.evaluate(() => /Fondid kasvavad siis umbes 6,1% aastas/.test(document.getElementById("moneyNote").textContent) && document.getElementById("nominalState").textContent === "sees"), "tuleviku hindades: fondide kasv 4% + 2% ≈ 6,1%");
check(await page.evaluate(() => !!document.querySelector('#legacy [data-help="legacyLeft"]') && !!window.ELUKAAR_ABI.legacyLeft), "jäägi juures „?“ selgitus");
await page.context().close();

// 67+ sammus fondipensioni algus eraldi II ja III sambale.
page = await open("?p=liige-steady");
await page.evaluate(() => document.querySelector('#path [data-goto="7"]').click());
check(await page.evaluate(() => !document.getElementById("fundFromWrap").classList.contains("d-none") && !document.getElementById("fundFrom3Wrap").classList.contains("d-none")), "67+: II ja III samba algus eraldi valikutena");
await page.evaluate(() => { const s = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }; s("fundFrom", "67"); s("fundFrom3", "80"); });
check(await page.evaluate(() => { const i = window.__elukaar.readInput(); return i.fundFrom === 67 && i.fundFrom3 === 80 && i.p3Sep.mode === "fund" && i.p3Sep.start === 80; }), "III samba fondipension algab oma vanusest (80), II oma (67)");
await page.context().close();

// Telefon 375 px: horisontaalset kerimist pole, nupp teksti all.
page = await open("?p=liige-steady", { width: 375, height: 800 });
const wide = () => page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > 376 && !e.closest("#path")).slice(0, 3).map((e) => e.tagName + "#" + e.id + "." + e.className + "<" + Math.round(e.getBoundingClientRect().right) + "/" + document.documentElement.scrollWidth).join(" "));
check(await page.evaluate(() => document.documentElement.scrollWidth <= 375), "375 px: pole horisontaalset kerimist: " + (await wide()));
check(await page.evaluate(() => { const r = document.querySelector('[data-sec="p3"]'); const h = r.querySelector("h3").getBoundingClientRect(), b = r.querySelector("[data-toggle]").getBoundingClientRect(); return b.top >= h.bottom; }), "375 px: nupp teksti all");
await page.evaluate(() => document.querySelector('#path [data-goto="10"]').click());
await page.click("#res-6");
check(await page.evaluate(() => document.documentElement.scrollWidth <= 375), "375 px: lahti rida ei kerki külgsuunas: " + (await wide()));
await page.context().close();

check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log("Nimekiri (UI): " + passed + " kontrolli läbis, " + failed + " kukkus");
process.exit(failed ? 1 : 0);
