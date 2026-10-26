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
  // Tulumaks pensionieas (EMTA ja SKA, 2026): 22% tulumaks; vanaduspensioniealisel on maksuvaba tulu 776 € kuus (9312 € aastas),
  // mis ei sõltu tulust. SKA arvestab selle riiklikult pensionilt automaatselt, kasutamata osa rakendab Pensionikeskus
  // 10% tulumaksuga väljamaksetele. Maksuvaba (elada jäänud aastate) fondipensionil tulumaksu pole. Arvutus on tänastes eurodes,
  // seega eeldab, et maksuvaba tulu kasvab koos hindadega. Väljalülitamiseks input.incomeTax = false.
  const INCOME_TAX = 0.22;
  const PENSIONER_ALLOWANCE = 776 * 12;
  // Üldine maksuvaba tulu enne pensioniiga (EMTA, 2026): 700 € kuus. Mudel rakendab seda eripensionile enne pensioniiga
  // ainult siis, kui inimene ei tööta (grossMonthly 0); töötades kasutab maksuvaba tulu palk [inferred].
  const GENERAL_ALLOWANCE = 700 * 12;
  // Töötamine pensioni ajal tõstab riiklikku pensioni (RPKS § 25: ümberarvutus igal aastal 1. aprillist).
  // Iga tööaasta: (kindlustusosak + solidaarosak) / 2 × aastahinne (RPKS § 12, § 13¹). Sama valem mis tuleva-tulevik repos.
  const AASTAHINNE = 10.477; // SKA, alates 1.04.2026
  const AVG_WAGE = 2092; // keskmine brutokuupalk 2025, Statistikaamet PA103
  const MIN_WAGE = 946; // töötasu alammäär alates 1.04.2026
  function workAccrual(grossMonthly, iiContributing, iiJoined) {
    if (!(grossMonthly > 0)) return 0;
    const share = iiContributing ? 0.8 : 1; // II sambaga liitunul läheb riiklikku kindlustusse 16% palgast (mitte 20%)
    return AASTAHINNE * (share * grossMonthly / AVG_WAGE + Math.min(iiJoined ? 0.8 : 1, share * grossMonthly / MIN_WAGE)) / 2;
  }

  // Ühekordse (10% maksuga) summa kätte jääv osa, kui maksuvaba tulust on veel allowance alles.
  function netTenPercent(gross, allowance) {
    return gross - TAX_SHORT * Math.max(0, gross - allowance);
  }
  // Bruto väljamakse, mis annab soovitud summa kätte (pöördfunktsioon).
  function grossForNet(net, allowance) {
    return net <= allowance ? net : (net - TAX_SHORT * allowance) / (1 - TAX_SHORT);
  }

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

  // Pensioniiga aastates: kasutaja (või Tuleva konto) antud väärtus või ligikaudne reegel.
  function retirementYears(input) {
    return input.pensionAgeYears || pensionAge(input.birthYear).years;
  }

  // Aastane sissemakse sammastesse kuni pensionini (tänastes eurodes, palk reaalselt ei kasva).
  // II sammas: töötaja 2/4/6% + riik 4% sotsiaalmaksust, kui II sammas on aktiivne. III sammas: oma kuumakse.
  // Vanusega (age), eripensioni ajal (algusvanusest): ilma tööta (spWork === false) lõpevad II samba sissemaksed,
  // uue palgaga (spGross) arvestatakse sissemakset uuest palgast. III sambasse maksad edasi.
  function yearlyContribution(input, age) {
    const rate = input.p2Rate || 0;
    const during = age !== undefined && (input.spMonthly || 0) > 0 && age >= specialStart(input);
    const gross = during ? (input.spWork === false ? 0 : input.spGross !== undefined ? input.spGross : input.grossMonthly || 0) : input.grossMonthly || 0;
    return gross * 12 * (rate > 0 ? rate + 0.04 : 0) + (input.p3Monthly || 0) * 12;
  }

  // Varem pensionile ilma vähenduseta (SKA, kontrollitud 16.10.2026). Lapsed (input.kids, õigust kasutab üks vanem):
  // 3 last 1 a, 4 last 3 a, 5+ last või puudega laps 5 a. Tervist kahjustav töö (SVPS, input.hazard): nimekiri nr 1 10 a,
  // nimekiri nr 2 5 a (staaž kuni 31.12.2030, põlevkivi 2049). Eraldi alused; mootor võtab suurema [inferred].
  function earlyYears(input) {
    const k = input.kids || {};
    const n = (k.b1991 || 0) + (k.b2012 || 0) + (k.b2013 || 0);
    const kidsY = k.user !== 'me' ? 0 : k.disabled ? 5 : n >= 5 ? 5 : n === 4 ? 3 : n === 3 ? 1 : 0;
    const hazardY = input.hazard === 'list1' ? 10 : input.hazard === 'list2' ? 5 : 0;
    return Math.max(kidsY, hazardY);
  }

  // Laste pensionilisa kuus (SKA): enne 1991 sündinud 1,5 aastahinnet, 1991–2012 3,5 aastahinnet; 2013+ sündinud lapse eest
  // maksab riik II sambasse (ilma II sambata 3,5 aastahinnet). Ainult vanemale, kes õigust kasutab; eripensionile ei lisata.
  // Enne 1991 sündinud lapse 2 a staaži mudel ei arvesta (konservatiivne).
  function childSupplement(input) {
    const k = input.kids || {};
    if (k.user !== 'me') return 0;
    const noII = !((input.p2 || 0) > 0 || (input.p2Rate || 0) > 0);
    return AASTAHINNE * (1.5 * (k.b1991 || 0) + 3.5 * (k.b2012 || 0) + (noII ? 3.5 * (k.b2013 || 0) : 0));
  }

  // Eripensioni algusvanus: kasutaja valik, vaikimisi pensioniiga.
  function specialStart(input) {
    return input.spStartAge !== undefined ? input.spStartAge : retirementYears(input);
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
    // Eripension (TLV-69): kindel summa kuus alates kasutaja valitud vanusest (spStartAge, vaikimisi pensioniiga).
    // Kahte I samba pensioni korraga ei maksta (RPKS): pensionieas makstakse suurem kahest, eripension või vanaduspension.
    // Paindliku pensioni valikud (edasilükkamine) eripensionile ei kehti, seega eripensioniga edasilükkamist ei arvestata.
    const spYear = (input.spMonthly || 0) * 12;
    const spStart = specialStart(input);
    // Soodustingimustel vanaduspension (lapsed, tervist kahjustav töö): input.soodus aastat varem, pension ei vähene.
    // Muudab ainult pensionile mineku (ret) ja riikliku pensioni algust; tavaline pensioniiga (pa) jääb: sellest sõltuvad
    // II samba avanemine (pa − 5, Pensionikeskus) ja pensionäri maksuvaba tulu (776 € alates pa, enne seda 700 €, EMTA).
    const soodus = Math.max(0, input.soodus !== undefined ? input.soodus : earlyYears(input));
    const ret = pa - soodus;
    const deferral = spYear > 0 || soodus > 0 ? 0 : (scenario.deferral || 0); // C: sild fondipensioniga; teised stsenaariumid võivad samuti edasi lükata
    const p1Start = ret + deferral;
    // Laste pensionilisa lisandub vanaduspensionile, kui prognoos seda veel ei sisalda (kids.inForecast 'no'; 'ei tea' → ei lisa).
    const kidsMonthly = childSupplement(input);
    const kidsApplied = kidsMonthly > 0 && (input.kids || {}).inForecast === 'no';
    const p1Full = (input.p1Monthly + (kidsApplied ? kidsMonthly : 0)) * (1 + DEFERRAL_INCREASE[deferral]) * 12; // enne tulumaksu
    // Töötamine soodustusega pensioni ajal (input.soodusWork, kuni input.workUntil, vaikimisi tavaline pensioniiga):
    // palk katab kulud, riiklik pension läheb hoiusele, II ja III sissemaksed jätkuvad, samba väljamaksed algavad töö lõppedes.
    const workEnd = soodus > 0 && input.soodusWork ? Math.max(ret, input.workUntil !== undefined ? input.workUntil : pa) : ret;
    const iiJoined = (input.p2Rate || 0) > 0;
    const accrualYear = 12 * workAccrual(input.grossMonthly || 0, iiJoined, iiJoined);
    const workedBefore = (age) => Math.max(0, Math.min(age, workEnd) - Math.max(ret, currentAge));
    // Pärast töö lõppu III samba sissemakse (p3After, vaikimisi sama) kuni tavalise pensionieani; tuleb sissetulekust [inferred].
    const c3After = soodus > 0 ? (input.p3After !== undefined ? input.p3After : input.p3Monthly || 0) * 12 : 0;
    const spPaid = spYear > 0 && spYear >= p1Full; // pensionieas jätkub eripension (võrdse summa korral uut rida ei teki)
    const p1Year = spPaid ? 0 : p1Full;
    const taxOn = input.incomeTax !== false;
    const allowance = taxOn ? PENSIONER_ALLOWANCE : 0;
    const needYear = need * 12;
    // Eripension aastas vanuse järgi: enne pensioniiga valitud vanusest, pensionieas ainult siis, kui see on suurem.
    const spAt = (age) => (age < spStart ? 0 : age < p1Start ? spYear : spPaid ? spYear : 0);
    // Eripensioni ajal: töötad edasi muul kutsealal (palk, vajadusel uus palk spGross)?
    const working = input.spWork !== false && (input.spGross !== undefined ? input.spGross : input.grossMonthly) > 0;
    // Üldine maksuvaba tulu enne tavalist pensioniiga: kui ei tööta (eripensioni ajal tööga kasutab selle palk).
    const generalAt = (age) => (taxOn && !(age < ret && working) && !(age >= ret && age < workEnd) ? GENERAL_ALLOWANCE : 0);
    const allowAt = (age) => (age >= pa ? allowance : generalAt(age));
    // Sammaste avanemine: II sammas (ja ühine pott) 5 a enne tavalist pensioniiga, eraldi III sammas 55 (enne 2021) või 60.
    // Enne pensionile minekut (ret) väljamakseid mudelis pole.
    const open2 = Math.max(workEnd, pa - 5);
    const open3 = Math.max(workEnd, input.p3Before2021 ? 55 : 60);

    // Samba vara kasvab kuni kasutamiseni ja sinna lisanduvad sissemaksed.
    // Valikuline eraldi III sammas (input.p3Sep = { amount, mode: 'grow' | 'lump' | 'fund' }): oma pott, oma väljamakse viis.
    // Ilma selleta on III sammas II sambaga ühes potis (senine käitumine).
    const sep = input.p3Sep || null;
    const c3 = sep ? (input.p3Monthly || 0) * 12 : 0;
    let fund = input.p2 + input.p3;
    let fund3 = sep ? sep.amount : 0;
    for (let a = currentAge; a < workEnd; a++) { fund = fund * (1 + r) + yearlyContribution(input, a) - c3; fund3 = fund3 * (1 + r) + c3; }

    // Hoius pensioni alguses: varem sambast välja võetud ja kõrvale pandud raha (valikuline, vaikimisi 0).
    let deposit = input.extraDeposit || 0;
    // Ühekordne väljavõtt pensioniea aastal: 10% tulumaks, millest saab maha arvata pensioniea aasta kasutamata maksuvaba tulu.
    // Ühekordne väljavõte tehakse siis, kui sammas avaneb. Maksuvaba tulu arvestatakse ainult pensionieas (enne seda konservatiivselt 0).
    const firstRetAge = Math.max(open2, startAge); // II samba (ühise poti) ühekordse väljavõtu aasta
    const lump3Age = Math.max(open3, startAge); // eraldi III samba ühekordse väljavõtu aasta
    let allowAtPa = firstRetAge >= pa ? Math.max(0, allowance - (firstRetAge >= p1Start ? p1Year : 0) - spAt(firstRetAge)) : 0;
    const lumpNet = (gross) => {
      const used = Math.min(allowAtPa, gross);
      allowAtPa -= used;
      return gross - TAX_SHORT * (gross - used);
    };
    const lumpOut = (pot) => (taxOn ? lumpNet(pot) : pot * (1 - TAX_SHORT));
    // Ühe lepingu fondipension: periood määratakse lepingu sõlmimisel (pensionieas või kohe, kui oled sellest vanem).
    // C (paindlik pension) kasutab sillaks maksuvaba fondipensioni. Leping uueneb vaikimisi igal aastal (nagu D),
    // scenario.contract === 'once' korral on see üks leping (nagu B).
    const onceC = scenario.id === 'C' && scenario.contract === 'once';
    // Fondipensioni algus (scenario.fundFrom, B ja D): enne seda kasvab raha edasi (vajadusel lisaväljamakse 10%), siis leping.
    const fundFrom = Math.max(open2, scenario.fundFrom || 0);
    const contractStart = scenario.id === 'B' || onceC ? Math.max(fundFrom, currentAge) : null;
    const contractTerm = contractStart !== null ? fundPensionTerm(table, input.sex, contractStart) : 0;
    // Eraldi III samba fondipension: sep.contract === 'once' → üks leping alates sep.start (vaikimisi pensioniiga), muidu uus leping igal aastal.
    const once3 = !!(sep && sep.mode === 'fund' && sep.contract === 'once');
    const start3 = once3 ? (sep.start !== undefined ? sep.start : Math.max(open3, currentAge)) : null;
    const term3 = once3 ? fundPensionTerm(table, input.sex, start3) : 0;

    const rows = [];
    for (let age = startAge; age <= MAX_AGE; age++) {
      if (scenario.id === 'A' && age === firstRetAge) { deposit += lumpOut(fund); fund = 0; }
      if (sep && sep.mode === 'lump' && age === lump3Age) { deposit += lumpOut(fund3); fund3 = 0; }
      const fundStart = fund + fund3, depositStart = deposit;
      const i1gross = age >= p1Start ? p1Year + (spPaid ? 0 : accrualYear * workedBefore(age)) : 0;
      const work = age >= ret && age < workEnd;
      const ispg = spAt(age);
      // Maksuvaba tulu: pensionieas pensionäri oma, enne seda üldine (kui ei tööta). Korraga on ainult üks I samba pension.
      const allowT = allowAt(age);
      const taxSp = taxOn ? INCOME_TAX * Math.max(0, ispg - allowT) : 0;
      const isp = ispg - taxSp;
      // Riiklik pension pärast tulumaksu: 22% maksuvaba tulu ületavalt osalt (alates pensioniea aastast).
      // Pensionieas on alati ainult üks I samba pension, seega maksuvaba tulu ei jagata.
      const tax1 = taxOn && age >= ret ? INCOME_TAX * Math.max(0, i1gross - Math.max(0, allowT - ispg)) : 0;
      const i1 = i1gross - tax1;
      // Kasutamata maksuvaba tulu 10% väljamaksetele: pensioniea aastal on lisaks ühekordsed väljavõtted ära kasutanud osa.
      let allowLeft = age >= pa ? (age === firstRetAge ? allowAtPa : Math.max(0, allowance - i1gross - ispg)) : 0;
      let sched = 0, extraNet = 0, fromDeposit = 0, saved = 0, sched3 = 0, extra3 = 0;
      if (work) {
        // Töötad: palk katab kulud, riiklik pension (ja eripension) läheb hoiusele.
        saved = i1 + isp; deposit += saved;
      } else if (age >= ret) {
        // 1) plaanijärgne maksuvaba väljamakse (alates samba avanemisest)
        if (age < open2 || (scenario.id === 'D' && age < fundFrom)) {
          sched = 0;
        } else if (scenario.id === 'D' || (scenario.id === 'C' && !onceC)) {
          sched = fund / fundPensionTerm(table, input.sex, age); // uus leping igal aastal lühima maksuvaba perioodiga
        } else if (contractStart !== null && age >= contractStart) {
          const left = contractTerm - (age - contractStart);
          // Seadus (KoPS § 52³ lg 8, § 60¹ lg 5): osakute arv jagatakse iga kord veel tegemata väljamaksete arvuga.
          // Euro makse = osakud × hind, seega makse järgib fondi väärtust (makse_k = pott / n × (1 + r)^k), see ei ole tasane.
          sched = left > 0 ? fund / left : 0;
        }
        fund -= sched;
        // Eraldi III sammas fondipensionina (maksuvaba): üks leping (osakud / veel tegemata väljamaksed) või uus leping igal aastal.
        // Uus leping igal aastal algab sep.start-ist (kui antud), üks leping start3-st.
        if (sep && sep.mode === 'fund' && age >= open3 && (once3 ? age >= start3 : sep.start === undefined || age >= sep.start)) {
          const left3 = once3 ? term3 - (age - start3) : 0;
          sched3 = once3 ? (left3 > 0 ? fund3 / left3 : 0) : fund3 / fundPensionTerm(table, input.sex, age);
          fund3 -= sched3;
        }
        // 2) vajaduse katmine: hoius, siis lisaväljamakse sambast (10%), viimasena eraldi III sambast (10%)
        // III samba sissemakse pärast pensionile minekut (kuni tavalise pensionieani) tuleb sissetulekust.
        const c3a = age < pa ? c3After : 0;
        if (c3a > 0) { if (sep) fund3 += c3a; else fund += c3a; }
        let gap = needYear + c3a - i1 - isp - sched - sched3;
        if (gap > 0) {
          fromDeposit = Math.min(deposit, gap); deposit -= fromDeposit; gap -= fromDeposit;
          if (gap > 0 && fund > 0 && age >= open2) {
            const gross = Math.min(fund, grossForNet(gap, allowLeft));
            extraNet = netTenPercent(gross, allowLeft); fund -= gross; gap -= extraNet; allowLeft = Math.max(0, allowLeft - gross);
          }
          if (gap > 0 && fund3 > 0 && age >= open3) {
            const gross3 = Math.min(fund3, grossForNet(gap, allowLeft));
            extra3 = netTenPercent(gross3, allowLeft); fund3 -= gross3; gap -= extra3; allowLeft = Math.max(0, allowLeft - gross3);
          }
        } else {
          saved = -gap; deposit += saved;
        }
      }
      // Kasv enne pensioniiga on kogumisfaasis (ülal) juba arvestatud; siin kasvab vara ainult pensionieast alates.
      // Kasv ja hoiuse väärtuse muutus pensionieast (ühekordne väljamakse on arvestatud pensioniea seisuga).
      if (age >= workEnd) { fund *= 1 + r; fund3 *= 1 + r; }
      if (age >= ret) deposit *= 1 + rd;
      const income = i1 + isp + sched + extraNet + sched3 + extra3;
      // Enne pensioniiga on eripension elamiseks (nagu palk); vajaduse katmist arvestab mudel pensioniast.
      const c3paid = !work && age >= ret && age < pa ? c3After : 0; // III sissemakse ei ole kulutus
      const spend = work ? needYear : age >= ret ? income + fromDeposit - saved - c3paid : isp;
      rows.push({
        age: age,
        year: input.birthYear + age,
        i1: i1 / 12, // riiklik pension pärast tulumaksu
        i1g: i1gross / 12, // enne tulumaksu
        tax1: tax1 / 12,
        isp: isp / 12, // eripension pärast tulumaksu
        ispg: ispg / 12, // enne tulumaksu
        taxSp: taxSp / 12,
        i23: (sched + extraNet + sched3 + extra3) / 12,
        i2: (sched + extraNet) / 12, // II sammas (ühine pott); eraldi III samba pott on i3
        i3: (sched3 + extra3) / 12,
        fp: (sched + sched3) / 12, // fondipensioni (lepingu) makse, maksuvaba
        extra: (extraNet + extra3) / 12, // lisaväljamakse sambast vajaduse katmiseks (10% tulumaks), kätte
        dep: fromDeposit / 12,
        spend: spend / 12,
        work: work, // töötad soodustusega pensioni ajal (palk katab kulud)
        shortfall: age >= ret ? Math.max(0, needYear - spend) / 12 : 0,
        moneyLeft: fundStart + depositStart,
        alive: survival(table, input.sex, currentAge, age),
      });
    }
    const res = summarize(rows, input, table, ret, p1Start, currentAge);
    res.ordinaryPensionAge = pa; // tavaline pensioniiga (pensionStartAge on soodustusega pensionile minek)
    res.childSupplement = kidsMonthly > 0 ? { monthly: kidsMonthly, applied: kidsApplied } : null;
    // Eripensioni ja vanaduspensioni võrdlus tulemuse selgituseks („Pensionieas makstakse sulle suurem kahest“).
    res.firstPillar = spYear > 0 ? { special: spYear / 12, oldAge: p1Full / 12, paid: spPaid ? 'special' : 'oldAge' } : null;
    return res;
  }

  // Millised otsused on kasutajale avatud ja miks mitte (UI lukustab sammud selle järgi, loogika on siin).
  function options(input) {
    const sp = !!input.spHas || (input.spMonthly || 0) > 0; // „Eripension: jah“ (summa võib olla veel sisestamata)
    const soodus = (input.soodus !== undefined ? input.soodus : earlyYears(input)) > 0;
    return {
      deferral: sp
        ? { open: false, reason: 'Eripensionile paindliku pensioni reeglid ei kehti: eripensioni ei saa edasi lükata, varem võtta ega peatada.' }
        : soodus ? { open: false, reason: 'Soodustingimustel vanaduspensioni (lapsed, tervist kahjustav töö) ei saa edasi lükata.' }
        : { open: true, reason: '' },
      p2: (input.p2 || 0) > 0 || (input.p2Rate || 0) > 0
        ? { open: true, reason: '' } : { open: false, reason: 'II sammast ei ole.' },
      p3: (input.p3 || 0) > 0 || (input.p3Monthly || 0) > 0 || !!input.p3Sep
        ? { open: true, reason: '' } : { open: false, reason: 'III sammast ei ole.' },
    };
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
      startIncome: startRow.i1 + startRow.isp + startRow.i23 + startRow.dep,
      coversNeedUntil: short ? short.age : null, // null = katab kuni 100
      gapEnd: gapEnd,
      gapTemporary: gapTemporary,
      aliveAtShortfall: short ? short.alive : 0,
      moneyEndAge: empty ? empty.age : null, // samba ja hoiuse raha lõpeb; null = ei lõpe enne 100
      incomeAfterMoney: empty ? empty.i1 + empty.isp : null,
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

  // Suurim riikliku pensioni edasilükkamine (scenario.deferral → 0), millega kulud on kaetud „elu lõpuni“.
  // null = ei kata ka ilma edasilükkamiseta. Elukaar pakub selle järgi „Muuda valik“ nuppu (A2-2: elan sammastest, riiklik hiljem).
  function bestDeferral(input, table, scenario) {
    for (let d = scenario.deferral || 0; d >= 0; d--) {
      const s = simulate(input, table, Object.assign({}, scenario, { deferral: d }));
      if (s.coversNeedUntil === null || s.coversNeedUntil > s.horizonAge) return d;
    }
    return null;
  }

  const SCENARIOS = [
    { id: 'A', name: 'Kõik korraga', short: 'II ja III sammas ühekordselt välja (10% maks), raha hoiusel, kasutad vajaduse järgi.' },
    { id: 'B', name: 'Üks fondipensioni leping', short: 'Maksuvaba fondipension elada jäänud aastate peale. Leping lõpeb perioodi lõpus.' },
    { id: 'C', name: 'Sild ja riiklik pension hiljem', short: 'Riiklik pension algab hiljem ja on eluks ajaks suurem. Seni elad sambast: maksuvaba fondipension (leping igal aastal uuesti), puudu jääv osa lisaväljamaksena.' },
    { id: 'D', name: 'Leping igal aastal uuesti', short: 'Maksuvaba fondipension, mille lepingu sõlmid igal aastal uuesti. Ei saa otsa, aga väheneb vanas eas.' },
  ];

  const api = { CURRENT_YEAR, DEFERRAL_INCREASE, SCENARIOS, pensionAge, retirementYears, specialStart, earlyYears, childSupplement, yearlyContribution, survival, horizonAge, fundPensionTerm, INCOME_TAX, PENSIONER_ALLOWANCE, GENERAL_ALLOWANCE, AASTAHINNE, workAccrual, decisionMap, options, simulate, sustainableNeed, bestDeferral };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pension = api;
})(typeof window !== 'undefined' ? window : globalThis);
