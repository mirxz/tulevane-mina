// Elukaare kasutajaliidese loogika (story.js): "raha ei teki ega kao". Kasutab testikonksu window.__elukaar.readInput.
// Kasutus: node tests/elukaar-ui-raha.mjs [URL]
import { chromium } from "playwright";
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const near = (a, b, t = 1e-6 * Math.max(1, Math.abs(a))) => Math.abs(a - b) <= t;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext();
await ctx.addInitScript(() => { window.__ELUKAAR_TEST = true; });
await ctx.route("**/cdn.jsdelivr.net/**", (r) => r.abort()); // Chart.js pole siin vaja; readInput ei vaja graafikut
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => { if (!/Chart is not defined/.test(e.message)) errs.push(e.message); });

async function setup(vals, radios = {}) {
  await page.goto(url + "/elukaar/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__elukaar);
  return page.evaluate(([v, r]) => {
    for (const [id, val] of Object.entries(v)) { const el = document.getElementById(id); el.value = String(val); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    for (const [name, val] of Object.entries(r)) { const el = document.querySelector(`input[name=${name}][value="${val}"]`); if (el) { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); } }
    return window.__elukaar.readInput();
  }, [vals, radios]);
}
const base = { birthYear: 1968, sex: "M", p1Monthly: 1000, p2: 40000, p3: 20000, p3Joined: "before", grossMonthly: 3000, p2Rate: "0.06", p3Monthly: 200, pensionAgeYears: 65 };
// III samba kolm plaani: 'keep', 'fund', 'lump'. Reaalne tootlus fondil võib olla > 0; raha säilimine kontrollitakse ilma kasvuta ainult siis, kui r = 0 pole võimalik,
// seepärast kontrollime kasvuga arvestatud samaväärsust: p3RemNow·(1+r)^(pa−praegune) = p3Rem ja c3Adj ≤ 0.
for (const plan of ["keep", "fund", "lump"]) {
  for (const age of [1968, 1972, 1980]) {
    const i = await setup({ ...base, birthYear: age }, { p3plan: plan });
    const L = `p3plan ${plan} sünd ${age}`;
    check(i.c3Adj <= 1e-9, `${L}: c3Adj ei tohi olla positiivne (${i.c3Adj})`);
    check(i.p3RemNow >= 0 && i.p3Gross >= 0 && i.p3Net <= i.p3Gross + 1e-6, `${L}: p3RemNow/Gross/Net mõistlikud`);
    // III samba raha ühiselt: keep → kõik jääb potti; fund/lump → osa läheb eraldi (Gross/Rem).
    if (i.p3Plan === "keep") check(i.p3Gross === 0 && i.p3Rem === 0 && i.p3Early && Object.keys(i.p3Early).length === 0, `${L}: keep ei võta midagi välja`);
    if (i.p3Plan === "lump") check(near(i.p3Net, i.p3Gross * (1 - i.p3Tax)) && i.p3Rem === 0, `${L}: lump: neto = bruto × (1 − maks), ülejääki pole`);
    if (i.p3Plan === "fund") {
      const earlyYears = Object.keys(i.p3Early).length;
      check(i.p3Rem >= 0, `${L}: fund ülejääk ≥ 0`);
      check(earlyYears === 0 || Object.values(i.p3Early).every((v) => v > 0), `${L}: fund enne pensioniiga makstavad summad > 0`);
    }
  }
}
// "Raha ei teki": fund-plaanis ei tohi sissemaksed kaheks minna – c3Adj peab täpselt võrduma kõigi sissemaksete (kuni pensionini) tänaste väärtuste negatiivse summaga.
{
  const i = await setup(base, { p3plan: "fund" });
  const pa = 65, a0 = i.currentAge; let exp = 0;
  for (let a = a0; a < pa; a++) exp -= i.p3Monthly * 12 / Math.pow(1 + i.realReturn, a - a0 + 1);
  check(near(i.c3Adj, exp, 1e-6 * Math.abs(exp) + 1e-6) , `fund: c3Adj ${i.c3Adj.toFixed(2)} = −Σ sissemaksed (${exp.toFixed(2)})`);
  // Kui avatud sammas ei ole 'fund', siis c3Adj on 0 (kõik sissemaksed lähevad ühisesse potti) – 'keep' avatud sambaga.
  const k = await setup(base, { p3plan: "keep" });
  check(k.c3Adj === 0, `keep: c3Adj = 0 (${k.c3Adj})`);
  // Raha ei teki ega kao: ühine pott + eraldi III samba pott = kõik osad kokku.
  check(near(k.p3 + (k.p3Sep ? k.p3Sep.amount : 0), k.p3Base + k.childNow + k.switchAdj + k.p3RemNow + k.c3Adj), "keep: p3 + eraldi III = base + laps + vahetus + ülejääk + c3Adj");
  check(near(i.p3 + (i.p3Sep ? i.p3Sep.amount : 0), i.childNow + i.switchAdj + i.p3RemNow + i.c3Adj), "fund: p3 + eraldi III = laps + vahetus + ülejääk + c3Adj");
}
// Fondivahetus: kui vahetus tehakse praegu (switchAge = praegune vanus), on korrektsioon 0.
{
  const i = await setup(base, { fundChange: "switch" });
  check(Number.isFinite(i.switchAdj), "switchAdj on lõplik arv");
}
// Kõik väljundväljad lõplikud arvud kõigi profiilide ja III samba plaanide korral.
for (const plan of ["keep", "fund", "lump"]) for (const j of ["before", "after", "none"]) {
  const i = await setup({ ...base, p3Joined: j }, { p3plan: plan });
  const bad = Object.entries(i).filter(([k, v]) => typeof v === "number" && !Number.isFinite(v)).map(([k]) => k);
  check(bad.length === 0, `p3Joined ${j}, plaan ${plan}: mitte-lõplikud väljad ${bad}`);
}
check(errs.length === 0, "lehe vead: " + errs.join("; "));
await browser.close();
console.log(`\nElukaare UI-loogika: ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
