# Arhiveeritud prototüübid: tehniline kirjeldus

Need prototüübid tehti Tuleva häkatoni ajal (2026-10-09 kuni 2026-10-11). Nad töötavad edasi aadressidel `/arhiiv/…`, aga neid ei arendata. Tekst on varasemast README-st üle toodud; kuupäevad on kirjutamise ajast (oktoober 2026). Praegune põhitoode on Elukaar, vt [README.md](../README.md).

| Prototüüp | Aadress | Mis see oli |
| --- | --- | --- |
| Kasiino | `/arhiiv/kasiino.html` | Mäng, kus pensioniaastad on panus, ratas veeretab elu läbi suremusstatistika ja „tulevane mina“ helistab; kolm raami (panus, kingitus, elu-kupong) |
| Lauamäng | `/arhiiv/lauamang/` | Lauamängu digiversioon (kaaslane, üksi, paar ja seltskond) |
| Õnneratas | `/arhiiv/ratas/` | Häkatoni maandumisleht: ratas ja seitse küsimust, mis on tegelikult teada ja mis mitte |
| Plaan | `/arhiiv/plaan/` | Kas mu plaan katab vajaduse elu lõpuni (kalkulaator, elukaar, ostukorv) |
| Kalkulaator | `/arhiiv/kalkulaator/` | Täielik pensionikalkulaator Tuleva kalkulaatori välimuses |

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

## Mõõtmine ja tagasiside (kasiinomäng)

Eesmärk: valida testijate põhjal, milline mäng häkatonil esitada.

- **Loos:** kui aadressil pole `?raam=`, loositakse avaekraanil üks kolmest mängust (sama brauser saab sama loosi). Mängija võib vahetada.
- **Sündmused (anonüümne seansi-ID):** `start` (alustas mängu), `reveal` (jõudis tõe-ekraanile), `feedback` (andis tagasisidet). Kaasas ainult loositud ja mängitud mängu nimi.
- **Tagasiside (6. ekraan):** arusaamise küsimus (õige/vale), „pani mõtlema“ 1–5, järgmine tegevus, aus/manipuleeriv, segment, eelistus (kui mängis mitut), vaba vastus kuni 280 märki.
- **Ei salvestata:** IP-aadressi, sünniaastat, pensioni, sambavara, tervisevalikuid.
- **Peamine mõõdik:** osa vastajatest, kes vastas arusaamise küsimusele õigesti **ja** valis mõne tegevuse (mitte „ei midagi“).

## Plaan (`/arhiiv/plaan/`, varem avaleht, 2026-10-09)

Häkatonil sõnastatud probleem (JTBD): „Kui pean otsustama, millal ja kuidas oma pensioniraha kasutama hakata, tahan näha, kas mu plaan katab vajaduse elu lõpuni, et teha otsus, mida ma enam hiljem ei kahetse.“ Emotsioon: „Kui olen vana, ei peaks koonerdama.“

Avalehel on samale plaanile kolm vaadet; vaade loositakse (`?vaade=kalk|kaar|korv` valib käsitsi):

- **Kalkulaator** (`kalk`): sissetulek kuus, vajadus, turvaline kulu.
- **Elukaar** (`kaar`): sissetulek aastate kaupa tulpadena, vajaduse joon ja otsustuspunktid (sammaste väljamakse, riiklik pension, pooled / 10% elavad kauem).
- **Ostukorv** (`korv`): millist elu saan endale lubada; korvi summa ja plaani kandevõime.

Mudel on failis `public/arhiiv/plaan/mudel.js`: Statistikaameti elutabel (ainult vanus ja sugu, terviseandmeid ei küsita), paindliku pensioni kordajad, fondipension (vara jagatud allesjäänud elueaga), tänases rahas. „Elu lõpuni“ = vanus, milleni jõuab elusalt 10% sinuvanustest. Eeldused on lehel avatavad.

Mõõtmine: `/api/p` salvestab D1 tabelitesse `plaan_sundmused` ja `plaan_vastused` ainult vaate, kindluse enne/pärast (1–5), vastuse „kas plaan katab?“ (ja kas see klapib mudeliga), suurema hirmu (otsa / elamata), eelistuse ja vabateksti. Summasid ega vanust ei salvestata. Tulemused on `/tulemused` lehe ülaosas.

Arhiiv: kasiino-, kingitus- ja kupongimäng on aadressil `/arhiiv/kasiino.html`, lauamäng `/arhiiv/lauamang/` (vana aadress `/mang`, ka prinditud QR-kood, annab teadlikult veateate „Seda prototüüpi enam pole“). Avalehelt neile linki pole; need on alles põhimõtete laenamiseks.

## Lauamäng (`/arhiiv/lauamang/`)

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

### Allikas ja jagamine (2026-10-10)

- Lingile lisatud `?k=fb` (või `reklaam`, `lkd`, `tuleva`…) jääb seadmes meelde ja salvestatakse koos vaate sündmustega ning vastustega (väli `allikas`, kuni 16 märki `a–z 0–9 _ -`). Esimene allikas jääb kehtima. `/tulemused` näitab kanalite kaupa, mitu alustas ja mitu vastas.
- Aitäh-ekraanil on nupp „Jaga linki“ (telefonis süsteemne jagamine, mujal kopeerib lingi). Link on `/?k=jagatud`, sõnum ei sisalda sisestatud andmeid. Jagamine registreeritakse sündmusena `share`.
- `/tulemused` ülaosas on loendur: lõpetanud, alustanud seadmeid, jaganud.
- Olemasolevatele D1 tabelitele lisatakse veerg `allikas` automaatselt esimesel päringul.

## Õnneratas (`/arhiiv/ratas/`, 2026-10-10)

Mobiilisõbralik leht: vikerkaareratas, esimene keerutus määrab seitsme küsimuse järjekorra (esimene = ratta valitud sektor, ülejäänud segamini), üks küsimus korraga, seitsmesegmendiline edenemisriba, lõpus tänuleht (sisend-/resoneerimistest) ja valikuline e-post pühapäevase testlingi jaoks.

- Aadress ja allikas: `/arhiiv/ratas/?k=<allikas>` (nt `?k=a5` paber-QR, `?k=fb`, `?k=tanav`). Jagamisnupp lisab `?k=jagatud`.
- Andmed: `/api/r`, tabelid `ratas_sundmused` (anonüümne seansi tunnus, vastused, vabatekst; e-posti- ja pika numbri-sarnane tekst maskitakse) ja `ratas_meilid` (e-post ilma seansi tunnuseta, eraldi, et ei saaks vastustega siduda). Tulemused: `/tulemused` (osa „Õnneratas“), e-postid: `/tulemused-meilid.csv` (sama parool).
- FB/sotsiaalmeedia pilt: `public/arhiiv/ratas/og.png` (1200×630), `og:` märgendid on `index.html`-is.
- Test: `node tests/ratas.mjs <URL>`.

## Kalkulaator (`/arhiiv/kalkulaator/`)

Täielik pensionikalkulaator Tuleva pensionikalkulaatori välimuses: sama kaart, helesinine sisendipaneel, segmentnupud ja ümar liugur. Eesmärk on näidata, mitu sisendit on tänane plaani tegemine, ja siis lasta alustada tüüpilisest kogujast.

- **Mootor:** `public/arhiiv/kalkulaator/mootor.js` on Meelise [tuleva-tulevik](https://github.com/meelisb/tuleva-tulevik) `js/pension.js` ES-moodulina. Meie lisatud sisendid (fondi tasu, palga reaalkasv, muud säästud, hoiuse tootlus, maksumäär, „elu lõpuni“ lävi) on märgitud `LISA` ja vaikeväärtustega annavad täpselt Meelise tulemuse (test kontrollib).
- **Andmekihid:** `public/arhiiv/kalkulaator/andmed/kihid.js`. Iga sisendi vaikeväärtus tuleb ühest kihist (`seadus`, `statistika`, `tuleva`, `konto`, `eeldus`) ja lehel on selle märk. Sinu sisestatud väärtus on kiht `sina` ja „Taasta“ toob vaikeväärtuse tagasi. Uus allikas = uus kiht selles failis.
- **Statistikaamet:** `andmed/elutabel.js` ja `andmed/kulud.js` on Meelise genereeritud failid. Uuenda tema skriptidega (`scripts/fetch_*.py` tema repos), ära muuda käsitsi.
- **Tuleva aruanded:** personad ja varajaotus on käsitsi ülekantud avalikest agregaatidest (reporting-engine, `savers_analysis`, `ii_iii_wealth_distribution`, `fund_flow_analysis`). Kommentaarid failis näitavad, kust iga number tuleb. Enne avalikku kasutamist tuleb luba küsida Tuleva andmetiimilt.
- **Testid:** `node tests/kalkulaator-mootor.mjs` (Meelise testid + lisandused + andmekihid) ja `node tests/kalkulaator.mjs <URL>` (liides, taastamine, graafik, ligipääsetavus).

### Riiklik pension (/arhiiv/kalkulaator/)

Kalkulaator arvutab riikliku pensioni seaduse valemiga (`public/arhiiv/kalkulaator/riiklik.js`): baasosa 399,24 € + 10,477 € × (staaž kuni 1998 + aastakoefitsientide summa), 1.4.2026 väärtustega. Tulemus on mootori sisend `p1Monthly` (tänased väärtused), mida mootor indekseerib `p1Growth` võrra. Vaikimisi reaalindekseerimine 1,5% on projekti eeldus, mitte seadus. Tead täpset summa SKA kalkulaatorist, vali „Sisesta ise“.
