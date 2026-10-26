// Selgitused („?“): nupud, dialoog (nimi, fookus, klaviatuurilõks, Esc, fookus tagasi), axe ligipääsetavus.
// Kasutus: node tests/elukaar-ui-abi.mjs [URL]
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const DIR = dirname(fileURLToPath(import.meta.url));
const CHART = readFileSync(join(DIR, "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const AXE = readFileSync(join(DIR, "..", "node_modules/axe-core/axe.min.js"), "utf8");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errs = [];
for (const [name, vp] of [["töölaud", { width: 1280, height: 900 }], ["mobiil", { width: 375, height: 800 }]]) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
  await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__elukaar);
  const keys = await page.evaluate(() => [...document.querySelectorAll("[data-help]")].map((b) => b.dataset.help));
  check(["sex", "pensionAge", "p1", "kids", "hazard", "sp", "spStart", "pillars", "p2Rate", "p3Joined", "fundCur"].every((k) => keys.includes(k)), name + ": kõik 11 selgitust: " + keys.join(","));
  const btn = await page.evaluate(() => { const b = document.querySelector('[data-help="sex"]'); return { name: b.textContent.trim(), pop: b.getAttribute("aria-haspopup"), ctl: b.getAttribute("aria-controls"), inLabel: !!b.closest("label"), w: b.getBoundingClientRect().width }; });
  check(await page.evaluate(() => { const b = document.querySelector('[data-help="sex"]'); const r = b.querySelector(".ico-help").getBoundingClientRect(); return r.width === 16 && getComputedStyle(b.querySelector(".h-ring")).fill === "rgb(255, 255, 255)"; }), name + ": „?“ nagu tuleva.ee: 16 px, tavaolekus valge ring");
  check(btn.name === "Selgitus: Miks küsime sugu" && btn.pop === "dialog" && btn.ctl === "helpDialog" && !btn.inLabel && btn.w >= 44, name + ": nupu nimi ja atribuudid: " + JSON.stringify(btn));
  // Klaviatuur: Tab nupule, Enter avab.
  await page.focus('[data-help="sex"]'); await page.keyboard.press("Enter");
  const d = await page.evaluate(() => { const dl = document.getElementById("helpDialog"); return { open: dl.open, modal: dl.matches(":modal"), label: document.getElementById(dl.getAttribute("aria-labelledby")).textContent, focus: document.activeElement.id, x: dl.getBoundingClientRect().x, w: dl.getBoundingClientRect().width }; });
  check(d.open && d.modal && d.label === "Miks küsime sugu?" && d.focus === "helpTitle", name + ": dialoog avaneb modaalina, nimi = pealkiri, fookus pealkirjal");
  if (name === "töölaud") check(d.x + d.w >= 1279 && d.w < 600, "töölaud: külgpaneel paremal: " + JSON.stringify(d));
  else check(d.w <= 375, "mobiil: modaal mahub ekraanile");
  // Klaviatuurilõks: Tab ei vii dialoogist välja.
  let inside = true;
  for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); inside = inside && await page.evaluate(() => document.getElementById("helpDialog").contains(document.activeElement)); }
  check(inside, name + ": fookus jääb dialoogi (klaviatuurilõks)");
  // Ekraanilugeja lõks: taust on inertne (modaal).
  check(await page.evaluate(() => { const m = document.querySelector("main"); return document.getElementById("helpDialog").matches(":modal") && !m.contains(document.getElementById("helpDialog")); }), name + ": taust inertne (showModal)");
  // axe dialoogi sees.
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await axe.run("#helpDialog", { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((x) => x.id + ":" + x.nodes.length));
  check(v.length === 0, name + ": axe dialoogis: " + v.join(", "));
  // Esc sulgeb, fookus tagasi nupule.
  await page.keyboard.press("Escape");
  check(await page.evaluate(() => !document.getElementById("helpDialog").open && document.activeElement.dataset.help === "sex"), name + ": Esc sulgeb, fookus tagasi nupule");
  // Sulge-nupp ja grupi pealkirja nupp.
  await page.click('[data-help="pillars"]');
  check(await page.evaluate(() => document.getElementById("helpTitle").textContent === "Miks küsime sammaste ja töö kohta?"), name + ": grupi selgitus");
  await page.click("#helpClose");
  check(await page.evaluate(() => !document.getElementById("helpDialog").open), name + ": sulge-nupp");
  await ctx.close();
}
// Joondus: ühe rea lahtrid samal kõrgusel ka siis, kui silt on kaks rida ja kõrval on „?“.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await ctx.newPage(); await page.goto(url + "/elukaar/"); await page.waitForTimeout(400);
  const ys = await page.evaluate(() => ["p3Joined", "p3Monthly", "fundCur"].map((i) => Math.round(document.getElementById(i).getBoundingClientRect().top)));
  check(ys[0] === ys[1] && ys[1] === ys[2], "töölaud: lahtrid ühel joonel: " + ys.join(","));
  await ctx.close();
}
// Modaali lingid: väline ikoon ja „(avaneb uues aknas)“ igal lingil, eripensioni selgituses link SKA iseteenindusse.
{
  const ctx = await browser.newContext(); const page = await ctx.newPage(); await page.goto(url + "/elukaar/"); await page.waitForTimeout(400);
  const keys = await page.evaluate(() => [...document.querySelectorAll("[data-help]")].map((b) => b.dataset.help));
  let bad = [];
  for (const k of keys) {
    await page.evaluate((kk) => document.querySelector('[data-help="' + kk + '"]').click(), k);
    bad = bad.concat(await page.evaluate((kk) => [...document.querySelectorAll("#helpBody a")].filter((a) => !a.querySelector("svg") || !/avaneb uues aknas/.test(a.textContent)).map((a) => kk + ":" + a.textContent), k));
    await page.keyboard.press("Escape");
  }
  check(bad.length === 0, "kõigil modaali linkidel on väline ikoon: " + bad.join("; "));
  await page.evaluate(() => document.querySelector('[data-help="sp"]').click());
  check(await page.evaluate(() => [...document.querySelectorAll("#helpBody a")].some((a) => a.href.startsWith("https://iseteenindus.sotsiaalkindlustusamet.ee") && /SKA iseteeninduses/.test(a.textContent))), "eripension: link SKA iseteenindusse");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.querySelector('[data-help="p1"]').click());
  check(await page.evaluate(() => { const t = document.getElementById("helpBody").textContent; return /„Prognoosimine“/.test(t) && /„I sammas“/.test(t) && /„Vanaduspension“/.test(t) && /Ära võta/.test(t); }), "riiklik pension: juhis SKA prognoosist (I sammas, vanaduspension, mida mitte võtta)");
  await ctx.close();
}
// Sugu „Muu“ jõuab mootorisse.
{
  const ctx = await browser.newContext(); await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
  const page = await ctx.newPage(); await page.goto(url + "/elukaar/"); await page.waitForFunction(() => window.__elukaar);
  await page.selectOption("#sex", "X");
  check((await page.evaluate(() => window.__elukaar.readInput())).sex === "X", "sugu muu");
  check(await page.evaluate(() => !document.querySelector('section[data-step="0"] .faq')), "1. vaate KKK on eemaldatud (sisu selgitustes)");
  await ctx.close();
}
{
  const ctx = await browser.newContext(); await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
  const page = await ctx.newPage(); await page.goto(url + "/elukaar/"); await page.waitForFunction(() => window.__elukaar);
  const q = await page.evaluate(() => ["4", "5", "6"].map((n) => [...document.querySelectorAll('section[data-step="' + n + '"] .faq summary')].map((s) => s.textContent)));
  check(q.every((l) => l.includes("Millal valida fondipension?") && l.includes("Kas fondipensioni saab alustada juba 60-aastaselt?") && l.includes("Mida teada fondipensioni kohta?")), "KKK 55, 60 ja 65 a sammus: " + JSON.stringify(q));
  await ctx.close();
}
// Külgpaneel: üks kerimine (sisu), leht taustal ei keri.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 } }); await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
  const page = await ctx.newPage(); await page.goto(url + "/elukaar/"); await page.waitForFunction(() => window.__elukaar);
  await page.click('[data-help="kids"]');
  const sc = await page.evaluate(() => { const d = document.getElementById("helpDialog"), b = document.getElementById("helpBody"); return { page: getComputedStyle(document.documentElement).overflow, dlg: getComputedStyle(d).overflowY === "clip", body: b.scrollHeight > b.clientHeight && getComputedStyle(b).overflowY === "auto" }; });
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+Tab");
  check(await page.evaluate(() => document.getElementById("helpDialog").scrollTop === 0), "külgpaneel: Tab ei keri paneeli ennast (pealkiri jääb paigale)");
  check(sc.page === "hidden" && sc.dlg && sc.body, "külgpaneel: ainult sisu kerib, leht lukus: " + JSON.stringify(sc));
  await page.mouse.move(200, 300); await page.mouse.wheel(0, 900); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.body.style.position === "fixed"), "taust on paigale kinnitatud (ka iOS)");
  await page.keyboard.press("Escape");
  check(await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== "hidden" && document.body.style.position === ""), "sulgedes leht kerib jälle");
  await ctx.close();
}
// Tulemus: tuleviku hindade lüliti (aria-pressed), selgitus, tulemus ei muutu.
{
  const ctx = await browser.newContext(); await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
  await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
  const page = await ctx.newPage(); await page.goto(url + "/elukaar/"); await page.waitForFunction(() => window.__elukaar);
  await page.evaluate(() => { const n = document.querySelectorAll("main .chapter").length - 1; document.querySelector(`#path [data-goto="${n}"]`).click(); });
  const st = () => page.evaluate(() => { const c = Chart.getChart(document.getElementById("chart")); const k = c.data.datasets.find((d) => d.label === "Kulud").data.filter((v) => v != null); return { pressed: document.getElementById("nominalToggle").getAttribute("aria-pressed"), note: document.getElementById("moneyNote").textContent, firstNeed: k[0], lastNeed: k[k.length - 1], answer: document.getElementById("answer").textContent }; });
  const a0 = await st();
  check(a0.pressed === "false" && /tänastes eurodes/.test(a0.note) && Math.abs(a0.firstNeed - a0.lastNeed) < 1, "vaikimisi tänastes eurodes, kulud konstantsed");
  check(await page.evaluate(() => !!document.querySelector('#nominalRow [data-help="nominal"]')), "lüliti kõrval on „?“");
  await page.click("#nominalToggle");
  const a1 = await st();
  check(a1.pressed === "true" && /tuleviku eurodes/.test(a1.note) && a1.lastNeed > a1.firstNeed * 1.3, "tuleviku hindades: kulud kasvavad 2% aastas: " + JSON.stringify([a1.firstNeed, a1.lastNeed]));
  check(a1.answer === a0.answer, "vastus (kas raha jätkub) ei muutu");
  await page.click("#nominalToggle");
  check((await st()).pressed === "false", "lüliti tagasi");
  await ctx.close();
}
check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nSelgitused (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
