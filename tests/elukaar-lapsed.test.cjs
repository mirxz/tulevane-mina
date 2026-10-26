// Lapsed ja tervist kahjustav töö elukaare mootoris (SKA, kontrollitud 16.10.2026).
// Varem pensionile: 3 last 1 a, 4 last 3 a, 5+ last või puudega laps 5 a; õigust kasutab üks vanem (kirjalik kokkulepe).
// Tervist kahjustav töö (SVPS): nimekiri nr 1 10 a, nimekiri nr 2 5 a varem; eraldi alus, mootor võtab suurema.
// Pensionilisa (vanaduspensionile, mitte eripensionile): enne 1991 sündinud 1,5 aastahinnet, 1991–2012 3,5 aastahinnet,
// 2013+ II samba sissemaksed (ilma II sambata 3,5 aastahinnet). Arvestatakse ainult siis, kui prognoos seda ei sisalda (inForecast 'no').
// Käivita: node tests/elukaar-lapsed.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const row = (s, age) => s.rows.find((x) => x.age === age);
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const base = { birthYear: 1966, sex: 'N', p1Monthly: 900, p2: 30000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0.02, p3Monthly: 0, needMonthly: 1200, realReturn: 0, depositReturn: 0, extraDeposit: 0 };
const pa = P.retirementYears(base);
const K = (o) => ({ ...base, kids: { b1991: 0, b2012: 0, b2013: 0, disabled: false, user: 'me', inForecast: 'no', ...o } });

// 1. Varem pensionile laste järgi; teine vanem kasutab → 0.
for (const [n, y] of [[0, 0], [1, 0], [2, 0], [3, 1], [4, 3], [5, 5], [7, 5]]) assert.strictEqual(P.earlyYears(K({ b2012: n })), y, n + ' last');
assert.strictEqual(P.earlyYears(K({ b2012: 1, disabled: true })), 5, 'puudega laps');
assert.strictEqual(P.earlyYears(K({ b1991: 2, b2013: 2 })), 3, 'sünniaeg ei loe: 4 last');
assert.strictEqual(P.earlyYears(K({ b2012: 5, user: 'other' })), 0, 'teine vanem kasutab');
// 2. Tervist kahjustav töö eraldi; suurem kahest.
assert.strictEqual(P.earlyYears({ ...base, hazard: 'list1' }), 10);
assert.strictEqual(P.earlyYears({ ...base, hazard: 'list2' }), 5);
assert.strictEqual(P.earlyYears({ ...K({ b2012: 3 }), hazard: 'list2' }), 5);
assert.strictEqual(P.earlyYears(base), 0);
// simulate kasutab earlyYears-i, kui soodus pole antud.
assert.strictEqual(P.simulate(K({ b2012: 4 }), T, { id: 'D' }).pensionStartAge, pa - 3);
assert.strictEqual(P.simulate({ ...K({ b2012: 4 }), soodus: 0 }, T, { id: 'D' }).pensionStartAge, pa, 'antud soodus on ülimuslik');

// 3. Pensionilisa kuus.
const A = P.AASTAHINNE;
assert.ok(near(P.childSupplement(K({ b1991: 2 })), 3 * A), 'enne 1991: 1,5 aastahinnet lapse kohta');
assert.ok(near(P.childSupplement(K({ b2012: 2 })), 7 * A), '1991–2012: 3,5 aastahinnet');
assert.ok(near(P.childSupplement(K({ b2013: 2 })), 0), '2013+ II sambaga: sissemaksed II sambasse, lisa pole');
assert.ok(near(P.childSupplement({ ...K({ b2013: 2 }), p2: 0, p2Rate: 0 }), 7 * A), '2013+ ilma II sambata: 3,5 aastahinnet');
assert.strictEqual(P.childSupplement(K({ b2012: 3, user: 'other' })), 0, 'teine vanem kasutab');
// 4. Lisa riiklikule pensionile ainult siis, kui prognoos seda ei sisalda.
const add = P.simulate(K({ b2012: 2 }), T, { id: 'E' }), no = P.simulate(K({ b2012: 2, inForecast: 'yes' }), T, { id: 'E' }), unk = P.simulate(K({ b2012: 2, inForecast: 'unknown' }), T, { id: 'E' });
assert.ok(near(row(add, pa).i1g, 900 + 7 * A), 'lisa arvestatud');
assert.ok(near(row(no, pa).i1g, 900) && near(row(unk, pa).i1g, 900), 'prognoosis juba sees / ei tea: lisa ei arvestata');
assert.deepStrictEqual(add.childSupplement, { monthly: 7 * A, applied: true });
assert.deepStrictEqual(unk.childSupplement, { monthly: 7 * A, applied: false });
// Edasilükkamise kordaja rakendub kogu pensionile, ka lisale (RPKS § 11¹ lg 4).
const d2 = P.simulate(K({ b2012: 2 }), T, { id: 'C', deferral: 2 });
assert.ok(near(row(d2, pa + 2).i1g, (900 + 7 * A) * (1 + P.DEFERRAL_INCREASE[2])));
// 5. Eripension: lisa ainult vanaduspensionile, suurem kahest võrdleb vanaduspension + lisa.
const sp = P.simulate({ ...K({ b2012: 3 }), soodus: 0, spMonthly: 920, spStartAge: 55 }, T, { id: 'E' });
assert.deepStrictEqual(sp.firstPillar.paid, 'oldAge', '900 + lisa > 920');
assert.ok(near(row(sp, pa).i1g, 900 + 10.5 * A));
// 6. Ilma lasteta ja hazard-ita: tulemus muutumatu.
assert.deepStrictEqual(P.simulate({ ...base, kids: { b1991: 0, b2012: 0, b2013: 0, user: 'me', inForecast: 'no' } }, T, { id: 'D' }).rows, P.simulate(base, T, { id: 'D' }).rows);
// 8. Õigused eraldi: varem pensionile ja pensionilisa võivad olla eri vanematel.
assert.strictEqual(P.earlyYears(K({ b2012: 4, earlyUser: 'other', supUser: 'me' })), 0);
assert.ok(near(P.childSupplement(K({ b2012: 4, earlyUser: 'other', supUser: 'me' })), 14 * A));
assert.strictEqual(P.earlyYears(K({ b2012: 4, earlyUser: 'me', supUser: 'other' })), 3);
assert.strictEqual(P.childSupplement(K({ b2012: 4, earlyUser: 'me', supUser: 'other' })), 0);
console.log('Lapsed OK');
// 7. Sugu „muu“ (X): meeste ja naiste elutabeli keskmine.
{
  const e = (sx) => P.fundPensionTerm(T, sx, 65);
  assert.strictEqual(e('X'), Math.max(1, Math.round((T.elada_jaanud.M[65] + T.elada_jaanud.N[65]) / 2)));
  const sx = P.simulate({ ...base, sex: 'X' }, T, { id: 'D' });
  assert.ok(sx.horizonAge >= P.simulate({ ...base, sex: 'M' }, T, { id: 'D' }).horizonAge && sx.horizonAge <= P.simulate({ ...base, sex: 'N' }, T, { id: 'D' }).horizonAge, 'X horisont M ja N vahel');
  console.log('Sugu muu OK');
}
