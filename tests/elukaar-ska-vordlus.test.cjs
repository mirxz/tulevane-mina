// Elukaar = Sotsiaalkindlustusameti pensionikalkulaator samade sisenditega (Kadi andmed, SKA iseteenindus 17.10.2026).
// SKA: tootlust ei arvesta (0%), palk püsib, II/III sammas jagatakse u 19,2 aastaga, pensionile 2056. a (29,3 a pärast).
// Elukaar: realReturn 0, jooksva aasta sissemaksed okt–dets (firstYearShare 3/12), fondipensioni periood soost sõltumata (veerg K).
// Lubatud vahe: riiklik pension ±1 €, II ja III sammas ±1,5% (jagaja: Elukaar 19 a, SKA u 19,2 a).
// Käivita: node tests/elukaar-ska-vordlus.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));

// SKA andmed 17.10.2026: II sammas 33 824,99 €, III sammas 47 484,86 €, I samba prognoos 865 €, brutopalk 4000 €.
const base = { birthYear: 1990, sex: 'N', p1Monthly: 865, p2: 33824.99, p3: 0, grossMonthly: 4000, p2Rate: 0.06, p3Monthly: 0,
  needMonthly: 1500, realReturn: 0, depositReturn: 0, firstYearShare: 3 / 12, p3Sep: { amount: 47484.86, mode: 'fund', contract: 'once' } };
const cases = [
  // [nimi, sisendi muutus, stsenaarium, SKA { I, II, III } € kuus]
  ['baas (II 6%, III 0)', {}, { id: 'B' }, { I: 865, II: 757, III: 206 }],
  ['II 2%', { p2Rate: 0.02 }, { id: 'B' }, { I: 865, II: 513, III: 206 }],
  ['II 4%', { p2Rate: 0.04 }, { id: 'B' }, { I: 865, II: 635, III: 206 }],
  ['III 450 € kuus', { p3Monthly: 450 }, { id: 'B' }, { I: 865, II: 757, III: 893 }],
];
let passed = 0;
const rel = (a, b) => Math.abs(a - b) / b;
for (const [name, inp, sc, ska] of cases) {
  const s = P.simulate({ ...base, ...inp }, T, sc);
  const pa = s.pensionStartAge, r = s.rows.find((x) => x.age === pa), p1 = s.rows.find((x) => x.age === s.p1StartAge);
  assert.strictEqual(s.rows.find((x) => x.age === pa).year, 2056, name + ': pensionile 2056. a nagu SKA');
  assert.ok(Math.abs(p1.i1g - ska.I) <= 1, name + ': I sammas ' + p1.i1g.toFixed(1) + ' vs SKA ' + ska.I);
  assert.ok(rel(r.i2, ska.II) <= 0.015, name + ': II sammas ' + r.i2.toFixed(1) + ' vs SKA ' + ska.II);
  assert.ok(rel(r.i3, ska.III) <= 0.015, name + ': III sammas ' + r.i3.toFixed(1) + ' vs SKA ' + ska.III);
  passed += 4;
}

// Paindlik pension 3 a hiljem, töötab edasi: SKA I sammas 1145 € (II ja III algavad SKA-s 2056, Elukaares töö lõppedes).
{
  const s = P.simulate({ ...base, workOn: true, workUntil: 69 }, T, { id: 'C', deferral: 3, contract: 'yearly' });
  const p1 = s.rows.find((x) => x.age === s.p1StartAge);
  assert.ok(Math.abs(p1.i1g - 1145) <= 1, 'paindlik +3 a: I sammas ' + p1.i1g.toFixed(1) + ' vs SKA 1145');
  passed++;
}
// Paindlik pension 3 a varem (vähendus −19,88% eluks ajaks): SKA I sammas 664 € = (865 − 3 × 12,2) × (1 − 19,88%).
{
  const s = P.simulate({ ...base, soodus: 3, flexEarly: 3 }, T, { id: 'B' });
  const p1 = s.rows.find((x) => x.age === s.p1StartAge);
  assert.strictEqual(s.p1StartAge, 63, 'paindlik −3 a: algus 63 a');
  assert.ok(Math.abs(p1.i1g - 664) <= 1, 'paindlik −3 a: I sammas ' + p1.i1g.toFixed(1) + ' vs SKA 664');
  passed += 2;
}
// Laste eest varem (SKA 853 / 829 / 805 €) ja pensionilisa (939 €) on tests/elukaar-lapsed.test.cjs.

console.log('SKA võrdlus: ' + passed + ' kontrolli läbis');
