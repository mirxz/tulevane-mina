// Tulevane Mina: Elukaar (prototüüp 3). Mootor: elukaar/pension.js. Valikud etappide kaupa.
(function () {
  'use strict';

  const P = window.Pension;
  const T = window.ELUTABEL;
  const K = window.KULUD;
  const $ = (id) => document.getElementById(id);
  const eur = (v) => Math.round(v).toLocaleString('et-EE').replace(/,/g, ' ') + ' €';
  const pct = (v) => Math.round(v * 100) + '%';
  // Täpne protsent eesti kujul (nt 0.1988 → 19,88%, −0.255 → −25,5%).
  const pctTxt = (v) => (v < 0 ? '−' : '') + (Math.abs(v) * 100).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + '%';
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
  // Hooldekodu omaosalus kuus [secondary]: keskmine kohatasu 1 603 € (ERR 11.2025), hoolduse osa (u 600 €) maksab omavalitsus,
  // inimesele jääb u 1 000 €. SKA 2023: kohatasu 1 252 €, inimese osa 638 € (Riigikogu seletuskiri). Ametlikku 2026 tabelit pole
  // (kontrollitud 16.10.2026): täpsem number SKA hooldekodu statistikast. Sama mis kalkulaatoris.
  const CARE_HOME = 1000;
  const PRICE = { tank: 80, mince: 10, trip: 1800, cafe: 12 }; // 50 l kütust, 1 kg veisehakkliha, kaks nädalat soojal maal (lend + majutus), kohvikulõuna

  // Kulutasemed: Statistikaameti andmed (data/kulud.js), samad tasemed ja nimed mis kalkulaatoris.
  // Kokkuhoidlik = tänaste pensionäride keskmine. Optimaalne ja mugav = sama, korrutatud IV / V tulukvintiili kulude suhtega.
  const PACKAGES = [
    { id: 'kokkuhoidlik', name: 'Kokkuhoidlik', emoji: '🥔', tagline: 'Nii palju kulutavad tänased pensionärid keskmiselt.' },
    { id: 'optimaalne', name: 'Optimaalne', emoji: '✈️', tagline: 'Nagu keskmisest jõukamad leibkonnad.' },
    { id: 'mugav', name: 'Mugav', emoji: '🛋️', tagline: 'Nagu jõukaim viiendik.',
      // „Või“: sama summa katab hiljem hooldekodu omaosaluse.
      alt: (total) => 'Kui vajad hooldust: sama raha (' + eur(total) + ' kuus) katab hooldekodu omaosaluse (keskmiselt u ' + eur(CARE_HOME) + ' kuus) ja lapsed ei pea juurde maksma.' },
  ];

  // Etappide vanusevahemikud (pensioniiga lisandub arvutuses).
  // sp: eripensioni algusvanus (samm 9), null = eripensioni pole.
  // ret: pensionile minek (soodustusega varem); II samba samm jääb tavalise pensioniea järgi (pa − 5).
  // ff: fondipensioni algus (66+ samm), kui pensionieas kasvatad edasi ja valisid hilisema alguse.
  function stageAges(pa, sp, ret, ff) {
    const r = ret === undefined ? pa : ret;
    return [null, [0, 18], [18, 18], [18, 55], [55, 55], [pa - 5, pa - 5], [r, r], ff ? [ff, ff] : [r + 1, 100], null, sp == null ? null : [sp, sp], null];
  }
  // Pensionile minek: tavaline pensioniiga miinus soodustus (1. vaade).
  const retAge = (input) => P.retirementYears(input) - (input.soodus || 0);
  // 66+ sammu vanus: varasem II või III samba fondipensioni algus (kui on valitud).
  const firstFund = (input) => Math.min(input.fundFrom || Infinity, input.fundFrom3 || Infinity) === Infinity ? undefined : Math.min(input.fundFrom || Infinity, input.fundFrom3 || Infinity);
  const SP_STEP = 9;
  // Teekonna järjekord: eripensioni samm on oma vanuse kohal (enne sama vanuse tavalist sammu), teised indeksi järgi.
  function stepOrder(i) {
    const input = lastInput || readInput();
    // Soodustusega pensionile enne II samba avanemist (nt 10 a varem): pensioni samm enne II samba sammu.
    if (i === 6) return retAge(input) < P.retirementYears(input) - 5 ? 4.6 : 6;
    if (i !== SP_STEP) return i;
    const pa = P.retirementYears(input);
    const sp = Math.min(input.spStartAge !== undefined ? input.spStartAge : pa, pa);
    return sp < 55 ? 3.5 : sp < pa - 5 ? 4.5 : sp < pa ? 5.5 : 5.9;
  }

  // Vanuse tekstid: „65 a“ ja „65-aastaselt“ (kuud on toetatud, aga lugu näitab täisaastaid).
  const ageTxt = (y, m) => y + ' a' + (m ? ' ' + m + ' k' : '');
  const ageAt = (y, m) => (m ? y + ' a ' + m + ' k vanuselt' : y + '-aastaselt');
  // Pensioniea reegel (pension.js). Alates 2027. a on see seotud elueaga, kehtestatud on 2027. ja 2028. a.
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
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    trending: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
    dice: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
    half: '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/>',
    hourglass: '<path d="M5 22h14M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
    cap: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84l-8.57-3.9a2 2 0 0 0-1.66 0l-8.57 3.9a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    // „?“ täpselt nagu tuleva.ee (.inline-help): tavaolekus valge ring sinise äärise ja küsimärgiga, hover/fookus täidetud.
  };
  const HELP_ICO = '<svg class="ico-help" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<circle class="h-ring" cx="8" cy="8" r="7.4" stroke-width="1.2"/><path class="h-q" d="m5.25497 5.786c-.00137.03229.00389.06453.01543.09472.01155.03019.02916.05769.05173.08083.02257.02313.04964.04141.07954.05369.02989.01229.06199.01833.0943.01776h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217c.00105.06561.02786.12817.07463.1742.04677.04602.10976.07181.17537.0718h.811c.06631 0 .1299-.02634.17678-.07322.04688-.04689.07322-.11048.07322-.17678v-.105c0-.718.273-.927 1.01-1.486.60903-.463 1.24403-.977 1.24403-2.056 0-1.511-1.27603-2.241-2.67303-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/></svg>';
  const SVG_REST = {
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  };
  Object.assign(SVG, SVG_REST);
  const EMOJI = { '🙂': 'user', '🧍': 'user', '👫': 'users', '👨‍👩‍👧': 'users', '🔓': 'lockOpen', '💼': 'briefcase', '🧳': 'briefcase',
    '🏖️': 'sun', '🌳': 'tree', '🛒': 'cart', '🏁': 'flag', '⚓': 'anchor', '🔄': 'refresh', '♻️': 'refresh', '🚫': 'ban', '🌱': 'sprout',
    '💰': 'coins', '💸': 'coins', '🗓️': 'calendar', '📜': 'file', '🥔': 'home', '🏡': 'home', '✈️': 'plane', '🛋️': 'sofa', '🥩': 'utensils', '⛽': 'fuel',
    '☕': 'coffee', '🏦': 'wallet', '🐷': 'wallet', '🏛️': 'landmark', '💝': 'heart', '🎒': 'bag',
    '🛡️': 'shield', '🎁': 'gift', '🌿': 'leaf', '📈': 'trending', '🧭': 'compass', '🎲': 'dice', '🧸': 'smile', '🌓': 'half', '⏳': 'hourglass', '👶': 'smile', '🎓': 'cap' };
  const ico = (name) => '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (SVG[name] || '') + '</svg>';
  // Asenda dekoratiivsed emojid SVG-ga (elemendid, mille ainus sisu on emoji).
  function svgify(root) {
    root.querySelectorAll('.choice-emoji, .opt-ico, .pot-emoji, .path-dot, .hh-emoji, .chapter-art, .recap li > span:first-child, .pkg-facts li > span:first-child, .pkg-alt > span:first-child').forEach((el) => {
      const k = el.textContent.trim();
      if (EMOJI[k]) el.innerHTML = ico(EMOJI[k]);
    });
  }

  // ---------- Olek ----------
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  const LAST = chapters.length - 1;
  // Minevikuetapid (0–18, 18) ja tööaastad jäävad eraldi etapina välja: kõik on esimeses vaates.
  const SKIP = new Set([1, 2]); // tööaastate küsimused on esimeses vaates
  // 55 a samm on loos ainult siis, kui III sambaga liitusid enne 2021 (siis avaneb soodusmaks 55-aastaselt).
  // 3. samm (II samba varane väljavõtt, KoPS § 43¹) on olemas, kui II sammas on ja pensioniea − 5 (tavaline väljamakse) on vähemalt aasta kaugusel.
  function p2EarlyOpen() {
    const by = Math.min(2008, Math.max(1930, parseInt($('birthYear').value, 10) || 1980));
    const pa = parseInt($('pensionAgeYears').value, 10) || 65;
    return ((parseFloat($('p2').value) || 0) > 0 || (parseFloat($('p2Rate').value) || 0) > 0) && P.CURRENT_YEAR - by <= pa - 6;
  }
  const p3EarlyTaken = () => !!(lastInput && lastInput.p3EarlyAge !== undefined);
  const skipped = (i) => SKIP.has(i) || (i === 3 && !p2EarlyOpen() && !(lastInput && lastInput.p3EarlyOk)) || (i === 4 && p3EarlyTaken()) || (i === 4 && $('p3Joined').value !== 'before') || (i === SP_STEP && $('spHas').value !== 'yes');
  const shownSteps = () => chapters.map((c, i) => i).filter((i) => !skipped(i)).sort((a, b) => stepOrder(a) - stepOrder(b));
  // Mõõtmise sammunumbrid (src/moot.js SAMMUD) jäävad samaks: tulemus on 9, eripensioni samm (9 DOM-is) ei lähe mõõtmisse.
  const mootSamm = (s) => (s === SP_STEP ? null : s === LAST ? 9 : s);
  // Eripension algas minevikus (algusvanus < praegune vanus): eripensioni sammu valikud on tehtud ja lukus.
  function spPast() {
    const by = Math.min(2008, Math.max(1930, parseInt($('birthYear').value, 10) || 1980));
    return $('spHas').value === 'yes' && $('spStartAge').value !== '' && parseInt($('spStartAge').value, 10) < P.CURRENT_YEAR - by;
  }
  let lastInput = null; // viimane readInput (eripensioni sammu koht teekonnal)
  let step = 0;
  let lastTracked = -1;
  let visited = new Set([0]);
  let legacyChoice = null;
  let chart = null;

  function readInput() {
    const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
    const birthYear = Math.min(2008, Math.max(1930, parseInt($('birthYear').value, 10) || 1980));
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
    const pa = P.retirementYears({ birthYear: birthYear, pensionAgeYears: pensionAgeValue() });
    const switchAge = Math.min(pa - 1, Math.max(currentAge, parseInt($('switchAge').value, 10) || currentAge));
    const sex = $('sex').value;
    const rateAt = (a) => (switching && a >= switchAge ? FUNDS[fundNow].r : FUNDS[fund18].r);
    const rFinal = FUNDS[fundNow].r;
    // III sambal oma fond ja tootlus (mootoris eraldi pott p3Sep, realReturn3).
    const fund3 = $('fund3Cur').value, r3 = FUNDS[fund3].r;

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
    // Täiendav fondipension: maksuvaba alates soodusest, uus leping igal aastal (elada jäänud aastad Statistikaameti järgi).
    // Olemasolev sammas: enne 2021 liitunul eeldame, et 5 aastat on täis. Hiljem liitunul vähemalt 2021 + 5 aastat.
    const p3Open = p3Kind === 'have'
      ? (p3Before2021 ? 55 : Math.max(60, 2026 - birthYear))
      : Math.max(p3Before2021 ? 55 : 60, p3OpenAge + 5);
    // III samba varane väljavõtt (3. samm): enne soodusvanust 22% tulumaksuga, kogu sammas korraga. Siis 55 a sammu ei ole.
    const p3EarlyMax = Math.min(p3Open, pa) - 1;
    const p3EarlyOk = p3Kind === 'have' && p3Base > 0 && currentAge <= p3EarlyMax;
    const p3EarlyAge = p3EarlyOk && radio('p3Early') === 'yes' && parseInt($('p3EarlyAge').value, 10) > 0 ? Math.min(p3EarlyMax, Math.max(currentAge, parseInt($('p3EarlyAge').value, 10))) : undefined;
    const p3Age = p3EarlyAge !== undefined ? p3EarlyAge : Math.max(55, currentAge);
    const p3Allowed = p3Has && p3Age < pa && p3OpenAge < p3Age;
    // Täiendav fondipension on võimalik alles soodusvanusest (enne 2021 liitunul 55, hiljem 60). Varem ainult korraga (22%).
    const p3FundOk = p3Age >= p3Open;
    let p3Plan = p3EarlyAge !== undefined ? 'lump' : p3Allowed && $('p3Joined').value === 'before' ? (radio('p3plan') || 'keep') : 'keep';
    if (p3Plan === 'fund' && !p3FundOk) p3Plan = 'keep';
    const p3Use = 'spend'; // väljavõetud III samba raha kasutatakse kohe (pensioniks ei jää)
    // Arvutuse plaan: 55-aastase sammu valik või, kui seal jätsid kasvama, pensioniea − 5 sammu valik (fondipension või
    // korraga), mis algab selle sammu vanusest, mitte pensionieas. Fondipension alles soodusvanusest (p3Open).
    let calcPlan = p3Plan, calcAge = p3Age;
    const p3At5 = radio('p3pa');
    if (p3Plan === 'keep' && p3Has && (p3At5 === 'fund' || p3At5 === 'lump')) {
      const a5 = Math.max(pa - 5, currentAge);
      if (a5 < pa && p3OpenAge < a5 && (p3At5 === 'lump' || a5 >= p3Open)) { calcPlan = p3At5; calcAge = a5; }
    }

    // simulate lisab III samba sissemakse igal aastal ühisesse rahasse. Eemaldame selle aastatel, kui sammas pole avatud
    // või kui sissemakse läheb väljavõetavale III samba saldole (samaväärne tänane summa, sest mudel on lineaarne).
    // Jooksval aastal sissemaksed ainult ülejäänud kuude eest (sama mis mootoris firstYearShare).
    // III samba makse on nominaalselt sama (mootoris p3Indexed: false), tänastes eurodes kahaneb: sama tegur mis mootoris.
    const c3At = (a) => (a === currentAge ? c3 * (12 - new Date().getMonth()) / 12 : c3) * P.p3Factor({ p3Indexed: false, inflation: P.INFLATION, birthYear: birthYear }, a);
    let c3Adj = 0;
    for (let a = currentAge; a < pa; a++) {
      // 'fund': sissemaksed kuni pensionini lähevad 55-aastasse fondipensioni potti (vt allpool), mitte pensionieas uude lepingusse.
      if (a < p3OpenAge || (calcPlan === 'fund' && a < pa) || (calcPlan === 'lump' && a < calcAge)) c3Adj -= c3At(a) / Math.pow(1 + r3, a - currentAge + 1);
    }
    let p3Gross = 0, p3Net = 0, p3Rem = 0, p3Tax = 0;
    const p3Early = {};
    if (calcPlan !== 'keep') {
      let b = p3Base;
      for (let a = currentAge; a < calcAge; a++) b = b * (1 + r3) + (a >= p3OpenAge ? c3At(a) : 0);
      if (calcPlan === 'lump') {
        p3Tax = calcAge >= p3Open ? 0.10 : 0.22;
        p3Gross = b; p3Net = b * (1 - p3Tax);
      } else {
        // Üks leping: periood III samba väljamakse algusest, osakute arv jagatud veel tegemata väljamaksetega (KoPS § 60¹ lg 5), seega makse järgib fondi väärtust; muidu uus leping igal aastal.
        const once3 = radio('contract3') === 'once', term3 = P.fundPensionTerm(T, sex, calcAge);
        for (let a = calcAge; a < pa; a++) {
          const left3 = term3 - (a - calcAge);
          const pay = once3 ? (left3 > 0 ? b / left3 : 0) : b / P.fundPensionTerm(T, sex, a);
          b -= pay; p3Gross += pay; p3Net += pay * (a >= p3Open ? 1 : 0.78);
          p3Early[a] = (pay * (a >= p3Open ? 1 : 0.78)) / 12; // enne pensioniiga makstav III samba fondipension kuus (graafikule)
          b = b * (1 + r3) + (a >= p3OpenAge ? c3At(a) : 0); // sissemakse läheb samasse lepingupotti
        }
        p3Rem = b; // pensionieas läheb ülejääk ühisesse samba rahasse
      }
    }
    const pot0 = num('p2') + (calcPlan === 'keep' ? p3Base : 0) + childNow;
    let switchAdj = 0;
    if (switching && switchAge > currentAge) {
      const c = P.yearlyContribution({ grossMonthly: num('grossMonthly'), p2Rate: parseFloat($('p2Rate').value), p3Monthly: p3Monthly });
      const ro = FUNDS[fund18].r, rn = FUNDS[fundNow].r, n = switchAge - currentAge;
      let fOld = pot0, cNew = 0;
      for (let i = 0; i < n; i++) { fOld = fOld * (1 + ro) + c; cNew = cNew * (1 + rn) + c; }
      switchAdj = (fOld - cNew) / Math.pow(1 + rn, n) - pot0;
    }

    // III samba ülejääk pensionieas → samaväärne tänane summa (simulate kasvatab kõike lõpptootlusega).
    const p3RemNow = p3Rem / Math.pow(1 + r3, Math.max(0, pa - currentAge));

    const pkg = PACKAGES.find((p) => p.id === radio('pkg')) || PACKAGES[0];
    const household = $('household').value;
    const pkgTotal = packageTotal(pkg, household);

    // II samba varane väljavõtt (3. samm): ainult siis, kui samm on rajal ja valisid „Võtan korraga välja“.
    const p2Early = p2EarlyOpen() && radio('p2Early') === 'yes' && parseInt($('p2EarlyAge').value, 10) > 0 ? { age: Math.min((parseInt($('pensionAgeYears').value, 10) || 65) - 6, Math.max(currentAge, parseInt($('p2EarlyAge').value, 10))), rejoin: radio('p2EarlyRejoin') === 'yes', save: radio('p2EarlyUse') === 'save' } : undefined;
    // II võeti varem välja ja uuesti ei liitu: II sammast enam pole, 60 a ja pensioniea II valikuid ei küsita.
    const p2Gone = !!(p2Early && !p2Early.rejoin);
    return withP3({
      birthYear: birthYear,
      currentAge: currentAge,
      sex: sex,
      household: household,
      p1Monthly: num('p1Monthly'),
      p2: num('p2'),
      p3Base: p3Base,
      p3: (calcPlan === 'keep' ? p3Base : 0) + childNow + switchAdj + p3RemNow + c3Adj,
      p3RemNow: p3RemNow, c3Adj: c3Adj,
      p3Pre: (calcPlan === 'keep' ? p3Base : 0) + childNow + p3RemNow + c3Adj,
      p3Before2021: p3Before2021,
      p2Has: (num('p2') > 0 || parseFloat($('p2Rate').value) > 0) && !p2Gone, // II sammas on, kui summa või sissemakse > 0 ja seda pole varem välja võetud
      p2Gone: p2Gone, p2Early: p2Early,
      p3Has: p3Has, p3Kind: p3Kind, p3OpenAge: p3OpenAge, p3Allowed: p3Allowed,
      p3EarlyOk: p3EarlyOk, p3EarlyMax: p3EarlyMax, p3EarlyAge: p3EarlyAge,
      p3Open: p3Open, p3Age: p3Age, p3Plan: p3Plan, p3Use: p3Use, p3CalcPlan: calcPlan, p3CalcAge: calcAge,
      p3Gross: p3Gross, p3Net: p3Net, p3Tax: p3Tax, p3Rem: p3Rem, p3Early: p3Early,
      extraDeposit: p3Plan !== 'keep' && p3Use === 'save' ? p3Net : 0,
      pensionAgeYears: parseInt($('pensionAgeYears').value, 10), // tavaline pensioniiga; soodustus (soodus) muudab ainult pensionile minekut
      // Pensioni ajal (ka soodustusega): töötad edasi (kuni workUntil) või mitte; ilma tööta III samba sissemakse (p3After).
      soodusWork: soodusNow() > 0 && radio('soodusWork') === 'yes',
      workOn: radio('soodusWork') === 'yes',
      workUntil: radio('soodusWork') === 'yes' && $('workUntil').value ? parseInt($('workUntil').value, 10) : undefined,
      p3After: soodusNow() > 0 && radio('soodusWork') !== 'yes' && radio('p3AfterMode') === 'change' && $('p3After').value !== '' ? num('p3After') : undefined,
      spHas: $('spHas').value === 'yes',
      // Pensionieas (või soodustusega varem): eripension või vanaduspension; vaikimisi suurem (pension.js).
      firstPillarChoice: $('spHas').value === 'yes' ? radio('fpChoice') : undefined,
      // Teine valik tavalises pensionieas (kui varem jätkasid eripensioniga); kaardid on pensionipõlve sammus.
      firstPillarChoicePa: $('spHas').value === 'yes' && !$('fpChoicePaWrap').classList.contains('d-none') ? radio('fpChoicePa') : undefined, // 1. vaade: eripension jah/ei; summa küsitakse eripensioni sammus
      spMonthly: $('spHas').value === 'yes' ? num('spMonthly') : 0, // eripension (kuus, enne maksu); 0 = puudub
      // Eripensionile jäämise vanus (TLV-69); tühi = pensioniiga.
      spStartAge: $('spHas').value === 'yes' && $('spStartAge').value !== '' ? Math.min(70, Math.max(35, parseInt($('spStartAge').value, 10) || 0)) : undefined,
      // Eripensioni ajal töötad edasi muul kutsealal? Kui eripension algas minevikus, on valik tehtud:
      // edasi kehtib praegune olukord (brutopalk 1. vaates; 0 = ei tööta), mineviku sissemaksed on II samba summas.
      spWork: spPast() ? num('grossMonthly') > 0 : radio('spWork') !== 'no',
      // Uus palk eripensioni ajal (ainult siis, kui töötad ja palk muutub; tühi = sama palk).
      spGross: $('spHas').value === 'yes' && !spPast() && radio('spWork') !== 'no' && radio('spPay') === 'change' && $('spGross').value !== '' ? num('spGross') : undefined,
      kids: kidsInput(), // lapsed sünniaja järgi, puue, kes kasutab, kas prognoos sisaldab pensionilisa
      hazard: $('hazard').value, // tervist kahjustav töö (SVPS): 'list1' 10 a, 'list2' 5 a varem
      // SVPS § 3 lisa (TLV-88): nimekirja nr 1 tööaastad ja neist allmaatöö aastad.
      // Nimekirja tööaastad: nr 1 annab lisa (hazardSupplement) ja mõlemal on varem mineku tingimus (earlyYears).
      hazardYears: $('hazard').value !== 'no' ? Math.max(0, Math.min(50, parseFloat($('hazardYears').value) || 0)) : 0,
      civilYears: 0, // ATS § 113: suurendus on SKA prognoosis (juhend), Elukaar seda ei lisa
      rescueYears: $('cRescue').checked ? Math.max(0, Math.min(50, parseInt($('rescueYears').value, 10) || 0)) : 0, // päästeteenistuse staaž (PäästeTS)
      undergroundYears: $('hazard').value === 'list1' ? Math.max(0, Math.min(50, parseInt($('undergroundYears').value, 10) || 0)) : 0,
      rescueBasis: rescueBasisNow(), // päästja ootetoetus või laste eest pension (TLV-105; pension.js rescueUntil)
      soodus: soodusNow(), // mitu aastat varem pensionile (soodustuse piires vähendamata, üle selle paindlik pension)
      flexEarly: soodusNow() > soodusMax() ? soodusNow() : 0, // paindlik pension varem: vähendus eluks ajaks (pension.js EARLY_DECREASE)
      paMonths: 0, // vanused näidatakse täisaastates (65 a), kuid ei kasutata
      grossMonthly: num('grossMonthly'),
      // Tuleva kalkulaatori eeldused (TLV-86): palk +3% aastas, inflatsioon 2%, III samba makse nominaalselt sama (piir 6000 €).
      wageGrowth: P.WAGE_GROWTH, inflation: P.INFLATION, p3Indexed: false,
      firstYearShare: (12 - new Date().getMonth()) / 12, // jooksva aasta sissemaksed ainult ülejäänud kuude eest (k.a jooksev kuu)
      p2Rate: parseFloat($('p2Rate').value),
      p3Monthly: p3Monthly,
      fund18: fund18,
      fundNow: fundNow,
      switching: switching, switchAge: switchAge, switchAdj: switchAdj,
      realReturn: FUNDS[fundNow].r,
      fund3: fund3, realReturn3: r3,
      child: child, childMonthly: childMonthly, child18: child18, childNow: childNow,
      payout: p2Gone ? 'grow' : radio('payout'),
      // Tegelik väljamakse viis: kui 60-aastaselt jätkad kasvatamist, otsustad pensionieas.
      method: p2Gone ? 'grow' : radio('payout') === 'grow' ? (radio('payoutPa') || 'grow') : radio('payout'),
      // III samba valik pensionieas (kui 55-aastaselt ei võetud välja).
      p3pa: radio('p3pa') === 'grow' ? (radio('p3paPa') || 'grow') : (radio('p3pa') || 'grow'),
      p3At60: radio('p3pa') || 'grow',
      // Eripensionile paindliku pensioni reeglid ei kehti (pension.js options): edasilükkamine on siis 0.
      deferral: $('spHas').value === 'yes' || radio('p1Mode') === 'half' ? 0 : parseInt(radio('defer') || '0', 10),
      // Pool riiklikku pensioni N aastat (paindlik pension); eripensioni ja soodustusega lukus (pension.js options).
      half: $('spHas').value !== 'yes' && radio('p1Mode') === 'half' ? parseInt(radio('defer') || '0', 10) : 0,
      contract: radio('contract'),
      // „Kasvatan edasi“ pensionieas: fondipensioni algus (61+ samm); tühi = kasvatan edasi.
      fundFrom: $('fundFrom').value ? parseInt($('fundFrom').value, 10) : undefined, // II samba fondipensioni algus
      fundFrom3: $('fundFrom3').value ? parseInt($('fundFrom3').value, 10) : undefined, // III samba oma (eraldi leping)
      contract3: radio('contract3'), // III samba fondipension on eraldi leping (Pensionikeskus: täiendav fondipension)
      pkg: pkg,
      pkgTotal: pkgTotal,
      edited: isEdited(pkg),
      needMonthly: customTotal(pkg, household),
    });
  }

  // Lisastsenaarium: raha jääb fondi, lepingut ega ühekordset väljamakset pole. pension.js katab siis vajaduse
  // lisaväljamaksetega sambast (10% tulumaks) ja ülejäänu kasvab edasi.
  const GROW = { id: 'E', name: 'Jätkan kasvatamist', short: 'Raha jääb fondi kasvama, vajadusel võtad osa välja (10% tulumaks).' };

  // Stsenaariumid failist pension.js. C nimi loo jaoks: ametlik termin on paindlik pension.
  const SCEN = P.SCENARIOS.map((s) => (s.id === 'C'
    ? Object.assign({}, s, { name: 'Paindlik pension', short: 'Riikliku pensioni lükkad edasi ja seni kasutad II ja III sammast fondipensionina.' })
    : s));

  // III sammas on alati eraldi pott (pension.js p3Sep): oma sissemaksed, oma väljamakse viis, graafikul eraldi.
  // Kui III sammas jäi 55-aastaselt kasvama, kehtib selle pensionieas valik (p3pa). Kui see võeti 55-aastaselt
  // fondipensionina, jätkub ülejäägi fondipension; kui korraga välja, kasvavad hilisemad sissemaksed edasi.
  function withP3(input) {
    if (!input.p3Has) return Object.assign(input, { p3Sep: null });
    const keep = input.p3CalcPlan === 'keep';
    const amount = (keep ? input.p3Base : input.p3RemNow) + input.c3Adj; // c3Adj: tegemata sissemaksed (nt avad hiljem)
    const mode = keep ? input.p3pa : input.p3CalcPlan === 'fund' ? 'fund' : 'grow';
    // III samba fondipensioni leping on II sambast eraldi; 55-aastaselt alanud leping jätkub sealt.
    const sep = { amount: amount, mode: mode, contract: input.contract3 };
    if (input.p3CalcPlan === 'fund') sep.start = input.p3CalcAge;
    // Kasvab edasi, aga 61+ sammus valitud fondipensioni algus: leping alates sellest vanusest.
    if (mode === 'grow' && input.fundFrom3) { sep.mode = 'fund'; sep.start = input.fundFrom3; }
    return Object.assign(input, { p3: input.p3 - amount, p3Pre: input.p3Pre - amount, p3Sep: sep });
  }

  // Valikud → üks stsenaarium failist pension.js.
  function scenarioFor(input) {
    const S = (id) => SCEN.find((s) => s.id === id);
    const d = { deferral: input.deferral, half: input.half };
    if (input.method === 'lump') return Object.assign({}, S('A'), d);
    if (input.method === 'grow' && input.fundFrom) return Object.assign({}, S(input.contract === 'yearly' ? 'D' : 'B'), d, { fundFrom: input.fundFrom });
    if (input.method === 'grow') return Object.assign({}, GROW, d);
    // Paindlik pension (C): vaikimisi uus leping igal aastal (nagu võrdlustabelis); „Üks leping“ ainult siis, kui kasutaja selle ise valis.
    if (input.deferral > 0) return Object.assign({}, S('C'), d, { contract: contractTouched ? input.contract : 'yearly' });
    return input.contract === 'yearly' ? S('D') : S('B');
  }

  // Samba vara pensionieas (sama kasvureegel mis simulate'is).
  // fromToday: „mis oleks, kui alates tänasest selles fondis“ (fondivahetuse korrektsioonita).
  function potAtPension(input, r, fromToday) {
    const pa = P.retirementYears(input) - (input.soodus || 0); // kogumine kestab pensionile minekuni
    // II sammas eraldi, et varane väljavõtt (input.p2Early) selle nulliks saaks; III kasvab oma tootlusega (input.realReturn3).
    const pe = input.p2Early && input.p2Early.age >= input.currentAge && input.p2Early.age < P.retirementYears(input) - 5 ? input.p2Early : null;
    const r3 = input.p3Sep && input.realReturn3 !== undefined ? input.realReturn3 : r;
    let f2 = input.p2, rest = fromToday ? input.p3Pre : input.p3, f3 = input.p3Sep && !fromToday ? input.p3Sep.amount : 0;
    for (let a = input.currentAge; a < pa; a++) {
      if (pe && a === pe.age) f2 = 0;
      const stop = pe && a >= pe.age && !(pe.rejoin && a >= pe.age + 5);
      const p3part = (input.p3Monthly || 0) * 12 * P.p3Factor(input, a);
      f2 = f2 * (1 + r) + (stop ? 0 : P.yearlyContribution(input, a) - p3part);
      rest = rest * (1 + r); f3 = f3 * (1 + r3) + p3part;
    }
    return f2 + rest + f3;
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
    $('packages').innerHTML = '<p class="pkg-legend small-muted mb-0" aria-hidden="true"><span class="lg-item"><span class="dot base"></span>pensionäride keskmine</span><span class="lg-item"><span class="dot joy"></span>jõukamate leibkondade lisakulu</span><span class="lg-item"><span class="dot rest"></span>kalleima tasemeni</span></p>' +
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
    $('pkgSource').innerHTML = '<span class="src-chip stat ms-0">Statistikaamet</span> ' + K.tasemed[input.pkg.id] + ', ' + K.leibkonnad[input.household].toLowerCase() + '. Leibkonna eelarve uuring ' + K.uuringuaasta + ' (viimane avaldatud), summad on viidud tänastesse hindadesse (' + K.hinnad + '): hinnad on tõusnud keskmiselt ' + Math.round((K.kordaja_kokku - 1) * 100) + '%, iga kulu oma hinnaindeksiga.' +
      (input.pkg.id === 'kokkuhoidlik' ? '' : ' Kvintiili suhe on kõigi leibkondade andmetest, sest pensionäride kohta tulukvintiilide kaupa avalikke andmeid pole.') +
      ' Kingitused, annetused jm on Statistikaameti „muud kulutused“: raha kinkimine, annetused, alimendid ja ülalpidamisraha, trahvid.';
  }

  // ---------- Etappide tekstid ----------
  // 3. sammu viimane vanus: II sammas kuni pensioniea − 6, III sammas kuni soodusvanuse − 1.
  function earlyEnd(input) {
    return Math.max(input.currentAge, p2EarlyOpen() ? P.retirementYears(input) - 6 : 0, input.p3EarlyOk ? input.p3EarlyMax : 0);
  }
  function kicker(input, idx) {
    const ages = stageAges(P.retirementYears(input), input.spHas ? P.specialStart(input) : null, retAge(input), firstFund(input))[idx];
    if (!ages) return '';
    let [a, b] = ages;
    if (idx === 3) { a = input.currentAge; b = earlyEnd(input); } // samba varane väljavõtt: tänasest kuni viimase võimaliku vanuseni
    const tense = b < input.currentAge ? 'Sinu minevik' : a > input.currentAge ? 'Sinu tulevik' : 'Sinu praegune elu';
    const years = a === b ? String(input.birthYear + a) : (input.birthYear + a) + '–' + (b >= 100 ? '…' : input.birthYear + b);
    const label = a === b ? a + '-aastane' : b >= 100 ? a + '+ a' : a + '–' + b + ' a';
    return label + ' · ' + years + ' · ' + tense;
  }

  function renderTexts(input) {
    const pa = P.retirementYears(input);
    for (let i = 1; i <= 7; i++) { const k = $('k' + i); if (k) k.textContent = kicker(input, i); }
    const lastEarly = earlyEnd(input);
    chapters[3].dataset.label = input.currentAge === lastEarly ? input.currentAge + ' a' : input.currentAge + '–' + lastEarly;
    // 3. samm: II samba varane väljavõtt (KoPS § 43¹). Vanuse valik tänasest kuni pensioniea − 6; valik jääb alles, kui mahub.
    {
      // Vanuse sisestab inimene ise; abitekst ütleb vahemiku ja mis tuleb järgmisena.
      const last2 = P.retirementYears(input) - 6;
      $('p2EarlyAgeHint').textContent = 'Vanus ' + input.currentAge + '–' + last2 + '.';
      $('p2EarlyPart').classList.toggle('d-none', !p2EarlyOpen());
      // Sissejuhatus ütleb, mõlema samba valik on samas sammus (III osa jääb muidu II lisaküsimuste alla märkamata).
      const both = p2EarlyOpen() && input.p3EarlyOk;
      $('earlyIntro').textContent = both ? 'Siin on kaks valikut: II sammas ja allpool III sammas. Enamasti tasub mõlemad kasvama jätta.'
        : input.p3EarlyOk ? 'III samba raha saad välja võtta igal ajal, enne soodusvanust 22% tulumaksuga.' : 'II samba raha saad enne pensioniiga välja võtta ainult ühe korra.';
      $('p3EarlyPart').classList.toggle('d-none', !input.p3EarlyOk);
      if (input.p3EarlyOk) {
        $('p3EarlyAgeHint').textContent = 'Vanus ' + input.currentAge + '–' + input.p3EarlyMax + '.';
        $('p3EarlyMore').classList.toggle('d-none', radio('p3Early') !== 'yes');
        $('p3EarlyTxt').textContent = 'Kogu III sammas korraga, 22% tulumaksuga. Soodusmaks (10%) algab alles ' + input.p3Open + '-aastaselt.';
        $('p3EarlyNote').classList.toggle('d-none', input.p3EarlyAge === undefined);
        $('p3EarlyNote').innerHTML = input.p3EarlyAge !== undefined ? '<strong>' + input.p3EarlyAge + '-aastaselt</strong> on III sambas u ' + eur(input.p3Gross) + ', tulumaksu läheb ' + eur(input.p3Gross - input.p3Net) + ' ja kätte saad <strong>' + eur(input.p3Net) + '</strong>. Pensioniks sellest raha ei jää.' +
          (input.p3Monthly > 0 ? ' Kui maksad III sambasse edasi, koguneb sinna uus raha, mida kasutad pensionieas.' : '') + (input.p3Before2021 ? ' ' + input.p3Open + '-aastaselt seda valikut enam ei küsita.' : '') : '';
      }
      const on = radio('p2Early') === 'yes';
      $('p2EarlyMore').classList.toggle('d-none', !on);
      $('p2EarlyTxt').textContent = '22% tulumaksuga, ainult üks kord (alates 01.11.2026). Sinu ja riigi sissemaksed lõpevad, uuesti saab liituda 5 aasta pärast.';
      const e = input.p2Early ? P.simulate(input, T, SCEN[0]).p2Early : null;
      $('p2EarlyNote').classList.toggle('d-none', !e);
      $('p2EarlyNote').innerHTML = e ? '<strong>' + e.age + '-aastaselt</strong> on II sambas u ' + eur(e.gross) + ', tulumaksu läheb ' + eur(e.tax) + ' ja kätte saad <strong>' + eur(e.net) + '</strong>. ' +
        (e.save ? 'Raha on pensionini hoiusel.' : 'Pensioniks sellest raha ei jää.') + (e.rejoin ? ' Sissemaksed algavad uuesti ' + (e.age + 5) + '-aastaselt nullist.' : ' II sambasse enam ei koguta, seega pensioniks jääb vähem.') +
        ((input.kids || {}).u3 > 0 ? ' Riigi lisamakse lapse eest lõpeb samuti' + (e.rejoin ? '; pärast uuesti liitumist Elukaar seda ei arvesta (eeldus).' : '.') : '') +
        ' Riiklikku pensioni see ei muuda.' : '';
    }
    chapters[5].dataset.label = (pa - 5) + ' a'; // rajal vanus aastates („60 a“)
    chapters[6].dataset.label = retAge(input) + ' a';
    // Sama vanus kahel sammul (nt 5 a varem pensionile = pensioniiga − 5): eristame sõnaga.
    const same = retAge(input) === pa - 5;
    chapters[5].dataset.sub = same ? 'sambad' : ''; chapters[6].dataset.sub = same ? 'pension' : '';
    // Kui sammast pole (summa ja sissemakse 0), on selle valikud keelatud ja kollane märkus ütleb, miks.
    const noneTxt = (n) => n === 'II' && input.p2Gone
      ? '<strong>II samba võtsid ' + input.p2Early.age + '-aastaselt välja ja uuesti ei liitu, valik puudub.</strong> <button type="button" class="btn btn-link p-0 align-baseline" data-goto="3">Muuda II samba valikut<span class="visually-hidden"> tööaastatel</span></button>'
      : '<strong>' + n + ' sambas ei ole kogutud midagi, valik puudub.</strong> <button type="button" class="btn btn-link p-0 align-baseline" data-goto="0">Muuda ' + n + ' samba summat<span class="visually-hidden"> sinu andmetes</span></button>';
    const lockSet = (id, off) => { $(id).disabled = off; $(id).classList.toggle('is-off', off); };
    // 60: II samba osa
    lockSet('p2At60Set', !input.p2Has);
    $('p2At60Note').classList.toggle('d-none', input.p2Has);
    $('p2WorkTip').classList.toggle('d-none', !input.p2Has); // töö ajal väljamakse lõpetab sissemaksed (Pensionikeskus)
    $('p2At60Note').innerHTML = input.p2Has ? '' : noneTxt('II');
    // 60: III samba osa
    const p3Done = input.p3Has && input.p3Plan !== 'keep';
    $('p3At60Set').classList.toggle('d-none', p3Done);
    lockSet('p3At60Set', !input.p3Has);
    $('p3At60Note').classList.toggle('d-none', input.p3Has && !p3Done);
    $('p3At60Note').innerHTML = !input.p3Has
      ? noneTxt('III')
      : p3Done ? 'III samba kohta tegid valiku juba ' + input.p3Age + '-aastaselt: <strong>' + (input.p3Plan === 'lump' ? 'võtsid selle korraga välja' : 'fondipension') + '</strong>. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="' + (input.p3EarlyAge !== undefined ? 3 : 4) + '">Muuda III samba valikut<span class="visually-hidden"> ' + input.p3Age + '-aastaselt</span></button>' : '';
    // Otsustuskohtade järjekord: varane väljavõtt (samm 3), 55 a (samm 4) ja pa − 5 (samm 5), ainult need, mis on loos.
    const ORD = ['esimene', 'teine', 'kolmas'], nth = (i) => ORD[[3, 4, 5].filter((j) => j < i && !skipped(j)).length];
    $('h4').textContent = '55-aastaselt: ' + nth(4) + ' otsustuskoht';
    $('h5').textContent = (pa - 5) + '-aastaselt: ' + nth(5) + ' otsustuskoht';
    $('p60Txt').innerHTML = (input.birthYear + pa - 5) + '. aastal oled ' + (pa - 5) + '-aastane, 5 aastat enne pensioniiga. Siis avaneb soodustingimustel II samba väljavõtmise võimalus. Väljamakse algab Elukaares pensionieas. Kui hakkad raha välja võtma, lõpevad II samba sissemaksed igaveseks.';
    // 66+ samm: kui kasvatad edasi ja valisid fondipensioni alguse, on samm rajal selle vanuse kohal (nagu soodustuse samm).
    chapters[7].dataset.label = firstFund(input) ? firstFund(input) + ' a' : (retAge(input) + 1) + '+ a';
    // Pensioni samm: soodustingimustel pensionile (1. vaate valik) asendab tavalise pensioniea sammu.
    const ret = retAge(input);
    $('h6').textContent = input.flexEarly > 0 ? 'Paindlik pension varem' : input.soodus > 0 ? 'Soodustingimustel pensionile' : 'Pensioniiga';
    // Töö soodustusega pensioni ajal (pension.js soodusWork, workUntil, p3After).
    // Töötamise valik on kõigil: soodustusega pensionil kuni tavalise pensionieani (vaikimisi), muidu vaikimisi 1 aasta.
    {
      const wu = $('workUntil'), cur = input.workUntil !== undefined ? input.workUntil : input.soodus > 0 ? pa : ret + 1;
      const opts = []; for (let a = ret + 1; a <= Math.max(pa + 5, 75); a++) opts.push(a);
      const html = opts.map((a) => '<option value="' + a + '"' + (a === cur ? ' selected' : '') + '>' + a + '-aastaseni (' + (input.birthYear + a) + ')' + (a === pa ? ', tavaline pensioniiga' : '') + '</option>').join('');
      if (wu.dataset.k !== ret + ':' + pa) { wu.innerHTML = html; wu.dataset.k = ret + ':' + pa; }
      $('workUntilWrap').classList.toggle('d-none', !input.workOn);
      const acc = P.workAccrual(input.grossMonthly, input.p2Rate > 0, input.p2Rate > 0);
      $('soodusAccrualTxt').textContent = input.grossMonthly > 0 ? 'Brutopalgaga ' + eur(input.grossMonthly) + ' tõstab iga tööaasta pensioni u ' + one(acc) + ' € kuus.' : 'Sisesta 1. vaates brutopalk, siis näed, palju pension tõuseb.';
      const p3On = !input.workOn && input.p3Monthly > 0 && ret < pa;
      $('p3AfterSet').classList.toggle('d-none', !p3On);
      $('p3AfterUntil').textContent = pa;
      $('p3AfterSameTxt').textContent = eur(input.p3Monthly) + ' kuus, nagu praegu';
      const p3Change = radio('p3AfterMode') === 'change';
      $('p3AfterWrap').classList.toggle('d-none', !(p3On && p3Change));

    }
    let sNote = input.soodus > 0 ? ret + '-aastaselt (' + (input.birthYear + ret) + ') lähed pensionile ' + (input.flexEarly > 0 ? 'paindliku pensioniga' : 'soodustingimustel') + ', ' + input.soodus + ' a enne tavalist pensioniiga (' + pa + ' a). ' +
      (input.flexEarly > 0 ? 'Riiklikku pensioni vähendatakse eluks ajaks ' + pctTxt(P.EARLY_DECREASE[input.flexEarly]) + '. ' : 'Riiklikku pensioni ei vähendata (vähenduskordajat ei rakendata). ') +
      'Kuni ' + pa + '. eluaastani on maksuvaba tulu 700 € kuus, siis 776 €.' + (ret < pa - 5 ? ' II sammas avaneb alles ' + (pa - 5) + '-aastaselt.' : '') +
      ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="0">Muuda varem pensionile minekut<span class="visually-hidden"> sinu andmetes</span></button>' : '';
    // Päästeteenistus ja ametniku staaž (PäästeTS § 18–19, ATS § 113): suurendus ja tööreegel; mitu varem mineku õigust → üks.
    {
      const kidsYn = P.earlyYears({ kids: input.kids }), resYn = P.earlyYears({ kids: {}, rescueYears: input.rescueYears });
      const resInc = P.rescueIncrease(input.rescueYears, input.birthYear + ret), resLaw = P.rescueIncrease(input.rescueYears);
      const civInc = input.rescueYears > 0 ? 0 : P.civilIncrease(input.civilYears);
      const extra = [];
      // Ootetoetus või laste eest pension (TLV-105, valik rescueBasis): toetus kuni until, siis vanaduspension.
      const until = input.flexEarly ? null : P.rescueUntil(input);
      const kidsSup = P.childSupplement(input) > 0;
      // Ootetoetuse ja laste pensioni valik on sama sammu kaartidel (rescueBasisSet), märkus ainult kes maksab.
      // Võrdlus valiku kõrval (KKK asemel): iga variant kõige varem ja vähendamata, riikliku tulu järgi enne maksu.
      const showCmp = !$('rescueBasisWrap').classList.contains('d-none');
      $('rbCompareItem').classList.toggle('d-none', !showCmp);
      $('rbCompare').innerHTML = showCmp ? rescueCompare(input, pa) : '';
      // Perekondlik valik (TLV-105): ootetoetusega päästja saab laste varem mineku õiguse anda teisele vanemale.
      // Perekondlik valik (TLV-105): laste varem mineku õigus (earlyUser) ja pensionilisa (supUser) on eraldi õigused.
      if (kidsYn && resYn && input.kids.earlyUser === 'me') extra.push('<strong>Nõuanne:</strong> kui lastel on teine vanem, kellel on kasulik seda õigust kasutada, kaalu varem pensionile mineku õiguse andmist talle: sina saad edasi päästja ootetoetuse ja tema läheb laste eest soodustingimustel pensionile ' + kidsYn + ' a varem. Pere arvutus ja laste pensionilisa: <a href="#rbCompareItem">korduma kippuvad küsimused</a>.');
      // Ootetoetus (PäästeTS § 19): maksab päästeasutus kuni pensionieani, siis vanaduspension Sotsiaalkindlustusametilt.
      if (until !== null && until > ret && input.soodus > 0) extra.push('<strong>Kes maksab:</strong> kuni ' + until + '-aastaseks saamiseni maksab sulle päästeasutus vanaduspensioni ootel oleva päästeteenistuja toetust vanaduspensioni suuruses' + (kidsSup ? ', kuid ilma laste pensionilisata: toetus ei ole pension ja laste lisa algab koos vanaduspensioniga (ettevaatlik eeldus)' : '') + '. Alates ' + until + '. eluaastast maksab vanaduspensioni Sotsiaalkindlustusamet, kes vaatab üle ka kõik lisad. Ootetoetuselt II sambasse sissemakseid ei tule (ettevaatlik eeldus: sotsiaalmaksu ei maksta), raha kasvab fondis edasi.');
      if (input.rescueYears > 0) {
        // Suurendus kehtib kohe pensionile (või ootetoetusele) minnes, ka soodustusega varem, mitte alles tavalises pensionieas.
        const incPct = '+' + Math.round(resInc * 100) + '%';
        if (resInc > 0) extra.push('<strong>Päästja suurendus:</strong> staaž ' + input.rescueYears + ' a, ' + incPct + ' ' +
          (until !== null && until > ret ? 'kohe ootetoetusele ' + ret + '-aastaselt ja hiljem ka vanaduspensionile.'
            : ret < pa ? 'vanaduspensionile kohe ' + ret + '-aastaselt, mitte alles ' + pa + '-aastaselt.' : 'vanaduspensionile alates ' + pa + '-aastaselt.'));
        else if (resLaw > 0) extra.push('<strong>Päästja suurendus:</strong> suurendus (+' + Math.round(resLaw * 100) + '%) kehtib kuni 2043. a veebruarini, sinu pensioniaastal (' + (input.birthYear + ret) + ') enam mitte.');
        // Ootetoetus ja suurendus nõuavad päästeteenistusest lahkumist; laste eest varem saadud pension töötamist ei piira.
        const kidsPension = kidsYn && input.kids.earlyUser === 'me' && input.rescueBasis !== 'toetus';
        // Spetsifikatsiooni p 6 (TLV-105): II samba väljamakse avaldus lõpetab sissemaksed, ka riigi 4%.
        extra.push('<strong>Töö:</strong> ootetoetust ja päästja suurendust makstakse ainult siis, kui sa ei tööta päästjana. Muul erialal võid edasi töötada.' +
          (input.p2Has ? ' Kui töötad, ära alusta II samba väljamakseid enne töö lõppu: väljamakse avaldusega lõpevad sinu ja riigi sissemaksed (sh riigi 4%).' : '') +
          (kidsPension ? ' Laste eest varem saadud vanaduspensioni kõrvalt võid töötada, sh ka päästjana: pension jääb, ainult ootetoetust selle ajal ei maksta.' : ''));
      }
      const hzM = P.hazardSupplement(input);
      if (hzM > 0) extra.push('<strong>Nimekiri nr 1:</strong> ' + input.hazardYears + ' a tööd lisab vanaduspensionile u ' + eur(hzM) + ' kuus (SVPS § 3).' + (input.hazardYears < 10 ? ' Varem minekuks on vaja vähemalt 10 aastat, seega varem pensionile minekut nimekirja eest ei arvesta.' : ''));
      const hz2 = input.hazard === 'list2' ? parseFloat($('hazardYears').value) : NaN;
      if (hz2 >= 0 && hz2 < 12.5) extra.push('<strong>Nimekiri nr 2:</strong> varem minekuks on vaja vähemalt 12,5 aastat nimekirja tööd, sul ' + hz2.toLocaleString('et-EE') + '. Seepärast ei arvesta me nimekirja eest varem pensionile minekut.');
      if (civInc > 0) extra.push('<strong>Ametnik:</strong> teenistusstaaž ' + input.civilYears + ' a suurendab vanaduspensioni ' + Math.round(civInc * 100) + '%.');
      // Nupp „Muuda varem pensionile minekut“ märkuse lõppu (pärast loendit).
      const btnAt = sNote.indexOf(' <button'), btn = btnAt >= 0 ? sNote.slice(btnAt) : '';
      if (btnAt >= 0) sNote = sNote.slice(0, btnAt);
      if (extra.length) sNote += '<ul class="note-list mb-0' + (sNote ? ' mt-2' : '') + '">' + extra.map((x) => '<li>' + x + '</li>').join('') + '</ul>';
      if (btn) sNote += '<p class="mb-0 mt-2">' + btn.trim() + '</p>';
      $('soodusNote').innerHTML = sNote;
      $('soodusNote').classList.toggle('d-none', !sNote);
    }

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
    $('switchNote').textContent = input.switchAge <= input.currentAge
      ? 'Vahetad kohe. Edasi kasvab raha uues fondis (' + pct(FUNDS[input.fundNow].r) + ').'
      : 'Vahetad ' + input.switchAge + '-aastaselt (' + (input.birthYear + input.switchAge) + '. a). Seni (' + (input.switchAge - input.currentAge) + ' a) kasvab raha praeguses fondis (' + pct(FUNDS[input.fund18].r) + '), pärast seda uues fondis (' + pct(FUNDS[input.fundNow].r) + ').';
    $('workNote').innerHTML = (input.soodus > 0 ? 'Pensionile minekuks (' + retAge(input) + ' a)' : 'Pensionieaks (' + pa + ' a)') + ' kasvab sinu sammaste vara umbes <strong>' + eur(pot).replace(' €', ' euroni') + '</strong>.';

    // Kulud: leibkond
    $('hhNote').innerHTML = input.household === 'paar'
      ? '<span class="hh-emoji" aria-hidden="true">👫</span><span><strong>Elad pensionil paaris.</strong> Summad on sinu osa paari kuludest (ühe inimese kohta). Ühine kodu ja arved teevad elu inimese kohta odavamaks kui üksi.</span>'
      : '<span class="hh-emoji" aria-hidden="true">🧍</span><span><strong>Elad pensionil üksi.</strong> Summad on üksi elava pensionäri kulud: kodu ja arved maksad ainult sina.</span>';

    // Varem pensionile ja erijuhud: laste lisaväljad, prognoosi küsimus ja kokkuvõte.
    const kn = input.kids.b1991 + input.kids.b2012 + input.kids.b2013 + input.kids.b2021 + input.kids.bUnknown;
    $('kidsDetails').classList.toggle('d-none', $('kidsHas').value !== 'yes');
    renderKids();
    // Kaks eraldi õigust: valik avaneb ainult siis, kui õigus sinu laste järgi tekib.
    const asMe = Object.assign({}, input, { kids: Object.assign({}, input.kids, { earlyUser: 'me', supUser: 'me', user: 'me' }) });
    $('kidsEarlyWrap').classList.toggle('d-none', !(P.earlyYears({ kids: asMe.kids }) > 0));
    // Üks õigus kahel kujul (SKA): pensionilisa või II samba lisamakse; silt näitab seda, mis sinu laste puhul kehtib.
    const supMe = P.childSupplement(asMe) > 0, iiMe = P.childPillar2(asMe) > 0;
    $('kidsSupWrap').classList.toggle('d-none', !(supMe || iiMe));
    document.querySelector('label[for="kidsSupUser"]').textContent = supMe && iiMe ? 'Pensionilisa või II samba lisamakset saab' : iiMe ? 'II samba lisamakset saab' : 'Pensionilisa saab';
    const sup = P.childSupplement(input);
    // Kas SKA prognoos sisaldab juba laste pensionilisa: „jah“ → ei lisa, „ei“ → lisame, „ei tea“ → ei lisa (ettevaatlik).
    $('kidsForecastWrap').classList.toggle('d-none', !(sup > 0));
    // Riigi II samba lisamakse (alla 3-aastase lapse eest) on arvutuses sees; eraldi summat sammus „Sina“ ei näidata (Kadi 24.10).
    const why = [];
    const l1 = input.hazard === 'list1', l2 = input.hazard === 'list2';
    // Nimekirja tööaastad: nr 1 annab pensionilisa (SVPS § 3) ja varem minekuks on vaja 10 a; nr 2 lisa ei anna, aga varem
    // minekuks on vaja 12,5 a (abi.js „hazard“ tabel). Nr 2 aastaid arvutus ei kasuta, ainult hoiatus.
    $('hazardYearsWrap').classList.toggle('d-none', !(l1 || l2));
    const hzN = l1 ? 1 : 2, hzNeed = l1 ? 10 : 12.5, hzYrs = parseFloat($('hazardYears').value);
    document.querySelector('label[for="hazardYears"]').firstChild.textContent = 'Mitu aastat töötasid nimekirja nr ' + hzN + ' tööl? ';
    $('hazardYearsHint').textContent = (l1 ? 'Iga aasta lisab pensionile 3,1% aastahindest. ' : 'Nimekirja nr 2 töö eest pensionilisa pole. ') +
      'Varem minekuks on vaja vähemalt ' + hzNeed.toLocaleString('et-EE') + ' aastat nimekirja tööd ja ' + (l1 ? 20 : 25) + ' aastat staaži kokku.' +
      (hzYrs >= 0 && hzYrs < hzNeed ? ' ' + hzYrs.toLocaleString('et-EE') + ' aastast ei piisa, seega varem pensionile minekut nimekirja eest ei arvesta.' : '');
    $('undergroundWrap').classList.toggle('d-none', !l1);
    const hz = P.hazardSupplement(input);
    const kidsY = P.earlyYears({ kids: input.kids }), hazY = P.earlyYears({ kids: {}, hazard: input.hazard, hazardYears: input.hazardYears });
    const resY = P.earlyYears({ kids: {}, rescueYears: input.rescueYears });
    if (kidsY) why.push('lastest (' + kidsY + ' a)');
    if (hazY) why.push('tervist kahjustavast tööst (' + hazY + ' a)');
    if (resY) why.push('päästeteenistusest (' + resY + ' a: päästeasutus maksab sulle pensioniealiseks saamiseni toetust vanaduspensioni suuruses)');
    const whyTxt = why.length ? ' Õigus tuleb ' + (why.length > 1 ? why.slice(0, -1).join(', ') + ' ja ' + why[why.length - 1] : why[0]) + '.' : '';
    const pick = why.length > 1 ? ' Aastad ei liitu: kasutad ühte õigust, mis annab kõige rohkem aastaid.' : '';
    const whenTxt = retAge(input) + '-aastaselt (' + (input.birthYear + retAge(input)) + ')';
    $('soodusSummary').innerHTML = input.flexEarly > 0
      ? 'Lähed pensionile <strong>' + input.soodus + ' a varem</strong>, ' + whenTxt + '. See on paindlik pension: riiklikku pensioni vähendatakse eluks ajaks ' + pctTxt(P.EARLY_DECREASE[input.flexEarly]) + '.' + (why.length ? ' Vähendamata saaksid minna ' + Math.max(kidsY, hazY, resY) + ' a varem.' : '')
      : input.soodus > 0
      ? 'Saad minna pensionile <strong>' + input.soodus + ' a varem</strong>, ' + whenTxt + ', ilma vähenduseta.' + whyTxt + pick
      : kn > 0 && input.kids.earlyUser === 'other' && P.earlyYears({ kids: asMe.kids }) > 0 ? 'Varem pensionile mineku õigust kasutab teine vanem, sinu pensioniiga ei muutu.' : '';
    $('soodusSummary').classList.toggle('d-none', !$('soodusSummary').innerHTML);

    // Sina: eripensioni algusvanus on nähtav ainult siis, kui eripension on olemas.
    $('spStartWrap').classList.toggle('d-none', !input.spHas);



    // Eripensioni samm: algus, töö ja pensioniiga (suurem kahest, pension.js firstPillar).
    if (input.spHas) {
      // paSp: vanaduspensioni õigus (soodustusega varem, 1. vaate valik); seal valitakse suurem kahest.
      const sp = P.specialStart(input), paSp = P.retirementYears(input) - (input.soodus || 0);
      $('kSp').textContent = kicker(input, SP_STEP);
      const already = sp < input.currentAge;
      $('hSp').textContent = already ? 'Saad eripensioni' : 'Eripension algab';
      $('spIntro').innerHTML = sp + '-aastaselt (' + (input.birthYear + sp) + ') ' + (already ? 'algas' : 'algab') + ' sinu eripension. ' +
        '<button type="button" class="btn btn-link p-0 align-baseline" data-goto="0">Muuda algusvanust<span class="visually-hidden"> sinu andmetes</span></button>';
      $('spMonthlyLabel').textContent = already ? 'Sinu eripension praegu' : 'Eripensioni suurus';
      // Minevikus alanud eripension: valikud on tehtud, näita neid lukus koos praeguse olukorraga.
      $('spPastNote').classList.toggle('d-none', !already);
      $('spCalcHint').classList.toggle('d-none', already);
      $('spSameJobNote').classList.toggle('d-none', already);
      if (already) {
        const iiNow = P.yearlyContribution(Object.assign({}, input, { p3Monthly: 0, wageGrowth: 0, inflation: 0 }), input.currentAge) / 12; // tänane makse
        $('spPastNote').innerHTML = '<strong>Need valikud tegid juba ' + sp + '-aastaselt.</strong> Eripensioni algust ja tööd sel ajal muuta ei saa. ' +
          'Sinu tänased II ja III samba summad sisaldavad juba kõike, mis vahepeal laekus. Edasi arvutame praeguse olukorra järgi: ' +
          (input.grossMonthly > 0 ? 'töötad, brutopalk ' + eur(input.grossMonthly) + ' kuus' + (input.p2Rate > 0 ? ', II sambasse laekub kuni pensionini ' + eur(iiNow) + ' kuus.' : ', II samba sissemakset pole.') : 'ei tööta, II sambasse ei laeku.') +
          ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="0">Muuda praegust palka<span class="visually-hidden"> sinu andmetes</span></button>';
      }
      $('spWorkSet').classList.toggle('d-none', sp >= paSp || already);
      $('spWorkSet').disabled = already;
      const payOn = sp < paSp && input.spWork && !already;
      $('spPaySet').classList.toggle('d-none', !payOn);
      $('spPaySameTxt').textContent = eur(input.grossMonthly) + ' kuus, nagu sinu andmetes';
      // II samba sissemakse eripensioni ajal (sama arvutus mis mootoris): töötades palgast, ilma tööta 0.
      const ii = P.yearlyContribution(Object.assign({}, input, { p3Monthly: 0, spWork: true, wageGrowth: 0, inflation: 0 }), sp) / 12; // tänane makse, palga kasvuta
      const rate = input.p2Rate || 0;
      $('spIIYes').textContent = rate > 0 ? 'II sambasse laekub ' + eur(ii) + ' kuus (' + one(rate * 100) + '% sinult + 4% riigilt).' : 'II sambasse ei laeku: sul pole II samba sissemakset.';
      $('spIINo').textContent = 'II sambasse laekub 0 € kuus.';
      const payChange = radio('spPay') === 'change';
      $('spGrossWrap').classList.toggle('d-none', !(payOn && payChange));

      const fp = P.simulate(input, T, { id: 'E' }).firstPillar;
      $('spPaTxt').textContent = !fp ? 'Sisesta eripensioni suurus, siis näed, kumb on pensionieas suurem: eripension või vanaduspension.' : paSp + '-aastaselt (' + (input.birthYear + paSp) + ')' + (input.soodus > 0 ? ', soodustingimustel ' + input.soodus + ' a varem,' : '') + ' on sul õigus ka vanaduspensionile (' + eur(fp.oldAge) + ' kuus). Kahte riiklikku pensioni korraga ei maksta: saad suurema. ' +
        (fp.paid === 'special' ? 'Sinu eripension on suurem või võrdne, seega jätkub see samas mahus.' : 'Vanaduspension on suurem: esita pensioniikka jõudes SKA-le avaldus, siis asendab vanaduspension eripensioni. Automaatselt see ei vahetu.');
    }

    // 18–55: III sammas
    $('p3HasMore').classList.toggle('d-none', !input.p3Has);
    $('p3OpenWrap').classList.toggle('d-none', $('p3Joined').value !== 'none');
    const oe = $('p3OpenAge');
    if (input.p3Kind === 'future' && document.activeElement !== oe && oe.value !== String(input.p3OpenAge)) oe.value = String(input.p3OpenAge);
    if (input.p3Has) {
      const yearly = input.p3Monthly * 12;
      const refund = Math.min(yearly, 0.15 * input.grossMonthly * 12, 6000) * 0.22;
      const future = input.p3OpenAge > input.currentAge;
      $('p3WorkNote').innerHTML = (future ? 'Avad III samba ' + input.p3OpenAge + '-aastaselt (' + (input.birthYear + input.p3OpenAge) + '. a), seni sissemakseid pole. Tänast III samba summat ei arvestata. ' : '') +
        (input.p3Before2021 ? 'Avatud enne 2021. a: ' : 'Avatud 2021. a või hiljem: ') + 'soodusmaks kehtib alates <strong>' + input.p3Open + '-aastaselt</strong>' +
        (input.p3Open > (input.p3Before2021 ? 55 : 60) ? ' (kogumist peab olema vähemalt 5 aastat)' : '') + '. ' +
        (refund > 0 ? 'Sissemaksetelt saad tulumaksu tagasi umbes <strong>' + eur(refund) + ' aastas</strong> (22%, kuni 15% brutotulust ja 6000 €). Arvutus seda sambasse ei lisa.' : '');
    } else {
      $('p3WorkNote').textContent = 'III sammast ei ole. Tänast III samba summat ei arvestata.';
    }

    // 55: III samba väljavõtt
    const pa0 = P.retirementYears(input);
    const soon = input.p3Age >= input.p3Open; // kas väljavõtu ajal kehtib soodusmaks
    const basic = input.p3Before2021 ? 55 : 60;
    $('p3Info').innerHTML = !input.p3Has ? '' : '<p class="mb-2">' + (input.p3Kind === 'have' ? 'Liitusid III sambaga ' + (input.p3Before2021 ? 'enne 2021. a' : '2021. a või hiljem') : 'Avad III samba ' + input.p3OpenAge + '-aastaselt (' + (input.birthYear + input.p3OpenAge) + ')') + ', seega kehtib soodusmaks alates <strong>' + input.p3Open + '-aastaselt (' + (input.birthYear + input.p3Open) + ')</strong>.' +
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
    // Lukus, kui mootor ütleb nii (eripension): valikuid ei näita, selgitab põhjust ja viib sinna, kus seda muuta.
    const deferOpt = P.options(input).deferral;
    $('deferLockedTxt').textContent = deferOpt.open ? '' : deferOpt.reason;
    $('deferLockedBtn').textContent = input.spHas ? 'Muuda eripensioni' : 'Muuda varem pensionile minekut';
    $('deferIntro').classList.toggle('d-none', !deferOpt.open);
    $('deferLocked').classList.toggle('d-none', deferOpt.open);
    // Lukus: valikuid ei näidata (hallid kaardid valede numbritega segasid), ainult põhjus ja link muutmiseks.
    $('deferSet').classList.toggle('d-none', !deferOpt.open);
    $('deferSet').disabled = !deferOpt.open;
    // Eripension: pensionile minnes vali eripension või vanaduspension (kahte korraga ei maksta).
    $('fpChoiceWrap').classList.toggle('d-none', !(input.spHas && input.spMonthly > 0));
    if (input.spHas && input.spMonthly > 0) {
      const fp = P.simulate(input, T, { id: 'E' }).firstPillar, cur = input.firstPillarChoice || fp.larger;
      // Laste pensionilisa märge: lisatud, juba prognoosis või arvestamata (prognoosi küsimus 1. vaates).
      const supTxt = supTxtPa(input);
      $('fpChoiceIntro').textContent = retAge(input) + '-aastaselt' + (input.soodus > 0 && !input.flexEarly ? ' (soodustingimustel)' : '') + ' on sul õigus nii eripensionile kui ka vanaduspensionile. Kahte riiklikku pensioni korraga ei maksta, seega vali üks. Tavaliselt tasub valida suurem. Vanaduspensionile üle minekuks esita SKA-le avaldus, automaatselt see ei vahetu.';
      const opt = (v, t, amt, note) => '<label class="choice"><input type="radio" name="fpChoice" value="' + v + '"' + (cur === v ? ' checked' : '') + '>' +
        '<span class="choice-body"><strong>' + t + (fp.larger === v ? ' <span class="badge text-bg-success">suurem</span>' : '') + '</strong><small>' + eur(amt) + ' kuus enne maksu' + (note ? '. ' + note : '') + '</small></span></label>';
      const key = [fp.special, fp.oldAge, cur, supTxt].join(':');
      if ($('fpChoices').dataset.k !== key) {
        $('fpChoices').innerHTML = opt('special', 'Jätkan eripensioniga', fp.special, 'Ei muutu, avaldust pole vaja') + opt('oldAge', 'Lähen üle vanaduspensionile', fp.oldAge, supTxt);
        $('fpChoices').dataset.k = key;
        $('fpChoices').querySelectorAll('input').forEach((el) => el.addEventListener('change', update));
      }
    }
    // Teine otsustuskoht tavalises pensionieas: kui varem jätkasid eripensioniga, võib vanaduspension olla nüüd suurem
    // (pensioni ajal töötatud aastad lisanduvad). Vaikimisi suurem; vanaduspensionile üleminek SKA avaldusega.
    {
      const fp = input.spHas && input.spMonthly > 0 ? P.simulate(input, T, { id: 'E' }).firstPillar : null, pa2 = fp && fp.atPa;
      $('fpChoicePaWrap').classList.toggle('d-none', !pa2);
      if (pa2) {
        const cur = input.firstPillarChoicePa || pa2.larger;
        const worked = pa2.oldAge - fp.oldAge;
        $('fpChoicePaIntro').textContent = pa2.age + '-aastaselt (' + (input.birthYear + pa2.age) + ') jõuad tavalisse pensioniikka. Varem jätkasid eripensioniga. ' +
          (worked >= 0.5 ? 'Pensioni ajal töötatud aastad tõstavad vanaduspensioni u ' + eur(worked) + ' kuus. ' : '') + 'Võrdle uuesti ja vali üks. Vanaduspensionile üleminekuks esita SKA-le avaldus.';
        const opt = (v, t, amt, note) => '<label class="choice"><input type="radio" name="fpChoicePa" value="' + v + '"' + (cur === v ? ' checked' : '') + '>' +
          '<span class="choice-body"><strong>' + t + (pa2.larger === v ? ' <span class="badge text-bg-success">suurem</span>' : '') + '</strong><small>' + eur(amt) + ' kuus enne maksu' + (note ? '. ' + note : '') + '</small></span></label>';
        const key = [fp.special, pa2.oldAge, cur, supTxtPa(input)].join(':');
        if ($('fpChoicesPa').dataset.k !== key) {
          $('fpChoicesPa').innerHTML = opt('special', 'Jätkan eripensioniga', fp.special, 'Ei muutu, avaldust pole vaja') + opt('oldAge', 'Lähen üle vanaduspensionile', pa2.oldAge, supTxtPa(input));
          $('fpChoicesPa').dataset.k = key;
          $('fpChoicesPa').querySelectorAll('input').forEach((el) => el.addEventListener('change', update));
        }
      }
    }
    // Pensionieas: II ja III valik eraldi, ainult kui 60-aastaselt jätkasid kasvatamist. Muidu kast tehtud valikuga.
    const p3Open = input.p3Has && input.p3Plan === 'keep';
    // Sama vanus kui eelmisel sammul (5 a varem pensionile): samba valikut ei küsita teist korda.
    const sameAge = retAge(input) <= pa - 5;
    $('payoutPaSet').classList.toggle('d-none', (input.p2Has && input.payout !== 'grow') || sameAge);
    lockSet('payoutPaSet', !input.p2Has);
    $('paIINote').classList.toggle('d-none', input.p2Has && input.payout === 'grow' && !sameAge);
    $('paIINote').innerHTML = !input.p2Has ? noneTxt('II') : input.payout === 'grow' ? (sameAge ? '<strong>II sammas:</strong> valiku tegid eelmises sammus (' + (pa - 5) + ' a): kasvatan edasi. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda II samba valikut</button>' : '') : '<strong>II sammas:</strong> valiku tegid ' + (pa - 5) + '-aastaselt: ' + { lump: 'võtad korraga välja', fund: 'fondipension' }[input.payout] + '. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda II samba valikut<span class="visually-hidden"> ' + (pa - 5) + '-aastaselt</span></button>';
    $('p3PaSet').classList.toggle('d-none', (input.p3Has && !(p3Open && input.p3At60 === 'grow')) || (input.p3Has && sameAge));
    lockSet('p3PaSet', !input.p3Has);
    // Pensionile mineku sammu KKK: valiku vaates (ootetoetus / eripension vs laste pension) ainult võrdlus;
    // muidu aastahinne; fondipensioni küsimused siis, kui sammus on II või III samba valik (ka lukus, ainult info).
    {
      const spCmp = spCompareShown(input);
      $('spCompareItem').classList.toggle('d-none', !spCmp);
      $('spCompareLink').classList.toggle('d-none', !spCmp);
      $('spCompare').innerHTML = spCmp ? spCompare(input, pa) : '';
      const only = !$('rbCompareItem').classList.contains('d-none') || spCmp;
      const pillars = !$('payoutPaSet').classList.contains('d-none') || !$('p3PaSet').classList.contains('d-none');
      $('faq65').querySelectorAll('details.faq-ah').forEach((d) => d.classList.toggle('d-none', only));
      $('faq65').querySelectorAll('details.faq-fond').forEach((d) => d.classList.toggle('d-none', only || !pillars));
    }
    $('paIIINote').classList.toggle('d-none', p3Open && input.p3At60 === 'grow' && !sameAge);
    $('paIIINote').innerHTML = !input.p3Has ? noneTxt('III') : '<strong>III sammas:</strong> ' + (!input.p3Has ? ''
      : !p3Open ? 'valiku tegid ' + input.p3Age + '-aastaselt: ' + (input.p3Plan === 'lump' ? 'võtsid korraga välja' : 'fondipension') + '. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="' + (input.p3EarlyAge !== undefined ? 3 : 4) + '">Muuda III samba valikut<span class="visually-hidden"> ' + input.p3Age + '-aastaselt</span></button>'
      : (sameAge && input.p3At60 === 'grow' ? 'valiku tegid eelmises sammus (' + (pa - 5) + ' a): ' : 'valiku tegid ' + (pa - 5) + '-aastaselt: ') + { grow: 'kasvatan edasi', lump: 'võtad korraga välja', fund: 'fondipension' }[input.p3At60] + '. <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda III samba valikut<span class="visually-hidden"> ' + (pa - 5) + '-aastaselt</span></button>');
    // Pensionieas: täis kohe, pool N aastat või edasi N aastat (p1Mode). Aastad on raadio „defer“ (0 = kohe täis).
    const isHalf = !!input.half;
    const curDef = isHalf ? input.half : input.deferral;
    const mode = isHalf ? 'half' : curDef > 0 ? 'defer' : 'full';
    document.querySelectorAll('input[name=p1Mode]').forEach((el) => { el.checked = el.value === mode; });
    $('p1FullTxt').textContent = eur(input.p1Monthly) + ' kuus enne maksu, kohe ' + pa + '-aastaselt';
    $('p1HalfTxt').textContent = eur(input.p1Monthly / 2) + ' kuus. Teine pool kasvab nagu edasilükkamisel';
    // Kui töötad edasi, näita ka edasilükkamist töö lõpuni (siis elad palgast ja pension tõuseb), mitte ainult kõige pikemat.
    const workTo = input.workOn ? (input.workUntil !== undefined ? input.workUntil : retAge(input) + 1) : 0, dWork = Math.min(5, workTo - pa);
    $('p1DeferTxt').textContent = (dWork > 0 && dWork < 5 ? 'Töö lõpuni (' + workTo + '-aastaseni): ' + eur(input.p1Monthly * (1 + P.DEFERRAL_INCREASE[dWork])) + ' kuus. ' : '') +
      'Kõige kauem ' + (pa + 5) + '-aastaseni: ' + eur(input.p1Monthly * (1 + P.DEFERRAL_INCREASE[5])) + ' kuus';
    $('deferYearsWrap').classList.toggle('d-none', mode === 'full');
    $('deferYearsLegend').textContent = isHalf ? 'Mitu aastat võtad poole?' : 'Mitu aastat lükkad edasi?';
    $('deferChoices').innerHTML = [0, 1, 2, 3, 4, 5].map((d) => {
      const inc = isHalf ? P.DEFERRAL_INCREASE[d] / 2 : P.DEFERRAL_INCREASE[d];
      return '<label class="choice' + (d === 0 ? ' d-none' : '') + '"><input type="radio" name="defer" value="' + d + '"' + (d === curDef ? ' checked' : '') + '>' +
        '<span class="choice-body"><strong>' + (d === 0 ? 'Kohe, ' + pa + '-aastaselt' : isHalf ? d + ' a, täis ' + (pa + d) + '-aastaselt' : (pa + d) + '-aastaselt') + '</strong>' +
        '<small>' + (isHalf && d ? 'Siis ' : '') + eur(input.p1Monthly * (1 + inc)) + ' kuus enne maksu' + (d ? ' (+' + one(inc * 100) + '%)' : '') + '</small></span></label>';
    }).join('');
    $('deferChoices').querySelectorAll('input').forEach((el) => el.addEventListener('change', update));
    // SKA paindliku pensioni arvutus eeldab, et edasilükatud aastatel töötad edasi (staaž tõstab pensioni lisaks).
    // Elukaar lisab staaži ainult „Töötan edasi“ valikuga; vaikimisi ei tööta. Selgitame, et summad oleksid võrreldavad.
    {
      const acc = P.workAccrual(input.grossMonthly, input.p2Rate > 0, input.p2Rate > 0);
      const accTxt = input.grossMonthly > 0 ? ' veel u ' + one(acc) + ' € kuus' : '';
      const end = input.workUntil !== undefined ? input.workUntil : pa + 1;
      $('deferWorkNote').textContent = mode === 'full' ? ''
        : !input.workOn ? 'Need summad eeldavad, et vahepeal ei tööta. Kui töötad edasi, tõstab iga tööaasta pensioni' + accTxt + ': vali ülal „Töötan edasi“. SKA paindliku pensioni arvutus eeldab, et töötad edasi.'
        : 'Töötad ' + end + '-aastaseks. Iga tööaasta tõstab pensioni' + accTxt + ', see on arvutuses sees.' + (end < pa + curDef ? ' Kui töötad kogu edasilükatud aja, vali ülal „Töötan kuni“ ' + (pa + curDef) + '-aastaseks.' : '');
    }

    // 66+: fondipensioni algus eraldi II ja III sambale (kumbki on oma leping), kui see sammas kasvab pensionieas edasi.
    const p3Grows = input.p3Has && input.p3Plan === 'keep' && input.p3pa === 'grow';
    const p2Grows = input.p2Has && input.method === 'grow';
    [['fundFrom', p2Grows, input.fundFrom], ['fundFrom3', p3Grows, input.fundFrom3]].forEach(([id, on, cur]) => {
      $(id + 'Wrap').classList.toggle('d-none', !on);
      const ff = $(id), from = retAge(input) + 1, k = from + ':' + input.birthYear;
      if (on && ff.dataset.k !== k) {
        const opts = ['<option value="">Ei hakka, kasvatan edasi</option>'];
        for (let a = from; a <= 85; a++) opts.push('<option value="' + a + '"' + (a === cur ? ' selected' : '') + '>' + a + '-aastaselt (' + (input.birthYear + a) + ')</option>');
        ff.innerHTML = opts.join(''); ff.dataset.k = k;
      }
    });
    $('fundFromHint').classList.toggle('d-none', !(p2Grows || p3Grows));
    let lockMsg = '';
    if (!input.p2Has) lockMsg = input.p2Gone ? 'II samba võtsid varem välja, fondipensioni lepingu valik puudub.' : 'II sambas ei ole kogutud midagi, fondipensioni lepingu valik puudub.';
    else if (input.method === 'grow' && !input.fundFrom) lockMsg = 'Kasvatad edasi, nii et fondipensioni lepingut pole. Raha kasvab fondis ja võtad välja ainult nii palju, kui kuus vaja (10% tulumaks). Kui tahad hiljem fondipensioni, vali ülal algusaasta.';
    else if (input.method === 'lump') lockMsg = 'Võtsid samba raha korraga välja, nii et fondipensioni lepingut pole vaja. Raha on hoiusel ja kasutad seda vajaduse järgi.';
    // II ja III samba fondipension on eraldi lepingud (Pensionikeskus): kumbagi saab valida eraldi.
    const p3Fund = !!(input.p3Sep && input.p3Sep.mode === 'fund');
    const goto = input.payout === 'lump'
      ? ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="5">Muuda ' + (pa - 5) + '-aastaselt<span class="visually-hidden"> II samba väljamakse viisi</span></button>'
      : ' <button type="button" class="btn btn-link p-0 align-baseline" data-goto="6">Muuda pensionieas<span class="visually-hidden"> samba raha kasutamise viisi</span></button>';
    const off = !!lockMsg && !p3Fund;
    // Lukus: kaarte ei näita, vaid selgitab ja viib sinna, kus otsus tehakse.
    $('contractLocked').innerHTML = p3Fund && lockMsg
      ? (!input.p2Has ? (input.p2Gone ? 'II samba võtsid varem välja.' : 'II sambas ei ole kogutud midagi.') : (input.method === 'lump' ? 'II samba võtsid korraga välja' : 'II sammas kasvab edasi') + ', seal fondipensioni lepingut pole.' + goto)
      : !input.p2Has ? noneTxt('II') : lockMsg + (lockMsg ? goto : '');
    $('contractLocked').classList.toggle('d-none', !lockMsg);
    $('contractSet').disabled = !!lockMsg;
    $('contractSet').classList.toggle('d-none', !!lockMsg && (input.p2Has || p3Fund)); // II puudumisel (ja III-ta) kaardid nähtavad, aga keelatud
    $('contractSet').classList.toggle('is-off', off);
    $('contract3Set').disabled = !p3Fund;
    $('contract3Set').classList.toggle('d-none', !p3Fund);
    // Pealkiri II valikule ainult siis, kui mõlemad valikud on näha.
    $('contractLegend').className = !lockMsg && p3Fund ? 'form-label' : 'visually-hidden';
    $('h7').textContent = (input.fundFrom && p2Grows) || (input.fundFrom3 && p3Grows)
      ? 'Fondipension algab: mis lepinguga?'
      : off ? 'Pensionipõlv: kuidas raha kestab?' : 'Pensionipõlv: kuidas fondipension kestab?';
  }

  function renderPotBar(input) {
    const pa = P.retirementYears(input);
    const p1 = input.p1Monthly * (1 + P.DEFERRAL_INCREASE[input.deferral] + P.DEFERRAL_INCREASE[input.half || 0] / 2);
    // Sambad ja hoius pensionile minnes sama arvutusega mis tulemus: korraga välja võetud raha (pensioniea − 5, III 55 a, II varem)
    // on hoiusel, mitte sammastes.
    const sim = P.simulate(input, T, scenarioFor(input)), at = sim.rows.find((x) => x.age === retAge(input)) || sim.rows[0];
    const items = [
      ['🏦', eur(at.pot), 'sammastes ' + at.age + '-aastaselt'],
      // Eripensioniga: pensionieas makstakse suurem kahest (pension.js).
      input.spMonthly > input.p1Monthly ? ['🏛️', eur(input.spMonthly) + ' /kuus', 'eripension (enne tulumaksu, suurem kahest)'] : ['🏛️', eur(p1) + ' /kuus', 'riiklik pension (enne tulumaksu)' + (input.spMonthly > 0 ? ', suurem kahest' : '')],
    ].concat(at.deposit >= 1 ? [['🐷', eur(at.deposit), 'hoiusel (sambast välja võetud, pärast tulumaksu)']] : []).concat([
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
    // „?“ selgitus sinu numbritega: kust „elu lõpuni“ summa ja vanus tulevad.
    const p1Row = r.rows.find((x) => x.i1g > 0.5);
    ABI.sustainable = { title: 'Kuidas see summa tekib?', html:
      '<p><strong>' + eur(r.sustainable) + ' kuus</strong> on suurim kuukulu, mille juures sinu raha jätkub ' + r.horizonAge + '. eluaastani. Arvutame selle sinu valikutega:</p>' +
      '<ul>' + (p1Row ? '<li>riiklik pension ' + eur(p1Row.i1g) + ' kuus enne tulumaksu, alates ' + p1Row.age + '-aastaselt;</li>' : '') +
      '<li>sammastes u ' + eur(potAtPension(input, input.realReturn)) + ' pensionile minnes; raha kasvab valitud tootlusega;</li>' +
      '<li>väljamaksetelt arvestame tulumaksu ja sinu valitud väljamakse viisi (fondipension, korraga või kasvatan edasi).</li></ul>' +
      '<p><strong>Miks ' + r.horizonAge + '?</strong> „Elu lõpuni“ on vanus, milleni jõuab elusana 10% sinuvanustest (Statistikaameti elutabel). Plaan peab kandma ka siis, kui elad keskmisest kauem.</p>' +
      '<p class="mb-0">Sinu kulud on ' + eur(input.needMonthly) + ' kuus. Kui kulud on sellest summast väiksemad, jääb raha üle; kui suuremad, saab samba raha varem otsa.</p>' };
    parts.push('<strong>Elu lõpuni</strong> (' + r.horizonAge + '. eluaastani) kannab see plaan kuni <strong>' + eur(r.sustainable) + ' kuus</strong>.\u2060' + helpBtn('sustainable'));
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
      if (input.p3Has && input.p3CalcPlan !== 'keep') tips.push(['iii', 'Jäta III sammas kasvama.',
        (input.p3Use === 'spend'
          ? 'Kui kulutad III samba raha ' + input.p3CalcAge + '-aastaselt ära, pole seda pensionil.'
          : 'Hoiusel seisev raha kaotab väärtust (arvutuses −1% aastas pärast inflatsiooni), fondis kasvab sinu valitud tootlusega (' + pct(input.realReturn3) + ' aastas).') +
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
      '<p class="text-secondary">Kui elad keskmiselt kaua (' + median + '-aastaseks, pooled sinuvanustest elavad kauem), on samba ja hoiuse raha alles umbes <strong>' + eur(left) + '</strong>.\u2060' + helpBtn('legacyLeft') + '</p>' +
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

  function renderRecap(input, scenario, rules) {
    const pa = P.retirementYears(input);
    const lep = (c) => (c === 'yearly' ? 'uue lepinguga igal aastal' : 'ühe lepinguga');
    const items = [
      [0, '🙂', ['Sündinud ' + input.birthYear, input.p2Has || input.p2Gone ? 'II sammas ' + eur(input.p2) : '', input.p3Has ? 'III sammas ' + eur(input.p3Base) : '', input.spMonthly > 0 ? 'eripension ' + eur(input.spMonthly) + ' kuus' : ''].filter(Boolean).join(', ')],
      [3, '💸', [input.p2Early ? 'Võtan II samba ' + input.p2Early.age + '-aastaselt korraga välja (22% tulumaks)' + (input.p2Early.rejoin ? ', liitun uuesti ' + (input.p2Early.age + 5) + '-aastaselt' : ', uuesti ei liitu') : '',
        input.p3EarlyAge !== undefined ? 'Võtan III samba ' + input.p3EarlyAge + '-aastaselt korraga välja (22% tulumaks): ' + eur(input.p3Net) : ''].filter(Boolean).join('. ') || 'Ei võta enne pensioniiga midagi välja'],
      [4, '🔓', !input.p3Has ? 'III sammast ei ole' : input.p3Plan === 'keep' ? 'III sammas jääb kasvama' : (input.p3Plan === 'lump' ? 'Võtan III samba ' + input.p3Age + '-aastaselt korraga välja: ' + eur(input.p3Net) : 'Fondipension III sambast alates ' + input.p3Age + '-aastaselt: ' + eur(input.p3Net)) + (input.p3Plan === 'keep' ? '' : input.p3Use === 'save' ? ', hoiusele' : ', kasutan kohe')],
      // Sammast, mida pole (summa ja sissemakse 0), kokkuvõttes ei mainita.
      [5, '🧳', [input.p2Has ? 'II sammas: ' + { grow: 'jätkan kasvatamist', lump: 'võtan korraga välja', fund: 'fondipension' }[input.payout] : '',
        input.p3Has && input.p3Plan === 'keep' ? 'III sammas: ' + { grow: 'jätkan kasvatamist', lump: 'võtan ' + (pa - 5) + '-aastaselt korraga välja', fund: 'fondipension alates ' + (pa - 5) + ' a' }[input.p3At60] : ''].filter(Boolean).join('. ')],
      [6, '🏛️', (input.p2Has && input.payout === 'grow' ? 'Pensionieas II sammas: ' + { grow: 'kasvatan edasi', lump: 'võtan korraga välja', fund: 'fondipension' }[input.method] + '. ' : '') +
        (input.p3Has && input.p3Plan === 'keep' && input.p3At60 === 'grow' ? 'III sammas: ' + { grow: 'kasvatan edasi', lump: 'võtan korraga välja', fund: 'fondipension' }[input.p3pa] + '. ' : '') + (input.half ? 'Pool riiklikku pensioni ' + retAge(input) + '-aastaselt, täis ' + (retAge(input) + input.half) + '-aastaselt' : !input.deferral ? 'Riiklik pension ' + retAge(input) + '-aastaselt' + (input.soodus > 0 ? ' (soodustingimustel ' + input.soodus + ' a varem)' + (!input.workOn && input.p3After !== undefined ? ', III samba sissemakse ' + eur(input.p3After) + ' kuus' : '') : '') : 'Riiklik pension ' + (pa + input.deferral) + '-aastaselt (' + input.deferral + ' a hiljem)') +
        (input.workOn ? ', töötan kuni ' + (input.workUntil !== undefined ? input.workUntil : input.soodus > 0 ? P.retirementYears(input) : retAge(input) + 1) + '-aastaseni' : '')],
      [7, '🌳', [input.fundFrom && input.p2Has && input.method === 'grow' ? (input.fundFrom3 ? 'II samba fondipension' : 'Fondipension') + ' alates ' + input.fundFrom + '-aastaselt' : '',
        input.fundFrom3 && input.p3Sep && input.p3Sep.start === input.fundFrom3 ? 'III samba fondipension alates ' + input.fundFrom3 + '-aastaselt' : '', input.p2Has ? 'Väljamakse viis: ' + scenario.name.toLowerCase() + (scenario.id === 'C' ? ', fondipension ' + lep(input.contract) : '') : '',
        input.p3Sep && input.p3Sep.mode === 'fund' ? 'III samba fondipension ' + lep(input.contract3) : ''].filter(Boolean).join('. ')],
      [8, '🛒', input.pkg.name + (input.edited ? ' (muudetud)' : '') + ': ' + eur(input.needMonthly) + ' kuus'],
    ];
    // Iga „Muuda“ nupu ekraanilugeja nimi ütleb, mida see muudab (WCAG 2.4.4).
    const RECAP_WHAT = { 0: 'sinu andmeid', 3: 'samba raha varem välja võtmise valikut', 4: 'III samba valikut 55-aastaselt', 5: 'II ja III samba valikut ' + (pa - 5) + '-aastaselt',
      6: 'riikliku pensioni ja samba raha valikut pensionieas', 7: 'pensionipõlve valikut', 8: 'kulupaketti', 9: 'eripensioni valikut' };
    // Tühjad read (nt sammast pole) ja vahele jäetud sammud jäävad välja; 55 a rida ainult siis, kui III sammas on.
    if (input.spMonthly > 0) items.splice(1, 0, [SP_STEP, '🛡️', 'Eripension ' + P.specialStart(input) + '-aastaselt' + (P.specialStart(input) < P.retirementYears(input) ? (input.spWork ? ', töötan edasi muul kutsealal' + (input.spGross !== undefined ? ', uus palk ' + eur(input.spGross) : '') : ', ei tööta') : '')]);
    // Read: pealkiri + praegune valik. „Muuda“ avab rea alla sama sammu valikukaardid (tõstetakse DOM-is ümber, vt resPanels).
    const TITLE = { 3: 'Raha välja enne pensioniiga', 4: 'III sammas ' + input.p3Age + '-aastaselt', 5: (input.p2Has && input.p3Has ? 'II ja III sammas ' : input.p3Has ? 'III sammas ' : 'II sammas ') + (pa - 5) + '-aastaselt', 6: $('h6').textContent,
      7: 'Pensionipõlv', 8: 'Kulud pensionil', 9: 'Eripension' };
    const rows = items.filter((x) => !skipped(x[0]) && x[2] && !(x[0] === 4 && !input.p3Has))
      .map((x) => ({ key: String(x[0]), ico: x[1], title: TITLE[x[0]], now: x[2], what: RECAP_WHAT[x[0]] || chapters[x[0]].dataset.label }));
    rows[0] = Object.assign(rows[0], { title: 'Sinu andmed' });
    const fundNow = (k) => FUNDS[k].name.replace(/ \(.*\)$/, '') + ', ' + pct(FUNDS[k].r) + ' aastas pärast inflatsiooni';
    const fundRows = [];
    if (input.p2Has) fundRows.push({ key: 'fund2', ico: '📈', title: 'II samba tootlus', now: fundNow(input.fund18), what: 'II samba tootlust' });
    if (input.p3Has) fundRows.push({ key: 'fund3', ico: '📈', title: 'III samba tootlus', now: fundNow(input.fund3), what: 'III samba tootlust' });
    rows.splice(1, 0, ...fundRows);
    // Rea vanus = sammu (otsuse) vanus; otsuste kaardi reeglid lähevad oma rea juurde, ülejäänud reeglid on inforead.
    const ROW_AGE = { 3: input.currentAge, 4: input.p3Age, 5: pa - 5, 6: retAge(input), 7: firstFund(input) || retAge(input) + 1, 9: input.spHas ? P.specialStart(input) : null };
    rows.forEach((r) => { const ag = ROW_AGE[r.key]; if (ag !== undefined && ag !== null) { r.age = ag; r.year = input.birthYear + ag; } });
    rules.forEach((rl) => {
      const row = rows.find((r) => r.key === rl.key);
      if (row) (row.rules = row.rules || []).push(rl);
      else rows.push({ key: 'i' + rows.length, info: true, title: rl.title, now: rl.choice || '', age: rl.age, year: rl.year, rules: [Object.assign({}, rl, { title: '' })] });
    });
    drawResRows(rows);
  }

  // Otsuste kaart: reeglid ja maksud (Pensionikeskus, SKA 2026) koos kasutaja valikuga.
  function renderMap(input, scenario) {
    const pa = P.retirementYears(input), m = input.paMonths, by = input.birthYear;
    const when = (y, mm) => ageAt(y, mm) + ' · ' + (by + y);
    // Sammast, mida sul pole (summa ja sissemakse 0), kaardil ei mainita.
    const items = [];
    const early = [input.p2Has ? 'II samba raha saab enne pensioniiga välja võtta 22% tulumaksuga, ainult ühe korra (KoPS § 43¹, alates 01.11.2026). Siis lõpevad sissemaksed ja uuesti saab liituda 5 aasta pärast (varem 10). Alates 2028. a saab välja võtta ka osa rahast.' : '',
      input.p3Has ? 'III sammas enne soodusiga: 22%. III samba sissemaksetelt saad 22% tulumaksu tagasi (kuni 15% brutotulust, kuni 6000 € aastas).' : ''].filter(Boolean).join(' ');
    if (early) items.push([when(input.currentAge, 0).replace(/-aastaselt/, '-aastaselt, täna'), 'Igal ajal enne pensioniiga', early, null]);
    if (input.p3Has) items.push([when(input.p3Open, 0), 'III sammas soodusmaksuga',
      'Korraga või lühem väljamakse 10%, eluaegne või elada jäänud aastate pikkune väljamakse (fondipension) 0%. Tingimus: kogumist on vähemalt 5 aastat. ' +
      (input.p3Before2021 ? 'Alates 55, sest liitusid enne 2021. a.' : 'Alates 60, sest liitusid 2021. a või hiljem.'),
      { keep: 'Jätan kasvama', lump: 'Võtan korraga välja', fund: 'Fondipension' }[input.p3Plan]]);
    items.push([when(pa - 5, m), input.p2Has ? 'II sammas ja paindlik riiklik pension' : 'Paindlik riiklik pension',
      (input.p2Has ? 'II sammas: korraga 10%, fondipension soovitusliku perioodi peale (vähemalt 4 makset aastas) 0%, lühem periood 10%. Kui hakkad raha välja võtma, lõpevad II samba sissemaksed. ' : '') +
      'Riiklikku pensioni saab võtta kuni 5 aastat varem, eluks ajaks väiksemana: −7,17% (1 a), −13,78% (2 a), −19,88% (3 a), −25,50% (4 a), −30,67% (5 a). Selleks on vaja 20–40 aastat staaži.',
      input.p2Has ? { grow: 'Jätkan kasvatamist', lump: 'Võtan korraga välja', fund: 'Fondipension' }[input.payout] : null]);
    // Laste pensionilisa (vanaduspensionile, kasutab üks vanem): arvestatud ainult siis, kui prognoos seda ei sisalda.
    const supM = P.childSupplement(input);
    if (supM > 0) items.push([when(pa - (input.soodus || 0), 0), 'Laste pensionilisa',
      '1981.–2012. a sündinud lapse eest 3,5 aastahinnet, enne 1981. a sündinud lapse eest 1,5 aastahinnet ja 2 a staaži; 2013+ sündinud lapse eest maksab riik II sambasse. Eripensionile lisa ei lisata. SKA määrab lisa avalduse alusel.',
      '+' + eur(supM) + ' kuus' + (input.kids.inForecast === 'no' ? '' : input.kids.inForecast === 'yes' ? ' (prognoosis juba sees)' : ' (ei arvestatud: ei tea, kas prognoosis on)')]);
    if (input.flexEarly > 0) items.push([when(pa - input.soodus, 0), 'Paindlik pension varem', 'Pensionile ' + input.soodus + ' aastat enne tavalist pensioniiga. Riiklikku pensioni vähendatakse eluks ajaks ' + pctTxt(P.EARLY_DECREASE[input.flexEarly]) + '.']);
    else if (input.soodus > 0) items.push([when(pa - input.soodus, 0), 'Soodustingimustel vanaduspension', 'Pensionile saab minna ' + input.soodus + ' aastat enne tavalist pensioniiga (' + (P.earlyYears({ kids: input.kids }) >= P.earlyYears({ kids: {}, hazard: input.hazard, hazardYears: input.hazardYears }) ? 'lapsed' : 'tervist kahjustav töö') + ') ja riiklikku pensioni ei vähendata. Sinu pensioniiga on ' + pa + ' a. Kontrolli oma õigust SKA lehelt.', input.soodus + ' a varem']);
    if (input.spMonthly > 0) items.push([when(P.specialStart(input), 0), 'Eripension', 'Eripension (politsei, kaitsevägi, kohtunik, Riigikogu jt) on riiklik pension (I sammas). Kahte riiklikku pensioni korraga ei maksta: pensionieas valid ühe, eripensioni või vanaduspensioni, tavaliselt suurema (SKA kontrollib seda sinu soovil). Eripensioni ei saa edasi lükata, varem võtta ega peatada. II ja III samba vanusepiirid on samad mis kõigil. Uutele teenistujatele (politsei, kaitsevägi, prokurörid alates 2020. a) enam ei teki. Kontrolli oma õigust SKA lehelt.', eur(input.spMonthly) + ' kuus enne maksu' + (input.spStartAge !== undefined ? ', alates ' + input.spStartAge + '-aastaselt' : '')]);
    items.push([when(pa, m), 'Riiklik pension täissummas (' + ageTxt(pa, m) + ')',
      'Vähemalt 15 aastat Eesti staaži. Pensionieas on maksuvaba tulu 776 € kuus (2026. a), sellest suuremalt osalt on tulumaks 22%. ' +
      'Kuni 1998. a andis iga tööaasta sama palju, alates 2021. a tuleb pool pensioni kasvust palga järgi ja pool kõigile võrdselt; II sambaga liitunul on riiklik pension väiksem, sest 4% palgast läheb II sambasse. ' + (input.p2Has || input.p3Has ? 'Kindlustusseltsi eluaegne pension on maksuvaba. ' : '') +
      (by + 65 >= 2029 ? 'Pensioniiga on seotud oodatava elueaga ja pärast 2028. a ei ole see veel kehtestatud, seega see on ligikaudne.' : ''),
      input.p2Has && input.payout === 'grow' ? { grow: 'Kasvatan edasi', lump: 'Kõik korraga', fund: 'Fondipension' }[input.method] : null]);
    const p2F = input.p2Has && input.method === 'fund', p3F = !!(input.p3Sep && input.p3Sep.mode === 'fund');
    const lepTxt = (c) => (c === 'yearly' ? 'Uus leping igal aastal' : 'Üks leping');
    if (p2F || p3F) items.push([when(pa, m), 'Fondipensioni leping: üks kord või igal aastal uuesti',
      (p2F && p3F ? 'II ja III samba fondipension on eraldi lepingud. ' : '') + 'Ühe lepinguga lõpeb väljamakse perioodi lõpus. Kui sõlmid lepingu igal aastal uuesti vähemalt soovitusliku perioodiga, jääb see maksuvabaks ega saa otsa, aga väga kõrges eas on kuumakse väiksem.',
      [p2F ? (p3F ? 'II: ' : '') + lepTxt(input.contract) : '', p3F ? (p2F ? 'III: ' : 'III sammas: ') + lepTxt(input.contract3) : ''].filter(Boolean).join(', ')]);
    const deferOpt = P.options(input).deferral;
    items.push([when(pa + 1, m) + '…' + (by + pa + 5), 'Riikliku pensioni edasilükkamine',
      'Iga edasilükatud aasta tõstab riiklikku pensioni eluks ajaks: +7,93% (1 a), +16,88% (2 a), +27,01% (3 a), +38,50% (4 a), +51,57% (5 a), 2026. a keskmised. Kui võtad pool pensioni, tõuseb pension pool sellest. ' +
        'Elukaar arvestab edasilükkamist ja poolt pensioni täisaastates alates pensionile minekust. Edasilükatud aastatel tõstab pensioni ka töö (staaž), kui valid „Töötan edasi“; SKA paindliku pensioni arvutus eeldab, et töötad edasi. Kui saad riiklikku pensioni juba, saad selle ka peatada ja hiljem uuesti alustada; seda Elukaar ei arvesta. Küsi SKA-lt, kui palju sinu pension siis tõuseb.' + (deferOpt.open ? '' : ' ' + deferOpt.reason),
      !deferOpt.open ? 'Ei kehti' : input.deferral ? 'Lükkan ' + input.deferral + ' aastat edasi: ' + eur(input.p1Monthly * (1 + P.DEFERRAL_INCREASE[input.deferral])) + ' kuus'
        : input.half ? 'Pool ' + input.half + ' aastat: ' + eur(input.p1Monthly / 2) + ', siis ' + eur(input.p1Monthly * (1 + P.DEFERRAL_INCREASE[input.half] / 2)) + ' kuus' : 'Võtan kohe']);
    const pillars = input.p2Has && input.p3Has ? 'II ja III samba' : input.p2Has ? 'II samba' : input.p3Has ? 'III samba' : '';
    const legacy = legacyChoice ? { heirs: 'Pärandan lähedastele', donate: 'Annetan', spend: 'Kulutan ise rohkem', care: 'Puhver hoolduseks' }[legacyChoice] : null;
    if (pillars || legacy) items.push(['Elu lõpus', 'Pärimine',
      pillars ? pillars + ' fondis olev raha (ka fondipension) läheb pärijatele. ' + (input.p2Has ? 'Kui pärija võtab II samba osakud rahana välja, on maks 22%. ' : '') +
        'Eluaegne kindlustuspension pärandada ei saa (v.a garantiiperiood).' : 'Pärijatele läheb hoiusel ja muus varas olev raha.',
      legacy]);
    // Iga reegel läheb oma sammu rea juurde (Sinu otsused); rida, mida pole, saab reeglist oma inforea.
    const KEY = (t) => (t === 'Igal ajal enne pensioniiga' ? '3' : t === 'III sammas soodusmaksuga' ? '4' : /^(II sammas ja paindlik|Paindlik riiklik pension$)/.test(t) ? '5'
      : /^(Riiklik pension täissummas|Riikliku pensioni edasilükkamine)/.test(t) ? '6' : /^Fondipensioni leping/.test(t) ? '7' : t === 'Eripension' ? SP_STEP + '' : null);
    return items.map((x) => {
      const yr = parseInt((x[0].match(/· (\d{4})/) || [])[1], 10), age = parseInt(x[0], 10);
      return { key: KEY(x[1]), when: x[0], age: isNaN(age) ? null : age, year: isNaN(yr) ? null : yr, title: x[1], text: x[2], choice: x[3] };
    });
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
    // Tuleviku hindades kasvab ka maksuvaba tulu (mudel eeldab, et see püsib tänastes eurodes samana).
    const kf = (x) => (r.nominal ? Math.pow(1 + INFLATION, x.year - P.CURRENT_YEAR) : 1);
    const pa = r.pensionStartAge, start = r.rows.find((x) => x.age === pa) || r.rows[0];
    const src = [start.i1 > 0.5 || !(start.isp > 0.5) ? eur(start.i1) + ' riiklikku pensioni (pärast tulumaksu)' : '', start.isp > 0.5 ? eur(start.isp) + ' eripensioni (pärast tulumaksu)' : '', start.i2 > 0.5 ? eur(start.i2) + ' II sambast' : '', start.i3 > 0.5 ? eur(start.i3) + ' III sambast' : '', start.dep > 0.5 ? eur(start.dep) + ' hoiuselt' : ''].filter(Boolean);
    const parts = ['Pensioni alguses (' + pa + '-aastaselt) tuleb kuus ' + (src.length > 1 ? src.slice(0, -1).join(', ') + ' ja ' + src[src.length - 1] : src[0]) + '.',
      'Sinu kulud on ' + eur(input.needMonthly) + ' kuus' + (r.nominal && start.needM ? ' tänastes hindades, ' + pa + '-aastaselt tuleviku hindades ' + eur(start.needM) : '') + '.'];
    // Tulumaks riiklikult pensionilt: 22% summalt, mis ületab pensionäri maksuvaba tulu (776 € kuus, 2026).
    const p1row = r.rows.find((x) => x.i1g > 0.5);
    if (p1row) parts.splice(1, 0, p1row.tax1 > 0.5
      ? 'Riiklikust pensionist (' + eur(p1row.i1g) + ' enne maksu) läheb tulumaksuks ' + eur(p1row.tax1) + ' kuus: 22% summalt, mis ületab pensionäri maksuvaba tulu ' + eur(P.PENSIONER_ALLOWANCE / 12 * kf(p1row)) + ' kuus.'
      : 'Riiklik pension on väiksem kui pensionäri maksuvaba tulu (' + eur(P.PENSIONER_ALLOWANCE / 12 * kf(p1row)) + ' kuus), seega tulumaksu pole.');
    // Eripension: pensionieas makstakse suurem kahest (pension.js firstPillar).
    const fp = r.firstPillar;
    if (fp) parts.splice(1, 0, 'Pensionieas makstakse sulle ' + (fp.paid === 'special' ? 'eripensioni ' + eur(fp.special) : 'vanaduspensioni ' + eur(fp.oldAge)) + ' kuus enne maksu: suurem kahest (eripension ' + eur(fp.special) + ', vanaduspension ' + eur(fp.oldAge) + '). Kahte riiklikku pensioni korraga ei maksta. SKA kontrollib selle sinu soovil.');
    const spPaRow = r.rows.find((x) => x.age >= pa && x.ispg > 0.5);
    if (spPaRow) parts.splice(2, 0, spPaRow.taxSp > 0.5
      ? 'Eripensionist läheb tulumaksuks ' + eur(spPaRow.taxSp) + ' kuus: 22% summalt, mis ületab pensionäri maksuvaba tulu ' + eur(P.PENSIONER_ALLOWANCE / 12 * kf(spPaRow)) + ' kuus.'
      : 'Eripension on väiksem kui pensionäri maksuvaba tulu, seega tulumaksu pole.');
    // Töötamine soodustusega pensioni ajal: palk katab kulud, pension kogub hoiusele.
    const workRows = r.rows.filter((x) => x.work);
    if (workRows.length) parts.splice(1, 0, 'Kuni ' + (workRows[workRows.length - 1].age + 1) + '-aastaseni töötad: palk katab kulud, riiklik pension kogub hoiusele ja iga tööaasta tõstab pensioni.');
    // Sild (riiklik pension hiljem): kuni riikliku pensioni alguseni elad sammastest.
    const bridge = r.rows.filter((x) => x.age >= r.pensionStartAge && x.age < r.p1StartAge);
    if (bridge.length) {
      const avg = (k) => bridge.reduce((t, x) => t + x[k], 0) / bridge.length;
      parts.splice(1, 0, 'Kuni ' + r.p1StartAge + '-aastaseni elad sammastest: fondipension keskmiselt ' + eur(avg('fp')) + ' kuus' +
        (avg('extra') > 0.5 ? ' ja lisaväljamakse ' + eur(avg('extra')) + ' kuus (10% tulumaks)' : '') + (avg('dep') > 0.5 ? ', hoiuselt ' + eur(avg('dep')) + ' kuus' : '') + '.');
    }
    if (r.coversNeedUntil === null) parts.push('Kulud on kaetud kuni 100. eluaastani.');
    else parts.push('Kulud on kaetud kuni ' + r.coversNeedUntil + '. eluaastani.');
    if (r.moneyEndAge !== null) parts.push('Samba ja hoiuse raha lõpeb ' + r.moneyEndAge + '-aastaselt, siis jääb ainult ' + (r.firstPillar && r.firstPillar.paid === 'special' ? 'eripension ' : 'riiklik pension ') + eur(r.incomeAfterMoney) + ' kuus.');
    return parts;
  }
  function chartTable(r, input) {
    const firstPre = r.rows.find((x) => x.pre);
    const rows = r.rows.filter((x) => x.age >= (firstPre ? firstPre.age : r.pensionStartAge));
    const hasSp = rows.some((x) => x.isp > 0.5);
    return '<table class="table table-sm align-middle mb-0"><caption id="chartTableCaption">Sissetulek ja kulud kuus vanuse järgi (tänastes eurodes, pärast tulumaksu)</caption>' +
      '<thead><tr><th scope="col">Vanus</th><th scope="col">Aasta</th><th scope="col" class="text-end">I sammas</th>' + (hasSp ? '<th scope="col" class="text-end">Eripension</th>' : '') + '<th scope="col" class="text-end">II sammas</th><th scope="col" class="text-end">III sammas</th><th scope="col" class="text-end">Hoiuselt</th><th scope="col" class="text-end">Kulud</th><th scope="col" class="text-end">Puudu</th><th scope="col" class="text-end">Elus</th></tr></thead><tbody>' +
      rows.map((x) => '<tr><th scope="row">' + x.age + '</th><td>' + x.year + '</td><td class="text-end">' + eur(x.i1) + '</td>' + (hasSp ? '<td class="text-end">' + eur(x.isp) + '</td>' : '') + '<td class="text-end">' + eur(x.i2) + '</td><td class="text-end">' + eur(x.i3) + '</td><td class="text-end">' + eur(x.dep) +
        '</td><td class="text-end">' + (x.pre ? '–' : eur(input.needMonthly)) + '</td><td class="text-end">' + (x.shortfall > 0.5 ? eur(x.shortfall) : '–') + '</td><td class="text-end">' + Math.round(x.alive * 100) + '%</td></tr>').join('') +
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
  function chartExplain(r, input, mobile, scenario) {
    // Kirjutatud nii, et graafiku sisu on arusaadav ka ilma seda nägemata (ekraanilugeja).
    const pa = r.pensionStartAge, need = input.needMonthly;
    const rows = r.rows.filter((x) => x.age >= pa);
    const ageOf = (a) => a + '-aastaselt';
    const alive = (a) => { const x = rows.find((y) => y.age === a); return x ? Math.round(x.alive * 100) : null; };
    // Etapid: järjestikused aastad, kus kulude katmise allikad on samad.
    const key = (x) => [x.i1 > 0.5, x.isp > 0.5, x.i2 > 0.5, x.i3 > 0.5, x.dep > 0.5, x.shortfall > 0.5].map(Number).join('');
    const phases = [];
    rows.forEach((x) => {
      const last = phases[phases.length - 1];
      if (last && last.k === key(x)) { last.to = x.age; last.rows.push(x); }
      else phases.push({ k: key(x), from: x.age, to: x.age, rows: [x] });
    });
    const avg = (ph, f) => ph.rows.reduce((s, x) => s + x[f], 0) / ph.rows.length;
    const surplus = (ph) => ph.rows.reduce((s, x) => s + Math.max(0, x.i1 + x.isp + x.i23 - x.spend), 0) / ph.rows.length;
    const parts = (ph) => [
      avg(ph, 'i1') > 0.5 ? 'riiklik pension ' + eur(avg(ph, 'i1')) : '',
      avg(ph, 'isp') > 0.5 ? 'eripension ' + eur(avg(ph, 'isp')) : '',
      avg(ph, 'i2') > 0.5 ? 'II sammas ' + eur(avg(ph, 'i2')) : '',
      avg(ph, 'i3') > 0.5 ? 'III sammas ' + eur(avg(ph, 'i3')) : '',
      avg(ph, 'dep') > 0.5 ? 'hoiuselt ' + eur(avg(ph, 'dep')) : '',
    ].filter(Boolean);
    // Miks etapp muutus (võrreldes eelmisega).
    const why = (prev, ph) => {
      const had = (p, f) => avg(p, f) > 0.5;
      const out = [];
      if (!had(prev, 'i1') && had(ph, 'i1')) out.push('algab riiklik pension');
      if (!had(prev, 'isp') && had(ph, 'isp')) out.push('algab eripension');
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
    // Enne pensioniiga: III samba väljavõtt 55-aastaselt (fondipension või korraga).
    const pre = r.rows.filter((x) => x.pre);
    const preItems = [];
    if (pre.length) preItems.push('<li><strong>' + pre[0].age + '–' + pre[pre.length - 1].age + ' a (enne pensioniiga):</strong> III samba fondipension keskmiselt ' +
      eur(pre.reduce((s, x) => s + x.i3, 0) / pre.length) + ' kuus pärast maksu. See on lisaraha palgale. Ülejäänud III samba raha kasvab edasi.</li>');
    else if (input.p3Has && input.p3CalcPlan === 'lump') preItems.push('<li><strong>' + input.p3CalcAge + ' a:</strong> võtad III samba korraga välja, ' + eur(input.p3Net) + ' pärast maksu. Pensioniks seda ei jää.</li>');
    const items = preItems.concat(phases.map((ph, n) => {
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
    }));
    // Fondipensioni makse = osakud × hind (KoPS § 52³ lg 8, § 60¹ lg 5), seega muutub see koos fondi väärtusega.
    const fundNote = (scenario && ['B', 'C', 'D'].includes(scenario.id)) || (input.p3Sep && input.p3Sep.mode === 'fund') || r.rows.some((x) => x.pre && x.i3 > 0.5)
      ? '<li>Fondipensioni makse ei sõltu sinu kuludest: fondi summa jagatakse veel tegemata maksete arvuga (KoPS § 60¹ lg 5), seega muutub see koos fondi väärtusega. Joonis eeldab ühtlast tootlust. ' +
        'Kui makse on suurem kui kulud, läheb ülejääk hoiusele, kus see kaotab väärtust (−1% aastas pärast inflatsiooni), ja seda kasutad hiljem (triibuline osa). Kui ülejääk on suur, võib olla parem jätta raha fondi kasvama („Kasvatan edasi“).</li>' : '';
    const kind = mobile ? 'Kihid' : 'Tulbad';
    const look = '<ul class="mb-0">' +
      '<li>' + kind + ' näitavad iga vanuse kohta, millest kulud kaetakse: ' +
        [rows.some((x) => x.i1 > 0.5) ? 'tumesinine on riiklik pension (pärast tulumaksu)' : '', rows.some((x) => x.isp > 0.5) ? 'kollane eripension (pärast tulumaksu)' : '', rows.some((x) => x.i2 > 0.5) ? 'sinine II sammas' : '', rows.some((x) => x.i3 > 0.5) ? 'täpiline III sammas' : '', rows.some((x) => x.dep > 0.5) ? 'triibuline hoiuselt' : ''].filter(Boolean).join(', ') + '.</li>' +
      '<li>Punane katkendjoon on sinu kulud kuus. Kui ' + kind.toLowerCase() + ' jäävad joonest allapoole, on raha puudu.</li>' +
      '<li>Hall joon näitab, mitu protsenti sinuvanustest on veel elus' + (mobile ? ' (täpse protsendi näed graafikut puudutades).' : ' (parem telg).') + '</li>' + fundNote + '</ul>';
    return '<p class="mb-2">' + lead + '</p>' +
      '<p class="mb-1 fw-medium">Mis eri vanustes juhtub</p><ul class="mb-3">' + items.join('') + '</ul>' +
      '<p class="mb-1 fw-medium">Kuidas graafik välja näeb</p>' + look;
  }

  // Tuleviku hinnad (lüliti tulemuses): sama tulemus, aga summad nominaalsetes eurodes, nagu need tulevikus kontol paistavad.
  // Ostujõud ei muutu: iga aasta summa korrutatakse hinnatõusuga (1 + INFLATION)^(aasta − täna). Eeldus [inferred]: EKP sihtmäär 2%.
  const INFLATION = 0.02;
  let nominal = false;
  const MONEY = ['i1', 'i1g', 'tax1', 'isp', 'ispg', 'taxSp', 'i23', 'i2', 'i3', 'dep', 'spend', 'shortfall', 'moneyLeft', 'fp', 'extra'];
  function toNominal(r) {
    const k = (x) => Math.pow(1 + INFLATION, x.year - P.CURRENT_YEAR);
    const rows = r.rows.map((x) => { const y = Object.assign({}, x, { needM: (lastInput || readInput()).needMonthly * k(x) }); MONEY.forEach((m) => { if (typeof y[m] === 'number') y[m] = x[m] * k(x); }); return y; });
    return Object.assign({}, r, { rows: rows, nominal: true });
  }

  function renderChart(r, input, scenario) {
    const mobile = isMobile();
    $('chartExplain').innerHTML = chartExplain(r, input, mobile, scenario);
    // Mobiilis: kihiline pindgraafik pensioniea algusest (tulpade asemel), elus-% ilma eraldi teljeta.
    const rows = mobile ? r.rows.filter((x) => x.age >= r.pensionStartAge || x.pre) : r.rows;
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
        Object.assign({ type: 'bar', label: 'Hoiuselt (välja makstud, kulutamata raha)', data: rows.map((x) => Math.round(x.dep)), backgroundColor: stripes('#9fd8f0', '#002f63'), borderColor: '#002f63', borderWidth: 1, stack: 'income', yAxisID: 'y', order: 3 }, area('-1')),
        // Joonte valge „halo“ (laiem valge joon all), et jooned paistaksid ka tumedate tulpade peal. Legendis ja vihjes ei näidata.
        { type: 'line', label: '_halo', data: rows.map((x) => (x.age >= r.pensionStartAge ? (x.needM !== undefined ? x.needM : input.needMonthly) : null)), borderColor: '#fff', borderWidth: 6, pointRadius: 0, stack: 'needHalo', yAxisID: 'y', order: 2, halo: true },
        { type: 'line', label: '_halo', data: rows.map((x) => Math.round(x.alive * 100)), borderColor: '#fff', borderWidth: 6, pointRadius: 0, tension: 0.3, yAxisID: 'y1', order: 2, halo: true },
        { type: 'line', label: 'Kulud', data: rows.map((x) => (x.age >= r.pensionStartAge ? (x.needM !== undefined ? x.needM : input.needMonthly) : null)) /* kulud alates pensionieast */, borderColor: '#db2200', borderDash: [6, 4], borderWidth: 2.5, pointRadius: 0, stack: 'need', yAxisID: 'y', order: 1 },
        { type: 'line', label: mobile ? 'Elus (%)' : 'Elus (%, paremal teljel)', data: rows.map((x) => Math.round(x.alive * 100)), borderColor: '#8a8d91', backgroundColor: '#fff', borderWidth: 2.5, order: 1, tension: 0.3, yAxisID: 'y1',
          pointRadius: rows.map((x) => (!mobile && x.age % 5 === 0 ? 3.5 : 0)), pointBorderWidth: 2, pointStyle: 'circle' },
      ],
    };
    // Eripension tuleb graafikule ainult siis, kui see on olemas (I samba järel, kollane).
    if (rows.some((x) => x.isp > 0.5)) data.datasets.splice(1, 0, Object.assign({ type: 'bar', label: 'Eripension', data: rows.map((x) => Math.round(x.isp)), backgroundColor: '#f2b14c', borderColor: '#002f63', borderWidth: 1, stack: 'income', yAxisID: 'y', order: 3 }, area('-1')));
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
    // Paindlik pension (C) võrdluses ainult siis, kui edasilükkamine on lubatud (eripensioniga ei ole).
    const defs = SCEN.filter((s) => s.id !== 'C' || P.options(input).deferral.open)
      .map((s) => (s.id === 'C' ? Object.assign({}, s, { deferral: input.deferral || 2 }) : s)).concat([GROW]);
    const results = defs.map((s) => Object.assign(P.simulate(input, T, s), { sustainable: P.sustainableNeed(input, T, s) }));
    const mine = Object.assign(P.simulate(input, T, scenario), { sustainable: P.sustainableNeed(input, T, scenario) });
    // Mootor arvestab rahavoogu pensioniea algusest. Enne seda 55-aastaselt alanud III samba fondipension näidatakse graafikul eraldi.
    mine.rows.forEach((x) => { if (x.age < mine.pensionStartAge && input.p3Early[x.age]) { x.i3 = input.p3Early[x.age]; x.pre = true; } });
    $('answer').innerHTML = answerText(mine, input);
    renderMetrics(mine);
    renderChart(nominal ? toNominal(mine) : mine, input, scenario);
    // Tuleviku eurodes kasvab fond valitud tootlus + hinnatõus (nt 2% → u 4%), II ja III eraldi.
    const nomR = (r) => (Math.round(((1 + r) * (1 + INFLATION) - 1) * 1000) / 10).toLocaleString('et-EE') + '%';
    $('moneyNote').textContent = nominal
      ? 'Graafik, tabel ja kokkuvõte on tuleviku eurodes (hinnad tõusevad ' + pct(INFLATION) + ' aastas). Fondid kasvavad siis umbes ' +
        (input.p2Has && input.p3Has && input.realReturn !== input.realReturn3 ? nomR(input.realReturn) + ' (II sammas) ja ' + nomR(input.realReturn3) + ' (III sammas)' : nomR(input.p2Has ? input.realReturn : input.realReturn3)) +
        ' aastas: sinu valitud tootlus pluss hinnatõus. Ülejäänud summad on tänastes eurodes.'
      : 'Summad on tänastes eurodes.';
    renderLegacy(mine, input);
    renderRecap(input, scenario, renderMap(input, scenario));
    renderOutcomes(mine);
    renderCompare(defs, results, scenario.id);
    renderWarn(mine, scenario, defs, results);
    renderSurplus(mine, input, defs, results, scenario);
    svgify($('legacy'));
  }

  // Fondipension maksab mitu aastat järjest rohkem, kui kulud vajavad: ülejääk seisab hoiusel (−1% aastas). Ütle see välja ja,
  // kui „Kasvatan edasi“ kannab elu lõpuni rohkem, näita kui palju (sama mootor, GROW stsenaarium võrdlusest).
  function renderSurplus(mine, input, defs, results, scenario) {
    const box = $('surplusTip');
    const sur = (x) => (x.fp > 0.5 && !x.work ? Math.max(0, x.i1 + x.isp + x.i23 + x.dep - x.spend) : 0);
    let best = null, cur = null;
    mine.rows.filter((x) => x.age >= mine.pensionStartAge).forEach((x) => {
      if (sur(x) > 20) { cur = cur || { from: x.age, to: x.age, sum: 0, n: 0 }; cur.to = x.age; cur.sum += sur(x); cur.n++; if (!best || cur.n > best.n) best = cur; } else cur = null;
    });
    if (!best || best.n < 3 || !box) { if (box) box.classList.add('d-none'); return; }
    const gi = defs.findIndex((d) => d.id === 'E'), grow = gi >= 0 ? results[gi] : null;
    const better = grow && scenario.id !== 'E' && grow.sustainable > mine.sustainable;
    const row = input.payout === 'grow' ? '6' : '5';
    box.innerHTML = 'Fondipension maksab ' + best.from + '–' + best.to + '-aastaselt keskmiselt <strong>' + eur(best.sum / best.n) + ' kuus rohkem</strong>, kui kulud vajavad. Ülejääk seisab hoiusel ja kaotab väärtust (−1% aastas pärast inflatsiooni).' +
      (better ? ' Kui jätad raha fondi („Kasvatan edasi“), kannab plaan elu lõpuni <strong>' + eur(grow.sustainable) + ' kuus</strong> (praegu ' + eur(mine.sustainable) + ').' : '') +
      // Peatamine (Tuleva: igakuised väljamaksed saab igal ajal peatada ja hiljem jätkata); Elukaar seda eraldi ei arvuta.
      ' Fondipensioni saad ka peatada ja hiljem uuesti alustada, näiteks kui riiklik pension algab ja katab suurema osa kuludest.' +
      ' <button type="button" class="btn btn-link p-0 align-baseline" data-open-row="' + row + '">Muuda<span class="visually-hidden"> samba väljamakse viisi</span></button>';
    box.classList.remove('d-none');
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
    // A2-2: elad sammastest ja lükkad riikliku pensioni edasi, aga raha ei jätku. Paku väiksemat edasilükkamist, mis kannab.
    const inp = readInput();
    if (inp.deferral > 0) {
      const bd = P.bestDeferral(inp, T, scenario);
      if (bd !== null && bd < inp.deferral) {
        html += '<br>Riikliku pensioni ' + inp.deferral + ' a edasilükkamisega ei jätku sammaste raha sillaks. ' +
          (bd === 0 ? 'Kui võtad riikliku pensioni kohe (' + mine.pensionStartAge + '-aastaselt), on kulud kaetud elu lõpuni.' : bd + ' a edasilükkamisega on kulud kaetud elu lõpuni ja riiklik pension on ikka suurem.') +
          ' <button type="button" class="btn btn-sm btn-primary ms-1" data-set-defer="' + bd + '">Muuda valik: ' + (bd === 0 ? 'riiklik pension kohe' : 'riiklik pension ' + bd + ' a hiljem') + '</button>';
        box.innerHTML = html;
        box.classList.remove('d-none');
        return;
      }
    }
    // C „Üks leping“ ja C „uus leping igal aastal“ on sama stsenaarium, aga eri lepinguga: parem võib olla teine.
    const same = best.id === scenario.id && !(scenario.id === 'C' && scenario.contract === 'once');
    if (br.sustainable > mine.sustainable && !same) {
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
    if (s.id === 'C' && input.method === 'fund' && input.deferral === s.deferral) return { step: 7, btn: 'Muuda pensionipõlves', text: 'vali pensionipõlves „Uus leping igal aastal“.' };
    if (s.id === 'C') return Object.assign(fundFirst ? at60 : atPa, { text: (fundFirst ? 'vali ' + (pa - 5) + '-aastaselt fondipension ja ' : 'vali pensionieas fondipension ja ') + 'lükka riiklik pension ' + s.deferral + ' aastat edasi.' });
    // B ja D: fondipension ilma edasilükkamiseta + leping pensionipõlves
    const contract = s.id === 'D' ? '„Uus leping igal aastal“' : '„Üks leping“';
    if (input.method === 'fund' && !input.deferral) return { step: 7, btn: 'Muuda pensionipõlves', text: 'vali pensionipõlves ' + contract + '.' };
    return Object.assign(fundFirst ? at60 : atPa, { text: 'vali fondipension, võta riiklik pension kohe ja pensionipõlves ' + contract + '.' });
  }

  // ---------- Navigeerimine ----------
  function renderPath(input) {
    const order = shownSteps(), fb = firstBlocked();
    $('path').innerHTML = order.map((i) => {
      const c = chapters[i];
      // Lukus: samm on kohustusliku täitmata väljaga sammust hiljem (tekst jääb näha, ikoon heledam, luku märk).
      const locked = fb !== undefined && order.indexOf(i) > order.indexOf(fb);
      const ages = stageAges(P.retirementYears(input), input.spHas ? P.specialStart(input) : null, retAge(input), firstFund(input))[i];
      const past = ages && ages[1] < input.currentAge;
      const now = ages && ages[0] <= input.currentAge && ages[1] >= input.currentAge;
      const cls = [i === step ? 'current' : '', visited.has(i) ? 'visited' : '', past ? 'past' : '', now ? 'now' : '', locked ? 'locked' : ''].join(' ');
      return '<li class="' + cls + '"><button type="button" data-goto="' + i + '"' + (i === step ? ' aria-current="step"' : '') + (locked ? ' aria-disabled="true"' : '') + '>' +
        '<span class="path-dot" aria-hidden="true">' + c.dataset.icon + '</span>' +
        // Vaadatud olek ka ilma värvita (WCAG 1.4.1): linnuke ja ekraanilugejale tekst.
        (locked ? '<span class="path-check path-lock" aria-hidden="true">' + ico('lock') + '</span>' : visited.has(i) && i !== step ? '<span class="path-check" aria-hidden="true">' + ico('check') + '</span>' : '') +
        '<span class="path-text"><span class="path-label">' + (i === SP_STEP ? P.specialStart(input) + ' a' : c.dataset.label) + (c.dataset.sub ? '<span class="path-sub"> ' + c.dataset.sub + '</span>' : '') + '</span>' +
        '<span class="visually-hidden">' + (i === step ? ', praegune samm' : locked ? ', lukus: täida enne kohustuslikud väljad' : visited.has(i) ? ', vaadatud' : ', vaatamata') + '</span>' +
        (now ? '<span class="path-now">täna</span>' : '') + '</span></button></li>';
    }).join('');
    // Edenemisriba: täidetud kuni aktiivse sammuni (kaasa arvatud).
    const shown = shownSteps(), pos = shown.indexOf(step);
    $('pathFill').style.width = ((pos + 1) / shown.length * 100) + '%';
  }

  // ---------- Kohustuslikud väljad ----------
  // Nähtav [required] väli, mis on tühi (eripensioni summa peab olema > 0). Viga näidatakse alles siis, kui kasutaja on
  // väljalt lahkunud või proovinud sammust edasi minna (mitte kohe, kui väli ilmub).
  const tried = new Set();
  const isShown = (el) => !el.closest('.d-none');
  const isEmpty = (el) => el.value === '' || (el.id === 'spMonthly' && !(parseFloat(el.value) > 0));
  // Välja silt ilma „kohustuslik“ märgiseta (veateadetes ja vihjetes).
  const labelText = (el) => { const l = document.querySelector('label[for="' + el.id + '"]'); if (!l) return el.id; const c = l.cloneNode(true); c.querySelectorAll('.req, .help-btn').forEach((x) => x.remove()); return c.textContent.trim(); };
  // Sammu kohustuslikud väljad, ka siis, kui sammu valikud on parasjagu tulemuste lehe real (#sb-N).
  const reqIn = (i) => { const sb = $('sb-' + i); return [...chapters[i].querySelectorAll('[required]')].concat(sb && !chapters[i].contains(sb) ? [...sb.querySelectorAll('[required]')] : []); };
  const missingIn = (i) => reqIn(i).filter((el) => isShown(el) && isEmpty(el)).concat(i === 0 ? sinaBlockers() : []);
  function markRequired() {
    chapters.forEach((c, i) => {
      reqIn(i).forEach((el) => {
        el.setAttribute('aria-required', 'true');
        const bad = isShown(el) && isEmpty(el) && (tried.has(i) || el.dataset.touched === '1');
        el.classList.toggle('is-invalid', bad);
        el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      });
      const note = c.querySelector('.req-note');
      if (note) note.classList.toggle('d-none', i !== 0 && !reqIn(i).some(isShown)); // sammus „Sina“ on alati kohustuslikke välju
      const err = c.querySelector('.req-error'), miss = missingIn(i);
      if (err) {
        const show = tried.has(i) && miss.length > 0;
        err.classList.toggle('d-none', !show);
        err.innerHTML = show ? 'Enne edasi minekut täida: ' + miss.map((el) => '<a href="#' + el.id + '">' + labelText(el) + '</a>').join(', ') + '.' : '';
      }
    });
  }
  // Esimene näidatav samm (teekonna järjekorras), kus on täitmata kohustuslik väli; sellest hilisemad sammud on lukus.
  const firstBlocked = () => shownSteps().find((i) => missingIn(i).length > 0);
  // Iga sammu algusesse: kohustuslike väljade selgitus ja veateade (role="alert", lingid väljadele).
  chapters.forEach((c) => {
    const head = c.querySelector('.chapter-head');
    if (!head) return;
    head.insertAdjacentHTML('afterend', '<p class="req-note small-muted d-none">Kohustuslikud väljad on märgitud sõnaga <span class="req">kohustuslik</span>.</p>' +
      '<div class="req-error alert alert-danger d-none" role="alert"></div>');
  });
  document.addEventListener('focusout', (e) => { if (e.target.matches && e.target.matches('[required]')) { e.target.dataset.touched = '1'; markRequired(); } });
  // ---------- Tulemuste lehe kiirmuutmine ----------
  // Iga otsustussammu valikud (kõik peale pealkirja, kohustuslike väljade teadete ja KKK) on ühes ümbrises #sb-N.
  // „Muuda“ tõstab ümbrise tulemuste lehe rea alla ja „Sulge“/Esc tagasi sammu (eraldi „Valmis“ nuppu pole): üks valikute komplekt, loogika sama.
  const RES_STEPS = [3, 4, 5, 6, 7, 8, SP_STEP], SB = {};
  RES_STEPS.forEach((i) => {
    const c = chapters[i], box = document.createElement('div');
    box.className = 'step-body'; box.id = 'sb-' + i; SB[i] = box;
    [...c.children].filter((el) => !el.matches('.chapter-head, .req-note, .req-error, section.faq')).forEach((el) => box.appendChild(el));
    c.insertBefore(box, c.querySelector(':scope > section.faq'));
  });
  const stepBody = (i) => SB[i]; // viide, mitte getElementById: ümberjoonistamise ajal on ümbris dokumendist väljas
  const sendHome = (sb) => { const c = chapters[+sb.id.slice(3)]; if (sb.parentNode !== c) c.insertBefore(sb, c.querySelector(':scope > section.faq')); };
  const resOpen = {};
  let drawSeq = 0;
  function closePanels() { Object.keys(resOpen).forEach((k) => { delete resOpen[k]; }); document.querySelectorAll('#recap .step-body').forEach(sendHome); }
  // Fondi tootluse kaardid: sama väärtus mis sammu „Sina“ väljal (II: fundCur, III: fund3Cur); fondivahetust ei küsita.
  const FUND_SEL = { fund2: 'fundCur', fund3: 'fund3Cur' };
  function fundCards(key) {
    const cur = $(FUND_SEL[key]).value;
    return '<fieldset><legend class="visually-hidden">' + (key === 'fund3' ? 'III' : 'II') + ' samba tootlus pärast inflatsiooni</legend><div class="choices">' + Object.entries(FUNDS).map(([k, f]) =>
      '<label class="choice"><input type="radio" name="res-' + key + '" value="' + k + '"' + (k === cur ? ' checked' : '') + '><span class="choice-body"><span class="choice-emoji" aria-hidden="true">📈</span>' +
      '<strong>' + pct(f.r) + ' aastas</strong><small>' + f.name.replace(/ \(.*\)$/, '') + '. ' + f.note + '</small></span></label>').join('') + '</div></fieldset>';
  }
  function drawResRows(rows) {
    // Ümberjoonistamisel jäävad tõstetud valikud alles (väärtused, kuulajad); fookus taastatakse.
    const a = document.activeElement, box = $('recap');
    const keepFocus = a && box.contains(a) ? (a.id ? '#' + a.id : a.name ? 'input[name="' + a.name + '"][value="' + a.value + '"]' : null) : null;
    // Fookusega väli sammu valikutes: blur enne eemaldamist (selle change-käsitleja joonistab read ise uuesti).
    if (keepFocus && a.closest('.step-body')) { const n = ++drawSeq; a.blur(); if (n !== drawSeq) { const el = box.querySelector(keepFocus); if (el) el.focus({ preventScroll: true }); return; } }
    drawSeq++;
    const bodies = [...box.querySelectorAll('.step-body')];
    bodies.forEach((sb) => sb.remove());
    // Eeldused (andmed, tootlus, kulud) üleval, otsused vanuse järgi all; vanus ja aasta rea alguses (variant B, Kadi 24.10).
    const PRE = ['0', 'fund2', 'fund3', '8'];
    const rowHtml = (r) => {
      const goto = r.key === '0', open = !goto && !r.info && !!resOpen[r.key];
      const btn = r.info ? '' : goto ? '<button type="button" class="btn btn-link btn-sm" data-goto="0">Muuda sammus „Sina“</button>'
        : '<button type="button" class="btn btn-link btn-sm" id="res-' + r.key + '" data-res="' + r.key + '" aria-expanded="' + open + '" aria-controls="rp-' + r.key + '">' +
          (open ? 'Sulge' : 'Muuda') + '<span class="visually-hidden"> ' + r.what + '</span></button>';
      const panel = open ? '<div class="res-panel" id="rp-' + r.key + '" role="group" aria-labelledby="rt-' + r.key + '">' + (FUND_SEL[r.key] ? fundCards(r.key) : '') + '</div>' : '';
      const pre = PRE.includes(r.key);
      const lead = pre ? '<span class="opt-ico" aria-hidden="true">' + r.ico + '</span>'
        : '<div class="res-age">' + (r.age !== null && r.age !== undefined ? r.age + ' a' : '') + (r.year ? '<small>' + r.year + (r.year < P.CURRENT_YEAR ? ', avanenud' : '') + '</small>' : r.age === null ? '<small>Elu lõpus</small>' : '') + '</div>';
      const rl = (r.rules || []).map((x) => '<p class="res-rule">' + (x.title ? '<strong>' + x.title + '.</strong> ' : '') + x.text + '</p>').join('');
      return '<li data-row="' + r.key + '"><div class="opt-row' + (pre ? '' : ' has-age') + '">' + lead + '<div class="flex-grow-1"><h5 id="rt-' + r.key + '">' + r.title + '</h5>' +
        (r.now ? '<small class="res-now">' + r.now + '</small>' : '') + rl + '</div>' + btn + '</div>' + panel + '</li>';
    };
    const timed = rows.filter((r) => !PRE.includes(r.key)).sort((a, b) => (a.year || 9999) - (b.year || 9999));
    box.innerHTML = '<h4 class="res-group">Eeldused</h4><ul class="opt-list res-list">' + rows.filter((r) => PRE.includes(r.key)).map(rowHtml).join('') + '</ul>' +
      '<h4 class="res-group">Otsused vanuse järgi</h4><ul class="opt-list res-list">' + timed.map(rowHtml).join('') + '</ul>';
    RES_STEPS.forEach((i) => {
      const sb = stepBody(i), panel = $('rp-' + i);
      if (panel) panel.appendChild(sb); else sendHome(sb);
    });
    if (keepFocus) { const el = box.querySelector(keepFocus); if (el) el.focus({ preventScroll: true }); }
  }
  $('recap').addEventListener('click', (e) => {
    // Viide teise sammu juurde (nt „Muuda 3. sammus“) avab tulemuste lehel selle rea, kui see on olemas.
    const g = e.target.closest('.res-panel [data-goto]');
    if (g && $('res-' + g.dataset.goto)) {
      e.preventDefault(); e.stopPropagation();
      resOpen[g.dataset.goto] = true; update();
      $('res-' + g.dataset.goto).scrollIntoView({ block: 'start' }); $('res-' + g.dataset.goto).focus({ preventScroll: true });
      return;
    }
    const t = e.target.closest('[data-res]');
    if (!t) return;
    const k = t.dataset.res;
    if (resOpen[k]) delete resOpen[k]; else resOpen[k] = true;
    update();
    $('res-' + k).focus(); // fookus jääb rea nupule („Muuda“ ↔ „Sulge“), see joonistatakse uuesti
  });
  // Soovituse „Muuda“ (nt ülejääk hoiusel): ava see rida tulemuste lehel ja vii fookus rea nupule.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-row]');
    if (!b) return;
    const k = b.dataset.openRow;
    if (!$('res-' + k)) { go(+k); return; }
    resOpen[k] = true; update();
    $('res-' + k).scrollIntoView({ block: 'start' }); $('res-' + k).focus({ preventScroll: true });
  });
  // Esc sulgeb rea, fookus tagasi „Muuda“ nupule.
  $('recap').addEventListener('keydown', (e) => {
    const p = e.key === 'Escape' && e.target.closest('.res-panel');
    if (!p) return;
    const k = p.id.slice(3); delete resOpen[k]; update(); $('res-' + k).focus();
  });
  $('recap').addEventListener('change', (e) => { const k = e.target.name.replace(/^res-/, ''); if (FUND_SEL[k]) setSel(FUND_SEL[k], e.target.value); });

  // Iga lahti rea kaardil: „Raha jätkub X-aastaseni“ ja muutus praegusega võrreldes. Arvutus on sama mis vastusel:
  // valik märgitakse ajutiselt (ilma sündmusteta), readInput + P.simulate, siis taastatakse; pension.js ei muutu.
  const DELTA_UNIT = ' a'; // muutuse ühik (vanus aastates)
  const coversAge = (r) => (r.coversNeedUntil === null ? 100 : r.coversNeedUntil);
  const coversTxt = (a) => (a >= 100 ? 'elu lõpuni (100+)' : a + '-aastaseni');
  function outcomeWith(radioEl) {
    const group = [...document.querySelectorAll('input[type="radio"][name="' + radioEl.name + '"]')], was = group.find((x) => x.checked);
    const extra = [];
    const fk = radioEl.name.replace(/^res-/, '');
    if (FUND_SEL[fk]) extra.push([$(FUND_SEL[fk]), 'value', radioEl.value]);
    // „Täis / pool / edasi“ muudab ka aastaid (nagu p1Mode kuulaja).
    if (radioEl.name === 'p1Mode') { const d = parseInt(radio('defer') || '0', 10), r = document.querySelector('input[name=defer][value="' + (radioEl.value === 'full' ? 0 : Math.max(1, d)) + '"]'); if (r) extra.push([r, 'checked', true]); }
    const saved = extra.map(([el, k]) => [el, k, el[k]]).concat(extra.filter(([, k]) => k === 'checked').map(([el]) => [document.querySelector('input[name="' + el.name + '"]:checked'), 'checked', true]));
    radioEl.checked = true; extra.forEach(([el, k, v]) => { el[k] = v; });
    try { const inp = readInput(); return coversAge(P.simulate(inp, T, scenarioFor(inp))); }
    finally { saved.forEach(([el, k, v]) => { if (el) el[k] = v; }); if (was) was.checked = true; else radioEl.checked = false; }
  }
  function renderOutcomes(mine) {
    const cur = coversAge(mine);
    document.querySelectorAll('#recap .res-panel .choice').forEach((lab) => {
      const r = lab.querySelector('input[type="radio"]'), body = lab.querySelector('.choice-body');
      const old = body && body.querySelector('.outcome'); if (old) old.remove();
      if (!r || !body || r.matches(':disabled') || !isShown(r)) return;
      const a = r.checked ? cur : outcomeWith(r), d = a - cur;
      body.insertAdjacentHTML('beforeend', '<span class="outcome">Raha jätkub ' + coversTxt(a) + (r.checked ? '<span class="outcome-now"> · praegu</span>'
        : d ? ' <span class="delta ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + DELTA_UNIT + '<span class="visually-hidden"> võrreldes praegusega</span></span>' : '') + '</span>');
    });
  }


  // Liigu järgmisele/eelmisele näidatavale etapile (vahelejäetud etapid jäävad vahele).
  function move(dir) {
    const shown = shownSteps();
    const k = shown.indexOf(step) + dir;
    go(shown[Math.max(0, Math.min(shown.length - 1, k))]);
  }

  function go(n, focus) {
    const shown = shownSteps();
    let target = Math.max(0, Math.min(LAST, n));
    if (skipped(target)) target = shown.find((i) => i > target);
    // Edasi ei saa minna üle sammu, kus kohustuslik väli on täitmata: jää sinna ja näita viga.
    const fb = firstBlocked();
    let blocked = false;
    if (fb !== undefined && shown.indexOf(target) > shown.indexOf(fb)) { target = fb; blocked = true; tried.add(fb); }
    if (target !== LAST) closePanels(); // sammu valikud tagasi oma sammu
    step = target;
    visited.add(step);
    if (window.minaMoot && step !== lastTracked && mootSamm(step) !== null) { lastTracked = step; window.minaMoot('samm', { samm: mootSamm(step) }); } // mõõtmine: samm
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
      window.scrollTo(0, 0); // kohe, mitte sujuvalt: iOS Safari jätab muidu uue sammu keskele
      requestAnimationFrame(() => window.scrollTo(0, 0));
      const h = chapters[step].querySelector('h2'); if (h) h.focus({ preventScroll: true });
    }
    // Lukus: fookus sammu alguse veateatele (role="alert", lingid väljadele), ekraanilugeja loeb selle ette.
    if (blocked) {
      if (step === 0) { flagSinaEmpty(); markRequired(); }
      const box = chapters[step].querySelector('.req-error');
      box.setAttribute('tabindex', '-1');
      box.scrollIntoView({ block: 'center' }); box.focus({ preventScroll: true });
    }
  }

  // Lepingu vaikevalik: uus leping igal aastal (Kadi 24.10; HTML-is esimene ja valitud). Kasutaja enda valikut ei muudeta.
  let contractTouched = false;
  document.querySelectorAll('input[name="contract"]').forEach((el) => el.addEventListener('change', () => { contractTouched = true; }));

  // Ühe visuaalse rea sildid sama kõrgeks (kõrgeima järgi), et lahtrid oleksid ühel joonel ka siis, kui silt murdub kahele reale.
  function alignLabels() {
    const step = chapters.find((c) => !c.hidden) || document;
    step.querySelectorAll('.fields').forEach((row) => {
      const labs = [...row.children].map((col) => col.querySelector(':scope > .label-row, :scope > .form-label')).filter(Boolean);
      labs.forEach((l) => { l.style.minHeight = ''; });
      const byTop = {};
      labs.forEach((l) => { if (!l.closest('.d-none')) (byTop[Math.round(l.parentElement.offsetTop)] = byTop[Math.round(l.parentElement.offsetTop)] || []).push(l); });
      Object.values(byTop).forEach((g) => { if (g.length < 2) return; const h = Math.max(...g.map((l) => l.offsetHeight)); if (g.some((l) => l.offsetHeight < h)) g.forEach((l) => { l.style.minHeight = h + 'px'; }); });
    });
  }
  window.addEventListener('resize', () => requestAnimationFrame(alignLabels));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignLabels);

  // Erijuhud: linnukesed avavad plokid; andmete allikas on senised valikud (kidsHas, hazard, spHas), mida linnuke täidab.
  function syncSpecial() {
    $('cHazard').checked = $('hazard').value !== 'no';
    $('cSp').checked = $('spHas').value === 'yes';
    $('hazardRow').classList.toggle('d-none', !$('cHazard').checked);
    $('rescueWrap').classList.toggle('d-none', !$('cRescue').checked);
    $('civilNote').classList.toggle('d-none', !$('cCivil').checked);
    $('otherNote').classList.toggle('d-none', !$('cOther').checked);
    // Välja vihjed on püsivad; arvutatud tulemus (suurendus, ootetoetus) on pensionile mineku sammus (soodusNote).
  }
  const setSel = (id, v) => { const el = $(id); if (el.value !== v) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
  // Klõps saadab enne „input“, siis „change“; üldine update (input) sünkroniseeriks linnukese valiku järgi tagasi.
  // Seepärast täidame valiku dokumendi tasemel püüdmisfaasis, enne välja enda kuulajaid.
  const SPECIAL = { cHazard: () => setSel('hazard', $('cHazard').checked ? ($('hazard').value !== 'no' ? $('hazard').value : 'list1') : 'no'),
    cSp: () => setSel('spHas', $('cSp').checked ? 'yes' : 'no') };
  ['input', 'change'].forEach((ev) => document.addEventListener(ev, (e) => { const f = e.target && SPECIAL[e.target.id]; if (f) f(); }, true));

  function update() {
    syncSpecial();
    lastInput = readInput();
    // Valikukaardid joonistatakse uuesti: hoia klaviatuuri fookus samal raadionupul.
    const a = document.activeElement;
    const keep = a && a.type === 'radio' && (a.name === 'pkg' || a.name === 'defer') ? a.name : null;
    const input = readInput();
    renderTexts(input);
    renderPackages(input);
    renderBreakdown(readInput());
    const fresh = readInput();
    renderPotBar(fresh);
    markRequired();
    renderSina();
    renderPath(fresh);
    requestAnimationFrame(alignLabels);
    if (step === LAST) { renderResult(fresh); if (chart) chart.resize(); }
    svgify(document);
    if (keep) { const el = document.querySelector('input[name="' + keep + '"]:checked'); if (el) el.focus(); }
  }

  // ---------- Pensioniiga ----------
  let paTouched = false;
  // Soodustingimustel vanaduspension: pensioniiga on valitud iga miinus varem minemise aastad (pension ei vähene).
  // Lapsed (1. vaade): iga lapse sünniaasta (ja vajadusel kuu), rühmad arvutame ise (RPKS § 24, KoPS § 10).
  // Kuu küsime ainult 2021. a (aug/sept piir) ja alla 3-aastase lapse puhul (riigi II samba sissemakse kestab 36 kuud).
  const MONTHS = ['jaan', 'veebr', 'märts', 'apr', 'mai', 'juuni', 'juuli', 'aug', 'sept', 'okt', 'nov', 'dets'];
  // Sünniaasta võib olla tulevikus kuni pensionieani (nagu SKA kalkulaatoris).
  function kidsMaxYear() { return (parseInt($('birthYear').value, 10) || 1980) + (parseInt($('pensionAgeYears').value, 10) || 65); }
  function kidsCount() { return $('kidsHas').value === 'yes' ? Math.max(0, parseInt($('kidsCount').value, 10) || 0) : 0; }
  const needMonth = (y, now) => y === 2021 || y >= now.getFullYear() - 3;
  function kidsInput() {
    const has = $('kidsHas').value === 'yes';
    const early = $('kidsEarlyUser').value, sup = $('kidsSupUser').value;
    const now = new Date(), nowM = now.getFullYear() * 12 + now.getMonth();
    const k = { b1991: 0, b2012: 0, b2013: 0, b2021: 0, bUnknown: 0, u3: 0, u3Left: [], iiMonths: [] };
    // Sept 2021+ laps, kes on üle 3 a: mitu kuud tegi riik II sambasse lisamakseid (RPKS § 24 lg 6; tühi → mootori vaikimisi).
    const olderII = (i) => { const el = $('kidsII' + i), v = el && el.value !== '' ? parseInt(el.value, 10) : NaN; k.iiMonths.push(isNaN(v) ? undefined : Math.max(0, Math.min(36, v))); };
    // Last arvestame, kui ta on pensionile minekuks vähemalt 8 aastat kasvatatud (iga laps eraldi; RPKS § 24, SKA: kuni
    // 18-aastase lapse kasvatamine vähemalt 8 aastat). Ka tulevane laps. Kas lisa tuleb ka hiljem, kui laps saab 8 pärast
    // pensionile minekut, SKA leht ei ütle [inferred: ei arvesta]. Varem pensionile minek (3+ last) toob pensioni ette, seega
    // kontrollime vanust selle aasta järgi, kuni arv ei muutu.
    const by = parseInt($('birthYear').value, 10) || 1980, paY = by + (parseInt($('pensionAgeYears').value, 10) || 65);
    const ys = []; for (let i = 0; i < kidsCount(); i++) { const el = $('kidsBorn' + i); ys.push(el ? parseInt(el.value, 10) : NaN); }
    const known = ys.filter((y) => y >= 1930 && y <= kidsMaxYear());
    let retY = paY;
    for (let t = 0; t < 4; t++) {
      const n = known.filter((y) => y + 8 <= retY).length + ys.filter((y) => !(y >= 1930 && y <= kidsMaxYear())).length;
      const e = P.earlyYears({ kids: { b1991: n, earlyUser: early, disabled: has && $('kidsDisabled').value === 'yes' } });
      if (paY - e === retY) break; retY = paY - e;
    }
    k.late = known.filter((y) => y + 8 > retY).length; k.lateYear = retY;
    for (let i = 0; i < kidsCount(); i++) {
      const yEl = $('kidsBorn' + i), mEl = $('kidsMonth' + i);
      const y = yEl ? parseInt(yEl.value, 10) : NaN;
      if (!(y >= 1930 && y <= kidsMaxYear())) { k.bUnknown++; continue; }
      if (y + 8 > retY) continue; // pensionile minekuks alla 8 aasta kasvatatud: ei arvesta
      const m = mEl && mEl.value ? parseInt(mEl.value, 10) : 0; // 1–12, 0 = ei tea
      if (y < 1991) k.b1991++;
      else if (y <= 2012) k.b2012++;
      else if (y < 2021 || (y === 2021 && m !== 0 && m <= 8) || (y === 2021 && m === 0)) { // 2021 ilma kuuta: aug või varem
        k.b2013++;
        // Enne 1983 sündinud vanem: kas oli lapse esimesel 3 aastal II sambas (siis maksis riik sinna, lisa pole)?
        const q = $('kidsII13_' + i); if (by < 1983 && q) k.b2013noII = (k.b2013noII || 0) + (q.value === 'no' ? 1 : 0);
      }
      else {
        k.b2021++;
        // Alla 3-aastane: riik maksab II sambasse kuni 36 kuud. Ilma kuuta: kindlasti alla 3, kui sündis viimase 2 aasta sees.
        if (y > now.getFullYear()) { // tulevane laps: 36 kuud alates sünnist
          k.u3++; k.u3Left.push(36);
          (k.u3Start = k.u3Start || [])[k.u3Left.length - 1] = y; (k.u3StartMonth = k.u3StartMonth || [])[k.u3Left.length - 1] = m || 1;
        } else if (m) {
          const left = 36 - (nowM - (y * 12 + m - 1));
          if (left > 0) { k.u3++; k.u3Left.push(Math.min(36, left)); } else olderII(i);
        } else if (y >= now.getFullYear() - 2) { k.u3++; k.u3Left.push(undefined); }
        else olderII(i);
      }
    }
    return Object.assign(k, { monthNow: now.getMonth(), disabled: has && $('kidsDisabled').value === 'yes', earlyUser: early, supUser: sup, user: early, inForecast: $('kidsInForecast').value });
  }
  // Iga lapse rida: sünniaasta ja vajadusel kuu. Olemasolevad väärtused jäävad alles, kui laste arv muutub.
  function renderKids() {
    const box = $('kidsList'), cnt = kidsCount(), now = new Date(), maxY = kidsMaxYear(), by = parseInt($('birthYear').value, 10) || 1980;
    const rows = box.querySelectorAll('.kid-row');
    if (rows.length !== cnt) {
      const keep = [...rows].map((r, i) => [($('kidsBorn' + i) || {}).value || '', ($('kidsMonth' + i) || {}).value || '', ($('kidsII' + i) || {}).value || '', ($('kidsII13_' + i) || {}).dataset && $('kidsII13_' + i).dataset.touched ? $('kidsII13_' + i).value : '']);
      box.innerHTML = cnt ? '<div class="row g-3">' + Array.from({ length: cnt }, (_, i) =>
        '<div class="col-12 col-sm-6 col-lg-4 kid-row"><div class="row g-2">' +
        '<div class="col-7"><label class="form-label" for="kidsBorn' + i + '">' + (i + 1) + '. lapse sünniaasta</label>' +
        '<input class="form-control" id="kidsBorn' + i + '" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" aria-describedby="kidsBornHint kidsBornErr' + i + '" value="' + ((keep[i] || [])[0] || '') + '">' +
        '<div class="invalid-feedback" id="kidsBornErr' + i + '">' + (i + 1) + '. lapse sünniaasta: sisesta aasta vahemikus 1930–' + maxY + '.</div></div>' +
        '<div class="col-5 kid-month d-none"><label class="form-label" for="kidsMonth' + i + '">sünnikuu</label>' +
        '<select class="form-select" id="kidsMonth' + i + '"><option value="">ei tea</option>' + MONTHS.map((n, j) => '<option value="' + (j + 1) + '">' + n + '</option>').join('') + '</select></div>' +
        '<div class="col-12 kid-ii13 d-none"><label class="form-label" for="kidsII13_' + i + '">Kas olid lapse esimesel 3 aastal II sambas?</label>' +
        '<select class="form-select" id="kidsII13_' + i + '"><option value="yes">jah</option><option value="no">ei</option></select></div>' +
        '<div class="col-12 kid-ii d-none"><label class="form-label" for="kidsII' + i + '">Riigi lisamakse II sambasse (kuud)</label>' +
        '<input class="form-control" id="kidsII' + i + '" type="number" inputmode="numeric" min="0" max="36" step="1" value="' + ((keep[i] || [])[2] || '') + '" aria-describedby="kidsIIHint' + i + '"><div class="form-text" id="kidsIIHint' + i + '">0–36 kuud lapse esimesel 3 aastal.</div></div>' +
        '</div></div>').join('') + '</div>' : '';
      keep.forEach((v, i) => { const m = $('kidsMonth' + i); if (m && v[1]) m.value = v[1]; const q = $('kidsII13_' + i); if (q && v[3]) { q.value = v[3]; q.dataset.touched = '1'; } });
    }
    let missing = false, anyII = false; // eslint-disable-line no-unused-vars
    for (let i = 0; i < cnt; i++) {
      const el = $('kidsBorn' + i), raw = el.value.trim();
      // Ainult 4-kohaline aasta lubatud vahemikus; muu on viga (nähtav teade, aria-invalid) ja seda ei arvestata.
      const ok = /^\d{4}$/.test(raw) && +raw >= 1930 && +raw <= maxY;
      const bad = raw !== '' && !ok && (raw.length === 4 || document.activeElement !== el);
      el.classList.toggle('is-invalid', bad);
      if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      const y = ok ? +raw : 0;
      if (!y) missing = true;
      $('kidsMonth' + i).closest('.kid-month').classList.toggle('d-none', !(y && needMonth(y, now)));
      // Lisamakse kuud: sept 2021+ laps, kes on juba üle 3 a (alla 3 a lapse eest arvestab riigi sissemakset mootor).
      const m = parseInt($('kidsMonth' + i).value, 10) || 0, nowM = now.getFullYear() * 12 + now.getMonth();
      const b21 = y > 2021 || (y === 2021 && m >= 9);
      const u3 = b21 && (m ? 36 - (nowM - (y * 12 + m - 1)) > 0 : y >= now.getFullYear() - 2);
      const showII = !!y && b21 && !u3 && (y < now.getFullYear() - 2 || m > 0);
      const iiEl = $('kidsII' + i);
      iiEl.closest('.kid-ii').classList.toggle('d-none', !showII);
      // Eeltäide: II sambas 36 kuud (lisa pole), muidu 0 (täis lisa); kasutaja enda väärtus jääb.
      if (showII && (iiEl.value === '' || iiEl.dataset.auto)) { iiEl.value = String(parseFloat($('p2Rate').value) > 0 ? 36 : 0); iiEl.dataset.auto = '1'; }
      if (showII) anyII = true;
      // 2013 – aug 2021 laps ja enne 1983 sündinud vanem: küsime, kas oli II sambas (vaikimisi tänase seisu järgi).
      const q13 = $('kidsII13_' + i), show13 = !!y && by < 1983 && (y >= 2013 && !b21);
      q13.closest('.kid-ii13').classList.toggle('d-none', !show13);
      if (show13 && !q13.dataset.touched) q13.value = parseFloat($('p2Rate').value) > 0 || parseFloat($('p2').value) > 0 ? 'yes' : 'no';
    }
    const ki = kidsInput();
    $('kidsLateWrap').classList.toggle('d-none', !ki.late);
    $('kidsLate').textContent = ki.late ? ki.late + ' last ei ole pensionile minekuks (' + ki.lateYear + ') vähemalt 8 aastat kasvatatud. ' + (ki.late === 1 ? 'Seda' : 'Neid') + ' arvutus ei arvesta.' : '';
    $('kidsMissingWrap').classList.toggle('d-none', !missing);
  }
  // Varem pensionile (aastad): lapsed või tervist kahjustav töö, suurem kahest (pension.js earlyYears).
  // Päästja ootetoetus või laste eest varem pensionile (TLV-105): valik ainult siis, kui mõlemad õigused on sinul.
  const rescueStaaz = () => ($('cRescue').checked ? parseInt($('rescueYears').value, 10) || 0 : 0);
  // Laste pensionilisa märge vanaduspensioni kaardil: lisatud, juba SKA prognoosis või arvestamata (prognoosi küsimus 1. vaates).
  function supTxtPa(input) {
    const supM = P.childSupplement(input), inF = input.kids.inForecast;
    return !(supM > 0) ? '' : inF === 'no' ? 'Koos laste pensionilisaga (lisasime u ' + eur(supM) + ')' : inF === 'yes' ? 'Koos laste pensionilisaga (on SKA prognoosis)' : 'Laste pensionilisa pole arvestatud: 1. vaates vali, kas SKA prognoos sisaldab seda';
  }
  // Ootetoetuse ja laste pensioni variantide võrdlustabel (TLV-105): millal töölt ära, mis kuni pensionieani, pension pärast.
  function rescueCompare(input, pa) {
    const kidsY = P.earlyYears({ kids: input.kids }), resY = P.earlyYears({ kids: {}, rescueYears: input.rescueYears });
    const vars = (kidsY < resY ? [['mix', 'Mõlemad järjest']] : []).concat([['pension', 'Laste eest pension'], ['toetus', 'Ainult ootetoetus']]);
    // Laste pensionilisa veerg: kellel ja mis vanusest (eraldi õigus, supUser); „ei tea“ prognoosi korral pole arvestatud.
    const supM = P.childSupplement(input), inF = input.kids.inForecast, supOther = (input.kids.supUser || input.kids.user) === 'other';
    const supCell = (from) => supOther ? 'teisel vanemal' : !(supM > 0) ? '–' : inF === 'unknown' ? 'pole arvestatud (vali 1. vaates, kas prognoos sisaldab)' : 'sinul alates ' + from + ' a' + (inF === 'no' ? ' (u ' + eur(supM) + ' kuus)' : ' (on prognoosis)');
    const rows = vars.map(([b, name]) => {
      const sim = P.simulate(Object.assign({}, input, { rescueBasis: b, soodus: undefined, flexEarly: 0 }), T, { id: 'E' });
      const r = (a) => (sim.rows.find((x) => x.age === a) || {}).i1g || 0;
      const ret = sim.pensionStartAge, ra = sim.rescueAllowance;
      const parts = [];
      if (ra) parts.push(ra.from + '–' + (ra.until - 1) + ' a ootetoetus ' + eur(ra.monthly) + ' kuus');
      const pFrom = ra ? ra.until : ret;
      if (pFrom < pa) parts.push(pFrom + '–' + (pa - 1) + ' a pension ' + eur(r(pFrom)) + ' kuus');
      let sum = 0;
      for (let a = ret; a < pa; a++) sum += r(a) * 12; // i1g on kuus
      return { b, name, work: ret, parts, sum, after: r(pa), sup: supCell(pFrom) };
    });
    const t = rows.find((x) => x.b === 'toetus');
    const best = Math.max(...rows.map((x) => x.sum)), first = Math.min(...rows.map((x) => x.work));
    // Pere kokku: teine vanem keskmise vanaduspensioniga (P.AVG_OLD_AGE_PENSION) läheb laste eest kidsY a varem.
    if (t) {
      const avg = P.AVG_OLD_AGE_PENSION, partner = avg * 12 * kidsY;
      rows.push({ b: 'family', name: 'Pere kokku: sina ootetoetusel, teine vanem laste eest varem', work: t.work, family: true,
        parts: ['Sina: ' + t.parts[0], 'Teine vanem: ' + kidsY + ' a pension u ' + eur(avg) + ' kuus (keskmine vanaduspension)'],
        sum: t.sum + partner, sumNote: 'sinu ' + eur(t.sum) + ' + teise vanema u ' + eur(partner), sup: t.sup, after: t.after,
        note: 'näide, teise vanema andmeid Elukaar ei küsi; muuda laste valikus' });
    }
    const th = (h) => '<th scope="col">' + h + '</th>';
    const mine = (x) => x.b === input.rescueBasis;
    const intro = '<p>Kui lastel on teine vanem, võib laste varem pensionile mineku õiguse anda talle. Sina saad edasi päästja ootetoetuse ja tema läheb laste eest ' + kidsY + ' a varem pensionile. Ooteperioodil toob see perele kokku rohkem sissetulekut (vt tabeli pere rida). Kas see on teisele vanemale kasulik, vajab tema andmetega eraldi arvutust. Seda saad muuta laste valikus „Varem pensionile mineku õigust kasutab“.</p>' +
      '<p>Laste pensionilisa on eraldi õigus: kui see jääb sulle, lisandub see sinu vanaduspensionile ' + pa + '-aastaselt. Kumb vanem pensionilisa saab, valite laste juures („Pensionilisa saab“).</p>' +
      '<p>Kui kasvatad lapsi üksi, võib laste eest saadav pension ' + (pa - kidsY) + '–' + (pa - 1) + ' a olla sulle kasulikum, sest see sisaldab kohe laste pensionilisa.</p>';
    return intro + '<h4 class="h6 mb-2">Võrdlus: mis aitab valida?</h4>' +
      '<div class="table-responsive"><table class="table table-sm align-top mb-2"><thead><tr>' + th('Variant') + th('Töölt ära') + th('Kuni ' + pa + '. eluaastani') + th('Riigilt sulle kokku enne ' + pa + ' a') + th('Laste pensionilisa') + th('Pension ' + pa + '-aastaselt') + '</tr></thead><tbody>' +
      rows.map((x) => '<tr' + (mine(x) ? ' class="table-active"' : '') + '><th scope="row">' + x.name +
        (mine(x) ? '<br><small class="fw-normal"><span aria-hidden="true">✓ </span>sinu valik</small>' : '') /* nähtav tekst, mitte ainult taustavärv (WCAG 1.4.1) */ +
        (x.note ? '<br><small class="fw-normal">' + x.note + '</small>' : '') + '</th><td>' + x.work + ' a' + (x.work > first ? '<br><small>' + (x.work - first) + ' a kauem palka</small>' : '') + '</td><td>' + x.parts.join('<br>') + '</td><td>' + eur(x.sum) + (x.sumNote ? '<br><small>' + x.sumNote + '</small>' : '') + (!x.family && x.sum === best ? ' <span class="badge text-bg-success">kõige rohkem</span>' : '') + '</td><td>' + x.sup + '</td><td>' + (x.family ? 'sinul ' : '') + eur(x.after) + ' kuus</td></tr>').join('') +
      '</tbody></table></div>' +
      '<p class="small-muted mb-0">Summad on enne tulumaksu, tänastes eurodes, iga variant kõige varem ja vähendamata. Kauem töötades lisandub palk, mida tabel ei näita, ja riiklik pension tõuseb tööaastate võrra. Ootetoetusele laste pensionilisa ei lisandu ja sellelt II sambasse sissemakseid ei tule (ettevaatlikud eeldused). Laste pensionilisa saab üks vanem: kumb, valite laste juures. Pere real on teise vanema pension näide: keskmine vanaduspension (44 a staaži) alates 1.04.2026, ' + eur(P.AVG_OLD_AGE_PENSION) + ' kuus.</p>';
  }
  // Eripensioni ja laste eest varem saadud vanaduspensioni võrdlus (KKK): ainult kui mõlemad õigused on sinul ja lähed varem.
  function spCompareShown(input) {
    return !!(input.spHas && input.spMonthly > 0 && input.soodus > 0 && !input.flexEarly && input.kids.earlyUser === 'me' && P.earlyYears({ kids: input.kids }) > 0);
  }
  function spCompare(input, pa) {
    const kidsY = P.earlyYears({ kids: input.kids });
    const run = (c) => {
      const sim = P.simulate(Object.assign({}, input, { firstPillarChoice: c, firstPillarChoicePa: undefined }), T, { id: 'E' });
      const m = (a) => { const r = sim.rows.find((x) => x.age === a) || {}; return (r.ispg || 0) + (r.i1g || 0); }; // kuus
      const ret = sim.pensionStartAge;
      let sum = 0;
      for (let a = ret; a < pa; a++) sum += m(a) * 12;
      return { ret, now: m(ret), sum, after: m(pa), atPa: sim.firstPillar && sim.firstPillar.atPa };
    };
    const sp = run('special'), old = run('oldAge');
    const supM = P.childSupplement(input), supOther = (input.kids.supUser || input.kids.user) === 'other';
    const supOld = supOther ? 'teisel vanemal' : !(supM > 0) ? '–' : input.kids.inForecast === 'unknown' ? 'pole arvestatud' : 'sinul alates ' + old.ret + ' a';
    const avg = P.AVG_OLD_AGE_PENSION, partner = avg * 12 * kidsY;
    const rows = [
      { c: 'special', name: 'Jätkan eripensioniga', parts: [sp.ret + '–' + (pa - 1) + ' a eripension ' + eur(sp.now) + ' kuus'], sum: sp.sum, sup: 'eripensionile ei lisandu', after: sp.after,
        afterNote: sp.atPa && sp.atPa.paid === 'oldAge' ? 'pensionieas vanaduspension' : '' },
      { c: 'oldAge', name: 'Laste eest vanaduspension', parts: [old.ret + '–' + (pa - 1) + ' a vanaduspension ' + eur(old.now) + ' kuus'], sum: old.sum, sup: supOld, after: old.after },
      { c: 'family', name: 'Pere kokku: sina eripensionil, teine vanem laste eest varem', family: true, note: 'näide, teise vanema andmeid Elukaar ei küsi; muuda laste valikus',
        parts: ['Sina: ' + sp.ret + '–' + (pa - 1) + ' a eripension ' + eur(sp.now) + ' kuus', 'Teine vanem: ' + kidsY + ' a pension u ' + eur(avg) + ' kuus (keskmine vanaduspension)'],
        sum: sp.sum + partner, sumNote: 'sinu ' + eur(sp.sum) + ' + teise vanema u ' + eur(partner), sup: 'võib saada teine vanem', after: sp.after },
    ];
    const cur = input.firstPillarChoice || (sp.now >= old.now ? 'special' : 'oldAge');
    const best = Math.max(sp.sum, old.sum);
    const th = (h) => '<th scope="col">' + h + '</th>';
    const spHigher = sp.now >= old.now;
    return '<p>' + (spHigher ? 'Sinu eripension on suurem kui laste eest saadav vanaduspension. Siis ei ole sul laste eest varem minekut vaja ja selle õigust võib paralleelselt kasutada teine vanem: tema läheb laste eest ' + kidsY + ' a varem pensionile.'
        : 'Laste eest saadav vanaduspension on sinu eripensionist suurem, seega on see sulle tõenäoliselt kasulikum.') + ' Seda saad muuta laste valikus „Varem pensionile mineku õigust kasutab“.</p>' +
      '<p>Laste pensionilisa lisandub ainult vanaduspensionile, eripensionile mitte. Kui jääd eripensionile, võib ka pensionilisa saada teine vanem (laste juures „Pensionilisa saab“). Kas see on teisele vanemale kasulik, vajab tema andmetega eraldi arvutust.</p>' +
      '<h4 class="h6 mb-2">Võrdlus: mis aitab valida?</h4>' +
      '<div class="table-responsive"><table class="table table-sm align-top mb-2"><thead><tr>' + th('Variant') + th('Kuni ' + pa + '. eluaastani') + th('Riigilt sulle kokku enne ' + pa + ' a') + th('Laste pensionilisa') + th('Sinu pension ' + pa + '-aastaselt') + '</tr></thead><tbody>' +
      rows.map((x) => '<tr' + (x.c === cur ? ' class="table-active"' : '') + '><th scope="row">' + x.name +
        (x.c === cur ? '<br><small class="fw-normal"><span aria-hidden="true">✓ </span>sinu valik</small>' : '') + (x.note ? '<br><small class="fw-normal">' + x.note + '</small>' : '') +
        '</th><td>' + x.parts.join('<br>') + '</td><td>' + eur(x.sum) + (x.sumNote ? '<br><small>' + x.sumNote + '</small>' : '') + (!x.family && x.sum === best ? ' <span class="badge text-bg-success">kõige rohkem</span>' : '') +
        '</td><td>' + x.sup + '</td><td>' + eur(x.after) + ' kuus' + (x.afterNote ? '<br><small>' + x.afterNote + '</small>' : '') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<p class="small-muted mb-0">Summad on enne tulumaksu, tänastes eurodes. Pere real on teise vanema pension näide: keskmine vanaduspension (44 a staaži) alates 1.04.2026, ' + eur(avg) + ' kuus. Pensionieas saad eripensioni ja vanaduspensioni vahel uuesti valida.</p>';
  }
  function rescueBasisNow() {
    if ($('rescueBasisWrap').classList.contains('d-none')) return undefined;
    const r = document.querySelector('input[name="rescueBasis"]:checked');
    return r ? r.value : 'mix';
  }
  // Valik on pensionile mineku sammus (kaardid); tekstid näitavad vanuseid sinu pensionieast.
  function renderRescueBasis() {
    const kidsY = P.earlyYears({ kids: kidsInput() }), resY = P.earlyYears({ kids: {}, rescueYears: rescueStaaz() });
    const show = kidsY > 0 && resY > 0;
    $('rescueBasisWrap').classList.toggle('d-none', !show);
    if (!show) return;
    const pa = parseInt($('pensionAgeYears').value, 10) || P.pensionAge(parseInt($('birthYear').value, 10) || 1980).years;
    const mix = kidsY < resY;
    $('rbMix').classList.toggle('d-none', !mix);
    const cur = document.querySelector('input[name="rescueBasis"]:checked');
    if (!mix && (!cur || cur.value === 'mix')) document.querySelector('input[name="rescueBasis"][value="pension"]').checked = true;
    $('rbMixTxt').textContent = 'Ootetoetus ' + (resY - kidsY) + ' a (' + (pa - resY) + '–' + (pa - kidsY - 1) + ' a), siis ' + (pa - kidsY) + '-aastaselt laste eest pension koos laste lisaga.';
    $('rbPensionTxt').textContent = kidsY + ' a varem (' + (pa - kidsY) + ' a) koos laste pensionilisaga. Ootetoetust ei võta.';
    $('rbToetusTxt').textContent = resY + ' a varem (' + (pa - resY) + ' a) kuni pensionieani. Laste lisa alles ' + pa + '-aastaselt.';
  }
  function soodusMax() { return P.earlyYears({ kids: kidsInput(), rescueBasis: rescueBasisNow(), hazard: $('hazard').value, hazardYears: $('hazard').value !== 'no' ? parseFloat($('hazardYears').value) || 0 : undefined, rescueYears: $('cRescue').checked ? parseInt($('rescueYears').value, 10) || 0 : 0 }); }
  // Mitu aastat varem inimene tegelikult läheb (0 … õiguse maksimum); vaikimisi maksimum. Õigus ei kohusta minema kõige varem.
  // Valik on alati: soodustuse piires vähendamata, üle selle (kuni 5 a) paindlik pension vähendusega.
  const optMax = () => Math.max(5, soodusMax());
  function soodusNow() {
    const max = soodusMax(), v = $('soodusYears').value;
    if ($('spHas').value === 'yes' && max === 0) return 0; // eripensioniga: varem vanaduspensioni ei võta
    return v === '' ? max : Math.min(optMax(), Math.max(0, parseInt(v, 10) || 0));
  }
  function renderSoodusYears() {
    const max = soodusMax(), top = optMax(), sel = $('soodusYears'), cur = sel.value, key = max + '/' + top;
    // Eripensioniga ja ilma muu varem mineku õiguseta: vanaduspensioni varem võtta pole mõtet (korraga makstakse ühte pensioni).
    const spOnly = $('spHas').value === 'yes' && max === 0;
    $('soodusYearsWrap').classList.toggle('d-none', spOnly);
    $('soodusSpNote').classList.toggle('d-none', !spOnly);
    const spA = parseInt($('spStartAge').value, 10);
    $('soodusSpNote').textContent = spOnly ? 'Eripensioni saad enne pensioniiga' + (spA ? ', alates ' + spA + '-aastaselt' : '') + ', seega vanaduspensioni varem võtta pole vaja. Korraga makstakse ainult ühte riiklikku pensioni: pensionieas valid, kas eripension või vanaduspension.' : '';
    if (spOnly && sel.value !== '0') { sel.value = '0'; sel.dataset.touched = ''; }
    if (sel.dataset.max !== key) {
      sel.innerHTML = Array.from({ length: top + 1 }, (_, i) => i).map((y) =>
        '<option value="' + y + '">' + (y === 0 ? 'ei lähe varem (tavalises pensionieas)' : y <= max ? y + ' a, vähendamata' + (y === max ? ' (kõige varem)' : '') :
          y + ' a, paindlik pension ' + pctTxt(-P.EARLY_DECREASE[y] || 0)) + '</option>').join('');
      sel.dataset.max = key;
      // Kasutaja enda valik jääb, kui see mahub uude vahemikku; muidu soodustuse maksimum (ilma soodustuseta 0).
      sel.value = sel.dataset.touched && cur !== '' && parseInt(cur, 10) <= top ? cur : String(max);
    }
  }
  document.querySelectorAll('input[name="rescueBasis"]').forEach((el) => el.addEventListener('change', syncPensionAge));
  // Viide võrdlusele: avab KKK kirje ja viib fookuse selle pealkirjale.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#rbCompareItem"], a[href="#spCompareItem"]');
    if (!a) return;
    e.preventDefault();
    const d = $(a.getAttribute('href').slice(1));
    d.open = true;
    d.scrollIntoView({ block: 'start' });
    d.querySelector('summary').focus();
  });
  $('soodusYears').addEventListener('change', (e) => { if (e.isTrusted || e.detail !== 'auto') $('soodusYears').dataset.touched = '1'; });
  // Pensionile minek (soodustusega varem). Tavaline pensioniiga on input.pensionAgeYears.
  function pensionAgeValue() { return parseInt($('pensionAgeYears').value, 10) - soodusNow(); }
  function syncPensionAge() {
    renderRescueBasis();
    renderSoodusYears();
    const rule = P.pensionAge(parseInt($('birthYear').value, 10) || 1980);
    if (!paTouched) $('pensionAgeYears').value = String(rule.years);
    const sd = soodusNow();
  }
  // Käsitsi valitud pensioniiga jääb alles ka siis, kui sünniaasta muutub.
  $('pensionAgeYears').addEventListener('change', () => { paTouched = true; syncPensionAge(); });
  // Väljaspool vahemikku sünniaasta on viga sammus „Sina“ (sinaCheck); arvutus kasutab seni lähimat lubatud aastat.
  $('birthYear').addEventListener('input', syncPensionAge);
  // Laste read tekivad laste arvu järgi; sünniaasta näitab või peidab kuu välja.
  ['kidsCount', 'kidsHas'].forEach((id) => { $(id).addEventListener('input', renderKids); $(id).addEventListener('change', renderKids); });
  // Lapse read tekivad hiljem, seega kuulame konteinerit (tavalised väljad saavad update'i allpool).
  $('kidsList').addEventListener('input', (e) => { if (/^kidsII\d/.test(e.target.id)) delete e.target.dataset.auto; if (/^kidsII13_/.test(e.target.id)) e.target.dataset.touched = '1'; syncPensionAge(); update(); });
  $('kidsList').addEventListener('change', () => { syncPensionAge(); update(); });
  // Lühikese või vale aasta veateade näidatakse alles väljalt lahkudes (mitte trükkimise ajal).
  $('kidsList').addEventListener('focusout', (e) => { if (/^kidsBorn/.test(e.target.id)) setTimeout(renderKids, 0); });
  ['kidsCount', 'hazardYears', 'rescueYears', 'cRescue', 'spHas', 'spStartAge', 'kidsDisabled', 'kidsEarlyUser', 'kidsHas', 'hazard', 'soodusYears', 'kidsSupUser'].forEach((id) => { $(id).addEventListener('change', syncPensionAge); $(id).addEventListener('input', syncPensionAge); });

  // ---------- Sündmused ----------
  ['fund18Fund', 'fundNew'].forEach((id) => {
    $(id).innerHTML = Object.entries(FUNDS).map(([k, f]) => '<option value="' + k + '">' + f.name + ' (' + pct(f.r) + ' a)</option>').join('');
  });
  ['fundCur', 'fund3Cur'].forEach((id) => { $(id).innerHTML = Object.entries(FUNDS).map(([k, f]) => '<option value="' + k + '">' + pct(f.r) + ' aastas (' + f.name.replace(/ \(.*\)$/, '').toLowerCase() + ')</option>').join(''); });
  $('fund18Fund').value = 'index';
  $('fundCur').value = 'mix';
  $('fund3Cur').value = 'mix';
  $('fundNew').value = 'index';

  document.addEventListener('click', (e) => {
    // „Muuda valik“: muudab riikliku pensioni edasilükkamise kohe (A2-2 soovitus tulemuses).
    const sd = e.target.closest('[data-set-defer]');
    if (sd) {
      const r = document.querySelector('input[name="defer"][value="' + sd.dataset.setDefer + '"]');
      if (r) { r.checked = true; update(); }
      return;
    }
    const b = e.target.closest('[data-goto]');
    if (b) go(parseInt(b.dataset.goto, 10));
  });
  $('resetPkg').addEventListener('click', () => { delete overrides[readInput().pkg.id]; breakdownKey = null; update(); });
  // ---------- Tulemuse allalaadimine: Markdown ja PDF (printimine) ----------
  const txt = (el) => (el ? el.innerText.replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim() : '');
  // Peidetud sammu tekst (innerText jätab selle välja): plokkide vahele reavahe, nupud välja.
  function plain(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('button').forEach((b) => b.remove());
    c.querySelectorAll('p, li, br, h3, h4, tr').forEach((b) => b.after('\n'));
    return c.textContent.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // KKK sammudest, mis kasutajat puudutavad (vahele jäetud sammud ja peidetud küsimused välja): [küsimus, vastuse element]
  function faqItems() {
    const seen = new Set();
    // Peidetud = peidetud sammu sees (mitte samm ise, sest mitteaktiivne samm on alati peidus)
    return chapters.flatMap((ch, i) => (skipped(i) ? [] : [...ch.querySelectorAll('details.faq-item')].filter((d) => { const h = d.closest('.d-none, [hidden]'); return !h || h.contains(ch); })))
      .map((d) => [d.querySelector('summary').textContent.trim(), d.querySelector('.faq-body')])
      .filter(([q, b]) => b && !seen.has(q) && seen.add(q));
  }
  // Kõik akordionid lahti, et fail sisaldaks ka nende sisu; pärast taastatakse kasutaja olek.
  function withAllOpen(fn) {
    const ds = [...$('dlMd').closest('.chapter').querySelectorAll('details')];
    const was = ds.map((d) => d.open);
    ds.forEach((d) => { d.open = true; });
    try { return fn(); } finally { ds.forEach((d, i) => { d.open = was[i]; }); }
  }
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
    // Sinu otsused: vanus, valik ja reegel (otsuste kaart on ridade sees).
    const recap = [...document.querySelectorAll('#recap li[data-row]')].map((li) => '- ' + (li.querySelector('.res-age') && txt(li.querySelector('.res-age')) ? txt(li.querySelector('.res-age')).replace(/\s+/g, ' ') + ': ' : '') +
      '**' + txt(li.querySelector('h5')) + '**' + (li.querySelector('.res-now') ? ': ' + txt(li.querySelector('.res-now')) : '') +
      [...li.querySelectorAll('.res-rule')].map((p) => '\n  ' + txt(p)).join(''));
    const costs = pkgLines(input.pkg, input.household).map((l) => '| ' + l[1] + ' | ' + eur(lineValue(input.pkg, l)) + ' |').join('\n');
    const warn = $('actionWarn').classList.contains('d-none') ? '' : '> ' + txt($('actionWarn')).replace(/Proovi seda$/, '').trim() + '\n\n';
    const legacy = $('legacy').querySelector('.legacy-card') ? ['## ' + txt($('legacy').querySelector('h3')), '', plain($('legacy')).split('\n').slice(1).join('\n'), ''] : [];
    const faq = faqItems().map(([q, b]) => '### ' + q + '\n\n' + plain(b));
    return [
      '# Tulevane Mina: minu pensionilugu', '', '_Koostatud ' + today + '. Prototüüp, mitte finants- ega maksunõu. Summad on tänastes eurodes._', '',
      '## Tulemus', '', txt($('answer')).replace(/\s*Selgitus: [^\n]*$/, ''), '', warn + metrics.join('\n'), '',
      '## Graafiku kokkuvõte', '', [...$('chartSummary').querySelectorAll('li')].map((li) => '- ' + txt(li)).join('\n'), '',
      '### Kuidas graafikut lugeda', '', plain($('chartExplain')), '',
      ...legacy,
      '## Sinu andmed', '',
      '- Sünniaasta: ' + input.birthYear + ', sugu: ' + (input.sex === 'N' ? 'naine' : 'mees') + ', pensioniiga: ' + pa + ' a',
      '- Riiklik pension: ' + eur(input.p1Monthly) + ' kuus enne tulumaksu (tulumaks 22% summalt, mis ületab pensionäri maksuvaba tulu ' + eur(P.PENSIONER_ALLOWANCE / 12) + ' kuus)',
      '- II sammas praegu: ' + eur(input.p2) + ', III sammas praegu: ' + eur(input.p3Base),
      '- Brutopalk: ' + eur(input.grossMonthly) + ' kuus, II samba makse ' + pct(input.p2Rate) + ', III sambasse ' + eur(input.p3Monthly) + ' kuus',
      '- Tootlus pärast inflatsiooni: II sammas ' + pct(input.realReturn) + ', III sammas ' + pct(input.realReturn3) + ' aastas', '',
      '## Sinu otsused', '', recap.join('\n'), '',
      '## Kulud: ' + input.pkg.name + (input.edited ? ' (muudetud)' : '') + ', ' + eur(input.needMonthly) + ' kuus', '',
      'Pensionil elan: ' + (input.household === 'paar' ? 'paaris (summad ühe inimese kohta)' : 'üksi'), '',
      '| Kulu | Summa kuus |', '| --- | --- |', costs, '',
      '## Sissetulek ja kulud vanuse järgi', '', mdTable($('chartTableWrap').querySelector('table')),
      '## Väljamakse teed kõrvuti', '', mdTable($('compare')),
      ...(faq.length ? ['## Korduma kippuvad küsimused', '', faq.join('\n\n'), ''] : []),
      '---', 'Tulevane Mina · Tuleva häkaton 2026 · reeglid: Pensionikeskus ja Sotsiaalkindlustusamet',
    ].join('\n') + '\n';
  }
  $('dlMd').insertAdjacentHTML('afterbegin', ico('download') + ' ');
  $('dlPdf').insertAdjacentHTML('afterbegin', ico('download') + ' ');
  $('dlMd').addEventListener('click', () => {
    const blob = new Blob([withAllOpen(buildMarkdown)], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tulevane-mina-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('dlPdf').addEventListener('click', () => {
    // Prindivaates on avatud võrdlustabel ja otsuste kaart; PDF-i saab salvestada brauseri printimisaknast.
    $('dlMd').closest('.chapter').querySelectorAll('details').forEach((d) => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
    // Prindivaates on näha ainult tulemuse samm: teiste sammude KKK lisatakse sinna ajutiselt.
    const faq = faqItems();
    const old = $('printFaq'); if (old) old.remove(); // afterprint ei käivitu igas brauseris
    if (faq.length) {
      const sec = document.createElement('section');
      sec.id = 'printFaq'; sec.className = 'faq mt-4';
      sec.innerHTML = '<h3 class="h5">Korduma kippuvad küsimused</h3>';
      faq.forEach(([q, b]) => { const h = document.createElement('h4'); h.className = 'h6 mt-3'; h.textContent = q; sec.append(h, b.cloneNode(true)); });
      $('compare').closest('details').after(sec);
    }
    window.print();
  });
  window.addEventListener('afterprint', () => {
    $('dlMd').closest('.chapter').querySelectorAll('details').forEach((d) => { d.open = d.dataset.wasOpen === '1'; });
    const pf = $('printFaq'); if (pf) pf.remove();
  });

  // Uude aknasse avanevad lingid: ikoon ja ekraanilugejale „(avaneb uues aknas)“ (WCAG G201).
  // Kasutatakse ka hiljem lisatud sisul (selgituste modaal, KKK).
  function decorateExt(root) {
    root.querySelectorAll('a[target="_blank"]').forEach((a) => {
      if (a.dataset.ext) return;
      a.dataset.ext = '1';
      a.classList.add('ext-link');
      a.insertAdjacentHTML('beforeend', ' ' + ico('external') + '<span class="visually-hidden"> (avaneb uues aknas)</span>');
    });
  }
  decorateExt(document);

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
  }
  $('p3Joined').addEventListener('change', () => { syncP3Fields(); go(skipped(step) ? shownSteps().find((i) => i > step) : step, false); });
  syncP3Fields();
  window.matchMedia('(max-width: 575px)').addEventListener('change', () => { if (step === LAST) update(); });
  // Täis / pool / edasi: „täis“ paneb aastad nulli, pool ja edasi vähemalt 1 aasta (aastad on raadio „defer“).
  document.querySelectorAll('input[name=p1Mode]').forEach((el) => el.addEventListener('change', () => {
    const d = parseInt(radio('defer') || '0', 10), want = el.value === 'full' ? 0 : Math.max(1, d);
    const r = document.querySelector('input[name=defer][value="' + want + '"]');
    if (r) r.checked = true;
    update();
  }));
  $('backBtn').addEventListener('click', () => move(-1));
  $('nextBtn').addEventListener('click', () => move(1));
  document.querySelectorAll('.chapter input, .chapter select').forEach((el) => {
    if (el.closest('#packages') || el.closest('#legacy') || el.closest('#deferChoices') || el.name === 'p1Mode') return;
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

  // ---------- Samm „Sina“: nimekiri ----------
  // Iga osa avaneb ja sulgub eraldi (mitte akordion). Kinni olles kokkuvõte linnukesega või „Täitmata“.
  // „Valmis“ nuppu pole: väärtus salvestub sisestamisel, viga näidatakse väljalt lahkumisel (change) ja kaob parandamisel kohe.
  // Lapsed ja tööga seotud erijuhud on valikulised: „+ Lisa …“ avab osa, „Eemalda …“ lähtestab selle valikud.
  const SINA = [...document.querySelectorAll('#sinaList > li')];
  const secKey = (li) => li.dataset.sec;
  const secOpen = {}, secAdded = {}, sinaErr = {};
  // Nimed on unikaalsed (WCAG 2.4.6): ekraanilugeja kuuleb „Muuda III sammast“, nähtav on „Muuda“.
  const SEC_ACT = {
    me: { muuda: 'Muuda oma andmeid', taida: 'Täida oma andmed', sulge: 'Sulge oma andmed' },
    state: { muuda: 'Muuda riiklikku pensioni', taida: 'Täida riikliku pensioni andmed', sulge: 'Sulge riiklik pension' },
    p2: { muuda: 'Muuda tööd ja II sammast', taida: 'Täida töö ja II samba andmed', sulge: 'Sulge töö ja II sammas' },
    p3: { muuda: 'Muuda III sammast', taida: 'Täida III samba andmed', sulge: 'Sulge III sammas' },
    kids: { muuda: 'Muuda laste andmeid', taida: 'Täida laste andmed', sulge: 'Sulge laste andmed', lisa: 'Lisa lapsed', why: 'Lapsed annavad pensionilisa ja võivad tuua pensioni varem.' },
    work: { muuda: 'Muuda erijuhte', taida: 'Täida erijuhud', sulge: 'Sulge erijuhud', lisa: 'Lisa erijuht', why: 'Tervist kahjustav töö, eripension, päästeteenistus või ametnik.' },
  };
  const optTxt = (id) => { const el = $(id); return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : ''; };
  const numVal = (id) => parseFloat($(id).value) || 0;
  const SEC_SUM = {
    me: () => 'Sündinud ' + $('birthYear').value + ' · ' + optTxt('sex').toLowerCase(),
    state: () => $('pensionAgeYears').value + '-aastaselt · ' + eur(numVal('p1Monthly')) + ' kuus',
    p2: () => 'Palk ' + eur(numVal('grossMonthly')) + ' kuus · II sammas ' + eur(numVal('p2')) + (numVal('p2Rate') > 0 ? ' · maksad ' + optTxt('p2Rate') : '') + ' · tootlus ' + pct(FUNDS[$('fundCur').value].r),
    p3: () => ($('p3Joined').value === 'none'
      ? 'Ei ole liitunud' + (numVal('p3Monthly') > 0 ? ' · avad ' + $('p3OpenAge').value + '-aastaselt, ' + eur(numVal('p3Monthly')) + ' kuus' : '')
      : eur(numVal('p3')) + ' · ' + eur(numVal('p3Monthly')) + ' kuus') + ' · tootlus ' + pct(FUNDS[$('fund3Cur').value].r),
    kids: () => kidsCount() + (kidsCount() === 1 ? ' laps' : ' last'),
    work: () => { const n = ['cHazard', 'cSp', 'cRescue', 'cCivil', 'cOther'].filter((id) => $(id).checked).length; return n ? n + ' erijuht' + (n > 1 ? 'u' : '') : 'Midagi pole valitud'; },
  };
  const included = (li) => !li.classList.contains('is-optional') || secAdded[secKey(li)];
  // Kontroll: tühi kohustuslik väli on „täitmata“ (edenemise rida), vale number on viga (väljal).
  // Veateates on alati välja nimi: ekraanilugeja võib selle kuulda alles järgmise välja juures.
  const FIELD_NAME = { birthYear: 'Sünniaasta', p1Monthly: 'Riikliku pensioni', grossMonthly: 'Brutopalga', p2: 'II samba summa', p3: 'III samba summa',
    p3Monthly: 'III samba sissemakse', kidsCount: 'Laste arvu', hazardYears: 'Nimekirja tööaastate', rescueYears: 'Päästeteenistuse aastate' };
  function sinaCheck(el) {
    const v = el.value.trim(), name = FIELD_NAME[el.id] || labelText(el);
    if (el.validity && el.validity.badInput) return name + ' väljale sisesta ainult number, näiteks 1200.';
    if (v === '') return el.hasAttribute('data-need') && el.dataset.touched === '1' ? name + ' väli on kohustuslik.' : '';
    if (el.type !== 'number') return '';
    const n = Number(v), lo = el.min !== '' ? +el.min : null, hi = el.max !== '' ? +el.max : null;
    if (el.id === 'birthYear' && (n < lo || n > hi || n % 1)) return 'Sünniaasta peab olema vahemikus ' + lo + '–' + hi + '.';
    if ((lo !== null && n < lo) || (hi !== null && n > hi)) return name + ' väljale sisesta number ' + (hi !== null ? 'vahemikus ' + lo + '–' + hi : 'vähemalt ' + lo) + '.';
    return '';
  }
  function showSinaErr(el) {
    const msg = sinaErr[el.id] || '', fid = el.id + 'Err';
    let fb = $(fid);
    if (!fb && msg) {
      // Abiteksti all, sama joondusega (Bootstrap näitab .invalid-feedback'i, kui eespool on .is-invalid väli).
      let at = el; while (at.nextElementSibling && at.nextElementSibling.classList.contains('form-text')) at = at.nextElementSibling;
      at.insertAdjacentHTML('afterend', '<div class="invalid-feedback" id="' + fid + '"></div>');
      fb = $(fid);
      el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + fid).trim());
    }
    if (fb) fb.textContent = msg;
    el.classList.toggle('is-invalid', !!msg);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  const needEls = (li) => [...li.querySelectorAll('[data-need], [required]')].filter((el) => isShown(el) && !el.disabled);
  const blockersIn = (li) => (included(li) ? needEls(li).filter((el) => el.value.trim() === '' || sinaErr[el.id]) : []);
  // Kohustuslikud [required] väljad (nt eripensioni algus) loeb missingIn ise; siin ainult [data-need].
  function sinaBlockers() { return SINA.flatMap(blockersIn).filter((el) => !el.required); }

  // Valikuline osa, millel on andmeid (profiil, laste „jah“, erijuhu linnuke), on lisatud ja avaneb.
  const hasData = { kids: () => $('kidsHas').value === 'yes', work: () => ['cHazard', 'cSp', 'cRescue', 'cCivil', 'cOther'].some((id) => $(id).checked) };
  function autoAdd() { Object.keys(hasData).forEach((k) => { if (!secAdded[k] && hasData[k]()) { secAdded[k] = true; secOpen[k] = true; } }); }
  // Lukus sammult edasi: ava osa, kus on esimene täitmata väli.
  function openSecOf(el) { const li = el.closest('#sinaList > li'); if (li && !secOpen[secKey(li)]) { secOpen[secKey(li)] = true; renderSina(); } }
  function renderSina() {
    autoAdd();
    SINA.forEach((li) => {
      const k = secKey(li), a = SEC_ACT[k], inc = included(li), open = inc && !!secOpen[k], ok = inc && !blockersIn(li).length;
      const body = $('body-' + k), btn = li.querySelector('[data-toggle]'), sum = li.querySelector('.opt-sum');
      body.hidden = !open;
      li.classList.toggle('is-open', open);
      // Lisamata valikuline osa: „+ Lisa …“ ja lühike põhjendus.
      btn.className = 'btn btn-sm ' + (!inc || !(open || ok) ? 'btn-outline-primary' : 'btn-link');
      // Nähtav ainult esimene sõna („Muuda“, „Sulge“, „Täida“), täisnimi ekraanilugejale (nähtav sõna nime alguses, WCAG 2.5.3).
      const act = open ? a.sulge : ok ? a.muuda : a.taida, sp = act.indexOf(' ');
      btn.innerHTML = !inc ? ico('plus') + a.lisa : act.slice(0, sp) + '<span class="visually-hidden">' + act.slice(sp) + '</span>';
      btn.id = !inc ? 'add-' + k : 'toggle-' + k; // mõõtmine loeb lisa-nuppe (b:add-kids)
      if (inc) btn.setAttribute('aria-expanded', String(open)); else btn.removeAttribute('aria-expanded');
      sum.hidden = open;
      sum.classList.toggle('is-empty', !!(inc && !ok)); // !!: undefined vahetaks klassi igal joonistusel
      sum.innerHTML = !inc ? a.why : ok ? ico('check') + SEC_SUM[k]() : 'Täitmata';
    });
    const miss = missingIn(0), bad = miss.filter((el) => sinaErr[el.id]), empty = miss.filter((el) => !sinaErr[el.id]);
    const core = SINA.filter((li) => !li.classList.contains('is-optional'));
    const done = core.filter((li) => !blockersIn(li).length).length;
    const tail = ' Lapsed ja erijuhud lisa siis, kui need sind puudutavad.';
    // Vigade kohta ütleb kõik sammu alguse veateade (req-error); siin ainult edenemine.
    $('sinaProgress').innerHTML = !miss.length ? 'Kõik vajalik on täidetud.' + tail
      : done === core.length ? 'Põhiosad on täidetud. Täida lõpuni ka lisatud osa.'
      : '<strong>' + done + ' / ' + core.length + '</strong> osa täidetud.' + tail;
    $('workNote').classList.toggle('d-none', miss.length > 0); // tühjade väljadega oleks „0 euroni“ eksitav
    $('nextHint').textContent = step !== 0 ? '' : empty.length ? 'Täitmata: ' + empty.slice(0, 3).map((el) => labelText(el).replace(/\?$/, '').toLowerCase()).join('; ') + (empty.length > 3 ? ' ja veel ' + (empty.length - 3) : '') : '';
  }
  // Algolek: eeltäidetud profiilil kolm esimest osa lahti (ülejäänud kokkuvõttena), nullist kõik põhiosad lahti.
  // Valikuline osa on lisatud, kui profiil või väli selle juba täitis.
  function initSina(prefilled) {
    autoAdd();
    SINA.forEach((li, i) => {
      const k = secKey(li);
      secOpen[k] = li.classList.contains('is-optional') ? !!secAdded[k] : !prefilled || i < 3 || blockersIn(li).length > 0;
    });
    renderSina();
  }
  // Veateate link välja juurde: ava osa, kus väli on, ja vii fookus väljale.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.req-error a[href^="#"]'), el = a && $(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault(); if (el.closest('#sinaList')) openSecOf(el);
    el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true });
  });
  $('sinaList').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]'), r = e.target.closest('[data-remove]');
    if (t) {
      const k = t.dataset.toggle, li = t.closest('li');
      // Fookus jääb samale nupule (nüüd „Sulge …“), see ei kao ära.
      if (!included(li)) { secAdded[k] = true; secOpen[k] = true; if (k === 'kids') { setSel('kidsHas', 'yes'); renderKids(); } renderSina(); svgify(li); t.focus(); return; }
      secOpen[k] = !secOpen[k]; renderSina();
      t.focus();
    } else if (r) {
      const k = r.dataset.remove;
      if (k === 'kids') setSel('kidsHas', 'no');
      else ['cHazard', 'cSp', 'cRescue', 'cCivil', 'cOther'].forEach((id) => { if ($(id).checked) { $(id).checked = false; $(id).dispatchEvent(new Event('change', { bubbles: true })); } });
      secAdded[k] = false; secOpen[k] = false;
      syncPensionAge(); update();
      $('add-' + k).focus();
    }
  });
  $('sinaList').addEventListener('input', (e) => {
    const el = e.target;
    if (sinaErr[el.id] && !sinaCheck(el)) { sinaErr[el.id] = ''; showSinaErr(el); }
    renderSina();
  });
  // Kontroll väljalt lahkudes: ka siis, kui tühja välja jäeti tühjaks (change siis ei teki).
  // Hiirega teise nupu peale minnes (nt „Edasi“) näidatakse viga alles pärast klikki: muidu nihutaks teade lehte
  // vajutuse ajal ja klikk läheks mööda.
  let pointerHeld = false, pendingCheck = null;
  const checkLeft = (el) => { el.dataset.touched = '1'; sinaErr[el.id] = sinaCheck(el); showSinaErr(el); renderSina(); };
  document.addEventListener('pointerdown', () => { pointerHeld = true; }, true);
  document.addEventListener('pointerup', () => { pointerHeld = false; setTimeout(() => { const el = pendingCheck; pendingCheck = null; if (el) checkLeft(el); }, 0); }, true);
  $('sinaList').addEventListener('focusout', (e) => {
    const el = e.target;
    if (el.tagName !== 'INPUT' || !el.hasAttribute('data-need')) return;
    if (pointerHeld) pendingCheck = el; else checkLeft(el);
  });
  // Lukus sammult edasi (raja klikk): kõik täitmata väljad saavad nimega veateate.
  function flagSinaEmpty() { sinaBlockers().forEach((el) => { el.dataset.touched = '1'; sinaErr[el.id] = sinaCheck(el); showSinaErr(el); }); renderSina(); }
  // „kohustuslik“ märge iga kohustusliku välja sildis (mitte tärn).
  document.querySelectorAll('#sinaList [data-need]').forEach((el) => { const l = document.querySelector('label[for="' + el.id + '"]'); if (l) l.insertAdjacentHTML('beforeend', ' <span class="req">kohustuslik</span>'); });

  syncPensionAge();
  // ---------- Algandmed maandumislehelt (?p=<profiil>) ----------
  // Profiilid on tüüpilised koguja profiilid (vt maandumisleht, profiilid.js); kõiki välju saab muuta.
  (function applyStartProfile() {
    const PROFILES = window.MINA_PROFILES || {};
    const id = new URLSearchParams(location.search).get('p');
    const pr = id && Object.prototype.hasOwnProperty.call(PROFILES, id) ? PROFILES[id] : null;
    if (!pr) { initSina(false); return; }
    Object.entries(pr).forEach(([field, v]) => { if (field === 'nimi') return; const el = $(field); if (!el) return; el.value = String(v); el.classList.add('is-prefilled'); });
    paTouched = true;
    syncPensionAge();
    p3OpenEl.value = String(readInput().p3OpenAge);
    switchEl.value = String(readInput().switchAge);
    syncP3Fields();
    update();
    initSina(true);
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

  // Graafiku vihje sulgub, kui puudutad graafikust väljapoole (mobiilis jääb see muidu ekraanile).
  ['touchstart', 'mousedown'].forEach((ev) => document.addEventListener(ev, (e) => {
    if (!chart || (e.target.closest && e.target.closest('#chart'))) return;
    chart.setActiveElements([]);
    if (chart.tooltip) chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    chart.update('none');
  }, { passive: true }));

  // Testikonks: ainult kui test seab window.__ELUKAAR_TEST enne lehe laadimist (tavakasutajale midagi ei avaldata).
  // ---------- Selgitused („?“ nupud ja dialoog) ----------
  // Nupp on sildi või grupi pealkirja kõrval (mitte sildi sees). Dialoog: showModal() → klaviatuurilõks, inertne taust
  // (ekraanilugeja ei loe muud lehte), Esc sulgeb; nimi = pealkiri (aria-labelledby); sulgedes fookus tagasi nupule.
  const ABI = window.ELUKAAR_ABI || {};
  const HELP_AT = { sex: 'label[for="sex"]', pensionAge: 'label[for="pensionAgeYears"]', p1: 'label[for="p1Monthly"]', gross: 'label[for="grossMonthly"]', household: 'label[for="household"]', soodusYears: 'label[for="soodusYears"]', p3Monthly: 'label[for="p3Monthly"]',
    hazard: 'label[for="hazard"]', sp: 'label[for="spHas"]', spStart: 'label[for="spStartAge"]', p2Rate: 'label[for="p2Rate"]', p3Joined: 'label[for="p3Joined"]', fundCur: 'label[for="fundCur"]',
    kidsWho: 'label[for="kidsCount"]', rescue: 'label[for="rescueYears"]', p2EarlyAge: 'label[for="p2EarlyAge"]', p3EarlyAge: 'label[for="p3EarlyAge"]' };
  const helpBtn = (key) => '<button type="button" class="help-btn" data-help="' + key + '" aria-haspopup="dialog" aria-controls="helpDialog">' + HELP_ICO +
    '<span class="visually-hidden">Selgitus: ' + ABI[key].title.replace(/[?:]$/, '') + '</span></button>';
  Object.entries(HELP_AT).forEach(([key, sel]) => {
    if (!ABI[key]) return;
    const lab = document.querySelector(sel);
    if (!lab) return;
    // Silt ja „?“ on ühes reasiseses lõigus: kaherealise sildi korral on nupp viimase sõna järel, mitte veeru paremas servas.
    const row = document.createElement('div');
    row.className = 'label-row';
    const line = document.createElement('span');
    line.className = 'label-line';
    lab.parentNode.insertBefore(row, lab);
    row.appendChild(line);
    line.appendChild(lab);
    line.insertAdjacentHTML('beforeend', '\u2060' + helpBtn(key)); // sõnaühendaja: „?“ ei murdu sildist eraldi reale
  });
  // Pealkirja „?“ (nagu väljagruppide legendidel): nupp pealkirja sees, mitte eraldi real.
  if (ABI.rescueBasis) $('rescueBasisTitle').insertAdjacentHTML('beforeend', helpBtn('rescueBasis'));
  document.querySelectorAll('#sinaList .opt-title[data-helpkey]').forEach((h) => {
    if (ABI[h.dataset.helpkey]) h.insertAdjacentHTML('beforeend', '\u2060' + helpBtn(h.dataset.helpkey));
  });
  // KKK: „Millal valida fondipension?“ ja „Kas saab alustada 60-aastaselt?“ 60 a ja pensioniea sammus.
  document.querySelectorAll('.kkk-fond').forEach((box) => {
    box.outerHTML = (window.ELUKAAR_KKK_FOND || []).map((k) => '<details class="faq-item faq-fond"><summary class="fw-medium">' + k.q + '</summary><div class="faq-body">' + k.html + '</div></details>').join('');
  });
  decorateExt(document);
  const dlg = $('helpDialog');
  let helpOpener = null;
  $('helpClose').insertAdjacentHTML('afterbegin', ico('x'));
  function openHelp(key, opener) {
    const h = ABI[key];
    if (!h || !dlg) return;
    helpOpener = opener;
    $('helpTitle').textContent = h.title;
    $('helpBody').innerHTML = h.html;
    decorateExt($('helpBody'));
    lockScroll();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('helpTitle').focus();
  }
  // Taust ei liigu: leht kinnitatakse paigale (ka iOS Safaris, kus overflow:hidden ei piisa) ja sulgedes taastatakse kerimiskoht.
  let lockY = 0;
  function lockScroll() {
    lockY = window.scrollY;
    const b = document.body.style;
    // Kerimisriba kaob: sama laiusega täide, et sisu ei nihkuks (paneel jääb ekraani servani).
    b.paddingRight = (window.innerWidth - document.documentElement.clientWidth) + 'px';
    document.documentElement.classList.add('scroll-locked');
    b.position = 'fixed'; b.top = -lockY + 'px'; b.left = '0'; b.right = '0'; b.width = '100%';
  }
  function unlockScroll() {
    const b = document.body.style;
    document.documentElement.classList.remove('scroll-locked');
    b.position = b.top = b.left = b.right = b.width = b.paddingRight = '';
    window.scrollTo({ top: lockY, left: 0, behavior: 'instant' });
  }
  function closeHelp() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', () => { unlockScroll(); if (helpOpener) helpOpener.focus({ preventScroll: true }); helpOpener = null; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeHelp(); }); // klõps taustal sulgeb
  // Klaviatuurilõks: Tab ja Shift+Tab ringlevad dialoogi sees (ka pealkiri, sulge-nupp ja lingid), mitte brauseri ribale.
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [$('helpTitle'), ...dlg.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((el, i, arr) => arr.indexOf(el) === i);
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  });
  $('helpClose').addEventListener('click', closeHelp);
  // Tulemuse lüliti: tuleviku hinnad (aria-pressed) ja selle selgitus.
  if (ABI.nominal) $('nominalRow').insertAdjacentHTML('beforeend', helpBtn('nominal'));
  $('nominalToggle').addEventListener('change', () => {
    nominal = $('nominalToggle').checked;
    $('nominalState').textContent = nominal ? 'sees' : 'väljas';
    update();
  });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-help]'); if (b) { e.preventDefault(); openHelp(b.dataset.help, b); } });

  if (window.__ELUKAAR_TEST) window.__elukaar = { readInput: readInput };

  // Mõõtmine (anonüümne, vt public/mootmine.js): elukaar avati, valikute klikid (ainult nimed, mitte summad) ja nupud.
  (function () {
    if (!window.minaMoot) return;
    const profiil = (new URLSearchParams(location.search).get('p') || '').replace(/[^a-z-]/g, '').slice(0, 20);
    window.minaMoot('elukaar', { p: profiil });
    const nimi = (t) => String(t).replace(/[^A-Za-z0-9:=_.-]/g, '').slice(0, 40);
    document.addEventListener('change', (e) => {
      if (!e.isTrusted) return;
      const t = e.target;
      if (mootSamm(step) === null) return; // eripensioni samm jääb mõõtmisest välja
      // Kiirmuutmine tulemuste lehel (rea alla tõstetud valikud): eraldi eesliide „q:“, samm jääb tulemuseks.
      const q = t.closest('#recap') ? 'q:' : '';
      if (t.type === 'radio') window.minaMoot('klikk', { samm: mootSamm(step), nimi: nimi(q + 'r:' + t.name + '=' + t.value) });
      else if (t.id === 'p3Joined') window.minaMoot('klikk', { samm: mootSamm(step), nimi: nimi('s:p3Joined=' + t.value) });
    });
    document.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      const b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (mootSamm(step) === null) return;
      if (b.closest('#path')) window.minaMoot('klikk', { samm: mootSamm(step), nimi: 'b:rada' });
      else if (b.id) window.minaMoot('klikk', { samm: mootSamm(step), nimi: nimi('b:' + b.id) });
    }, true); // capture: nupu oma käsitleja joonistab raja uuesti, enne kui sündmus dokumendini jõuaks
  })();

  go(0, false);
})();
