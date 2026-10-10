// Andmekihid: iga sisendi vaikeväärtus tuleb ühest kihist ja kasutaja näeb, millisest.
// Kiht on andmete päritolu, mitte teema. Kasutaja enda sisestatud väärtus on alati ülim ("sina").
// Uus allikas = uus kiht siin failis; kalkulaator ise ei muutu.
import { KULUD } from "./kulud.js";
import { ELUTABEL } from "./elutabel.js";

// Riikliku pensioni valemi parameetrid (1. aprill 2026). Allikad: SKA "Pensioni arvutamine" (06.04.2026), õiguskantsleri kiri "Pensioni suurus" (2026-05),
// sotsiaalministri määrus (2025. a pensionikindlustuse osa keskmine 4 845,72 €), EMTA "Maksumuudatused 2026" (886 € kuu alammäär).
export const RIIK = {
  baasosa: 399.24,          // € kuus, kõigile ühesugune
  aastahind: 10.477,        // € kuus ühe staažiaasta või koefitsiendi kohta
  keskmineSotsmaksPk: 4845.72, // 2025. a isikustatud sotsiaalmaksu pensionikindlustuse osa keskmine (kehtib 1.4.2026 pensionidele)
  pkOsa: 0.20,              // 20% brutopalgast läheb pensionikindlustusse (33% sotsiaalmaksust)
  minPalk: 886,             // sotsiaalmaksu kuu alammäär 2026
  indeksSotsmaks: 0.8,      // indeks = 80% sotsiaalmaksu kasv + 20% THI
  indeksThi: 0.2,
  keskmineVanaduspension: 860.23, // € kuus, 1.4.2026
  maksuvabaPensionaril: 776,       // € kuus, 2026 (ei modelleeritud)
};

export const KIHID = {
  seadus: {
    nimi: "Seadused ja riik",
    chip: "Seadus",
    allikas: "Tulumaksuseadus, pensioniseadus, Sotsiaalkindlustusamet (SKA) 2026",
    sisu: [
      "Riik lisab II sambasse 4% palgast, kui maksad ise 2%, 4% või 6%",
      "Ühekordse, osalise ja lühikese fondipensioni tulumaks 10%, pikk fondipension 0%",
      "III samba tulumaksutagastus 22% kuni 6 000 € või 15% aastatulust",
      "III sammas avaneb 55 (liitusid enne 2021) või 60 (2021 ja hiljem)",
      "Riiklik pension = baasosa 399,24 € + 10,477 € × (staažiaastad kuni 1998 + aastakoefitsientide summa), 1.4.2026 väärtused",
      "Aastakoefitsient = aasta sotsiaalmaksu pensionipõhine osa ÷ keskmine sotsiaalmaksu pk-tulu (4 845,72 €); alates 2021 pooled palgaosa ja pooled võrdne osa",
      "Indekseerimine igal 1. aprillil: 80% sotsiaalmaksu kasv + 20% tarbijahinnaindeks",
      "Riikliku pensioni edasilükkamine: +7,93% (1 a) kuni +51,57% (5 a), SKA 2026 keskmised",
    ],
  },
  statistika: {
    nimi: "Statistikaamet",
    chip: "Statistikaamet",
    allikas: "RV045/RV046 (elutabel " + ELUTABEL.aasta + "), LE205 (pensionäride kulud, uuring " + KULUD.uuringuaasta + "), IA002 (hinnad " + KULUD.hinnad + ")",
    sisu: [
      "Ellujäämise tõenäosus vanuse ja soo järgi ning elada jäänud aastad",
      "Pensionäride keskmised kulud 12 kategoorias, üksi ja paaris",
      "Hinnaindeks, millega kulud on tänasesse rahasse viidud",
    ],
  },
  tuleva: {
    nimi: "Tuleva aruanded",
    chip: "Tuleva aruanded",
    allikas: "TulevaEE/reporting-engine (avalikud agregaadid): savers_analysis, member_analysis, ii_iii_wealth_distribution",
    sisu: [
      "Tüüpilised kogujad (personad): palk, vara, vanus, III samba sissemakse",
      "Fondi tasu: Tuleva 0,28% aastas, Eesti keskmine II samba fond 0,74%",
      "Eesti kõigi kogujate varajaotus (II+III kokku, kümnendikud)",
    ],
  },
  konto: {
    nimi: "Sinu Tuleva konto",
    chip: "Tuleva konto",
    allikas: "Tuleva API (onboarding-client): /v1/me, /v1/me/capital, /v1/contributions. Prototüübis on väljamõeldud liikme näidisandmed.",
    sisu: ["Sünnikuupäev, pensioniiga, II ja III samba vara, makse protsent, III liitumise aeg"],
  },
  eeldus: {
    nimi: "Eeldused",
    chip: "Eeldus",
    allikas: "Meelise mudel (tuleva-tulevik) ja häkatoni otsused",
    sisu: [
      "Tootlus pärast inflatsiooni 2% aastas, palk reaalselt ei kasva",
      "Riikliku pensioni reaalkasv 1,5% aastas (indekseerimise eeldus); 900 € kuus ainult käsitsi sisestamisel",
      "„Elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest",
    ],
  },
  sina: {
    nimi: "Sina",
    chip: "Sina",
    allikas: "Sinu sisestatud väärtus. Jääb ainult sinu brauserisse, midagi ei salvestata.",
    sisu: [],
  },
};

// Kulud kategooriate kaupa (€/kuus) leibkonna tüübi järgi, Statistikaamet.
export const KULUD_KAT = KULUD.kategooriad;
export const KULUD_META = { uuringuaasta: KULUD.uuringuaasta, hinnad: KULUD.hinnad, leibkonnad: KULUD.leibkonnad };
export const kuludKokku = (hh) => KULUD.kategooriad.reduce((a, c) => a + c[hh], 0);

// Fondi tasu valikud (Tuleva avaliku pensionikalkulaatori väärtused).
export const FONDITASUD = [
  { id: "tuleva", nimi: "Tuleva Maailma Aktsiate Pensionifond", tasu: 0.0028 },
  { id: "keskmine", nimi: "Eesti keskmine II samba fond", tasu: 0.0074 },
  { id: "null", nimi: "Tasu arvestamata", tasu: 0 },
];

// Alguspunktid. Iga alguspunkt on ühe kihi täielik komplekt vaikeväärtusi.
// Personad: savers_analysis (Tuleva reporting-engine, Metabase kaart 2324, kõik kogujad). Tuleva jagab kõik kogujad
// viieks üksteist välistavaks personaks (pillarite kasutus, kogumiskäitumine, kaasatus; numbrilisi piire aruanne ei anna).
// Iga persoona kohta on aruandes: inimesi, osa grupist, osa grupi varast, lahkunute osa, mediaanvanus, mediaanpalk,
// keskmine vara (AUM), keskmine III samba sissemakse aastas ja vabatahtlikku kõrgemat II määra maksvate osa.
// Need on gruppide keskmised, mitte ühe inimese andmed.
// Meie eeldused (nähtaval kaardil): vara jaotus II/III vahel = III samba AUM / kogu AUM (liikmed 142,2/448,1 = 31,7%; mitteliikmed
// 322,5/922,1 = 35,0%); II määr 6%, kui vähemalt pooled persoona kogujatest maksavad kõrgemat määra, muidu 2%;
// sugu on grupis sagedasem (mitteliikmetel naine 55%, liikmetel mees 60%); „Single Pillar“ = ainult III (tavalisem: liikmetel 59%, mitteliikmetel 76% on III).
const III_OSA = { liige: 142.2 / 448.1, mitteliige: 322.5 / 922.1 };
const PERSONAD = [
  // grupp, id, nimi (Tuleva silt), eesti nimetus, inimesi, osa grupist, osa grupi varast, lahkunud, vanus, palk, AUM, III €/a, II kõrgem määr (osa), ainultIII, märkus
  ["liige", "power", "Power Saver", "suurkoguja", 2515, 0.262, 0.469, 0.06, 42, 4301, 83626, 5193, 1.0, false, ""],
  ["liige", "steady", "Steady Saver", "stabiilne koguja", 3704, 0.385, 0.368, 0.16, 42, 2838, 44514, 1621, 0.64, false, ""],
  ["liige", "coaster", "Coaster", "libisev koguja", 753, 0.078, 0.05, 0.33, 41, 2417, 29751, 0, 0.0, false, "III samba sissemakse summat aruandes ei ole, eeldame 0 €."],
  ["liige", "single", "Single Pillar", "üks sammas", 1793, 0.186, 0.113, 0.26, 46, 2892, 28189, 3066, 0.48, true, "Eeldame, et sammas on III (59% selle persoona liikmetest kasutab III)."],
  ["liige", "gone", "Gone", "raha välja võtnud", 851, 0.088, 0.0, 0.56, 48, 2038, 0, 0, 0.05, false, "Vara Tuleva fondides on 0 €: raha on välja võetud või viidud mujale."],
  ["mitteliige", "power", "Power Saver", "suurkoguja", 3059, 0.035, 0.171, 0.07, 39, 3669, 51528, 4767, 1.0, false, ""],
  ["mitteliige", "steady", "Steady Saver", "stabiilne koguja", 14945, 0.17, 0.381, 0.16, 37, 2515, 23526, 1188, 0.52, false, ""],
  ["mitteliige", "coaster", "Coaster", "libisev koguja", 4027, 0.046, 0.074, 0.24, 36, 2275, 17028, 0, 0.0, false, "III samba sissemakse summat aruandes ei ole, eeldame 0 €."],
  ["mitteliige", "single", "Single Pillar", "üks sammas", 54739, 0.624, 0.373, 0.19, 36, 1727, 6290, 1537, 0.26, true, "Eeldame, et sammas on III (76% selle persoona mitteliikmetest kasutab III). Kõige tavalisem persoona."],
  ["mitteliige", "gone", "Gone", "raha välja võtnud", 10916, 0.124, 0.0, 0.79, 35, 1242, 0, 0, 0.07, false, "Vara Tuleva fondides on 0 €: raha on välja võetud või viidud mujale."],
];
function persona([grupp, kood, nimi, eesti, inimesi, osa, aumOsa, lahkunud, vanus, palk, aum, p3Aastas, korgem, ainultIII, markus]) {
  const p3 = ainultIII ? aum : Math.round((aum * III_OSA[grupp]) / 100) * 100;
  const sugu = grupp === "liige" ? "M" : "N";
  const gnimi = grupp === "liige" ? "liige" : "mitteliige";
  return {
    id: (grupp === "liige" ? "liige" : "mitte") + "-" + kood, grupp,
    nimi: nimi + ", " + gnimi,
    lyhi: nimi, eesti,
    kirjeldus: nimi + " (" + eesti + ")",
    kiht: "tuleva",
    allikas: "savers_analysis, Tuleva " + (grupp === "liige" ? "liikmed" : "mitteliikmed"),
    pers: { inimesi, osa, aumOsa, lahkunud, vanus, palk, aum, p3Aastas, korgem, markus },
    v: {
      sunniaasta: 2026 - vanus, sugu, p2: Math.max(0, aum - p3), p3, savings: 0, gross: palk,
      p2Rate: ainultIII ? 0 : korgem >= 0.5 ? 0.06 : 0.02, p3Monthly: Math.round(p3Aastas / 12 / 5) * 5, p3Before2021: false,
    },
  };
}

export const ALGUSPUNKTID = [
  ...PERSONAD.map(persona),
  {
    // Meelise näidiskonto (tuleva-tulevik, "Täida Tuleva konto andmetega"): väljamõeldud 58-aastane naine.
    id: "konto-naidis", grupp: "muu", nimi: "Tuleva konto näide", lyhi: "Tuleva konto näide", eesti: "58-aastane", kirjeldus: "Väljamõeldud liige, kelle andmed Tuleva saaks sisselogitud kasutajale eeltäita (Meelise prototüüp)",
    kiht: "konto", allikas: "tuleva-tulevik, näidiskonto",
    v: { sunniaasta: 1968, sugu: "N", p2: 38400, p3: 21700, savings: 0, gross: 2900, p2Rate: 0.04, p3Monthly: 150, p3Before2021: true, pensionAge: 66 },
  },
  {
    id: "tuhi", grupp: "muu", nimi: "Alusta tühjalt", lyhi: "Alusta tühjalt", eesti: "Eesti keskmine", kirjeldus: "Kõik väljad on statistika või eelduse vaikeväärtused, muuda ise",
    kiht: "eeldus", allikas: "Statistikaamet, eeldused",
    v: { sunniaasta: 1986, sugu: "N", p2: 8500, p3: 0, savings: 0, gross: 2000, p2Rate: 0.02, p3Monthly: 0, p3Before2021: false },
  },
];

// Vaikeväärtused, mis on kõigile alguspunktidele ühised ja mille päritolu on kihti sees.
export const URI_VAIKIMISI = {
  p1Mode: { v: "calc", kiht: "seadus", mark: "Riiklik pension arvutatakse seaduse valemiga (pensioniseadus, SKA 2026)." },
  p1Monthly: { v: 900, kiht: "eeldus", mark: "Meelise vaikeväärtus (kasutusel ainult käsitsi sisestamisel). Täpse summa saad SKA kalkulaatorist." },
  p1Growth: { v: 0.015, kiht: "eeldus", mark: "Projekti eeldus: pension kasvab reaalselt 1,5% aastas (80% palkade reaalkasvust). Pole seadus ega prognoos." },
  realReturn: { v: 0.02, kiht: "eeldus", mark: "Meelise vaikeväärtus: 2% aastas pärast inflatsiooni." },
  fond: { v: "tuleva", kiht: "tuleva", mark: "Tuleva Maailma Aktsiate Pensionifond, 0,28% aastas." },
  wageGrowth: { v: 0, kiht: "eeldus", mark: "Palk reaalselt ei kasva (Meelise mudel)." },
  horizon: { v: 0.10, kiht: "eeldus", mark: "Elu lõpuni = vanus, milleni jõuab elusalt 10% sinuvanustest." },
  household: { v: "uksi", kiht: "statistika", mark: "Statistikaamet LE205." },
};

// Eesti kõigi kogujate II+III samba vara (ii_iii_wealth_distribution, 2025, 924 849 inimest).
// Raport nimetab piire "kümnendikeks" D1–D9; D5 = 400 € on mediaan, seega loen neid protsentiilideks P10…P90.
// Vanuselõiget raportis ei ole, seega võrdlus on kõigi kogujatega, mitte sinuvanustega.
export const VARAJAOTUS = {
  allikas: "ii_iii_wealth_distribution (Tuleva reporting-engine), 2025, 924 849 inimest",
  nullVara: 0.43,
  mediaan: 400,
  mediaanNullita: 6500,
  protsentiilid: [0, 0, 0, 0, 400, 1800, 5500, 13200, 27000], // P10…P90, €
};
// Vähemalt nii suur osa kõigist kogujatest on sinust väiksema varaga.
export function varaKohtTurul(x) {
  const P = VARAJAOTUS.protsentiilid;
  if (x <= 0) return { vahemalt: 0, nullis: VARAJAOTUS.nullVara };
  let osa = VARAJAOTUS.nullVara; // kõik, kelle vara on 0 €
  for (let i = 4; i < P.length; i++) if (x >= P[i]) osa = (i + 1) / 10;
  return { vahemalt: osa, nullis: VARAJAOTUS.nullVara };
}

// Üksikud Tuleva aruannete faktid (avalikud agregaadid). Eurodes, mitte inimestes.
export const TULEVA_FAKTID = {
  keskmineLiige: 46604,       // savers_analysis: liikmete keskmine AUM
  keskmineMitteliige: 10516,  // savers_analysis: mitteliikmete keskmine AUM
  // fund_flow_analysis (Metabase 2326, jaan 2023 – märts 2026): pensionieas ühekordne (YKVAK+YKVAO) 3,446 M€
  // vs fondipension (FPAA+FPAA3) 0,286 M€ ja annuiteet (PLAV) 0,100 M€  =>  3,446 / 3,833
  uhekordneOsa: 3.446169 / (3.446169 + 0.28625 + 0.100444),
};
