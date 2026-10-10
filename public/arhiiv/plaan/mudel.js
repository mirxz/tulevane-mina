// Tulevane Mina – pensioniplaani mudel (häkatoni prototüüp 9.10).
// Kõik summad on tänases rahas (reaalväärtus). Sisendid on ainult prototüübi baasandmed; terviseandmeid ei küsita.
// Eeldused on illustratiivsed ja nähtaval (EELDUSED). See ei ole investeerimisnõu.
import { ELUTABEL } from "./elutabel.js";

export const EELDUSED = {
  e65: { M: ELUTABEL.elada_jaanud.M[65], N: ELUTABEL.elada_jaanud.N[65] }, // elada jäänud aastad 65-aastaselt, Statistikaamet RV045
  elutabeliAasta: ELUTABEL.aasta,      // Statistikaameti elutabel (RV045, RV046), uuendus: python3 scripts/elutabel.py
  fond: { indeks: 0.041, kallis: 0.034 }, // reaaltootlus pärast tasu: indeks 7,5% – inflatsioon 3% – tasu 0,3% / 1,0%
  pensionKasv: 0.015,                  // riikliku pensioni reaalkasv aastas (indekseerimine)
  ykskorraMaks: 0.10,                  // sammaste ühekordse väljamakse tulumaks
  sast: 0.0,                           // muude säästude reaaltootlus (hoius ≈ inflatsioon)
  turvaline: 0.10,                     // „elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest
};
// Paindliku pensioni kordajad, aastat varem (−) või hiljem (+): Sotsiaalkindlustusameti 2026 keskmised.
// https://sotsiaalkindlustusamet.ee/pension-ja-seotud-huvitised/pensioni-liigid/paindlik-pension (uueneb igal 1. jaanuaril)
export const COEF = { "-5": -0.3067, "-4": -0.255, "-3": -0.1988, "-2": -0.1378, "-1": -0.0717, "0": 0, "1": 0.0793, "2": 0.1688, "3": 0.2701, "4": 0.385, "5": 0.5157 };
export const MAX = 105;

export function pensioniiga(sunniaasta) { return Math.round(65 + Math.max(0, sunniaasta - 1962) * 1.5 / 12); }

// Ellujäämine ja elada jäänud aastad: Statistikaameti elutabel (soo ja täisvanuse järgi, vahepeal lineaarselt).
// Üle 100 aasta tabel puudub: ellujääjad ja elada jäänud aastad lähenevad lineaarselt nullile MAX vanuseks.
function tabel(rida, x) {
  if (x >= MAX) return 0;
  if (x > 100) return rida[100] * (MAX - x) / (MAX - 100);
  const a = Math.max(0, Math.floor(x)), b = Math.min(100, a + 1), t = x - a;
  return rida[a] + (rida[b] - rida[a]) * t;
}
export const ellu = (sugu, x) => tabel(ELUTABEL.ellujaajad[sugu], x) / ELUTABEL.ellujaajad[sugu][0]; // ellujäämine sünnist
export function elusTn(sugu, alates, x) { const b = ellu(sugu, alates); return b > 0 ? ellu(sugu, x) / b : 0; }
export function jaakEluiga(sugu, x) { return Math.max(0.5, tabel(ELUTABEL.elada_jaanud[sugu], Math.min(x, MAX - 0.5))); }
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
