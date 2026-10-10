// Tulevane Mina: arvutusloogika. Puhtad funktsioonid, töötab brauseris ja Node'is (testid).
// Kõik summad on tänastes eurodes (reaalväärtus). Mudel on aastapõhine.
//
// Ühine kulureegel (kõik stsenaariumid): igal aastal kulutad oma vajaduse.
// Allikad järjekorras: riiklik pension → samba plaanijärgne väljamakse → hoius (varasemad ülejäägid
// või ühekordne väljamakse) → lisaväljamakse sambast (10% maks). Ülejääk läheb hoiusele (reaaltootlus vaikimisi −1%, nagu kalkulaatoris).
// Nii on stsenaariumid võrreldavad: kõik püüavad katta sama vajaduse ja erinevad ainult maksu,
// tootluse, riikliku pensioni ajastuse ja väljamakse graafiku poolest.
(function (root) {
  'use strict';

  const CURRENT_YEAR = 2026;
  const MAX_AGE = 100;
  const HORIZON_SURVIVAL = 0.10; // „elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest

  // SKA paindliku vanaduspensioni keskmised muutused 2026 (aastat hiljem).
  // https://sotsiaalkindlustusamet.ee/pension-ja-seotud-huvitised/pensioni-liigid/paindlik-pension
  const DEFERRAL_INCREASE = { 0: 0, 1: 0.0793, 2: 0.1688, 3: 0.2701, 4: 0.385, 5: 0.5157 };

  const TAX_SHORT = 0.10; // ühekordne, osaline ja lühike fondipension pensioniea lähedal

  // Pensioniiga kalendriaasta järgi. 2028 ja 2029 on eelnõud; hilisemad on teadmata (ligikaudne).
  function pensionAge(birthYear) {
    const y65 = birthYear + 65;
    let months = 0;
    if (y65 === 2027) months = 1;
    else if (y65 === 2028) months = 3;
    else if (y65 >= 2029) months = 4;
    const known = y65 <= 2027;
    return { years: 65, months: months, known: known, label: (known ? '' : 'u ') + '65 a' + (months ? ' ' + months + ' k' : '') + (y65 > 2029 ? '+' : '') };
  }

  // Tõenäosus olla elus vanuses `age`, kui praegu ollakse elus vanuses `fromAge`.
  function survival(table, sex, fromAge, age) {
    const s = table.ellujaajad[sex];
    if (age > MAX_AGE) return 0;
    if (age <= fromAge) return 1;
    return s[age] / s[fromAge];
  }

  // Vanus, milleni jõuab elusalt 10% sinuvanustest.
  function horizonAge(table, sex, fromAge) {
    for (let a = fromAge; a <= MAX_AGE; a++) if (survival(table, sex, fromAge, a) <= HORIZON_SURVIVAL) return a;
    return MAX_AGE;
  }

  // Fondipensioni soovituslik (maksuvaba) periood: elada jäänud aastad vanuse ja soo järgi, täisaastateks ümardatud.
  function fundPensionTerm(table, sex, age) {
    return Math.max(1, Math.round(table.elada_jaanud[sex][Math.min(age, MAX_AGE)]));
  }

  // Annuiteeditegur: n võrdset makset aasta alguses, saldo kasvab tootlusega r. Tootlusel 0 on see n.
  function annuityDue(n, r) {
    if (!(n > 0)) return 0;
    if (Math.abs(r) < 1e-12) return n;
    return (1 - Math.pow(1 + r, -n)) / (1 - 1 / (1 + r));
  }

  // Pensioniiga aastates: kasutaja (või Tuleva konto) antud väärtus või ligikaudne reegel.
  function retirementYears(input) {
    return input.pensionAgeYears || pensionAge(input.birthYear).years;
  }

  // Aastane sissemakse sammastesse kuni pensionini (tänastes eurodes, palk reaalselt ei kasva).
  // II sammas: töötaja 2/4/6% + riik 4% sotsiaalmaksust, kui II sammas on aktiivne. III sammas: oma kuumakse.
  function yearlyContribution(input) {
    const rate = input.p2Rate || 0;
    return (input.grossMonthly || 0) * 12 * (rate > 0 ? rate + 0.04 : 0) + (input.p3Monthly || 0) * 12;
  }

  function decisionMap(input) {
    const pa = Object.assign({}, pensionAge(input.birthYear));
    if (input.pensionAgeYears) { pa.years = input.pensionAgeYears; pa.label = input.pensionAgeYears + ' a'; }
    const at = (age) => input.birthYear + age;
    const p3Age = input.p3Before2021 ? 55 : 60;
    return [
      { age: p3Age, year: at(p3Age), title: 'III sammas soodusmaksuga',
        text: 'Väljamaksed 10% tulumaksuga (regulaarne pikk väljamakse 0%), kui kogumist on vähemalt 5 aastat.' +
          (input.p3Before2021 ? ' Alates 55, sest alustasid enne 2021.' : ' Alates 60, sest alustasid 2021 või hiljem.') },
      { age: 60, year: at(60), title: 'II sammas ja paindlik riiklik pension',
        text: 'II sammas: ühekordne või lühike fondipension 10%, pikk fondipension 0%. Väljamaksete alustamisel lõpevad II samba sissemaksed igaveseks. Riiklikku pensioni saab võtta kuni 5 aastat varem, vähendatult.' },
      { age: pa.years, year: at(pa.years), title: 'Riiklik pension täissummas (' + pa.label + ')',
        text: pa.known ? 'Pensioniiga on kehtestatud.' : 'Pensioniiga arvutatakse igal aastal uuesti Statistikaameti eluea järgi, seega see on ligikaudne.' },
      { age: pa.years + 1, year: at(pa.years + 1), title: 'Riikliku pensioni edasilükkamine',
        text: 'Iga edasilükatud aasta tõstab riiklikku pensioni eluks ajaks: +7,93% (1 a) kuni +51,57% (5 a), 2026 keskmised.' },
      { age: pa.years, year: at(pa.years), title: 'Fondipensioni leping: üks kord või igal aastal uuesti',
        text: 'Ühe lepinguga lõpeb väljamakse perioodi lõpus. Kui sõlmid lepingu igal aastal uuesti vähemalt maksuvaba perioodiga, jääb see maksuvabaks ega saa otsa, aga väga kõrges eas on kuumakse väiksem.' },
    ].sort((a, b) => a.age - b.age);
  }

  // Ühe stsenaariumi aastane rahavoog vanusest startAge kuni MAX_AGE.
  function simulate(input, table, scenario, needOverride) {
    const need = needOverride !== undefined ? needOverride : input.needMonthly;
    const r = input.realReturn;
    const rd = input.depositReturn !== undefined ? input.depositReturn : -0.01; // hoiuse intress jääb tavaliselt inflatsioonist maha
    const pa = retirementYears(input);
    const currentAge = CURRENT_YEAR - input.birthYear;
    const startAge = Math.max(currentAge, 55);
    const deferral = scenario.deferral || 0; // C: sild fondipensioniga; teised stsenaariumid võivad samuti edasi lükata
    const p1Start = pa + deferral;
    const p1Year = input.p1Monthly * (1 + DEFERRAL_INCREASE[deferral]) * 12;
    const needYear = need * 12;

    // Samba vara kasvab kuni kasutamiseni ja sinna lisanduvad sissemaksed.
    // Valikuline eraldi III sammas (input.p3Sep = { amount, mode: 'grow' | 'lump' | 'fund' }): oma pott, oma väljamakse viis.
    // Ilma selleta on III sammas II sambaga ühes potis (senine käitumine).
    const sep = input.p3Sep || null;
    const c3 = sep ? (input.p3Monthly || 0) * 12 : 0;
    let fund = input.p2 + input.p3;
    let fund3 = sep ? sep.amount : 0;
    const contrib = yearlyContribution(input) - c3;
    for (let a = currentAge; a < pa; a++) { fund = fund * (1 + r) + contrib; fund3 = fund3 * (1 + r) + c3; }

    // Hoius pensioni alguses: varem sambast välja võetud ja kõrvale pandud raha (valikuline, vaikimisi 0).
    let deposit = input.extraDeposit || 0;
    if (scenario.id === 'A') { deposit += fund * (1 - TAX_SHORT); fund = 0; }
    if (sep && sep.mode === 'lump') { deposit += fund3 * (1 - TAX_SHORT); fund3 = 0; }
    // Ühe lepingu fondipension: periood määratakse lepingu sõlmimisel (pensionieas või kohe, kui oled sellest vanem).
    // C (paindlik pension) kasutab sillaks maksuvaba fondipensioni, mille leping uueneb igal aastal (nagu D).
    const contractStart = scenario.id === 'B' ? Math.max(pa, currentAge) : null;
    const contractTerm = contractStart !== null ? fundPensionTerm(table, input.sex, contractStart) : 0;

    const rows = [];
    for (let age = startAge; age <= MAX_AGE; age++) {
      const fundStart = fund + fund3, depositStart = deposit;
      const i1 = age >= p1Start ? p1Year : 0;
      let sched = 0, extraNet = 0, fromDeposit = 0, saved = 0, sched3 = 0, extra3 = 0;
      if (age >= pa) {
        // 1) plaanijärgne maksuvaba väljamakse
        if (scenario.id === 'D' || scenario.id === 'C') {
          sched = fund / fundPensionTerm(table, input.sex, age); // uus leping igal aastal lühima maksuvaba perioodiga
        } else if (contractStart !== null && age >= contractStart) {
          const left = contractTerm - (age - contractStart);
          // Tasane reaalne makse: saldo jagatud annuiteeditegur (makse aasta alguses, saldo kasvab edasi), mitte lihtsalt 1/left.
          sched = left > 0 ? fund / annuityDue(left, r) : 0;
        }
        fund -= sched;
        // Eraldi III sammas fondipensionina: uus leping igal aastal (maksuvaba).
        if (sep && sep.mode === 'fund') { sched3 = fund3 / fundPensionTerm(table, input.sex, age); fund3 -= sched3; }
        // 2) vajaduse katmine: hoius, siis lisaväljamakse sambast (10%), viimasena eraldi III sambast (10%)
        let gap = needYear - i1 - sched - sched3;
        if (gap > 0) {
          fromDeposit = Math.min(deposit, gap); deposit -= fromDeposit; gap -= fromDeposit;
          if (gap > 0 && fund > 0) {
            const gross = Math.min(fund, gap / (1 - TAX_SHORT));
            fund -= gross; extraNet = gross * (1 - TAX_SHORT); gap -= extraNet;
          }
          if (gap > 0 && fund3 > 0) {
            const gross3 = Math.min(fund3, gap / (1 - TAX_SHORT));
            fund3 -= gross3; extra3 = gross3 * (1 - TAX_SHORT); gap -= extra3;
          }
        } else {
          saved = -gap; deposit += saved;
        }
      }
      // Kasv enne pensioniiga on kogumisfaasis (ülal) juba arvestatud; siin kasvab vara ainult pensionieast alates.
      // Kasv ja hoiuse väärtuse muutus pensionieast (ühekordne väljamakse on arvestatud pensioniea seisuga).
      if (age >= pa) { fund *= 1 + r; fund3 *= 1 + r; deposit *= 1 + rd; }
      const income = i1 + sched + extraNet + sched3 + extra3;
      const spend = income + fromDeposit - saved;
      rows.push({
        age: age,
        year: input.birthYear + age,
        i1: i1 / 12,
        i23: (sched + extraNet + sched3 + extra3) / 12,
        i2: (sched + extraNet) / 12, // II sammas (ühine pott); eraldi III samba pott on i3
        i3: (sched3 + extra3) / 12,
        dep: fromDeposit / 12,
        spend: spend / 12,
        shortfall: age >= pa ? Math.max(0, needYear - spend) / 12 : 0,
        moneyLeft: fundStart + depositStart,
        alive: survival(table, input.sex, currentAge, age),
      });
    }
    return summarize(rows, input, table, pa, p1Start, currentAge);
  }

  function summarize(rows, input, table, pa, p1Start, currentAge) {
    const fromPa = rows.filter((x) => x.age >= pa);
    const short = fromPa.find((x) => x.shortfall > 0.5);
    // Esimene puudujäägi vahemik. Kui pärast seda puudujääki enam ei ole, on see ajutine auk (riiklik pension algab hiljem).
    let gapEnd = null, gapTemporary = false;
    if (short) {
      let i = rows.indexOf(short);
      while (i + 1 < rows.length && rows[i + 1].shortfall > 0.5) i++;
      gapEnd = rows[i].age;
      gapTemporary = gapEnd < MAX_AGE && !rows.slice(i + 1).some((x) => x.shortfall > 0.5);
    }
    const empty = fromPa.find((x) => x.moneyLeft < 1 && x.age >= p1Start);
    const at = (age) => rows.find((x) => x.age === age);
    const startRow = at(pa) || rows[0];
    const horizon = horizonAge(table, input.sex, currentAge);
    return {
      rows: rows,
      pensionStartAge: pa,
      p1StartAge: p1Start,
      horizonAge: horizon,
      startSpend: startRow.spend,
      startIncome: startRow.i1 + startRow.i23 + startRow.dep,
      coversNeedUntil: short ? short.age : null, // null = katab kuni 100
      gapEnd: gapEnd,
      gapTemporary: gapTemporary,
      aliveAtShortfall: short ? short.alive : 0,
      moneyEndAge: empty ? empty.age : null, // samba ja hoiuse raha lõpeb; null = ei lõpe enne 100
      incomeAfterMoney: empty ? empty.i1 : null,
      spendAt90: (at(90) || { spend: 0 }).spend,
      expectedLifetime: fromPa.reduce((s, x) => s + x.spend * 12 * x.alive, 0),
    };
  }

  // Suurim kuuvajadus, mille stsenaarium katab „elu lõpuni“ (10% ellujäämise vanuseni).
  function sustainableNeed(input, table, scenario) {
    let lo = 0, hi = 10000;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      const s = simulate(input, table, scenario, m);
      if (s.coversNeedUntil === null || s.coversNeedUntil > s.horizonAge) lo = m; else hi = m;
    }
    return Math.floor(lo / 10) * 10;
  }

  const SCENARIOS = [
    { id: 'A', name: 'Kõik korraga', short: 'II ja III sammas ühekordselt välja (10% maks), raha hoiusel, kasutad vajaduse järgi.' },
    { id: 'B', name: 'Üks fondipensioni leping', short: 'Maksuvaba fondipension elada jäänud aastate peale. Leping lõpeb perioodi lõpus.' },
    { id: 'C', name: 'Sild ja riiklik pension hiljem', short: 'Riiklik pension algab hiljem ja on eluks ajaks suurem. Seni elad sambast: maksuvaba fondipension (leping igal aastal uuesti), puudu jääv osa lisaväljamaksena.' },
    { id: 'D', name: 'Leping igal aastal uuesti', short: 'Maksuvaba fondipension, mille lepingu sõlmid igal aastal uuesti. Ei saa otsa, aga väheneb vanas eas.' },
  ];

  const api = { CURRENT_YEAR, DEFERRAL_INCREASE, SCENARIOS, pensionAge, retirementYears, yearlyContribution, survival, horizonAge, fundPensionTerm, annuityDue, decisionMap, simulate, sustainableNeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pension = api;
})(typeof window !== 'undefined' ? window : globalThis);
