// Tulevane Mina: arvutusloogika. Puhtad funktsioonid, töötab brauseris ja Node'is (testid).
// Kõik summad on tänastes eurodes (reaalväärtus). Mudel on aastapõhine.
//
// Ühine kulureegel (kõik stsenaariumid): igal aastal kulutad oma vajaduse.
// Allikad järjekorras: riiklik pension → samba plaanijärgne väljamakse → hoius (varasemad ülejäägid
// või ühekordne väljamakse) → lisaväljamakse sambast (10% maks). Ülejääk läheb hoiusele (reaaltootlus 0%).
// Nii on stsenaariumid võrreldavad: kõik püüavad katta sama vajaduse ja erinevad ainult maksu,
// tootluse, riikliku pensioni ajastuse ja väljamakse graafiku poolest.
// Allikas: github.com/meelisb/tuleva-tulevik (js/pension.js), Meelis Bobrov / tiim Tulevane Mina.
// Muudatused selles koopias on märgitud "LISA": fondi tasu, reaalne palgakasv, hoiuse algsumma, hoiuse tootlus,
// maksumäär ja „elu lõpuni“ ellujäämise lävi on sisendid; vaikeväärtused annavad täpselt Meelise tulemuse.

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
  function horizonAge(table, sex, fromAge, threshold) {
    const thr = threshold || HORIZON_SURVIVAL; // LISA: lävi on sisend
    for (let a = fromAge; a <= MAX_AGE; a++) if (survival(table, sex, fromAge, a) <= thr) return a;
    return MAX_AGE;
  }

  // Fondipensioni soovituslik (maksuvaba) periood: elada jäänud aastad vanuse ja soo järgi, täisaastateks ümardatud.
  function fundPensionTerm(table, sex, age) {
    return Math.max(1, Math.round(table.elada_jaanud[sex][Math.min(age, MAX_AGE)]));
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
    const r = input.realReturn - (input.fee || 0); // LISA: fondi tasu vähendab reaaltootlust
    const sr = input.savingsReturn || 0; // LISA: hoiuse reaaltootlus (vaikimisi 0%)
    const g = input.wageGrowth || 0; // LISA: palga ja sissemaksete reaalkasv aastas
    const p1g = input.p1Growth || 0; // LISA: riikliku pensioni reaalne indekseerimine aastas (vaikimisi 0 = Meelise tulemus)
    const tax = input.tax !== undefined ? input.tax : TAX_SHORT; // LISA: ühekordse väljamakse maks
    const pa = retirementYears(input);
    const currentAge = CURRENT_YEAR - input.birthYear;
    const startAge = Math.max(currentAge, 55);
    const deferral = scenario.id === 'C' ? scenario.deferral : 0;
    const p1Start = pa + deferral;
    const p1Year = input.p1Monthly * (1 + DEFERRAL_INCREASE[deferral]) * 12;
    const needYear = need * 12;

    // Samba vara kasvab kuni kasutamiseni ja sinna lisanduvad sissemaksed.
    let fund = input.p2 + input.p3;
    const contrib = yearlyContribution(input);
    for (let a = currentAge; a < pa; a++) fund = fund * (1 + r) + contrib * Math.pow(1 + g, a - currentAge);

    let deposit = input.savings || 0; // LISA: muud säästud täna
    // Hoius kasvab tänasest pensionini samamoodi kui sammas (varem kasvas ta alles vanusest max(vanus, 55)).
    for (let a = currentAge; a < pa; a++) deposit *= 1 + sr;
    if (scenario.id === 'A') { deposit += fund * (1 - tax); fund = 0; }
    // Ühe lepingu fondipension: periood määratakse lepingu sõlmimisel.
    const contractStart = scenario.id === 'B' ? pa : scenario.id === 'C' ? p1Start : null;
    const contractTerm = contractStart !== null ? fundPensionTerm(table, input.sex, contractStart) : 0;

    const rows = [];
    for (let age = startAge; age <= MAX_AGE; age++) {
      const fundStart = fund, depositStart = deposit;
      const i1 = age >= p1Start ? p1Year * Math.pow(1 + p1g, age - currentAge) : 0; // LISA: riikliku pensioni reaalne indekseerimine tänasest peale (p1Monthly = tänaste väärtustega)
      let sched = 0, extraNet = 0, fromDeposit = 0, saved = 0;
      if (age >= pa) {
        // 1) plaanijärgne maksuvaba väljamakse
        if (scenario.id === 'D') {
          sched = fund / fundPensionTerm(table, input.sex, age); // uus leping igal aastal lühima maksuvaba perioodiga
        } else if (contractStart !== null && age >= contractStart) {
          const left = contractTerm - (age - contractStart);
          sched = left > 0 ? fund / left : 0;
        }
        fund -= sched;
        // 2) vajaduse katmine: hoius, siis lisaväljamakse sambast (10%)
        let gap = needYear - i1 - sched;
        if (gap > 0) {
          fromDeposit = Math.min(deposit, gap); deposit -= fromDeposit; gap -= fromDeposit;
          if (gap > 0 && fund > 0) {
            const gross = Math.min(fund, gap / (1 - tax));
            fund -= gross; extraNet = gross * (1 - tax); gap -= extraNet;
          }
        } else {
          saved = -gap; deposit += saved;
        }
      }
      // Kasv enne pensioniiga on kogumisfaasis juba arvestatud; siin kasvab vara ainult pensionieast alates (muidu kasvaks see kaks korda).
      if (age >= pa) { fund *= 1 + r; deposit *= 1 + sr; }
      const income = i1 + sched + extraNet;
      const spend = income + fromDeposit - saved;
      rows.push({
        age: age,
        year: input.birthYear + age,
        i1: i1 / 12,
        i23: (sched + extraNet) / 12,
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
    const empty = fromPa.find((x) => x.moneyLeft < 1 && x.age >= p1Start);
    const at = (age) => rows.find((x) => x.age === age);
    const startRow = at(pa) || rows[0];
    const horizon = horizonAge(table, input.sex, currentAge, input.horizon);
    return {
      rows: rows,
      pensionStartAge: pa,
      p1StartAge: p1Start,
      horizonAge: horizon,
      startSpend: startRow.spend,
      startIncome: startRow.i1 + startRow.i23 + startRow.dep,
      coversNeedUntil: short ? short.age : null, // null = katab kuni 100
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
    { id: 'C', name: 'Sild ja riiklik pension hiljem', short: 'Esimesed aastad elad samba rahast, riiklik pension algab hiljem ja on eluks ajaks suurem.' },
    { id: 'D', name: 'Leping igal aastal uuesti', short: 'Maksuvaba fondipension, mille lepingu sõlmid igal aastal uuesti. Ei saa otsa, aga väheneb vanas eas.' },
  ];

  // ES-mooduli eksport (Meelise originaalis window.Pension)

export { CURRENT_YEAR, DEFERRAL_INCREASE, SCENARIOS, pensionAge, retirementYears, yearlyContribution, survival, horizonAge, fundPensionTerm, decisionMap, simulate, sustainableNeed, HORIZON_SURVIVAL, TAX_SHORT };
