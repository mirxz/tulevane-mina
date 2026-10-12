// Elukaare (prototüüp 3) mootori testid. Käivita: node tests/elukaar-pohi.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js', { incomeTax: false });

const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const table = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));

const base = { birthYear: 1966, sex: 'N', p1Monthly: 900, p2: 30000, p3: 20000, p3Before2021: true, needMonthly: 1200, realReturn: 0.02 };
const [A, B, C, D] = P.SCENARIOS;
const Cx = { ...C, deferral: 2 };

// Elutabel vastab Statistikaameti 2025 numbritele.
assert.strictEqual(table.elada_jaanud.M[65], 16.33);
assert.strictEqual(table.elada_jaanud.N[65], 21.43);
assert.strictEqual(P.fundPensionTerm(table, 'M', 65), 16);
assert.strictEqual(P.fundPensionTerm(table, 'N', 65), 21);
// Ellujäämine: 65-aastasest mehest elab 81-aastaseks umbes 51%.
assert.ok(Math.abs(P.survival(table, 'M', 65, 81) - 0.51) < 0.01);

// Pensioniiga.
assert.strictEqual(P.pensionAge(1961).label, '65 a');
assert.strictEqual(P.pensionAge(1962).label, '65 a 1 k');
assert.ok(P.pensionAge(1970).label.startsWith('u '));

// Riiklik pension 2 aastat hiljem on 16,88% suurem ja enne seda null.
const c = P.simulate(base, table, Cx);
assert.ok(Math.abs(c.rows.find((x) => x.age === 70).i1 - 900 * 1.1688) < 0.01);
assert.strictEqual(c.rows.find((x) => x.age === 65).i1, 0);

// Väike vajadus: ühe lepinguga (B) lõpeb samba raha perioodi lõpus, igal aastal uuendades (D) mitte.
const small = { ...base, needMonthly: 900 };
const b = P.simulate(small, table, B), d = P.simulate(small, table, D);
assert.ok(b.rows.find((x) => x.age === 85).i23 > 0 && b.rows.find((x) => x.age === 86).i23 === 0, 'B väljamakse lõpeb 86-aastaselt (21 a)');
assert.ok(d.rows.find((x) => x.age === 100).i23 > 0, 'D maksab ka 100-aastaselt');

// Ühine kulureegel: keegi ei kuluta üle vajaduse ega alla nulli.
for (const s of P.SCENARIOS) {
  const r = P.simulate(base, table, s.id === 'C' ? Cx : s);
  assert.ok(r.rows.every((x) => x.spend <= base.needMonthly + 0.01 && x.spend >= 0), s.id);
}

// Jätkusuutlik kulu on katmise piir.
for (const s of [B, D]) {
  const L = P.sustainableNeed(base, table, s);
  const ok = P.simulate(base, table, s, L), over = P.simulate(base, table, s, L + 50);
  assert.ok(ok.coversNeedUntil === null || ok.coversNeedUntil > ok.horizonAge, s.id + ' L katab');
  assert.ok(over.coversNeedUntil !== null && over.coversNeedUntil <= over.horizonAge, s.id + ' L+50 ei kata');
}

// Sissemaksed: II sammas 4% + riigi 4% palgast, III sammas oma kuumakse.
assert.strictEqual(P.yearlyContribution({ grossMonthly: 2000, p2Rate: 0.04, p3Monthly: 100 }), 2000 * 12 * 0.08 + 1200);
assert.strictEqual(P.yearlyContribution({ grossMonthly: 2000, p2Rate: 0, p3Monthly: 0 }), 0);
const withC = P.simulate({ ...base, birthYear: 1970, grossMonthly: 2500, p2Rate: 0.02, p3Monthly: 100 }, table, B);
const noC = P.simulate({ ...base, birthYear: 1970 }, table, B);
assert.ok(withC.expectedLifetime > noC.expectedLifetime, 'sissemaksed suurendavad sissetulekut');
// Pensioniea valik nihutab riikliku pensioni algust.
assert.strictEqual(P.simulate({ ...base, pensionAgeYears: 66 }, table, B).rows.find((x) => x.age === 65).i1, 0);

// Kulud statistikast: üksik 65+ ja paar, kolm taset (kalkulaatoriga samad), kõik kategooriad olemas.
const ks = fs.readFileSync(path.join(__dirname, '../public/data/kulud.js'), 'utf-8');
const kulud = JSON.parse(ks.slice(ks.indexOf('{'), ks.lastIndexOf('}') + 1));
const LV = ['kokkuhoidlik', 'optimaalne', 'mugav'];
assert.ok(kulud.kategooriad.length >= 10 && kulud.kategooriad.every((c) => LV.every((l) => c.uksi[l] >= 0 && c.paar[l] >= 0)));
const total = (hh, l) => kulud.kategooriad.reduce((a, c) => a + c[hh][l], 0);
assert.ok(total('uksi', 'kokkuhoidlik') > 600 && total('uksi', 'kokkuhoidlik') < 1200, 'üksik 65+ kulud mõistlikus vahemikus');
assert.ok(total('uksi', 'kokkuhoidlik') < total('uksi', 'optimaalne') && total('uksi', 'optimaalne') < total('uksi', 'mugav'));
assert.ok(kulud.kategooriad.some((c) => c.nimi.startsWith('Kingitused') && c.uksi.kokkuhoidlik > 0), 'kingitused on kulude sees');

for (const s of P.SCENARIOS) {
  const r = P.simulate(base, table, s.id === 'C' ? Cx : s);
  console.log(s.id, 'katab', r.coversNeedUntil, 'raha lõpeb', r.moneyEndAge, '90a', r.spendAt90.toFixed(0),
    'jätkusuutlik', P.sustainableNeed(base, table, s.id === 'C' ? Cx : s), 'horisont', r.horizonAge, 'E', r.expectedLifetime.toFixed(0));
}
// Varem kõrvale pandud hoius (extraDeposit) lisandub pensioni alguse rahale ja vaikimisi on see 0.
for (const s of [A, B, Cx, D]) {
  const r0 = P.simulate(base, table, s), r1 = P.simulate({ ...base, extraDeposit: 10000 }, table, s);
  assert.ok(Math.abs(r1.rows[0].moneyLeft - r0.rows[0].moneyLeft - 10000) < 0.01);
  assert.ok(r1.expectedLifetime >= r0.expectedLifetime);
}

// Edasilükkamine töötab ka teiste stsenaariumitega (vaikimisi 0, senised tulemused samad).
const a2 = P.simulate(base, table, { ...A, deferral: 2 });
assert.strictEqual(a2.rows.find((x) => x.age === 66).i1, 0);
assert.ok(Math.abs(a2.rows.find((x) => x.age === 70).i1 - 900 * 1.1688) < 0.01);

// Eraldi III sammas: sama väljamakse viis kui II sambal annab sama tulemuse kui ühine pott.
{
  const sepBase = { ...base, p3: 0, p3Sep: { amount: base.p3, mode: 'grow' } };
  const E = { id: 'E' };
  const r0 = P.simulate(base, table, E), r1 = P.simulate(sepBase, table, E);
  assert.ok(Math.abs(r0.expectedLifetime - r1.expectedLifetime) < 1);
  // III korraga välja (10%) läheb hoiusele: pensioni alguses on raha alles sama palju miinus maks.
  const lump = P.simulate({ ...base, p3: 0, p3Sep: { amount: base.p3, mode: 'lump' } }, table, B);
  const startB = P.simulate(base, table, B).rows.find((x) => x.age === 65).moneyLeft;
  assert.ok(lump.rows.find((x) => x.age === 65).moneyLeft < startB);
  // III fondipensionina toob igal aastal sissetulekut.
  const f = P.simulate({ ...base, p3: 0, p3Sep: { amount: base.p3, mode: 'fund' } }, table, A);
  assert.ok(f.rows.find((x) => x.age === 66).i23 > 0);
}

// Paindlik pension (C) ühe lepinguga (Kadi 11.10): fondipension on üks leping nagu B-l, riiklik pension algab edasilükkamise võrra hiljem.
{
  const row = (s, age) => s.rows.find((x) => x.age === age);
  const low = { ...base, needMonthly: 300 }; // väike kulu: näeme lepingu väljamakset, mitte vajaduse katmist
  const once = P.simulate(low, table, { ...C, deferral: 2, contract: 'once' });
  const yearly = P.simulate(low, table, { ...C, deferral: 2, contract: 'yearly' });
  const dflt = P.simulate(low, table, { ...C, deferral: 2 });
  // Vaikimisi (contract puudub) = uus leping igal aastal, nagu enne.
  assert.deepStrictEqual(dflt.rows.map((x) => x.i23), yearly.rows.map((x) => x.i23));
  // Riiklik pension algab 2 aastat hiljem ja on suurem (+16,88%).
  assert.strictEqual(row(once, 66).i1, 0);
  assert.ok(Math.abs(row(once, 67).i1 - 900 * 1.1688) < 0.01);
  // Üks leping: väljamakse järgib fondi väärtust (osakud / veel tegemata väljamaksed, 2% tootlus) lepingu lõpuni (65 + 21 a = 86) ja siis null.
  assert.ok(Math.abs(row(once, 80).i23 / row(once, 70).i23 - 1.02 ** 10) < 1e-9);
  assert.strictEqual(row(once, 86).i23, 0);
  assert.ok(row(yearly, 86).i23 > 0); // uus leping igal aastal ei lõpe
  // 75-aastaselt on ühe lepingu väljamakse suurem kui igaaastasel uuendamisel.
  assert.ok(row(once, 75).i23 > row(yearly, 75).i23);
  // Pensionieas algav ühe lepingu väljamakse (C, ilma edasilükkamiseta samas) on sama mis B-l, kui vajadus seda ei piira.
  const b = P.simulate(low, table, B);
  const c0 = P.simulate(low, table, { ...C, deferral: 0, contract: 'once' });
  assert.ok(Math.abs(row(b, 70).i23 - row(c0, 70).i23) < 0.01);
}

// Eraldi III samba fondipension: üks leping (makse järgib fondi väärtust) või uus leping igal aastal.
{
  const row = (s, age) => s.rows.find((x) => x.age === age);
  const mk = (sep) => P.simulate({ ...base, needMonthly: 300, p3: 0, p3Sep: { amount: 20000, mode: 'fund', ...sep } }, table, { id: 'E' }); // E: II kasvab, i23 on ainult III
  const once = mk({ contract: 'once' }), yearly = mk({ contract: 'yearly' });
  const term = P.fundPensionTerm(table, 'N', 65);
  assert.ok(Math.abs(row(once, 65 + term - 1).i23 / row(once, 66).i23 - 1.02 ** (term - 2)) < 1e-9); // järgib fondi väärtust
  assert.strictEqual(row(once, 65 + term).i23, 0);                              // lõpeb perioodi lõpus
  assert.ok(row(yearly, 65 + term).i23 > 0);                                    // uus leping igal aastal ei lõpe
  assert.deepStrictEqual(mk({}).rows.map((x) => x.i23), yearly.rows.map((x) => x.i23)); // contract puudub = igal aastal
  // III fondipension alates 55: periood loetakse 55-aastasest (30 a) ja lõpeb 85-aastaselt, mitte 86.
  const t55 = P.fundPensionTerm(table, 'N', 55);
  const s55 = mk({ contract: 'once', start: 55 });
  assert.ok(row(s55, 55 + t55 - 1).i23 > 0);
  assert.strictEqual(row(s55, 55 + t55).i23, 0);
  // II ja III on eraldi lepingud: II B (üks leping) + III igal aastal annab teise tulemuse kui mõlemad ühe lepinguga.
  const both = (c3) => P.simulate({ ...base, needMonthly: 300, p3: 0, p3Sep: { amount: 20000, mode: 'fund', contract: c3 } }, table, B);
  assert.notDeepStrictEqual(both('once').rows.map((x) => x.i23), both('yearly').rows.map((x) => x.i23));
}

console.log('OK');
