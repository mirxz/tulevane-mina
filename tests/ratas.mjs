// Õnneratta maandumisleht: keerutus, seitse küsimust, edenemisriba, tänuleht, e-post, ligipääsetavus (mobiil).
// Kasutus: node tests/ratas.mjs <URL>   (vaikimisi http://127.0.0.1:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const url = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function a11y(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}
console.log("\nÕnneratas /ratas/ (mobiil 375 px)");
const page = await browser.newPage({ viewport: { width: 375, height: 700 }, reducedMotion: "reduce" });
const errors = [], posts = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => { if (r.url().endsWith("/api/r")) posts.push(JSON.parse(r.postData() || "{}")); });
page.on("response", (r) => { if (new URL(r.url()).origin === url && r.status() >= 400) errors.push(r.status() + " " + r.url()); });
const resp = await page.goto(url + "/ratas/?k=test");
check(resp.status() === 200, "leht avaneb");
check((await page.getAttribute('meta[property="og:image"]', "content")).endsWith("/ratas/og.png"), "FB pilt (og:image) on seatud");
check((await fetch(url + "/ratas/og.png")).headers.get("content-type") === "image/png", "og.png on kättesaadav");
await page.waitForSelector("#spin");
check((await page.textContent("h1")).includes("Mis elu sa võidad"), "avaleht: pealkiri");
check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "avalehel pole külgsuunalist kerimist");
await a11y(page, "avaleht");
await page.click("#spin");
await page.waitForSelector("#alusta");
check(posts.some((p) => p.ev === "spin" && p.alk === "test" && new Set(p.jarjekord.split(",")).size === 7), "keerutus salvestas 7 sektori järjekorra ja allika");
await page.click("#alusta");
const order = posts.find((p) => p.ev === "spin").jarjekord.split(",").map(Number);
const names = ["Vajadus", "Riiklik pension", "Sambad", "Kõrvalraha", "Eluiga", "Auto ja kodu", "Ära koonerda"];
for (let i = 0; i < 7; i++) {
  await page.waitForSelector("#edasi");
  check((await page.textContent(".proglab")).includes(`${i + 1} / 7`) && (await page.getAttribute("[role=progressbar]", "aria-valuenow")) === String(i + 1), `küsimus ${i + 1}/7: edenemisriba`);
  if (i === 0) {
    check((await page.textContent(".chipS")) === names[order[0]], "esimene küsimus on ratta valitud sektor");
    check(await page.isDisabled("#edasi"), "Edasi on keelatud, kuni valik puudub");
    await a11y(page, "küsimus");
  }
  check((await page.textContent(".chipS")) === names[order[i]], `küsimus ${i + 1}: sektor ${names[order[i]]}`);
  await page.check(`input[value=${["tean", "umbes", "eitea"][i % 3]}]`);
  if (i === 2) await page.fill("#tekst", "Ei tea kust vaadata, helista 5551234567");
  if (i === 3) { await page.click("#edasi"); await page.click("#tagasi"); check(await page.isChecked(`input[value=${["tean", "umbes", "eitea"][3 % 3]}]`), "Tagasi säilitab vastuse"); }
  await page.click("#edasi");
}
await page.waitForSelector("#meil");
check((await page.textContent("h1")).includes("Aitäh"), "tänuleht");
check((await page.textContent(".thanks")).includes("sisendi- ja resoneerimistest"), "tänuleht selgitab, et see on sisend-/resoneerimistest");
check(posts.filter((p) => p.ev === "answer").length >= 8 && posts.some((p) => p.ev === "done"), "vastused ja lõpp salvestati");
check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "tänulehel pole külgsuunalist kerimist");
await a11y(page, "tänuleht");
await page.fill("#email", "viga"); await page.click("#meil button[type=submit]");
check(await page.isVisible("#viga"), "vigane e-post annab veateate");
await page.fill("#email", "test@example.com"); await page.click("#meil button[type=submit]");
check(await page.isVisible("#viga"), "nõusolek on kohustuslik");
await page.check("#nous"); await page.click("#meil button[type=submit]");
await page.waitForSelector(".ok");
const em = posts.find((p) => p.ev === "email");
check(em && em.email === "test@example.com" && !("sid" in em && em.sid), "e-post läks ilma seansi tunnuseta");
check(errors.length === 0, "konsoolis ega võrgus vigu" + (errors.length ? " → " + errors.join(" | ") : ""));
// API kaitse
const bad = await fetch(url + "/api/r", { method: "POST", body: JSON.stringify({ sid: "abcdefgh12", ev: "spin", jarjekord: "0,0,1,2,3,4,5" }) });
check(bad.status === 400, "API lükkab vigase järjekorra tagasi");
console.log(failed ? `\n${failed} kontrolli kukkus läbi.` : "\nKõik korras.");
await browser.close(); process.exit(failed ? 1 : 0);
