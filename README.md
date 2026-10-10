# Tulevane Mina

Tuleva häkatoni 2026 prototüüp: pane pensioniaastad panuseks, ratas veeretab su elu läbi suremusstatistika ja tulevane sina helistab. Lõpuks näitab mäng kõiki elusid ja paljastab kasiinovõtted.

Mäng on üks fail: `public/index.html`. Lisaks on üks väike liides `src/index.js` (`/api/tts`), mis loeb tulevase mina kõne ette eesti häälega. Andmebaasi pole, mäng ei salvesta midagi ega kogu isikuandmeid.

## Aadressid

| Mis | Aadress | Kust tuleb |
| --- | --- | --- |
| Toodang (žürii, testijad) | https://mina.tulevane.workers.dev | haru `main` |
| Eelvaade | `https://<haru>-mina.tulevane.workers.dev` | iga teine haru |

### Saidi ülesehitus (10.10)

- `/` on maandumisleht (`public/index.html`): selgitab lühidalt, kuhu kasutaja sattus, ja annab kaks valikutaset: 1) Tuleva konto näide, sisestan nullist, Tuleva liikmest koguja, Tuleva mitteliikmest koguja; 2) liikme või mitteliikme all viis koguja profiili. Valik viib aadressile `/elukaar/?p=<profiil>`.
- `/elukaar/` on Kadi leht (`public/elukaar/index.html`, haru `kadi-branch`). Parameeter `?p=` täidab algandmed (profiilid `PROFILES` lehe lõpus, samad väärtused mis `public/arhiiv/kalkulaator/andmed/kihid.js` `ALGUSPUNKTID`); kõiki välju saab ise muuta.
- `/arhiiv/` on varasemate prototüüpide sisukord: `/arhiiv/kalkulaator/`, `/arhiiv/plaan/`, `/arhiiv/ratas/`, `/arhiiv/kasiino.html`, `/arhiiv/lauamang/`.
- Vanad aadressid `/kalkulaator/`, `/plaan/`, `/ratas/` (ka prinditud QR `/ratas/?k=a5`) suunavad Workeris (`arhiiviAadress` failis `src/index.js`) uuele aadressile, päring säilib.

## Töövoog

1. **Otsus.** Mida muudame, on kirjas [otsuste logis](https://claude.ai/code/artifact/db97d812-22e1-4c5c-a076-89b7571d2a54). Ilma otsuseta toodangusse ei liigu midagi.
2. **Ehitus.** Muudatus tehakse uues harus nimega `muudatus/<lühike-nimi>`, näiteks `muudatus/tagasiside`. Kiired katsetused võib teha enne claude.ai artefaktis.
3. **Push.** Haru läheb GitHubi. Automaatselt käivituvad:
   - GitHub Actions → suitsutest (telefon ja arvuti, kõik 5 sammu, põhiarvud);
   - Cloudflare → eelvaate-URL.
4. **Test.** Üks inimene, mitte muudatuse tegija, mängib eelvaate telefonis läbi (kontrollnimekiri allpool).
5. **Toodangusse.** Pull request → `main`, kui test on roheline ja eelvaade üle vaadatud. Cloudflare avaldab mõne minutiga.
6. **Märge.** Otsuste logis märgitakse, mis läks toodangusse ja millal.

## Reeglid

- `main` muutub ainult pull requesti kaudu: roheline suitsutest + keegi on eelvaate telefonis läbi mänginud.
- Mäng on üks fail, väliseid skripte ei ole. Lubatud on ainult Google Fonts. Server teeb ainult `/api/tts`.
- Ei mingit analüütikat, küpsiseid ega andmete saatmist. Kui tahame mõõta, otsustame selle enne logis.
- Arvud tulevad allikast. Kui muudad kordajaid, suremusmudelit või pensioniiga, uuenda ka testi oodatud väärtust (`tests/smoke.mjs`) ja allikaviidet lehe jaluses.
- Tuleva logo avalikul lehel ei kasuta. Silt „prototüüp“ ja lahtiütlus jäävad alles.
- **Külmutus:** viimased 60 minutit enne lõppesitlust `main`-i ei muudeta. Esitlus tehakse versioonist, mis on märgitud git-sildiga `pitch`.
- **Tagasivõtmine:** Cloudflare → Workers & Pages → mina → Deployments → eelmine versioon → Rollback. Või `git revert` ja uus pull request.

## Hääl (kõnesüntees)

Kõne-ekraanil loeb tulevane mina tsitaadi ette. Tekst läheb `/api/tts` kaudu TartuNLP Neurokõnele (Tartu Ülikool) ja tagasi tuleb heli. Sõnumis on ainult vanus ja summa, mitte isikuandmed.

- Hääled: mees `albert`, naine `kylli` (`VOICES` failis `public/index.html`). Võimalikud: albert, indrek, kalev, kylli, lee, liivika, luukas, mari, meelis, peeter, tambet, vesta.
- Kiire kontroll brauseris: `/api/tts?proov=1&haal=albert` peab mängima lause „Tere! Siin räägib sinu tulevane mina.“
- Hääl välja (nt Wizard of Oz, kui tiimiliige räägib ise): lisa aadressile `?haal=vaikne`.
- Kui kõnesüntees ei vasta, jätkub mäng tekstiga.
- Häält tasub kuulata Google Home kõlarist (Bluetooth), mitte telefonist.

## Kõne turvareeglid

Kõne tulevaselt minalt kasutab samu võtteid nagu telefonipetturid. Seepärast kehtivad kindlad reeglid, mida ükski muudatus ei muuda:

1. Kõne ei küsi kunagi midagi: koode, PIN-i, ID-kaarti, Smart-ID-d, linke ega ülekandeid. Tulevane mina ainult räägib.
2. Kõne toimub ainult mängus ja algab mängija enda tegevusest. Päris telefonikõnesid kellegi numbrile ei tee.
3. Häälekloonimist ei kasuta.
4. Kõne-ekraanil on alati rida „Tulevane Mina ei küsi kunagi koode, PIN-i ega raha.“ Suitsutest kontrollib seda.

Mängu lõpp paljastab, et kõne kasutas petturite võtteid, ja soovitab kahtluse korral kõne lõpetada ning ise panka helistada.

## Raamid: panus ja kingitus

Sama otsust saab näidata kahes raamis. Arvutus on mõlemas identne, muutub ainult sõnastus.

- **Panus** (vaikimisi): kasiino-kiht, koefitsiendid, LIVE-riba, võlts taimer ja nügimine. Lõpp paljastab iga võtte.
- **Kingitus** (`?raam=kingitus`): ootamine on kingitus tulevasele minale. Mängija valib, mida tahaks pensionil teha. Protsendid koefitsientide asemel, LIVE-riba ja taimerit pole. Kõne tänab kingituse eest või ütleb ilma süüdistamata, et see ei jõudnud kohale (riiklik pension ei pärandu, II ja III sammas pärandub).
- Mõlema raami lõpus on link teise raami. Valikuid ei loendata ega salvestata (andmete kogumine vajab otsuste logis otsust).

## Elu-kupong (`?raam=kupong`)

Spordiennustuse variant. Mängija valib mängu avaekraanil (Pensioniratas, Kingitus, Elu-kupong); valik jõuab aadressiribale `?raam=` kujul.

- **Turud:** pensioni ajastus (−3, 0, +3, +5 a) koos valikuga, kas varem saadud raha kulub või kasvab sambas; fondivalik (kallis 1,0% vs indeks 0,3%, näited); lubadus riigile (alkohol ühikutes nädalas, suitsetamine) ehk BOOST; üle/alla inflatsioon, palgakasv, indeksi tootlus (5% marginaaliga).
- **Mudel:** 2000 seemnega simuleeritud elu ja majandust. Panused on seotud: lubadus muudab elukõverat ja seega ajastuse koefitsienti. Lubaduste mõju eluea kaotusena (Wood jt 2018, Doll jt 2004). Kuusissetulek = riiklik pension + sambavara jagatud eeldatava allesjäänud elueaga (fondipensioni loogika), tänases rahas. Tervelt elatud aastad Eurostati 2023 näitaja järgi.
- **Paljastus:** sõltumatuse eeldus vs päris tõenäosus, suur koefitsient = halb panus, raha kasv vahepeal, makropanused ei muuda pensioni, „võimalik võit“ = parim 10%, populaarne kombo, petturivõtted.

## Ülevaatus ja õigused

Heidi Reinson andis 8.10 loa prototüüpi häkatonil avalikult testida; eraldi mängureegli piiranguid ta ei sea. Prototüübis pole viiteid tema uurimistööle ega sealsetele leidudele. Detailsem tagasiside tuleb hiljem (otsuste logi). Häkatoni tulemuste varalised õigused kuuluvad Tulevale.

## Mõõtmine ja tagasiside

Otsus otsuste logis 7.10. Eesmärk: valida testijate põhjal, milline mäng häkatonil esitada.

- **Loos:** kui aadressil pole `?raam=`, loositakse avaekraanil üks kolmest mängust (sama brauser saab sama loosi). Mängija võib vahetada.
- **Sündmused (anonüümne seansi-ID):** `start` (alustas mängu), `reveal` (jõudis tõe-ekraanile), `feedback` (andis tagasisidet). Kaasas ainult loositud ja mängitud mängu nimi.
- **Tagasiside (6. ekraan):** arusaamise küsimus (õige/vale), „pani mõtlema“ 1–5, järgmine tegevus, aus/manipuleeriv, segment, eelistus (kui mängis mitut), vaba vastus kuni 280 märki.
- **Ei salvestata:** IP-aadressi, sünniaastat, pensioni, sambavara, tervisevalikuid.
- **Peamine mõõdik:** osa vastajatest, kes vastas arusaamise küsimusele õigesti **ja** valis mõne tegevuse (mitte „ei midagi“).
- **Tulemused:** `/tulemused` (parool = Cloudflare secret `TULEMUSED_VOTI`, kasutajanimi ükskõik mis), `/tulemused.csv`. Vaikimisi ainult selle aadressi vastused; eelvaated lingiga „Näita ka eelvaateid“.
- **Andmebaas:** Cloudflare D1 `mina-tagasiside` (binding `DB`, nii toodangus kui eelvaadetes). Tabelid `sundmused` ja `vastused` luuakse esimesel päringul.
- Kohalikus testis loob `wrangler dev` kohaliku D1; tulemuste lehe jaoks pane faili `.dev.vars` rida `TULEMUSED_VOTI=proov` (fail on gitignore'is).

## Ligipääsetavus

Siht WCAG 2.1 AA; põhimõtted on disainisüsteemi README-s („Ligipääsetavus“).

- Võit/kaotus: sinine `--gain` ja oranž triibuline `--loss`, mitte roheline–punane; alati ka sõna, märk või muster.
- Puuteala ≥ 44 px, fookus liigub sammu vahetusel pealkirjale, ratta tulemus teatatakse ekraanilugejale.
- Vilkumine ja helin lõpevad 5 s jooksul; `prefers-reduced-motion` peatab animatsioonid.
- `npm test` jooksutab igal ekraanil axe-core'i (WCAG 2.1 A/AA); tõsine või kriitiline viga kukutab testi.

## Käsitsi kontrollnimekiri (eelvaade telefonis)

- [ ] Avaneb telefonis, teksti ei lõigata ja külgsuunas kerida ei saa.
- [ ] Sünniaasta, sugu ja pension muudavad pensioniiga ja eeldatavat eluiga.
- [ ] Panus: kõik 11 koefitsiendinuppu töötavad ja kupong muutub.
- [ ] Ratas keerleb ja jääb seisma, keskel on vanus.
- [ ] Kõne heliseb. Nii „Vasta“ kui ka „Keeldu“ viivad tsitaadini ja hääl loeb selle ette. Turvarida on nähtav.
- [ ] Tõde: graafik, kolm numbrit, paljastatud võtted ja tabel on olemas.
- [ ] „Proovi teist panust“ ja „Alusta otsast“ töötavad.
- [ ] Mõlemad sood ja vähemalt valikud −5, 0 ja +5 on läbi proovitud.
- [ ] Ratas ja graafik on loetavad ka halltoonis (telefoni ligipääsetavuse seadetes värvifilter → halltoonid).
- [ ] Avaekraanil on üks mäng loositud ja loosimärkus nähtav; tagasiside saatmine näitab „Aitäh!“ ja vastus jõuab /tulemused lehele.
- [ ] Elu-kupong: mänguvalik avaekraanil, lubadus muudab ajastuse koefitsienti, kõne ja arveldatud kupong.
- [ ] `?raam=kingitus`: tegevuse küsimus, protsendid, kingituse kupong, kõne ja paljastus raami kohta; link teise raami töötab.

## Kohalik test

```
npm install
npx playwright install chromium
npx wrangler dev            # http://localhost:8787 (mäng + /api/tts)
npm test                    # teises aknas
```

## Ühekordne seadistus

1. **GitHub:** repo on [mirxz/tulevane-mina](https://github.com/mirxz/tulevane-mina) (privaatne kuni pühapäevase demoni) ja lisa sinna selle kausta failid, näiteks GitHub Desktopis: *Add existing repository* → *Publish*.
2. **Cloudflare:** Workers & Pages → *Create* → *Import a repository* → vali `tulevane-mina`.
   - Workeri nimi: `mina` (peab klappima `wrangler.jsonc` failiga); konto alamdomeen `tulevane`.
   - Build command: tühi.
   - Deploy command: `npx wrangler deploy`.
   - Production branch: `main`. Luba *non-production branch builds* (eelvaated).
3. **Tagasiside andmebaas:** Storage & databases → D1 → *Create database* → nimi `mina-tagasiside`. Kopeeri *Database ID* faili `wrangler.jsonc` (kaks kohta, `database_id`).
5. **Prototüübi parool (valikuline):** samas kohas *Secret* nimega `PROTO_VOTI`. Kui see on seatud, küsib sait parooli; ilma selleta on sait avatud.
4. **Tulemuste parool:** Workers & Pages → `mina` → Settings → Variables and Secrets → *Add* → tüüp *Secret*, nimi `TULEMUSED_VOTI`, väärtus parool.

## Allikad

- Pensioni kordajad: Sotsiaalkindlustusamet, paindlik vanaduspension, 2026 keskmised (plaanis `public/plaan/mudel.js`; arhiivimängudes vanad väärtused).
- Suremus (plaan): Statistikaameti elutabel RV045 ja RV046, fail `public/plaan/elutabel.js`, uuendus `python3 scripts/elutabel.py`. Arhiivimängudes Gompertzi mudel (Eurostat 2023).
- Pensioniiga: TulevaEE/onboarding-client `pensionCalculator/calculation.ts` (MIT).

## Plaani prototüüp (avaleht, 9.10)

Häkatonil sõnastatud probleem (JTBD): „Kui pean otsustama, millal ja kuidas oma pensioniraha kasutama hakata, tahan näha, kas mu plaan katab vajaduse elu lõpuni, et teha otsus, mida ma enam hiljem ei kahetse.“ Emotsioon: „Kui olen vana, ei peaks koonerdama.“

Avalehel on samale plaanile kolm vaadet; vaade loositakse (`?vaade=kalk|kaar|korv` valib käsitsi):

- **Kalkulaator** (`kalk`): sissetulek kuus, vajadus, turvaline kulu.
- **Elukaar** (`kaar`): sissetulek aastate kaupa tulpadena, vajaduse joon ja otsustuspunktid (sammaste väljamakse, riiklik pension, pooled / 10% elavad kauem).
- **Ostukorv** (`korv`): millist elu saan endale lubada; korvi summa ja plaani kandevõime.

Mudel on failis `public/plaan/mudel.js`: Statistikaameti elutabel (ainult vanus ja sugu, terviseandmeid ei küsita), paindliku pensioni kordajad, fondipension (vara jagatud allesjäänud elueaga), tänases rahas. „Elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest. Eeldused on lehel avatavad.

Mõõtmine: `/api/p` salvestab D1 tabelitesse `plaan_sundmused` ja `plaan_vastused` ainult vaate, kindluse enne/pärast (1–5), vastuse „kas plaan katab?“ (ja kas see klapib mudeliga), suurema hirmu (otsa / elamata), eelistuse ja vabateksti. Summasid ega vanust ei salvestata. Tulemused on `/tulemused` lehe ülaosas.

Arhiiv: kasiino-, kingitus- ja kupongimäng on aadressil `/arhiiv/kasiino.html`, lauamäng `/arhiiv/lauamang/` (vana aadress `/mang`, ka prinditud QR-kood, annab teadlikult veateate „Seda prototüüpi enam pole“). Avalehelt neile linki pole; need on alles põhimõtete laenamiseks.

## Lauamäng (`/arhiiv/lauamang/`, arhiivis)

Paberprototüübi v0.1 reeglid kolmel tasemel, et häki ajal testida, itereerida ja lihtsustada:

- **L1 kaaslane** `/arhiiv/lauamang/kaaslane.html`: paberlaua kõrvale. Majandus-, sündmus- ja vestluskaardid, elukell (2 täringut + muutjad) ja tulevase mina kõne (TartuNLP hääl).
- **L2 üksi** `/arhiiv/lauamang/`: kogu mäng telefonis. Stardikaart või „Minu enda elu“ (suurusjärgud, 1 münt ≈ 5 000 €).
- **L3 paar ja seltskond** `/arhiiv/lauamang/`, kaks moodust:
  - **Ühes telefonis**: kordamööda, iga käigu ees „Anna telefon“, sest tervisekaart on salajane.
  - **Igaüks oma telefonis**: võrgutuba, 5-täheline kood ja link. Olek on D1 tabelis `mang_toad` versiooniga; samaaegsed käigud saavad vastuseks 409 ja proovivad uuesti. Toad kustuvad 3 päevaga. Salvestatakse ainult mänguolek.

Reeglid elavad failis `public/arhiiv/lauamang/engine.js` (puhtad funktsioonid) ja kaardid failis `public/arhiiv/lauamang/kaardid.json`. Reeglit muutes muuda mootorit ja kaarte, mitte kasutajaliidest.

Testid:

- `node tests/engine.mjs`: 400 juhuslikku mängu.
- `node tests/mang.mjs http://127.0.0.1:8787`: kaaslane, üksi, paar, kolm telefoni toas, axe.

Teadaolevad lüngad v0.1-s:

- „Säästumäära seadja“ eriõigus (Rõõmu asemel +1 Vara) pole digis rakendatud.
- Tervisekontroll valib automaatselt (+1 Tervis või kõrge riski ohjamine).

### Allikas ja jagamine (10.10)

- Lingile lisatud `?k=fb` (või `reklaam`, `lkd`, `tuleva`…) jääb seadmes meelde ja salvestatakse koos vaate sündmustega ning vastustega (väli `allikas`, kuni 16 märki `a–z 0–9 _ -`). Esimene allikas jääb kehtima. `/tulemused` näitab kanalite kaupa, mitu alustas ja mitu vastas.
- Aitäh-ekraanil on nupp „Jaga linki“ (telefonis süsteemne jagamine, mujal kopeerib lingi). Link on `/?k=jagatud`, sõnum ei sisalda sisestatud andmeid. Jagamine registreeritakse sündmusena `share`.
- `/tulemused` ülaosas on loendur: lõpetanud, alustanud seadmeid, jaganud.
- Olemasolevatele D1 tabelitele lisatakse veerg `allikas` automaatselt esimesel päringul.

## Õnneratta maandumisleht (`/ratas/`, 10.10)

Mobiilisõbralik leht: vikerkaareratas, esimene keerutus määrab seitsme küsimuse järjekorra (esimene = ratta valitud sektor, ülejäänud segamini), üks küsimus korraga, seitsmesegmendiline edenemisriba, lõpus tänuleht (sisend-/resoneerimistest) ja valikuline e-post pühapäevase testlingi jaoks.

- Aadress ja allikas: `/ratas/?k=<allikas>` (nt `?k=a5` paber-QR, `?k=fb`, `?k=tanav`). Jagamisnupp lisab `?k=jagatud`.
- Andmed: `/api/r`, tabelid `ratas_sundmused` (anonüümne seansi tunnus, vastused, vabatekst; e-posti- ja pika numbri-sarnane tekst maskitakse) ja `ratas_meilid` (e-post ilma seansi tunnuseta, eraldi, et ei saaks vastustega siduda). Tulemused: `/tulemused` (osa „Õnneratas“), e-postid: `/tulemused-meilid.csv` (sama parool).
- FB/sotsiaalmeedia pilt: `public/ratas/og.png` (1200×630), `og:` märgendid on `index.html`-is.
- Test: `node tests/ratas.mjs <URL>`.
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes

## Kalkulaator (`/kalkulaator/`)

Täielik pensionikalkulaator Tuleva pensionikalkulaatori välimuses: sama kaart, helesinine sisendipaneel, segmentnupud ja ümar liugur. Eesmärk on näidata, mitu sisendit on tänane plaani tegemine, ja siis lasta alustada tüüpilisest kogujast.

- **Mootor:** `public/kalkulaator/mootor.js` on Meelise [tuleva-tulevik](https://github.com/meelisb/tuleva-tulevik) `js/pension.js` ES-moodulina. Meie lisatud sisendid (fondi tasu, palga reaalkasv, muud säästud, hoiuse tootlus, maksumäär, „elu lõpuni“ lävi) on märgitud `LISA` ja vaikeväärtustega annavad täpselt Meelise tulemuse (test kontrollib).
- **Andmekihid:** `public/kalkulaator/andmed/kihid.js`. Iga sisendi vaikeväärtus tuleb ühest kihist (`seadus`, `statistika`, `tuleva`, `konto`, `eeldus`) ja lehel on selle märk. Sinu sisestatud väärtus on kiht `sina` ja „Taasta“ toob vaikeväärtuse tagasi. Uus allikas = uus kiht selles failis.
- **Statistikaamet:** `andmed/elutabel.js` ja `andmed/kulud.js` on Meelise genereeritud failid. Uuenda tema skriptidega (`scripts/fetch_*.py` tema repos), ära muuda käsitsi.
- **Tuleva aruanded:** personad ja varajaotus on käsitsi ülekantud avalikest agregaatidest (reporting-engine, `savers_analysis`, `ii_iii_wealth_distribution`, `fund_flow_analysis`). Kommentaarid failis näitavad, kust iga number tuleb. Enne avalikku kasutamist tuleb luba küsida Tuleva andmetiimilt (Tõnu).
- **Testid:** `node tests/kalkulaator-mootor.mjs` (Meelise testid + lisandused + andmekihid) ja `node tests/kalkulaator.mjs <URL>` (liides, taastamine, graafik, ligipääsetavus).

### Riiklik pension (/kalkulaator/)

Kalkulaator arvutab riikliku pensioni seaduse valemiga (`public/kalkulaator/riiklik.js`): baasosa 399,24 € + 10,477 € × (staaž kuni 1998 + aastakoefitsientide summa), 1.4.2026 väärtustega. Tulemus on mootori sisend `p1Monthly` (tänased väärtused), mida mootor indekseerib `p1Growth` võrra. Vaikimisi reaalindekseerimine 1,5% on projekti eeldus, mitte seadus. Tead täpset summa SKA kalkulaatorist, vali „Sisesta ise“.
>>>>>>> Stashed changes

## Tagasiside leht (`/tagasiside/`, 10.10)

Elukaare lõpus (tulemuse peatükis) on link lehele `/tagasiside/`. Leht on ratta eeskujul anonüümne: ei küsi nime ega e-posti ega saada sisestatud numbreid. Link kannab kaasa algpunkti (`?p=`) ja kanali (`?k=`).

Mõõdame neli asja ja vaba kommentaari (kõige olulisem, seepärast suur kast lehe lõpus):

1. Kas oskas algandmeid täita (jah / osaliselt / ei, osalise või eitava vastuse korral „mis segas“).
2. Kas oskab 5–10 minuti pärast öelda, millise vanuseni tema raha jätkub (jah / umbes / ei, vanus numbrina).
3. Kas nimetab vähemalt ühe asja, mida enne ei teadnud (jah / ei, „mis see oli“).
4. Kas muudaks oma plaani või käitumist (jah / võib-olla / ei, „mida“).

Vastused lähevad `/api/t` kaudu D1 tabelisse `tagasiside_vastused` (sama seanss asendab eelmise vastuse). E-posti-sarnased tekstid ja pikad numbrid maskitakse enne salvestamist. Tulemused: `/tulemused` (osa „Tagasiside“) ja `/tulemused-tagasiside.csv`. CSV-d on eraldi iga andmekogu kohta: `tulemused-tagasiside.csv`, `tulemused-ratas.csv`, `tulemused-plaan.csv`, `tulemused-meilid.csv`; `tulemused.csv` on ainult varasemate mängude vastused (arhiveeritud mängudel uusi vastuseid pole, seepärast võis see olla tühi). Test: `node tests/tagasiside.mjs <URL>`, valikuliselt `TULEMUSED_PAROOL=…` CSV-de kontrolliks.
