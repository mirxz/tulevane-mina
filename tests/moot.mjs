// Mõõtmise vaated (src/aeg.js, src/moot.js): Tallinna aeg, tunnijaotus, kutsete konversioon, funnel, seansi pikkus. Ilma serverita.
// Kasutus: node tests/moot.mjs
import { tallinn, tanaPaev } from "../src/aeg.js";
import { tunniJaotus, kutseVaade, sundmusteVaade, seansiPikkused, mediaan, keskmine, mmss, tagasisideKanaliVaade, tunniTulbad, SAMMUD } from "../src/moot.js";
let ok = 0, fail = 0;
const check = (c, m) => { if (c) ok++; else { fail++; console.log("  ✗ " + m); } };
const nr = (html, re) => { const m = re.exec(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")); return m ? m.slice(1) : null; };

// Tallinna aeg: suveaeg UTC+3, talveaeg UTC+2; üleminek 2026-10-25 (04:00 → 03:00)
check(tallinn("2026-10-09T21:30:00Z").tund === 0 && tallinn("2026-10-09T21:30:00Z").paev === "2026-10-10", "21:30 UTC suvel on Tallinnas 00:30 järgmisel päeval");
check(tallinn("2026-12-01T22:30:00Z").tund === 0 && tallinn("2026-12-01T22:30:00Z").paev === "2026-12-02", "22:30 UTC talvel on Tallinnas 00:30 järgmisel päeval");
check(tallinn("2026-10-24T20:59:59Z").tund === 23 && tallinn("2026-10-24T21:00:00Z").tund === 0, "suveaja keskööpiir 21:00 UTC");
check(tallinn("2026-03-28T21:59:59Z").paev === "2026-03-28" && tallinn("2026-03-28T22:00:00Z").paev === "2026-03-29", "talveaja keskööpiir 22:00 UTC");
check(tallinn("2026-10-10T07:05:00Z").kell === "10:05", "kell vormindatud");
check(tallinn("hullumeelsus") === null, "vigane aeg → null");
check(tanaPaev(new Date("2026-10-10T21:30:00Z")) === "2026-10-11", "täna = Tallinna kuupäev, mitte UTC");

// Tunnijaotus: täna vs kõik päevad, päevad kokku
const now = new Date("2026-10-11T09:00:00Z"); // Tallinnas 12:00, 11.10
const rows = [{ ts: "2026-10-11T06:10:00Z" }, { ts: "2026-10-11T06:50:00Z" }, { ts: "2026-10-10T06:10:00Z" }, { ts: "2026-10-10T21:30:00Z" }];
const j = tunniJaotus(rows, now);
check(j.tana[9] === 2 && j.tana[0] === 1 && j.tana.reduce((a, b) => a + b, 0) === 3, "täna: 2 sündmust kell 09 ja 1 kell 00 (21:30 UTC eelmisel päeval) Tallinnas");
check(j.koik[9] === 3 && j.koik[0] === 1, "kõik päevad: 3 kell 09, 1 kell 00");
check(j.paevad.length === 7 && j.paevad[6].paev === "2026-10-11" && j.paevad[6].n === 3, "päevade tabel: täna on viimane ja sinna kuuluvad 00:30 Tallinnas sündmus (21:30 UTC eelmisel päeval)");
check(tunniTulbad(Array(24).fill(0), "x").includes("hb"), "tühi diagramm ei kuku kokku");

// Kutsed: konversioon
const saadetud = [{ variant: "a", ok: 20, vigu: 0 }, { variant: "b", ok: 10, vigu: 1 }];
const klikid = [{ ts: "2026-10-11T06:10:00Z", k: "kutse-a" }, { ts: "2026-10-11T06:11:00Z", k: "kutse-a" }, { ts: "2026-10-11T07:11:00Z", k: "kutse-b" }, { ts: "2026-10-10T07:11:00Z", k: "kutse-c" }];
const kv = kutseVaade(saadetud, klikid, now);
check(/kutse-a 20 2 10%/.test(kv.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")), "kutse-a: 20 saadetud, 2 klikki = 10%");
check(/kutse-b 10 \(1 viga\) 1 10%/.test(kv.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")), "kutse-b: 10 saadetud, 1 klikk = 10%");
check(/kutse-c 0 1 –/.test(kv.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")), "kutse-c: ilma saatmiseta konversioon on '–', mitte NaN/Infinity");
check(/Kokku 30 4 13%/.test(kv.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")), "kokku 30 saadetud, 4 klikki = 13%");
check(!/NaN|Infinity|undefined/.test(kv), "kutsevaade ilma NaN-ita");

// Seansi pikkus: keskmine ja mediaan; 0-pikkusega (üksik tegevus) seansid ei lähe arvesse
const T = (s) => "2026-10-11T" + s + "Z";
const seansid = [
  { k: "fb", p: "liige-steady", esimene: T("06:00:00"), viimane: T("06:03:00"), samm_max: 9, klikke: 4, maandus: 1, edasi: 1, elukaar: 1, tagasiside: 1 },
  { k: "fb", p: "", esimene: T("07:00:00"), viimane: T("07:00:00"), samm_max: -1, klikke: 0, maandus: 1, edasi: 0, elukaar: 0, tagasiside: 0 },
  { k: "", p: "valja", esimene: T("08:00:00"), viimane: T("08:01:00"), samm_max: 4, klikke: 2, maandus: 1, edasi: 1, elukaar: 1, tagasiside: 0 },
  { k: "", p: "tuhi", esimene: T("08:30:00"), viimane: T("08:30:00"), samm_max: 0, klikke: 0, maandus: 0, edasi: 0, elukaar: 1, tagasiside: 0 }, // otselink, üks tegevus
];
check(seansiPikkused(seansid).join() === "60,180", "seansi pikkused sekundites: 60 ja 180 (0 jääb välja)");
check(keskmine([60, 180]) === 120 && mediaan([60, 180]) === 120 && mediaan([1, 5, 9]) === 5 && mediaan([]) === null && keskmine([]) === null, "keskmine ja mediaan (paaris, paaritu, tühi)");
check(mmss(120) === "2:00" && mmss(75) === "1:15" && mmss(null) === "–" && mmss(NaN) === "–", "mm:ss vormindus");
check(seansiPikkused([{ esimene: "rikkis", viimane: T("06:00:00") }]).length === 0, "vigane aeg ei anna NaN-i");

// Funnel, seansi pikkus, eelprofiilid, sammud
const loendur = [
  { tund: "2026-10-11T06", ev: "maandumine", k: "fb", samm: -1, nimi: "", n: 2 },
  { tund: "2026-10-11T08", ev: "maandumine", k: "", samm: -1, nimi: "", n: 1 },
  { tund: "2026-10-11T06", ev: "samm", k: "fb", samm: 0, nimi: "", n: 1 }, { tund: "2026-10-11T06", ev: "samm", k: "fb", samm: 9, nimi: "", n: 1 },
  { tund: "2026-10-11T08", ev: "samm", k: "", samm: 0, nimi: "", n: 2 }, { tund: "2026-10-11T08", ev: "samm", k: "", samm: 4, nimi: "", n: 1 },
  { tund: "2026-10-11T06", ev: "klikk", k: "fb", samm: 0, nimi: "r:payout=fund", n: 3 }, { tund: "2026-10-11T06", ev: "klikk", k: "fb", samm: 9, nimi: "b:rada", n: 1 },
];
const sv = sundmusteVaade(seansid, loendur, [{ allikas: "fb" }, { allikas: "" }], now);
const txt = sv.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
check(/fb 2 2 \(100%\)? ?/.test(txt) || /fb 2/.test(txt), "funnel: fb 2 maandumist");
check(/fb 2 1 \(50%\) 1 \(100%\) 1 \(100%\) 1 \(100%\) 1 3:00 \/ 3:00 \(1\)/.test(txt), "funnel fb: maandus 2, edasi 1 (50%), elukaar 1, tulemus 1, tagasiside leht 1, vastas 1, pikkus 3:00: " + (/Kanal.*?Kokku/.exec(txt) || [""])[0].slice(0, 400));
check(/otse 1 1 \(100%\) 2 \(200%\) 0 \(0%\) 0 \(–\) 1 1:00 \/ 1:00 \(1\)/.test(txt), "funnel otse: otselink on elukaare avamisena (200% = ilma maandumiseta tulijad), pikkus 1:00");
check(/Kokku 3 2 \(67%\) 3 \(150%\) 1 \(33%\) 1 \(100%\) 2 2:00 \/ 2:00 \(2\)/.test(txt), "funnel kokku, keskmine ja mediaan 2:00: " + (/Kokku 3.{0,100}/.exec(txt) || [""])[0]);
check(/2:00 keskmine · 2:00 mediaan/.test(txt) && /Seansse arvestatud: 2/.test(txt), "seansi pikkuse kast: 2:00 keskmine, 2 seanssi arvestatud");
check(/liige-steady 1 1 1 100%/.test(txt) && /valja 1 1 0 0%/.test(txt), "eelprofiilide tabel (profiili kaudu edasi, avanes, jõudis tulemuseni)");
check(/0 · Sina 1 33% 3 3/.test(txt) && /9 · Tulemus 1 33% 1 1/.test(txt) && /4 · 55 a 1 33% 1 0/.test(txt), "sammutabel: kaugeim samm, vaatamised ja klikid: " + (/Samm Seansse.*?Enim/.exec(txt) || [""])[0].slice(0, 300));
check(/r:payout=fund 3/.test(txt) && /b:rada 1/.test(txt), "klikkide tabel (loendurist)");
check(!/NaN|Infinity|undefined|null/.test(sv), "sündmustevaade ilma NaN-ita");
check(!/Teekond:|Viimati \(|Viimased seansid|\bsid\b/i.test(txt), "vaates pole ühe kasutaja teekonda ega seansitunnust");
const tyhi = sundmusteVaade([], [], [], now);
check(!/NaN|Infinity|undefined|null/.test(tyhi) && /Veel pole/.test(tyhi), "tühjade andmetega ei kuku");

// Tunnijaotus loendurist kaalutuna: n=3 loendurit on 3 sündmust (Tallinnas 09:00 → UTC 06)
const lj = tunniJaotus([{ ts: "2026-10-11T06:30:00Z", n: 3 }, { ts: "2026-10-10T06:30:00Z", n: 2 }], now);
check(lj.tana[9] === 3 && lj.koik[9] === 5 && lj.paevad[6].n === 3 && lj.paevad[5].n === 2, "tunniloendur on kaalutud (n), mitte ridade arv");

// Tagasiside allika lõikes
const A = [{ ts: "2026-10-11T06:10:00Z", allikas: "fb", taitmine: "jah", vanus_vastus: "jah", uus: "jah", muudaks: "ei" }, { ts: "2026-10-11T06:10:00Z", allikas: "fb", taitmine: "ei", vanus_vastus: "ei", uus: "ei", muudaks: "jah" }, { ts: "2026-10-10T06:10:00Z", allikas: "", taitmine: "jah" }];
const tk = tagasisideKanaliVaade(A, now).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
check(/fb 2 50% 50% 50% 50%/.test(tk) && /otse 1 100%/.test(tk), "tagasiside kanalite kaupa: fb 2 vastajat");
check(tagasisideKanaliVaade([], now).includes("Veel pole"), "tühi tagasiside");

console.log(`\nMõõtmise vaated: ${ok} kontrolli läbis, ${fail} kukkus`);
process.exit(fail ? 1 : 0);
