// Tulevane Mina: Elukaar (prototüüp 3). Mootor: elukaar/pension.js. Valikud etappide kaupa.
(function () {
  'use strict';

  const P = window.Pension;
  const T = window.ELUTABEL;
  const K = window.KULUD;
  const $ = (id) => document.getElementById(id);
  const eur = (v) => Math.round(v).toLocaleString('et-EE').replace(/,/g, ' ') + ' €';
  const pct = (v) => Math.round(v * 100) + '%';
  const one = (v) => (Math.round(v * 10) / 10).toLocaleString('et-EE');
  const radio = (name) => (document.querySelector('input[name="' + name + '"]:checked') || {}).value;

  // ---------- Eeldused ----------
  // Fondide reaaltootlus pärast inflatsiooni ja tasusid. Eeldused, mitte prognoos.
  const FUNDS = {
    cons: { name: 'Konservatiivne võlakirjafond', r: 0, note: 'Kõigub vähe, aga raha reaalväärtus pikalt ei kasva.' },
    mix: { name: 'Keskmine pangafond (kõrgem tasu)', r: 0.02, note: 'Osa tootlusest läheb fonditasudeks.' },
    index: { name: 'Madala tasuga indeksfond', r: 0.04, note: 'Laialt hajutatud aktsiad, väike tasu.' },
  };
  const CHILD_R = { none: 0, parent: 0, account: 0.04 };
  // Hooldekodu omaosalus kuus: keskmine kohatasu 1 603 € (november 2024), hoolduse osa (u 600 €) maksab omavalitsus. Sama mis kalkulaatoris.
  const CARE_HOME = 1000;
  const PRICE = { tank: 80, mince: 10, trip: 1800, cafe: 12 }; // 50 l kütust, 1 kg veisehakkliha, kaks nädalat soojal maal (lend + majutus), kohvikulõuna

  // Kulutasemed: Statistikaameti andmed (data/kulud.js), samad tasemed ja nimed mis kalkulaatoris.
  // Kokkuhoidlik = tänaste pensionäride keskmine. Optimaalne ja mugav = sama, korrutatud IV / V tulukvintiili kulude suhtega.
  const PACKAGES = [
    { id: 'kokkuhoidlik', name: 'Kokkuhoidlik', emoji: '🥔', tagline: 'Nii palju kulutavad tänased pensionärid keskmiselt.' },
    { id: 'optimaalne', name: 'Optimaalne', emoji: '✈️', tagline: 'Nagu keskmisest jõukamad leibkonnad (IV tulukvintiil).' },
    { id: 'mugav', name: 'Mugav', emoji: '🛋️', tagline: 'Nagu jõukaim viiendik (V tulukvintiil).',
      // „Või“: sama summa katab hiljem hooldekodu omaosaluse.
      alt: (total) => 'Kui vajad hooldust: sama raha (' + eur(total) + ' kuus) katab hooldekodu omaosaluse (keskmiselt u ' + eur(CARE_HOME) + ' kuus) ja lapsed ei pea juurde maksma.' },
  ];

  // Etappide vanusevahemikud (pensioniiga lisandub arvutuses).
  function stageAges(pa) {
    return [null, [0, 18], [18, 18], [18, 55], [55, 55], [pa - 5, pa - 5], [pa, pa], [pa + 1, 100], null, null];
  }

  // Vanuse tekstid: „65 a“ ja „65-aastaselt“ (kuud on toetatud, aga lugu näitab täisaastaid).
  const ageTxt = (y, m) => y + ' a' + (m ? ' ' + m + ' k' : '');
  const ageAt = (y, m) => (m ? y + ' a ' + m + ' k vanuselt' : y + '-aastaselt');
  // Pensioniea reegel (pension.js). Alates 2029 on see seotud elueaga.
  function ruleAge(birthYear) {
    const r = P.pensionAge(birthYear);
    return { years: r.years, months: r.months };
  }


  // ---------- Ikoonid: SVG (Lucide stiilis, MIT) emoji asemel. Värv tuleb ümbrusest (currentColor). ----------
  const SVG = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    lockOpen: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    tree: '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    anchor: '<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
    home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2M20 18v2"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    fuel: '<path d="M3 22h12M4 9h10"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
    coffee: '<path d="M10 2v2M14 2v2M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    landmark: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  };
  const EMOJI = { '🙂': 'user', '🧍': 'user', '👫': 'users', '👨‍👩‍👧': 'users', '🔓': 'lockOpen', '💼': 'briefcase', '🧳': 'briefcase',
    '🏖️': 'sun', '🌳': 'tree', '🛒': 'cart', '🏁': 'flag', '⚓': 'anchor', '🔄': 'refresh', '♻️': 'refresh', '🚫': 'ban', '🌱': 'sprout',
    '💰': 'coins', '🗓️': 'calendar', '📜': 'file', '🥔': 'home', '🏡': 'home', '✈️': 'plane', '🛋️': 'sofa', '🥩': 'utensils', '⛽': 'fuel',
    '☕': 'coffee', '🏦': 'wallet', '🐷': 'wallet', '🏛️': 'landmark', '💝': 'heart', '🎒': 'bag' };
  const ico = (name) => '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (SVG[name] || '') + '</svg>';
  // Asenda dekoratiivsed emojid SVG-ga (elemendid, mille ainus sisu on emoji).
  function svgify(root) {
    root.querySelectorAll('.choice-emoji, .pot-emoji, .path-dot, .hh-emoji, .chapter-art, .recap li > span:first-child, .pkg-facts li > span:first-child, .pkg-alt > span:first-child').forEach((el) => {
      const k = el.textContent.trim();
      if (EMOJI[k]) el.innerHTML = ico(EMOJI[k]);
    });
  }

  // ---------- Olek ----------
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  const LAST = chapters.length - 1;
  // Minevikuetapid (0–18, 18) ja tööaastad jäävad eraldi etapina välja: kõik on esimeses vaates.
  const SKIP = new Set([1, 2, 3]); // tööaastate küsimused on esimeses vaates
  // 55 a samm on loos ainult siis, kui III sambaga liitusid enne 2021 (siis avaneb soodusmaks 55-aastaselt).
  const skipped = (i) => SKIP.has(i) || (i === 4 && $('p3Joined').value !== 'before');
  const shownSteps = () => chapters.map((c, i) => i).filter((i) => !skipped(i));
  let step = 0;
  let visited = new Set([0]);
  let legacyChoice = null;
  let chart = null;

  function readInput() {
    const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
    const birthYear = Math.min(1990, Math.max(1950, parseInt($('birthYear').value, 10) || 1980));
    const currentAge = P.CURRENT_YEAR - birthYear;
    const fund18 = $('fundCur').value; // praegune fond (muutuja nimi ajalooline)
    const fundNow = radio('fundChange') === 'switch' ? $('fundNew').value : fund18;

    const child = radio('child');
    const childMonthly = child === 'none' ? 0 : num('childMonthly');
    const rc = CHILD_R[child];
    let child18 = 0;
    for (let a = 0; a < 18; a++) child18 = child18 * (1 + rc) + childMonthly * 12;
    const childNow = SKIP.has(1) ? 0 : radio('childKept') === '1' ? child18 * Math.pow(1 + rc, Math.max(0, currentAge - 18)) : 0;

    // Fondivahetus: minevikus vahetus on juba tänases summas. Tulevikus vahetus: seni kasvab raha vanas fondis.
    // pension.js kasutab ühte tootlust, seega teisendame vahetuseni kasvu samaväärseks tänaseks summaks (mudel on lineaarne).
    const switching = radio('fundChange') === 'switch';
    const pa = P.retirementYears({ birthYear: birthYear, pensionAgeYears: parseInt($('pensionAgeYears').value, 10) });
    const switchAge = Math.min(pa - 1, Math.max(currentAge, parseInt($('switchAge').value, 10) || currentAge));
    const sex = $('sex').value;
    const rateAt = (a) => (switching && a >= switchAge ? FUNDS[fundNow].r : FUNDS[fund18].r);
    const rFinal = FUNDS[fundNow].r;

    // III sammas: kas on, mis vanuses avati, sissemakse. Avamise aasta määrab maksureeglid (enne 2021 või hiljem).
    // have: sammas on olemas (liitumise aeg enne/pärast 2021); future: avan hiljem; no: ei ava.
    // III sammas on, kui oled liitunud ja summa või sissemakse > 0. „Ma ei ole liitunud“ → III sammast ei arvestata.
    const p3Kind = $('p3Joined').value === 'none'
      ? (num('p3Monthly') > 0 ? 'future' : 'no') // pole veel liitunud: avab hiljem, kui sissemakse on sisestatud
      : (num('p3') > 0 || num('p3Monthly') > 0 ? 'have' : 'no');
    const p3Has = p3Kind !== 'no';
    const joinedBefore = $('p3Joined').value === 'before';
    const p3OpenAge = p3Kind === 'have'
      ? (joinedBefore ? Math.min(currentAge, 2020 - birthYear) : Math.min(currentAge, 2021 - birthYear))
      : Math.min(pa - 1, Math.max(currentAge + 1, parseInt($('p3OpenAge').value, 10) || currentAge + 1));
    const p3Before2021 = birthYear + p3OpenAge < 2021;
    const p3Monthly = p3Has ? num('p3Monthly') : 0;
    const c3 = p3Monthly * 12;
    const p3Base = p3Has && p3OpenAge <= currentAge ? num('p3') : 0; // tulevikus avatud sambas täna raha pole

    // Väljavõtt 55-aastaselt (või kohe, kui oled juba vanem). Soodusmaks alates 55 (avatud enne 2021) või 60,
    // ja kogumist peab olema vähemalt 5 aastat. Enne seda 22% tulumaks.
    // Täiendav fondipension: maksuvaba alates soodusest, uus leping igal aastal (elada jäänud aastad).
    // Olemasolev sammas: enne 2021 liitunul eeldame, et 5 aastat on täis. Hiljem liitunul vähemalt 2021 + 5 aastat.
    const p3Open = p3Kind === 'have'
      ? (p3Before2021 ? 55 : Math.max(60, 2026 - birthYear))
      : Math.max(p3Before2021 ? 55 : 60, p3OpenAge + 5);
    const p3Age = Math.max(55, currentAge);
    const p3Allowed = p3Has && p3Age < pa && p3OpenAge < p3Age;
    // Täiendav fondipension on võimalik alles soodusvanusest (enne 2021 liitunul 55, hiljem 60). Varem ainult korraga (22%).
    const p3FundOk = p3Age >= p3Open;
    let p3Plan = p3Allowed && $('p3Joined').value === 'before' ? (radio('p3plan') || 'keep') : 'keep';
    if (p3Plan === 'fund' && !p3FundOk) p3Plan = 'keep';
    const p3Use = 'spend'; // väljavõetud III samba raha kasutatakse kohe (pensioniks ei jää)

    // simulate lisab III samba sissemakse igal aastal ühisesse rahasse. Eemaldame selle aastatel, kui sammas pole avatud
    // või kui sissemakse läheb väljavõetavale III samba saldole (samaväärne tänane summa, sest mudel on lineaarne).
    let c3Adj = 0;
    for (let a = currentAge; a < pa; a++) {
      // 'fund': sissemaksed kuni pensionini lähevad 55-aastasse fondipensioni potti (vt allpool), mitte pensionieas uude lepingusse.
      if (a < p3OpenAge || (p3Plan === 'fund' && a < pa) || (p3Plan === 'lump' && a < p3Age)) c3Adj -= c3 / Math.pow(1 + rFinal, a - currentAge + 1);
    }
    let p3Gross = 0, p3Net = 0, p3Rem = 0, p3Tax = 0;
    if (p3Plan !== 'keep') {
      let b = p3Base;
      for (let a = currentAge; a < p3Age; a++) b = b * (1 + rateAt(a)) + (a >= p3OpenAge ? c3 : 0);
      if (p3Plan === 'lump') {
        p3Tax = p3Age >= p3Open ? 0.10 : 0.22;
        p3Gross = b; p3Net = b * (1 - p3Tax);
      } else {
        for (let a = p3Age; a < pa; a++) {
          const pay = b / P.fundPensionTerm(T, sex, a);
          b -= pay; p3Gross += pay; p3Net += pay * (a >= p3Open ? 1 : 0.78);
          b = b * (1 + rateAt(a)) + (a >= p3OpenAge ? c3 : 0); // sissemakse läheb samasse lepingupotti
        }
        p3Rem = b; // pensionieas läheb ülejääk ühisesse samba rahasse
      }
    }
    const pot0 = num('p2') + (p3Plan === 'keep' ? p3Base : 0) + childNow;
    let switchAdj = 0;
    if (switching && switchAge > currentAge) {
      const c = P.yearlyContribution({ grossMonthly: num('grossMonthly'), p2Rate: parseFloat($('p2Rate').value), p3Monthly: p3Monthly });
      const ro = FUNDS[fund18].r, rn = FUNDS[fundNow].r, n = switchAge - currentAge;
      let fOld = pot0, cNew = 0;
      for (let i = 0; i < n; i++) { fOld = fOld * (1 + ro) + c; cNew = cNew * (1 + rn) + c; }
      switchAdj = (fOld - cNew) / Math.pow(1 + rn, n) - pot0;
    }

    // III samba ülejääk pensionieas → samaväärne tänane summa (simulate kasvatab kõike lõpptootlusega).
    const p3RemNow = p3Rem / Math.pow(1 + rFinal, Math.max(0, pa - currentAge));

    const pkg = PACKAGES.find((p) => p.id === radio('pkg')) || PACKAGES[0];
    const household = $('household').value;
    const pkgTotal = packageTotal(pkg, household);

    return withP3({
      birthYear: birthYear,
      currentAge: currentAge,
      sex: sex,
      household: household,
      p1Monthly: num('p1Monthly'),
      p2: num('p2'),
      p3Base: p3Base,
      p3: (p3Plan === 'keep' ? p3Base : 0) + childNow + switchAdj + p3RemNow + c3Adj,
      p3RemNow: p3RemNow, c3Adj: c3Adj,
      p3Pre: (p3Plan === 'keep' ? p3Base : 0) + childNow + p3RemNow + c3Adj,
      p3Before2021: p3Before2021,
      p3Has: p3Has, p3Kind: p3Kind, p3OpenAge: p3OpenAge, p3Allowed: p3Allowed,
      p3Open: p3Open, p3Age: p3Age, p3Plan: p3Plan, p3Use: p3Use,
      p3Gross: p3Gross, p3Net: p3Net, p3Tax: p3Tax, p3Rem: p3Rem,
      extraDeposit: p3Plan !== 'keep' && p3Use === 'save' ? p3Net : 0,
      pensionAgeYears: parseInt($('pensionAgeYears').value, 10),
      paMonths: 0, // vanused näidatakse täisaastates (65 a), kuid ei kasutata
      grossMonthly: num('grossMonthly'),
      p2Rate: parseFloat($('p2Rate').value),
      p3Monthly: p3Monthly,
      fund18: fund18,
      fundNow: fundNow,
      switching: switching, switchAge: switchAge, switchAdj: switchAdj,
      realReturn: FUNDS[fundNow].r,
      child: child, childMonthly: childMonthly, child18: child18, childNow: childNow,
      payout: radio('payout'),
      // Tegelik väljamakse viis: kui 60-aastaselt jätkad kasvatamist, otsustad pensionieas.
      method: radio('payout') === 'grow' ? (radio('payoutPa') || 'grow') : radio('payout'),
      // III samba valik pensionieas (kui 55-aastaselt ei võetud välja).
      p3pa: radio('p3pa') === 'grow' ? (radio('p3paPa') || 'grow') : (radio('p3pa') || 'grow'),
      p3At60: radio('p3pa') || 'grow',
      deferral: parseInt(radio('defer') || '0', 10),
      contract: radio('contract'),
      pkg: pkg,
      pkgTotal: pkgTotal,
      edited: isEdited(pkg),
      needMonthly: customTotal(pkg, household),
    });
  }

  // Lisastsenaarium: raha jääb fondi, lepingut ega ühekordset väljamakset pole. pension.js katab siis vajaduse
  // lisaväljamaksetega sambast (10% tulumaks) ja ülejäänu kasvab edasi.
  const GROW = { id: 'E', name: 'Jätkan kasvatamist', short: 'Raha jääb fondi, võtad välja ainult nii palju, kui vaja (10% tulumaks).' };

  // Stsenaariumid failist pension.js. C nimi loo jaoks: ametlik termin on paindlik pension.
  const SCEN = P.SCENARIOS.map((s) => (s.id === 'C'
    ? Object.assign({}, s, { name: 'Paindlik pension', short: 'Riikliku pensioni lükkad edasi ja seni kasutad II ja III sammast fondipensionina.' })
    : s));

  // III sammas on alati eraldi pott (pension.js p3Sep): oma sissemaksed, oma väljamakse viis, graafikul eraldi.
  // Kui III sammas jäi 55-aastaselt kasvama, kehtib selle pensionieas valik (p3pa). Kui see võeti 55-aastaselt
  // fondipensionina, jätkub ülejäägi fondipension; kui korraga välja, kasvavad hilisemad sissemaksed edasi.
  function withP3(input) {
    if (!input.p3Has) return Object.assign(input, { p3Sep: null });
    const keep = input.p3Plan === 'keep';
    const amount = (keep ? input.p3Base : input.p3RemNow) + input.c3Adj; // c3Adj: tegemata sissemaksed (nt avad hiljem)
    const mode = keep ? input.p3pa : input.p3Plan === 'fund' ? 'fund' : 'grow';
    return Object.assign(input, { p3: input.p3 - amount, p3Pre: input.p3Pre - amount, p3Sep: { amount: amount, mode: mode } });
  }

  // Valikud → üks stsenaarium failist pension.js.
  function scenarioFor(input) {
    const S = (id) => SCEN.find((s) => s.id === id);
    const d = { deferral: input.deferral };
    if (input.method === 'lump') return Object.assign({}, S('A'), d);
    if (input.method === 'grow') return Object.assign({}, GROW, d);
    if (input.deferral > 0) return Object.assign({}, S('C'), d);
    return input.contract === 'yearly' ? S('D') : S('B');
  }

  // Samba vara pensionieas (sama kasvureegel mis simulate'is).
  // fromToday: „mis oleks, kui alates tänasest selles fondis“ (fondivahetuse korrektsioonita).
  function potAtPension(input, r, fromToday) {
    const pa = P.retirementYears(input);
    let fund = input.p2 + (fromToday ? input.p3Pre : input.p3) + (input.p3Sep && !fromToday ? input.p3Sep.amount : 0);
    const c = P.yearlyContribution(input);
    for (let a = input.currentAge; a < pa; a++) fund = fund * (1 + r) + c;
    return fund;
  }

  // ---------- Kulupaketid ----------
  function statCats(household, level) { return K.kategooriad.map((c) => ({ name: c.nimi, v: c[household][level || 'kokkuhoidlik'] })); }
  function statTotal(household, level) { return statCats(household, level).reduce((s, c) => s + c.v, 0); }
  function packageTotal(pkg, household) { return statTotal(household, pkg.id); }
  // Kategooria summa tasemel ja selle vahe kokkuhoidliku tasemega.
  function catAt(pkg, household, name) { return (statCats(household, pkg.id).find((c) => c.name === name) || { v: 0 }).v; }
  function extra(pkg, household, name) { return Math.max(0, catAt(pkg, household, name) - catAt(PACKAGES[0], household, name)); }

  // Mida pakett ostukorvis tähendab (näitlik: Statistikaameti kategooriate summad hindadeks ümber arvutatud).
  function funFacts(pkg, household) {
    const cat = (n) => catAt(pkg, household, n);
    const tanks = cat('Transport') / PRICE.tank;
    const mince = 1 + (extra(pkg, household, 'Toit ja joogid') * 0.4) / PRICE.mince;
    const trips = ((extra(pkg, household, 'Vaba aeg') + extra(pkg, household, 'Kohvikud ja reisimajutus')) * 12) / PRICE.trip;
    const cafes = cat('Kohvikud ja reisimajutus') / PRICE.cafe;
    const facts = [
      ['🥩', mince < 1.5 ? 'veisehakkliha pühadeks, argipäeval kana ja kartul' : one(mince) + ' kg veisehakkliha kuus'],
      ['⛽', (() => { const h = Math.max(0.5, Math.round(tanks * 2) / 2); // poole paagi täpsusega
        return one(h) + (h === 1 ? ' paak' : ' paaki') + ' kütust kuus' + (h < 1 ? ', pigem bussikaart' : ''); })()],
      ['☕', Math.max(1, Math.round(cafes)) + (Math.round(cafes) <= 1 ? ' kohvikulõuna' : ' kohvikulõunat') + ' kuus'],
      ['✈️', trips < 0.5 ? 'reisid pigem maale sugulaste juurde' : Math.round(trips) + (Math.round(trips) === 1 ? ' reis' : ' reisi') + ' aastas soojale maale'],
    ];
    const gifts = cat('Kingitused, annetused jm');
    if (gifts > 0) facts.push(['🎁', eur(gifts) + ' kuus kingitusteks (nt lastelastele) ja annetusteks']);
    return facts;
  }

  function renderPackages(input) {
    const base = statTotal(input.household);
    const max = Math.max.apply(null, PACKAGES.map((p) => packageTotal(p, input.household)));
    const current = radio('pkg') || 'kokkuhoidlik';
    // Legend enne kaarte, et värvide tähendus oleks teada enne ribade lugemist.
    $('packages').innerHTML = '<p class="pkg-legend small-muted mb-0" aria-hidden="true"><span class="dot base"></span>pensionäride keskmine <span class="dot joy"></span>jõukamate leibkondade lisakulu <span class="dot rest"></span>kalleima tasemeni</p>' +
      PACKAGES.map((p) => {
      const total = packageTotal(p, input.household);
      const joy = Math.max(0, total - base);
      const fut = 0;
      const w = (v) => (v / max) * 100 + '%';
      return '<label class="choice pkg"><input type="radio" name="pkg" value="' + p.id + '"' + (p.id === current ? ' checked' : '') + '>' +
        '<span class="choice-body">' +
        '<span class="pkg-top"><span class="choice-emoji" aria-hidden="true">' + p.emoji + '</span><strong>' + p.name + '</strong><span class="pkg-price">' + eur(total) + '<small> /kuus</small></span></span>' +
        '<small>' + p.tagline + '</small>' +
        (isEdited(p) ? '<small class="pkg-edited">Sinu muudetud summa: <strong>' + eur(customTotal(p, input.household)) + '</strong></small>' : '') +
        '<span class="pkg-bar" aria-hidden="true">' + [['base', base], ['joy', joy], ['future', fut]].filter((x) => x[1] > 0).map((x) => '<span class="seg ' + x[0] + '" style="width:' + w(x[1]) + '"></span>').join('') + '</span>' +
        // Riba sisu ka tekstina (mitte ainult värv): ekraanilugejale.
        '<span class="visually-hidden">Pensionäride keskmine ' + eur(base) + (joy ? ', jõukamate leibkondade lisakulu ' + eur(joy) : '') + '.</span>' +
        '<ul class="pkg-facts">' + funFacts(p, input.household).map((f) => '<li><span aria-hidden="true">' + f[0] + '</span> ' + f[1] + '</li>').join('') + '</ul>' +
        (p.alt ? '<span class="pkg-or" aria-hidden="true"><span>või</span></span><span class="pkg-alt"><span aria-hidden="true">🏡</span> <span><span class="visually-hidden">Või: </span>' + p.alt(total) + '</span></span>' : '') +
        '</span></label>';
    }).join('');
    $('packages').querySelectorAll('input').forEach((el) => el.addEventListener('change', update));
  }

  // Paketi read: [võti, nimi, paketi summa, liik]. Kasutaja muudatused on paketi kaupa failis `overrides`.
  const overrides = {};
  function pkgLines(pkg, household) {
    return statCats(household, pkg.id).map((c) => ['stat:' + c.name, c.name, c.v, 'stat'])
      .concat([['other', 'Muud oma kulud', 0, 'other']]);
  }
  function lineValue(pkg, line) {
    const o = overrides[pkg.id];
    return o && o[line[0]] !== undefined ? o[line[0]] : line[2];
  }
  function customTotal(pkg, household) { return pkgLines(pkg, household).reduce((s, l) => s + lineValue(pkg, l), 0); }
  function isEdited(pkg) { return !!overrides[pkg.id] && Object.keys(overrides[pkg.id]).length > 0; }

  // Joonista väljad uuesti ainult paketi või leibkonna vahetusel, et trükkimise ajal fookus ei kaoks.
  let breakdownKey = null;
  function renderBreakdown(input) {
    const key = input.pkg.id + '|' + input.household;
    if (key !== breakdownKey) {
      breakdownKey = key;
      const chip = { stat: '', joy: ' <span class="src-chip tuleva">elamus</span>', future: ' <span class="src-chip puudub">tulevik</span>', other: '' };
      $('pkgBreakdown').innerHTML = '<table class="table table-sm align-middle mb-0 cost-table"><thead><tr><th scope="col">Kulu</th><th scope="col" class="text-end">Paketis</th><th scope="col" class="text-end">Sinu summa, €/kuus</th></tr></thead><tbody>' +
        pkgLines(input.pkg, input.household).map((l, i) =>
          '<tr><td><label for="cost' + i + '" class="mb-0">' + l[1] + '</label>' + chip[l[3]] + '</td>' +
          '<td class="text-end small-muted">' + eur(l[2]) + '</td>' +
          '<td class="text-end"><input class="form-control form-control-sm cost-input" id="cost' + i + '" data-key="' + l[0] + '" type="number" min="0" step="5" inputmode="numeric" value="' + Math.round(lineValue(input.pkg, l)) + '"></td></tr>'
        ).join('') +
        '</tbody><tfoot><tr class="fw-bold"><td>Kokku</td><td class="text-end small-muted" id="pkgDefaultTotal"></td><td class="text-end" id="pkgCustomTotal"></td></tr></tfoot></table>';
      $('pkgBreakdown').querySelectorAll('.cost-input').forEach((el) => el.addEventListener('input', () => {
        const pkg = readInput().pkg;
        const line = pkgLines(pkg, $('household').value).find((l) => l[0] === el.dataset.key);
        const v = Math.max(0, parseFloat(el.value) || 0);
        overrides[pkg.id] = overrides[pkg.id] || {};
        if (v === line[2]) delete overrides[pkg.id][line[0]]; else overrides[pkg.id][line[0]] = v;
        update();
      }));
    }
    $('pkgBreakdown').querySelectorAll('.cost-input').forEach((el) => {
      const o = overrides[input.pkg.id];
      el.classList.toggle('is-edited', !!o && o[el.dataset.key] !== undefined);
    });
    $('pkgDefaultTotal').textContent = eur(input.pkgTotal);
    $('pkgCustomTotal').textContent = eur(input.needMonthly);
    $('resetPkg').classList.toggle('d-none', !input.edited);
    $('pkgSource').innerHTML = '<span class="src-chip stat ms-0">Statistikaamet</span> ' + K.tasemed[input.pkg.id] + ', ' + K.leibkonnad[input.household].toLowerCase() + ', uuring ' + K.uuringuaasta + ', hinnad ' + K.hinnad + '.' +
      (input.pkg.id === 'kokkuhoidlik' ? '' : ' Kvintiili suhe on kõigi leibkondade andmetest, sest pensionäride kohta tulukvintiilide kaupa avalikke andmeid pole.') +
      ' Kingitused, annetused jm on Statistikaameti „muud kulutused“: raha kinkimine, annetused, alimendid ja ülalpidamisraha, trahvid.';
  }

  // ---------- Etappide tekstid ----------
  function kicker(input, idx) {
    const ages = stageAges(P.retirementYears(input))[idx];
    if (!ages) return '';
    let [a, b] = ages;
    if (idx === 3) a = Math.max(a, Math.min(input.currentAge, b)); // tööaastad: alates tänasest
    const tense = b < input.currentAge ? 'Sinu minevik' : a > input.currentAge ? 'Sinu tulevik' : 'Sinu praegune elu';
    const years = a === b ? String(input.birthYear + a) : (input.birthYear + a) + '–' + (b >= 100 ? '…' : input.birthYear + b);
    const label = a === b ? a + '-aastane' : b >= 100 ? a + '+ a' : a + '–' + b + ' a';
    return label + ' · ' + years + ' · ' + tense;
  }

  function renderTexts(input) {
    const pa = P.retirementYears(input);
    for (let i = 1; i <= 7; i++) { const k = $('k' + i); if (k) k.textContent = kicker(input, i); }
    chapters[3].dataset.label = Math.min(input.currentAge, 55) + '–55';
    chapters[5].dataset.label = (pa - 5) + ' a'; // rajal vanus aastates („60 a“)
    chapters[6].dataset.label = pa + ' a';
    // 60: III samba osa
    const p3Done = input.p3Has && input.p3Plan !== 'keep';
    $('p3At60Set').classList.toggle('d-none', !input.p3Has || p3Done);
    $('p3At60Note').classList.toggle('d-none', input.p3Has && !p3Done);
    $('p3At60Note').innerHTML = !input.p3Has
      ? 'Sul ei ole III sammast. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="0">Muuda<span class="visually-hidden"> III samba summat sinu andmetes</span></button>'
      : p3Done ? 'III samba kohta tegid valiku juba ' + input.p3Age + '-aastaselt: <strong>' + (input.p3Plan === 'lump' ? 'võtsid selle korraga välja' : 'fondipension') + '</strong>. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="4">Muuda<span class="visually-hidden"> III samba valikut ' + input.p3Age + '-aastaselt</span></button>' : '';
    // 60 a samm: teine otsustuskoht, kui 55 a samm on loos, muidu esimene.
    $('h5').textContent = (pa - 5) + '-aastaselt: ' + (skipped(4) ? 'esimene' : 'teine') + ' otsustuskoht';
    $('p60Txt').innerHTML = (input.birthYear + pa - 5) + '. aastal oled ' + (pa - 5) + '-aastane, 5 aastat enne pensioniiga. Siis avaneb soodustingimustel II samba väljavõtmise võimalus. Väljamakse algab selles loos pensionieas. Kui hakkad raha välja võtma, lõpevad II samba sissemaksed igaveseks.';
    chapters[7].dataset.label = (pa + 1) + '+ a';

    // 0–18
    $('childMore').classList.toggle('d-none', input.child === 'none');
    $('childNote').innerHTML = input.child === 'none'
      ? 'Paljudel see nii ongi. Lugu läheb edasi.'
      : '18-aastaselt oli sul kogutud <strong>' + eur(input.child18) + '</strong>. ' +
        (input.childNow > 0 ? 'Täna on see <strong>' + eur(input.childNow) + '</strong> ja lisame selle sinu pensionivarale.' : 'Kasutasid selle ära, pensioniks see ei jää.');

    // 18
    const age2002 = 2002 - input.birthYear;
    $('p2018').textContent = input.birthYear + 18 < 2002
      ? 'Said 18-aastaseks ' + (input.birthYear + 18) + '. aastal. II sammas algas 2002. aastal, kui olid ' + age2002 + '-aastane.'
      : 'Kui said 18-aastaseks (' + (input.birthYear + 18) + '), oli II sammas juba olemas.';
    $('fund18More').classList.toggle('d-none', radio('fund18') !== 'self');
    $('fund18Note').innerHTML = '<strong>' + FUNDS[input.fund18].name + '</strong>: eeldatav tootlus ' + pct(FUNDS[input.fund18].r) + ' aastas pärast inflatsiooni. ' + FUNDS[input.fund18].note;

    // 18–55
    $('sameFundTxt').textContent = 'Jätkad fondiga: ' + FUNDS[input.fund18].name.toLowerCase() + '.';
    $('fundNewMore').classList.toggle('d-none', radio('fundChange') !== 'switch');
    const pot = potAtPension(input, input.realReturn);
    $('switchYear').textContent = 'aastal ' + (input.birthYear + input.switchAge);
    $('switchNote').textContent = input.switchAge <= input.currentAge
      ? 'Vahetad kohe. Edasi kasvab raha uues fondis (' + pct(FUNDS[input.fundNow].r) + ').'
      : 'Vahetad ' + input.switchAge + '-aastaselt. Seni (' + (input.switchAge - input.currentAge) + ' a) kasvab raha praeguses fondis (' + pct(FUNDS[input.fund18].r) + '), pärast seda uues fondis (' + pct(FUNDS[input.fundNow].r) + ').';
    $('workNote').innerHTML = 'Pensionieaks (' + pa + ' a) kasvab sinu sammaste vara umbes <strong>' + eur(pot).replace(' €', ' euroni') + '</strong>.';

    // Kulud: leibkond
    $('hhNote').innerHTML = input.household === 'paar'
      ? '<span class="hh-emoji" aria-hidden="true">👫</span><span><strong>Elad pensionil paaris.</strong> Summad on sinu osa paari kuludest (ühe inimese kohta). Ühine kodu ja arved teevad elu inimese kohta odavamaks kui üksi.</span>'
      : '<span class="hh-emoji" aria-hidden="true">🧍</span><span><strong>Elad pensionil üksi.</strong> Summad on üksi elava pensionäri kulud: kodu ja arved maksad ainult sina.</span>';

    // 18–55: III sammas
    $('p3HasMore').classList.toggle('d-none', !input.p3Has);
    $('p3OpenWrap').classList.toggle('d-none', $('p3Joined').value !== 'none');
    const oe = $('p3OpenAge');
    if (input.p3Kind === 'future' && document.activeElement !== oe && oe.value !== String(input.p3OpenAge)) oe.value = String(input.p3OpenAge);
    $('p3OpenYear').textContent = 'aastal ' + (input.birthYear + input.p3OpenAge);
    if (input.p3Has) {
      const yearly = input.p3Monthly * 12;
      const refund = Math.min(yearly, 0.15 * input.grossMonthly * 12, 6000) * 0.22;
      const future = input.p3OpenAge > input.currentAge;
      $('p3WorkNote').innerHTML = (future ? 'Avad III samba ' + input.p3OpenAge + '-aastaselt, seni sissemakseid pole. Tänast III samba summat ei arvestata. ' : '') +
        (input.p3Before2021 ? 'Avatud enne 2021: ' : 'Avatud 2021 või hiljem: ') + 'soodusmaks kehtib alates <strong>' + input.p3Open + '-aastaselt</strong>' +
        (input.p3Open > (input.p3Before2021 ? 55 : 60) ? ' (kogumist peab olema vähemalt 5 aastat)' : '') + '. ' +
        (refund > 0 ? 'Sissemaksetelt saad tulumaksu tagasi umbes <strong>' + eur(refund) + ' aastas</strong> (22%, kuni 15% brutotulust ja 6000 €). Arvutus seda sambasse ei lisa.' : '');
    } else {
      $('p3WorkNote').textContent = 'III sammast ei ole. Tänast III samba summat ei arvestata.';
    }

    // 55: III samba väljavõtt
    const pa0 = P.retirementYears(input);
    const soon = input.p3Age >= input.p3Open; // kas väljavõtu ajal kehtib soodusmaks
    const basic = input.p3Before2021 ? 55 : 60;
    $('p3Info').innerHTML = !input.p3Has ? '' : '<p class="mb-2">' + (input.p3Kind === 'have' ? 'Liitusid III sambaga ' + (input.p3Before2021 ? 'enne 2021' : '2021 või hiljem') : 'Avad III samba ' + input.p3OpenAge + '-aastaselt (' + (input.birthYear + input.p3OpenAge) + ')') + ', seega kehtib soodusmaks alates <strong>' + input.p3Open + '-aastaselt (' + (input.birthYear + input.p3Open) + ')</strong>.' +
      (input.p3Open > basic ? ' Põhjus: kogumist peab olema vähemalt 5 aastat.' : '') + (input.p3Open > 55 ? ' Enne seda läheb väljavõetud rahast 22% tulumaksuks.' : '') + '</p>' +
      '<ul class="mb-0 small">' +
        '<li><strong>Kogu raha korraga välja võttes</strong> läheb tulumaksuks ' + (input.p3Open <= 55 ? '10%.' : '22%, alates ' + input.p3Open + '-aastaselt 10%.') + '</li>' +
        '<li><strong>Fondipensionina välja võttes</strong> (igakuised väljamaksed elada jäänud aastate peale) on tulumaks ' + (input.p3Open <= 55 ? '0%.' : '0%, aga see on võimalik alles ' + input.p3Open + '-aastaselt.') + '</li>' +
        '<li><strong>Kasvama jättes</strong> maksu ei ole: raha jääb fondi ja kasvab edasi.</li></ul>';
    $('p3LumpTxt').textContent = 'Kogu III sammas ühe korraga, ' + (soon ? '10%' : '22%') + ' tulumaksuks.';
    $('p3FundTxt').textContent = soon
      ? 'Igakuine maksuvaba väljamakse elada jäänud aastate peale. Ülejäänud raha kasvab edasi.'
      : 'Pole veel võimalik: fondipensioni saad alles ' + input.p3Open + '-aastaselt' + (P.retirementYears(input) - 5 >= input.p3Open ? ' (vali see järgmises sammus).' : '.');
    // Kui täiendav fondipension pole veel lubatud, keela see valik (ja vali „Jätan kasvama“).
    const fundRadio = document.querySelector('input[name="p3plan"][value="fund"]');
    fundRadio.disabled = !soon;
    fundRadio.closest('.choice').classList.toggle('is-disabled', !soon);
    if (!soon && fundRadio.checked) document.querySelector('input[name="p3plan"][value="keep"]').checked = true;
    const lockTxt = !input.p3Has ? 'Sul ei ole III sammast (summa esimeses vaates on 0), seega siin pole midagi välja võtta.'
      : input.p3Age >= pa0 ? 'Oled juba pensionieas, seega kasutad III sammast koos II sambaga pensionieas.'
      : !input.p3Allowed ? 'Avad III samba alles ' + input.p3OpenAge + '-aastaselt, seega 55-aastaselt pole veel midagi välja võtta.' : '';
    $('p3Locked').innerHTML = lockTxt + (lockTxt ? ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="0">Muuda III sammast<span class="visually-hidden"> sinu andmetes</span></button>' : '');
    $('p3Locked').classList.toggle('d-none', !lockTxt);
    $('p3PlanSet').disabled = !!lockTxt;

    // Pensioniiga: edasilükkamine
    // Edasilükkamine käib kõigi väljamakse viisidega: vahepeal elad samba või hoiuse rahast.
    $('deferLocked').classList.add('d-none');
    // Pensionieas: II ja III valik eraldi, ainult kui 60-aastaselt jätkasid kasvatamist. Muidu kast tehtud valikuga.
    const p3Open = input.p3Has && input.p3Plan === 'keep';
    $('payoutPaSet').classList.toggle('d-none', input.payout !== 'grow');
    $('paIINote').classList.toggle('d-none', input.payout === 'grow');
    $('paIINote').innerHTML = input.payout === 'grow' ? '' : '<strong>II sammas:</strong> valiku tegid ' + (pa - 5) + '-aastaselt: ' + { lump: 'võtad korraga välja', fund: 'fondipension' }[input.payout] + '. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda<span class="visually-hidden"> II samba valikut ' + (pa - 5) + '-aastaselt</span></button>';
    $('p3PaSet').classList.toggle('d-none', !(p3Open && input.p3At60 === 'grow'));
    $('paIIINote').classList.toggle('d-none', p3Open && input.p3At60 === 'grow');
    $('paIIINote').innerHTML = '<strong>III sammas:</strong> ' + (!input.p3Has ? 'sul ei ole III sammast.'
      : !p3Open ? 'valiku tegid ' + input.p3Age + '-aastaselt: ' + (input.p3Plan === 'lump' ? 'võtsid korraga välja' : 'fondipension') + '. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="4">Muuda<span class="visually-hidden"> III samba valikut ' + input.p3Age + '-aastaselt</span></button>'
      : 'valiku tegid ' + (pa - 5) + '-aastaselt: ' + { lump: 'võtad pensionieas korraga välja', fund: 'fondipension' }[input.p3At60] + '. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda<span class="visually-hidden"> III samba valikut ' + (pa - 5) + '-aastaselt</span></button>');
    const curDef = input.deferral;
    $('deferChoices').innerHTML = [0, 1, 2, 3, 4, 5].map((d) => {
      const inc = P.DEFERRAL_INCREASE[d];
      return '<label class="choice"><input type="radio" name="defer" value="' + d + '"' + (d === curDef ? ' checked' : '') + '>' +
        '<span class="choice-body"><strong>' + (d === 0 ? 'Kohe, ' + pa + '-aastaselt' : (pa + d) + '-aastaselt') + '</strong>' +
        '<small>' + eur(input.p1Monthly * (1 + inc)) + ' kuus' + (d ? ' (+' + one(inc * 100) + '%)' : '') + '</small></span></label>';
    }).join('');
    $('deferChoices').querySelectorAll('input').forEach((el) => el.addEventListener('change', update));

    // 66+
    let lockMsg = '';
    if (input.method === 'grow') lockMsg = 'Kasvatad edasi, nii et fondipensioni lepingut pole. Raha kasvab fondis ja võtad välja ainult nii palju, kui kuus vaja (10% tulumaks).';
    else if (input.method === 'lump') lockMsg = 'Võtsid samba raha korraga välja, nii et fondipensioni lepingut pole vaja. Raha on hoiusel ja kasutad seda vajaduse järgi.';
    else if (input.deferral > 0) lockMsg = 'Paindlik pension: lükkasid riikliku pensioni ' + input.deferral + ' aastat edasi ja seni kasutad II ja III sammast fondipensionina. Riiklik pension algab ' + (pa + input.deferral) + '-aastaselt ja on eluks ajaks suurem.';
    // Lukus: kaarte ei näita, vaid selgitab ja viib sinna, kus otsus tehakse.
    $('contractLocked').innerHTML = lockMsg + (lockMsg ? (input.payout === 'lump'
      ? ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda ' + (pa - 5) + '-aastaselt<span class="visually-hidden"> II samba väljamakse viisi</span></button>'
      : ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="6">Muuda pensionieas<span class="visually-hidden"> samba raha kasutamise viisi</span></button>') : '');
    $('contractLocked').classList.toggle('d-none', !lockMsg);
    $('contractSet').disabled = !!lockMsg;
    $('contractSet').classList.toggle('d-none', !!lockMsg);
    $('h7').textContent = lockMsg
      ? 'Pensionipõlv: kuidas raha kestab?'
      : 'Pensionipõlv: kuidas fondipension kestab?';
  }

  function renderPotBar(input) {
    const pa = P.retirementYears(input);
    const p1 = input.p1Monthly * (1 + P.DEFERRAL_INCREASE[input.deferral]);
    const items = [
      ['🏦', eur(potAtPension(input, input.realReturn)), 'sammastes ' + pa + '-aastaselt'],
      ['🏛️', eur(p1) + ' /kuus', 'riiklik pension'],
    ].concat(input.extraDeposit > 0 ? [['🐷', eur(input.extraDeposit), 'tavalisel hoiusel (III sambast välja võetud)']] : []).concat([
      ['🛒', visited.has(8) ? eur(input.needMonthly) + ' /kuus' : 'valimata', 'kulud' + (visited.has(8) ? ' (' + input.pkg.name + (input.edited ? ', muudetud' : '') + ')' : '')],
    ]);
    $('potBar').innerHTML = items.map((x) => '<div class="pot-item"><span class="pot-emoji" aria-hidden="true">' + x[0] + '</span><span><strong>' + x[1] + '</strong><small>' + x[2] + '</small></span></div>').join('');
  }

  // ---------- Tulemus ----------
  function answerText(r, input) {
    const need = eur(input.needMonthly) + ' kuus';
    const parts = [];
    if (r.coversNeedUntil === null) parts.push('Sinu kulud (' + need + ') on kaetud <strong>kuni 100. eluaastani</strong>.');
    else if (r.gapTemporary) parts.push('Sinu kulud (' + need + ') jäävad katmata <strong>' + r.coversNeedUntil + (r.gapEnd > r.coversNeedUntil ? '–' + r.gapEnd : '') + '-aastaselt</strong>' +
      (r.coversNeedUntil < r.p1StartAge ? ', sest riiklik pension algab alles ' + r.p1StartAge + '-aastaselt' : '') + '. Alates ' + (r.gapEnd + 1) + '-aastaselt on need jälle kaetud.');
    else if (r.coversNeedUntil <= r.pensionStartAge) parts.push('Sinu kulud (' + need + ') <strong>ei ole kaetud juba pensioni alguses</strong>.');
    else parts.push('Sinu kulud (' + need + ') on kaetud <strong>kuni ' + r.coversNeedUntil + '. eluaastani</strong>.');
    if (r.moneyEndAge === null) parts.push('Samba raha ei saa enne 100. eluaastat otsa.');
    else parts.push('Samba ja hoiuse raha lõpeb ' + r.moneyEndAge + '-aastaselt, edasi jääb riiklik pension ' + eur(r.incomeAfterMoney) + ' kuus.');
    parts.push('<strong>Elu lõpuni</strong> (' + r.horizonAge + '. eluaastani) kannab see plaan kuni <strong>' + eur(r.sustainable) + ' kuus</strong>.');
    return parts.join(' ');
  }

  function renderMetrics(r) {
    const tiles = [
      [r.coversNeedUntil === null ? '100+' : r.gapTemporary ? r.coversNeedUntil + '–' + r.gapEnd + ' a' : r.coversNeedUntil + ' a', r.gapTemporary ? 'kulud katmata (ajutiselt)' : 'kulud kaetud kuni'],
      [r.moneyEndAge === null ? 'ei lõpe' : r.moneyEndAge + ' a', 'samba raha lõpeb'],
      [eur(r.spendAt90), 'kuus 90-aastaselt'],
      [eur(r.sustainable), 'kuus kannab plaan elu lõpuni (' + r.horizonAge + ' a)'],
    ];
    $('metrics').innerHTML = tiles.map((t) =>
      '<div class="col-6 col-md-3"><div class="metric"><div class="value">' + t[0] + '</div><div class="label">' + t[1] + '</div></div></div>'
    ).join('');
  }

  function renderLegacy(r, input) {
    let median = 100;
    for (let a = input.currentAge; a <= 100; a++) if (P.survival(T, input.sex, input.currentAge, a) <= 0.5) { median = a; break; }
    const row = r.rows.find((x) => x.age === median);
    const left = row ? row.moneyLeft : 0;
    const box = $('legacy');
    if (left < 1000 || r.coversNeedUntil !== null && r.coversNeedUntil <= median) {
      // Väljavõetud raha seisab hoiusel (0% pärast inflatsiooni). Soovita see kasvama jätta või uuesti investeerida.
      const tips = [];
      const rPct = pct(input.realReturn);
      if (input.method === 'lump') tips.push(['ii', 'Ära võta II sammast korraga välja.',
        'Väljavõetud raha seisab hoiusel ja inflatsioon sööb selle väärtust (arvutuses −1% aastas pärast inflatsiooni). Fondis kasvab see edasi (sinu valitud tootlusega ' + rPct + ' aastas pärast inflatsiooni). ' +
        'Kui oled raha juba välja võtnud, pane see uuesti kasvama (nt indeksfondi), ära hoia seda arvel ega padja all.',
        ico('sprout') + ' Jätka II samba kasvatamist']);
      if (input.p3Has && input.p3Plan !== 'keep') tips.push(['iii', 'Jäta III sammas kasvama.',
        (input.p3Use === 'spend'
          ? 'Kui kulutad III samba raha ' + input.p3Age + '-aastaselt ära, pole seda pensionil.'
          : 'Hoiusel seisev raha kaotab väärtust (arvutuses −1% aastas pärast inflatsiooni), fondis kasvab sinu valitud tootlusega (' + rPct + ' aastas).') +
        ' Kui oled selle juba välja võtnud, investeeri see uuesti, ära hoia seda arvel ega padja all.',
        ico('sprout') + ' Jäta III sammas kasvama']);
      box.innerHTML = '<div class="legacy-card"><h3 class="h5">Raha üle ei jää. Mida saaks muuta?</h3>' +
        (tips.length ? '<ul class="tips">' + tips.map((x) => '<li><strong class="tip-title">' + x[1] + '</strong><p class="tip-body">' + x[2] + '</p><button type="button" class="btn btn-primary btn-sm" data-tip="' + x[0] + '">' + x[3] + '</button></li>').join('') + '</ul>' : '') +
        '<p class="legacy-hint mb-2">' + (tips.length ? 'Või proovi' : 'Proovi') + ' mõnda neist ja vaata, kuidas tulemus muutub.</p><div class="d-flex flex-wrap gap-2">' +
        '<button type="button" class="btn btn-outline-primary btn-sm" data-goto="6">' + ico('landmark') + ' Lükka riiklik pension edasi</button>' +
        '<button type="button" class="btn btn-outline-primary btn-sm" data-goto="8">' + ico('cart') + ' Vali teine kulupakett</button></div></div>';
      box.querySelectorAll('[data-tip]').forEach((btn) => btn.addEventListener('click', () => {
        const check = (n, v) => { const el = document.querySelector('input[name="' + n + '"][value="' + v + '"]'); if (el) el.checked = true; };
        if (btn.dataset.tip === 'ii') { check('payout', 'grow'); check('payoutPa', 'grow'); }
        else check('p3plan', 'keep');
        update();
        $('answer').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
      return;
    }
    const opts = [
      ['heirs', '👨‍👩‍👧', 'Pärandan lähedastele', 'Lähedastele jääb umbes ' + eur(left) + '. Pärandamiseks tee testament või lisa fondipensioni lepingusse soodustatud isik.'],
      ['donate', '💝', 'Annetan', eur(left) + ' võiks toetada sulle olulist eesmärki. Annetuse saad testamendis määrata.'],
      ['spend', '🎒', 'Kulutan ise rohkem', 'Elu lõpuni kannab plaan ' + eur(r.sustainable) + ' kuus. See on ' + eur(Math.max(0, r.sustainable - input.needMonthly)) + ' rohkem kui praegu.'],
      ['care', '🏡', 'Jätan puhvriks hoolduseks', 'Puhver katab ootamatud kulud ja hooldekodu, nii ei pea lapsed maksma.'],
    ];
    box.innerHTML = '<div class="legacy-card"><h3 class="h5">Sul jääb raha üle. Mida sellega teed?</h3>' +
      '<p class="text-secondary">Kui elad keskmiselt kaua (' + median + '-aastaseks, pooled sinuvanustest elavad kauem), on samba ja hoiuse raha alles umbes <strong>' + eur(left) + '</strong>.</p>' +
      '<fieldset><legend class="visually-hidden">Mida ülejäägiga teed?</legend><div class="choices choices-sm">' +
      opts.map((o) => '<label class="choice"><input type="radio" name="legacy" value="' + o[0] + '"' + (legacyChoice === o[0] ? ' checked' : '') + '><span class="choice-body"><span class="choice-emoji" aria-hidden="true">' + o[1] + '</span><strong>' + o[2] + '</strong></span></label>').join('') +
      '</div></fieldset><div class="story-note mt-3" id="legacyNote" aria-live="polite"></div></div>';
    const note = () => {
      const o = opts.find((x) => x[0] === legacyChoice);
      $('legacyNote').innerHTML = o ? o[3] + (o[0] === 'spend' && r.sustainable > input.needMonthly
        ? ' <button type="button" class="btn btn-link p-0 align-baseline" id="trySpend">Proovi ' + eur(r.sustainable) + ' kuus</button>' : '') : 'Vali üks variant.';
      const t = $('trySpend');
      if (t) t.addEventListener('click', () => { const pkg = input.pkg; overrides[pkg.id] = overrides[pkg.id] || {};
        const other = lineValue(pkg, ['other', '', 0]);
        overrides[pkg.id].other = Math.round(other + r.sustainable - input.needMonthly);
        breakdownKey = null; update(); });
    };
    box.querySelectorAll('input[name="legacy"]').forEach((el) => el.addEventListener('change', () => { legacyChoice = el.value; note(); }));
    note();
  }

  function renderRecap(input, scenario) {
    const pa = P.retirementYears(input);
    const items = [
      [0, '🙂', 'Sündinud ' + input.birthYear + ', II sammas ' + eur(input.p2) + ', III sammas ' + eur(input.p3Base)],
      [4, '🔓', !input.p3Has ? 'III sammast ei ole' : input.p3Plan === 'keep' ? 'III sammas jääb kasvama' : (input.p3Plan === 'lump' ? 'Võtan III samba ' + input.p3Age + '-aastaselt korraga välja: ' + eur(input.p3Net) : 'Fondipension III sambast alates ' + input.p3Age + '-aastaselt: ' + eur(input.p3Net)) + (input.p3Plan === 'keep' ? '' : input.p3Use === 'save' ? ', hoiusele' : ', kasutan kohe')],
      [5, '🧳', 'II sammas: ' + { grow: 'jätkan kasvatamist', lump: 'võtan korraga välja', fund: 'fondipension' }[input.payout] +
        (input.p3Has && input.p3Plan === 'keep' ? '. III sammas: ' + { grow: 'jätkan kasvatamist', lump: 'võtan pensionieas korraga välja', fund: 'fondipension' }[input.p3At60] : '')],
      [6, '🏛️', (input.payout === 'grow' ? 'Pensionieas II sammas: ' + { grow: 'kasvatan edasi', lump: 'võtan korraga välja', fund: 'fondipension' }[input.method] + '. ' : '') +
        (input.p3Has && input.p3Plan === 'keep' && input.p3At60 === 'grow' ? 'III sammas: ' + { grow: 'kasvatan edasi', lump: 'võtan korraga välja', fund: 'fondipension' }[input.p3pa] + '. ' : '') + (!input.deferral ? 'Riiklik pension ' + pa + '-aastaselt' : 'Riiklik pension ' + (pa + input.deferral) + '-aastaselt (' + input.deferral + ' a hiljem)')],
      [7, '🌳', 'Väljamakse viis: ' + scenario.name.toLowerCase()],
      [8, '🛒', input.pkg.name + (input.edited ? ' (muudetud)' : '') + ': ' + eur(input.needMonthly) + ' kuus'],
    ];
    // Iga „Muuda“ nupu ekraanilugeja nimi ütleb, mida see muudab (WCAG 2.4.4).
    const RECAP_WHAT = { 0: 'sinu andmeid', 4: 'III samba valikut 55-aastaselt', 5: 'II ja III samba valikut ' + (pa - 5) + '-aastaselt',
      6: 'riikliku pensioni ja samba raha valikut pensionieas', 7: 'pensionipõlve valikut', 8: 'kulupaketti' };
    $('recap').innerHTML = items.filter((x) => !skipped(x[0])).map((x) => '<li><span aria-hidden="true">' + x[1] + '</span><span class="flex-grow-1">' + x[2] + '</span><button type="button" class="btn btn-link btn-sm p-0" data-goto="' + x[0] + '">Muuda<span class="visually-hidden"> ' + (RECAP_WHAT[x[0]] || chapters[x[0]].dataset.label) + '</span></button></li>').join('');
  }

  // Otsuste kaart: reeglid ja maksud (Pensionikeskus, SKA 2026) koos kasutaja valikuga.
  function renderMap(input, scenario) {
    const pa = P.retirementYears(input), m = input.paMonths, by = input.birthYear;
    const when = (y, mm) => ageAt(y, mm) + ' · ' + (by + y);
    const items = [
      [when(input.currentAge, 0).replace(/-aastaselt/, '-aastaselt, täna'), 'Igal ajal enne pensioniiga',
        'II samba raha saab välja võtta 22% tulumaksuga. Siis lõpevad sissemaksed ja uuesti saab liituda alles 10 aasta pärast. III sammas enne soodusiga: 22%. III samba sissemaksetelt saad 22% tulumaksu tagasi (kuni 15% brutotulust, kuni 6000 € aastas).',
        null],
    ];
    if (input.p3Has) items.push([when(input.p3Open, 0), 'III sammas soodusmaksuga',
      'Korraga või lühem väljamakse 10%, eluaegne või elada jäänud aastate pikkune väljamakse (fondipension) 0%. Tingimus: kogumist on vähemalt 5 aastat. ' +
      (input.p3Before2021 ? 'Alates 55, sest liitusid enne 2021.' : 'Alates 60, sest liitusid 2021 või hiljem.'),
      { keep: 'Jätan kasvama', lump: 'Võtan korraga välja', fund: 'Fondipension' }[input.p3Plan]]);
    items.push([when(pa - 5, m), 'II sammas ja paindlik riiklik pension',
      'II sammas: korraga 10%, fondipension soovitusliku perioodi peale (vähemalt 4 makset aastas) 0%, lühem periood 10%. Kui hakkad raha välja võtma, lõpevad II samba sissemaksed. ' +
      'Riiklikku pensioni saab võtta kuni 5 aastat varem, eluks ajaks väiksemana: −7,17% (1 a), −13,78% (2 a), −19,88% (3 a), −25,50% (4 a), −30,67% (5 a). Selleks on vaja 20–40 aastat staaži.',
      { grow: 'Jätkan kasvatamist', lump: 'Võtan korraga välja', fund: 'Fondipension' }[input.payout]]);
    items.push([when(pa, m), 'Riiklik pension täissummas (' + ageTxt(pa, m) + ')',
      'Vähemalt 15 aastat Eesti staaži. Pensionieas on maksuvaba tulu 776 € kuus (2026). Kindlustusseltsi eluaegne pension on maksuvaba. ' +
      (by + 65 >= 2029 ? 'Alates 2029 seotakse pensioniiga oodatava elueaga, seega see on ligikaudne.' : ''),
      input.payout === 'grow' ? { grow: 'Kasvatan edasi', lump: 'Kõik korraga', fund: 'Fondipension' }[input.method] : null]);
    if (input.method === 'fund' && !input.deferral) items.push([when(pa, m), 'Fondipensioni leping: üks kord või igal aastal uuesti',
      'Ühe lepinguga lõpeb väljamakse perioodi lõpus. Kui sõlmid lepingu igal aastal uuesti vähemalt soovitusliku perioodiga, jääb see maksuvabaks ega saa otsa, aga väga kõrges eas on kuumakse väiksem.',
      scenario.name]);
    items.push([when(pa + 1, m) + '…' + (by + pa + 5), 'Riikliku pensioni edasilükkamine',
      'Iga edasilükatud aasta tõstab riiklikku pensioni eluks ajaks: +7,93% (1 a), +16,88% (2 a), +27,01% (3 a), +38,50% (4 a), +51,57% (5 a), 2026 keskmised.',
      input.deferral ? 'Lükkan ' + input.deferral + ' aastat edasi: ' + eur(input.p1Monthly * (1 + P.DEFERRAL_INCREASE[input.deferral])) + ' kuus' : 'Võtan kohe']);
    items.push(['Elu lõpus', 'Pärimine',
      'Fondis olev raha (ka fondipension) läheb pärijatele. Kui pärija võtab II samba osakud rahana välja, on maks 22%. Eluaegne kindlustuspension pärandada ei saa (v.a garantiiperiood).',
      legacyChoice ? { heirs: 'Pärandan lähedastele', donate: 'Annetan', spend: 'Kulutan ise rohkem', care: 'Puhver hoolduseks' }[legacyChoice] : null]);
    // Järjesta vanuse (aasta) järgi; „Elu lõpus“ jääb viimaseks.
    const yearOf = (x) => { const m = x[0].match(/· (\d{4})/); return m ? +m[1] : 9999; };
    items.sort((a, b) => yearOf(a) - yearOf(b));
    $('decisionMap').innerHTML = items.map((x) => {
      const yr = parseInt((x[0].match(/· (\d{4})/) || [])[1], 10);
      const past = yr && yr < P.CURRENT_YEAR ? ' <span class="badge text-bg-light">avanenud</span>' : '';
      return '<li><div class="when">' + x[0] + past + '</div><div class="fw-medium">' + x[1] + '</div><div class="text-secondary small">' + x[2] + '</div>' +
        (x[3] ? '<div class="map-choice">Sinu valik: <strong>' + x[3] + '</strong></div>' : '') + '</li>';
    }).join('');
  }

  function renderCompare(defs, results, activeId) {
    const rows = [
      ['Kulud kaetud kuni', (r) => (r.coversNeedUntil === null ? 101 : r.coversNeedUntil), (v) => (v > 100 ? '100+' : v + ' a'), 'max'],
      ['Elus sellest vanusest kauem', (r) => (r.coversNeedUntil === null ? 0 : r.aliveAtShortfall), pct, null],
      ['Samba raha lõpeb', (r) => (r.moneyEndAge === null ? 101 : r.moneyEndAge), (v) => (v > 100 ? 'ei lõpe' : v + ' a'), 'max'],
      ['Kuus 90-aastaselt', (r) => r.spendAt90, eur, 'max'],
      ['Kannab elu lõpuni, kuus', (r) => r.sustainable, eur, 'max'],
      ['Oodatav kogukulutus', (r) => r.expectedLifetime, eur, 'max'],
    ];
    const head = '<thead><tr><th></th>' + defs.map((s) => '<th' + (s.id === activeId ? ' class="mine"' : '') + '>' + s.name + (s.id === activeId ? '<br><small>sinu valik</small>' : '') + '</th>').join('') + '</tr></thead>';
    const body = rows.map(([label, get, fmt, best]) => {
      const vals = results.map(get);
      const top = best ? Math.max.apply(null, vals) : null;
      return '<tr><th scope="row">' + label + '</th>' + vals.map((v) =>
        '<td class="' + (best && vals.filter((x) => x === top).length < vals.length && v === top ? 'best' : '') + '">' + fmt(v) + '</td>'
      ).join('') + '</tr>';
    }).join('');
    $('compare').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  // Triibumuster (sama värv + tumesinised triibud), et hoiuse osa ei eristuks ainult värviga.
  function stripes(base, line) {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 8, 8);
    g.strokeStyle = line; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
    return g.createPattern(c, 'repeat');
  }

  // Täppide muster (III sammas), et II ja III sammas ei eristuks ainult värviga.
  function dots(base, dot) {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 8, 8);
    g.fillStyle = dot; g.beginPath(); g.arc(2, 2, 1.2, 0, Math.PI * 2); g.arc(6, 6, 1.2, 0, Math.PI * 2); g.fill();
    return g.createPattern(c, 'repeat');
  }

  // Graafiku tekstiline kokkuvõte (põhijäreldused) ja andmetabel (WCAG 1.1.1, ka klaviatuuri ja ekraanilugeja kasutajale).
  function chartSummary(r, input) {
    const pa = r.pensionStartAge, start = r.rows.find((x) => x.age === pa) || r.rows[0];
    const src = [eur(start.i1) + ' riiklikku pensioni', start.i2 > 0.5 ? eur(start.i2) + ' II sambast' : '', start.i3 > 0.5 ? eur(start.i3) + ' III sambast' : '', start.dep > 0.5 ? eur(start.dep) + ' hoiuselt' : ''].filter(Boolean);
    const parts = ['Pensioni alguses (' + pa + '-aastaselt) tuleb kuus ' + (src.length > 1 ? src.slice(0, -1).join(', ') + ' ja ' + src[src.length - 1] : src[0]) + '.',
      'Sinu kulud on ' + eur(input.needMonthly) + ' kuus.'];
    if (r.coversNeedUntil === null) parts.push('Kulud on kaetud kuni 100. eluaastani.');
    else parts.push('Kulud on kaetud kuni ' + r.coversNeedUntil + '. eluaastani.');
    if (r.moneyEndAge !== null) parts.push('Samba ja hoiuse raha lõpeb ' + r.moneyEndAge + '-aastaselt, siis jääb ainult riiklik pension ' + eur(r.incomeAfterMoney) + ' kuus.');
    return parts;
  }
  function chartTable(r, input) {
    const rows = r.rows.filter((x) => x.age >= r.pensionStartAge);
    return '<table class="table table-sm align-middle mb-0"><caption id="chartTableCaption">Sissetulek ja kulud kuus vanuse järgi (tänastes eurodes)</caption>' +
      '<thead><tr><th scope="col">Vanus</th><th scope="col">Aasta</th><th scope="col" class="text-end">I sammas</th><th scope="col" class="text-end">II sammas</th><th scope="col" class="text-end">III sammas</th><th scope="col" class="text-end">Hoiuselt</th><th scope="col" class="text-end">Kulud</th><th scope="col" class="text-end">Puudu</th><th scope="col" class="text-end">Elus</th></tr></thead><tbody>' +
      rows.map((x) => '<tr><th scope="row">' + x.age + '</th><td>' + x.year + '</td><td class="text-end">' + eur(x.i1) + '</td><td class="text-end">' + eur(x.i2) + '</td><td class="text-end">' + eur(x.i3) + '</td><td class="text-end">' + eur(x.dep) +
        '</td><td class="text-end">' + eur(input.needMonthly) + '</td><td class="text-end">' + (x.shortfall > 0.5 ? eur(x.shortfall) : '–') + '</td><td class="text-end">' + Math.round(x.alive * 100) + '%</td></tr>').join('') +
      '</tbody></table>';
  }

  // Õhk legendi ja graafiku vahel: legendi ala tehakse 16px kõrgemaks (Chart.js 4: legend luuakse pärast init'i).
  function patchLegend(ch) {
    const lg = ch.legend;
    if (!lg || lg.$gap) return;
    const fit = lg.fit;
    lg.fit = function () { fit.call(this); this.height += 16; };
    lg.$gap = true;
  }
  const LEGEND_GAP = { id: 'legendGap', afterInit: patchLegend, beforeUpdate: patchLegend };

  // Selgitus: kuidas graafikut lugeda + sinu graafik etappide kaupa (muutub koos valikutega).
  const isMobile = () => window.matchMedia('(max-width: 575px)').matches;
  function chartExplain(r, input, mobile) {
    // Kirjutatud nii, et graafiku sisu on arusaadav ka ilma seda nägemata (ekraanilugeja).
    const pa = r.pensionStartAge, need = input.needMonthly;
    const rows = r.rows.filter((x) => x.age >= pa);
    const ageOf = (a) => a + '-aastaselt';
    const alive = (a) => { const x = rows.find((y) => y.age === a); return x ? Math.round(x.alive * 100) : null; };
    // Etapid: järjestikused aastad, kus kulude katmise allikad on samad.
    const key = (x) => [x.i1 > 0.5, x.i2 > 0.5, x.i3 > 0.5, x.dep > 0.5, x.shortfall > 0.5].map(Number).join('');
    const phases = [];
    rows.forEach((x) => {
      const last = phases[phases.length - 1];
      if (last && last.k === key(x)) { last.to = x.age; last.rows.push(x); }
      else phases.push({ k: key(x), from: x.age, to: x.age, rows: [x] });
    });
    const avg = (ph, f) => ph.rows.reduce((s, x) => s + x[f], 0) / ph.rows.length;
    const surplus = (ph) => ph.rows.reduce((s, x) => s + Math.max(0, x.i1 + x.i23 - x.spend), 0) / ph.rows.length;
    const parts = (ph) => [
      avg(ph, 'i1') > 0.5 ? 'riiklik pension ' + eur(avg(ph, 'i1')) : '',
      avg(ph, 'i2') > 0.5 ? 'II sammas ' + eur(avg(ph, 'i2')) : '',
      avg(ph, 'i3') > 0.5 ? 'III sammas ' + eur(avg(ph, 'i3')) : '',
      avg(ph, 'dep') > 0.5 ? 'hoiuselt ' + eur(avg(ph, 'dep')) : '',
    ].filter(Boolean);
    // Miks etapp muutus (võrreldes eelmisega).
    const why = (prev, ph) => {
      const had = (p, f) => avg(p, f) > 0.5;
      const out = [];
      if (!had(prev, 'i1') && had(ph, 'i1')) out.push('algab riiklik pension');
      if (had(prev, 'i2') && !had(ph, 'i2')) out.push(had(ph, 'dep') ? 'lõpevad II samba väljamaksed' : 'saab II samba raha otsa');
      if (had(prev, 'i3') && !had(ph, 'i3')) out.push('saab III samba raha otsa');
      if (!had(prev, 'dep') && had(ph, 'dep')) out.push('hakkad kasutama hoiusele kogunenud raha');
      if (had(prev, 'dep') && !had(ph, 'dep')) out.push('saab hoiuse raha otsa');
      if (!had(prev, 'i2') && had(ph, 'i2')) out.push('hakkad kasutama II samba raha');
      if (!had(prev, 'i3') && had(ph, 'i3')) out.push('hakkad kasutama III samba raha');
      if (avg(prev, 'shortfall') < 0.5 && avg(ph, 'shortfall') > 0.5) out.push('hakkab raha puudu jääma');
      return out.length ? ph.from + '-aastaselt ' + out.join(' ja ') + '. ' : '';
    };
    const lead = r.coversNeedUntil === null
      ? 'Lühidalt: sinu kulud on ' + eur(need) + ' kuus ja raha jätkub kogu elu, kuni 100. eluaastani.'
      : r.coversNeedUntil <= pa
        ? 'Lühidalt: sinu kulud on ' + eur(need) + ' kuus ja raha jääb puudu juba pensioni alguses.'
        : 'Lühidalt: sinu kulud on ' + eur(need) + ' kuus. Raha jätkub ' + ageOf(r.coversNeedUntil - 1).replace('-aastaselt', '. eluaastani') + ', siis jääb puudu.';
    const items = phases.map((ph, n) => {
      const ages = ph.from === ph.to ? ph.from + ' a' : ph.from + '–' + ph.to + ' a';
      const src = parts(ph);
      const short = avg(ph, 'shortfall');
      const endAlive = alive(ph.to);
      return '<li>' + (n ? why(phases[n - 1], ph) : '') + '<strong>' + ages + ':</strong> ' +
        (src.length ? 'sissetulek kuus on ' + src.join(', ') + '. ' : 'sissetulekut ei ole. ') +
        (short > 0.5 ? 'Puudu jääb keskmiselt ' + eur(short) + ' kuus.' : 'Kõik kulud on kaetud.') +
        // Kui väljamakse on suurem kui vaja, läheb ülejääk hoiusele (seda kasutatakse hiljem).
        (surplus(ph) > 0.5 ? ' Üle jääb keskmiselt ' + eur(surplus(ph)) + ' kuus, see läheb hoiusele.' : '') +
        (endAlive !== null && ph.to < 100 ? ' ' + ageOf(ph.to).replace('-aastaselt', '-aastaseks') + ' elab umbes ' + endAlive + '% sinuvanustest.' : '') + '</li>';
    });
    const kind = mobile ? 'Kihid' : 'Tulbad';
    const look = '<ul class="mb-0">' +
      '<li>' + kind + ' näitavad iga vanuse kohta, millest kulud kaetakse: ' +
        [rows.some((x) => x.i1 > 0.5) ? 'tumesinine on riiklik pension' : '', rows.some((x) => x.i2 > 0.5) ? 'sinine II sammas' : '', rows.some((x) => x.i3 > 0.5) ? 'täpiline III sammas' : '', rows.some((x) => x.dep > 0.5) ? 'triibuline hoiuselt' : ''].filter(Boolean).join(', ') + '.</li>' +
      '<li>Punane katkendjoon on sinu kulud kuus. Kui ' + kind.toLowerCase() + ' jäävad joonest allapoole, on raha puudu.</li>' +
      '<li>Hall joon näitab, mitu protsenti sinuvanustest on veel elus' + (mobile ? ' (täpse protsendi näed graafikut puudutades).' : ' (parem telg).') + '</li></ul>';
    return '<p class="mb-2">' + lead + '</p>' +
      '<p class="mb-1 fw-medium">Mis eri vanustes juhtub</p><ul class="mb-3">' + items.join('') + '</ul>' +
      '<p class="mb-1 fw-medium">Kuidas graafik välja näeb</p>' + look;
  }

  function renderChart(r, input) {
    const mobile = isMobile();
    $('chartExplain').innerHTML = chartExplain(r, input, mobile);
    // Mobiilis: kihiline pindgraafik pensioniea algusest (tulpade asemel), elus-% ilma eraldi teljeta.
    const rows = mobile ? r.rows.filter((x) => x.age >= r.pensionStartAge) : r.rows;
    $('chartSummary').innerHTML = chartSummary(r, input).map((s) => '<li>' + s + '</li>').join(''); // iga lause eraldi real
    $('chartTableWrap').innerHTML = chartTable(r, input);
    const font = { family: 'Roboto', size: 14 };
    // Mobiilis tulbad → kihid (sama värv ja muster), tühjad aastad ei teki rägastikuks.
    const area = (fill) => (mobile ? { type: 'line', fill: fill, pointRadius: 0, tension: 0, borderWidth: 1, stepped: false } : {});
    const data = {
      labels: rows.map((x) => x.age),
      datasets: [
        // Värvid samad. Lisaks: heledamatel tulpadel tumesinine äär (eristub valgest taustast), hoiusel triibud.
        Object.assign({ type: 'bar', label: 'I sammas', data: rows.map((x) => Math.round(x.i1)), backgroundColor: '#002f63', stack: 'income', yAxisID: 'y', order: 3 }, area('origin')),
        Object.assign({ type: 'bar', label: 'II sammas', data: rows.map((x) => Math.round(x.i2)), backgroundColor: '#00aeea', borderColor: '#002f63', borderWidth: 1, stack: 'income', yAxisID: 'y', order: 3 }, area('-1')),
        Object.assign({ type: 'bar', label: 'III sammas', data: rows.map((x) => Math.round(x.i3)), backgroundColor: dots('#006ce6', '#ffffff'), borderColor: '#002f63', borderWidth: 1, stack: 'income', yAxisID: 'y', order: 3 }, area('-1')),
        Object.assign({ type: 'bar', label: 'Hoiuselt (välja võetud raha)', data: rows.map((x) => Math.round(x.dep)), backgroundColor: stripes('#9fd8f0', '#002f63'), borderColor: '#002f63', borderWidth: 1, stack: 'income', yAxisID: 'y', order: 3 }, area('-1')),
        // Joonte valge „halo“ (laiem valge joon all), et jooned paistaksid ka tumedate tulpade peal. Legendis ja vihjes ei näidata.
        { type: 'line', label: '_halo', data: rows.map(() => input.needMonthly), borderColor: '#fff', borderWidth: 6, pointRadius: 0, stack: 'needHalo', yAxisID: 'y', order: 2, halo: true },
        { type: 'line', label: '_halo', data: rows.map((x) => Math.round(x.alive * 100)), borderColor: '#fff', borderWidth: 6, pointRadius: 0, tension: 0.3, yAxisID: 'y1', order: 2, halo: true },
        { type: 'line', label: 'Kulud', data: rows.map(() => input.needMonthly), borderColor: '#db2200', borderDash: [6, 4], borderWidth: 2.5, pointRadius: 0, stack: 'need', yAxisID: 'y', order: 1 },
        { type: 'line', label: mobile ? 'Elus (%)' : 'Elus (%, paremal teljel)', data: rows.map((x) => Math.round(x.alive * 100)), borderColor: '#8a8d91', backgroundColor: '#fff', borderWidth: 2.5, order: 1, tension: 0.3, yAxisID: 'y1',
          pointRadius: rows.map((x) => (!mobile && x.age % 5 === 0 ? 3.5 : 0)), pointBorderWidth: 2, pointStyle: 'circle' },
      ],
    };
    const options = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        // Legendis: tulbad ruuduna, jooned joonena (kulud katkendjoonena), et legend vastaks graafikule.
        legend: { position: 'top', align: 'start', labels: { font: font, usePointStyle: true, boxWidth: 28, boxHeight: 14, padding: 14,
          sort: (a, b) => a.datasetIndex - b.datasetIndex, // legend andmete järjekorras (mitte joonistamise järjekorras)
          // Legendis ainult need sissetuleku allikad, mis graafikul päriselt on (nt hoius ainult siis, kui seda kasutatakse).
          generateLabels: (ch) => Chart.defaults.plugins.legend.labels.generateLabels(ch).filter((l) => {
            const ds = ch.data.datasets[l.datasetIndex];
            if (ds.halo) return false;
            return ds.stack !== 'income' || ds.data.some((v) => v > 0);
          }).map((l) => {
            const ds = ch.data.datasets[l.datasetIndex];
            if (ds.stack !== 'income') Object.assign(l, { pointStyle: 'line', strokeStyle: ds.borderColor, lineWidth: 3, lineDash: ds.borderDash || [] });
            else Object.assign(l, { pointStyle: 'rect' });
            return l;
          }) } },
        tooltip: { filter: (item) => !item.dataset.halo, callbacks: {
          title: (items) => items[0].label + '-aastaselt (' + rows[items[0].dataIndex].year + ')',
          label: (c) => c.dataset.label + ': ' + (c.dataset.yAxisID === 'y1' ? c.raw + '%' : eur(c.raw)),
        } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, title: { display: true, text: 'Vanus', font: font, color: '#293036' }, ticks: { font: font, color: '#293036', autoSkip: true, maxRotation: 0, maxTicksLimit: mobile ? 6 : undefined } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: '€ kuus', font: font, color: '#293036' }, ticks: { callback: (v) => v + ' €', font: font, color: '#293036' }, grid: { color: '#e0e6ec' } },
        y1: { display: !mobile, position: 'right', min: 0, max: 100, grid: { display: false }, title: { display: true, text: 'Elus (%)', font: font, color: '#293036' }, ticks: { callback: (v) => v + '%', font: font, color: '#293036' } },
      },
    };
    if (chart && chart.$mobile !== mobile) { chart.destroy(); chart = null; }
    if (chart) { chart.data = data; chart.options = options; chart.update(); }
    else { chart = new Chart($('chart'), { data: data, options: options, plugins: [LEGEND_GAP] }); chart.$mobile = mobile; }
  }

  function renderResult(input) {
    const scenario = scenarioFor(input);
    const defs = SCEN.map((s) => (s.id === 'C' ? Object.assign({}, s, { deferral: input.deferral || 2 }) : s)).concat([GROW]);
    const results = defs.map((s) => Object.assign(P.simulate(input, T, s), { sustainable: P.sustainableNeed(input, T, s) }));
    const mine = Object.assign(P.simulate(input, T, scenario), { sustainable: P.sustainableNeed(input, T, scenario) });
    $('answer').innerHTML = answerText(mine, input);
    renderMetrics(mine);
    renderChart(mine, input);
    renderLegacy(mine, input);
    renderMap(input, scenario);
    renderRecap(input, scenario);
    renderCompare(defs, results, scenario.id);
    renderWarn(mine, scenario, defs, results);
    svgify($('legacy'));
  }

  // Kui valitud plaan ei kanna elu lõpuni, ütle see otse välja ja paku parimat väljamakse viisi.
  function renderWarn(mine, scenario, defs, results) {
    const box = $('actionWarn');
    const short = mine.coversNeedUntil !== null && mine.coversNeedUntil <= mine.horizonAge;
    if (!short) { box.classList.add('d-none'); return; }
    let bi = 0;
    results.forEach((r, i) => { if (r.sustainable > results[bi].sustainable) bi = i; });
    const best = defs[bi], br = results[bi];
    let html = '<strong>Hoiatus: sinu valitud plaan ei kanna kulusid elu lõpuni</strong> (kaetud kuni ' + mine.coversNeedUntil + '. eluaastani). ';
    if (br.sustainable > mine.sustainable && best.id !== scenario.id) {
      // Ei muuda valikuid ise: ütleb, mida valida, ja viib sammu juurde, kus see valik tehakse.
      const how = howTo(best, readInput());
      html += '<br>Parem oleks <strong>' + best.name + '</strong>: see kannab elu lõpuni ' + eur(br.sustainable) + ' kuus (sinu valik ' + eur(mine.sustainable) + ').' +
        '<br>Selleks ' + how.text + ' <button type="button" class="btn btn-sm btn-primary ms-1" data-goto="' + how.step + '">' + how.btn +
        '<span class="visually-hidden">: vali ' + best.name + '</span></button>';
    } else {
      html += '<br>Ükski väljamakse viis ei kanna neid kulusid elu lõpuni: kõige rohkem kannab ' + eur(Math.max(br.sustainable, mine.sustainable)) + ' kuus. Vali väiksem kulupakett või muuda kulusid.' +
        ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="8">Muuda kulusid</button>';
    }
    box.innerHTML = html;
    box.classList.remove('d-none');
  }

  // Mida ja millises sammus valida, et jõuda antud väljamakse viisini.
  function howTo(s, input) {
    const pa = P.retirementYears(input);
    const at60 = { step: 5, btn: 'Muuda ' + (pa - 5) + '-aastaselt' };
    const atPa = { step: 6, btn: 'Muuda pensionieas' };
    const fundFirst = input.payout === 'lump'; // fondipensioni valik on siis 60 a sammus
    if (s.id === 'A') return Object.assign(at60, { text: 'vali ' + (pa - 5) + '-aastaselt II sambale „Kõik korraga“.' });
    if (s.id === 'E') return Object.assign(at60, { text: 'vali ' + (pa - 5) + '-aastaselt „Jätkan kasvatamist“ ja pensionieas „Kasvatan edasi“.' });
    if (s.id === 'C') return Object.assign(fundFirst ? at60 : atPa, { text: (fundFirst ? 'vali ' + (pa - 5) + '-aastaselt fondipension ja ' : 'vali pensionieas fondipension ja ') + 'lükka riiklik pension ' + s.deferral + ' aastat edasi.' });
    // B ja D: fondipension ilma edasilükkamiseta + leping pensionipõlves
    const contract = s.id === 'D' ? '„Uus leping igal aastal“' : '„Üks leping“';
    if (input.method === 'fund' && !input.deferral) return { step: 7, btn: 'Muuda pensionipõlves', text: 'vali pensionipõlves ' + contract + '.' };
    return Object.assign(fundFirst ? at60 : atPa, { text: 'vali fondipension, võta riiklik pension kohe ja pensionipõlves ' + contract + '.' });
  }

  // ---------- Navigeerimine ----------
  function renderPath(input) {
    $('path').innerHTML = chapters.map((c, i) => {
      if (skipped(i)) return '';
      const ages = stageAges(P.retirementYears(input))[i];
      const past = ages && ages[1] < input.currentAge;
      const now = ages && ages[0] <= input.currentAge && ages[1] >= input.currentAge;
      const cls = [i === step ? 'current' : '', visited.has(i) ? 'visited' : '', past ? 'past' : '', now ? 'now' : ''].join(' ');
      return '<li class="' + cls + '"><button type="button" data-goto="' + i + '"' + (i === step ? ' aria-current="step"' : '') + '>' +
        '<span class="path-dot" aria-hidden="true">' + c.dataset.icon + '</span>' +
        // Vaadatud olek ka ilma värvita (WCAG 1.4.1): linnuke ja ekraanilugejale tekst.
        (visited.has(i) && i !== step ? '<span class="path-check" aria-hidden="true">' + ico('check') + '</span>' : '') +
        '<span class="path-label">' + c.dataset.label + '</span>' +
        '<span class="visually-hidden">' + (i === step ? ', praegune samm' : visited.has(i) ? ', vaadatud' : ', vaatamata') + '</span>' +
        (now ? '<span class="path-now">täna</span>' : '') + '</button></li>';
    }).join('');
    // Edenemisriba: täidetud kuni aktiivse sammuni (kaasa arvatud).
    const shown = shownSteps(), pos = shown.indexOf(step);
    $('pathFill').style.width = ((pos + 1) / shown.length * 100) + '%';
  }

  // Liigu järgmisele/eelmisele näidatavale etapile (vahelejäetud etapid jäävad vahele).
  function move(dir) {
    const shown = shownSteps();
    const k = shown.indexOf(step) + dir;
    go(shown[Math.max(0, Math.min(shown.length - 1, k))]);
  }

  function go(n, focus) {
    step = Math.max(0, Math.min(LAST, n));
    const shown = shownSteps();
    if (skipped(step)) step = shown.find((i) => i > step);
    visited.add(step);
    chapters.forEach((c, i) => { c.hidden = i !== step; });
    const pos = shown.indexOf(step);
    $('backBtn').style.visibility = pos === 0 ? 'hidden' : 'visible';
    $('nextBtn').style.visibility = step === LAST ? 'hidden' : 'visible';
    $('nextBtn').textContent = step === shown[shown.length - 2] ? 'Näita tulemust →' : 'Edasi →';
    $('stepCount').textContent = 'Samm ' + (pos + 1) + ' / ' + shown.length;
    update();
    // Mobiilis võib rada olla laiem kui ekraan: keri aktiivne samm nähtavale.
    const cur = $('path').querySelector('[aria-current="step"]');
    if (cur) {
      const li = cur.parentElement, path = $('path');
      path.scrollTo({ left: li.offsetLeft - (path.clientWidth - li.offsetWidth) / 2, behavior: focus === false ? 'auto' : 'smooth' });
    }
    if (focus !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const h = chapters[step].querySelector('h2'); if (h) h.focus({ preventScroll: true });
    }
  }

  function update() {
    // Valikukaardid joonistatakse uuesti: hoia klaviatuuri fookus samal raadionupul.
    const a = document.activeElement;
    const keep = a && a.type === 'radio' && (a.name === 'pkg' || a.name === 'defer') ? a.name : null;
    const input = readInput();
    renderTexts(input);
    renderPackages(input);
    renderBreakdown(readInput());
    const fresh = readInput();
    renderPotBar(fresh);
    renderPath(fresh);
    if (step === LAST) { renderResult(fresh); if (chart) chart.resize(); }
    svgify(document);
    if (keep) { const el = document.querySelector('input[name="' + keep + '"]:checked'); if (el) el.focus(); }
  }

  // ---------- Pensioniiga ----------
  let paTouched = false;
  function syncPensionAge() {
    const rule = P.pensionAge(parseInt($('birthYear').value, 10) || 1980);
    if (!paTouched) $('pensionAgeYears').value = String(rule.years);
    $('paHint').textContent = 'Reegli järgi ' + rule.years + ' a';
  }
  $('pensionAgeYears').addEventListener('change', () => { paTouched = true; });
  $('birthYear').addEventListener('input', syncPensionAge);

  // ---------- Sündmused ----------
  ['fund18Fund', 'fundNew'].forEach((id) => {
    $(id).innerHTML = Object.entries(FUNDS).map(([k, f]) => '<option value="' + k + '">' + f.name + ' (' + pct(f.r) + ' a)</option>').join('');
  });
  $('fundCur').innerHTML = Object.entries(FUNDS).map(([k, f]) => '<option value="' + k + '">' + pct(f.r) + ' aastas</option>').join('');
  $('fund18Fund').value = 'index';
  $('fundCur').value = 'mix';
  $('fundNew').value = 'index';

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (b) go(parseInt(b.dataset.goto, 10));
  });
  $('resetPkg').addEventListener('click', () => { delete overrides[readInput().pkg.id]; breakdownKey = null; update(); });
  // ---------- Tulemuse allalaadimine: Markdown ja PDF (printimine) ----------
  const txt = (el) => (el ? el.innerText.replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim() : '');
  function mdTable(table) {
    if (!table) return '';
    const cell = (c) => { const d = document.createElement('div'); d.innerHTML = c.innerHTML.replace(/<br\s*\/?>/gi, ' (') + (/<br/i.test(c.innerHTML) ? ')' : ''); return d.textContent.replace(/\s+/g, ' ').trim().replace(/\|/g, '/'); };
    const rows = [...table.querySelectorAll('tr')].map((tr) => [...tr.children].map(cell));
    if (!rows.length) return '';
    const head = rows[0], body = rows.slice(1);
    return '| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n' + body.map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n';
  }
  function buildMarkdown() {
    const input = readInput();
    const pa = P.retirementYears(input);
    const today = new Date().toLocaleDateString('et-EE');
    const metrics = [...document.querySelectorAll('#metrics .metric')].map((m) => '- **' + txt(m.querySelector('.value')) + '** ' + txt(m.querySelector('.label')));
    const recap = [...document.querySelectorAll('#recap li')].map((li) => '- ' + txt(li.querySelector('.flex-grow-1')));
    const map = [...document.querySelectorAll('#decisionMap li')].map((li) => '### ' + txt(li.querySelector('.when')) + ': ' + txt(li.querySelector('.fw-medium')) + '\n\n' + txt(li.querySelector('.text-secondary')) +
      (li.querySelector('.map-choice') ? '\n\n' + txt(li.querySelector('.map-choice')) : ''));
    const costs = pkgLines(input.pkg, input.household).map((l) => '| ' + l[1] + ' | ' + eur(lineValue(input.pkg, l)) + ' |').join('\n');
    const warn = $('actionWarn').classList.contains('d-none') ? '' : '> ' + txt($('actionWarn')).replace(/Proovi seda$/, '').trim() + '\n\n';
    return [
      '# Tulevane Mina: minu pensionilugu', '', '_Koostatud ' + today + '. Prototüüp, mitte finants- ega maksunõu. Summad on tänastes eurodes._', '',
      '## Tulemus', '', txt($('answer')), '', warn + metrics.join('\n'), '',
      '## Graafiku kokkuvõte', '', [...$('chartSummary').querySelectorAll('li')].map((li) => '- ' + txt(li)).join('\n'), '',
      '## Sinu andmed', '',
      '- Sünniaasta: ' + input.birthYear + ', sugu: ' + (input.sex === 'N' ? 'naine' : 'mees') + ', pensioniiga: ' + pa + ' a',
      '- Riiklik pension: ' + eur(input.p1Monthly) + ' kuus',
      '- II sammas praegu: ' + eur(input.p2) + ', III sammas praegu: ' + eur(input.p3Base),
      '- Brutopalk: ' + eur(input.grossMonthly) + ' kuus, II samba makse ' + pct(input.p2Rate) + ', III sambasse ' + eur(input.p3Monthly) + ' kuus',
      '- Tootlus pärast inflatsiooni: ' + pct(input.realReturn) + ' aastas', '',
      '## Sinu valikud', '', recap.join('\n'), '',
      '## Kulud: ' + input.pkg.name + (input.edited ? ' (muudetud)' : '') + ', ' + eur(input.needMonthly) + ' kuus', '',
      'Pensionil elan: ' + (input.household === 'paar' ? 'paaris (summad ühe inimese kohta)' : 'üksi'), '',
      '| Kulu | Summa kuus |', '| --- | --- |', costs, '',
      '## Sissetulek ja kulud vanuse järgi', '', mdTable($('chartTableWrap').querySelector('table')),
      '## Sinu otsuste kaart', '', map.join('\n\n'), '',
      '## Väljamakse teed kõrvuti', '', mdTable($('compare')),
      '---', 'Tulevane Mina · Tuleva häkaton 2026 · reeglid: Pensionikeskus ja Sotsiaalkindlustusamet',
    ].join('\n') + '\n';
  }
  $('dlMd').insertAdjacentHTML('afterbegin', ico('download') + ' ');
  $('dlPdf').insertAdjacentHTML('afterbegin', ico('download') + ' ');
  $('dlMd').addEventListener('click', () => {
    const blob = new Blob([buildMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tulevane-mina-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('dlPdf').addEventListener('click', () => {
    // Prindivaates on avatud võrdlustabel ja otsuste kaart; PDF-i saab salvestada brauseri printimisaknast.
    document.querySelectorAll('[data-step="9"] details').forEach((d) => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
    window.print();
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('[data-step="9"] details').forEach((d) => { d.open = d.dataset.wasOpen === '1'; });
  });

  // Uude aknasse avanevad lingid: ikoon ja ekraanilugejale „(avaneb uues aknas)“ (WCAG G201).
  document.querySelectorAll('a[target="_blank"]').forEach((a) => {
    if (a.dataset.ext) return;
    a.dataset.ext = '1';
    a.classList.add('ext-link');
    a.insertAdjacentHTML('beforeend', ' ' + ico('external') + '<span class="visually-hidden"> (avaneb uues aknas)</span>');
  });

  // Graafik ↔ tabel
  $('chartToggle').addEventListener('click', () => {
    const show = $('chartToggle').getAttribute('aria-expanded') !== 'true';
    $('chartToggle').setAttribute('aria-expanded', String(show));
    $('chartToggle').textContent = show ? 'Näita graafikuna' : 'Näita tabelina';
    $('chartTableWrap').classList.toggle('d-none', !show);
    $('chartWrap').classList.toggle('d-none', show);
  });
  // „Ma ei ole liitunud“: III samba väljad pole kasutusel (keelatud, vihje selgitab).
  function syncP3Fields() {
    const none = $('p3Joined').value === 'none';
    // Pole liitunud: tänast summat pole (0), aga sissemakse ja avamise vanus on sisestatavad.
    $('p3').disabled = none;
    $('p3').closest('div').classList.toggle('is-off', none);
    if (none && $('p3').value !== '0') { $('p3').dataset.prev = $('p3').value; $('p3').value = 0; }
    if (!none && $('p3').dataset.prev) { $('p3').value = $('p3').dataset.prev; delete $('p3').dataset.prev; }
    $('p3OpenWrap').classList.toggle('d-none', !none);
    $('p3JoinedHint').textContent = none ? 'Kui plaanid III samba avada, sisesta sissemakse ja vanus, millal avad.' : 'Enne 2021 liitunul lisandub 55 a otsustuskoht.';
  }
  $('p3Joined').addEventListener('change', () => { syncP3Fields(); go(skipped(step) ? shownSteps().find((i) => i > step) : step, false); });
  syncP3Fields();
  window.matchMedia('(max-width: 575px)').addEventListener('change', () => { if (step === LAST) update(); });
  $('backBtn').addEventListener('click', () => move(-1));
  $('nextBtn').addEventListener('click', () => move(1));
  document.querySelectorAll('.chapter input, .chapter select').forEach((el) => {
    if (el.closest('#packages') || el.closest('#legacy') || el.closest('#deferChoices')) return;
    el.addEventListener('input', update);
    el.addEventListener('change', update);
    el.addEventListener('input', () => el.classList.remove('is-prefilled'));
  });

  // Fondivahetuse vanus: trükkimise ajal ei sega, väljast lahkudes viime lubatud vahemikku (18 kuni pensioniiga − 1).
  const p3OpenEl = $('p3OpenAge');
  p3OpenEl.value = String(P.CURRENT_YEAR - (parseInt($('birthYear').value, 10) || 1980) + 1);
  p3OpenEl.addEventListener('input', () => { p3OpenEl.value = p3OpenEl.value.replace(/\D/g, ''); });
  p3OpenEl.addEventListener('change', () => { p3OpenEl.value = String(readInput().p3OpenAge); update(); });
  const switchEl = $('switchAge');
  switchEl.value = String(Math.max(18, P.CURRENT_YEAR - (parseInt($('birthYear').value, 10) || 1980)));
  switchEl.addEventListener('input', () => { switchEl.value = switchEl.value.replace(/\D/g, ''); });
  switchEl.addEventListener('change', () => { switchEl.value = String(readInput().switchAge); update(); });

  syncPensionAge();
  // ---------- Algandmed maandumislehelt (?p=<profiil>) ----------
  // Profiilid on tüüpilised koguja profiilid (vt maandumisleht, profiilid.js); kõiki välju saab muuta.
  (function applyStartProfile() {
    const PROFILES = window.MINA_PROFILES || {};
    const id = new URLSearchParams(location.search).get('p');
    const pr = id && Object.prototype.hasOwnProperty.call(PROFILES, id) ? PROFILES[id] : null;
    if (!pr) return;
    Object.entries(pr).forEach(([field, v]) => { if (field === 'nimi') return; const el = $(field); if (!el) return; el.value = String(v); el.classList.add('is-prefilled'); });
    paTouched = true;
    syncPensionAge();
    p3OpenEl.value = String(readInput().p3OpenAge);
    switchEl.value = String(readInput().switchAge);
    syncP3Fields();
    update();
    try {
      const p0 = sessionStorage.getItem('mina_p0');
      if (!p0) sessionStorage.setItem('mina_p0', id);
      else if (p0 !== id) sessionStorage.setItem('mina_vahetusi', String((Number(sessionStorage.getItem('mina_vahetusi')) || 0) + 1));
      sessionStorage.setItem('mina_p', id);
      // ainult märge, et andmeid muudeti (väärtusi ei salvestata)
      document.addEventListener('input', (e) => { if (e.isTrusted && e.target.closest('main')) { try { sessionStorage.setItem('mina_muutis', '1'); } catch (_) {} } });
    } catch (_) {}
  })();

  (function tagasisideLink() {
    const q = new URLSearchParams(location.search), out = new URLSearchParams();
    if (q.get('p')) out.set('p', q.get('p'));
    if (q.get('k')) out.set('k', q.get('k'));
    const s = out.toString();
    if (s) { $('tagasisideLink').href = '/tagasiside/?' + s; $('tagasisideLink2').href = '/tagasiside/?' + s; }
  })();

  go(0, false);
})();
