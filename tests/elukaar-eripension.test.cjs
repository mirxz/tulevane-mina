// Eripension elukaare mootoris: kindel summa alates pensioniigast, maksustatakse riikliku pensioniga ühiselt.
// Käivita: node tests/elukaar-eripension.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const row = (s, age) => s.rows.find((x) => x.age === age);
const base = { birthYear: 1976, sex: 'M', p1Monthly: 1200, p2: 50000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 1500, realReturn: 0, depositReturn: 0, extraDeposit: 0 };
const E = { id: 'E' };
const A = P.PENSIONER_ALLOWANCE / 12, TAX = P.INCOME_TAX;
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;

// 1. Ilma eripensionita (0 või puudub) on tulemus täpselt sama.
for (const id of ['A', 'B', 'C', 'D', 'E']) {
  const sc = { id, deferral: id === 'C' ? 2 : 0 };
  const a = P.simulate(base, T, sc), b = P.simulate({ ...base, spMonthly: 0 }, T, sc);
  assert.deepStrictEqual(a.rows.map((x) => x.i1 + x.i23 + x.dep), b.rows.map((x) => x.i1 + x.i23 + x.dep));
  assert.ok(a.rows.every((x) => x.isp === 0 && x.ispg === 0 && x.taxSp === 0), 'isp peab olema 0');
}

// 2. Eripension lisandub sissetulekule alates pensioniigast, mitte enne.
const pa = P.retirementYears(base);
const withSp = P.simulate({ ...base, spMonthly: 1000 }, T, E);
assert.strictEqual(row(withSp, pa - 1).ispg, 0);
assert.ok(near(row(withSp, pa).ispg, 1000));
assert.ok(row(withSp, pa).spend > P.simulate(base, T, E).rows.find((x) => x.age === pa).spend - 1e-9);

// 3. Ühine maksustamine: kokku 22% × (riiklik + eripension − maksuvaba tulu), maksuvaba tulu läheb esmalt eripensionile.
for (const sp of [300, 776, 1000, 2500]) {
  const s = P.simulate({ ...base, spMonthly: sp }, T, E), x = row(s, pa);
  const total = TAX * Math.max(0, 1200 + sp - A);
  assert.ok(near(x.tax1 + x.taxSp, total, 1e-6), 'ühine maks sp=' + sp + ': ' + (x.tax1 + x.taxSp) + ' vs ' + total);
  assert.ok(near(x.isp, x.ispg - x.taxSp) && near(x.i1, x.i1g - x.tax1), 'neto = bruto − maks');
}

// 4. Eripension ei sõltu edasilükkamisest (riiklik pension saab +%, eripension mitte).
const d = P.simulate({ ...base, spMonthly: 800 }, T, { id: 'C', deferral: 2, contract: 'yearly' });
assert.ok(near(row(d, pa).ispg, 800) && near(row(d, pa + 5).ispg, 800));
assert.strictEqual(row(d, pa).i1g, 0);
assert.ok(near(row(d, pa + 2).i1g, 1200 * (1 + P.DEFERRAL_INCREASE[2])));

// 5. Rohkem eripensionit ei anna halvemat tulemust (jätkusuutlik kulu kasvab).
assert.ok(P.sustainableNeed({ ...base, spMonthly: 800 }, T, E) > P.sustainableNeed(base, T, E));

// 6. Riikliku pensioni asemel: p1Monthly 0 + eripension on sama mis ainult riiklik pension sama summaga.
const asP1 = P.simulate({ ...base, p1Monthly: 1500, spMonthly: 0 }, T, E), asSp = P.simulate({ ...base, p1Monthly: 0, spMonthly: 1500 }, T, E);
assert.ok(near(row(asP1, pa).i1, row(asSp, pa).isp, 1e-6));
assert.ok(near(row(asP1, pa).spend, row(asSp, pa).spend, 1e-6));
console.log('Eripension OK');
