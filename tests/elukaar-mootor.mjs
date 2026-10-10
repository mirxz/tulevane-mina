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

// ---- Tulumaks pensionieas (EMTA 2026): 22%, pensionäri maksuvaba tulu 776 € kuus (9312 € aastas) ----
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
const taxBase = { ...base, realReturn: 0, p2: 100000, needMonthly: 1 };
const row = (s, age) => s.rows.find((x) => x.age === age);
const E = { id: 'E' }; // jätkan kasvatamist: ainult lisaväljamaksed

// Riiklik pension: 22% ainult 776 € ületavalt osalt.
{
  const s = P.simulate({ ...taxBase, p1Monthly: 1000 }, T, B);
  near(row(s, 65).i1g, 1000, 'bruto pension');
  near(row(s, 65).tax1, 0.22 * (1000 - 776), 'tulumaks pensionilt');
  near(row(s, 65).i1, 1000 - 0.22 * (1000 - 776), 'pension pärast maksu');
  near(row(s, 64).i1, 0, 'enne pensioniiga pensioni pole');
  const lo = P.simulate({ ...taxBase, p1Monthly: 700 }, T, B);
  near(row(lo, 65).tax1, 0, '776 € all tulumaksu pole');
  near(row(lo, 65).i1, 700, 'madal pension jääb tervelt kätte');
  const off = P.simulate({ ...taxBase, p1Monthly: 1000, incomeTax: false }, T, B);
  near(row(off, 65).i1, 1000, 'incomeTax=false: maksu pole');
  assert.strictEqual(P.INCOME_TAX, 0.22);
  assert.strictEqual(P.PENSIONER_ALLOWANCE, 9312);
}
// Kasutamata maksuvaba tulu kehtib 10% lisaväljamaksele: pension 500 € → 276 €/kuus (3312 €/a) vaba osa.
{
  const input = { ...taxBase, p1Monthly: 500, needMonthly: 1000 }; // puudu 6000 €/a
  const on = P.simulate(input, T, E), off = P.simulate({ ...input, incomeTax: false }, T, E);
  const grossOn = (6000 - 0.1 * 3312) / 0.9, grossOff = 6000 / 0.9;
  near(row(on, 65).i2 * 12, 6000, 'kulud kaetud (maksuvaba osaga)');
  near(row(on, 66).moneyLeft, 100000 - grossOn, 'bruto väljavõtt on väiksem, kui maksuvaba tulu on alles');
  near(row(off, 66).moneyLeft, 100000 - grossOff, 'ilma maksuvaba tuluta 10% kogu summalt');
  assert.ok(row(on, 66).moneyLeft > row(off, 66).moneyLeft);
}
// Pension üle 776 €: maksuvaba tulu on pensioniga ära kasutatud, lisaväljamakse 10% kogu summalt.
{
  const s = P.simulate({ ...taxBase, p1Monthly: 900, needMonthly: 1500 }, T, E);
  const gap = 1500 * 12 - (900 - 0.22 * (900 - 776)) * 12;
  near(row(s, 66).moneyLeft, 100000 - gap / 0.9, 'lisaväljamakse 10% kogu summalt');
}
// Edasilükatud riiklik pension: vahepealsetel pensioniaastatel on kogu maksuvaba tulu 10% väljamaksetele.
{
  const s = P.simulate({ ...taxBase, p1Monthly: 1000, needMonthly: 1000 }, T, { id: 'E', deferral: 2 });
  near(row(s, 65).i1, 0, 'pensioni algus on edasi lükatud');
  near(row(s, 66).moneyLeft, 100000 - (12000 - 0.1 * 9312) / 0.9, 'terve maksuvaba tulu kasutuses edasilükkamise ajal');
  const p = 1000 * (1 + P.DEFERRAL_INCREASE[2]);
  near(row(s, 67).i1, p - 0.22 * (p - 776), 'edasilükatud pension pärast maksu');
}
// Ühekordne väljavõtt (A): 10% maks, millest lahutub pensioniea aasta kasutamata maksuvaba tulu.
{
  const s = P.simulate({ ...taxBase, p1Monthly: 500, p2: 10000, needMonthly: 1 }, T, A);
  near(row(s, 65).moneyLeft, 10000 - 0.1 * (10000 - 3312), 'ühekordne väljavõtt: maksuvaba osa maha');
  const off = P.simulate({ ...taxBase, p1Monthly: 500, p2: 10000, needMonthly: 1, incomeTax: false }, T, A);
  near(row(off, 65).moneyLeft, 9000, 'ilma maksuvaba tuluta 10% kogu summalt');
}
// Fondipension (B, D) on maksuvaba: tulumaks ei puutu selle makseid.
{
  const on = P.simulate({ ...taxBase, p1Monthly: 1000 }, T, B), off = P.simulate({ ...taxBase, p1Monthly: 1000, incomeTax: false }, T, B);
  near(row(on, 65).i2, row(off, 65).i2, 'fondipension tulumaksuvaba');
}
console.log('Elukaare mootor: OK');
