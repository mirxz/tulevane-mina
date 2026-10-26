// Pensioniiga seaduse valemi järgi (RPKS § 7, TLV-85): sünniaasta järgi nagu SKA, käsitsi valik jääb alles, .
// Kasutus: node tests/elukaar-ui-pensioniiga.mjs [URL]
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

const set = (id, val, ev = "input") => page.evaluate(([id, val, ev]) => { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event(ev, { bubbles: true })); }, [id, val, ev]);
const state = () => page.evaluate(() => ({ pa: window.__elukaar.readInput().pensionAgeYears, sel: document.getElementById("pensionAgeYears").value }));

check(await page.evaluate(() => !document.getElementById("paYear")), "SKA aasta välja enam pole");
check(await page.evaluate(() => /Sotsiaalkindlustusameti kalkulaatorist/.test(document.getElementById("p1Ska").textContent) && !!document.querySelector("#p1Ska a[href*='pension-calculator']")), "riikliku pensioni plokis üks SKA viide");

await set("birthYear", 1990);
let s = await state();
check(s.pa === 66 && s.sel === "66", "sünd 1990 → 66 a (2056) nagu SKA: " + JSON.stringify(s));
check(await page.evaluate(() => !document.getElementById("paHint")), "pensioniea väljal vihjet pole (selgitus on „?“ all)");

await set("birthYear", 1960);
s = await state();
check(s.pa === 65, "sünd 1960 → 65 a: " + JSON.stringify(s));

await set("pensionAgeYears", 68, "change");
await set("birthYear", 1990);
s = await state();
check(s.pa === 68, "käsitsi valik jääb alles, kui sünniaasta muutub: " + JSON.stringify(s));

// „?“ selgitus ütleb, kust aasta leida.
await page.click('button[data-help="pensionAge"]');
const help = await page.evaluate(() => document.getElementById("helpDialog").textContent);
check(/Pensionile jäämise aeg/.test(help) && /Täpset pensioniiga pärast 2029/.test(help) && /RPKS/.test(help) && /väljal „Pensioniiga“/.test(help), "selgitus: seadus, ebakindlus ja SKA kalkulaator");

check(errs.length === 0, "lehel pole JS vigu: " + errs.join("; "));
await browser.close();
console.log(`Pensioniiga (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
