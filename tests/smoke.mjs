// Suitsutest: käib mängu 5 sammu läbi telefonis ja arvutis ning kontrollib põhiarvu.
// Kasutus: node tests/smoke.mjs <URL>   (vaikimisi http://localhost:8787)
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:8787";
const viewports = [
  { name: "telefon", width: 375, height: 812 },
  { name: "arvuti", width: 1280, height: 800 },
];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };

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
  await page.goto(url, { waitUntil: "domcontentloaded" });

  check(await page.isVisible("text=Millal pensionile minna?"), "1. samm avaneb");
  check(await page.textContent("#o-age") === "66 a (aastal 2036)", "pensioniiga 1970 → 66 a");
  await page.click("#go-bet");
  await page.click('.odds[data-k="3"]');
  check(await page.textContent("#s-odds") === "1,18", "koefitsient +3 a = 1,18");
  await page.click("#go-spin");
  check(await page.isVisible("#wsvg path"), "3. ratas joonistatud");
  await page.click("#spin");
  await page.waitForSelector('[data-screen="4"]:not([hidden])', { timeout: 8000 });
  check(true, "4. kõne avaneb");
  await page.click("#accept");
  check(await page.isVisible("#quote"), "tsitaat nähtav");
  await page.click("#go-truth");
  check(await page.textContent("#t-be") === "85 a 4 k", "tasuvuspunkt mees 1970 +3 a = 85 a 4 k");
  const p = await page.textContent("#t-p");
  check(/^\d+(,\d)?%$/.test(p), `võidu tõenäosus kuvatud (${p})`);
  check((await page.$$("#chart path")).length > 20, "graafik joonistatud");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "horisontaalset kerimist pole");
  check(errors.length === 0, "konsoolis vigu pole" + (errors.length ? ": " + errors.join(" | ") : ""));
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
