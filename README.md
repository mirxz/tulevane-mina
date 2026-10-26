# Tulevane Mina

> Prototüüp: kas sinu raha jätkub kogu eluks? Tehtud Tuleva liikmete häkatonil Tallinnas (2026-10-09 kuni 2026-10-11). See ei ole finants- ega maksunõu ega Tuleva ametlik kalkulaator.

## Mis see on

Tulevane Mina on veebileht, mis näitab inimesele ühe loona, kas tema pensioniraha ja muu sissetulek katab kulud tänasest elu lõpuni. Inimene läbib elu etapid (lapsepõlv, tööelu, 55, 60, pensioniiga, pensionipõlv) ja vastab igal etapil mõne küsimusega. Lõpus näeb ta graafikut: sissetulek vanuse järgi (riiklik pension, II sammas, III sammas, hoius ja vajadusel eripension) ning kulud selle kõrval.

- „Elu lõpuni“ tähendab siin vanust, milleni jõuab elusalt 10% sinuvanustest (Statistikaameti elutabeli järgi).
- Kõik arvutused tehakse brauseris. Sisestatud numbrid ei lähe serverisse.
- Summad on tänastes eurodes. Eeldused (näiteks fondi tootlus) on lehel nähtavad ja muudetavad.
- Eesmärk on, et inimene saaks otsuseid (millal pensionile minna, kas võtta II ja III samba raha varem välja, kuidas fondipensioni võtta) võrrelda ühe loo sees, mitte mitmes kalkulaatoris.

**Olek (2026-10-26):** põhitoode on **Elukaar** (`/elukaar/`) ja seda arendatakse. Varasemad häkatoni katsetused (kalkulaator, plaan, õnneratas, kasiinomäng, lauamäng) on arhiivis ja töötavad edasi, aga neid ei arendata, vt [docs/arhiiv.md](docs/arhiiv.md). Domeen tulevanemina.ee läheb 2026-10-26 üle Tuleva AS-ile, vt „Üleandmine“ allpool.

## Mida inimene näeb

Avaleht `/` selgitab lühidalt, kuhu kasutaja sattus, ja laseb valida algpunkti: Tuleva konto näide, sisestan nullist, Tuleva liikmest koguja või mitteliikmest koguja (viimase kahe all viis koguja profiili). Valik viib aadressile `/elukaar/?p=<profiil>`, kus algandmed on täidetud ja kõiki välju saab muuta.

Elukaar koosneb sammudest. Sammude arv ja sisu sõltuvad valikutest (näiteks 55-aastaselt sammu ei tule, kui III samba vanus on sisestatud, ja eripensioni samm on seotud sellega, kas eripension on olemas).

| Samm | Vanus | Küsimus |
| --- | --- | --- |
| 0 | Sina | Kes sa oled ja mis sul juba on? |
| 1 | 0–18 | Lapsepõlv: kas keegi kogus sulle raha? |
| 2 | 18 | Tööelu algab: kuidas said oma pensionifondi? |
| 3 | 18–55 | Tööaastad: kas võtad samba raha varem välja? |
| 4 | 55 | 55-aastaselt: esimene otsustuskoht |
| 5 | 60 | Mida teed II ja III samba rahaga? |
| 6 | 65 | Pensioniiga |
| 7 | 66+ | Pensionipõlv: kuidas fondipension kestab? |
| 8 | Kulud | Mis elu sa pensionil elada tahad? |
| 9 | Eripension | Eripension algab |
| 10 | Tulemus | Kas raha jätkub elu lõpuni? |

Tulemuse samm näitab graafikut „Sissetulek ja kulud vanuse järgi“ (tabelina ka), kokkuvõtet, valikuid ja selgitust, kuidas graafikut lugeda. Tulemuse saab alla laadida Markdown- ja PDF-failina. Paljude väljade juures on „?“ selgitus ja viide allikale.

### Väljamakse viisid

Tulemuses võrreldakse viit viisi, kuidas II ja III samba raha kasutada. Kõigil on sama kulureegel, seega erinevad nad ainult maksu, tootluse, riikliku pensioni algusaja ja väljamakse graafiku poolest.

| Tähis | Nimi | Mida see tähendab |
| --- | --- | --- |
| A | Kõik korraga | II ja III sammas ühekordselt välja (10% maks), raha hoiusel, kasutad vajaduse järgi |
| B | Üks fondipensioni leping | Maksuvaba fondipension elada jäänud aastate peale; leping lõpeb perioodi lõpus |
| C | Sild ja riiklik pension hiljem | Riiklik pension algab hiljem ja on eluks ajaks suurem; seni elad sambast |
| D | Leping igal aastal uuesti | Maksuvaba fondipension, mille lepingu sõlmid igal aastal uuesti; ei saa otsa, aga väheneb vanas eas |
| E | Jätkan kasvatamist | Raha jääb fondi kasvama, vajadusel võtad osa välja (10% tulumaks); vaikevalik |

## Kuidas arvutus töötab

**Ühine kulureegel:** igal aastal kulutad oma vajaduse. Allikad järjekorras: riiklik pension, samba plaanijärgne väljamakse, hoius (varasemad ülejäägid või ühekordne väljamakse), lisaväljamakse sambast (10% maks). Ülejääk läheb hoiusele (reaaltootlus vaikimisi −1%).

**Mida mudel arvestab:** riiklik pension (vana ja uus süsteem, paindlik pension varem ja hiljem), eripension, soodustingimustel pension (lapsed, tervist kahjustav töö, päästeteenistus, ametniku staaž), II ja III samba varane väljavõtt, fondipension, töö pärast pensioniiga, tulumaks ja maksuvaba tulu, laste pensionilisa ja riigi II samba lisamakse lapse eest.

**Mida mudel ei arvesta:** hoolduskulu ei ole eraldi mudelis (hooldekodu omaosalus on toodud ainult võrdlusena kulutaseme juures); inimene vastutab ise tingimuste (näiteks tervist kahjustava töö staaži) täitmise eest.

**Kust numbrid tulevad:** seadused (riikliku pensionikindlustuse seadus, kogumispensionide seadus, tulumaksuseadus, päästeteenistuse seadus, avaliku teenistuse seadus, soodustingimustel vanaduspensioni seadus), Sotsiaalkindlustusameti (SKA) lehed, EMTA, Statistikaamet ja Tuleva avalik kood (TulevaEE/onboarding-client). Iga konstant on failis `tests/reeglid.json` koos allika ja kontrollimise kuupäevaga; test kukub, kui allikas puudub või on üle 400 päeva üle vaatamata. Arvutust on võrreldud SKA pensionikalkulaatoriga (2026-10-17) ja Tuleva kogumiskalkulaatoriga. Arvutus ei ole juriidiline hinnang.

## Kuidas projekt on üles ehitatud

| Kaust või fail | Mis see on |
| --- | --- |
| `public/index.html` | Avaleht (maandumisleht) |
| `public/elukaar/` | Elukaar: `index.html` (sammud), `story.js` (valikud ja liides), `pension.js` (arvutusmootor, puhtad funktsioonid), `abi.js` („?“ selgitused), `profiilid.js` (algprofiilid) |
| `public/data/` | Statistikaameti elutabel (`elutabel.js`) ja kulutasemed (`kulud.js`) |
| `public/tagasiside/`, `public/privaatsus/` | Tagasiside leht ja privaatsuspoliitika |
| `public/mootmine.js` | Anonüümne mõõtmine, vt „Mõõtmine ja privaatsus“ |
| `public/arhiiv/` | Varasemad prototüübid, vt [docs/arhiiv.md](docs/arhiiv.md) |
| `src/index.js` | Cloudflare Worker: serveerib lehti, teeb väikesed liidesed, parooliga tulemuste lehe |
| `src/moot.js`, `src/aeg.js` | Tulemuste lehe vaated ja Tallinna aja arvestus |
| `tests/` | Automaattestid, vt [tests/README.md](tests/README.md) |
| `docs/` | Skeemid (`elukaar_harud.drawio`, `otsustusmudel.drawio`) ja arhiivi kirjeldus |
| `scripts/elutabel.py` | Statistikaameti elutabeli allalaadimine; kirjutab faili `public/plaan/elutabel.js`, mida enam ei ole (plaan on arhiivis), ja Elukaare `public/data/elutabel.js` seega sellega uuesti ei teki (TBC, vt „Igal aastal uuendatavad väärtused“) |
| `wrangler.jsonc` | Cloudflare'i seadistus (Worker, domeenid, andmebaas) |
| `mirko-claud-skills/` | Tuleva tiimile antud üleandmise dokument ja kaks Claude'i oskust (`.skill`) |

Worker `src/index.js` teeb need liidesed:

| Liides | Mida teeb |
| --- | --- |
| `/api/e` | anonüümne mõõtmine (avaleht, elukaar, tagasiside), vt [ANALUUTIKA.md](ANALUUTIKA.md) |
| `/api/t` | tagasiside lehe `/tagasiside/` vastused |
| `/tulemused`, `/tulemused*.csv`, `/saada` | parooliga tulemuste leht ja kutsekirjade saatmine |
| `/api/tts`, `/api/r`, `/api/p`, `/api/s`, `/api/mang/tuba` | arhiveeritud prototüüpide liidesed |

Vanad aadressid `/kalkulaator/`, `/plaan/` ja `/ratas/` suunatakse Workeris uuele aadressile `/arhiiv/…` (päring säilib). Aadress `/mang` annab teadlikult teate „Seda prototüüpi enam pole“.

## Käivita kohalikult

Vaja on Node.js (CI kasutab versiooni 22).

```
npm install
npx playwright install chromium
npm run test:koik           # mootor + brauser; käivitab wrangler dev ise ja paneb pärast kinni
```

Arendades: `npx wrangler dev` ühes aknas (leht on aadressil http://localhost:8787), `npm test` teises. Tulemuste lehe testide jaoks pane faili `.dev.vars` rida `TULEMUSED_VOTI=proov` (fail on `.gitignore`'is; `test:koik` võtab parooli sealt).

- **Wrangler** on Cloudflare'i käsureatööriist (`package.json` arendussõltuvus). `wrangler dev` käivitab sama Workeri sinu arvutis: lehed, `/api/*` liidesed, ümbersuunamised ja kohaliku andmebaasi (kaust `.wrangler/`).
- **Port 8787 peab olema vaba.** Kui seal jookseb mõni muu server, ei käivitu wrangler ja brauseritestid kukuvad vigadega 501 või TimeoutError. Kontroll: `lsof -i :8787`.
- **Teine port:** `npx wrangler dev --port 8788` ja anna testile aadress, nt `node tests/smoke.mjs http://127.0.0.1:8788`. `npm test` kasutab alati porti 8787.

## Testid

- `npm run test:mootor`: kiired testid ilma brauserita (umbes 15 sekundit): arvutusmootor, reeglid, golden master, invariandid (300 juhuslikku sisendit × 6 väljamakse viisi), võrdlus SKA ja Tuleva kalkulaatoriga, privaatsuse põhimõtted.
- `npm run test:brauser`: brauseritestid (liides, graafik, ligipääsetavus axe-core'iga); vajavad töötavat `wrangler dev` serverit.
- `npm run golden:uuenda`: kui arvud muutusid **teadlikult**, kirjutab golden masterid uuesti; vaata pärast `git diff` üle.

Mida iga test kontrollib ja mida ta **ei** tõesta, on kirjas failis [tests/README.md](tests/README.md). GitHub Actions jooksutab `npm test` igal push'il ja pull requestil.

## Töövoog ja reeglid

1. **Otsus.** Mida muudame ja miks, kirjutatakse otsuste logisse. Kus Tuleva tiim seda logi hoiab: TBC (seni oli see üleandja Claude'i projekti dokument, mis ei ole avalik).
2. **Ehitus.** Muudatus tehakse uues harus nimega `muudatus/<lühike-nimi>`, näiteks `muudatus/tagasiside`.
3. **Push.** Haru läheb GitHubi. Automaatselt käivituvad:
   - GitHub Actions (`.github/workflows/smoke.yml`): `wrangler deploy --dry-run` ja `npm test`;
   - Cloudflare: eelvaate-URL `https://<haru>-mina.tulevane.workers.dev`.
4. **Test.** Üks inimene, mitte muudatuse tegija, vaatab eelvaate telefonis läbi (kontrollnimekiri allpool).
5. **Toodangusse.** Pull request → `main`, kui CI on roheline ja eelvaade üle vaadatud. Cloudflare avaldab mõne minutiga.
6. **Märge.** Otsuste logis märgitakse, mis läks toodangusse ja millal.

**Reeglid**

- `main` muutub ainult pull requesti kaudu.
- Väliseid skripte võimalikult vähe. Lubatud: Google Fonts ning elukaares Bootstrap 5.3.3 (CSS) ja Chart.js 4.4.1 jsDelivr CDN-ist kindla versiooniga (testid suunavad need kohalikule `node_modules` koopiale). Uue välise skripti lisamine on otsus otsuste logis.
- Ei analüütikateeke ega küpsiseid. Mõõtmine on anonüümne ja minimaalne, vt [ANALUUTIKA.md](ANALUUTIKA.md).
- Arvud tulevad allikast. Kui muudad kordajaid, suremusmudelit või pensioniiga, uuenda `tests/reeglid.json` (väärtus, allikas, `kontrollitud`) ja vajadusel golden masterid.
- Tuleva logo avalikul lehel ei kasutata; silt „prototüüp“ ja lahtiütlus jäävad alles. Seni kehtinud reegel; Tuleva võib selle muuta.
- **Tagasivõtmine:** Cloudflare → Workers & Pages → mina → Deployments → eelmine versioon → Rollback. Või `git revert` ja uus pull request.

## Aadressid

| Mis | Aadress | Märkus |
| --- | --- | --- |
| Toodang | https://mina.tulevane.workers.dev | haru `main` |
| Toodang, oma domeen | https://tulevanemina.ee ja https://www.tulevanemina.ee | sama Worker; domeen läheb 2026-10-26 üle Tuleva AS-ile, Workeri ühendus uues kontos: TBC |
| Eelvaade | `https://<haru>-mina.tulevane.workers.dev` | iga teine haru |

## Mõõtmine ja privaatsus

Kolm reeglit kehtivad alati ja neid kaitsevad automaattestid; täpsemalt [ANALUUTIKA.md](ANALUUTIKA.md):

1. Kliendi sisestatud muutujaid (sünniaasta, palk, samba summad, kulud) ei salvestata kunagi; need jäävad brauserisse.
2. Tagasisidet ei seostata e-posti ega muu isikuandmega.
3. Üldine kasutusstatistika on minimaalne ja anonüümne: ühe kasutaja liikumist ei jälgita, küpsiseid ega IP-d ei ole.

**Mida mõõdetakse.** `public/mootmine.js` saadab `/api/e` kaudu sündmused (maandumine, valitud eelprofiil, elukaare algus, sammu number, valiku või nupu tähis, tagasiside). Server hoiab seansi kohta **ühe kokkuvõtterea** (`mina_seansid`) ja vaated-klikid **tunnipõhiste loenduritena ilma seansita** (`mina_loendur`). Kanal tuleb lingi `?k=…` väärtusest, seansi tunnus on vahekaardi `sessionStorage`'is. „Ära jälgi“ lülitab mõõtmise välja; robotid jäetakse välja. Aeg salvestatakse UTC-s, tulemuste leht näitab Tallinna aja järgi.

**Elukaare tulemuste kiirmuutmine (2026-10-24).** Tulemuste lehe kokkuvõtte real tehtud valikud loendatakse eesliitega `q:` (`q:r:<valik>=<väärtus>`) ja lisa-nupud nimega `b:add-kids` ning `b:add-work`. Uusi andmeid ei lisandu, sisestatud summasid ei saadeta (kontroll: `tests/privaatsus.mjs`).

**Tagasiside leht `/tagasiside/`.** Elukaare lõpus on link lehele, mis ei küsi nime ega e-posti. Neli küsimust ja vaba kommentaar: kas oskas algandmeid täita, kas oskab öelda, millise vanuseni raha jätkub, kas nimetab vähemalt ühe asja, mida enne ei teadnud, ja kas muudaks oma plaani. Vastused lähevad `/api/t` kaudu andmebaasi (tabel `tagasiside_vastused`); e-posti-sarnased tekstid ja pikad numbrid maskitakse enne salvestamist.

**Tulemused.** `/tulemused` ja CSV-d (`/tulemused-tagasiside.csv`, `/tulemused-ratas.csv`, `/tulemused-plaan.csv`, `/tulemused-meilid.csv`) on HTTP Basic auth'i taga: parool on Cloudflare'i saladus `TULEMUSED_VOTI`, kasutajanimi võib olla mis tahes. Vaikimisi näitab leht ainult toodangu aadresside vastuseid. Lehel `/saada` (sama parool) saab saata kutsekirju (variandid A, B, C); saatja aadress on seadistatud `wrangler.jsonc` plokis `send_email` ja see tuleb domeeni üleandmisel muuta.

**Andmebaas.** Cloudflare D1 `mina-tagasiside` (binding `DB`, nii toodangus kui eelvaadetes); tabelid luuakse esimesel päringul. Mis tabelis mida hoitakse, on tabelina failis [ANALUUTIKA.md](ANALUUTIKA.md). D1 võib sisaldada tagasiside vabatekste ja e-posti aadresse; **andmeid ei panda repo sisse** (ei `.sql` eksporti ega CSV-sid).

**Privaatsuspoliitika** on lehel `/privaatsus/`.

## Ligipääsetavus

Siht on WCAG 2.1 AA.

- `npm test` jooksutab ekraanidel axe-core'i (WCAG 2.1 A/AA); tõsine või kriitiline viga kukutab testi.
- „?“ selgitused avanevad dialoogina (fookus, Esc), kohustuslik väli on märgitud sõnaga, veateade nimetab välja, „Edasi“ viib fookuse veateatele.
- Telefonis on kokkuvõtteriba ühel real ja silti ei kärbita.

## Käsitsi kontrollnimekiri (eelvaade telefonis)

- [ ] Avaleht ja Elukaar avanevad telefonis, teksti ei lõigata ja külgsuunas kerida ei saa.
- [ ] Iga avalehe algpunkt viib Elukaarele täidetud algandmetega.
- [ ] Sünniaasta, sugu ja pension muudavad pensioniiga ja eeldatavat eluiga.
- [ ] Sammud lähevad edasi ja tagasi; kohustuslik väli, mis on tühi, annab selge veateate.
- [ ] Tulemuse graafik on loetav, tabelivaade töötab, „Tuleviku hindades“ lüliti muudab numbreid.
- [ ] Markdown- ja PDF-eksport sisaldavad kogu tulemuse sisu.
- [ ] Tagasiside lehe saatmine näitab kinnitust.
- [ ] Graafik on loetav ka halltoonis (telefoni ligipääsetavuse seadetes värvifilter).

## Igal aastal uuendatavad väärtused (elukaar)

Need arvud muutuvad seaduse või indekseerimise järgi. Vaata need üle **igal aastal**: jaanuaris (maksud, alampalk), aprillis (indekseerimine 1. aprillil) ja septembris–oktoobris (SKA avaldab järgmise aasta summad). Pärast muutmist uuenda `tests/reeglid.json` (väärtus, allikas, `kontrollitud`), käivita `npm test` ja vajadusel `npm run golden:uuenda`. Reeglite test kukub, kui mõni allikas on üle 400 päeva üle vaatamata.

| Väärtus | Praegu | Millal muutub | Kus koodis | Allikas |
| --- | --- | --- | --- | --- |
| Arvestusaasta | 2026 | iga aasta | `CURRENT_YEAR`, `pension.js` | – |
| Aastahinne | 10,477 € | 1. aprill (indekseerimine) | `AASTAHINNE`, `pension.js`; `reeglid.json` | SKA „Pensioni suurus“ |
| Baasosa | 399,24 € | 1. aprill | `public/arhiiv/kalkulaator/andmed/kihid.js` (TLV-84) | SKA |
| Pensioniiga | RPKS § 7 valem: 2027 65 a 1 k, 2028 65 a 3 k, 2029 65 a 4 k, edasi prognoos (eluiga jääb viimase aasta tasemele, nagu SKA) | igal aastal uus eluea aasta (Statistikaamet RV045) | `LIFE_EXP_65`, `pensionAge`, `pension.js` (uuenda elutabeli andmetest, test kontrollib); `abi.js` tabel | Riigi Teataja, SKA, Statistikaamet |
| Paindliku pensioni kordajad (edasilükkamine, varem) | +7,93 … +51,57%, −7,17 … −30,67% | igal aastal (oodatav eluiga) | `DEFERRAL_INCREASE`, `pension.js`; `story.js` tekst | SKA paindlik pension, SKA kalkulaator |
| Pensionäri maksuvaba tulu | 776 € kuus | riigieelarvega (jaanuar) | `PENSIONER_ALLOWANCE`; `reeglid.json` | EMTA |
| Üldine maksuvaba tulu | 700 € kuus | riigieelarvega | `GENERAL_ALLOWANCE`; `reeglid.json` | EMTA |
| Tulumaks | 22% | riigieelarvega | `INCOME_TAX`; `reeglid.json` | EMTA |
| Palga kasv ja inflatsioon (Tuleva eeldus) | 3% ja 2% aastas | kui Tuleva kalkulaator muudab | `WAGE_GROWTH`, `INFLATION`, `pension.js`; `reeglid.json` | Tuleva onboarding-client, EKP |
| III samba maksusoodustuse piir | 15% tulust, max 6 000 € | seadusemuudatusega (praegu ei indekseerita) | `story.js`, `abi.js` | EMTA |
| Keskmine brutopalk | 2 092 € | igal aastal (Statistikaamet PA103) | `AVG_WAGE`, `pension.js` | Statistikaamet |
| Töötasu alammäär | 946 € | jaanuar/aprill | `MIN_WAGE`, `pension.js` | VV määrus |
| Riigi II samba sissemakse lapse eest | 2026: 76,12 €, 2027: 80,76 € kuus | igal aastal (SKA avaldab ette) | `CHILD_II_MONTHLY`, `pension.js`; `reeglid.json`; `abi.js` | SKA „Perehüvitiste määrad ja maksmine“ |
| Laste pensionilisa kordajad | 3,5 aastahinnet (sünniaja ja II samba järgi) | seadusemuudatusega | `childSupplement`; `reeglid.json` | RPKS § 24 lg 1¹, § 28 lg 2 p 12 |
| Tervist kahjustava töö staaži tähtaeg | 31.12.2030 (põlevkivi 2049) | seadusemuudatusega | `abi.js`, `docs/otsustusmudel.drawio` | SVPS |
| III samba maksusoodustus | 15% tulust, max 6 000 € | seadusemuudatusega | `story.js` | EMTA |
| Elutabel | Statistikaamet 2025 | igal aastal (RV045, RV046) | `public/data/elutabel.js` (genereeritud, generaator TBC, vt allpool) | Statistikaamet |
| Kulutasemed | Statistikaamet LE205, LE211, IA002 | igal aastal | `public/data/kulud.js` (genereeritud) | Statistikaamet |
| Üksi elava pensionäri toetus | 200 € aastas, pension alla 992 € (2026) | igal aastal (sotsiaalministri määrus) | `abi.js` (household) | SKA |
| Hooldekodu omaosalus | u 1 000 € (kohatasu 1 603 €) | igal aastal | `story.js` | SKA, ERR |
| Eelprofiilide riiklik pension | `p1Monthly` | 1. aprill (indekseerimine) | `public/elukaar/profiilid.js` | SKA kalkulaator |

Andmefailid `public/data/elutabel.js` ja `public/data/kulud.js` on genereeritud Statistikaameti avatud API-st. Faili `elutabel.js` päis viitab Meelise skriptile `fetch_elutabel.py` (repo [meelisb/tuleva-tulevik](https://github.com/meelisb/tuleva-tulevik)); selle repo `scripts/elutabel.py` kirjutab hoopis `public/plaan/elutabel.js` ega loo veergu `K` (mõlemad sood kokku) ega välja `eluiga65`. Seega ei ole Elukaare praegune elutabel selles repos korratav, ja kulude fail sõltub samuti Meelise skriptist (`fetch_kulud.py`): kes ja kuidas neid uuendab, on TBC. Pärast uuendamist käivita `npm run test:koik`.

## Pane see oma Cloudflare'i kontole tööle

Sait jookseb Cloudflare Workersina. Uue kontoga sammud:

1. **GitHub:** repo on [mirxz/tulevane-mina](https://github.com/mirxz/tulevane-mina) (avalik seisuga 2026-10-26). Võta see üle (Settings → Transfer ownership) või tee oma koopia.
2. **Cloudflare:** Workers & Pages → *Create* → *Import a repository* → vali repo.
   - Workeri nimi: `mina` (peab klappima `wrangler.jsonc` failiga).
   - Build command: tühi. Deploy command: `npx wrangler deploy`.
   - Production branch: `main`. Luba *non-production branch builds* (eelvaated).
   - Aadressi osa `tulevane` on praeguse konto alamdomeen. Teises kontos on aadress `mina.<teie-alamdomeen>.workers.dev` ja eelvaated `<haru>-mina.<teie-alamdomeen>.workers.dev`; `TOODANG` loend failis `src/index.js` tuleb sellele vastavalt uuendada.
3. **Andmebaas:** Storage & databases → D1 → *Create database* → nimi `mina-tagasiside`. Kopeeri *Database ID* faili `wrangler.jsonc` (kaks kohta: `d1_databases` ja `previews.d1_databases`).
4. **Saladused:** Workers & Pages → `mina` → Settings → Variables and Secrets → *Add* → tüüp *Secret*:
   - `TULEMUSED_VOTI`: tulemuste lehe parool;
   - `PROTO_VOTI` (valikuline): kui see on seatud, küsib kogu sait parooli; ilma selleta on sait avatud.
5. **Oma domeen:** `wrangler.jsonc` plokk `routes` (`custom_domain: true`). Domeeni tsoon peab olema samas Cloudflare'i kontos kui Worker.
6. **E-post (kutsekirjad):** `send_email` plokis `allowed_sender_addresses` peab olema aadress, mis kuulub selle konto domeenile. Eelvaadetes saatmist teadlikult ei ole.
7. **Kontroll:** `npm run test:koik`, siis ava avaleht, Elukaar ja `/tulemused`.

## Üleandmine

- **Domeen tulevanemina.ee** läheb 2026-10-26 üle Tuleva AS-ile. Mis domeeni küljes on (registreering, DNS-tsoon, Worker, andmebaas, e-post), mis muutub üleandmisel ja mis on veel kokku leppimata, on kirjas dokumendis `mirko-claud-skills/Tulevane Mina üleandmine Tuleva tiimile.md`. Samas dokumendis on kolme arvutusmootori võrdlus ning riikliku pensioni (I samba) arvutusloogika koos avatud kontrollidega.
- **Mida see tähendab saidile:** Workeri custom domain töötab ainult sama Cloudflare'i konto tsooniga. Kui tsoon liigub uude kontosse, tuleb Worker seal uuesti avaldada (eelmine jaotis), muidu jääb sait ainult workers.dev aadressile. E-posti suunamine ja kutsekirjade saatja aadress tuleb uues kontos uuesti seadistada.
- **Claude'i oskused:** kaustas `mirko-claud-skills/` on kaks `.skill` faili: `tulevane-mina-arvutuste-kontroll` (pensioniarvutuste kontrolli meetod ja seadusviidete tähised) ja `tulevane-mina-sait` (saidi hooldus, saladuste nimed, turvareeglid).
- **Lahtised (TBC):** kas Tuleva võtab ainult domeeni või ka saidi; kes vastutab tagasiside andmete eest; kus otsuste logi elab; kes uuendab elutabeli ja kulude faile.

## Arhiiv

Varasemad prototüübid on aadressidel `/arhiiv/kalkulaator/`, `/arhiiv/plaan/`, `/arhiiv/ratas/`, `/arhiiv/kasiino.html` ja `/arhiiv/lauamang/`. Nende tehniline kirjeldus (hääl, turvareeglid, mõõtmine, andmetabelid) on failis [docs/arhiiv.md](docs/arhiiv.md). Ligipääsetavad on need `/arhiiv/` sisukorra kaudu; avalehelt neile linki pole.

## Sõnastik

| Mõiste | Tähendus |
| --- | --- |
| Elukaar | Selle projekti põhileht `/elukaar/` |
| I sammas | Riiklik pension (maksab Sotsiaalkindlustusamet) |
| II sammas | Kohustuslik kogumispension pensionifondis |
| III sammas | Vabatahtlik lisapension maksusoodustusega |
| Fondipension | Regulaarne väljamakse II või III sambast kindla perioodi jooksul |
| Eripension | Eraldi pension teatud ametitele (näiteks politsei, kaitsevägi) |
| Soodustingimustel pension | Pensionile minek varem tööaja, laste või päästeteenistuse alusel, pension ei vähene |
| Paindlik pension | Riikliku pensioni edasilükkamine (suurem) või varem võtmine (väiksem) |
| Tänased eurod | Summad on arvutatud tänaste hindadega, inflatsioon on maha arvatud |
| SKA, EMTA | Sotsiaalkindlustusamet, Maksu- ja Tolliamet |
| KoPS, RPKS, TuMS, SVPS | Kogumispensionide seadus, riikliku pensionikindlustuse seadus, tulumaksuseadus, soodustingimustel vanaduspensioni seadus |
| Worker, D1 | Cloudflare'i serverita kood ja selle SQL-andmebaas |
| Golden master | Salvestatud arvud, mille iga muutus testis nähtavaks tehakse |
| WCAG 2.1 AA, axe-core | Ligipääsetavuse standard ja selle automaatne kontroll |
| Tuleva | Pensionifondide pakkuja (tuleva.ee), häkatoni korraldaja |

## Autorid ja õigused

- Projekt: Mirko (repo omanik). Elukaare leht: Kadi Rosenthal. Arvutusmootori alus ja osa teste: Meelis Burget (repo [meelisb/tuleva-tulevik](https://github.com/meelisb/tuleva-tulevik)). Kood ja testid on osaliselt tehtud Claude'iga (vt commit'ide `Co-Authored-By`).
- Andmed ja allikad: Statistikaamet, Sotsiaalkindlustusamet, EMTA, Riigi Teataja, TulevaEE/onboarding-client (pensioniea arvutus, MIT litsents). Arhiivis on hääl TartuNLP Neurokõnest (Tartu Ülikool).
- Häkatoni tulemuste varalised õigused kuuluvad Tulevale. Repos ei ole litsentsifaili: TBC.
