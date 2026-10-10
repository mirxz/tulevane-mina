// Riikliku vanaduspensioni valem (riikliku pensionikindlustuse seadus; väärtused 1. aprill 2026).
// Kuupension = baasosa + aastahind × (staaž enne 1999 + Σ kindlustuskoefitsiendid 1999–2020 + Σ ühendosa koefitsiendid alates 2021).
//   kindlustuskoefitsient K  = isiku pensionikindlustuse sotsiaalmaks aastas / keskmine (2025: 4 845,72 €); K = 1, kui maksad keskmise sotsiaalmaksu.
//   ühendosa koefitsient     = (solidaarsuskomponent S + K) / 2; S = 1, kui sotsiaalmaks katab vähemalt 12 × 886 € (kuu alammäär), muidu võrdeline.
//   pensionikindlustuse osa  = 20% sotsiaalmaksust (33% sellest 20% läheb pensionikindlustusse).
// Indekseerimine iga 1. aprill: 80% pensionikindlustuse sotsiaalmaksu kasv + 20% tarbijahinnaindeks.
// Allikad: sotsiaalkindlustusamet.ee (pensioni arvutamine, 06.04.2026), õiguskantsler (Pensioni suurus, 2026-05),
//   sotsiaalministri määrus (2025. a keskmine isikustatud sotsiaalmaks 4 845,72), EMTA (886 € alammäär 2026).
// Mudel eeldab: palk kasvab keskmise palgaga (suhteline palk jääb samaks), tööd pensionini. Siin ei ole modelleeritud: lapsepõlve staaž,
// koefitsiendi ülempiire (kui neid on), kindlustusperioodide auke, töövõimetuspensionit, varem pensionile jäämist.
import { RIIK } from "./andmed/kihid.js";

export const KOEF_VAIKIMISI_TOOALGUS = 19; // eeldus: tööle asutud 19-aastaselt
const CURRENT_YEAR = 2026;

// Aastane koefitsient praeguse brutopalga (€/kuus) järgi.
export function koefitsiendid(gross) {
  const sots = Math.max(0, gross) * 12 * RIIK.pkOsa; // pensionikindlustuse osa aastas
  const K = sots / RIIK.keskmineSotsmaksPk;
  const S = Math.min(1, (Math.max(0, gross) * 12) / (12 * RIIK.minPalk));
  return { K, S, U: (S + K) / 2 };
}
const yrs = (a, b) => Math.max(0, b - a); // täisaastad poollõigus [a, b)

// Vaikimisi staaž enne 1999: tööaastad 19-aastaselt kuni 1998.
export function vaikimisiStaaz(birthYear) {
  return Math.min(40, yrs(birthYear + KOEF_VAIKIMISI_TOOALGUS, 1999));
}
// Vaikimisi seni kogutud koefitsiendid (1999–2025): eeldame, et suhteline palk on olnud sama mis täna.
export function vaikimisiVarasemKoef(birthYear, gross) {
  const { K, U } = koefitsiendid(gross);
  const start = Math.max(1999, birthYear + KOEF_VAIKIMISI_TOOALGUS);
  return yrs(start, 2021) * K + yrs(Math.max(2021, start), CURRENT_YEAR) * U;
}

// i = { birthYear, gross, pensionAge, staaz, varasemKoef, rho }
// Tagastab pensioni tänaste väärtustega (1.4.2026), pensioni jõudes (tänastes eurodes koos indekseerimisega) ja koostisosad.
export function riiklikPension(i) {
  const { K, S, U } = koefitsiendid(i.gross);
  const retYear = i.birthYear + i.pensionAge;
  const tulevikAastaid = yrs(CURRENT_YEAR, retYear);
  const tulevikKoef = tulevikAastaid * U; // tööd pensionini, sama suhteline palk
  const r = RIIK.aastahind;
  const osad = {
    baas: RIIK.baasosa,
    staaz: i.staaz * r,
    varasem: i.varasemKoef * r,
    tulevik: tulevikKoef * r,
  };
  const t = osad.baas + osad.staaz + osad.varasem + osad.tulevik;
  const rho = i.rho || 0;
  return { tana: t, pensionile: t * Math.pow(1 + rho, tulevikAastaid), osad, K, S, U, tulevikAastaid, tulevikKoef, koefKokku: i.staaz + i.varasemKoef + tulevikKoef };
}
