# Elukaare automaattestid

Mida kontrollime, kuidas jooksutada ja mida testid **ei** tõesta. Loetud 2026-10-11 seisuga.

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
| 7 | `elukaar-mootor.mjs` | Mirko + Claude | 102 | Fondipensioni tasasus (`annuityDue`), III samba langus, tulumaks ja maksuvaba tulu. |
| 8 | `elukaar-pohi.test.cjs` | Meelis Burget (tuleva-tulevik), porditud | 41 | Elada jäänud aastad, pensioniiga, edasilükkamise protsendid, kulutasemed. |

Elukaare kontrolle kokku: **51 906** (alloleval mõõtmise testid ei ole siin sees).

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
- Pensioniea järel töötamine riiklikku pensioni ei suurenda (SKA kalkulaatoris on see sees).

## Ülesehitus

- `lib/lae.cjs`: laeb brauserikoodi (`public/elukaar/pension.js`) CommonJS-testidele; `{ incomeTax: false }` arvutab ilma tulumaksuta.
- `fixtures/kalkulaator-pension.js`: prototüüp 1 mootori koopia tuleva-tulevikust.
- `golden/`: lukus tulemused. Kui muudad arvu teadlikult, uuenda ja vaata diff üle.
- Brauseritestid suunavad Chart.js ja Bootstrapi CDN-i päringud kohalikele `node_modules` failidele.
