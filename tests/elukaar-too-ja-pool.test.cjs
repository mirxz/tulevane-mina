// Töötamine pärast pensioniiga (input.workOn, workUntil) ja pool riiklikku pensioni (scenario.half).
// Käivita: node tests/elukaar-too-ja-pool.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const row = (s, a) => s.rows.find((x) => x.age === a);

// Näide: naine 65 a (1961), riiklik 1065,09 €, palk 2500 €, III sammas 38 724 €.
const base = { birthYear: 1961, sex: 'N', p1Monthly: 1065.09, p2: 0, p3: 38724, p3Before2021: true, grossMonthly: 2500, p2Rate: 0, p3Monthly: 500, needMonthly: 1000, realReturn: 0.02, depositReturn: -0.01, extraDeposit: 0 };
const pa = P.retirementYears(base);

// 1. Töötamine pärast pensioniiga: palk katab kulud, sammastest ei võeta, kogu pension on 22% maksuga (maksuvaba kasutab palk).
const w = P.simulate({ ...base, workOn: true, workUntil: pa + 2 }, T, { id: 'D' });
for (const a of [pa, pa + 1]) {
  const x = row(w, a);
  assert.ok(x.work && near(x.spend, 1000) && x.shortfall === 0 && x.i23 === 0, 'töötab ' + a);
  assert.ok(near(x.tax1, 0.22 * x.i1g), 'töö ajal kogu pension 22%: ' + a);
}
const after = row(w, pa + 2);
assert.ok(!after.work && near(after.tax1, 0.22 * Math.max(0, after.i1g - 776)), 'pärast tööd maksuvaba 776 € pensionilt');
// Iga tööaasta tõstab pensioni (RPKS § 25): 2 tööaastat.
assert.ok(near(after.i1g - 1065.09, 2 * P.workAccrual(2500, false, false), 1e-6), 'kaks tööaastat tõstavad pensioni');
// Vaikimisi töö lõpp: 1 aasta pärast pensionile minekut.
const w1 = P.simulate({ ...base, workOn: true }, T, { id: 'D' });
assert.ok(row(w1, pa).work && !row(w1, pa + 1).work, 'vaikimisi töötab 1 aasta');
// workOn: false = nagu enne.
assert.deepStrictEqual(P.simulate({ ...base, workOn: false }, T, { id: 'D' }).rows, P.simulate(base, T, { id: 'D' }).rows);

// 2. Edasilükkamine töö ajal: töö ajal kaotad 78% pensionist (mitte 94%), seega tasub end ära varem kui ilma tööta.
const breakEven = (inp, d) => {
  const a = P.simulate(inp, T, { id: 'D' }), b = P.simulate(inp, T, { id: 'C', deferral: d, contract: 'yearly' });
  let cum = 0;
  for (let i = 0; i < a.rows.length; i++) { cum += b.rows[i].i1 - a.rows[i].i1; if (cum >= 0 && a.rows[i].age > pa + d) return a.rows[i].age; }
  return null;
};
const beWork = breakEven({ ...base, workOn: true, workUntil: pa + 1 }, 1), beRest = breakEven(base, 1);
assert.ok(beWork !== null && beRest !== null && beWork < beRest, 'töötades tasub edasilükkamine end ära varem: ' + beWork + ' vs ' + beRest);

// 3. Pool riiklikku pensioni h aastat: pool pensionieast, siis täis + pool edasilükkamise tõusust.
for (const h of [1, 3, 5]) {
  const s = P.simulate(base, T, { id: 'D', half: h });
  for (let a = pa; a < pa + h; a++) assert.ok(near(row(s, a).i1g, 1065.09 / 2), 'pool ' + h + ' a, vanus ' + a);
  assert.ok(near(row(s, pa + h).i1g, 1065.09 * (1 + P.DEFERRAL_INCREASE[h] / 2)), 'pärast poolt: ' + h);
  // Pool alla 776 € on maksuvaba (ei tööta).
  assert.ok(row(s, pa).tax1 === 0, 'pool pension alla maksuvaba tulu');
}
// Tõus poole pensioni korral on pool täieliku edasilükkamise tõusust (sama pikk aeg).
const full3 = P.simulate(base, T, { id: 'C', deferral: 3, contract: 'yearly' }), half3 = P.simulate(base, T, { id: 'D', half: 3 });
assert.ok(near(row(half3, pa + 3).i1g - 1065.09, (row(full3, pa + 3).i1g - 1065.09) / 2), 'poole tõus on pool');
// Pool + töö: töö ajal on ka pool pension tervenisti 22% maksuga.
const hw = P.simulate({ ...base, workOn: true, workUntil: pa + 1 }, T, { id: 'D', half: 2 });
assert.ok(near(row(hw, pa).tax1, 0.22 * 1065.09 / 2) && row(hw, pa + 1).tax1 === 0, 'pool + töö: maks töö ajal, siis maksuvaba');

// 4. Pool ei kehti koos edasilükkamise, eripensioni ega soodustusega (nagu edasilükkamine).
assert.deepStrictEqual(P.simulate(base, T, { id: 'C', deferral: 2, half: 3 }).rows, P.simulate(base, T, { id: 'C', deferral: 2 }).rows, 'edasilükkamisega pool ei rakendu');
const sp = { ...base, spMonthly: 1500, spStartAge: 55 };
assert.deepStrictEqual(P.simulate(sp, T, { id: 'D', half: 2 }).rows, P.simulate(sp, T, { id: 'D' }).rows, 'eripensioniga pool ei rakendu');
const so = { ...base, soodus: 3 };
assert.deepStrictEqual(P.simulate(so, T, { id: 'D', half: 2 }).rows, P.simulate(so, T, { id: 'D' }).rows, 'soodustusega pool ei rakendu');

// 5. Eripension ja töö pärast pensioniiga: eripension on töö ajal tervenisti 22% maksuga, edasilükkamist ei teki.
const spw = P.simulate({ ...sp, workOn: true, workUntil: pa + 2 }, T, { id: 'D' });
assert.ok(row(spw, pa).work && near(row(spw, pa).taxSp, 0.22 * 1500), 'eripension töö ajal 22%');
assert.ok(near(row(spw, pa + 2).taxSp, 0.22 * (1500 - 776)), 'eripension pärast tööd maksuvabaga');

console.log('Töö pärast pensioniiga ja pool pensioni OK');
