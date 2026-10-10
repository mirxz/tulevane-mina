// Tuleva-tulevik prototüübi 1 (kalkulaator) mootor, ristkontrolliks. Allikas: meelisb/tuleva-tulevik kalkulaator/pension.js (37e7cc3). Ära muuda käsitsi.
// Tulevane Mina: arvutusloogika. Puhtad funktsioonid, töötab brauseris ja Node'is (testid).
// Kõik summad on tänases rahas (inflatsiooniga korrigeeritud). Mudel on aastapõhine.
//
// Kulureegel: kui töötamine lõpeb, kulutad igal aastal oma vajaduse. Allikad järjekorras (Tuleva otsustuspuu):
// riiklik pension → II ja III samba plaanijärgsed väljamaksed → hoius → kogumisfond → III samba lisaväljamakse →
// II samba lisaväljamakse. Ülejääk läheb hoiusele. Töötamise ajal katab vajaduse palk ja kõik väljamaksed lähevad hoiusele.
(function (root) {
  'use strict';

  const CURRENT_YEAR = 2026;
  const MAX_AGE = 100;
  const HORIZON_SURVIVAL = 0.10; // „elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest

  // Riikliku pensioni muutus aastat varem (−) või hiljem (+): SKA 2026 keskmised.
  // https://sotsiaalkindlustusamet.ee/pension-ja-seotud-huvitised/pensioni-liigid/paindlik-pension
  const STATE_COEF = { '-5': -0.3067, '-4': -0.255, '-3': -0.1988, '-2': -0.1378, '-1': -0.0717, '0': 0, '1': 0.0793, '2': 0.1688, '3': 0.2701, '4': 0.385, '5': 0.5157 };

  const TAX_REDUCED = 0.10;   // ühekordne, osaline või lühike väljamakse soodusvanusest
  const TAX_EARLY = 0.22;     // enne soodusvanust; kogumisfondi kasvutulu
  const III_REFUND = 0.22;    // III samba sissemakse tulumaksutagastus
  const II_STATE = 0.04;      // riigi osa II sambasse (sotsiaalmaksust)
  const II_MIN_AGE = 60;      // II sammas: pensioniiga − 5 (lihtsustatult 60)

  // Pensioniiga kalendriaasta järgi. 2028 ja 2029 on eelnõud; hilisemad on teadmata.
  function pensionAge(birthYear) {
    const y65 = birthYear + 65;
    let months = 0;
    if (y65 === 2027) months = 1;
    else if (y65 === 2028) months = 3;
    else if (y65 >= 2029) months = 4;
    const known = y65 <= 2027;
    return { years: 65, months: months, known: known, label: (known ? '' : 'u ') + '65 a' + (months ? ' ' + months + ' k' : '') + (y65 > 2029 ? '+' : '') };
  }

  function survival(table, sex, fromAge, age) {
    const s = table.ellujaajad[sex];
    if (age > MAX_AGE) return 0;
    if (age <= fromAge) return 1;
    return s[age] / s[fromAge];
  }

  function horizonAge(table, sex, fromAge) {
    for (let a = fromAge; a <= MAX_AGE; a++) if (survival(table, sex, fromAge, a) <= HORIZON_SURVIVAL) return a;
    return MAX_AGE;
  }

  // Fondipensioni soovituslik (maksuvaba) periood: elada jäänud aastad vanuse ja soo järgi.
  function fundPensionTerm(table, sex, age) {
    return Math.max(1, Math.round(table.elada_jaanud[sex][Math.min(age, MAX_AGE)]));
  }

  function p3ReducedAge(input) { return input.p3Before2021 ? 55 : 60; }

  // Kuuvajadus vanuses `age` (hooldekodu alates määratud vanusest asendab osa tavakuludest).
  function needAt(input, age, base) {
    const b = base !== undefined ? base : input.needMonthly;
    if (input.care && input.care.on && age >= input.care.fromAge) return Math.max(0, b - (input.care.replaces || 0)) + input.care.monthly;
    return b;
  }

  // Ühe samba plaanijärgne väljamakse sellel aastal. Muudab samba objekti.
  function scheduled(pillar, age, table, sex) {
    const m = pillar.plan.method, start = pillar.start;
    if (age < start || pillar.bal <= 0) return 0;
    if (m === 'renew') return pillar.bal / fundPensionTerm(table, sex, age);
    if (m === 'fund') {
      if (pillar.term === undefined) pillar.term = fundPensionTerm(table, sex, start);
      const left = pillar.term - (age - start);
      return left > 0 ? pillar.bal / left : 0;
    }
    return 0; // 'keep' ja 'lump' (lump käsitletakse eraldi)
  }

  function simulate(input, table, plan, needOverride) {
    const r = input.realReturn;
    const rd = input.depositReturn !== undefined ? input.depositReturn : -0.01;
    const pa = input.pensionAgeYears || pensionAge(input.birthYear).years;
    const currentAge = CURRENT_YEAR - input.birthYear;
    const workUntil = Math.max(currentAge, input.workUntil || pa);
    const stateOffset = plan.stateOffset || 0;
    const stateStart = pa + stateOffset;
    const stateYear = input.p1Monthly * (1 + STATE_COEF[String(stateOffset)]) * 12;
    const p3Reduced = p3ReducedAge(input);
    const gross = (input.grossMonthly || 0) * 12;

    // Algus ei saa olla minevikus: kui oled valitud vanusest vanem, algab väljamakse sel aastal.
    const ii = { bal: input.p2, plan: plan.p2, start: Math.max(plan.p2.start, currentAge) };
    const iii = { bal: input.p3, plan: plan.p3, start: Math.max(plan.p3.start, currentAge) };
    let tkf = input.tkf || 0, tkfBasis = tkf, dep = input.savings || 0;
    let iiStopped = false, iiStoppedAge = null;
    let taxTotal = 0, stateSupport = 0, refundTotal = 0;

    const rows = [];
    for (let age = currentAge; age <= MAX_AGE; age++) {
      const working = age < workUntil;
      const moneyStart = ii.bal + iii.bal + tkf + dep;
      // 1) sissemaksed töötamise ajal
      if (working) {
        if (!iiStopped && input.p2Rate > 0) {
          ii.bal += gross * (input.p2Rate + II_STATE);
          stateSupport += gross * II_STATE;
        }
        const c3 = (input.p3Monthly || 0) * 12;
        iii.bal += c3;
        const refund = Math.min(c3, 0.15 * gross, 6000) * III_REFUND;
        dep += refund; refundTotal += refund; stateSupport += refund;
        tkf += (input.tkfMonthly || 0) * 12; tkfBasis += (input.tkfMonthly || 0) * 12;
      }
      // 2) ühekordne väljamakse alguses
      for (const [p, name] of [[ii, 'ii'], [iii, 'iii']]) {
        if (p.plan.method === 'lump' && age === p.start && p.bal > 0) {
          const t = name === 'iii' && age < p3Reduced ? TAX_EARLY : TAX_REDUCED;
          taxTotal += p.bal * t; dep += p.bal * (1 - t); p.bal = 0;
          if (name === 'ii' && !iiStopped) { iiStopped = true; iiStoppedAge = age; }
        }
      }
      // 3) plaanijärgsed (maksuvabad) väljamaksed
      const s2 = scheduled(ii, age, table, input.sex); ii.bal -= s2;
      const s3gross = scheduled(iii, age, table, input.sex); iii.bal -= s3gross;
      // III sammas enne soodusvanust (55 või 60): ka igakuine väljamakse on 22% maksuga.
      const s3tax = age < p3Reduced ? s3gross * TAX_EARLY : 0;
      const s3 = s3gross - s3tax; taxTotal += s3tax;
      if (s2 > 0 && !iiStopped) { iiStopped = true; iiStoppedAge = age; }
      const i1 = age >= stateStart ? stateYear : 0;
      const income = i1 + s2 + s3;

      let fromDep = 0, fromTkf = 0, extra2 = 0, extra3 = 0, shortfall = 0, need = 0;
      if (working) {
        dep += income; // palk katab vajaduse, väljamaksed kogunevad hoiusele
      } else {
        need = needAt(input, age, needOverride) * 12;
        let gap = need - income;
        if (gap > 0) {
          fromDep = Math.min(Math.max(dep, 0), gap); dep -= fromDep; gap -= fromDep;
          if (gap > 0 && tkf > 0) {
            const gainShare = Math.max(0, 1 - tkfBasis / tkf);
            const netPerGross = 1 - gainShare * TAX_EARLY;
            const g = Math.min(tkf, gap / netPerGross);
            taxTotal += g * gainShare * TAX_EARLY; tkfBasis -= g * (tkfBasis / tkf); tkf -= g;
            fromTkf = g * netPerGross; gap -= fromTkf;
          }
          if (gap > 0 && iii.bal > 0) {
            const t = age < p3Reduced ? TAX_EARLY : TAX_REDUCED;
            const g = Math.min(iii.bal, gap / (1 - t));
            iii.bal -= g; taxTotal += g * t; extra3 = g * (1 - t); gap -= extra3;
          }
          if (gap > 0 && ii.bal > 0 && age >= II_MIN_AGE) {
            const g = Math.min(ii.bal, gap / (1 - TAX_REDUCED));
            ii.bal -= g; taxTotal += g * TAX_REDUCED; extra2 = g * (1 - TAX_REDUCED); gap -= extra2;
            if (!iiStopped) { iiStopped = true; iiStoppedAge = age; }
          }
          shortfall = Math.max(0, gap);
        } else {
          dep += -gap;
        }
      }
      // 4) kasv
      ii.bal *= 1 + r; iii.bal *= 1 + r; tkf *= 1 + r; dep *= 1 + rd;
      rows.push({
        age: age,
        year: input.birthYear + age,
        working: working,
        need: need / 12,
        i1: i1 / 12,
        i23: (s2 + s3 + extra2 + extra3) / 12,
        sav: (fromDep + fromTkf) / 12,
        shortfall: shortfall / 12,
        moneyLeft: moneyStart,
        alive: survival(table, input.sex, currentAge, age),
        taxToDate: taxTotal,
      });
    }
    const needStart = workUntil;
    const fromStart = rows.filter((x) => x.age >= needStart);
    const short = fromStart.find((x) => x.shortfall > 0.5);
    // Esimene puudujäägi vahemik. Kui pärast seda puudujääki enam ei ole, on see ajutine auk
    // (nt riiklik pension algab hiljem või II sammas on kättesaadav alles 60-aastaselt).
    let gapEnd = null, gapTemporary = false;
    if (short) {
      const i0 = rows.indexOf(short);
      let i = i0;
      while (i + 1 < rows.length && rows[i + 1].shortfall > 0.5) i++;
      gapEnd = rows[i].age;
      gapTemporary = gapEnd < MAX_AGE && !rows.slice(i + 1).some((x) => x.shortfall > 0.5);
    }
    const at = (a) => rows.find((x) => x.age === a);
    const horizon = horizonAge(table, input.sex, currentAge);
    const r90 = at(90) || rows[rows.length - 1];
    return {
      rows: rows,
      pensionAge: pa,
      stateStart: stateStart,
      workUntil: workUntil,
      horizonAge: horizon,
      lastsUntil: short ? short.age : null, // null = jätkub kuni 100
      aliveBeyond: short ? short.alive : 0,
      stateAfter: short ? stateYear / 12 : null, // riiklik pension kuus (ka siis, kui see algab alles hiljem)
      gapEnd: gapEnd,
      gapTemporary: gapTemporary,
      needAfter: short ? short.need : null,
      spendAt90: r90.i1 + r90.i23 + r90.sav,
      inheritance90: r90.moneyLeft,
      tax90: r90.taxToDate,
      stateSupport: stateSupport,
      refundTotal: refundTotal,
      iiStoppedAge: iiStoppedAge,
    };
  }

  // Suurim ühtlane kuuvajadus, mille plaan katab „elu lõpuni“ (10% ellujäämise vanuseni).
  function sustainableNeed(input, table, plan) {
    let lo = 0, hi = 10000;
    for (let i = 0; i < 28; i++) {
      const m = (lo + hi) / 2;
      const s = simulate(input, table, plan, m);
      if (s.lastsUntil === null || s.lastsUntil > s.horizonAge) lo = m; else hi = m;
    }
    return Math.floor(lo / 10) * 10;
  }

  // Valmisstrateegiad võrdluseks. Sinu oma plaan tuleb kasutajaliidesest.
  // Sammaste väljamakse vaikimisi algus: kui töö lõpeb, aga mitte enne, kui seda soodsa maksuga saab
  // (II sammas 60, III sammas 55 või 60). Nii ei kao riigi 4% ja töötamise ajal ei koguneta raha hoiusele.
  function payoutStart(input) {
    const pa = input.pensionAgeYears || pensionAge(input.birthYear).years;
    const end = Math.max(CURRENT_YEAR - input.birthYear, input.workUntil || pa);
    return { p2: Math.max(II_MIN_AGE, end), p3: Math.max(p3ReducedAge(input), end) };
  }

  // Valmisstrateegiad võrdluseks. Erinevad ainult väljamakse viisi poolest; algus on kõigil sama.
  function presets(input) {
    const pa = input.pensionAgeYears || pensionAge(input.birthYear).years;
    const st = payoutStart(input);
    const both = (method) => ({ p2: { method: method, start: st.p2 }, p3: { method: method, start: st.p3 } });
    // Kui oled juba vanem kui pensioniiga + 2, ei saa riiklikku pensioni enam 2 aastat hiljem alustada.
    const later = pa + 2 >= CURRENT_YEAR - input.birthYear ? 2 : 0;
    return [
      Object.assign({ id: 'A', name: 'Kõik korraga', short: 'II ja III sammas korraga välja, kui töö lõpeb (10% maks), raha hoiusel.', stateOffset: 0 }, both('lump')),
      Object.assign({ id: 'B', name: 'Üks fondipensioni leping', short: 'Maksuvaba igakuine väljamakse elada jäänud aastate peale. Lõpeb perioodi lõpus.', stateOffset: 0 }, both('fund')),
      Object.assign({ id: 'C', name: 'Leping igal aastal uuesti', short: 'Maksuvaba igakuine väljamakse, leping uueneb igal aastal. Ei saa otsa, väheneb vanas eas.', stateOffset: 0 }, both('renew')),
      Object.assign({ id: 'D', name: 'Riiklik pension 2 a hiljem', short: 'Paindlik pension: riiklik pension algab 2 aastat hiljem (+16,88% eluks ajaks), vahepeal elad sammastest.', stateOffset: later }, both('renew')),
    ];
  }

  const api = { CURRENT_YEAR, STATE_COEF, pensionAge, survival, horizonAge, fundPensionTerm, p3ReducedAge, needAt, simulate, sustainableNeed, payoutStart, presets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pension = api;
})(typeof window !== 'undefined' ? window : globalThis);
