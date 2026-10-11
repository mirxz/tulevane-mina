# Elukaar: muudatused 10.–11.10.2026

Fail `public/elukaar/index.html` on ühes failis koopia Elukaarest, mille kehtiv versioon on repos [meelisb/tuleva-tulevik](https://github.com/meelisb/tuleva-tulevik) kaustas `elukaar/` (seal on `index.html`, `story.js`, `story.css`, `pension.js` eraldi failidena). Siin on CSS ja JS lehe sisse kirjutatud, et leht töötaks ühe failina.

Allpool on muudatused alates eelmisest `kadi-branch`-i commit'ist (`997ef83`, ühtne termin „Fondipension“).

## 1. II ja III sammas eraldi

- Sisendid: II samba summa ja sissemakse ning III samba summa ja sissemakse on eraldi väljad. Sildid on „sissemakse“, ühikud („eurot“, „eurot kuus“) on abitekstis ja seotud väljaga `aria-describedby` kaudu.
- Pott, valikud ja graafik näitavad II ja III sammast eraldi. III sammas on alati eraldi pott.
- 55-aastaselt alanud III samba fondipension on graafikul näha ka enne pensioniiga.

## 2. Kui sammast pole, pole ka valikut

Kui II sammas on 0 € ja II samba sissemakse puudub (või III sammas on 0 € ja sissemakset pole):

| Koht | Mida näed |
|---|---|
| 60 a, pensioniiga, leping (66+) | Selle samba valikukaardid on lukus, kollasel taustal teade „II sambas ei ole kogutud midagi, valik puudub.“ ja nupp „Muuda“, mis viib sinu andmete juurde |
| „Sinu lugu lühidalt“ | Puuduvat sammast ei mainita, ka esimesel real mitte |
| Otsuste kaart | Puuduva samba ridu ei näidata |

## 3. Fondipensioni lepingu valikud

### 3.1 Lepingu valik ka riikliku pensioni edasilükkamisel

**Probleem:** kui valisid fondipensioni ja lükkasid riikliku pensioni edasi (nt 70. eluaastani), oli samm 66+ lukus. Mootor arvestas siis alati „uus leping igal aastal“. Päriselus ei sõltu lepingu valik edasilükkamisest.

**Muudatus:**
- Sammus 66+ saab ka edasilükkamise korral valida „Üks leping“ või „Uus leping igal aastal“.
- Mootor (`elukaar/pension.js`): stsenaarium C koos `contract: 'once'` arvestab üht lepingut (nagu B). Vaikimisi ja võrdlustabelis jääb C endiselt „leping igal aastal uuesti“, seega ristkontroll kalkulaatoriga ei muutu.
- Kokkuvõte ja otsuste kaart näitavad valitud lepingut.
- Tulemuse lehe hoiatus: kui iga-aastane uuendamine kannaks paremini, öeldakse seda ja nupp viib sammu 66+ juurde.

### 3.2 II ja III samba leping eraldi

**Allikas:** II ja III samba fondipension on eraldi lepingud `[verified]`, kontrollitud 10.10.2026:
- II sammas: [tähtajaline pension pensionifondidest](https://www.pensionikeskus.ee/ii-sammas/valjamaksed/tahtajaline-pension/)
- III sammas: [täiendav fondipension](https://www.pensionikeskus.ee/iii-sammas/valjamaksed/taiendav-fondipension/), oma avamise ja lõpetamise avaldusega

**Muudatus:** sammus 66+ on kaks valikut, II samba leping ja III samba leping.

| Olukord | Mida näed |
|---|---|
| II ja III mõlemad fondipensionina | Kaks valikut pealkirjadega |
| Ainult II | Üks valik, nagu varem |
| Ainult III (II tühi või mitte fondipension) | Märkus II kohta ja III valik |
| Kumbki pole fondipension | Lukus, nagu varem |

- III samba fondipension arvestab valitud lepingut. Varem uuenes see alati igal aastal.
- Kui III samba fondipension algas 55-aastaselt, arvestatakse ühe lepingu periood 55. eluaastast. Ka pensionieelsed väljamaksed järgivad valikut.

**Käitumise muutus:** III samba fondipensioni vaikevalik on nüüd „Üks leping“. Samade sisenditega võib III samba fondipensioniga tulemus erineda varasemast.

### 3.3 Otsuste kaart näitab ainult olemasolevaid sambaid

| Kaardi rida | II = 0 | III = 0 | Kumbagi pole |
|---|---|---|---|
| Igal ajal enne pensioniiga | Ainult III | Ainult II | Peidetud |
| III sammas soodusmaksuga | Näidatakse | Peidetud | Peidetud |
| 60 a | „Paindlik riiklik pension“ | „II sammas ja paindlik riiklik pension“ | „Paindlik riiklik pension“ |
| 65 a riiklik pension | Ei muutu | Ei muutu | Ilma kindlustusseltsi lauseta |
| Fondipensioni leping | Ainult III | Ainult II | Peidetud |
| Pärimine | III kohta | II kohta (+22%) | Peidetud, kui pärimise valikut pole |

Riikliku pensioni read on alati näha. II sambaga liitumist ei soovitata, sest kasutaja märkis esimeses sammus II samba summaks ja sissemakseks 0.

## 4. Mobiil ja kujundus

- Mobiilis (iPhone 14 Pro) parandused: sammurea „Sina“ joondus, Sotsiaalkindlustusameti lingi murdmine, valik „pole liitunud“ (varem ei mahtunud), KKK polsterdus, kulude legend üksteise all.
- Sammu vahetusel kerib leht kohe üles (iOS Safari parandus).
- Graafiku vihje sulgub, kui puudutad graafikust väljaspool.
- Kõrvuti sisendväljad on mobiilis ühel joonel, ka siis, kui üks silt on kahel real.
- Tumesinisel jooksva kokkuvõtte ribal on rohkem õhku.
- Kokkuvõtte „Muuda“ lingid on ühes tulbas paremal.
- Kulukaartidelt on kvintiilid eemaldatud („Nagu jõukaim viiendik.“). Allikas koos kvintiiliga jääb kulude muutmise vaatesse.
- Pärimise tekst: „II ja III samba fondis olev raha (ka fondipension) läheb pärijatele.“

## Testid

Kontrollitud repos `meelisb/tuleva-tulevik`:
- `npm test`: 9 613 + 6 807 kontrolli, 0 kukkus läbi.
- `node tests/e2e.mjs`: kõik kontrollid läbisid.
- Uued kontrollid failis `tests/elukaar.scenarios.test.js`: C ühe lepinguga (väljamakse sama mis B, riiklik pension algab 2 a hiljem, 75-aastaselt suurem kui iga-aastasel uuendamisel); III samba üks leping (ühtlane väljamakse, lõpeb perioodi lõpus; 55-aastaselt alanud lepingu periood arvestatakse 55-st).
