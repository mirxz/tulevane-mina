// Eripension elukaare mootoris (TLV-69). Reeglid:
// 1) eripension algab kasutaja valitud vanusest (spStartAge, vaikimisi pensioniiga);
// 2) pensionieas makstakse ainult üks I samba pension: suurem kahest (eripension või vanaduspension), RPKS;
// 3) paindliku pensioni valikud (edasilükkamine) eripensionile ei kehti;
// 4) II ja III samba vanusepiirid on samad mis kõigil.
// Käivita: node tests/elukaar-eripension.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');
const src = fs.readFileSync(path.join(__dirname, '../public/data/elutabel.js'), 'utf-8');
const T = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const row = (s, age) => s.rows.find((x) => x.age === age);
const base = { birthYear: 1976, sex: 'M', p1Monthly: 1200, p2: 50000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 1500, realReturn: 0, depositReturn: 0, extraDeposit: 0 };
const E = { id: 'E' };
const A = P.PENSIONER_ALLOWANCE / 12, G = P.GENERAL_ALLOWANCE / 12, TAX = P.INCOME_TAX;
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const pa = P.retirementYears(base);

// 1. Ilma eripensionita (0 või puudub) on tulemus täpselt sama.
for (const id of ['A', 'B', 'C', 'D', 'E']) {
  const sc = { id, deferral: id === 'C' ? 2 : 0 };
  const a = P.simulate(base, T, sc), b = P.simulate({ ...base, spMonthly: 0, spStartAge: 50 }, T, sc);
  assert.deepStrictEqual(a.rows.map((x) => x.i1 + x.i23 + x.dep), b.rows.map((x) => x.i1 + x.i23 + x.dep));
  assert.ok(a.rows.every((x) => x.isp === 0 && x.ispg === 0 && x.taxSp === 0), 'isp peab olema 0');
}

// 2. Algusvanus: vaikimisi pensioniiga; valitud vanusest alates, mitte enne.
const dflt = P.simulate({ ...base, spMonthly: 1500 }, T, E);
assert.strictEqual(row(dflt, pa - 1).ispg, 0, 'vaikimisi ei alga enne pensioniiga');
assert.ok(near(row(dflt, pa).ispg, 1500));
const early = P.simulate({ ...base, spMonthly: 1500, spStartAge: 58 }, T, E);
assert.strictEqual(row(early, 57).ispg, 0, 'enne algusvanust eripensioni pole');
for (const a of [58, 60, pa - 1, pa, pa + 10]) assert.ok(near(row(early, a).ispg, 1500), 'eripension vanuses ' + a);
// Enne pensioniiga on eripension sissetulek, aga vajaduse katmist (ja puudujääki) mudel arvestab alles pensioniast.
assert.ok(near(row(early, 60).spend, row(early, 60).isp) && row(early, 60).shortfall === 0);
// Enne pensioniiga: üldine maksuvaba tulu (kui ei tööta), pensionieas pensionäri oma.
assert.ok(near(row(early, 60).taxSp, TAX * Math.max(0, 1500 - G)), 'maks enne pensioniiga');
const working = P.simulate({ ...base, grossMonthly: 2000, spMonthly: 1500, spStartAge: 58 }, T, E);
assert.ok(near(row(working, 60).taxSp, TAX * 1500), 'töötades kasutab palk üldise maksuvaba tulu');
// Samba väljamaksed ja vara: eripension enne pensioniiga ei muuda sammast.
assert.ok(near(row(early, pa).moneyLeft, row(dflt, pa).moneyLeft, 1e-6));

// 2b. Töö eripensioni ajal (infograafik: „eripension algab: töötad edasi muul kutsealal?“).
// Töötad edasi: palk + eripension, II sambasse laekub palgalt edasi. Ei tööta: II samba sissemaksed lõpevad algusvanusest, III sambasse saad ise maksta.
const job = { ...base, grossMonthly: 2000, p2Rate: 0.04, p3Monthly: 50, spMonthly: 1500, spStartAge: 58 };
const work = P.simulate({ ...job, spWork: true }, T, E), stop = P.simulate({ ...job, spWork: false }, T, E);
assert.ok(near(row(work, pa).moneyLeft - row(stop, pa).moneyLeft, 2000 * 12 * 0.08 * (pa - 58), 1e-6), 'II samba sissemaksed lõpevad 58-st');
assert.deepStrictEqual(P.simulate({ ...job }, T, E).rows, work.rows, 'vaikimisi töötad edasi');
assert.ok(near(P.yearlyContribution({ ...job, spWork: false }, 57), 2000 * 12 * 0.08 + 600) && near(P.yearlyContribution({ ...job, spWork: false }, 58), 600), 'III samba oma sissemakse jätkub');
assert.ok(near(P.yearlyContribution(job), 2000 * 12 * 0.08 + 600), 'ilma vanuseta nagu varem');
assert.ok(near(row(stop, 60).taxSp, TAX * Math.max(0, 1500 - G)), 'ei tööta: üldine maksuvaba tulu eripensionile');
assert.ok(near(row(work, 60).taxSp, TAX * 1500), 'töötad: maksuvaba tulu kasutab palk');
// Uus palk eripensioni ajal (spGross): II samba sissemakse algusvanusest uue palga järgi.
const newPay = P.simulate({ ...job, spWork: true, spGross: 1200 }, T, E);
assert.ok(near(row(work, pa).moneyLeft - row(newPay, pa).moneyLeft, (2000 - 1200) * 12 * 0.08 * (pa - 58), 1e-6), 'uus palk 58-st');
assert.ok(near(P.yearlyContribution({ ...job, spGross: 1200 }, 57), 2000 * 12 * 0.08 + 600) && near(P.yearlyContribution({ ...job, spGross: 1200 }, 58), 1200 * 12 * 0.08 + 600), 'uus palk algusvanusest');
assert.deepStrictEqual(P.simulate({ ...job, spWork: false, spGross: 1200 }, T, E).rows, stop.rows, 'ei tööta: uus palk ei loe');
// Noor arvutaja: eripension 40-st, uus palk muudab II sammast 25 aastat.
const young = { ...job, birthYear: 1990, spStartAge: 40 }, pay = P.retirementYears(young);
assert.ok(near(row(P.simulate(young, T, E), pay).moneyLeft - row(P.simulate({ ...young, spGross: 1200 }, T, E), pay).moneyLeft, 800 * 12 * 0.08 * (pay - 40), 1e-6), 'noor: uus palk 40-st');
// Ilma eripensionita ei muuda spWork midagi.
assert.deepStrictEqual(P.simulate({ ...job, spMonthly: 0, spWork: false }, T, E).rows, P.simulate({ ...job, spMonthly: 0 }, T, E).rows);

// 3. Suurem kahest pensionieas: ainult üks I samba rida.
for (const [sp, p1] of [[1500, 1200], [800, 1200], [1200, 1200], [1000, 0]]) {
  const s = P.simulate({ ...base, p1Monthly: p1, spMonthly: sp, spStartAge: 55 }, T, E);
  for (const a of [pa, pa + 1, 90]) {
    const x = row(s, a);
    assert.ok(x.ispg === 0 || x.i1g === 0, 'korraga ainult üks: sp=' + sp + ' p1=' + p1);
    assert.ok(near(x.ispg + x.i1g, Math.max(sp, p1)), 'suurem kahest: sp=' + sp + ' p1=' + p1);
    // Võrdse summa korral jätkub eripension (uut rida ei teki).
    if (sp >= p1) assert.ok(near(x.ispg, sp)); else assert.ok(near(x.i1g, p1));
    // Maks pensionieas: üks maksuvaba tulu (776 €).
    assert.ok(near(x.tax1 + x.taxSp, TAX * Math.max(0, Math.max(sp, p1) - A)), 'maks sp=' + sp + ' p1=' + p1);
    assert.ok(near(x.isp, x.ispg - x.taxSp) && near(x.i1, x.i1g - x.tax1), 'neto = bruto − maks');
  }
}
// Kokkuvõttes on eripensioni ja riikliku pensioni võrdlus.
const cmp = P.simulate({ ...base, p1Monthly: 1200, spMonthly: 800, spStartAge: 55 }, T, E);
assert.deepStrictEqual(cmp.firstPillar, { special: 800, oldAge: 1200, paid: 'oldAge' });
assert.strictEqual(P.simulate(base, T, E).firstPillar, null);

// 4. Edasilükkamine ei kehti: C koos edasilükkamisega arvutab nagu ilma (riiklik pension algab pensioniast, ilma +%-ta).
for (const contract of ['yearly', 'once']) {
  const inp = { ...base, p1Monthly: 1200, spMonthly: 800 };
  const d = P.simulate(inp, T, { id: 'C', deferral: 2, contract });
  const n = P.simulate(inp, T, { id: 'C', deferral: 0, contract });
  assert.deepStrictEqual(d.rows, n.rows, 'edasilükkamine eripensioniga: ' + contract);
  assert.strictEqual(d.p1StartAge, pa);
  assert.ok(near(row(d, pa).i1g, 1200), 'riiklik pension ilma edasilükkamise lisata');
}

// 5. Valikud: options(input) ütleb, mis on lukus ja miks.
const o0 = P.options(base), o1 = P.options({ ...base, spMonthly: 800 });
assert.strictEqual(o0.deferral.open, true);
assert.strictEqual(o1.deferral.open, false);
assert.ok(/eripension/i.test(o1.deferral.reason), 'lukustuse põhjus mainib eripensioni');
// „Eripension: jah“ lukustab ka enne summa sisestamist.
assert.strictEqual(P.options({ ...base, spHas: true, spMonthly: 0 }).deferral.open, false);
assert.strictEqual(P.options({ ...base, spHas: false }).deferral.open, true);
// II ja III samba valikud ei sõltu eripensionist.
assert.deepStrictEqual(o1.p2, o0.p2);
assert.deepStrictEqual(o1.p3, o0.p3);

// 6. Rohkem eripensionit ei anna halvemat tulemust; alla vanaduspensioni ei muuda midagi.
assert.ok(P.sustainableNeed({ ...base, spMonthly: 1500 }, T, E) > P.sustainableNeed(base, T, E));
assert.ok(P.sustainableNeed({ ...base, spMonthly: 1500, spStartAge: 58 }, T, E) >= P.sustainableNeed({ ...base, spMonthly: 1500 }, T, E));
assert.strictEqual(P.sustainableNeed({ ...base, spMonthly: 800 }, T, E), P.sustainableNeed(base, T, E));

// 7. Riikliku pensioni asemel: p1Monthly 0 + eripension on sama mis ainult riiklik pension sama summaga.
const asP1 = P.simulate({ ...base, p1Monthly: 1500, spMonthly: 0 }, T, E), asSp = P.simulate({ ...base, p1Monthly: 0, spMonthly: 1500 }, T, E);
assert.ok(near(row(asP1, pa).i1, row(asSp, pa).isp, 1e-6));
assert.ok(near(row(asP1, pa).spend, row(asSp, pa).spend, 1e-6));
console.log('Eripension OK');
