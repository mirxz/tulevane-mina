// Soodustingimustel vanaduspension elukaare mootoris (lapsed, tervist kahjustav töö). Reeglid:
// 1) soodustus (input.soodus aastates) muudab ainult riikliku pensioni algust; tavaline pensioniiga jääb samaks;
// 2) II sammas avaneb ikka 5 a enne tavalist pensioniiga (Pensionikeskus, kontrollitud 15.10.2026);
// 3) kuni tavalise pensionieani üldine maksuvaba tulu 700 €, alates pensioniast 776 € (EMTA, kontrollitud 15.10.2026);
// 4) soodustusega riiklikku pensioni edasi ei lükata;
// 5) pensionile minnes lõpevad palgalt sissemaksed (töötamine soodustusega pensioni ajal tuleb eraldi).
// Käivita: node tests/elukaar-soodus.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const row = (s, age) => s.rows.find((x) => x.age === age);
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const base = { birthYear: 1976, sex: 'N', p1Monthly: 1200, p2: 50000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 1500, realReturn: 0, depositReturn: 0, extraDeposit: 0 };
const TAX = P.INCOME_TAX, A = P.PENSIONER_ALLOWANCE / 12, G = P.GENERAL_ALLOWANCE / 12;
const pa = P.retirementYears(base);
const ids = ['A', 'B', 'C', 'D', 'E'];

// 1. Soodustus 0 (või puudub) ei muuda midagi.
for (const id of ids) {
  const sc = { id, deferral: id === 'C' ? 2 : 0 };
  assert.deepStrictEqual(P.simulate({ ...base, soodus: 0 }, T, sc).rows, P.simulate(base, T, sc).rows, 'soodus 0: ' + id);
}

// 2. Riiklik pension algab varem, tavaline pensioniiga jääb samaks.
const s3 = P.simulate({ ...base, soodus: 3 }, T, { id: 'D' });
assert.strictEqual(s3.p1StartAge, pa - 3);
assert.strictEqual(s3.pensionStartAge, pa - 3, 'pensionipõlv algab soodustusega');
assert.strictEqual(s3.ordinaryPensionAge, pa, 'tavaline pensioniiga jääb');
assert.strictEqual(row(s3, pa - 4).i1g, 0);
assert.ok(near(row(s3, pa - 3).i1g, 1200), 'pension ei vähene');
assert.ok(row(s3, pa - 3).spend > 0 && row(s3, pa - 4).spend === 0, 'kulud algavad soodustusega');
assert.strictEqual(P.retirementYears({ ...base, soodus: 3 }), pa, 'retirementYears on tavaline pensioniiga');

// 3. Maksuvaba tulu: enne tavalist pensioniiga 700 €, alates sellest 776 €.
assert.ok(near(row(s3, pa - 3).tax1, TAX * Math.max(0, 1200 - G)), 'enne pensioniiga 700 €');
assert.ok(near(row(s3, pa - 1).tax1, TAX * Math.max(0, 1200 - G)));
assert.ok(near(row(s3, pa).tax1, TAX * Math.max(0, 1200 - A)), 'pensionieas 776 €');

// 4. II sammas avaneb 5 a enne tavalist pensioniiga, mitte soodustusega varem.
const s10 = { ...base, soodus: 10, p3: 0 };
for (const id of ['B', 'D', 'E']) {
  const s = P.simulate(s10, T, { id });
  for (let a = pa - 10; a < pa - 5; a++) assert.strictEqual(row(s, a).i2, 0, id + ': II sammas lukus vanuses ' + a);
  assert.ok(row(s, pa - 5).i2 > 0, id + ': II sammas avaneb ' + (pa - 5));
}
// Ühekordne väljamakse (A) tehakse siis, kui II sammas avaneb.
const a10 = P.simulate(s10, T, { id: 'A' });
for (let a = pa - 10; a < pa - 5; a++) assert.strictEqual(row(a10, a).dep, 0, 'A: hoiuses pole enne avanemist raha');
assert.ok(row(a10, pa - 5).dep > 0);
// Eraldi III sammas: avaneb 55 (enne 2021) või 60.
const sep = { ...s10, p3Sep: { amount: 20000, mode: 'fund', contract: 'yearly' }, p3Before2021: false };
const s3sep = P.simulate(sep, T, { id: 'E' });
for (let a = pa - 10; a < 60; a++) assert.strictEqual(row(s3sep, a).i3, 0, 'III sammas (2021+) lukus vanuses ' + a);
assert.ok(row(s3sep, 60).i3 > 0);
// 5 a soodustusega avanevad II sammas ja pension samal aastal.
const s5 = P.simulate({ ...base, soodus: 5 }, T, { id: 'D' });
assert.ok(row(s5, pa - 5).i2 > 0 && row(s5, pa - 5).i1g > 0);

// 5. Edasilükkamine ei kehti.
assert.strictEqual(P.options({ ...base, soodus: 3 }).deferral.open, false);
assert.ok(/soodus/i.test(P.options({ ...base, soodus: 3 }).deferral.reason));
assert.strictEqual(P.options(base).deferral.open, true);
const c = P.simulate({ ...base, soodus: 3 }, T, { id: 'C', deferral: 2 }), c0 = P.simulate({ ...base, soodus: 3 }, T, { id: 'C', deferral: 0 });
assert.deepStrictEqual(c.rows, c0.rows);

// 6. Sissemaksed lõpevad pensionile minnes (r = 0: pott = summa + sissemaksed kuni soodustusega pensionini).
const job = { ...base, grossMonthly: 2000, p2Rate: 0.04 };
const cA = P.simulate({ ...job, soodus: 3 }, T, { id: 'E' });
assert.ok(near(row(cA, pa - 3).moneyLeft, 50000 + 2000 * 12 * 0.08 * (pa - 3 - 50)), 'sissemaksed kuni ' + (pa - 3));

// 7. Eripension ja soodustus: suurem kahest alates riikliku pensioni algusest.
const sp = P.simulate({ ...base, soodus: 3, spMonthly: 800, spStartAge: 55 }, T, { id: 'E' });
assert.ok(near(row(sp, pa - 4).ispg, 800) && row(sp, pa - 4).i1g === 0);
assert.ok(near(row(sp, pa - 3).i1g, 1200) && row(sp, pa - 3).ispg === 0, 'soodustusega vanaduspension suurem: vahetub ' + (pa - 3));

// 9. Töötamine soodustusega pensioni ajal (D): soodusWork, workUntil (vaikimisi tavaline pensioniiga).
// Palk katab kulud, riiklik pension läheb hoiusele, II ja III sissemaksed jätkuvad, samba väljamaksed algavad töö lõppedes.
// Iga tööaasta tõstab riiklikku pensioni järgmisest aastast (RPKS § 25): workAccrual(palk).
const wk = { ...job, soodus: 3, soodusWork: true };
const w = P.simulate(wk, T, { id: 'D' }), acc = P.workAccrual(2000, true, true);
for (let a = pa - 3; a < pa; a++) {
  const x = row(w, a);
  assert.ok(x.work === true && near(x.spend, 1500) && x.shortfall === 0 && x.i2 === 0, 'töötab ' + a);
  assert.ok(near(x.tax1, TAX * x.i1g), 'töötades kasutab üldise maksuvaba tulu palk: ' + a);
}
assert.ok(near(row(w, pa - 3).i1g, 1200) && near(row(w, pa - 2).i1g, 1200 + acc) && near(row(w, pa).i1g, 1200 + 3 * acc), 'pension tõuseb tööaastatega');
assert.ok(row(w, pa).work === false && row(w, pa).i2 > 0, 'väljamaksed algavad töö lõppedes');
const fundAtPa = row(w, pa).moneyLeft, saved = [pa - 3, pa - 2, pa - 1].reduce((t, a) => t + row(w, a).i1 * 12, 0);
assert.ok(near(fundAtPa, 50000 + 2000 * 12 * 0.08 * (pa - 50) + saved, 1e-6), 'pott + hoius = sissemaksed + säästetud pension: ' + fundAtPa);
// Töö lõpp valitav; tööta (soodusWork false) nagu enne.
const w1 = P.simulate({ ...wk, workUntil: pa - 2 }, T, { id: 'D' });
assert.ok(row(w1, pa - 3).work && !row(w1, pa - 2).work && row(w1, pa - 2).shortfall === 0);
assert.deepStrictEqual(P.simulate({ ...job, soodus: 3, soodusWork: false }, T, { id: 'D' }).rows, P.simulate({ ...job, soodus: 3 }, T, { id: 'D' }).rows);
// Ilma soodustuseta ei muuda soodusWork midagi.
assert.deepStrictEqual(P.simulate({ ...job, soodusWork: true }, T, { id: 'D' }).rows, P.simulate(job, T, { id: 'D' }).rows);

// 10. Ei tööta: III samba sissemakse pärast pensionile minekut (p3After, vaikimisi sama mis p3Monthly) kuni tavalise pensionieani.
// Kui pension katab kulud, liigub sissemakse ülejäägist III sambasse: kulud samad, tootlusega rohkem raha kui hoiusel.
const p3 = { ...job, soodus: 3, p3Monthly: 100, needMonthly: 500 };
const same = P.simulate(p3, T, { id: 'E' }), stop3 = P.simulate({ ...p3, p3After: 0 }, T, { id: 'E' });
for (let a = pa - 3; a < pa; a++) assert.ok(near(row(same, a).spend, 500) && near(row(stop3, a).spend, 500), 'kulud katab pension: ' + a);
assert.ok(near(row(same, pa).moneyLeft, row(stop3, pa).moneyLeft, 1e-6), 'r = 0: sissemakse on ülekanne hoiuselt III sambasse');
const sameR = P.simulate({ ...p3, realReturn: 0.02, depositReturn: -0.01 }, T, { id: 'E' }), stopR = P.simulate({ ...p3, p3After: 0, realReturn: 0.02, depositReturn: -0.01 }, T, { id: 'E' });
assert.ok(row(sameR, pa).moneyLeft > row(stopR, pa).moneyLeft, 'tootlusega on III sissemakse parem kui hoius');
assert.deepStrictEqual(P.simulate({ ...job, soodus: 3, p3Monthly: 0 }, T, { id: 'E' }).rows, P.simulate({ ...job, soodus: 3, p3Monthly: 0, p3After: 0 }, T, { id: 'E' }).rows);

// 8. Rahavoog ei lähe negatiivseks.
for (const id of ids) {
  const s = P.simulate({ ...job, soodus: 3, realReturn: 0.02 }, T, { id, deferral: 0 });
  for (const x of s.rows) assert.ok(x.spend >= -1e-9 && x.shortfall >= -1e-9, 'negatiivne rahavoog ' + id + ' ' + x.age);
}
console.log('Soodustus OK');
