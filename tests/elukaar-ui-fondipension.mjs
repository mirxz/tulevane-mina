// Fondipensioni algus pensionipõlve sammus (61+): kasvatan edasi kuni valitud vanuseni, siis leping.
// Kasutus: node tests/elukaar-ui-fondipension.mjs [URL]
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const CHART = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
// Ilma profiilita on eeltäidetud ainult sünniaasta ja sugu (TARA); test täidab endised näidisväärtused.
const naidis = (page) => page.waitForFunction(() => window.__elukaar || document.getElementById("sinaList")).then(() => page.evaluate(() => {
  for (const [id, v] of Object.entries({ p1Monthly: 900, grossMonthly: 2200, p2: 25000, p3: 5000, p3Monthly: 0 })) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
}));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext();
await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const set = (vals) => page.evaluate((v) => { for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }, vals);
const pick = (name, value) => page.evaluate(([n, v]) => { const r = document.querySelector('input[name="' + n + '"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }, [name, value]);
const shown = (id) => page.evaluate((i) => !document.getElementById(i).classList.contains("d-none"), id);
const inp = () => page.evaluate(() => window.__elukaar.readInput());
await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" }); await naidis(page);
await page.waitForFunction(() => window.__elukaar);
await set({ birthYear: 1966, p2: 60000, p3: 0, p3Joined: "none", p3Monthly: 0 });

// 1. Vaikimisi (60 a: kasvatan edasi, pensionieas: kasvatan edasi): valik on näha, leping lukus.
await pick("payout", "grow"); await pick("payoutPa", "grow");
check(await shown("fundFromWrap"), "kasvatan edasi: fondipensioni alguse valik on näha");
check((await inp()).fundFrom === undefined, "vaikimisi ei hakka");
check(await shown("contractLocked") && /vali ülal algusaasta/.test(await page.evaluate(() => document.getElementById("contractLocked").textContent)), "leping lukus, juhis algusaasta kohta");

// 2. Algus 70: leping avaneb ja jõuab mootorisse (B, fundFrom 70).
await set({ fundFrom: 70 });
const i = await inp();
check(i.fundFrom === 70, "fundFrom 70 jõuab sisendisse");
check(!(await shown("contractLocked")) && await page.evaluate(() => !document.getElementById("contractSet").disabled), "lepingu valik avaneb");
const lab = await page.evaluate(() => [...document.querySelectorAll("#path .path-label")].map((e) => e.textContent));
check(lab.includes("70 a") && !lab.some((l) => /\+ a$/.test(l)), "66+ samm on rajal 70 a kohal: " + lab.join(", "));
check(/Fondipension algab/.test(await page.evaluate(() => document.getElementById("h7").textContent)), "sammu pealkiri: Fondipension algab");
check(/^70-aastane/.test(await page.evaluate(() => document.getElementById("k7").textContent)), "kicker 70-aastane");
const sc = await page.evaluate(() => { const r = window.__elukaar.readInput(); return [r.method, r.contract]; });
check(sc[0] === "grow", "meetod jääb „kasvatan edasi“");
const n = await page.evaluate(() => document.querySelectorAll("main .chapter").length - 1);
await page.evaluate((k) => document.querySelector('#path [data-goto="' + k + '"]').click(), n);
check(/Fondipension alates 70-aastaselt/.test(await page.evaluate(() => document.getElementById("recap").textContent)), "kokkuvõte: fondipension alates 70");

// 3. Fondipension pensioniea sammus: valikut pole (leping algab kohe).
await pick("payoutPa", "fund");
check(!(await shown("fundFromWrap")), "fondipension pensionieas: alguse valikut pole");
check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nFondipensioni algus (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
