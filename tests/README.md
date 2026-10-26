# Elukaare automaattestid

Mida kontrollime, kuidas jooksutada ja mida testid **ei** tõesta. Viimati lisatud (töö pärast pensioniiga, pool pensioni, eripension, soodustus, lapsed, fondipensioni algus).

## Jooksutamine

```
npm run test:mootor      # kiired testid, brauserita (mootor, reeglid, golden master, invariandid)
npm run test:brauser     # brauseritestid (graafik, UI, ligipääsetavus); vajab töötavat `wrangler dev` serverit (port 8787)
npm test                 # mõlemad
npm run golden:uuenda    # kui arvud muutusid TEADLIKULT: kirjuta golden masterid uuesti ja vaata `git diff` üle
```

CI fail on `tests/ci-test.yml.txt`; tõsta see `.github/workflows/test.yml` alla (GitHub Desktop/käsitsi, kaitstud kaust).

## Testid tähtsuse järjekorras (elukaar)

| # | Fail | Autor | Kontrolle | Mida tõestab |
|---|---|---|---|---|
| 1 | `elukaar-invariandid.test.cjs` | Mirko + Claude | 42 929 | 300 juhuslikku sisendit × 6 stsenaariumi: reeglid kehtivad igal juhul. Raha ei teki ega kao, tulumaks = 22% × max(0, pension − 776), kulutus ≤ vajadus, rohkem raha ei anna väiksemat pensioni, edasilükkamine ja jätkusuutliku kulu piir. Seemnega juhuslikkus (korratav). |
| 2 | `elukaar-stsenaariumid.test.cjs` | Meelis Burget (tuleva-tulevik), porditud | 6 513 | Iga väljamakse viis (A–E) annab ristkontrollil sama vastuse eri sisenditel. |
| 3 | `elukaar-golden.test.cjs` + `golden/elukaar.json` | Mirko + Claude | 858 | 13 näidisprofiili × 6 stsenaariumi: põhinäitajad on lukus, iga arvu muutus tuleb ilmsiks. |
| 4 | `elukaar-graafik.mjs` + `golden/elukaar-graafik.json` | Mirko + Claude | 1 383 | 8 profiili × 2 vaadet (töölaud, mobiil): graafik = tabel = kokkuvõte, kulude joon alles pensionieast, "Elus %" ei kasva, tekstides pole NaN/undefined, axe ligipääsetavus. Kohalik Chart.js, ilma CDN-ita. |
| 5 | `elukaar-reeglid.test.cjs` + `reeglid.json` | Mirko + Claude | 35 | Iga konstant (22%, 776 €, 10%, 55/60 a, edasilükkamise tabel) on kirjas allika ja kuupäevaga ning mootor kasutab täpselt neid. Test kukub, kui allikas puudub või on üle aasta vana. Dokumenteerib erisuse "0,9% kuus" vs tabeli 7,93% esimese aasta kohta. |
| 6 | `elukaar-ui-raha.mjs` | Mirko + Claude | 45 | `story.js` loogika: III samba plaanid ja fondivahetus ei tekita ega kaota raha (`c3Adj`, `switchAdj`, `p3RemNow`). Kasutab testikonksu `window.__ELUKAAR_TEST`. |
| 7 | `elukaar-mootor.mjs` | Mirko + Claude | 102 | Fondipensioni makse järgib fondi väärtust (osakud / veel tegemata väljamaksed, KoPS § 52³ ja § 60¹), III samba langus, tulumaks ja maksuvaba tulu. |
| 8 | `elukaar-pohi.test.cjs` | Meelis Burget (tuleva-tulevik), porditud | 41 | Elada jäänud aastad, pensioniiga, edasilükkamise protsendid, kulutasemed. |
| 9 | `elukaar-eripension.test.cjs` | Mirko, Kadi + Claude | 49* | Eripension (TLV-69): algusvanus, pensionieas makstakse suurem kahest (eripension või vanaduspension), eripensioni ei saa edasi lükata (`options().deferral` lukus). |
| 10 | `elukaar-soodus.test.cjs` | Kadi + Claude | 38* | Soodustingimustel vanaduspension (lapsed, tervist kahjustav töö) muudab ainult pensionile minekut; töö soodustusega pensioni ajal (`soodusWork`, `workUntil`), III sissemakse pärast pensionile minekut (`p3After`). |
| 11 | `elukaar-lapsed.test.cjs` | Kadi + Claude | 29* | Laste kaks õigust eraldi (varem pensionile, pensionilisa), lisa 1,5 / 3,5 aastahinnet, tervist kahjustav töö (nimekiri 1 ja 2), sugu „Muu“ (meeste ja naiste keskmine elutabel). |
| 12 | `elukaar-fondipension-algus.test.cjs` | Kadi + Claude | 11* | Fondipensioni algus pärast pensioniiga: kasvatan edasi kuni valitud vanuseni, siis leping (`fundFrom`, `p3Sep.start`). |
| 13 | `elukaar-edasilykkamine.test.cjs` | Kadi + Claude | 6* | Elan sammastest, riiklik hiljem (C): `bestDeferral` leiab suurima edasilükkamise, millega kulud on kaetud. |
| 14 | `elukaar-too-ja-pool.test.cjs` | Kadi + Claude | 17* | Töö pärast pensioniiga kõigil (`workOn`, `workUntil`): palk katab kulud, töö ajal kogu pension 22% maksuga, iga tööaasta tõstab pensioni; edasilükkamine tasub end töötades varem ära. Pool riiklikku pensioni (`scenario.half`): pool, siis täis + pool edasilükkamise tõusust; ei kehti eripensioni ja soodustusega. |

\* `assert`-lausete arv koodis (test ei loenda kontrolle). Read 1–8: elukaare kontrolle kokku **51 906** (loetud 11.10; alloleval mõõtmise testid ei ole siin sees).

### Brauseritestid (UI)

| Fail | Mida tõestab |
|---|---|
| `elukaar-ui-valikud.mjs` | Lukustatud valikud puuduva samba korral, II ja III fondipension eraldi lepingutena, C vaikimisi uus leping igal aastal. |
| `elukaar-ui-eripension.mjs` | Eripension ja soodustingimustel pension liideses: sammud, lukud, töö eripensioni ja soodustuse ajal. |
| `elukaar-ui-fondipension.mjs` | Fondipensioni algus pensionipõlve sammus (66+). |
| `elukaar-ui-edasilykkamine.mjs` | Hoiatus, kui edasilükkamiseks sammaste raha ei jätku, ja nupp „Muuda valik“. |
| `elukaar-ui-abi.mjs` | „?“ selgitused: dialoog, fookus, Esc, axe. |
| `elukaar-ui-too-ja-pool.mjs` | Töötamise valik on kõigil (vaikimisi 1 a), „Kohe täis / Pool / Lükkan edasi“ ja aastad (raadio `defer`), eripensioniga lukus. `--pilt fail.png` teeb 6. sammust pildi. |

## Mõõtmise testid (tulemuste leht, `/api/e`)

| Fail | Kontrolle | Mida tõestab |
|---|---|---|
| `moot.mjs` | 34 | Tallinna aeg (suve-/talveaja ja keskööpiirid), tunnijaotus (loenduri kaaluga), kutsete konversioon (saadetud → klikid), funnel kanali kaupa, elukaare seansi keskmine ja mediaan pikkus, eelprofiilid, sammud, tagasiside allika lõikes; vaates pole ühe kasutaja teekonda. Puhtad funktsioonid, ilma serverita. |
| `moot-api.mjs` | 44 | `/api/e` valideerimine (robotid välja, vigased väärtused ja tundmatud väljad tagasi), avaleht → elukaar → tulemus → tagasiside, sisestatud arvud ei lähe mõõtmisse, tagasiside tunnus erineb seansi tunnusest, "Ära jälgi" lülitab välja, tulemuste lehel on uued sektsioonid, funnel-rida ja seansi pikkus. Käivita `TULEMUSED_PAROOL=… npm run test:brauser` (väärtus `.dev.vars` failist). |
| `privaatsus.mjs` | 67 | Analüütika põhimõtted ([ANALUUTIKA.md](../ANALUUTIKA.md)), ilma serverita: iga tabel on nimetatud (uus tabel nõuab otsust), mõõtmise tabelitel täpne veergude loetelu, sündmuste logi puudub, loendurid on seansita, tagasiside ja e-post ei jaga tunnust seansiga ega ühenda JOIN-iga, serveris ei loeta IP-d ega pandud küpsiseid, iga mõõtmiskutse on ülevaadatud, pärandtabelid ei kasva, privaatsusleht `/privaatsus/` on leitav ja vastab tegelikkusele. |
| `privaatsus-brauser.mjs` | 28 | Sama päris brauseris ja kohalikus D1-s: täidab kõik väljad märgiga väärtustega ja otsib neid võrgupäringutest ning andmebaasist; seansirida on kokkuvõte ilma teekonnata; tagasiside tunnust ei leidu mõõtmise tabelites; vabatekstist eemaldatakse e-post ja telefon. Vajab `wrangler dev` ja kohalikku D1. |

Lisaks (mitte elukaar): `kalkulaator-pension.test.cjs` ja `kalkulaator-stsenaariumid.test.cjs` (Meelis Burget, porditud) kontrollivad prototüüpi 1, kokku 9 775 kontrolli.

Märkus arvu kohta: 83% elukaare kontrollidest on ühes testis (invariandid), mis kontrollib juhuslikke sisendeid. See ei ole 52 000 eraldi stsenaariumi, vaid reeglite kontroll paljudel sisenditel.

## Mida testid tõestavad ja mida mitte

Testid tõestavad, et mootor, graafik ja tekstid teevad seda, mida me kirja panime, ja et muudatus ei tule märkamatult sisse. Kontrollisime, et testid on tundlikud: tulumaksu 22% → 20% kukutab golden masteri, reeglite, invariantide ja graafiku testid.

Testid **ei** tõesta, et reeglid ise on õiged:

- Edasilükkamise tabel (+7,93% esimese aasta kohta) on SKA-st kinnitamata ja erineb projekti kirjelduse "0,9% kuus" väitest (vt `reeglid.json`).
- `reeglid.json` URL-id on praegu avalehed; enne avaldamist lisa täpsed lehelingid.
- Mudel eeldab, et pensionäri maksuvaba tulu 776 € jääb tänastes eurodes konstantseks.
- Töö pensioni ajal tõstab pensioni lähendiga `workAccrual` (RPKS § 25, (kindlustusosak + solidaarosak) / 2 × aastahinne); palk on tänastes eurodes konstantne.
- Töö ajal eeldame, et maksuvaba tulu kasutab palk, seega pension on tervenisti 22% maksuga. Palga maksu mudel ei arvuta (palk katab kulud).
- Töö ajal samba väljamakseid ei tehta: II ja III sammas avanevad töö lõppedes (või valitud fondipensioni algusest, kui see on hiljem).
- Edasilükkamine ja pool pensioni on täisaastates alates pensionile minekust. Juba makstava pensioni peatamist ja taasalustamist kuude kaupa mudel ei arvesta ([TLV-83](https://rendavesoy.atlassian.net/browse/TLV-83)); see on kirjas ka tulemuse otsustuspunktis.
- Pool pensioni: välja võtmata pool tõuseb nagu edasilükkamisel (pool täieliku edasilükkamise protsendist), SKA-st kinnitamata.

## Ülesehitus

- `lib/lae.cjs`: laeb brauserikoodi (`public/elukaar/pension.js`) CommonJS-testidele; `{ incomeTax: false }` arvutab ilma tulumaksuta.
- `fixtures/kalkulaator-pension.js`: prototüüp 1 mootori koopia tuleva-tulevikust.
- `golden/`: lukus tulemused. Kui muudad arvu teadlikult, uuenda ja vaata diff üle.
- Brauseritestid suunavad Chart.js ja Bootstrapi CDN-i päringud kohalikele `node_modules` failidele.
