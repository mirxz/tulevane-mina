// Elukaare (prototüüp 3) mootori stsenaariumitestid: kasv ühe korra, rahavoogude tasakaal, loogika
// ja ristkontroll kalkulaatori mootoriga (samad sisendid → sama tulemus).
// Käivita: node tests/elukaar-stsenaariumid.test.cjs   (mootori asukoha saab anda: ELUKAAR=tee/pension.js)
const fs = require('fs');
const path = require('path');
const E = require('./lib/lae.cjs').lae('public/elukaar/pension.js', { incomeTax: false });
const K = require('./lib/lae.cjs').lae('tests/fixtures/kalkulaator-pension.js');
const load = (f) => { const s = fs.readFileSync(path.join(__dirname, '../public/data/' + f), 'utf-8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); };
const T = load('elutabel.js');

let passed = 0;
const failures = [];
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const row = (s, age) => s.rows.find((x) => x.age === age);
const lasts = (s) => (s.coversNeedUntil === null ? 101 : s.coversNeedUntil);
const SC = { A: { id: 'A' }, B: { id: 'B' }, C: { id: 'C', deferral: 2 }, D: { id: 'D' }, E: { id: 'E' } };

const personas = [];
for (const birthYear of [1956, 1961, 1966, 1971, 1978]) for (const sex of ['N', 'M']) for (const r of [0, 0.02, 0.04])
  for (const [p1, p2, p3, gross, rate, p3m] of [[650, 9000, 0, 1000, 0.02, 0], [900, 30000, 20000, 2000, 0.02, 50], [1150, 90000, 60000, 4500, 0.06, 500]])
    for (const need of [790, 1200, 1800])
      personas.push({ label: [birthYear, sex, r, p1, need].join('/'), input: { birthYear, sex, p1Monthly: p1, p2, p3, p3Before2021: true,
        grossMonthly: gross, p2Rate: rate, p3Monthly: p3m, needMonthly: need, realReturn: r } });

// 1. Vara kasvab pensionieani täpselt ühe korra: (1 + r)^n + sissemaksed aasta lõpus.
for (const { label, input } of personas) {
  const pa = E.retirementYears(input), cur = E.CURRENT_YEAR - input.birthYear;
  if (cur >= pa) continue;
  let ref = input.p2 + input.p3;
  for (let a = cur; a < pa; a++) ref = ref * (1 + input.realReturn) + E.yearlyContribution(input);
  for (const id of ['B', 'C', 'D', 'E']) {
    const s = E.simulate(input, T, SC[id]);
    check(near(row(s, pa).moneyLeft, ref, 0.01), label + '/' + id + ': vara pensionieas ' + row(s, pa).moneyLeft.toFixed(0) + ', õige ' + ref.toFixed(0));
  }
  const a = E.simulate(input, T, SC.A);
  check(near(row(a, pa).moneyLeft, ref * 0.9, 0.01), label + '/A: korraga välja = 90% varast');
}

// 2. Rahavoogude tasakaal pensionieast (tootlus ja hoius 0%): raha muutus = riiklik pension − kulutus − maks, kus 0 ≤ maks ≤ sambast võetu / 9.
for (const { label, input: inp } of personas.filter((p) => p.input.realReturn === 0)) {
  const input = { ...inp, depositReturn: 0 };
  for (const id of Object.keys(SC)) {
    const s = E.simulate(input, T, SC[id]);
    const pa = Math.max(E.retirementYears(input), E.CURRENT_YEAR - input.birthYear);
    let ok = true;
    for (let age = pa; age < 100; age++) {
      const x = row(s, age), y = row(s, age + 1);
      if (!x || !y) continue;
      const tax = x.moneyLeft + x.i1 * 12 - x.spend * 12 - y.moneyLeft;
      if (tax < -0.01 || tax > x.i23 * 12 / 9 + 0.01) { ok = false; check(false, label + '/' + id + ' ' + age + ': maks ' + tax.toFixed(2) + ' väljaspool [0, ' + (x.i23 * 12 / 9).toFixed(2) + ']'); break; }
    }
    if (ok) check(true, '');
    for (const x of s.rows) if (x.moneyLeft < -0.01 || x.shortfall < -0.01) { check(false, label + '/' + id + ': negatiivne raha ' + x.age); break; }
  }
}

// 3. Loogika: parem sisend ei anna halvemat tulemust.
const BETTER = [
  ['II sammas +10 000', (i) => ({ ...i, p2: i.p2 + 10000 })],
  ['III sammas +10 000', (i) => ({ ...i, p3: i.p3 + 10000 })],
  ['riiklik pension +100', (i) => ({ ...i, p1Monthly: i.p1Monthly + 100 })],
  ['tootlus +2%', (i) => ({ ...i, realReturn: i.realReturn + 0.02 })],
  ['palk +1000', (i) => ({ ...i, grossMonthly: i.grossMonthly + 1000 })],
];
for (const { label, input } of personas.filter((_, k) => k % 4 === 0)) {
  for (const id of Object.keys(SC)) {
    const a = E.simulate(input, T, SC[id]), la = E.sustainableNeed(input, T, SC[id]);
    for (const [what, f] of BETTER) {
      const b = E.simulate(f(input), T, SC[id]), lb = E.sustainableNeed(f(input), T, SC[id]);
      check(lasts(b) >= lasts(a), label + '/' + id + ': ' + what + ' ei tohi kulude katmist lühendada');
      check(lb >= la, label + '/' + id + ': ' + what + ' ei tohi jätkusuutlikku kulu vähendada (' + la + ' → ' + lb + ')');
    }
    check(lasts(E.simulate({ ...input, needMonthly: input.needMonthly + 200 }, T, SC[id])) <= lasts(a), label + '/' + id + ': suurem kulu ei tohi katmist pikendada');
  }
  // Kõik korraga ei ole parem kui raha fondi jätmine (sama raha, 10% maks kohe, hoius −1% ≤ fond).
  if (input.realReturn >= 0) check(E.sustainableNeed(input, T, SC.E) >= E.sustainableNeed(input, T, SC.A), label + ': jätkan kasvatamist ≥ kõik korraga');
}

// 4. Ajutine auk: riiklik pension 2 a hiljem ja sillaks vähe raha → katmata enne riiklikku pensioni, pärast seda kaetud.
{
  const s = E.simulate({ birthYear: 1966, sex: 'N', p1Monthly: 1000, p2: 3000, p3: 0, p3Before2021: true, needMonthly: 800, realReturn: 0.02 }, T, SC.C);
  check(s.gapTemporary && s.coversNeedUntil < s.p1StartAge && s.gapEnd === s.p1StartAge - 1, 'ajutine auk enne riiklikku pensioni: ' + s.coversNeedUntil + '–' + s.gapEnd);
}
// 5. Üks leping, kui oled pensioniast vanem: periood praegusest vanusest.
{
  const input = { birthYear: 1956, sex: 'N', p1Monthly: 3000, p2: 21000, p3: 0, p3Before2021: true, needMonthly: 0, realReturn: 0 };
  const s = E.simulate(input, T, SC.B);
  check(near(row(s, 70).i23 * 12, 21000 / E.fundPensionTerm(T, 'N', 70), 0.01), '70-aastasel üks leping 70. eluaasta perioodiga');
}
// 6. Paindlik pension (C): sild on maksuvaba fondipension, mitte ainult 10% maksuga lisaväljamakse.
{
  const input = { birthYear: 1966, sex: 'N', p1Monthly: 900, p2: 30000, p3: 0, p3Before2021: true, needMonthly: 0, realReturn: 0 };
  const s = E.simulate(input, T, SC.C);
  check(row(s, 65).i23 > 0 && row(s, 65).i1 === 0, 'C: pensionieas tuleb fondipension enne riiklikku pensioni');
}

// 6b. Hoius kaotab vaikimisi 1% aastas (sama mis kalkulaatoris).
{
  const input = { birthYear: 1961, sex: 'N', p1Monthly: 0, p2: 10000, p3: 0, p3Before2021: true, needMonthly: 0, realReturn: 0 };
  const s = E.simulate(input, T, SC.A);
  check(near(row(s, 66).moneyLeft, 9000 * 0.99, 0.01), 'hoius −1%: ' + row(s, 66).moneyLeft.toFixed(2));
  const z = E.simulate({ ...input, depositReturn: 0 }, T, SC.A);
  check(near(row(z, 66).moneyLeft, 9000, 0.01), 'hoius 0%, kui nii valitud');
}

// 7. Ristkontroll kalkulaatoriga (kalkulaatori prototüüp 1 on testifikstuur tests/fixtures/kalkulaator-pension.js; Elukaar arvutatakse ilma tulumaksuta,
//    sest kalkulaator tulumaksu ei arvesta). B on teadlik erand, vt allpool: ilma sissemakseteta, hoius vaikimisi −1% mõlemas, töö lõpeb pensionieas → sama tulemus.
//    Elukaar A, B, D, C(+2 a) = kalkulaator lump, fund, renew, renew + riiklik 2 a hiljem.
for (const { label, input } of personas.filter((p) => E.CURRENT_YEAR - p.input.birthYear >= 55)) {
  const pa = E.retirementYears(input);
  const k = { ...input, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, pensionAgeYears: pa, workUntil: pa, tkf: 0, savings: 0, tkfMonthly: 0, care: { on: false } };
  const e = { ...k };
  const kStart = Math.max(pa, K.CURRENT_YEAR - input.birthYear);
  const pairs = [['A', 'lump', 0], ['B', 'fund', 0], ['D', 'renew', 0], ['C', 'renew', 2]];
  for (const [id, m, off] of pairs) {
    // B: Elukaar annab tasase makse (annuiteeditegur, 11.10), kalkulaatori prototüüp 1 jagab veel saldo 1/left-ga ja kasvab positiivse
    // tootlusega. Lepingu lõpuni on need võrdsed ainult 0% juures, seega võrdleme B-d vaid siis.
    if (id === 'B' && input.realReturn !== 0) continue;
    const plan = { stateOffset: off, p2: { method: m, start: kStart }, p3: { method: m, start: kStart } };
    const ks = K.simulate(k, T, plan), es = E.simulate(e, T, SC[id]);
    check(ks.lastsUntil === es.coversNeedUntil, label + '/' + id + ': katmine kalkulaator ' + ks.lastsUntil + ' vs elukaar ' + es.coversNeedUntil);
    const kl = K.sustainableNeed(k, T, plan), el = E.sustainableNeed(e, T, SC[id]);
    check(Math.abs(kl - el) <= 10, label + '/' + id + ': jätkusuutlik kulu kalkulaator ' + kl + ' vs elukaar ' + el);
  }
}

console.log(passed + ' kontrolli läbis, ' + failures.length + ' kukkus läbi.');
if (failures.length) {
  console.log(failures.slice(0, Number(process.env.SHOW || 30)).map((f) => '  ✗ ' + f).join('\n') + (failures.length > 30 ? '\n  … ja veel ' + (failures.length - 30) : ''));
  process.exit(1);
}
