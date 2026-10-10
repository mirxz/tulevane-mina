// Elukaare mootori invariandid: reeglid, mis peavad kehtima IGA sisendi korral (tulumaks sees).
// Sisendid on fikseeritud seemnega juhuslikult valitud (korratav). Kasutus: node tests/elukaar-invariandid.test.cjs [juhtumeid]
// Iga invariant on üks meie teadmine kirja pandud: kui see kukub, siis kas mootor või teadmine muutus ja seda tuleb teadlikult otsustada.
const { lae, andmed } = require('./lib/lae.cjs');
const P = lae('public/elukaar/pension.js');
const T = andmed('elutabel.js');
const [A, B, C, D] = P.SCENARIOS;
const SC = { A, B, C: { ...C, deferral: 2 }, D, E: { id: 'E' }, E3: { id: 'E', deferral: 3 } };

let passed = 0;
const failures = [];
const check = (ok, msg) => { if (ok) passed++; else failures.push(msg); };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// Seemnega juhuslikkus (mulberry32).
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(20261011);
const pick = (a) => a[Math.floor(rand() * a.length)];
const randomInput = () => ({
  birthYear: pick([1961, 1964, 1966, 1971, 1976, 1981, 1986, 1991]),
  sex: pick(['M', 'N']),
  p1Monthly: pick([0, 500, 776, 900, 1200, 1800]),
  p2: pick([0, 8000, 30000, 90000]),
  p3: pick([0, 6000, 25000]),
  p3Before2021: pick([true, false]),
  grossMonthly: pick([0, 0, 2000, 4000]),
  p2Rate: pick([0, 0.02, 0.06]),
  p3Monthly: pick([0, 0, 150]),
  needMonthly: pick([400, 791, 1200, 2000]),
  realReturn: pick([0, 0.02, 0.04, -0.01]),
  extraDeposit: pick([0, 0, 5000]),
});
const N = Number(process.argv[2]) || 600;
const cases = Array.from({ length: N }, randomInput);
const label = (i, id) => `${id} ${i.birthYear}/${i.sex}/p1 ${i.p1Monthly}/p2 ${i.p2}/p3 ${i.p3}/r ${i.realReturn}/need ${i.needMonthly}`;

for (const input of cases) {
  for (const [id, sc] of Object.entries(SC)) {
    const L = label(input, id);
    const s = P.simulate(input, T, sc);
    const pa = P.retirementYears(input);
    const p1Start = pa + (sc.deferral || 0);

    // 1. Kõik arvud on lõplikud, midagi pole NaN ega negatiivne (v.a puudu/hoiusele läinud, mis on ≥ 0).
    const bad = s.rows.find((x) => Object.values(x).some((v) => typeof v === 'number' && !Number.isFinite(v)));
    check(!bad, L + ': lõplikud arvud (' + (bad ? JSON.stringify(bad) : '') + ')');
    check(s.rows.every((x) => x.i1 >= -1e-9 && x.i2 >= -1e-9 && x.i3 >= -1e-9 && x.dep >= -1e-9 && x.shortfall >= -1e-9 && x.moneyLeft >= -1e-6), L + ': ükski sissetulek, puudujääk ega saldo pole negatiivne');

    // 2. Keegi ei kuluta üle vajaduse; kulutus + puudu = vajadus (pensionieas).
    const need = input.needMonthly;
    check(s.rows.filter((x) => x.age >= pa).every((x) => x.spend <= need + 1e-6 && near(x.spend + x.shortfall, need, 1e-6) || (x.spend >= need - 1e-6 && x.shortfall === 0)), L + ': kulutus ≤ vajadus, kulutus + puudu = vajadus');

    // 3. Tulumaks riiklikult pensionilt: 22% ainult 776 € ületavalt osalt, pension pärast maksu ei ole suurem kui enne.
    check(s.rows.every((x) => near(x.tax1, 0.22 * Math.max(0, x.i1g - 776), 1e-6) && near(x.i1, x.i1g - x.tax1, 1e-6) && x.i1 <= x.i1g + 1e-9), L + ': tulumaks = 22% × max(0, pension − 776)');

    // 4. Riiklik pension algab õigel ajal ja on edasilükkamise korral suurem.
    const first = s.rows.find((x) => x.i1g > 0);
    if (input.p1Monthly > 0) {
      check(first && first.age === Math.max(p1Start, s.rows[0].age), L + ': riiklik pension algab ' + p1Start + ' (tegelikult ' + (first && first.age) + ')');
      check(first && near(first.i1g, input.p1Monthly * (1 + P.DEFERRAL_INCREASE[sc.deferral || 0]), 1e-6), L + ': pension = sisend × (1 + edasilükkamise tõus)');
    } else check(!first, L + ': ilma riikliku pensionita pole i1');

    // 5. Rahavoogude tasakaal pensionieast (tootlus ja hoius 0%): raha muutus = −(kulutus − pension) − 10% maks, 0 ≤ maks ≤ 10% varast.
    if (id === 'E' || id === 'D') {
      const z = P.simulate({ ...input, realReturn: 0, depositReturn: 0 }, T, sc);
      const rr = z.rows.filter((x) => x.age >= pa);
      for (let k = 0; k + 1 < rr.length; k++) {
        const x = rr[k], nx = rr[k + 1];
        const tax10 = (x.moneyLeft - nx.moneyLeft) - 12 * (x.spend - x.i1); // moneyLeft on aastane, spend/i1 kuised
        if (!(tax10 >= -1e-6 && tax10 <= 0.1 * x.moneyLeft + 1e-6)) { check(false, L + ' ' + x.age + ': rahavoogude tasakaal, 10% maks ' + tax10.toFixed(2) + ' vs vara ' + x.moneyLeft.toFixed(2)); break; }
      }
      check(true, 'tasakaal');
    }

    // 6. Jätkusuutlik kulu on piir: sellega kaetud, +20 € kuus enam mitte (kui piirini ei jõuta).
    if (id !== 'B' || input.realReturn >= 0) {
      const sus = P.sustainableNeed(input, T, sc);
      const ok = P.simulate(input, T, sc, sus), over = P.simulate(input, T, sc, sus + 20);
      const covers = (r) => r.coversNeedUntil === null || r.coversNeedUntil > r.horizonAge;
      check(sus === 0 || covers(ok), L + ': jätkusuutlik kulu ' + sus + ' on kaetud');
      check(sus >= 9990 || !covers(over), L + ': jätkusuutlik kulu ' + sus + ' + 20 ei ole enam kaetud');
    }

    // 7. Monotoonsus: rohkem raha, suurem pension, madalam kulu ja kõrgem tootlus ei anna halvemat tulemust (10 € lubatud ümardus).
    const susBase = P.sustainableNeed(input, T, sc);
    const sust = (mut) => P.sustainableNeed({ ...input, ...mut }, T, sc);
    check(sust({ p2: input.p2 + 10000 }) >= susBase - 10, L + ': +10 000 € II sambasse ei vähenda jätkusuutlikku kulu');
    check(sust({ p1Monthly: input.p1Monthly + 100 }) >= susBase - 10, L + ': +100 € riiklikku pensioni ei vähenda jätkusuutlikku kulu');
    if (input.realReturn < 0.04) check(sust({ realReturn: input.realReturn + 0.02 }) >= susBase - 10, L + ': kõrgem tootlus ei vähenda jätkusuutlikku kulu');
    const cover = (n) => { const r = P.simulate(input, T, sc, n); return r.coversNeedUntil === null ? 101 : r.coversNeedUntil; };
    check(cover(input.needMonthly - 100) >= cover(input.needMonthly), L + ': väiksem kulu ei kata lühemat aega');
  }
}

// 8. Tulumaksu lüliti: incomeTax=false annab pensioni täissummas ja null maksu.
for (const input of cases.slice(0, 80)) {
  const s = P.simulate({ ...input, incomeTax: false }, T, SC.E);
  check(s.rows.every((x) => x.tax1 === 0 && near(x.i1, x.i1g)), label(input, 'E') + ': incomeTax=false → maksu pole');
}

// 9. Tasasus: ühe lepingu fondipension (B) maksab võrdset reaalset makset kogu lepingu ajal (kui vajadus on väike, siis lisaväljamakseid pole).
for (const input of cases.slice(0, 120)) {
  const i = { ...input, needMonthly: 1, extraDeposit: 0 };
  const s = P.simulate(i, T, B);
  const pa = P.retirementYears(i), cur = P.CURRENT_YEAR - i.birthYear, start = Math.max(pa, cur);
  const term = P.fundPensionTerm(T, i.sex, start);
  const pay = s.rows.filter((x) => x.age >= start && x.age < start + term).map((x) => x.i2);
  check(pay.length > 0 && pay.every((v) => near(v, pay[0], 1e-6)), label(i, 'B') + ': makse on tasane kogu lepingu ajal');
  const after = s.rows.find((x) => x.age === start + term);
  check(!after || after.i2 === 0, label(i, 'B') + ': pärast lepingut makset pole');
}

// 10. Hüpe pensioniea piiril: fondipension ei hüppa (D: leping igal aastal) 64 → 65, kui riiklik pension ja kulud on samad (ainult sissemaksed lõppevad).
for (const input of cases.slice(0, 120).filter((x) => P.CURRENT_YEAR - x.birthYear <= 63)) {
  const s = P.simulate({ ...input, needMonthly: 1, p1Monthly: 0 }, T, D);
  const pa = P.retirementYears(input);
  const a = s.rows.find((x) => x.age === pa), b = s.rows.find((x) => x.age === pa + 1);
  if (a && b && a.i2 > 1) check(b.i2 <= a.i2 * 1.001 + 1e-9 && b.i2 >= a.i2 * 0.9, label(input, 'D') + ': fondipension ' + pa + ' → ' + (pa + 1) + ' ei hüppa (' + a.i2.toFixed(1) + ' → ' + b.i2.toFixed(1) + ')');
}

console.log(passed + ' kontrolli läbis, ' + failures.length + ' kukkus läbi.');
if (failures.length) {
  console.log(failures.slice(0, Number(process.env.SHOW || 25)).map((f) => '  ✗ ' + f).join('\n') + (failures.length > 25 ? '\n  … ja veel ' + (failures.length - 25) : ''));
  process.exit(1);
}
