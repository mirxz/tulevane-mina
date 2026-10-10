// Kalkulaatori mootor: Meelise testid (tuleva-tulevik/tests/pension.test.js) ESM-kujul, pluss meie lisatud sisendid.
// Kasutus: node tests/kalkulaator-mootor.mjs
import assert from "node:assert";
import * as P from "../public/kalkulaator/mootor.js";
import { ELUTABEL as table } from "../public/kalkulaator/andmed/elutabel.js";
import { riiklikPension, koefitsiendid, vaikimisiStaaz, vaikimisiVarasemKoef } from "../public/kalkulaator/riiklik.js";
import { KULUD_KAT, ALGUSPUNKTID, varaKohtTurul, TULEVA_FAKTID, kuludKokku } from "../public/kalkulaator/andmed/kihid.js";
const base = { birthYear: 1966, sex: 'N', p1Monthly: 900, p2: 30000, p3: 20000, p3Before2021: true, needMonthly: 1200, realReturn: 0.02 };
const [A, B, C, D] = P.SCENARIOS;
const Cx = { ...C, deferral: 2 };

// Elutabel vastab Statistikaameti 2025 numbritele.
assert.strictEqual(table.elada_jaanud.M[65], 16.33);
assert.strictEqual(table.elada_jaanud.N[65], 21.43);
assert.strictEqual(P.fundPensionTerm(table, 'M', 65), 16);
assert.strictEqual(P.fundPensionTerm(table, 'N', 65), 21);
// Ellujäämine: 65-aastasest mehest elab 81-aastaseks umbes 51%.
assert.ok(Math.abs(P.survival(table, 'M', 65, 81) - 0.51) < 0.01);

// Pensioniiga.
assert.strictEqual(P.pensionAge(1961).label, '65 a');
assert.strictEqual(P.pensionAge(1962).label, '65 a 1 k');
assert.ok(P.pensionAge(1970).label.startsWith('u '));

// Riiklik pension 2 aastat hiljem on 16,88% suurem ja enne seda null.
const c = P.simulate(base, table, Cx);
assert.ok(Math.abs(c.rows.find((x) => x.age === 70).i1 - 900 * 1.1688) < 0.01);
assert.strictEqual(c.rows.find((x) => x.age === 65).i1, 0);

// Väike vajadus: ühe lepinguga (B) lõpeb samba raha perioodi lõpus, igal aastal uuendades (D) mitte.
const small = { ...base, needMonthly: 900 };
const b = P.simulate(small, table, B), d = P.simulate(small, table, D);
assert.ok(b.rows.find((x) => x.age === 85).i23 > 0 && b.rows.find((x) => x.age === 86).i23 === 0, 'B väljamakse lõpeb 86-aastaselt (21 a)');
assert.ok(d.rows.find((x) => x.age === 100).i23 > 0, 'D maksab ka 100-aastaselt');

// Ühine kulureegel: keegi ei kuluta üle vajaduse ega alla nulli.
for (const s of P.SCENARIOS) {
  const r = P.simulate(base, table, s.id === 'C' ? Cx : s);
  assert.ok(r.rows.every((x) => x.spend <= base.needMonthly + 0.01 && x.spend >= 0), s.id);
}

// Jätkusuutlik kulu on katmise piir.
for (const s of [B, D]) {
  const L = P.sustainableNeed(base, table, s);
  const ok = P.simulate(base, table, s, L), over = P.simulate(base, table, s, L + 50);
  assert.ok(ok.coversNeedUntil === null || ok.coversNeedUntil > ok.horizonAge, s.id + ' L katab');
  assert.ok(over.coversNeedUntil !== null && over.coversNeedUntil <= over.horizonAge, s.id + ' L+50 ei kata');
}

// Sissemaksed: II sammas 4% + riigi 4% palgast, III sammas oma kuumakse.
assert.strictEqual(P.yearlyContribution({ grossMonthly: 2000, p2Rate: 0.04, p3Monthly: 100 }), 2000 * 12 * 0.08 + 1200);
assert.strictEqual(P.yearlyContribution({ grossMonthly: 2000, p2Rate: 0, p3Monthly: 0 }), 0);
const withC = P.simulate({ ...base, birthYear: 1970, grossMonthly: 2500, p2Rate: 0.02, p3Monthly: 100 }, table, B);
const noC = P.simulate({ ...base, birthYear: 1970 }, table, B);
assert.ok(withC.expectedLifetime > noC.expectedLifetime, 'sissemaksed suurendavad sissetulekut');
// Pensioniea valik nihutab riikliku pensioni algust.
assert.strictEqual(P.simulate({ ...base, pensionAgeYears: 66 }, table, B).rows.find((x) => x.age === 65).i1, 0);

// Kulud statistikast: üksik 65+ ja paar, kõik kategooriad olemas ja positiivsed.
const kulud = { kategooriad: KULUD_KAT };
assert.ok(kulud.kategooriad.length >= 10 && kulud.kategooriad.every((c) => c.uksi > 0 && c.paar > 0));
const total = kulud.kategooriad.reduce((a, c) => a + c.uksi, 0);
assert.ok(total > 600 && total < 1200, 'üksik 65+ kulud mõistlikus vahemikus: ' + total);

for (const s of P.SCENARIOS) {
  const r = P.simulate(base, table, s.id === 'C' ? Cx : s);
  console.log(s.id, 'katab', r.coversNeedUntil, 'raha lõpeb', r.moneyEndAge, '90a', r.spendAt90.toFixed(0),
    'jätkusuutlik', P.sustainableNeed(base, table, s.id === 'C' ? Cx : s), 'horisont', r.horizonAge, 'E', r.expectedLifetime.toFixed(0));
}
;

// ---- LISATUD sisendid: vaikeväärtused ei muuda midagi (parim kontroll, et Meelise tulemus säilib) ----
const ref = P.simulate(base, table, B);
const same = P.simulate({ ...base, fee: 0, wageGrowth: 0, savings: 0, savingsReturn: 0, tax: 0.10, horizon: 0.10 }, table, B);
assert.deepStrictEqual(same.rows.map((x) => Math.round(x.spend)), ref.rows.map((x) => Math.round(x.spend)), "vaikeväärtused annavad Meelise tulemuse");
assert.strictEqual(ref.coversNeedUntil, 84); assert.strictEqual(P.sustainableNeed(base, table, B), 1080);

// Fondi tasu vähendab tulemust, madalam tasu on parem.
const lowFee = P.sustainableNeed({ ...base, birthYear: 1985, grossMonthly: 2500, p2Rate: 0.06, fee: 0.0028 }, table, B);
const highFee = P.sustainableNeed({ ...base, birthYear: 1985, grossMonthly: 2500, p2Rate: 0.06, fee: 0.0074 }, table, B);
assert.ok(lowFee > highFee, "tasu 0,28% annab rohkem kui 0,74%: " + lowFee + " vs " + highFee);
// Palga reaalkasv suurendab sissemakseid; muud säästud suurendavad katet.
const g0 = P.sustainableNeed({ ...base, birthYear: 1985, grossMonthly: 2500, p2Rate: 0.06 }, table, B);
const g1 = P.sustainableNeed({ ...base, birthYear: 1985, grossMonthly: 2500, p2Rate: 0.06, wageGrowth: 0.02 }, table, B);
assert.ok(g1 > g0, "palgakasv aitab");
const s0 = P.simulate({ ...base, needMonthly: 1500 }, table, B), s1 = P.simulate({ ...base, needMonthly: 1500, savings: 50000 }, table, B);
assert.ok(s1.expectedLifetime > s0.expectedLifetime, "muud säästud aitavad");
// Rangem "elu lõpuni" lävi nõuab vanemat vanust.
assert.ok(P.horizonAge(table, "N", 40, 0.05) > P.horizonAge(table, "N", 40, 0.25), "5% lävi on hilisem kui 25%");

// ---- Andmekihid ----
for (const a of ALGUSPUNKTID) {
  assert.ok(a.v.sunniaasta >= 1940 && a.v.sunniaasta <= 2008 && ["M", "N"].includes(a.v.sugu), a.id + " põhiväljad");
  const r = P.simulate({ birthYear: a.v.sunniaasta, sex: a.v.sugu, p1Monthly: 900, p2: a.v.p2, p3: a.v.p3, p3Before2021: a.v.p3Before2021, needMonthly: kuludKokku("uksi"), realReturn: 0.02, pensionAgeYears: a.v.pensionAge || 65, grossMonthly: a.v.gross, p2Rate: a.v.p2Rate, p3Monthly: a.v.p3Monthly }, table, B);
  assert.ok(r.rows.length > 0 && r.rows.every((x) => Number.isFinite(x.spend)), a.id + " arvutub");
}
const marit = ALGUSPUNKTID.find((a) => a.id === "mitte-single").v;
assert.strictEqual(marit.p2, 0); assert.strictEqual(marit.p3, 6290); // Single Pillar: kogu vara III sambas
assert.strictEqual(ALGUSPUNKTID.filter((a) => a.pers).length, 10, "10 persoonat");
assert.ok(ALGUSPUNKTID.filter((a) => a.pers).every((a) => a.v.p2 + a.v.p3 === a.pers.aum), "vara jaotus II/III annab kokku aruande keskmise AUM-i");
assert.strictEqual(ALGUSPUNKTID.find((a) => a.id === "liige-gone").v.p3 + ALGUSPUNKTID.find((a) => a.id === "mitte-gone").v.p2, 0);
const st = ALGUSPUNKTID.find((a) => a.id === "liige-steady").v;
assert.strictEqual(st.p2 + st.p3, 44514); // vara jaotus ei muuda kogusummat (savers_analysis)
assert.strictEqual(kuludKokku("uksi"), 790); // Statistikaamet LE205 + IA002 (kulud.js)
assert.ok(Math.abs(TULEVA_FAKTID.uhekordneOsa - 0.899) < 0.001);
assert.deepStrictEqual([varaKohtTurul(0).vahemalt, varaKohtTurul(100).vahemalt, varaKohtTurul(2000).vahemalt, varaKohtTurul(30000).vahemalt], [0, 0.43, 0.6, 0.9]);

// riiklik pension (SKA valem)
{
  const k = koefitsiendid(1727);
  assert.ok(Math.abs(k.K - 1727 * 12 * 0.2 / 4845.72) < 1e-9 && k.S === 1 && Math.abs(k.U - (1 + k.K) / 2) < 1e-9);
  const sv = vaikimisiStaaz(1990); assert.strictEqual(sv, 0); // tööle 2009, staaži kuni 1998 pole
  assert.strictEqual(vaikimisiStaaz(1960), 20); // 1979–1998
  const vk = vaikimisiVarasemKoef(1990, 1727);
  const r = riiklikPension({ birthYear: 1990, gross: 1727, pensionAge: 65, staaz: sv, varasemKoef: vk, rho: 0.015 });
  assert.ok(Math.abs(r.tana - (399.24 + 10.477 * (r.koefKokku))) < 1e-6);
  assert.ok(r.tana > 700 && r.tana < 1000 && r.pensionile > r.tana);
  const r0 = riiklikPension({ birthYear: 1990, gross: 1727, pensionAge: 65, staaz: sv, varasemKoef: vk, rho: 0 });
  assert.strictEqual(r0.pensionile, r0.tana);
  // mootor: p1Growth indekseerib tänastest väärtustest
  const a = P.simulate({ ...base, p1Growth: 0.01 }, table, P.SCENARIOS.find((x) => x.id === "B"));
  const b = P.simulate(base, table, P.SCENARIOS.find((x) => x.id === "B"));
  assert.ok(a.rows.find((x) => x.age === 80).i1 > b.rows.find((x) => x.age === 80).i1);
}
console.log("kalkulaatori mootor ja andmekihid: OK");
