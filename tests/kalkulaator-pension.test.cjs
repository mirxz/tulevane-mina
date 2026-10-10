// Käivita: node tests/kalkulaator-pension.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('tests/fixtures/kalkulaator-pension.js');
const load = (f) => { const s = fs.readFileSync(path.join(__dirname, '../public/data/' + f), 'utf-8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); };
const table = load('elutabel.js');
const kulud = load('kulud.js');

const base = { birthYear: 1966, sex: 'N', pensionAgeYears: 65, p1Monthly: 900, p2: 30000, p3: 20000, tkf: 0, savings: 0,
  p3Before2021: true, grossMonthly: 2000, p2Rate: 0.02, p3Monthly: 0, tkfMonthly: 0, workUntil: 65,
  needMonthly: 1200, realReturn: 0.02, depositReturn: -0.01, care: { on: false } };
const plan = (m2, m3, offset = 0, s2 = 65, s3 = 65) => ({ stateOffset: offset, p2: { method: m2, start: s2 }, p3: { method: m3, start: s3 } });

// Statistikaamet 2025.
assert.strictEqual(table.elada_jaanud.M[65], 16.33);
assert.strictEqual(table.elada_jaanud.N[65], 21.43);
assert.ok(Math.abs(P.survival(table, 'M', 65, 81) - 0.51) < 0.01);

// Riiklik pension: varem −7,17% (1 a), hiljem +16,88% (2 a), algab õigel ajal.
const early = P.simulate(base, table, plan('renew', 'renew', -1));
assert.ok(Math.abs(early.rows.find((x) => x.age === 64).i1 - 900 * (1 - 0.0717)) < 0.01);
const late = P.simulate(base, table, plan('renew', 'renew', 2));
assert.strictEqual(late.rows.find((x) => x.age === 66).i1, 0);
assert.ok(Math.abs(late.rows.find((x) => x.age === 67).i1 - 900 * 1.1688) < 0.01);

// Põhimõte 1: II samba esimene väljamakse lõpetab riigi toe. Töötad 68-ni: kui alustad II sambast 65-aastaselt, kaob 3 aasta 4%.
const w = { ...base, workUntil: 68 };
const startEarly = P.simulate(w, table, plan('renew', 'keep', 0, 65, 65));
const startLate = P.simulate(w, table, plan('renew', 'keep', 0, 68, 65));
assert.strictEqual(startEarly.iiStoppedAge, 65);
assert.ok(startLate.stateSupport - startEarly.stateSupport > 2000 * 12 * 0.04 * 1.9, 'riigi tugi kaob');

// Põhimõte 2: korraga välja võetud raha hoiusel kaotab väärtust (negatiivne reaaltootlus).
const lump = P.simulate({ ...base, needMonthly: 900 }, table, plan('lump', 'lump'));
const keep = P.simulate({ ...base, needMonthly: 900 }, table, plan('keep', 'keep'));
const at75 = (s) => s.rows.find((x) => x.age === 75).moneyLeft;
assert.ok(at75(lump) < at75(keep) * 0.75, 'hoius sööb: ' + at75(lump).toFixed(0) + ' vs ' + at75(keep).toFixed(0));
assert.ok(lump.tax90 > 0);

// Põhimõte 3: III samba sissemakse annab 22% tagasi.
const ref = P.simulate({ ...base, birthYear: 1970, p3Monthly: 100 }, table, plan('renew', 'renew'));
assert.ok(ref.refundTotal > 0 && Math.abs(ref.refundTotal - 1200 * 0.22 * (65 - 56)) < 1);

// Põhimõte 4: iga-aastane uuendamine ei jõua nulli, üks leping jõuab.
const small = { ...base, needMonthly: 900 };
const one = P.simulate(small, table, plan('fund', 'fund'));
const ren = P.simulate(small, table, plan('renew', 'renew'));
assert.strictEqual(one.rows.find((x) => x.age === 86).i23, 0);
assert.ok(ren.rows.find((x) => x.age === 100).i23 > 0);

// Kulureegel: keegi ei kuluta üle vajaduse, kulutused ja puudujääk liituvad vajaduseks.
for (const pr of P.presets(base)) {
  const s = P.simulate(base, table, pr);
  for (const x of s.rows.filter((y) => !y.working)) {
    assert.ok(x.i1 + x.i23 + x.sav + x.shortfall <= x.need + 0.01 || x.i1 + x.i23 > x.need, pr.id + ' ' + x.age);
  }
}

// Jätkusuutlik kulu on katmise piir.
const pc = plan('renew', 'renew');
const L = P.sustainableNeed(base, table, pc);
const ok = P.simulate(base, table, pc, L), over = P.simulate(base, table, pc, L + 50);
assert.ok(ok.lastsUntil === null || ok.lastsUntil > ok.horizonAge);
assert.ok(over.lastsUntil !== null && over.lastsUntil <= over.horizonAge);

// Hooldekodu suurendab vajadust alates määratud vanusest.
const care = { ...base, care: { on: true, fromAge: 85, monthly: 1000, replaces: 400 } };
assert.strictEqual(P.needAt(care, 84), 1200);
assert.strictEqual(P.needAt(care, 85), 1800);

// Kulud: kolm taset, kasvav järjekord.
const sum = (lvl) => kulud.kategooriad.reduce((a, c) => a + c.uksi[lvl], 0);
assert.ok(sum('kokkuhoidlik') < sum('optimaalne') && sum('optimaalne') < sum('mugav'));

for (const pr of P.presets(base)) {
  const s = P.simulate(base, table, pr);
  console.log(pr.id, 'jätkub', s.lastsUntil, '90a kuus', s.spendAt90.toFixed(0), 'pärand90', s.inheritance90.toFixed(0), 'maks', s.tax90.toFixed(0), 'jätkusuutlik', P.sustainableNeed(base, table, pr));
}
console.log('OK');
