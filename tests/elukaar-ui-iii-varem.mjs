// III sammas enne pensioniiga (pensioniea − 5 sammus): fondipension või korraga algab selle sammu vanusest, ka 2021. a või
// hiljem liitunul ja töötamise ajal. Varem jäi see pensioniikka.
// Kasutus: node tests/elukaar-ui-iii-varem.mjs [URL]
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
const set = (vals) => page.evaluate((v) => { for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }, vals);
const pick = (name, value) => page.evaluate(([n, v]) => { const r = document.querySelector('input[name="' + n + '"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); r.dispatchEvent(new Event("input", { bubbles: true })); }, [name, value]);
const inp = () => page.evaluate(() => window.__elukaar.readInput());
await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__elukaar);

// Sünd 1975, pensioniiga 65 → samm 60 a. III sammas 2021. a või hiljem: soodusvanus 60.
await set({ birthYear: 1975, pensionAgeYears: 65, p3: 20000, p3Monthly: 50, p3Joined: "after" });
let i = await inp();
const pa = i.pensionAgeYears;
check(i.p3CalcPlan === "keep", "vaikimisi kasvab edasi: " + i.p3CalcPlan);

await pick("p3pa", "fund");
i = await inp();
check(i.p3CalcPlan === "fund" && i.p3CalcAge === pa - 5, "fondipension algab sammu vanusest " + (pa - 5) + ": " + i.p3CalcPlan + " " + i.p3CalcAge);
const early = Object.keys(i.p3Early).map(Number).sort((a, b) => a - b);
check(early[0] === pa - 5 && early[early.length - 1] === pa - 1 && early.every((a) => i.p3Early[a] > 0), "väljamaksed enne pensioniiga " + early.join(","));
check(i.p3Sep && i.p3Sep.mode === "fund" && i.p3Sep.start === pa - 5, "mootor jätkab sama lepingut: " + JSON.stringify(i.p3Sep));

await pick("p3pa", "lump");
i = await inp();
check(i.p3CalcPlan === "lump" && i.p3CalcAge === pa - 5 && i.p3Tax === 0.1 && i.p3Net > 0, "korraga " + (pa - 5) + "-aastaselt, 10% tulumaks: " + JSON.stringify({ p: i.p3CalcPlan, a: i.p3CalcAge, t: i.p3Tax, n: Math.round(i.p3Net) }));

// Soodusvanus pole veel käes (liitusid hiljuti): fondipension jääb pensioniikka.
await set({ birthYear: 1966, pensionAgeYears: 65, p3Joined: "after" });
await pick("p3pa", "fund");
i = await inp();
check(i.p3CalcAge >= 60 || i.p3CalcPlan === "keep", "fondipension mitte enne soodusvanust: " + i.p3CalcPlan + " " + i.p3CalcAge);

check(errs.length === 0, "lehel pole JS vigu: " + errs.join("; "));
await browser.close();
console.log(`III sammas enne pensioniiga (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
