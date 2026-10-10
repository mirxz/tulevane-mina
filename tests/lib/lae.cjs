// Laeb brauserikoodi (IIFE, mis määrab module.exports või window.Pension) CommonJS-testidele.
// lae(tee, { incomeTax: false }) → mootor, mille simulate ja sustainableNeed arvutavad ilma tulumaksuta (Meelis Burgeti tuleva-tuleviku testid on kirjutatud
// maksuta mootori jaoks; tulumaksu kontrollivad eraldi testid).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const juur = path.join(__dirname, '..', '..');
function lae(tee, opts = {}) {
  const src = fs.readFileSync(path.join(juur, tee), 'utf-8');
  const m = { exports: {} };
  vm.runInThisContext('(function (module, exports) {' + src + '\n})')(m, m.exports);
  const api = m.exports;
  if (opts.incomeTax === false) {
    const sim = api.simulate, sus = api.sustainableNeed;
    return Object.assign({}, api, {
      simulate: (i, t, s, n) => sim({ ...i, incomeTax: false }, t, s, n),
      sustainableNeed: (i, t, s) => sus({ ...i, incomeTax: false }, t, s),
    });
  }
  return api;
}
// data/*.js failid on kujul "const X = {...};": loeme JSON-i välja.
function andmed(fail) {
  const s = fs.readFileSync(path.join(juur, 'public/data', fail), 'utf-8');
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
}
module.exports = { lae, andmed, juur };
