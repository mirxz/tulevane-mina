// Golden master: 13 algprofiili × stsenaariumid → põhinäitajad failis tests/golden/elukaar.json.
// Kui arvud muutuvad TEADLIKULT (reegel, valem), käivita: node tests/elukaar-golden.test.cjs --update ja vaata git diff üle.
// Kui kukub ootamatult, on midagi muutunud, mida keegi ei plaaninud.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { lae, andmed, juur } = require('./lib/lae.cjs');
const P = lae('public/elukaar/pension.js');
const T = andmed('elutabel.js');
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(juur, 'public/elukaar/profiilid.js'), 'utf-8'), { window: win });
const PROFILES = win.MINA_PROFILES;
const [A, B, C, D] = P.SCENARIOS;
const SC = { A, B, C: { ...C, deferral: 2 }, D, E: { id: 'E' }, E3: { id: 'E', deferral: 3 } };
const r0 = (x) => Math.round(x);

function toInput(p) {
  return { birthYear: p.birthYear, sex: p.sex, pensionAgeYears: p.pensionAgeYears, p1Monthly: p.p1Monthly, p2: p.p2, p3: p.p3,
    p3Before2021: p.p3Joined === 'before', grossMonthly: p.grossMonthly, p2Rate: Number(p.p2Rate), p3Monthly: p.p3Monthly,
    needMonthly: 791, realReturn: 0.02, depositReturn: 0, extraDeposit: 0 };
}
function snapshot() {
  const out = {};
  for (const [pid, p] of Object.entries(PROFILES)) {
    const input = toInput(p);
    out[pid] = { sustainable: {} };
    for (const [id, sc] of Object.entries(SC)) {
      const s = P.simulate(input, T, sc);
      const pa = P.retirementYears(input);
      const at = (a) => s.rows.find((x) => x.age === a) || {};
      out[pid][id] = {
        i1_65: r0((at(Math.max(pa, 65)).i1 || 0)), i1g_65: r0(at(Math.max(pa, 65)).i1g || 0), tax1_65: r0(at(Math.max(pa, 65)).tax1 || 0),
        i23_pa: r0(at(pa).i23 || 0), spend_80: r0(at(80).spend || 0), short_80: r0(at(80).shortfall || 0),
        money_pa: r0(at(pa).moneyLeft || 0), money_80: r0(at(80).moneyLeft || 0),
        summa_i2: r0(s.rows.reduce((t, x) => t + (x.i2 || 0) * 12, 0)),
        summa_tax: r0(s.rows.reduce((t, x) => t + (x.tax1 || 0) * 12, 0)),
      };
      out[pid].sustainable[id] = r0(P.sustainableNeed(input, T, sc));
    }
  }
  return out;
}
const file = path.join(juur, 'tests/golden/elukaar.json');
const now = snapshot();
if (process.argv.includes('--update') || !fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify(now, null, 1) + '\n');
  console.log('Golden master kirjutatud: ' + file + ' (' + Object.keys(now).length + ' profiili)');
  process.exit(0);
}
const gold = JSON.parse(fs.readFileSync(file, 'utf-8'));
let passed = 0; const fails = [];
const cmp = (path, a, b) => {
  if (a && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b || {})])) cmp(path + '.' + k, a[k], (b || {})[k]); }
  else if (a === b) passed++; else fails.push(path + ': oli ' + a + ', nüüd ' + b);
};
cmp('', gold, now);
if (fails.length) { console.error(fails.slice(0, 30).join('\n') + (fails.length > 30 ? '\n… +' + (fails.length - 30) : '')); console.error(`\nGolden master: ${fails.length} erinevust. Kui muutus on teadlik: node tests/elukaar-golden.test.cjs --update ja vaata diff üle.`); process.exit(1); }
console.log(`Golden master OK (${passed} väärtust)`);
