// II samba varane väljavõtt (KoPS § 43¹, alates 01.11.2026). Käivita: node tests/elukaar-ii-varane.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));

const base = { birthYear: 1976, sex: 'N', p1Monthly: 900, p2: 30000, p3: 0, grossMonthly: 2500, p2Rate: 0.02, needMonthly: 1200, realReturn: 0.02 };
const A = P.SCENARIOS[0];
const left70 = (i) => P.simulate(i, T, A).rows.find((x) => x.age === 70).moneyLeft;
const age = P.CURRENT_YEAR - base.birthYear;

// Ilma valikuta midagi ei muutu.
assert.strictEqual(P.simulate(base, T, A).p2Early, null);

// Väljavõtt: 22% tulumaks, kogu II sammas korraga.
const e = P.simulate({ ...base, p2Early: { age, save: false } }, T, A).p2Early;
assert.strictEqual(e.age, age);
assert.ok(Math.abs(e.gross - 30000) < 1, 'vanusel = praegune vanus on pott tänane summa');
assert.ok(Math.abs(e.tax - 0.22 * e.gross) < 0.01);
assert.ok(Math.abs(e.net - 0.78 * e.gross) < 0.01);

// Ilma tulumaksuta (incomeTax:false) maksu ei ole.
assert.strictEqual(P.simulate({ ...base, incomeTax: false, p2Early: { age } }, T, A).p2Early.tax, 0);

// Hilisem väljavõtt: pott on kasvanud ja sissemaksed sees.
const later = P.simulate({ ...base, p2Early: { age: age + 5 } }, T, A).p2Early;
assert.ok(later.gross > e.gross * 1.1, 'viie aasta pärast on pott suurem');

// Pensionile jääb vähem: II sammas on tühi ja sissemaksed lõppenud.
const none = left70(base), spend = left70({ ...base, p2Early: { age } });
assert.ok(spend < none, 'raha kulutatud, pensionile jääb vähem');
// Hoiusele pandud raha jääb pensionile, kuid vähem kui sambas kasvanud (22% maks + hoiuse tootlus alla fondi).
const save = left70({ ...base, p2Early: { age, save: true } });
assert.ok(save > spend && save < none);
// Uuesti liitumine 5 a pärast tõstab pensionile jäävat raha.
assert.ok(left70({ ...base, p2Early: { age, rejoin: true } }) > spend);
// Uuesti liitumine enne aega pole võimalik: samal aastal ja 4 a pärast sissemakseid ei ole (võrdlus: liitumine = ainult hilisemad aastad).
const noRejoin = P.simulate({ ...base, p2Early: { age } }, T, A), rejoin = P.simulate({ ...base, p2Early: { age, rejoin: true } }, T, A);
assert.ok(rejoin.rows[rejoin.rows.length - 1].moneyLeft >= noRejoin.rows[noRejoin.rows.length - 1].moneyLeft);

// Vanus väljaspool vahemikku (minevik või pensioniea − 5 järel) ei tee midagi.
assert.strictEqual(P.simulate({ ...base, p2Early: { age: age - 1 } }, T, A).p2Early, null);
assert.strictEqual(P.simulate({ ...base, p2Early: { age: P.retirementYears(base) - 5 } }, T, A).p2Early, null);

// III sammas jätkab: sissemaksed III sambasse ei lõpe (eraldi pott p3Sep).
const withP3 = { ...base, p3: 0, p3Monthly: 100, p3Has: true, p3Sep: { amount: 10000, mode: 'grow' } };
const w = P.simulate({ ...withP3, p2Early: { age, save: false } }, T, P.SCENARIOS[0]);
assert.ok(w.p2Early.gross < 31000, 'III sammas ei satu II samba väljavõttesse');
assert.ok(left70({ ...withP3, p2Early: { age } }) > left70({ ...base, p2Early: { age } }), 'III sammas annab pensionile lisaks raha');

console.log('II samba varane väljavõtt OK');
