// Tulemuse allalaadimine (TLV-111): MD ja PDF sisaldavad ka suletud akordionite ja KKK sisu; ekraani olek taastub.
// Kasutus: node tests/elukaar-ui-eksport.mjs [URL]
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const DIR = dirname(fileURLToPath(import.meta.url));
const CHART = readFileSync(join(DIR, "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
const page = await ctx.newPage();
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__elukaar);
const r = await page.evaluate(async () => {
  const res = document.getElementById("dlMd").closest(".chapter");
  // 1. samm: kohustuslikud väljad on vaikimisi tühjad (nagu elukaar-ui-nimekiri.mjs).
  for (const [id, v] of Object.entries({ p1Monthly: 900, grossMonthly: 2200, p2: 25000, p3: 5000, p3Monthly: 0 })) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
  for (let i = 0; i < 15 && res.hidden; i++) { document.getElementById("nextBtn").click(); await new Promise((ok) => setTimeout(ok, 100)); }
  res.querySelectorAll("details").forEach((d) => { d.open = false; });
  let blob = null; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { blob = b; return orig(b); };
  document.getElementById("dlMd").click();
  const md = await blob.text();
  let print = null;
  window.print = () => { print = { faq: document.querySelectorAll("#printFaq h4").length, open: [...res.querySelectorAll("details")].every((d) => d.open), shown: getComputedStyle(res).display }; };
  document.getElementById("dlPdf").click();
  window.dispatchEvent(new Event("afterprint"));
  return {
    onResult: !res.hidden, md, print,
    explain: document.getElementById("chartExplain").textContent.trim().slice(0, 40),
    closed: [...res.querySelectorAll("details")].every((d) => !d.open), pfGone: !document.getElementById("printFaq"),
  };
});
check(r.onResult, "jõudis tulemuse sammu");
check(r.explain && r.md.includes("### Kuidas graafikut lugeda") && r.md.includes(r.explain), "MD sisaldab suletud graafiku selgitust");
check(/## Väljamakse teed kõrvuti\n\n\|.+\|\n\| ---/.test(r.md), "MD sisaldab suletud võrdlustabelit");
check(r.md.includes("## Korduma kippuvad küsimused") && r.md.includes("### Mis on fondipension?"), "MD sisaldab läbitud sammude KKK-d");
check(r.closed, "pärast MD allalaadimist on akordionid jälle kinni");
check(r.print && r.print.open && r.print.faq > 0, "PDF: akordionid lahti ja KKK lisatud: " + JSON.stringify(r.print));
check(r.pfGone && r.closed, "pärast printimist KKK eemaldatud ja olek taastatud");
check(!errs.length, "lehe vigu pole: " + errs.join("; "));
await browser.close();
console.log((failed ? "✗" : "✓") + " elukaar-ui-eksport: " + passed + " ok, " + failed + " viga");
process.exit(failed ? 1 : 0);
