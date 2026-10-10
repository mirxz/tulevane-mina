// Reeglite fail (tests/reeglid.json): igal konstandil on allikas ja kuupäev ning mootor kasutab täpselt neid väärtusi.
const fs = require('fs');
const path = require('path');
const { lae, andmed, juur } = require('./lib/lae.cjs');
const P = lae('public/elukaar/pension.js');
const T = andmed('elutabel.js');
const R = JSON.parse(fs.readFileSync(path.join(juur, 'tests/reeglid.json'), 'utf-8'));
let passed = 0; const fails = [];
const check = (ok, m) => (ok ? passed++ : fails.push(m));

for (const [k, v] of Object.entries(R)) {
  if (k.startsWith('_')) continue;
  check(typeof v.allikas === 'string' && v.allikas.length > 5, k + ': allikas puudu');
  check(/^\d{4}-\d{2}-\d{2}$/.test(v.kontrollitud || ''), k + ': kontrollitud-kuupäev puudu');
  check(/^https:\/\//.test(v.url || ''), k + ': url puudu');
  check(Date.now() - Date.parse(v.kontrollitud) < 400 * 864e5, k + ': reegel on üle aasta üle vaatamata (' + v.kontrollitud + ')');
}
check(P.INCOME_TAX === R.tulumaks.vaartus, 'tulumaks mootoris ≠ reeglites');
check(P.PENSIONER_ALLOWANCE === R.pensionari_maksuvaba_tulu_kuus.vaartus * 12, 'maksuvaba tulu mootoris ≠ reeglites');
check(JSON.stringify(P.DEFERRAL_INCREASE) === JSON.stringify(R.edasilykkamine.tabel), 'edasilükkamise tabel mootoris ≠ reeglites');
check(Math.max(...Object.keys(P.DEFERRAL_INCREASE).map(Number)) === R.edasilykkamise_maksimum_aastad.vaartus, 'edasilükkamise maksimum ≠ 5 aastat');

// Mootori käitumine vastab reeglitele (mitte ainult konstandid).
const base = { birthYear: 1976, sex: 'M', p1Monthly: 1200, p2: 50000, p3: 0, p3Before2021: true, grossMonthly: 0, p2Rate: 0, p3Monthly: 0, needMonthly: 1500, realReturn: 0, depositReturn: 0, extraDeposit: 0 };
const s = P.simulate(base, T, { id: 'E' });
const x = s.rows.find((r) => r.i1g > 0);
check(Math.abs(x.tax1 - R.tulumaks.vaartus * (1200 - R.pensionari_maksuvaba_tulu_kuus.vaartus)) < 1e-6, 'riikliku pensioni tulumaks ≠ 22% × (1200 − 776)');
const s2 = P.simulate({ ...base, p1Monthly: 700 }, T, { id: 'E' });
check(s2.rows.find((r) => r.i1g > 0).tax1 === 0, 'pension alla maksuvaba piiri ei tohi maksustuda');
const d = P.simulate(base, T, { id: 'E', deferral: 1 });
check(Math.abs(d.rows.find((r) => r.i1g > 0).i1g - 1200 * (1 + R.edasilykkamine.tabel['1'])) < 1e-6, 'edasilükkamine 1 a ≠ tabeli +7,93%');
// III samba soodusiga: 'lump' enne 2021 liitunul 55, hiljem 60 (retirementYears + p3Age on mootori sees; kontrollime ridade algust ei saa → kontrollitakse decisionMapi kaudu)
const dm55 = P.decisionMap({ ...base, p3: 10000, p3Before2021: true }, T);
const dm60 = P.decisionMap({ ...base, p3: 10000, p3Before2021: false }, T);
const txt = (m) => JSON.stringify(m);
check(txt(dm55).includes('Alates 55'), 'enne 2021 liitunule peab otsusekaardil olema "Alates 55"');
check(txt(dm60).includes('Alates 60'), '2021 või hiljem liitunule peab otsusekaardil olema "Alates 60"');
check(R.iii_samba_soodusiga.enne_2021 === 55 && R.iii_samba_soodusiga.alates_2021 === 60, 'soodusiga reeglites');
// Dokumenteeritud erisus: 0,9% kuus ei ole sama mis tabeli +7,93% esimese aasta kohta (tõestame, et erisus on teada).
const kuine = 0.009 * 12;
check(Math.abs(kuine - R.edasilykkamine.tabel['1']) > 0.02 && /ERISUS/.test(R.edasilykkamine.kommentaar), 'erisus 0,9%/kuus vs 7,93%/aastas peab olema dokumenteeritud');
if (fails.length) { console.error(fails.join('\n')); console.error(`\n${passed} läbis, ${fails.length} kukkus`); process.exit(1); }
console.log(`Reeglid OK (${passed} kontrolli)`);
