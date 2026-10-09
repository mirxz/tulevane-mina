// Tulevane Mina – pensioniplaani mudel (häkatoni prototüüp 9.10).
// Kõik summad on tänases rahas (reaalväärtus). Sisendid on ainult prototüübi baasandmed; terviseandmeid ei küsita.
// Eeldused on illustratiivsed ja nähtaval (EELDUSED). See ei ole investeerimisnõu.

export const EELDUSED = {
  e65: { M: 15.9, N: 21.1 },          // eeldatav eluiga 65-aastaselt, Eurostat 2023 (sama kalibreering mis varasemas prototüübis)
  gompertz: 0.1,                       // suremuse kasvu kalle aastas
  fond: { indeks: 0.041, kallis: 0.034 }, // reaaltootlus pärast tasu: indeks 7,5% – inflatsioon 3% – tasu 0,3% / 1,0%
  pensionKasv: 0.015,                  // riikliku pensioni reaalkasv aastas (indekseerimine)
  ykskorraMaks: 0.10,                  // sammaste ühekordse väljamakse tulumaks
  sast: 0.0,                           // muude säästude reaaltootlus (hoius ≈ inflatsioon)
  turvaline: 0.10,                     // „elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest
};
// Paindliku pensioni kordajad (Sotsiaalkindlustusamet), aastat varem (−) või hiljem (+).
export const COEF = { "-5": -0.2298, "-4": -0.1889, "-3": -0.146, "-2": -0.1004, "-1": -0.0514, "0": 0, "1": 0.0557, "2": 0.1167, "3": 0.1835, "4": 0.257, "5": 0.3368 };
export const MAX = 105;

export function pensioniiga(sunniaasta) { return Math.round(65 + Math.max(0, sunniaasta - 1962) * 1.5 / 12); }

const A = {};
function cumH(a, x) { return a / EELDUSED.gompertz * (Math.exp(EELDUSED.gompertz * (x - 65)) - 1); }
function e65(a) { let s = 0; const dt = 0.05; for (let t = 0; t < 50; t += dt) s += Math.exp(-cumH(a, 65 + t + dt / 2)) * dt; return s; }
for (const sx of ["M", "N"]) { let lo = 1e-4, hi = 0.5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (e65(m) > EELDUSED.e65[sx]) lo = m; else hi = m; } A[sx] = (lo + hi) / 2; }
export const ellu = (sugu, x) => Math.exp(-cumH(A[sugu], x)); // ellujäämine 65-st (suhteline)
export function elusTn(sugu, alates, x) { return ellu(sugu, x) / ellu(sugu, alates); }
const JE = {};
export function jaakEluiga(sugu, x) { const key = sugu + x; if (JE[key] !== undefined) return JE[key]; let s = 0; const dt = 0.1; for (let t = 0; t < MAX + 10 - x; t += dt) s += elusTn(sugu, x, x + t + dt / 2) * dt; return (JE[key] = s); }
export function turvalineVanus(sugu, alates) { for (let x = alates; x < MAX; x += 0.25) if (elusTn(sugu, alates, x) <= EELDUSED.turvaline) return Math.round(x); return MAX; }
export function keskmineVanus(sugu, alates) { return alates + jaakEluiga(sugu, alates); }

// sisend: { sunniaasta, sugu, pension (€/kuus õigel ajal, tänases rahas), sammas (II+III, €), sast (muud säästud, €),
//           sissemakse (€/kuus kuni väljamakseni), fond: 'indeks'|'kallis', vajadus (€/kuus),
//           k (riikliku pensioni nihe aastates −5…+5), W (sammaste väljamakse algus, vanus), viis: 'fondipension'|'korraga' }
export function plaan(s, aasta = 2026) {
  const vanus = Math.max(30, Math.min(85, aasta - s.sunniaasta));
  const R = pensioniiga(s.sunniaasta), RP = R + s.k;
  const W = Math.max(vanus, s.W ?? R);
  const r = EELDUSED.fond[s.fond] ?? EELDUSED.fond.indeks;
  let pott = s.sammas, puhver = s.sast, korraga = false;
  const read = [];
  let otsas = null, kasutamata = 0;
  const algus = Math.min(vanus, 55);
  for (let x = vanus; x <= MAX; x++) {
    const tookas = x < Math.min(RP, W);
    // kogumine
    if (x < W) pott = pott * (1 + r) + (s.sissemakse || 0) * 12;
    // väljamakse algus
    if (x === W && s.viis === "korraga" && pott > 0) { puhver += pott * (1 - EELDUSED.ykskorraMaks); pott = 0; korraga = true; }
    let samba = 0;
    if (x >= W && pott > 0) { const e = Math.max(1, jaakEluiga(s.sugu, x)); samba = pott / e / 12; pott = (pott - samba * 12) * (1 + r); }
    const riik = x >= RP ? s.pension * (1 + COEF[String(s.k)]) * Math.pow(1 + EELDUSED.pensionKasv, x - RP) : 0;
    const sissetulek = riik + samba;
    // vajadust kaetakse sissetulekust; puudujääk säästudest, ülejääk läheb säästudesse
    let saastust = 0, ulejaak = 0;
    if (x >= Math.min(RP, W)) {
      const vahe = sissetulek - s.vajadus;
      if (vahe >= 0) { ulejaak = vahe; puhver += vahe * 12; }
      else { saastust = Math.min(-vahe, puhver / 12); puhver -= saastust * 12; if (saastust < -vahe - 0.5 && otsas === null) otsas = x; }
    }
    puhver *= 1 + EELDUSED.sast;
    read.push({ vanus: x, riik, samba, saastust, puudu: x >= Math.min(RP, W) ? Math.max(0, s.vajadus - sissetulek - saastust) : 0, ulejaak, vajadus: s.vajadus, elus: elusTn(s.sugu, vanus, x), pott, puhver, tookas });
  }
  const turv = turvalineVanus(s.sugu, vanus);
  const kesk = keskmineVanus(s.sugu, vanus);
  const katab = otsas === null || otsas >= turv;
  const pensionil = read.find((q) => q.vanus === Math.max(RP, W, vanus)) || read[0];
  return {
    vanus, R, RP, W, korraga, read, otsas, turv, kesk, katab,
    kuuSissetulek: pensionil.riik + pensionil.samba, riikKuu: pensionil.riik, sambaKuu: pensionil.samba,
    elusOtsas: otsas === null ? 0 : elusTn(s.sugu, vanus, otsas),
    lubatav: lubatav(s, aasta),
    jaakTurvVanuses: (read.find((q) => q.vanus === turv) || read.at(-1)).puhver,
  };
}

// suurim igakuine vajadus, mille plaan katab „elu lõpuni“ (10% ellujäämise vanuseni)
export function lubatav(s, aasta = 2026) {
  let lo = 0, hi = 10000;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; const p = plaanIlmaLubatavata({ ...s, vajadus: m }, aasta); if (p.otsas === null || p.otsas >= p.turv) lo = m; else hi = m; }
  return Math.floor(lo / 10) * 10;
}
function plaanIlmaLubatavata(s, aasta) {
  const p = { ...s };
  const vanus = Math.max(30, Math.min(85, aasta - s.sunniaasta));
  // sama arvutus ilma rekursioonita
  const R = pensioniiga(s.sunniaasta), RP = R + s.k, W = Math.max(vanus, s.W ?? R), r = EELDUSED.fond[s.fond] ?? EELDUSED.fond.indeks;
  let pott = s.sammas, puhver = s.sast, otsas = null;
  for (let x = vanus; x <= MAX; x++) {
    if (x < W) pott = pott * (1 + r) + (s.sissemakse || 0) * 12;
    if (x === W && s.viis === "korraga" && pott > 0) { puhver += pott * (1 - EELDUSED.ykskorraMaks); pott = 0; }
    let samba = 0;
    if (x >= W && pott > 0) { const e = Math.max(1, jaakEluiga(s.sugu, x)); samba = pott / e / 12; pott = (pott - samba * 12) * (1 + r); }
    const riik = x >= RP ? s.pension * (1 + COEF[String(s.k)]) * Math.pow(1 + EELDUSED.pensionKasv, x - RP) : 0;
    if (x >= Math.min(RP, W)) { const vahe = riik + samba - p.vajadus; puhver += vahe * 12; if (puhver < 0) { if (otsas === null) otsas = x; puhver = 0; } }
  }
  return { otsas, turv: turvalineVanus(s.sugu, vanus) };
}

export const nf = new Intl.NumberFormat("et-EE", { maximumFractionDigits: 0 });
export const eur = (v) => nf.format(Math.round(v)) + " €";
