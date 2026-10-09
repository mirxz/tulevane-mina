// Plaani prototüübi test: kolm vaadet (kalkulaator, elukaar, ostukorv), tagasiside, ligipääsetavus, mudeli kontrollid.
// Kasutus: node tests/plaan.mjs <URL>   (vaikimisi http://127.0.0.1:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { plaan, lubatav } from "../public/plaan/mudel.js";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const url = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };

console.log("\nMudel");
const b0 = { sunniaasta: 1968, sugu: "M", pension: 800, sammas: 40000, sast: 20000, sissemakse: 150, fond: "indeks", vajadus: 1200, k: 0, viis: "fondipension" };
const p0 = plaan(b0);
check(p0.R === 66, "pensioniiga 1968 → 66");
check(Math.round(p0.riikKuu) === 800, "riiklik pension õigel ajal 800 €");
check(plaan({ ...b0, k: 3 }).riikKuu > 940, "3 a hiljem: +18,35%");
check(plaan({ ...b0, sugu: "N" }).turv > p0.turv, "naiste „elu lõpuni“ vanus on kõrgem");
check(lubatav(b0) > lubatav({ ...b0, fond: "kallis" }), "kallis fond vähendab lubatavat kulu");
check(plaan({ ...b0, vajadus: lubatav(b0) }).katab && !plaan({ ...b0, vajadus: lubatav(b0) + 200 }).katab, "lubatav kulu on katmise piir");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function a11y(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}
for (const vaade of ["kalk", "kaar", "korv"]) {
  console.log("\n" + vaade);
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (r.url().endsWith("/api/p")) posts.push(JSON.parse(r.postData() || "{}")); });
  page.on("response", (r) => { if (new URL(r.url()).origin === url && r.status() >= 400) errors.push(r.status() + " " + r.url()); });
  await page.goto(url + "/?vaade=" + vaade);
  await page.waitForSelector("[data-act=alusta]");
  check((await page.textContent("h1")).includes("elu lõpuni"), "avaleht: JTBD küsimus");
  await a11y(page, "avaleht");
  await page.fill("[data-in=sunniaasta]", "1970"); await page.press("[data-in=sunniaasta]", "Tab"); await page.waitForTimeout(100);
  check((await page.textContent("main")).includes("ligikaudu 66"), "pensioniiga uueneb sünniaastaga");
  await page.click("[data-act=enne][data-v='2']");
  await page.click("[data-act=alusta]");
  await page.waitForSelector("[data-act=valmis]");
  check(await page.isVisible(".verdict"), "vaade näitab, kas plaan katab");
  if (vaade === "kalk") {
    await page.fill("[data-in=vajadus]", "3000"); await page.press("[data-in=vajadus]", "Tab"); await page.waitForTimeout(450);
    check((await page.textContent(".verdict")).includes("puudu"), "suur vajadus → puudu");
    await page.fill("[data-in=vajadus]", "600"); await page.press("[data-in=vajadus]", "Tab"); await page.waitForTimeout(450);
    check((await page.textContent("main")).includes("Ära koonerda"), "väike vajadus → ära koonerda");
  }
  if (vaade === "kaar") {
    check(await page.isVisible(".chart-wrap svg"), "elukaare graafik");
    check((await page.textContent(".chart-wrap")).includes("Pension ja sambad"), "otsustuspunktid graafikul");
    await page.selectOption("[data-in=k]", "3"); await page.waitForTimeout(100);
    check((await page.textContent(".chart-wrap")).includes("Riiklik pension 69"), "edasilükkamine liigutab otsustuspunkti");
  }
  if (vaade === "korv") {
    const before = await page.textContent("#h-m");
    await page.click("[data-act=korv][data-v=auto]");
    check((await page.textContent("#h-m")) !== before, "korvi lisamine muudab summat");
    for (const id of ["maakodu", "kultuur", "toit", "abi", "anne"]) await page.click(`[data-act=korv][data-v=${id}]`);
    check((await page.textContent(".verdict")).includes("puudu"), "täis korv ei mahu");
    await page.click("[data-act=viis][data-v=korraga]");
    check(await page.isVisible(".meter"), "otsuste muutmine korvi vaates");
  }
  await a11y(page, vaade);
  await page.click("[data-act=valmis]");
  await page.click("[data-act=saada]");
  check(await page.isVisible("[role=alert]"), "tühja vastust ei saadeta");
  await page.click("[data-act=katab][data-v=jah]"); await page.click("[data-act=kindlus][data-v='4']"); await page.click("[data-act=hirm][data-v=elamata]");
  await page.fill("[data-in=kommentaar]", "Testi kommentaar");
  await a11y(page, vaade + " tagasiside");
  await page.click("[data-act=saada]");
  await page.waitForSelector("text=Aitäh");
  await page.waitForTimeout(300);
  const fb = posts.find((p) => p.ev === "feedback");
  check(fb && fb.vaade === vaade && fb.vastus.kindlus === 4 && fb.vastus.enne === 2 && !("sunniaasta" in fb) && !JSON.stringify(fb).includes("40000"), "tagasiside saadetud, summasid ei saadeta");
  await page.click("[data-act=vaata] >> nth=0");
  check(await page.isVisible("[data-act=valmis]"), "saab vaadata teist vaadet");
  check(errors.length === 0, "vigu pole" + (errors.length ? ": " + errors.join(" | ") : ""));
  await page.close();
}
// allikas (?k=) ja jagamisnupp
{
  console.log("\nallikas ja jagamine");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const posts = [];
  page.on("request", (r) => { if (r.url().endsWith("/api/p")) posts.push(JSON.parse(r.postData() || "{}")); });
  await page.goto(url + "/?vaade=kalk&k=FB!");
  await page.waitForSelector("[data-act=alusta]");
  await page.click("[data-act=alusta]"); await page.waitForSelector("[data-act=valmis]"); await page.click("[data-act=valmis]");
  await page.click("[data-act=katab][data-v=jah]"); await page.click("[data-act=kindlus][data-v='3']"); await page.click("[data-act=hirm][data-v=molemad]");
  await page.click("[data-act=saada]"); await page.waitForSelector("[data-act=jaga]");
  await a11y(page, "aitäh + jagamine");
  await page.click("[data-act=jaga]"); await page.waitForTimeout(400);
  check(posts.length >= 2 && posts.every((p) => p.alk === "fb"), "allikas „fb“ (puhastatud) läheb kaasa igale sündmusele");
  check(posts.some((p) => p.ev === "share"), "jagamine registreeritakse");
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check(clip.includes("/?k=jagatud") && !/\d{4,}/.test(clip.replace(/https?:\/\/\S+/, "")), "jagatav link kannab märget ja ei sisalda isikuandmeid");
  await ctx.close();
}
// arhiiv ja lauamäng jäävad alles, aga avalehelt neile linki pole
{
  const page = await browser.newPage();
  await page.goto(url + "/");
  const html = await page.content();
  check(!html.includes("/arhiiv/") && !html.includes("/mang"), "avalehel pole viiteid vanadele mängudele");
  const r1 = await page.goto(url + "/arhiiv/kasiino.html"); check(r1.status() === 200 && (await page.content()).includes("Millal pensionile minna"), "arhiiv: kasiino alles");
  const r2 = await page.goto(url + "/arhiiv/lauamang/"); check(r2.status() === 200 && (await page.content()).includes("app.js"), "arhiiv: lauamäng alles");
  const r3 = await page.goto(url + "/mang?tuba=ABCDE"); check(r3.status() === 410 && page.url().includes("/mang") && (await page.content()).includes("Seda prototüüpi enam pole"), "vana /mang annab veateate, mitte ei suuna");
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
