// Fondipensioni algus pärast pensioniiga (E): „Kasvatan edasi“ kuni valitud vanuseni, siis leping (üks või igal aastal uus).
// scenario.fundFrom (II sammas, B või D) ja p3Sep.start (eraldi III sammas, mode 'fund').
// Käivita: node tests/elukaar-fondipension-algus.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const row = (s, age) => s.rows.find((x) => x.age === age);
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
// Väike vajadus: riiklik pension katab kulud, lisaväljamakseid pole (nii on näha ainult lepingu makse).
const base = { birthYear: 1966, sex: 'N', p1Monthly: 1200, p2: 60000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 500, realReturn: 0.02, depositReturn: 0, extraDeposit: 0 };
const pa = P.retirementYears(base);

// 1. fundFrom puudub või = pensioniiga: sama mis enne.
for (const id of ['B', 'D']) {
  assert.deepStrictEqual(P.simulate(base, T, { id, fundFrom: undefined }).rows, P.simulate(base, T, { id }).rows);
  assert.deepStrictEqual(P.simulate(base, T, { id, fundFrom: pa }).rows, P.simulate(base, T, { id }).rows, id + ': fundFrom = pa');
}

// 2. Leping algab valitud vanusest; enne seda raha kasvab (makseid pole, kui kulud on kaetud).
for (const id of ['B', 'D']) {
  const s = P.simulate(base, T, { id, fundFrom: 70 });
  for (let a = pa; a < 70; a++) assert.strictEqual(row(s, a).i2, 0, id + ': makseid pole vanuses ' + a);
  assert.ok(row(s, 70).i2 > 0, id + ': leping algab 70');
  assert.ok(row(s, 70).moneyLeft > row(P.simulate(base, T, { id }), 70).moneyLeft, id + ': hilisema algusega on 70-aastaselt rohkem raha');
}
// Üks leping: periood määratakse 70-aastaselt (elada jäänud aastad 70-st).
const b = P.simulate(base, T, { id: 'B', fundFrom: 70 }), n70 = P.fundPensionTerm(T, 'N', 70);
assert.ok(near(row(b, 71).i2, row(b, 70).i2 * 1.02, 1e-6), 'makse järgib fondi väärtust (osakud / veel tegemata väljamaksed)');
assert.ok(row(b, 70 + n70 - 1).i2 > 0, 'viimane makse ' + (70 + n70 - 1));
assert.strictEqual(row(b, 70 + n70).i2, 0, 'leping lõpeb ' + (70 + n70));

// 3. Kui kulud pole kaetud, katab vahe enne lepingut lisaväljamakse (nagu „Kasvatan edasi“).
const big = { ...base, needMonthly: 1500 };
const bb = P.simulate(big, T, { id: 'B', fundFrom: 70 });
assert.ok(row(bb, pa).i2 > 0 && row(bb, pa).shortfall === 0, 'enne lepingut lisaväljamakse');

// 4. Eraldi III sammas: fondipension alates sep.start (ka uus leping igal aastal).
for (const contract of ['once', 'yearly']) {
  const s = P.simulate({ ...base, p3Sep: { amount: 30000, mode: 'fund', contract, start: 70 } }, T, { id: 'E' });
  for (let a = pa; a < 70; a++) assert.strictEqual(row(s, a).i3, 0, 'III ' + contract + ': makseid pole ' + a);
  assert.ok(row(s, 70).i3 > 0, 'III ' + contract + ': algab 70');
}
console.log('Fondipensioni algus OK');
