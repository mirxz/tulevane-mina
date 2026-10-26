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

// Päästeteenistuse seadus (Riigi Teataja 01.10.2026): § 18 suurendus kuni 28.02.2043, § 19 ootetoetus kuni 5 a varem (staaž ≥ 15 a).
{
  const early = { ...base, birthYear: 1975, soodus: 0 }; // pension u 2041 (≤ 2042) → suurendus kehtib
  const s = P.simulate({ ...early, rescueYears: 20 }, T, { id: 'B' }), s0 = P.simulate(early, T, { id: 'B' });
  const r = (x) => x.rows.find((y) => y.age === x.p1StartAge).i1g;
  assert.ok(Math.abs(r(s) / r(s0) - 1.2) < 1e-9, 'päästja 20 a, pension ≤ 2042: +20% (' + r(s).toFixed(1) + ' vs ' + r(s0).toFixed(1) + ')');
  const late = P.simulate({ ...base, soodus: 0, rescueYears: 20 }, T, { id: 'B' });
  assert.ok(Math.abs(late.rows.find((y) => y.age === late.p1StartAge).i1g - 865) <= 1, 'päästja, pension 2056: suurendust pole (§ 18 kehtib kuni 2043)');
  const wait = P.simulate({ ...base, rescueYears: 15 }, T, { id: 'B' });
  assert.strictEqual(wait.p1StartAge, wait.ordinaryPensionAge - 5, 'staaž 15 a: pensioni ootel 5 a varem');
  assert.strictEqual(P.earlyYears({ rescueYears: 14 }), 0, 'staaž 14 a: ootetoetust pole');
  assert.strictEqual(P.rescueIncrease(9), 0); assert.strictEqual(P.rescueIncrease(31), 0.5); assert.strictEqual(P.rescueIncrease(30), 0.4);
  passed += 7;
}
// ATS § 113: ametniku teenistusstaaž (enne 2013) → +10…50%, aastapiirita; päästjal ei liitu (PäästeTS § 18 lg 3).
{
  const r = (x) => x.rows.find((y) => y.age === x.p1StartAge).i1g;
  const c = P.simulate({ ...base, soodus: 0, civilYears: 20 }, T, { id: 'B' }), c0 = P.simulate({ ...base, soodus: 0 }, T, { id: 'B' });
  assert.ok(Math.abs(r(c) / r(c0) - 1.2) < 1e-9, 'ametnik 20 a: +20%');
  const both = P.simulate({ ...base, birthYear: 1975, soodus: 0, civilYears: 30, rescueYears: 12 }, T, { id: 'B' }), b0 = P.simulate({ ...base, birthYear: 1975, soodus: 0 }, T, { id: 'B' });
  assert.ok(Math.abs(r(both) / r(b0) - 1.1) < 1e-9, 'päästja + ametnik: ainult päästja suurendus (+10%)');
  passed += 2;
}
// Ootetoetus või laste eest pension (TLV-105): toetus ei ole pension, laste pensionilisa seda ei suurenda.
{
  const kids = { b2012: 4, earlyUser: 'me', supUser: 'me', inForecast: 'no' }; // 4 last: 3 a varem, lisa 4 × 3,5 aastahinnet
  const fam = { ...base, birthYear: 1975, rescueYears: 20, kids };
  const pa = P.retirementYears(fam), sup = P.childSupplement(fam);
  const i1 = (x, age) => x.rows.find((y) => y.age === age).i1g;
  const mix = P.simulate(fam, T, { id: 'B' }); // vaikimisi: toetus 2 a, siis laste eest pension
  assert.strictEqual(mix.pensionStartAge, pa - 5, 'mix: toetus algab 5 a varem');
  assert.deepStrictEqual([mix.rescueAllowance.from, mix.rescueAllowance.until], [pa - 5, pa - 3], 'mix: toetus kuni laste eest pensionini');
  assert.ok(Math.abs(i1(mix, pa - 3) - i1(mix, pa - 4) - sup * 1.2) < 1e-6, 'mix: laste lisa (× päästja 1,2) alles pensionist');
  const toetus = P.simulate({ ...fam, rescueBasis: 'toetus' }, T, { id: 'B' });
  assert.strictEqual(toetus.rescueAllowance.until, pa, 'toetus: kuni pensionieani');
  assert.ok(Math.abs(i1(toetus, pa - 1) - i1(mix, pa - 4)) < 1e-6 && Math.abs(i1(toetus, pa) - i1(mix, pa)) < 1e-6, 'toetus: lisa alles pensionieas');
  const pens = P.simulate({ ...fam, rescueBasis: 'pension' }, T, { id: 'B' });
  assert.strictEqual(pens.pensionStartAge, pa - 3, 'pension: ainult laste eest 3 a varem');
  assert.strictEqual(pens.rescueAllowance, null);
  // Töötad 2 a kauem (u 12,2 € aastas × päästja 1,2), seega pension on veidi suurem kui mix'i puhul.
  assert.ok(Math.abs(i1(pens, pa - 3) - i1(mix, pa - 3) - 2 * P.workAccrual(4000, true, true) * 1.2) < 1e-6, 'pension: 2 tööaastat rohkem');
  // Laste õigus teisel vanemal: ainult toetus kuni pensionieani.
  const other = P.simulate({ ...fam, kids: { ...kids, earlyUser: 'other' } }, T, { id: 'B' });
  assert.strictEqual(other.rescueAllowance.until, pa, 'laste õigus teisel vanemal: toetus kuni pensionieani');
  passed += 9;
}
console.log('SKA võrdlus: ' + passed + ' kontrolli läbis');
