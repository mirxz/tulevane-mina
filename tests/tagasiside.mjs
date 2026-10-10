// Tagasiside leht (/tagasiside/): neli mõõdet + vaba kommentaar, anonüümne /api/t. Kasutus: node tests/tagasiside.mjs <URL>   (vaikimisi http://127.0.0.1:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const url = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };
async function a11y(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}
for (const vp of [{ name: "telefon", width: 375, height: 812 }, { name: "arvuti", width: 1280, height: 800 }]) {
  console.log(`\nTagasiside, ${vp.name}`);
  const page = await browser.newPage({ viewport: vp, reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (r.url().endsWith("/api/t")) posts.push(JSON.parse(r.postData() || "{}")); });
  await page.goto(url + "/tagasiside/?p=mitte-single&k=fb", { waitUntil: "domcontentloaded" });
  check((await page.textContent("h1")).includes("paremaks") && (await page.locator("form fieldset").count()) === 4, "pealkiri ja neli küsimuste plokki");
  check(await page.isVisible("#kommentaar") && (await page.locator("#kommentaar").evaluate((e) => e.getBoundingClientRect().height)) > 100, "vaba kommentaar on suur ja nähtav");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "ei kerita külgsuunas");
  await a11y(page, "vorm");
  await page.click("#saada");
  check(await page.isVisible("#err") && (await page.locator("#err li").count()) === 4 && posts.length === 0, "tühja vormi ei saadeta, veateade nimetab 4 puuduvat küsimust");
  await a11y(page, "veateade");
  check(!(await page.isVisible("#m-vanus")) && !(await page.isVisible("#m-uus")), "täpsustused on algul peidus");
  await page.check('input[name="taitmine"][value="osaliselt"]'); check(await page.isVisible("#m-taitmine"), "osaline täitmine avab 'mis segas'");
  await page.fill("#taitmine_tekst", "Ei saanud III samba väljast aru");
  await page.check('input[name="vanus_vastus"][value="umbes"]'); check(await page.isVisible("#m-vanus"), "'umbes' avab vanuse välja");
  await page.fill("#vanus", "85");
  await page.check('input[name="uus"][value="jah"]'); await page.fill("#uus_tekst", "Riiklik pension kasvab edasilükkamisel");
  await page.check('input[name="muudaks"][value="votiolla"]'); await page.fill("#muudaks_tekst", "Vaataks pensioniiga");
  await page.fill("#kommentaar", "Väga huvitav! Minu e-post test@example.com");
  await page.click("#saada");
  await page.waitForSelector("#aitah:not([hidden])");
  check(posts.length === 1 && posts[0].algpunkt === "mitte-single" && posts[0].alk === "fb" && posts[0].vastus.taitmine === "osaliselt" && posts[0].vastus.vanus === "85" && posts[0].vastus.uus === "jah" && posts[0].vastus.muudaks === "votiolla", "saadeti üks anonüümne vastus õigete väljadega");
  check(!JSON.stringify(posts[0]).includes("birthYear") && (await page.isHidden("#vorm")), "sisestatud numbreid ei saadeta, vorm asendus tänuga");
  await a11y(page, "tänuleht");
  check(errors.length === 0, "lehel pole JS-vigu" + (errors.length ? ": " + errors[0] : ""));
  await page.close();
}
console.log("\nLink elukaarest");
{
  const page = await browser.newPage();
  await page.goto(url + "/elukaar/?p=valja&k=fb", { waitUntil: "domcontentloaded" });
  check((await page.getAttribute("#tagasisideLink", "href")) === "/tagasiside/?p=valja&k=fb", "elukaare lõpus on tagasiside link, mis kannab algpunkti ja kanalit");
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  check((await page.getAttribute("#tagasisideLink", "href")) === "/tagasiside/", "ilma algpunktita viib link lihtsalt tagasiside lehele");
  await page.close();
}
console.log("\nAlgpunkti jälgimine (maandumisleht → elukaar → tagasiside)");
{
  const page = await browser.newPage();
  const posts = []; page.on("request", (r) => { if (r.url().endsWith("/api/t")) posts.push(JSON.parse(r.postData() || "{}")); });
  await page.goto(url + "/");
  await page.click('#level1 a.profile >> nth=1'); await page.waitForURL("**/elukaar/?p=liige-steady");
  await page.fill("#p2", "31000");
  for (let i = 0; i < 12 && !(await page.isVisible("#tagasisideLink")); i++) await page.$eval("#nextBtn", (e) => e.click()); // Bootstrapi CDN-i pole testkeskkonnas, paigutus võib katta nuppu, seepärast klõps DOM-ist
  check(await page.isVisible("#tagasisideLink"), "tulemuse peatükis on tagasiside link nähtav");
  await page.$eval("#tagasisideLink", (e) => e.click()); await page.waitForURL("**/tagasiside/?p=liige-steady");
  for (const [n, v] of [["taitmine", "jah"], ["vanus_vastus", "ei"], ["uus", "ei"], ["muudaks", "ei"]]) await page.check(`input[name="${n}"][value="${v}"]`);
  await page.click("#saada"); await page.waitForSelector("#aitah:not([hidden])");
  const b = posts[0] || {};
  check(b.algpunkt0 === "liige-steady" && b.algpunkt === "liige-steady" && b.vahetusi === 0 && b.muutis === true, "salvestub esimene valik (liige-steady), viimane (sama), 0 vahetust ja märge andmete muutmisest");
  check(!JSON.stringify(b).includes("31000"), "muudetud väärtust ei saadeta");
  await page.close();
}
console.log("\nServer (/api/t)");
const post = (b) => fetch(url + "/api/t", { method: "POST", body: JSON.stringify(b) });
const ok = { sid: "testsid-12345678", alk: "test", algpunkt: "tuhi", vastus: { taitmine: "jah", vanus_vastus: "ei", uus: "ei", muudaks: "ei", kommentaar: "ok" } };
check((await post(ok)).status === 200, "kehtiv vastus salvestub");
check((await post(ok)).status === 200, "sama seanss uuesti asendab, ei jookse kokku");
check((await post({ ...ok, vastus: { ...ok.vastus, taitmine: "x" } })).status === 400, "tundmatu väärtus lükatakse tagasi");
check((await post({ ...ok, vastus: { ...ok.vastus, vanus_vastus: "jah", vanus: "5" } })).status === 400, "võimatu vanus lükatakse tagasi");
check((await post({ ...ok, sid: "x" })).status === 400, "vigane seansi tunnus lükatakse tagasi");
check((await post({ ...ok, algpunkt: "<script>" })).status === 400, "tundmatu algpunkt lükatakse tagasi");
check((await fetch(url + "/api/t")).status === 405, "GET pole lubatud");
console.log("\nCSV-d ja tulemuste leht");
const CSVD = ["tulemused-tagasiside.csv", "tulemused-ratas.csv", "tulemused-plaan.csv", "tulemused-meilid.csv", "tulemused.csv"];
for (const f of CSVD) { const s = (await fetch(url + "/" + f)).status; check(s === 401 || s === 503, f + " ei ole ilma paroolita avatud (" + s + ")"); }
const parool = process.env.TULEMUSED_PAROOL; // valikuline: kohalikus .dev.vars TULEMUSED_VOTI väärtus
if (parool) {
  const auth = { authorization: "Basic " + Buffer.from("x:" + parool).toString("base64") };
  for (const f of ["tulemused-tagasiside.csv", "tulemused-ratas.csv", "tulemused-plaan.csv", "tulemused-meilid.csv"]) {
    const r = await fetch(url + "/" + f, { headers: auth }); const t = await r.text();
    check(r.status === 200 && (r.headers.get("content-type") || "").includes("text/csv") && t.split("\n")[0].replace("\ufeff", "").split(",").length >= 3, f + ": laeb CSV päisega");
  }
  const r = await fetch(url + "/tulemused-tagasiside.csv", { headers: auth }); const t = await r.text();
  check(t.split("\n").filter(Boolean).length >= 2 && t.includes("testsid") === false && t.includes('"fb"'), "tagasiside CSV-s on päis ja vähemalt üks vastus");
  const lk = await (await fetch(url + "/tulemused", { headers: auth })).text();
  check(lk.includes("Tagasiside (/tagasiside/)") && lk.includes("/tulemused-ratas.csv") && lk.includes("/tulemused-plaan.csv"), "tulemuste lehel on tagasiside osa ja CSV lingid");
}
await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
