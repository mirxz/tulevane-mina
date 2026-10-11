# Analüütika põhimõtted

Need kolm reeglit kehtivad alati. Neid kontrollivad automaattestid (`npm test`); kui muudatus reeglit rikub, jääb ehitus punaseks.
Reeglit muuta tohib ainult teadlikult: muuda siin fail ja test koos ning kirjuta PR-i, miks.

## 1. Kliendi sisestatud muutujaid ei salvestata kunagi

Kõik, mida inimene elukaarel või kalkulaatoris sisestab (sünniaasta, palk, II samba summa, sääst, kulud jne), jääb tema brauserisse ja ei lähe serverisse.
Mõõtmine saadab ainult kindla väljade komplekti: `sid, ev, k, p, samm, nimi`. Neist `nimi` on valiku tähis, mille võimalikud väärtused on lehel ette antud (nt `r:payout=fund`), mitte sisestatud tekst.
Arvu- ja tekstiväljad (`input[type=number]`, `input[type=text]`, `textarea`) ei saada midagi. Server lükkab tundmatu välja tagasi (400).

Täpsustus: tagasiside küsimustikule antud vabatahtlikud vastused (valikud, vabatekst, soovi korral vanus, milleni raha jätkub) on vastused tagasisideküsimustele, mitte kalkulaatori sisestus. Nende vabateksti kohta vt reegel 2.

## 2. Tagasisidet ei seostata kunagi vastaja e-posti ega muu isikuandmega

- Tagasiside tabelis ei ole e-posti, nime, telefoni, IP-d ega brauseri infot.
- Kui küsiksime kunagi e-posti (nt ratta ootenimekiri), jääb see eraldi tabelisse, kus ei ole seansi tunnust ega ühtegi vastust.
- Tagasiside vastuse tunnus on eraldi juhuslik tunnus, mis ei ole sama mis mõõtmise seansi tunnus. Seega ei saa vastust siduda kellegi liikumisega.
- Vabateksti väljadest eemaldatakse e-posti aadressid ja pikad numbrijadad (`[e-post]`, `[number]`) enne salvestamist.

## 3. Üldine kasutusstatistika on minimaalne ja anonüümne

Me ei jälgi ühe kasutaja detailset liikumist.

- Seansi kohta on **üks** kokkuvõtterida (`mina_seansid`): juhuslik tunnus, kanal, eelprofiil, esimese ja viimase tegevuse aeg, kaugeim samm, klikkide arv ja viis jah/ei lippu. Rida ei sisalda teekonda, klikkide nimesid ega järjekorda.
- Vaated ja klikid on **tunnipõhised summad** (`mina_loendur`) ilma seansi tunnuseta.
- Sündmuste logi (rida iga sündmuse kohta) ei ole. Tulemuste lehel ei ole nimekirja üksikutest seanssidest ega ühe seansi teekonda.
- Ei küpsiseid, ei IP-d, ei sõrmejälge. Seansi tunnus on vahekaardi `sessionStorage`'is ja kaob vahekaardi sulgemisel. "Ära jälgi" lülitab mõõtmise välja. Robotid jäävad välja.
- Seansi pikkus = esimesest viimase tegevuseni. Lahkumist ega aegumist ei mõõda.

## Mida salvestame

| Tabel | Sisu | Märkus |
|---|---|---|
| `mina_seansid` | üks kokkuvõtterida seansi kohta | ilma teekonnata |
| `mina_loendur` | tunnipõhised summad (vaated, klikid valiku nime järgi) | ilma seansita |
| `kutse_klikid`, `kutse_saadetud` | kutsekirja allikas ja aeg; saatmise arvud | ilma isikuta |
| `tagasiside_vastused` | tagasiside vastused | eraldi tunnus, ilma isikuandmeta |
| `ratas_meilid` | ainult e-post ja allikas (arhiiv) | ilma vastuste ja seansita |
| `sundmused`, `vastused`, `plaan_*`, `ratas_sundmused`, `mang_toad` | arhiveeritud prototüüpide vana pärand | **ei kasva**: vt `PARAND` testis; uusi selliseid tabeleid ei lisata |

## Kuidas reegleid testitakse

- `tests/privaatsus.mjs` (ilma serverita): kontrollib lähtekoodi ja andmebaasi skeemi. Iga uus tabel peab olema testis nimetatud (analüütika, tagasiside, e-post või pärand), mõõtmise tabelitel on täpne veergude loetelu, tagasiside ja e-post ei jaga tunnust seansiga, serveris ei loeta IP-d ega panda küpsiseid.
- `tests/privaatsus-brauser.mjs` (päris brauser ja kohalik andmebaas): täidab kõik väljad märgiga väärtustega, läbib elukaare ja tagasiside, ning otsib kõigist mõõtmise ja tagasiside tabelitest neid märke. Kontrollib ka, et seansirida ei sisalda teekonda ja et tagasiside tunnus on seansi tunnusest erinev.
- `tests/moot.mjs` ja `tests/moot-api.mjs`: tulemuste vaated ei näita üksikut seanssi ega teekonda, `/api/e` võtab vastu ainult lubatud välju.
