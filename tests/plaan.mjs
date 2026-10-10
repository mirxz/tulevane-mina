// Plaani prototüübi test: kolm vaadet (kalkulaator, elukaar, ostukorv), tagasiside, ligipääsetavus, mudeli kontrollid.
// Kasutus: node tests/plaan.mjs <URL>   (vaikimisi http://127.0.0.1:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { plaan, lubatav, elusTn, EELDUSED } from "../public/arhiiv/plaan/mudel.js";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const url = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };

console.log("\nMudel");
const b0 = { sunniaasta: 1968, sugu: "M", pension: 800, sammas: 40000, sast: 20000, sissemakse: 150, fond: "indeks", vajadus: 1200, k: 0, viis: "fondipension" };
const p0 = plaan(b0);
check(p0.R === 66, "pensioniiga 1968 → 66");
check(Math.round(p0.riikKuu) === 800, "riiklik pension õigel ajal 800 €");
check(Math.round(plaan({ ...b0, k: 3 }).riikKuu) === 1016, "3 a hiljem: +27,01% (SKA 2026)");
check(Math.round(plaan({ ...b0, k: -1, W: 65 }).riikKuu) === 743, "1 a varem: −7,17% (SKA 2026)");
check(EELDUSED.e65.M === 16.33 && EELDUSED.e65.N === 21.43, "elada jäänud aastad 65-aastaselt: Statistikaamet 2025");
check(Math.abs(elusTn("M", 65, 81) - 0.51) < 0.01, "65-aastasest mehest elab 81-aastaseks ~51% (Statistikaamet RV046)");
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
// üks plaan, kolm vahekaarti
for (const vaade of ["kalk", "kaar", "korv"]) {
  console.log("\nalgus vahekaardiga " + vaade);
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (r.url().endsWith("/api/p")) posts.push(JSON.parse(r.postData() || "{}")); });
  page.on("response", (r) => { if (new URL(r.url()).origin === url && r.status() >= 400) errors.push(r.status() + " " + r.url()); });
  await page.goto(url + "/arhiiv/plaan/?vaade=" + vaade);
  await page.waitForSelector("[data-act=alusta]");
  check((await page.textContent("h1")).includes("elu lõpuni"), "avaleht: JTBD küsimus");
  check(await page.locator("[data-in=vajadus]").count() === 1 && await page.locator("[data-in=sammas]").isHidden(), "avalehel vähe välju, sambad on kokku volditud");
  await a11y(page, "avaleht");
  await page.fill("[data-in=sunniaasta]", "1970"); await page.press("[data-in=sunniaasta]", "Tab"); await page.waitForTimeout(100);
  check((await page.textContent("main")).includes("66-aastaselt"), "pensioniiga uueneb sünniaastaga");
  await page.click("[data-act=enne][data-v='2']");
  await page.click("[data-act=alusta]");
  await page.waitForSelector("[role=tablist]");
  check(await page.isVisible(".vd"), "ülal on alati tulemus: katab või ei");
  check((await page.getAttribute("#tab-" + vaade, "aria-selected")) === "true", "avaneb õige vahekaart");
  check(await page.locator("[role=tab]").count() === 3, "kolm vahekaarti ühes kohas");
  await a11y(page, "plaan, " + vaade);
  // vajadus muutub → tulemus muutub
  await page.fill("[data-in=vajadus]", "3000"); await page.press("[data-in=vajadus]", "Tab"); await page.waitForTimeout(450);
  check((await page.textContent(".vd")).includes("puudu"), "suur vajadus → puudu");
  await page.fill("[data-in=vajadus]", "600"); await page.press("[data-in=vajadus]", "Tab"); await page.waitForTimeout(450);
  check((await page.textContent(".vd")).includes("Ära koonerda"), "väike vajadus → ära koonerda");
  // pensioni edasilükkamine
  await page.click("[data-act=kmuuda][data-v='1']"); await page.click("[data-act=kmuuda][data-v='1']"); await page.click("[data-act=kmuuda][data-v='1']");
  check((await page.textContent(".step")).includes("69-aastaselt") && (await page.textContent(".step")).includes("+27%"), "pensioni edasilükkamine: 69 a, +27%");
  await page.click("[data-act=kmuuda][data-v='-1']"); await page.click("[data-act=kmuuda][data-v='-1']"); await page.click("[data-act=kmuuda][data-v='-1']");
  // vahekaartide vahel liikumine
  await page.click("#tab-kaar");
  check(await page.isVisible(".story .chart-wrap svg") && (await page.textContent(".cap-k")).includes("1 / 7"), "elukaar algab loona, samm 1/7");
  await a11y(page, "elukaare lugu");
  await page.click("[data-act=lnext]"); await page.click("[data-act=lnext]");
  check((await page.textContent(".cap-h")).includes("kaua sa elad") && (await page.locator(".lay.on").count()) === 3, "lugu lisab ühe elemendi korraga (3 kihti pärast 3. sammu)");
  for (let i = 0; i < 4; i++) await page.click("[data-act=lnext]");
  check((await page.textContent("[data-act=lnext]")).includes("Uuri ise") && (await page.textContent(".cap-h")).length > 5, "viimane samm annab tulemuse ja nupp viib uurimisvaatesse");
  await page.click("[data-act=lnext]");
  check(await page.isVisible(".chart-wrap svg") && (await page.textContent("#panel")).includes("Otsustuspunktid") && !(await page.isVisible(".story")), "elukaar: pärast lugu graafik ja otsustuspunktid");
  await page.click("[data-act=lugu0]"); check(await page.isVisible(".story"), "lugu saab uuesti vaadata"); await page.click("[data-act=lskip]");
  await page.click("[data-act=kmuuda][data-v='1']"); await page.waitForTimeout(50);
  check((await page.textContent("#panel")).includes("67"), "edasilükkamine liigutab otsustuspunkti");
  await page.click("[data-act=kmuuda][data-v='-1']");
  await a11y(page, "elukaar");
  await page.click("#tab-korv");
  const enne = await page.textContent(".bk"), toit0 = await page.textContent(".gk-t b");
  await page.click("[data-act=toit][data-id=piim][data-v='2']");
  check((await page.textContent(".gk-t b")) !== toit0 && (await page.textContent(".bk")) !== enne, "toidukorv: piim → öko pakipiim muudab summat ja tulemust");
  check((await page.locator("[data-act=toit][data-id=piim][data-v='2']").getAttribute("aria-pressed")) === "true", "valitud tase on märgitud");
  await page.click("[data-act=parim]");
  check((await page.textContent(".bk")).includes("Mahub"), "„Täida parim, mis mahub“ annab korvi, mis mahub");
  await page.click("[data-act=nulli]");
  check((await page.textContent(".gk-s")).includes("tavalisel"), "nulli viib kõik tavalisele tasemele");
  for (const id of ["vorst", "liha", "kala", "aed", "juust", "kohv", "magus", "leib", "piim"]) await page.click(`[data-act=toit][data-id=${id}][data-v='2']`);
  await page.click("summary:has-text('Veel: reis')");
  for (const id of ["reis", "lapsed", "maakodu", "kultuur", "auto", "toit", "abi", "anne"]) await page.click(`[data-act=korv][data-v=${id}]`);
  check((await page.textContent(".vd")).includes("puudu") && (await page.textContent(".bk")).includes("Ei mahu"), "täis korv ei mahu ja tulemus muutub ülal");
  await a11y(page, "ostukorv");
  await page.keyboard.press("Tab"); // fookus liigub
  await page.focus("#tab-korv"); await page.keyboard.press("ArrowLeft");
  check((await page.getAttribute("#tab-kaar", "aria-selected")) === "true", "vahekaarte saab nooleklahvidega vahetada");
  await page.click("#tab-kalk");
  check((await page.textContent("#panel")).includes("Turvaliselt saad kulutada"), "arvud: turvaline kulutus");
  // tagasiside samal lehel
  await page.click("[data-act=saada]");
  check(await page.isVisible("[role=alert]"), "tühja vastust ei saadeta");
  await page.click("[data-act=katab][data-v=jah]"); await page.click("[data-act=kindlus][data-v='4']"); await page.click("[data-act=hirm][data-v=elamata]");
  await page.fill("[data-in=kommentaar]", "Testi kommentaar");
  await a11y(page, "tagasiside");
  await page.click("[data-act=saada]");
  await page.waitForSelector("#h-ai");
  await page.waitForTimeout(300);
  const fb = posts.find((p) => p.ev === "feedback");
  check(fb && fb.vastus.kindlus === 4 && fb.vastus.enne === 2 && fb.vastus.nahtud.split(",").length === 3 && !("sunniaasta" in fb) && !JSON.stringify(fb).includes("40000"), "tagasiside saadetud, summasid ei saadeta, nähtud vaated kaasas");
  check(posts.filter((p) => p.ev === "start").length >= 4, "vahekaardi vahetus registreeritakse");
  check(await page.isVisible("[data-act=jaga]"), "aitäh ja jagamisnupp samal lehel");
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
  await page.goto(url + "/arhiiv/plaan/?vaade=kalk&k=FB!");
  await page.waitForSelector("[data-act=alusta]");
  await page.click("[data-act=alusta]"); await page.waitForSelector("[role=tablist]");
  await page.click("[data-act=katab][data-v=jah]"); await page.click("[data-act=kindlus][data-v='3']"); await page.click("[data-act=hirm][data-v=molemad]");
  await page.click("[data-act=saada]"); await page.waitForSelector("[data-act=jaga]");
  await a11y(page, "aitäh + jagamine");
  await page.click("[data-act=jaga]"); await page.waitForTimeout(400);
  check(posts.length >= 2 && posts.every((p) => p.alk === "fb"), "allikas „fb“ (puhastatud) läheb kaasa igale sündmusele");
  check(posts.some((p) => p.ev === "share"), "jagamine registreeritakse");
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check(clip.includes("/arhiiv/plaan/?k=jagatud") && !/\d{4,}/.test(clip.replace(/https?:\/\/\S+/, "")), "jagatav link kannab märget ja ei sisalda isikuandmeid");
  await ctx.close();
}
// arhiiv ja lauamäng jäävad alles, aga avalehelt neile linki pole
{
  const page = await browser.newPage();
  const r0 = await page.goto(url + "/");
  const html = await page.content();
  check(r0.status() === 200 && html.includes("Kuhu sa sattusid") && !html.includes("/mang"), "avaleht on maandumisleht ja ei viita lauamängule");
  const re = await page.goto(url + "/elukaar/"); check(re.status() === 200 && (await page.content()).includes("Kes sa oled ja mis sul juba on"), "/elukaar/ on Kadi leht");
  const ra = await page.goto(url + "/arhiiv/"); check(ra.status() === 200 && (await page.content()).includes("Arhiiv"), "arhiivi sisukord avaneb");
  const rp = await page.goto(url + "/arhiiv/plaan/"); check(rp.status() === 200 && (await page.content()).includes("plaan.css"), "arhiiv: plaan alles");
  const rd = await fetch(url + "/ratas/?k=a5", { redirect: "manual" });
  check(rd.status === 302 && new URL(rd.headers.get("location")).pathname === "/arhiiv/ratas/" && rd.headers.get("location").endsWith("?k=a5"), "vana /ratas/?k=a5 (QR) suunab arhiivi, päring säilib");
  for (const [vana, uus] of [["/kalkulaator/", "/arhiiv/kalkulaator/"], ["/plaan/", "/arhiiv/plaan/"]]) {
    const r = await fetch(url + vana, { redirect: "manual" });
    check(r.status === 302 && new URL(r.headers.get("location")).pathname === uus, "vana " + vana + " suunab → " + uus);
  }
  const r1 = await page.goto(url + "/arhiiv/kasiino.html"); check(r1.status() === 200 && (await page.content()).includes("Millal pensionile minna"), "arhiiv: kasiino alles");
  const r2 = await page.goto(url + "/arhiiv/lauamang/"); check(r2.status() === 200 && (await page.content()).includes("app.js"), "arhiiv: lauamäng alles");
  const r3 = await page.goto(url + "/mang?tuba=ABCDE"); check(r3.status() === 410 && page.url().includes("/mang") && (await page.content()).includes("Seda prototüüpi enam pole"), "vana /mang annab veateate, mitte ei suuna");
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
