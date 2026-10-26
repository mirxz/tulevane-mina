// A2-2: elan sammastest (fondipension + vajadusel 10% lisaväljamakse), riiklik pension hiljem (C).
// bestDeferral: suurim edasilükkamine, millega kulud on kaetud elu lõpuni; read eristavad lepingu makset (fp) ja lisaväljamakset (extra).
// Käivita: node tests/elukaar-edasilykkamine.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const covers = (s) => s.coversNeedUntil === null || s.coversNeedUntil > s.horizonAge;
const base = { birthYear: 1966, sex: 'M', p1Monthly: 1000, p2: 40000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 1300, realReturn: 0.02, depositReturn: -0.01, extraDeposit: 0 };

// 1. Read: i2 = fondipension + lisaväljamakse (eraldi III sambata).
const c5 = P.simulate(base, T, { id: 'C', deferral: 5 });
for (const x of c5.rows) assert.ok(near(x.i23, x.fp + x.extra, 1e-6), 'i23 = fp + extra vanuses ' + x.age);
assert.ok(c5.rows.some((x) => x.extra > 0), 'sillaaastatel tehakse lisaväljamakse');

// 2. bestDeferral on järjekindel: tulemus katab, suuremad ei kata.
let found = 0;
for (const need of [900, 1100, 1300, 1500, 1800]) {
  for (const d of [1, 3, 5]) {
    const inp = { ...base, needMonthly: need }, sc = { id: 'C', deferral: d };
    const b = P.bestDeferral(inp, T, sc);
    if (b === null) { for (let k = 0; k <= d; k++) assert.ok(!covers(P.simulate(inp, T, { ...sc, deferral: k })), 'null: ükski ei kata'); continue; }
    assert.ok(b <= d && covers(P.simulate(inp, T, { ...sc, deferral: b })), 'tulemus katab');
    for (let k = b + 1; k <= d; k++) assert.ok(!covers(P.simulate(inp, T, { ...sc, deferral: k })), 'suurem ei kata: ' + k);
    if (b < d) found++;
  }
}
assert.ok(found > 0, 'leidub juhtum, kus väiksem edasilükkamine kannab, aga valitud ei kanna');
console.log('Edasilükkamine (A2-2) OK');
