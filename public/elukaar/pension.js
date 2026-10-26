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
  // Paindlik pension varem (SKA 2026, kalkulaator 17.10.2026): vähendus eluks ajaks, aastat enne pensioniiga → osa.
  const EARLY_DECREASE = { 0: 0, 1: 0.0717, 2: 0.1378, 3: 0.1988, 4: 0.255, 5: 0.3067 };
  // Päästeteenistuse seadus (Riigi Teataja, kehtiv 01.10.2026):
  // § 18 lg 2: vanaduspensioni suurendus 10–15 a +10%, 16–20 a +20%, 21–25 a +25%, 26–30 a +40%, üle 30 a +50%;
  //   lg 5: makstakse pärast päästeteenistusest lahkumist; § 18 kehtib kuni 28.02.2043 → pensionile mineku aasta (pensionYear) ≤ 2042.
  // § 19: vähemalt 15 a staažiga päästja võib jääda kuni 5 a enne pensioniiga pensioni ootele; toetus = vanaduspension koos suurendusega.
  const RESCUE_LAST_YEAR = 2042;
  // Avaliku teenistuse seadus § 113 (Riigi Teataja, kehtiv 01.10.2026): üleminekusäte. Vanaduspensioni suurendus sama tabeliga
  // (10–15 a +10% … üle 30 a +50%) neile, kellel oli vajalik teenistusstaaž enne ATS jõustumist (01.04.2013) või kes jätkasid
  // soodustingimustel (staaž kuni 2018). Päästeteenistujale ATS § 113 ei kohaldata (PäästeTS § 18 lg 3), seega päästja staažiga ei liitu.
  // Keskmine vanaduspension (44 a staaži) alates 1.04.2026 (Vabariigi Valitsus / ERR): võrdlustabelis teise vanema näide.
  const AVG_OLD_AGE_PENSION = 860.23;
  function civilIncrease(years) { return rescueIncrease(years); }
  function rescueIncrease(years, pensionYear) {
    if (pensionYear !== undefined && pensionYear > RESCUE_LAST_YEAR) return 0;
    const y = Math.floor(years || 0);
    return y > 30 ? 0.5 : y >= 26 ? 0.4 : y >= 21 ? 0.25 : y >= 16 ? 0.2 : y >= 10 ? 0.1 : 0;
  }

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
  // Tuleva kalkulaatori eeldused (TulevaEE/onboarding-client pensionCalculator/calculation.ts, TLV-86): palk +3% aastas nominaalselt,
  // inflatsioon 2% (Euroopa Keskpanga eesmärk). UI kasutab neid vaikimisi; mootor ilma sisendita ei kasvata palka.
  const WAGE_GROWTH = 0.03;
  const INFLATION = 0.02;
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

  // Pensioniiga (RPKS § 7, alates 2027; § 7¹ üleminek 2027–2029): aastal t on pensioniiga 65 a + (65-aastaste meeste ja naiste
  // keskmine eeldatav eluiga aastatel t−8 … t−4) − (sama 2018–2022), kuu täpsusega, tõuseb kuni 3 kuud aastas (lg 8).
  // Valem annab kehtestatud väärtused: 2027 65 a 1 k, 2028 65 a 3 k, 2029 65 a 4 k (kontrollitud 16.10.2026).
  // Tulevikku keegi ei tea: nagu SKA kalkulaator eeldame, et eluiga jääb viimase avaldatud aasta tasemele (TLV-87).
  // Andmed: Statistikaamet RV045 (scripts/fetch_elutabel.py → elutabel.js eluiga65; test kontrollib, et on samad).
  const LIFE_EXP_65 = { 2018: 17.94, 2019: 18.245, 2020: 18.3, 2021: 17.06, 2022: 17.795, 2023: 18.52, 2024: 18.755, 2025: 18.88 };
  const LAST_LE_YEAR = Math.max(...Object.keys(LIFE_EXP_65).map(Number));
  const LE_BASE = [2018, 2019, 2020, 2021, 2022].reduce((s, y) => s + LIFE_EXP_65[y], 0) / 5;
  const le65 = (y) => LIFE_EXP_65[Math.min(y, LAST_LE_YEAR)];
  // Pensioniea kuud üle 65 aasta, mis kehtib kalendriaastal t (0 kuni 2026).
  function pensionAgeMonthsIn(t) {
    let m = 0;
    for (let y = 2027; y <= t; y++) {
      let src = 0;
      for (let k = y - 8; k <= y - 4; k++) src += le65(k);
      const target = Math.round((src / 5 - LE_BASE) * 12);
      m = Math.min(target, m + 3); // tõus kuni 3 kuud aastas; ülejääk kandub järgmistesse aastatesse (target arvutatakse igal aastal uuesti)
    }
    return m;
  }
  // Isiku pensioniiga: kehtib selle aasta pensioniiga, millal inimene sellesse vanusesse jõuab (RPKS § 7 lg 10).
  // Sünnikuud ei tea: eeldame jaanuari. 2029 ja varasemad väärtused on kehtestatud või eelnõus, hilisemad prognoos.
  function pensionAge(birthYear) {
    let year = birthYear + 65, months = 0;
    for (let y = birthYear + 65; y <= birthYear + 72; y++) {
      const m = pensionAgeMonthsIn(y);
      if (birthYear + 65 + Math.floor(m / 12) === y) { year = y; months = m; break; }
    }
    const years = 65 + Math.floor(months / 12), mm = months % 12;
    const known = year <= 2029;
    return { years: years, months: mm, year: year, known: known, label: (known ? '' : 'u ') + years + ' a' + (mm ? ' ' + mm + ' k' : '') };
  }

  // Elutabeli veerg soo järgi; sugu 'X' (muu) = Statistikaameti kogu rahvastiku veerg K (mehed ja naised koos),
  // vanade andmete korral (K puudub) meeste ja naiste keskmine.
  const avgCols = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function col(table, key, sex) {
    if (sex !== 'X') return table[key][sex];
    if (table[key].K) return table[key].K;
    let c = avgCols && avgCols.get(table);
    if (!c) { c = {}; if (avgCols) avgCols.set(table, c); }
    if (!c[key]) c[key] = table[key].M.map((v, i) => (v + table[key].N[i]) / 2);
    return c[key];
  }

  // Tõenäosus olla elus vanuses `age`, kui praegu ollakse elus vanuses `fromAge`.
  function survival(table, sex, fromAge, age) {
    const s = col(table, 'ellujaajad', sex);
    if (age > MAX_AGE) return 0;
    if (age <= fromAge) return 1;
    return s[age] / s[fromAge];
  }

  // Vanus, milleni jõuab elusalt 10% sinuvanustest.
  function horizonAge(table, sex, fromAge) {
    for (let a = fromAge; a <= MAX_AGE; a++) if (survival(table, sex, fromAge, a) <= HORIZON_SURVIVAL) return a;
    return MAX_AGE;
  }

  // Fondipensioni soovituslik (maksuvaba) periood: elada jäänud aastad vanuse järgi, täisaastateks ümardatud.
  // Soost sõltumata: Statistikaameti kogu rahvastiku (mehed ja naised koos) veerg K, nagu SKA kalkulaator (19,2 a) ja
  // Tuleva („65-aastasel 19 aastat“). Ilma K veeruta (vanad andmed) soo järgi. „Elu lõpuni“ horisont jääb soo järgi.
  function fundPensionTerm(table, sex, age) {
    const k = table.elada_jaanud && table.elada_jaanud.K;
    return Math.max(1, Math.round((k || col(table, 'elada_jaanud', sex))[Math.min(age, MAX_AGE)]));
  }

  // Pensioniiga aastates: kasutaja (või Tuleva konto) antud väärtus või ligikaudne reegel.
  function retirementYears(input) {
    return input.pensionAgeYears || pensionAge(input.birthYear).years;
  }

  // Palga kasv ja III samba makse (TLV-86, sama mis Tuleva kalkulaatoris): palk kasvab input.wageGrowth (nominaalselt, nt 3%)
  // ja inflatsioon on input.inflation (nt 2%), seega tänastes eurodes kasvab palk (1 + 3%) / (1 + 2%) − 1 ≈ 1% aastas.
  // III samba makse jääb nominaalselt samaks (p3Indexed false; piir 6000 € aastas), tänastes eurodes kahaneb inflatsiooni võrra.
  // Vaikimisi (sisendita) palk reaalselt ei kasva ja III makse on tänastes eurodes (vanad testid ja golden master).
  // UI annab Tuleva eeldused (story.js readInput).
  // Sissemaksed laekuvad aasta jooksul (kuu kaupa), hinnad tõusevad pidevalt: tänastes eurodes on aasta t makse väärt
  // 1 / (1 + inflatsioon)^(t + 0,5) (aasta keskpaik). Palk tõuseb aasta lõpus nagu Tuleva kalkulaatoris (salary *= 1,03).
  // Nii annab aastapõhine mootor Tuleva kuupõhise arvutusega sama tulemuse ±0,1% (tests/elukaar-tuleva-vordlus.test.cjs).
  function yearsFromNow(input, age) { return Math.max(0, age - (CURRENT_YEAR - input.birthYear)) || 0; }
  function wageFactor(input, age) {
    if (!input.wageGrowth && !input.inflation) return 1;
    const t = yearsFromNow(input, age);
    return Math.pow(1 + (input.wageGrowth || 0), t) / Math.pow(1 + (input.inflation || 0), t + 0.5);
  }
  function p3Factor(input, age) {
    if (input.p3Indexed !== false) return 1;
    return 1 / Math.pow(1 + (input.inflation || 0), yearsFromNow(input, age) + 0.5);
  }

  // Aastane sissemakse sammastesse kuni pensionini (tänastes eurodes).
  // II sammas: töötaja 2/4/6% + riik 4% sotsiaalmaksust, kui II sammas on aktiivne. III sammas: oma kuumakse.
  // Vanusega (age), eripensioni ajal (algusvanusest): ilma tööta (spWork === false) lõpevad II samba sissemaksed,
  // uue palgaga (spGross) arvestatakse sissemakset uuest palgast. III sambasse maksad edasi.
  function yearlyContribution(input, age) {
    const rate = input.p2Rate || 0;
    const during = age !== undefined && (input.spMonthly || 0) > 0 && age >= specialStart(input);
    const gross = during ? (input.spWork === false ? 0 : input.spGross !== undefined ? input.spGross : input.grossMonthly || 0) : input.grossMonthly || 0;
    const a = age !== undefined ? age : CURRENT_YEAR - input.birthYear;
    return gross * 12 * (rate > 0 ? rate + 0.04 : 0) * wageFactor(input, a) + (input.p3Monthly || 0) * 12 * p3Factor(input, a);
  }

  // Varem pensionile ilma vähenduseta (SKA, kontrollitud 16.10.2026). Lapsed (input.kids, õigust kasutab üks vanem):
  // 3 last 1 a, 4 last 3 a, 5+ last või puudega laps 5 a. Tervist kahjustav töö (SVPS, input.hazard): nimekiri nr 1 10 a,
  // nimekiri nr 2 5 a (staaž kuni 31.12.2030, põlevkivi 2049). Eraldi alused (RPKS § 10, SVPS § 1), kumbki loeb aastad tavalisest pensionieast; RPKS § 6: määratakse üks pension isiku valikul. Seega kehtib see, mis annab rohkem aastaid varem, aastad ei liitu.
  function earlyYears(input) {
    const k = input.kids || {};
    // bUnknown: laps ilma sünniajata (loeb varem pensionile mineku õiguse juures, pensionilisa tema eest ei arvesta).
    const n = (k.b1991 || 0) + (k.b2012 || 0) + (k.b2013 || 0) + (k.b2021 || 0) + (k.bUnknown || 0);
    // Kaks eraldi õigust (SKA): varem pensionile (earlyUser) ja pensionilisa (supUser); kumbagi kasutab üks vanem.
    const earlyUser = k.earlyUser || k.user;
    const kidsY = earlyUser !== 'me' ? 0 : k.disabled ? 5 : n >= 5 ? 5 : n === 4 ? 3 : n === 3 ? 1 : 0;
    // Tingimuste täitmise (staaž, nimekirja aastad) eest vastutab inimene ise; mootor ei kontrolli (UI hoiatab).
    const hazardY = input.hazard === 'list1' ? 10 : input.hazard === 'list2' ? 5 : 0;
    // PäästeTS § 19 ootetoetus; input.rescueBasis 'pension' = ootetoetust ei võta, lähed laste eest varem pensionile.
    const rescueY = (input.rescueYears || 0) >= 15 && input.rescueBasis !== 'pension' ? 5 : 0;
    return Math.max(kidsY, hazardY, rescueY);
  }

  // Päästja ootetoetuse lõpp (vanus, TLV-105). Toetus ei ole pension: laste pensionilisa seda ei suurenda [inferred, SKA kirjas].
  // input.rescueBasis: 'toetus' = toetus kuni pensionieani; 'mix' (vaikimisi, kui laste õigus on sinul) = toetus kuni laste
  // eest varem pensionile minekuni, siis vanaduspension koos laste lisaga; 'pension' = toetust ei võta (earlyYears ilma selleta).
  function rescueUntil(input) {
    if ((input.rescueYears || 0) < 15 || input.rescueBasis === 'pension') return null;
    const kidsY = earlyYears({ kids: input.kids });
    const pa = retirementYears(input);
    return input.rescueBasis !== 'toetus' && kidsY > 0 ? pa - kidsY : pa;
  }

  // Laste pensionilisa kuus (RPKS § 24 lg 1¹ ja § 28 lg 2 p 12, kontrollitud 16.10.2026; laps kasvatatud ≥ 8 a):
  // - enne 2013 sündinud laps (RPKS § 24 lg 1¹ p 1 ja 1¹, Riigi Teataja 01.10.2026): 1,5 aastahinnet + 31.12.1980–2012 sündinul
  //   veel 2 aastahinnet; varem sündinul 2 aastat staaži (§ 28; staažiaasta = 1 aastahinne, § 12). Kokku kõigil 3,5.
  //   (SKA leht nimetab staaži piiriks 1991; summa on sama.)
  // - 2013–08.2021 sündinud laps: 3,5 aastahinnet ainult enne 1983 sündinud vanemale, kes ei ole II sambas (p 2).
  // - 09.2021+ sündinud laps: 3,5 aastahinnet, kui vanem ei ole lapse 3 esimesel aastal II sambas (p 3; mudel: II sammast pole).
  // - 2013+ ja II sammas: lisa pole, riik maksab II sambasse (childPillar2). Lg 6: alla 36 kuu lisamakseid → osaline lisa (allpool).
  // Ainult vanemale, kes õigust kasutab; eripensionile ei lisata.
  function childSupplement(input) {
    const k = input.kids || {};
    if ((k.supUser || k.user) !== 'me') return 0;
    const noII = !((input.p2 || 0) > 0 || (input.p2Rate || 0) > 0);
    // Sept 2021+ laps, kes on juba üle 3 a: RPKS § 24 lg 6 – lisa proportsionaalselt kuudega, mille eest riik II sambasse
    // lisamakset ei teinud (k.iiMonths[i], 0–36; SKA näide: 12 kuud → 2/3). Vaikimisi II sambas 36 kuud, muidu 0.
    const u3n = Math.min(k.u3 || 0, k.b2021 || 0), older21 = Math.max(0, (k.b2021 || 0) - u3n);
    let part21 = 0;
    for (let i = 0; i < older21; i++) {
      const m = k.iiMonths && k.iiMonths[i] !== undefined ? k.iiMonths[i] : noII ? 0 : 36;
      part21 += (36 - Math.max(0, Math.min(36, m))) / 36;
    }
    const after2013 = (noII ? (input.birthYear < 1983 ? k.b2013 || 0 : 0) + u3n : 0) + part21;
    return AASTAHINNE * 3.5 * ((k.b1991 || 0) + (k.b2012 || 0) + after2013);
  }

  // Tervist kahjustava töö lisa (SVPS § 3, kontrollitud 16.10.2026): soodustingimustel vanaduspensionile nimekirja nr 1 alusel
  // (SVPS § 1 p 1) lisandub 3,1% aastahindest iga nimekirja nr 1 tööaasta eest ja allmaatöödel lisaks 21,9% aastahindest
  // iga allmaatöö aasta eest (TLV-88). SKA kalkulaatoris seda valikut pole, seega lisame alati (prognoos seda ei sisalda).
  function hazardSupplement(input) {
    if (input.hazard !== 'list1') return 0;
    const y1 = Math.max(0, input.hazardYears || 0), yu = Math.min(y1, Math.max(0, input.undergroundYears || 0));
    return AASTAHINNE * (0.031 * y1 + 0.219 * yu);
  }

  // Riigi täiendav sissemakse II sambasse (KoPS § 10): 4% Eesti keskmisest sotsiaalmaksuga maksustatavast kuutulust
  // (PHS § 40 lg 2) iga kuni 3-aastase lapse kohta, ühele vanemale, kes on II sambas. Summa kuus SKA järgi (uuendatakse igal aastal,
  // vt README „Igal aastal uuendatavad väärtused“). Tulevased maksed: kuud lapse 3-aastaseks saamiseni (k.u3Left, UI arvutab
  // sünnikuust); kui sünnikuud pole, keskmiselt 18 kuud [inferred]. Varasemad sissemaksed on juba II samba summas.
  const CHILD_II_MONTHLY = { 2026: 76.12, 2027: 80.76 }; // SKA „Perehüvitiste määrad ja maksmine“, uuendatud 18.09.2026
  function childIIMonthly(year) {
    const ys = Object.keys(CHILD_II_MONTHLY).map(Number).sort((a, b) => a - b);
    return CHILD_II_MONTHLY[ys.filter((y) => y <= year).pop() || ys[0]];
  }
  function childPillar2(input) {
    const k = input.kids || {};
    if ((k.supUser || k.user) !== 'me' || !((input.p2Rate || 0) > 0)) return 0;
    const n = Math.min(k.u3 || 0, k.b2021 || 0);
    const monthNow = k.monthNow !== undefined ? k.monthNow : 0; // 0 = jaanuar; mitu kuud on jooksval aastal veel ees: 12 − monthNow
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const left = Math.max(0, Math.min(36, k.u3Left && k.u3Left[i] !== undefined ? k.u3Left[i] : 18));
      const thisYear = Math.min(left, 12 - monthNow);
      sum += thisYear * childIIMonthly(CURRENT_YEAR);
      for (let m = thisYear, y = CURRENT_YEAR + 1; m < left; y++) { const c = Math.min(12, left - m); sum += c * childIIMonthly(y); m += c; }
    }
    return sum;
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
    // Pool riiklikku pensioni (scenario.half aastat, SKA paindlik pension): pensionieast makstakse pool, siis täis.
    // Välja võtmata pool kasvab nagu edasilükkamisel, seega hilisem tõus on pool sama pika edasilükkamise omast.
    // Ainult koos „võtan kohe“ valikuga; eripensionile ja soodustusega pensionile ei kehti (nagu edasilükkamine).
    const half = deferral === 0 && spYear === 0 && soodus === 0 ? Math.min(5, Math.max(0, scenario.half || 0)) : 0;
    // Laste pensionilisa lisandub vanaduspensionile, kui prognoos seda veel ei sisalda (kids.inForecast 'no'; 'ei tea' → ei lisa).
    const kidsMonthly = childSupplement(input);
    const kidsApplied = kidsMonthly > 0 && (input.kids || {}).inForecast === 'no';
    const hazardMonthly = hazardSupplement(input);
    // Varem pensionile (lapsed, tervist kahjustav töö): SKA prognoos eeldab tööd kuni tavalise pensionieani. Kui lähed varem,
    // jäävad need tööaastad pensionist välja: SKA kalkulaatoris u 12 € kuus aasta kohta (palk 4000 €, II sammas; kontrollitud
    // 16.10.2026: 3/4/5 last → 853/829/805 € 865 asemel). Töö pensioni ajal lisab aastad tagasi (workedBefore, allpool).
    const earlyMissing = soodus > 0 && currentAge < ret ? soodus : 0;
    const earlyCut = earlyMissing * workAccrual(input.grossMonthly || 0, (input.p2Rate || 0) > 0, (input.p2Rate || 0) > 0);
    const p1Base = (Math.max(0, input.p1Monthly - earlyCut) + (kidsApplied ? kidsMonthly : 0) + hazardMonthly) * 12;
    // Suurendav kordaja rakendub kogu pensionile, ka edasilükkamise ajal töötades teenitud osakutele (RPKS § 11¹ lg 4:
    // SKA arvutab pensioni §-de 11 ja 24 järgi ja rakendab siis kordaja). SKA kontroll 16.10.2026: (865 + 3 × 12,2) × 1,2701 = 1145 €.
    // Paindlik pension varem (input.flexEarly aastat, ilma soodustuseta): soodus annab aja, vähendus kehtib eluks ajaks.
    // SKA kontroll 17.10.2026: (865 − 3 × 12,2) × (1 − 19,88%) = 664 €.
    const flexEarly = soodus > 0 ? Math.min(5, Math.max(0, input.flexEarly || 0)) : 0;
    const p1Factor = (1 + DEFERRAL_INCREASE[deferral] + DEFERRAL_INCREASE[half] / 2) * (1 - EARLY_DECREASE[flexEarly]) * (1 + ((input.rescueYears || 0) > 0 ? rescueIncrease(input.rescueYears, input.birthYear + ret) : civilIncrease(input.civilYears)));
    const p1Full = p1Base * p1Factor; // enne tulumaksu
    // Ootetoetuse ajal (ret … toetusEnd) laste pensionilisa ei maksta, ka siis, kui SKA prognoos selle juba sisaldab.
    const toetusEnd = flexEarly > 0 ? null : rescueUntil(input);
    const kidsInP1 = kidsApplied || (kidsMonthly > 0 && (input.kids || {}).inForecast === 'yes') ? kidsMonthly : 0;
    const toetusYear = Math.max(0, p1Full - kidsInP1 * 12 * p1Factor);
    // Töötamine pensioni ajal (input.workOn kuni input.workUntil): palk katab kulud, riiklik pension läheb hoiusele,
    // II ja III sissemaksed jätkuvad, samba väljamaksed algavad töö lõppedes. Soodustusega pensionil on vana nimi
    // input.soodusWork (töö lõpp vaikimisi tavaline pensioniiga); muidu vaikimisi 1 aasta pärast pensionile minekut.
    const workOn = input.workOn !== undefined ? !!input.workOn : soodus > 0 && !!input.soodusWork;
    const workEnd = workOn ? Math.max(ret, input.workUntil !== undefined ? input.workUntil : soodus > 0 ? pa : ret + 1) : ret;
    const iiJoined = (input.p2Rate || 0) > 0;
    const accrualYear = 12 * workAccrual(input.grossMonthly || 0, iiJoined, iiJoined);
    const workedBefore = (age) => Math.max(0, Math.min(age, workEnd) - Math.max(ret, currentAge));
    // Pärast töö lõppu III samba sissemakse (p3After, vaikimisi sama) kuni tavalise pensionieani; tuleb sissetulekust [inferred].
    const c3After = soodus > 0 ? (input.p3After !== undefined ? input.p3After : input.p3Monthly || 0) * 12 : 0;
    // Pensionieas (või soodustusega varem) valib inimene ühe: eripension või vanaduspension (input.firstPillarChoice).
    // Vaikimisi suurem; võrdse summa korral jätkub eripension (uut rida ei teki).
    const choice = input.firstPillarChoice;
    const spPaid = spYear > 0 && (choice === 'special' ? true : choice === 'oldAge' ? false : spYear >= p1Full);
    // Teine otsustuskoht tavalises pensionieas (input.firstPillarChoicePa): kui varem (soodustusega) jätkasid eripensioniga,
    // on vanaduspension pensionieas suurem pensioni ajal töötatud aastate võrra; vaikimisi suurem kahest. Vanaduspensionilt
    // eripensionile tagasi mudel ei lähe.
    const p1AtPa = p1Full + accrualYear * workedBefore(pa) * p1Factor;
    const choicePa = input.firstPillarChoicePa;
    const spPaidPa = spPaid && ret < pa ? (choicePa === 'special' ? true : choicePa === 'oldAge' ? false : spYear >= p1AtPa) : spPaid;
    const spPaidAt = (age) => (age >= pa ? spPaidPa : spPaid);
    const p1Year = spPaid ? 0 : p1Full;
    const p1At = (age) => (spPaidAt(age) ? 0 : toetusEnd !== null && age < toetusEnd ? toetusYear : p1Full);
    const taxOn = input.incomeTax !== false;
    const allowance = taxOn ? PENSIONER_ALLOWANCE : 0;
    const needYear = need * 12;
    // Eripension aastas vanuse järgi: enne pensioniiga valitud vanusest, pensionieas ainult siis, kui see on suurem.
    const spAt = (age) => (age < spStart ? 0 : age < p1Start ? spYear : spPaidAt(age) ? spYear : 0);
    // Eripensioni ajal: töötad edasi muul kutsealal (palk, vajadusel uus palk spGross)?
    const working = input.spWork !== false && (input.spGross !== undefined ? input.spGross : input.grossMonthly) > 0;
    // Üldine maksuvaba tulu enne tavalist pensioniiga: kui ei tööta (eripensioni ajal tööga kasutab selle palk).
    const generalAt = (age) => (taxOn && !(age < ret && working) && !(age >= ret && age < workEnd) ? GENERAL_ALLOWANCE : 0);
    // Töö ajal kasutab maksuvaba tulu palk, seega pension (ka eripension) on tervenisti 22% maksuga [inferred, EMTA: üks maksuvaba tulu].
    const allowAt = (age) => (taxOn && age >= ret && age < workEnd ? 0 : age >= pa ? allowance : generalAt(age));
    // Sammaste avanemine: II sammas (ja ühine pott) 5 a enne tavalist pensioniiga, eraldi III sammas 55 (enne 2021) või 60.
    // Enne pensionile minekut (ret) väljamakseid mudelis pole.
    const open2 = Math.max(workEnd, pa - 5);
    const open3 = Math.max(workEnd, input.p3Before2021 ? 55 : 60);

    // Samba vara kasvab kuni kasutamiseni ja sinna lisanduvad sissemaksed.
    // Valikuline eraldi III sammas (input.p3Sep = { amount, mode: 'grow' | 'lump' | 'fund' }): oma pott, oma väljamakse viis.
    // Ilma selleta on III sammas II sambaga ühes potis (senine käitumine).
    const sep = input.p3Sep || null;
    const c3 = sep ? (input.p3Monthly || 0) * 12 : 0;
    let fund = input.p2 + input.p3 + childPillar2(input);
    let fund3 = sep ? sep.amount : 0;
    // Jooksval aastal on sissemakseid alles ainult ülejäänud kuude eest (input.firstYearShare, nt oktoobris 3/12); vaikimisi terve aasta.
    // Nii on sissemakseaastad sama mis SKA kalkulaatoris (nt 29,3 a, mitte 30).
    const share = (a) => (a === currentAge && input.firstYearShare !== undefined ? Math.max(0, Math.min(1, input.firstYearShare)) : 1);
    for (let a = currentAge; a < workEnd; a++) { const c3a = c3 * p3Factor(input, a) * share(a); fund = fund * (1 + r) + yearlyContribution(input, a) * share(a) - c3a; fund3 = fund3 * (1 + r) + c3a; }

    // Hoius pensioni alguses: varem sambast välja võetud ja kõrvale pandud raha (valikuline, vaikimisi 0).
    let deposit = input.extraDeposit || 0;
    // Ühekordne väljavõtt pensioniea aastal: 10% tulumaks, millest saab maha arvata pensioniea aasta kasutamata maksuvaba tulu.
    // Ühekordne väljavõte tehakse siis, kui sammas avaneb. Maksuvaba tulu arvestatakse ainult pensionieas (enne seda konservatiivselt 0).
    const firstRetAge = Math.max(open2, startAge); // II samba (ühise poti) ühekordse väljavõtu aasta
    const lump3Age = Math.max(open3, startAge); // eraldi III samba ühekordse väljavõtu aasta
    let allowAtPa = firstRetAge >= pa ? Math.max(0, allowance - (firstRetAge >= p1Start ? (firstRetAge < ret + half ? p1Base / 2 : p1At(firstRetAge)) : 0) - spAt(firstRetAge)) : 0;
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
      const i1gross = age >= p1Start ? (age < ret + half ? p1Base / 2 : p1At(age)) + (spPaidAt(age) ? 0 : accrualYear * workedBefore(age) * (age < ret + half ? 1 : p1Factor)) : 0;
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
        work: work, // töötad pensioni ajal (palk katab kulud)
        shortfall: age >= ret ? Math.max(0, needYear - spend) / 12 : 0,
        moneyLeft: fundStart + depositStart,
        alive: survival(table, input.sex, currentAge, age),
      });
    }
    const res = summarize(rows, input, table, ret, p1Start, currentAge);
    res.ordinaryPensionAge = pa; // tavaline pensioniiga (pensionStartAge on soodustusega pensionile minek)
    res.childSupplement = kidsMonthly > 0 ? { monthly: kidsMonthly, applied: kidsApplied } : null;
    // Ootetoetus (päästeasutus maksab): vanus, millest alates maksab vanaduspensioni SKA, ja toetuse summa kuus.
    res.rescueAllowance = toetusEnd !== null && toetusEnd > ret ? { from: ret, until: toetusEnd, monthly: toetusYear / 12, pension: p1Year / 12 } : null;
    res.hazardSupplement = hazardMonthly > 0 ? hazardMonthly : null;
    // Eripensioni ja vanaduspensioni võrdlus tulemuse selgituseks („Pensionieas makstakse sulle suurem kahest“).
    res.firstPillar = spYear > 0 ? { special: spYear / 12, oldAge: p1Full / 12, paid: spPaid ? 'special' : 'oldAge', larger: spYear >= p1Full ? 'special' : 'oldAge',
      // Pensionieas uuesti (ainult kui varem jätkasid eripensioniga): vanaduspension koos pensioni ajal töötatud aastatega.
      // Näidatakse ainult siis, kui midagi muutub: töö tõstis vanaduspensioni või see on suurem (varem valiti väiksem).
      atPa: spPaid && ret < pa && (p1AtPa > p1Full + 0.5 * 12 || p1AtPa > spYear) ? { age: pa, oldAge: p1AtPa / 12, paid: spPaidPa ? 'special' : 'oldAge', larger: spYear >= p1AtPa ? 'special' : 'oldAge' } : null } : null;
    return res;
  }

  // Millised otsused on kasutajale avatud ja miks mitte (UI lukustab sammud selle järgi, loogika on siin).
  function options(input) {
    const sp = !!input.spHas || (input.spMonthly || 0) > 0; // „Eripension: jah“ (summa võib olla veel sisestamata)
    const soodus = (input.soodus !== undefined ? input.soodus : earlyYears(input)) > 0;
    return {
      deferral: sp
        ? { open: false, reason: 'Eripensionile paindliku pensioni reeglid ei kehti: eripensioni ei saa edasi lükata, varem võtta ega peatada.' }
        : soodus ? { open: false, reason: (input.flexEarly || 0) > 0 ? 'Lähed paindliku pensioniga varem, seega pensioni edasi lükata ega pooleks võtta ei saa.' : 'Lähed pensionile varem soodustusega (lapsed, tervist kahjustav töö või päästeteenistus). Siis ei saa pensioni edasi lükata ega pooleks võtta.' }
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

  const api = { CURRENT_YEAR, rescueUntil, AVG_OLD_AGE_PENSION, DEFERRAL_INCREASE, EARLY_DECREASE, rescueIncrease, RESCUE_LAST_YEAR, civilIncrease, SCENARIOS, pensionAge, pensionAgeMonthsIn, LIFE_EXP_65, retirementYears, specialStart, earlyYears, childSupplement, childPillar2, hazardSupplement, CHILD_II_MONTHLY, yearlyContribution, wageFactor, p3Factor, WAGE_GROWTH, INFLATION, survival, horizonAge, fundPensionTerm, INCOME_TAX, PENSIONER_ALLOWANCE, GENERAL_ALLOWANCE, AASTAHINNE, workAccrual, decisionMap, options, simulate, sustainableNeed, bestDeferral };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pension = api;
})(typeof window !== 'undefined' ? window : globalThis);
