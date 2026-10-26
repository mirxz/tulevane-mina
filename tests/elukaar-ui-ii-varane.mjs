// II samba varane väljavõtt (KoPS § 43¹, 3. samm): samm on rajal ainult siis, kui II sammas on ja pensioniea − 5 pole käes;
// valik jõuab mootorisse, märkus näitab summat.
// Kasutus: node tests/elukaar-ui-ii-varane.mjs [URL]
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

const stepsShown = () => page.evaluate(() => [...document.querySelectorAll("#path li")].map((e) => e.textContent.trim()));
const cur = new Date().getFullYear();

// Sünd 1976 (50 a), II sammas olemas: samm 3 on rajal, vaikimisi valikut pole.
await set({ birthYear: cur - 50, pensionAgeYears: 65, p2: 30000, p2Rate: "0.02" });
let i = await inp();
check(i.p2Early === undefined, "vaikimisi varast väljavõttu pole");
check((await stepsShown()).some((t) => /50–59/.test(t)), "samm 50–59 on rajal");

await pick("p2Early", "yes");
await set({ p2EarlyAge: 52 });
i = await inp();
check(i.p2Early && i.p2Early.age === 52 && !i.p2Early.rejoin && !i.p2Early.save, "valik jõuab mootorisse: " + JSON.stringify(i.p2Early));
check(/22%|tulumaksu/.test(await page.evaluate(() => document.getElementById("p2EarlyNote").textContent)), "märkus näitab tulumaksu");
// Uuesti ei liitu: II sammast enam pole, 60 a sammus II valikut ei ole, märkus viib 3. sammu.
i = await inp();
check(i.p2Gone && !i.p2Has && i.payout === "grow", "II välja võetud, ei liitu: p2Has false, payout grow: " + JSON.stringify({ g: i.p2Gone, h: i.p2Has, p: i.payout }));
const s60 = await page.evaluate(() => ({ off: document.getElementById("p2At60Set").disabled, note: document.getElementById("p2At60Note").innerText, go: !!document.querySelector('#p2At60Note [data-goto="3"]') }));
check(s60.off && /võtsid 52-aastaselt välja/.test(s60.note) && s60.go, "60 a: II valik lukus, märkus ja link 3. sammu: " + JSON.stringify(s60));
await pick("p2EarlyRejoin", "yes"); await pick("p2EarlyUse", "save");
i = await inp();
check(i.p2Early.rejoin && i.p2Early.save, "liitumine ja hoius valitud");
check(i.p2Has && !i.p2Gone, "uuesti liitudes on II sammas 60 a sammus jälle olemas");
// Alla 3-aastane laps: riigi lisamakse lõpeb; pärast uuesti liitumist Elukaar seda ei arvesta (eeldus, mootoris pole).
const note = () => page.evaluate(() => document.getElementById("p2EarlyNote").textContent);
check(!/lisamakse lapse eest/.test(await note()), "lasteta pole lapse lisamakse lauset");
await set({ kidsHas: "yes" }); await set({ kidsCount: 1 }); await set({ kidsBorn0: cur - 1 });
check(/lisamakse lapse eest lõpeb samuti; pärast uuesti liitumist .*eeldus/.test(await note()), "väikese lapsega märkus eeldusega: " + (await note()));
await set({ kidsHas: "no" });

// III samba varane väljavõtt: enne 2021 liitunul 55 a samm, aga mitte siis, kui III võeti juba varem välja.
const labels = () => page.evaluate(() => [...document.querySelectorAll("#path .path-label")].map((e) => e.textContent));
await pick("p2Early", "no");
await set({ p3: 20000, p3Monthly: 50, p3Joined: "before" });
check((await labels()).includes("55 a"), "enne 2021 liitunul on 55 a samm: " + (await labels()).join(", "));
await pick("p3Early", "yes");
await set({ p3EarlyAge: 50 });
i = await inp();
check(i.p3EarlyAge === 50 && i.p3CalcPlan === "lump" && i.p3CalcAge === 50 && i.p3Tax === 0.22 && i.p3Net > 0, "III varem: 22% 50-aastaselt: " + JSON.stringify({ a: i.p3EarlyAge, p: i.p3CalcPlan, t: i.p3Tax }));
check(!(await labels()).includes("55 a"), "III varem välja võetud: 55 a sammu pole: " + (await labels()).join(", "));
check(/22%|tulumaksu/.test(await page.evaluate(() => document.getElementById("p3EarlyNote").textContent)), "III märkus näitab tulumaksu");
await pick("p3Early", "no");
check((await labels()).includes("55 a"), "valik tagasi: 55 a samm on jälle");

// III korraga 60-aastaselt ja II korraga: sammastes ei jää miinust (III sissemakse inflatsioon nagu mootoris).
await pick("payout", "lump"); await pick("p3pa", "lump");
const bar = await page.evaluate(() => document.getElementById("potBar").innerText);
check(!/[−-]\d/.test(bar.split("\n")[0]), "sammastes pole miinust: " + bar.split("\n")[0]);
await pick("payout", "grow"); await pick("p3pa", "grow");

// II sammast pole (ja III-ta): samm kaob rajalt.
await set({ p2: 0, p2Rate: "0", p3: 0, p3Monthly: 0 });
check(!(await stepsShown()).some((t) => /50–59/.test(t)), "II sambata varast väljavõttu ei pakuta");
i = await inp();
check(i.p2Early === undefined, "II sambata valik ei jõua mootorisse");

// Pensioniea − 5 on käes (60-aastane): samm kaob.
await set({ birthYear: cur - 60, pensionAgeYears: 65, p2: 30000, p2Rate: "0.02" });
i = await inp();
check(i.p2Early === undefined, "60-aastasel varast väljavõttu pole");

check(errs.length === 0, "lehel pole JS vigu: " + errs.join("; "));
await browser.close();
console.log(`II samba varane väljavõtt (UI): ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
