// Suitsutest: käib mängu 5 sammu läbi telefonis ja arvutis ning kontrollib põhiarvu.
// Kasutus: node tests/smoke.mjs <URL>   (vaikimisi http://localhost:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const url = process.argv[2] || "http://localhost:8787";
const viewports = [
  { name: "telefon", width: 375, height: 812 },
  { name: "arvuti", width: 1280, height: 800 },
];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };
// Ligipääsetavus: axe-core WCAG 2.1 AA reeglid nähtaval ekraanil; tõsised ja kriitilised vead kukutavad testi.
async function a11y(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}

for (const vp of viewports) {
  console.log(`\n${vp.name} (${vp.width}×${vp.height})`);
  const page = await browser.newPage({ viewport: vp, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // oma failid peavad laadima; väliseid (Google Fonts) ei arvesta
  const own = (u) => new URL(u).origin === new URL(url).origin && !new URL(u).pathname.startsWith("/api/"); // /api/ testib eraldi kontroll
  page.on("requestfailed", (r) => { if (own(r.url())) errors.push("ei laadinud: " + r.url()); });
  page.on("response", (r) => { if (own(r.url()) && r.status() >= 400) errors.push(r.status() + " " + r.url()); });
  await page.goto(url + (url.includes("?") ? "&" : "?") + "raam=panus", { waitUntil: "domcontentloaded" });

  check(await page.isVisible("text=Millal pensionile minna?"), "1. samm avaneb");
  check(await page.textContent("#o-age") === "66 a (aastal 2036)", "pensioniiga 1970 → 66 a");
  await a11y(page, "1. avaekraan");
  await page.click("#go-bet");
  await page.click('.odds[data-k="3"]');
  check(await page.textContent("#s-odds") === "1,18", "koefitsient +3 a = 1,18");
  await a11y(page, "2. panus");
  await page.click("#go-spin");
  check(await page.isVisible("#wsvg path"), "3. ratas joonistatud");
  check(!(await page.$$eval("#wsvg path", (ps) => ps.some((p) => /green|red/.test(p.getAttribute("fill") || "")))), "ratas ei kasuta rohelist ega punast");
  await a11y(page, "3. ratas");
  await page.click("#spin");
  await page.waitForSelector('[data-screen="4"]:not([hidden])', { timeout: 8000 });
  check(true, "4. kõne avaneb");
  check(await page.isVisible("text=ei küsi kunagi koode, PIN-i ega raha"), "turvarida kõne-ekraanil nähtav");
  await page.click("#accept");
  check(await page.isVisible("#quote"), "tsitaat nähtav");
  await a11y(page, "4. kõne");
  await page.click("#go-truth");
  check(await page.textContent("#t-be") === "85 a 4 k", "tasuvuspunkt mees 1970 +3 a = 85 a 4 k");
  const p = await page.textContent("#t-p");
  check(/^\d+(,\d)?%$/.test(p), `võidu tõenäosus kuvatud (${p})`);
  check((await page.$$("#chart path")).length > 20, "graafik joonistatud");
  check(await page.$$eval("#chart path", (ps) => ps.some((p) => (p.getAttribute("fill") || "").includes("hatch"))), "kaotus on graafikul triibuline (mitte ainult värv)");
  await a11y(page, "5. tõde");
  check(/telefonipetturid/.test(await page.textContent("#tricks")), "petturivõtete paljastus olemas");
  check(await page.isVisible("text=Reinson, Post, Uusberg 2026"), "uuringu viide nähtav");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "horisontaalset kerimist pole");
  check(errors.length === 0, "konsoolis vigu pole" + (errors.length ? ": " + errors.join(" | ") : ""));
  await page.close();
}

// Kingituse raam (?raam=kingitus): sama mudel, teine sõnastus, kasiinovõtteid pole
{
  const vp = viewports[0];
  console.log(`\nkingituse raam, ${vp.name}`);
  const page = await browser.newPage({ viewport: vp, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(url + sep + "raam=kingitus", { waitUntil: "domcontentloaded" });
  check(await page.isVisible("text=Mida tahaksid pensionil teha?"), "tegevuse küsimus nähtav");
  await page.click('[data-act="lapsed"]');
  await page.click("#go-bet");
  check(!(await page.isVisible("#ticker")) && !(await page.isVisible("#timer")), "LIVE-riba ja taimer peidetud");
  await page.click('.odds[data-k="3"]');
  check(await page.textContent("#s-odds") === "+18%", "kingitus +3 a = +18%");
  check(/Kingin oma tulevasele minale 3 aastat/.test(await page.textContent("#s-title")), "kupong on kingitus");
  check(/kogu eluks/.test(await page.textContent("#s-win-l")) && await page.textContent("#s-win") === "+147 € kuus", "tulevase mina vaade");
  check(await page.evaluate(() => { const s = document.querySelector(".slip"); return s.scrollWidth <= s.clientWidth + 1; }), "kupong mahub telefoni");
  await page.click("#go-spin");
  await page.click("#spin");
  await page.waitForSelector('[data-screen="4"]:not([hidden])', { timeout: 8000 });
  check(await page.isVisible("#callsafe"), "turvarida kõne-ekraanil nähtav");
  await page.click("#accept");
  const q = await page.textContent("#quote");
  check(/kingi|Kingitus|kinkisid/i.test(q) && !/Oleksin pidanud/.test(q), "kõne räägib kingitusest, ei süüdista");
  await page.click("#go-truth");
  check(await page.textContent("#t-be") === "85 a 4 k", "tasuvuspunkt sama mis panuse raamis");
  const tricks = await page.textContent("#tricks");
  check(/Sama otsus, teine raam/.test(tricks) && !/Taimer oli võlts/.test(tricks), "paljastus nimetab raami");
  check(/ei pärandu/.test(tricks), "pärandumise märkus olemas");
  check(await page.isVisible("#other-game"), "nupp „Vali teine mäng“ olemas");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "horisontaalset kerimist pole");
  check(errors.length === 0, "konsoolis vigu pole" + (errors.length ? ": " + errors.join(" | ") : ""));
  await page.close();
}
// Elu-kupong: valitakse avaekraanil
for (const vp of viewports) {
  console.log(`\nelu-kupong, ${vp.name}`);
  const page = await browser.newPage({ viewport: vp, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  check((await page.$$('[data-game][aria-pressed="true"]')).length === 1 && await page.isVisible("#loosnote"), "mäng loositi avaekraanil");
  await page.click('[data-game="kupong"]');
  check(/raam=kupong/.test(page.url()), "mänguvalik jõuab aadressiribale");
  check(await page.isVisible("#v0"), "sambavara väli nähtav");
  await page.click("#go-bet");
  check((await page.$$("#m-def .odds")).length === 4, "ajastuse turg: 4 valikut");
  await a11y(page, "elu-kupong");
  const oIdx = parseFloat((await page.textContent('[data-fund="indeks"] .val')).replace(",", "."));
  const oExp = parseFloat((await page.textContent('[data-fund="kallis"] .val')).replace(",", "."));
  check(oIdx < oExp && oIdx < 1.5, `indeksfond on kindlam panus (${oIdx} vs ${oExp})`);
  await page.click('#alc-now button[data-i="2"]');
  const before = await page.textContent('#m-def [data-k="3"] .val');
  check(/BOOST/.test(await page.textContent("#boostline")) === false, "praegune tase üksi ei anna boosti");
  await page.click('#alc-prom button[data-i="0"]');
  check(/BOOST/.test(await page.textContent("#boostline")), "lubadus annab boosti");
  const after = await page.textContent('#m-def [data-k="3"] .val');
  check(before !== after, `lubadus muudab ajastuse koefitsienti (${before} → ${after})`);
  await page.click('[data-mac="infl"][data-side="yle"]');
  check((await page.$$("#k-legs li")).length === 4, "kupongil 3 panust + lubadus");
  check(/^\d+,\d\d$/.test(await page.textContent("#k-odds")), "kogukoefitsient kuvatud");
  check(await page.evaluate(() => { const s = document.querySelector('[data-screen="6"] .slip'); return s.scrollWidth <= s.clientWidth + 1; }), "kupong mahub ekraanile");
  await page.click("#go-life");
  check(await page.isVisible("#wsvg path"), "elu-ratas joonistatud");
  await page.click("#spin");
  await page.waitForSelector('[data-screen="4"]:not([hidden])', { timeout: 8000 });
  check(await page.isVisible("#callsafe"), "turvarida kõne-ekraanil nähtav");
  await page.click("#accept");
  const q = await page.textContent("#quote");
  check(q.length <= 400 && q.length > 30, `kõne mahub häälesse (${q.length} märki)`);
  await page.click("#go-truth");
  check((await page.$$("#k-settled tr")).length >= 4, "kupong arveldatud");
  await a11y(page, "kupongi tõde");
  check(/sõltumatud/.test(await page.textContent("#tricks")), "kombo paljastus olemas");
  check(await page.isVisible("text=pole sinu kontrolli all"), "kontrolli all / mitte eristus");
  check(!(await page.isVisible("#chart")), "panuse graafik peidetud");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "horisontaalset kerimist pole");
  // tagasiside
  await page.click("#go-fb");
  check(await page.isVisible("text=Mis oli sinu pensioni puhul"), "tagasiside küsib kupongi arusaamist");
  await a11y(page, "tagasiside");
  await page.click("#fb-send");
  check(await page.isVisible("#fb-need"), "kohustuslikud küsimused kontrollitud");
  await page.click("#fq1o button >> nth=0"); await page.click("#fq2o button >> nth=3"); await page.click("#fq3o button >> nth=0");
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/s") && r.request().postData().includes("feedback"), { timeout: 5000 }).catch(() => null);
  await page.click("#fb-send");
  const resp = await sent;
  check(await page.isVisible("#fb-thanks"), "tänu kuvatud");
  check(resp && resp.status() === 200, "vastus salvestati (" + (resp ? resp.status() : "päringut polnud") + ")");
  await page.click("#fb-other");
  await page.click('[data-game="panus"]');
  await page.click("#go-bet");
  check(await page.textContent("#s-odds") !== null && await page.isVisible("#ticker"), "tagasi kasiinosse: LIVE-riba olemas");
  check(errors.length === 0, "konsoolis vigu pole" + (errors.length ? ": " + errors.join(" | ") : ""));
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
