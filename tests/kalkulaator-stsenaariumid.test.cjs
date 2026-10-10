// Arvutuste stsenaariumitestid: käsitsi arvutatud juhtumid, rahavoogude tasakaal ja loogikakontrollid
// eri sissetuleku, vanuse, soo, töötamise, kulude ja strateegiate kombinatsioonidel.
// Käivita: node tests/kalkulaator-stsenaariumid.test.cjs   (lisa --table, et näha personade tulemuste tabelit)
const fs = require('fs');
const path = require('path');
const P = require('./lib/lae.cjs').lae('tests/fixtures/kalkulaator-pension.js');
const load = (f) => { const s = fs.readFileSync(path.join(__dirname, '../public/data/' + f), 'utf-8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); };
const T = load('elutabel.js');

let passed = 0;
const failures = [];
function check(ok, msg) { if (ok) passed++; else failures.push(msg); }
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const row = (s, age) => s.rows.find((x) => x.age === age);
const lasts = (s) => (s.lastsUntil === null ? 101 : s.lastsUntil);
const plan = (m2, m3, s2, s3, offset = 0) => ({ stateOffset: offset, p2: { method: m2, start: s2 }, p3: { method: m3, start: s3 } });

// Lihtne alus käsitsi arvutamiseks: tootlus 0%, hoius 0%, juba pensioniealine (sündinud 1961, 65-aastane).
const zero = { birthYear: 1961, sex: 'N', pensionAgeYears: 65, workUntil: 65, p1Monthly: 900, p2: 0, p3: 0, tkf: 0, savings: 0,
  p3Before2021: false, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, tkfMonthly: 0, needMonthly: 1000, realReturn: 0, depositReturn: 0, care: { on: false } };

// ---------- 1. Käsitsi arvutatud juhtumid ----------

// 1a. Jätan fondi: puudu 100 € kuus → II sambast 1 333,33 € aastas (10% maks), 12 000 € jätkub 9 aastaks (65–73).
{
  const s = P.simulate({ ...zero, p2: 12000 }, T, plan('keep', 'keep', 65, 65));
  check(s.lastsUntil === 74, '1a: jätkub kuni 74, sai ' + s.lastsUntil);
  check(near(s.tax90, 1200), '1a: maks 10% kogu summast = 1200, sai ' + s.tax90.toFixed(2));
  check(near(row(s, 65).i23, 100), '1a: II sambast 100 € kuus neto');
}
// 1b. Kõik korraga: 10 000 → maks 1 000, hoiusele 9 000. Puudu 1 200 € aastas → 7 täit aastat, 72-aastaselt jääb 600 € puudu.
{
  const s = P.simulate({ ...zero, p2: 10000 }, T, plan('lump', 'keep', 65, 65));
  check(near(s.tax90, 1000), '1b: ühekordse väljamakse maks 1000');
  check(s.lastsUntil === 72, '1b: jätkub kuni 72, sai ' + s.lastsUntil);
  check(near(row(s, 72).shortfall, 50), '1b: 72-aastaselt puudu 50 € kuus');
}
// 1c. Hoius −1%: sama summa kaotab väärtust.
{
  const s = P.simulate({ ...zero, p2: 10000, needMonthly: 900, depositReturn: -0.01 }, T, plan('lump', 'keep', 65, 65));
  check(near(row(s, 66).moneyLeft, 9000 * 0.99), '1c: hoius −1% aastas');
}
// 1d. Riiklik pension: varem −7,17%, hiljem +16,88%, algus õigel aastal.
{
  const s = P.simulate({ ...zero, birthYear: 1966, workUntil: 64 }, T, plan('keep', 'keep', 65, 65, -1));
  check(row(s, 63).i1 === 0 && near(row(s, 64).i1, 900 * (1 - 0.0717)), '1d: 1 a varem');
  const t = P.simulate({ ...zero, birthYear: 1966 }, T, plan('keep', 'keep', 65, 65, 2));
  check(row(t, 66).i1 === 0 && near(row(t, 67).i1, 900 * 1.1688), '1d: 2 a hiljem');
}
// 1e. II samba sissemaksed: 2 000 € bruto, 2% + riigi 4% → 1 440 € aastas, 5 aastat (60–64). Riigi osa 4 800 €.
{
  const s = P.simulate({ ...zero, birthYear: 1966, grossMonthly: 2000, p2Rate: 0.02, needMonthly: 900 }, T, plan('keep', 'keep', 65, 65));
  check(near(row(s, 65).moneyLeft, 7200), '1e: II sambasse 5 × 1440 = 7200, sai ' + row(s, 65).moneyLeft.toFixed(2));
  check(near(s.stateSupport, 4800), '1e: riigi 4% kokku 4800');
}
// 1f. III samba tagastus: 100 € kuus → 264 € aastas, piir 15% brutopalgast.
{
  const s = P.simulate({ ...zero, birthYear: 1966, grossMonthly: 2000, p3Monthly: 100, needMonthly: 900 }, T, plan('keep', 'keep', 65, 65));
  check(near(s.refundTotal, 5 * 264), '1f: tagastus 5 × 264');
  const low = P.simulate({ ...zero, birthYear: 1966, grossMonthly: 500, p3Monthly: 100, needMonthly: 900 }, T, plan('keep', 'keep', 65, 65));
  check(near(low.refundTotal, 5 * 900 * 0.22), '1f: piir 15% × 6000 € aastapalk = 900 € → 198 € aastas');
  const max = P.simulate({ ...zero, birthYear: 1966, grossMonthly: 6000, p3Monthly: 700, needMonthly: 900 }, T, plan('keep', 'keep', 65, 65));
  check(near(max.refundTotal, 5 * 6000 * 0.22), '1f: ülempiir 6000 € aastas');
}
// 1g. Üks fondipensioni leping: periood = elada jäänud aastad, makse = jääk / järelejäänud aastad.
{
  const term = Math.round(T.elada_jaanud.N[65]);
  const s = P.simulate({ ...zero, p2: 21000, p1Monthly: 2000 }, T, plan('fund', 'keep', 65, 65));
  check(near(row(s, 65).i23 * 12, 21000 / term), '1g: esimene makse 21000/' + term);
  check(row(s, 65 + term - 1).i23 > 0 && row(s, 65 + term).i23 === 0, '1g: viimane makse ' + (65 + term - 1) + '-aastaselt');
  check(near(s.tax90, 0), '1g: fondipension on maksuvaba');
}
// 1h. Leping igal aastal uuesti: makse = jääk / elada jäänud aastad sel aastal; ei jõua nulli.
{
  const s = P.simulate({ ...zero, p2: 21000, p1Monthly: 2000 }, T, plan('renew', 'keep', 65, 65));
  const y1 = 21000 / Math.round(T.elada_jaanud.N[65]);
  check(near(row(s, 65).i23 * 12, y1), '1h: esimene makse');
  check(near(row(s, 66).i23 * 12, (21000 - y1) / Math.round(T.elada_jaanud.N[66])), '1h: teine makse uue perioodiga');
  check(row(s, 99).i23 > 0, '1h: makse jätkub 99-aastaselt');
}
// 1i. Kogumisfond: tulumaks ainult kasvult. 0% tootlusega maksu ei ole.
{
  const s = P.simulate({ ...zero, tkf: 5000 }, T, plan('keep', 'keep', 65, 65));
  check(near(s.tax90, 0) && s.lastsUntil === 69, '1i: kogumisfond 5000 katab 100 €/kuus 4 a 2 k, maksuta');
  const g = P.simulate({ ...zero, birthYear: 1966, tkf: 10000, realReturn: 0.1 }, T, plan('keep', 'keep', 65, 65));
  const tkf65 = 10000 * Math.pow(1.1, 5), gain = 1 - 10000 / tkf65;
  const gross = 1200 / (1 - gain * 0.22);
  check(near(row(g, 65).taxToDate, gross * gain * 0.22, 0.05), '1i: 22% kasvu osalt');
}
// 1j. Parandus: III samba igakuine väljamakse enne soodusvanust (liitunud 2021+, alla 60) on 22% maksuga.
{
  const s = P.simulate({ ...zero, birthYear: 1970, workUntil: 56, p3: 29000, needMonthly: 0 }, T, plan('keep', 'renew', 60, 56));
  const g56 = 29000 / Math.round(T.elada_jaanud.N[56]);
  check(near(row(s, 56).taxToDate, g56 * 0.22), '1j: III samba igakuisest väljamaksest 56-aastaselt 22% maks');
  check(near(row(s, 56).i23 * 12, g56 * 0.78), '1j: kätte saad 78%');
  const old = P.simulate({ ...zero, birthYear: 1970, workUntil: 56, p3: 29000, p3Before2021: true, needMonthly: 0 }, T, plan('keep', 'renew', 60, 56));
  check(near(row(old, 56).taxToDate, 0), '1j: enne 2021 liitunul 55+ igakuine väljamakse maksuvaba');
}
// 1k. Parandus: kui oled valitud algusest vanem, arvestatakse fondipensioni periood praegusest vanusest.
{
  const s = P.simulate({ ...zero, birthYear: 1956, workUntil: 70, p2: 21000, p1Monthly: 2000 }, T, plan('fund', 'keep', 65, 65));
  check(near(row(s, 70).i23 * 12, 21000 / Math.round(T.elada_jaanud.N[70])), '1k: 70-aastasel periood 70. eluaasta järgi');
}
// 1l. Parandus: ajutine auk. Töö lõpeb 60, riiklik pension 67: raha saab otsa enne riiklikku pensioni ja tuleb tagasi.
{
  const s = P.simulate({ ...zero, birthYear: 1966, workUntil: 60, p2: 20000, p3: 10000, needMonthly: 900 }, T, plan('renew', 'renew', 60, 60, 2));
  check(s.lastsUntil !== null && s.lastsUntil < 67, '1l: auk enne riiklikku pensioni');
  check(s.gapTemporary && s.gapEnd === 66, '1l: auk lõpeb 66-aastaselt, sai ' + s.gapEnd);
  check(near(s.stateAfter, 900 * 1.1688), '1l: „pärast seda“ näitab riiklikku pensioni, mitte 0 €');
  const perm = P.simulate({ ...zero, p2: 12000 }, T, plan('keep', 'keep', 65, 65));
  check(!perm.gapTemporary && perm.gapEnd === 100, '1l: püsiv puudujääk ei ole ajutine');
}
// 1m. Hooldekodu: vajadus = max(0, tavakulu − asendatav) + hooldekodu.
{
  const s = P.simulate({ ...zero, p1Monthly: 5000, care: { on: true, fromAge: 85, monthly: 1603, replaces: 400 } }, T, plan('keep', 'keep', 65, 65));
  check(row(s, 84).need === 1000 && near(row(s, 85).need, 2203), '1m: hooldekodu vajadus 85-aastaselt');
}

// ---------- 2. Rahavoogude tasakaal (tootlus 0%) ----------
// Raha 100-aastaselt = algne raha + sissemaksed + tagastused + riiklik pension − kulutused − maks.
// Sissemaksed arvutatakse siin sõltumatult, nii kontrollib see ka II samba sissemaksete lõppemise aega.
function identity(input, pl, label) {
  const s = P.simulate(input, T, pl);
  const cur = P.CURRENT_YEAR - input.birthYear;
  const gross = input.grossMonthly * 12;
  let pool = input.p2 + input.p3 + input.tkf + input.savings, support = 0;
  for (const r of s.rows) {
    if (r.age === 100) break;
    if (r.working) {
      if (input.p2Rate > 0 && (s.iiStoppedAge === null || r.age <= s.iiStoppedAge)) { pool += gross * (input.p2Rate + 0.04); support += gross * 0.04; }
      const c3 = input.p3Monthly * 12, ref = Math.min(c3, 0.15 * gross, 6000) * 0.22;
      pool += c3 + ref + input.tkfMonthly * 12; support += ref;
    }
    pool += r.i1 * 12 - (r.working ? 0 : (r.need - r.shortfall) * 12);
  }
  pool -= row(s, 99).taxToDate;
  check(near(row(s, 100).moneyLeft, pool, 0.5), 'tasakaal ' + label + ': mudel ' + row(s, 100).moneyLeft.toFixed(2) + ', ootus ' + pool.toFixed(2) + ' (algus ' + cur + ')');
  check(near(s.stateSupport, support, 0.5), 'riigi tugi ' + label + ': ' + s.stateSupport.toFixed(2) + ' vs ' + support.toFixed(2));
  for (const r of s.rows) if (r.moneyLeft < -0.01 || r.shortfall < -0.01) { check(false, 'negatiivne raha ' + label + ' ' + r.age); break; }
}

// ---------- 3. Personad ----------
const INCOMES = {
  madal: { grossMonthly: 1000, p1Monthly: 650, p2: 9000, p3: 0, tkf: 0, savings: 1000, p2Rate: 0.02, p3Monthly: 0, tkfMonthly: 0 },
  keskmine: { grossMonthly: 2000, p1Monthly: 900, p2: 30000, p3: 20000, tkf: 0, savings: 5000, p2Rate: 0.02, p3Monthly: 50, tkfMonthly: 0 },
  kõrge: { grossMonthly: 4500, p1Monthly: 1150, p2: 90000, p3: 60000, tkf: 20000, savings: 30000, p2Rate: 0.06, p3Monthly: 500, tkfMonthly: 200 },
};
const NEEDS = [790, 1200, 1800];
const personas = [];
for (const [inc, money] of Object.entries(INCOMES)) {
  for (const sex of ['N', 'M']) {
    for (const birthYear of [1961, 1966, 1971]) {
      const cur = P.CURRENT_YEAR - birthYear;
      for (const work of ['pensionini', '3 a kauem', 'kohe']) {
        const workUntil = work === 'pensionini' ? Math.max(65, cur) : work === '3 a kauem' ? Math.max(68, cur) : cur;
        for (const need of NEEDS) {
          personas.push({ label: [inc, sex, birthYear, work, need].join('/'), input: { birthYear, sex, pensionAgeYears: 65, workUntil,
            ...money, p3Before2021: birthYear < 1968, needMonthly: need, realReturn: 0.02, depositReturn: -0.01, care: { on: false } } });
        }
      }
    }
  }
}
const plansFor = (input) => {
  const st = P.payoutStart(input);
  return P.presets(input).concat([Object.assign({ id: 'K', name: 'Jätan fondi' }, plan('keep', 'keep', st.p2, st.p3))]);
};

for (const { label, input } of personas) {
  for (const pl of plansFor(input)) identity({ ...input, realReturn: 0, depositReturn: 0 }, pl, label + '/' + pl.id);
}

// ---------- 4. Loogikakontrollid ----------
const L = (input, pl) => P.sustainableNeed(input, T, pl);
// Muuda ühte sisendit paremaks: tulemus ei tohi halveneda. Plaan arvutatakse uuesti (algus sõltub töötamisest).
const BETTER = [
  ['II sammas +10 000', (i) => ({ ...i, p2: i.p2 + 10000 })],
  ['III sammas +10 000', (i) => ({ ...i, p3: i.p3 + 10000 })],
  ['hoius +10 000', (i) => ({ ...i, savings: i.savings + 10000 })],
  ['kogumisfond +10 000', (i) => ({ ...i, tkf: i.tkf + 10000 })],
  ['riiklik pension +100', (i) => ({ ...i, p1Monthly: i.p1Monthly + 100 })],
  ['tootlus 2% → 4%', (i) => ({ ...i, realReturn: 0.04 })],
  ['hoius −1% → 0%', (i) => ({ ...i, depositReturn: 0 })],
  ['palk +1000', (i) => ({ ...i, grossMonthly: i.grossMonthly + 1000 })],
  ['III sissemakse +100', (i) => ({ ...i, p3Monthly: i.p3Monthly + 100 })],
  ['töötad 1 a kauem', (i) => ({ ...i, workUntil: Math.min(75, i.workUntil + 1) })],
];
const sample = personas.filter((_, k) => k % 3 === 0); // iga kolmas persona, et test oleks kiire
for (const { label, input } of sample) {
  const base = plansFor(input);
  for (const [what, f] of BETTER) {
    const better = f(input);
    const bPlans = plansFor(better);
    base.forEach((pl, k) => {
      const a = P.simulate(input, T, pl), b = P.simulate(better, T, bPlans[k]);
      check(lasts(b) >= lasts(a), label + '/' + pl.id + ': ' + what + ' ei tohi raha varem lõpetada (' + lasts(a) + ' → ' + lasts(b) + ')');
      const la = L(input, pl), lb = L(better, bPlans[k]);
      check(lb >= la, label + '/' + pl.id + ': ' + what + ' ei tohi jätkusuutlikku kulu vähendada (' + la + ' → ' + lb + ')');
    });
  }
  // suurem vajadus → raha ei kesta kauem
  for (const pl of base) {
    const a = P.simulate(input, T, pl), b = P.simulate({ ...input, needMonthly: input.needMonthly + 200 }, T, pl);
    check(lasts(b) <= lasts(a), label + '/' + pl.id + ': suurem vajadus ei tohi raha pikendada');
  }
}

for (const { label, input } of personas) {
  const cur = P.CURRENT_YEAR - input.birthYear;
  const [A, B, C, D, K] = plansFor(input);
  const sim = (pl) => P.simulate(input, T, pl);
  const sA = sim(A), sB = sim(B), sC = sim(C), sK = sim(K);
  // Kõik korraga ei saa olla parem kui fondi jätmine: sama raha, 10% maks kohe ja hoius kehvem kui fond.
  check(L(input, K) >= L(input, A), label + ': jätan fondi ≥ kõik korraga (' + L(input, K) + ' vs ' + L(input, A) + ')');
  check(sK.inheritance90 >= sA.inheritance90 - 0.5, label + ': pärand 90: jätan fondi ≥ kõik korraga');
  // Maks: igakuine fondipension on maksuvaba, kui sissetulek katab vajaduse ilma lisaväljamakseta.
  const covered = sC.rows.filter((r) => !r.working).every((r) => r.i1 >= r.need);
  if (covered) check(near(sC.tax90, 0) && near(sB.tax90, 0), label + ': riiklik pension katab vajaduse → B ja C maksuvabad');
  // Ühekordne maks on vähemalt 10% II sambast (+ III).
  check(sA.tax90 >= 0.1 * input.p2 - 0.01, label + ': kõik korraga maks ≥ 10% II sambast');
  // Riigi tugi: valmisstrateegiad ei alusta II sambast enne töö lõppu, seega riigi 4% ei kao.
  for (const pl of [A, B, C, D]) {
    const s = sim(pl);
    check(s.iiStoppedAge === null || s.iiStoppedAge >= Math.max(cur, input.workUntil) || input.p2 === 0, label + '/' + pl.id + ': II sammas ei peatu enne töö lõppu (' + s.iiStoppedAge + ')');
    check(near(s.stateSupport, sK.stateSupport, 0.5), label + '/' + pl.id + ': sama riigi tugi kui jätan fondi');
  }
  // Leping igal aastal uuesti ei jõua nulli, üks leping jõuab.
  // (Kui vajadus on suurem, võtab kulureegel lisaväljamakseid ja ka C saab otsa: see on õige.)
  const noExtra = sC.rows.every((r) => r.working || r.sav + r.i23 <= 0.01 || r.i1 + r.i23 >= r.need - 0.01);
  if (input.p2 + input.p3 > 0 && covered && noExtra) {
    check(row(sC, 100).i23 > 0, label + ': C makse jätkub 100-aastaselt');
  }
  // Riiklik pension üksi: kui töötad vähemalt pensionieani, katab jätkusuutlik kulu vähemalt riikliku pensioni.
  if (input.workUntil >= 65) check(L(input, C) >= input.p1Monthly - 10, label + ': jätkusuutlik kulu ≥ riiklik pension');
  // Ülempiir: jätkusuutlik kulu ei saa ületada riiklikku pensioni + kogu raha, kui see kasvaks 4% aastas ja kuluks horisondini.
  const years = sC.horizonAge - Math.max(cur, input.workUntil) + 1;
  const contrib = Math.max(0, input.workUntil - cur) * 12 * (input.grossMonthly * (input.p2Rate + 0.04) + input.p3Monthly * 1.22 + input.tkfMonthly);
  const money = (input.p2 + input.p3 + input.tkf + input.savings + contrib) * Math.pow(1.04, 100 - cur);
  const D_ = sim(D);
  check(L(input, D) <= input.p1Monthly * 1.17 + money / (12 * years) + 10, label + ': jätkusuutlik kulu on mõistlikus vahemikus');
  // Naised elavad kauem: horisont ja fondipensioni periood vähemalt sama pikk kui meestel.
  if (input.sex === 'N') {
    const m = { ...input, sex: 'M' };
    check(P.horizonAge(T, 'N', cur) >= P.horizonAge(T, 'M', cur), label + ': naise horisont ≥ mehe');
    check(L(m, C) >= L(input, C), label + ': mehe jätkusuutlik kulu ≥ naise (lühem horisont)');
  }
  void D_;
}

// Riigi tugi kaob, kui alustad II sambast töötamise ajal (põhimõte 1), täpselt nii mitme aasta võrra.
{
  const input = { ...personas[0].input, birthYear: 1966, workUntil: 68, grossMonthly: 2000, p2Rate: 0.02 };
  const early = P.simulate(input, T, plan('renew', 'keep', 65, 68));
  const late = P.simulate(input, T, plan('renew', 'keep', 68, 68));
  check(near(late.stateSupport - early.stateSupport, 2000 * 12 * 0.04 * 2, 0.5), 'põhimõte 1: riigi 4% kaob 66–67 (2 aastat; 65 sissemakse läheb veel sisse)');
  check(L(input, plan('renew', 'keep', 68, 68)) >= L(input, plan('renew', 'keep', 65, 68)), 'põhimõte 1: hiljem alustamine ei ole halvem');
}
// D: kui oled juba vanem kui pensioniiga + 2, ei rakendata minevikku nihutatud riiklikku pensioni.
{
  const input = { ...zero, birthYear: 1956 };
  check(P.presets(input)[3].stateOffset === 0, 'D: 70-aastasel ei lükata riiklikku pensioni minevikku');
  check(P.presets({ ...zero, birthYear: 1966 })[3].stateOffset === 2, 'D: 60-aastasel 2 a hiljem');
}

// ---------- tulemus ----------
if (process.argv.includes('--table')) {
  console.log('persona'.padEnd(34) + ' | ' + ['A', 'B', 'C', 'D', 'K'].map((x) => (x + ': jätkub/L').padEnd(16)).join(' | '));
  for (const { label, input } of personas) {
    console.log(label.padEnd(34) + ' | ' + plansFor(input).map((pl) => {
      const s = P.simulate(input, T, pl);
      return (String(s.lastsUntil === null ? '100+' : s.lastsUntil) + (s.gapTemporary ? '*' : '') + ' / ' + L(input, pl)).padEnd(16);
    }).join(' | '));
  }
  console.log('* ajutine auk (nt enne riikliku pensioni algust)');
}
console.log(passed + ' kontrolli läbis, ' + failures.length + ' kukkus läbi.');
if (failures.length) {
  const shown = failures.slice(0, Number(process.env.SHOW || 40));
  console.log(shown.map((f) => '  ✗ ' + f).join('\n') + (failures.length > shown.length ? '\n  … ja veel ' + (failures.length - shown.length) : ''));
  process.exit(1);
}
