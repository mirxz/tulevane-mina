// Elukaare mootor (public/elukaar/pension.js): fondipensioni tasasus ja annuiteeditegur. Kasutus: node tests/elukaar-mootor.mjs
import assert from "node:assert";
globalThis.window = globalThis;
await import("../public/data/elutabel.js");
await import("../public/elukaar/pension.js");
const P = globalThis.Pension, T = globalThis.ELUTABEL;
const [A, B, C, D] = P.SCENARIOS;

assert.strictEqual(P.annuityDue(10, 0), 10);
assert.ok(Math.abs(P.annuityDue(3, 0.02) - (1 + 1 / 1.02 + 1 / 1.02 ** 2)) < 1e-12);
assert.strictEqual(P.annuityDue(1, 0.04), 1);

const base = { birthYear: 1984, sex: 'M', pensionAgeYears: 65, p1Monthly: 1000, p2: 40000, p3: 0, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 1 };

// B: üks leping annab kogu perioodi jooksul võrdse reaalse makse ka positiivse tootluse korral.
for (const r of [0, 0.02, 0.04, -0.01]) {
  const s = P.simulate({ ...base, realReturn: r }, T, B);
  const term = P.fundPensionTerm(T, 'M', 65);
  const pay = s.rows.filter((x) => x.age >= 65 && x.age < 65 + term).map((x) => x.i2);
  assert.strictEqual(pay.length, term);
  pay.forEach((v) => assert.ok(Math.abs(v - pay[0]) < 1e-6, `B makse tasane r=${r}: ${v} vs ${pay[0]}`));
  const pot = 40000 * (1 + r) ** (65 - (P.CURRENT_YEAR - 1984));
  const pv = pay.reduce((sum, v, k) => sum + v * 12 / (1 + r) ** k, 0);
  assert.ok(Math.abs(pv - pot) < 1e-6, `B maksete PV = saldo r=${r}: ${pv} vs ${pot}`);
  assert.strictEqual(s.rows.find((x) => x.age === 65 + term).i2, 0);
}
{
  const r = 0.02, s = P.simulate({ ...base, realReturn: r }, T, B);
  const pot = 40000 * 1.02 ** (65 - (P.CURRENT_YEAR - 1984));
  const term = P.fundPensionTerm(T, 'M', 65);
  assert.ok(Math.abs(s.rows.find((x) => x.age === 65).i2 - pot / P.annuityDue(term, r) / 12) < 1e-6);
}

// D (leping igal aastal uuesti): ei saa otsa, väheneb vanemas eas (stsenaariumi omadus, mitte viga).
{
  const s = P.simulate({ ...base, realReturn: 0 }, T, D);
  const p = (a) => s.rows.find((x) => x.age === a).i2;
  assert.ok(p(65) > p(80) && p(80) > p(90) && p(95) > 0);
}
// Eraldi III sammas fondipensionina (uus leping igal aastal) ei kasva 0% juures.
{
  const s = P.simulate({ ...base, p2: 0, realReturn: 0, p3Sep: { amount: 20000, mode: 'fund' } }, T, B);
  const p = (a) => s.rows.find((x) => x.age === a).i3;
  assert.ok(p(65) > p(75) && p(75) > p(85));
}
console.log('Elukaare mootor: OK');
