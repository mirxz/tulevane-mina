// Elukaar = Tuleva kogumiskalkulaator samadel tingimustel (TLV-86).
// Võrdlusarvud: TulevaEE/onboarding-client src/components/pensionCalculator/calculation.ts project() samade sisenditega
// (vanus 35, pensionile 65, palk 4000 €, II 6%, II 33 825 €, III 47 973 €, tootlus 2%, tasu 0, inflatsioon 2%), tänases rahas.
// Tuleva eeldused: palk +3% aastas, III makse nominaalselt sama. Tuleva arvutab kuu kaupa, elukaar aasta kaupa aasta keskpaiga
// inflatsiooniga (makse väärt 1 / 1,02^(t + 0,5)) → lubatud vahe 0,2%.
// Käivita: node tests/elukaar-tuleva-vordlus.test.cjs
const assert = require('assert');
const P = require('./lib/lae.cjs').lae('public/elukaar/pension.js');

const base = { birthYear: P.CURRENT_YEAR - 35, pensionAgeYears: 65, p2: 33825, p3: 47973, grossMonthly: 4000, p2Rate: 0.06, p3Monthly: 0, realReturn: 0 };
const tuleva = { wageGrowth: P.WAGE_GROWTH, inflation: P.INFLATION, p3Indexed: false };
// Vara pensionieas = mootori kogumistsükkel (simulate kasutab sama yearlyContribution-it).
const pot = (inp) => { let f = inp.p2 + inp.p3; for (let a = 35; a < 65; a++) f = f * (1 + inp.realReturn) + P.yearlyContribution(inp, a); return f; };
const near = (a, b, tol) => Math.abs(a / b - 1) <= tol;

const cases = [
  ['baas (III 0 €)', {}, 246499],
  ['III 450 € kuus', { p3Monthly: 450 }, 368544],
  ['ainult III sammas, 450 € kuus', { p3Monthly: 450, p2: 0, p2Rate: 0 }, 170019],
];
for (const [name, inp, ref] of cases) {
  const v = pot({ ...base, ...inp, ...tuleva });
  assert.ok(near(v, ref, 0.002), name + ': elukaar ' + Math.round(v) + ' vs Tuleva ' + ref);
}
// Eeldused on Tuleva omad ja ilma sisendita mootor ei kasvata palka (vanad testid, golden master).
assert.strictEqual(P.WAGE_GROWTH, 0.03);
assert.strictEqual(P.INFLATION, 0.02);
assert.strictEqual(P.wageFactor({ birthYear: 1990 }, 60), 1);
assert.strictEqual(P.p3Factor({ birthYear: 1990 }, 60), 1);
// Tänases rahas (aasta keskpaik): palk ~+0,98% aastas, III makse −1,96% aastas.
assert.ok(Math.abs(P.wageFactor({ birthYear: 1990, ...tuleva }, 37) - 1.03 / Math.pow(1.02, 1.5)) < 1e-12);
assert.ok(Math.abs(P.p3Factor({ birthYear: 1990, ...tuleva }, 37) - 1 / Math.pow(1.02, 1.5)) < 1e-12);
console.log('Tuleva kalkulaatori võrdlus OK');
