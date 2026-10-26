// Elukaare selgitused („?“ nupud): pealkiri ja sisu. Avaneb dialoogis (lauaarvutis külgpaneel, mobiilis modaal).
// Igal faktil on allikas; kuupäev = millal üle kontrollitud. [verified] = ametlik allikas, [secondary] = tiimi teine repo või meedia.
(function (root) {
  'use strict';
  // Ikooni ja „(avaneb uues aknas)“ lisab story.js decorateExt.
  const a = (href, text) => '<a href="' + href + '" target="_blank" rel="noopener">' + text + '</a>';
  const SKA_SELF = 'https://iseteenindus.sotsiaalkindlustusamet.ee/';
  const SKA = 'https://sotsiaalkindlustusamet.ee';
  root.ELUKAAR_ABI = {
    sex: {
      title: 'Miks küsime sugu?',
      html: '<p>Naised elavad Eestis keskmiselt kauem kui mehed. Sellest sõltub, mitu aastat peab sinu raha kestma ja kui pikk on fondipensioni maksuvaba periood.</p>' +
        '<p><strong>Elada jäänud aastad (Statistikaamet, 2025):</strong></p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Vanus</th><th scope="col">Mehed</th><th scope="col">Naised</th></tr></thead>' +
        '<tbody><tr><th scope="row">60</th><td>19,8 a</td><td>25,8 a</td></tr><tr><th scope="row">65</th><td>16,3 a</td><td>21,4 a</td></tr></tbody></table>' +
        '<p><strong>Muu:</strong> kasutame meeste ja naiste keskmist (65-aastaselt u 18,9 a).</p>' +
        '<p>Oodatav eluiga on aastatega pikenenud. Alates 2027 on pensioniiga seotud 65-aastaste keskmise eluea muutusega (vt „Pensioniiga“). Arvutus kasutab viimast avaldatud elutabelit ega ennusta selle muutust.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://andmed.stat.ee/et/stat/rahvastik__rahvastikusundmused__surmad/RV045', 'Statistikaamet RV045 ja RV046') + '.</p>',
    },
    pensionAge: {
      title: 'Kuidas pensioniiga määratakse?',
      html: '<p><strong>Reegel (RPKS § 7):</strong> pensioniiga on 65 aastat, millele alates 2027. aastast liidetakse 65-aastaste keskmise eluea muutus. Võrreldakse viie aasta keskmist eluiga baasperioodiga 2018–2022 ja muutus ümardatakse kuudeks. Pensioniiga kinnitatakse kaks aastat ette.</p>' +
        '<p>Reegel kehtib <strong>kalendriaasta järgi</strong>: pensioniiga on see, mis kehtib aastal, mil sa sellesse vanusesse jõuad.</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Aasta</th><th scope="col">Pensioniiga</th></tr></thead><tbody>' +
        '<tr><th scope="row">2026</th><td>65 a</td></tr><tr><th scope="row">2027</th><td>65 a 1 k (kehtestatud)</td></tr>' +
        '<tr><th scope="row">2028</th><td>65 a 3 k (kavand)</td></tr><tr><th scope="row">2029</th><td>65 a 4 k (kavand)</td></tr>' +
        '<tr><th scope="row">hiljem</th><td>sõltub eluea muutusest, ligikaudne</td></tr></tbody></table>' +
        '<p>„Reegli järgi“ näitab sinu sünniaasta järgi arvutatud vanust täisaastates. Kui oled sisse logitud, tuleb see tulevikus SKA andmetest; seni saad selle valida ise.</p>' +
        '<p class="small-muted mb-0">Allikad: ' + a('https://www.riigiteataja.ee/akt/RPKS', 'Riikliku pensionikindlustuse seadus § 7') + ', ' + a('https://www.err.ee/1609773990/pensioniiga-touseb-2027-aastal-65-aasta-ja-uhe-kuuni', 'ERR 2027') + ', ' + a('https://err.ee/1610124787/2029-aasta-vanaduspensioniiga-on-65-aastat-ja-neli-kuud', 'ERR 2029') + '.</p>',
    },
    p1: {
      title: 'Mis on riiklik pension?',
      html: '<p>Riiklik vanaduspension (I sammas) on enamikule pensionäridest peamine sissetulek. Selle suurus mõjutab toimetulekut pensionieas kõige rohkem. Siin ei ole arvestatud sinu muid sääste.</p>' +
        '<p><strong>Kuidas see kujuneb:</strong></p><ul>' +
        '<li><strong>Baasosa:</strong> kõigil sama.</li>' +
        '<li><strong>Staažiosa:</strong> tööaastad kuni 1998. Iga aasta annab sama palju, palk ei loe.</li>' +
        '<li><strong>Kindlustusosa (1999–2020):</strong> sinu eest makstud sotsiaalmaksu järgi. Kahekordne palk annab kaks korda rohkem.</li>' +
        '<li><strong>Ühendosa (alates 2021):</strong> pool palga järgi, pool kõigile võrdselt. Kahekordne palk annab umbes 1,5 korda rohkem.</li></ul>' +
        '<p>II sambaga liitunul on riiklik pension väiksem, sest 4% palgast läheb II sambasse. Seetõttu võib vanem inimene, kellel on palju tööaastaid enne 1999, saada suuremat riiklikku pensioni kui noorem ja suurema palgaga inimene. Noorema riikliku pensioni kõrvale tuleb II samba raha.</p>' +
        '<p>Pensioni indekseeritakse igal aastal 1. aprillist. Arvutus on tänastes eurodes, seega kasv pärast hinnatõusu jääb välja.</p>' +
        '<p><strong>Kust võtta summa:</strong> ' + a(SKA_SELF + 'self-service/pension-calculator', 'SKA iseteeninduse pensionikalkulaator') + ', osa <strong>„Prognoosimine“</strong>:</p>' +
        '<ol><li>Lülita sisse „Arvesta kogunenud pensioni andmeid“ ja sisesta oma brutopalk, II samba sissemakse ja III samba sissemakse.</li>' +
        '<li>Vali „Pensionile jäämine“ alt <strong>„Vanaduspension“</strong> (mitte laste eest varem ega paindlik pension, need arvestab Elukaar ise).</li>' +
        '<li>Ava „Prognoosi tulemus“ juures detailandmed ja võta rida <strong>„I sammas“</strong>. See on summa enne tulumaksu, tänastes eurodes.</li></ol>' +
        '<p><strong>Ära võta:</strong></p><ul>' +
        '<li>„Prognoosi tulemus“ kokku: see sisaldab ka II ja III sammast, mida Elukaar arvutab ise (läheks topelt);</li>' +
        '<li>„Praeguseks kogunenud pension“ ega „Pensionisambad“ vaate I samba summa: see on tänane seis ilma tulevaste tööaastateta.</li></ul>' +
        '<p class="mb-0">Pensioniea leiad samast kohast („Pensionile jäämise aeg“ miinus sünniaasta). Prognoos eeldab, et palk jääb samaks; kui palk muutub, arvuta prognoos uuesti.</p>',
    },
    kids: {
      title: 'Kuidas lapsed pensioni mõjutavad?',
      html: '<p>Lapse kasvatamine (vähemalt 8 aastat) annab kaks õigust. Mõlemat saab kasutada <strong>üks vanem</strong>; vanemad lepivad kirjalikult kokku. Kokkuleppe puudumisel jagatakse õigus võrdselt. Üks vanem võib kasutada õigust kõigi laste eest.</p>' +
        '<p><strong>1. Varem pensionile, pension ei vähene:</strong></p><ul><li>3 last: 1 a varem</li><li>4 last: 3 a varem</li><li>5 või enam last või puudega laps: 5 a varem</li></ul>' +
        '<p><strong>2. Pensionilisa:</strong></p><ul>' +
        '<li>enne 1991 sündinud laps: 1,5 aastahinnet ja 2 aastat staaži</li>' +
        '<li>1991–2012 sündinud laps: 3,5 aastahinnet</li>' +
        '<li>2013 või hiljem sündinud laps: riik maksab ühe vanema II sambasse 4% keskmisest palgast kuni lapse 3-aastaseks saamiseni (ilma II sambata 3,5 aastahinnet)</li></ul>' +
        '<p>Aastahinne on alates 1.04.2026 10,48 € kuus. Näiteks kaks 1991–2012 sündinud last annavad u 73 € kuus.</p>' +
        '<p>Eripensionile lisa ei lisata. Kui eripensionär läheb pensionieas üle vanaduspensionile, lisandub lisa sellele.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/pension-amount/raising-children-impacts-pensions', 'SKA: laste kasvatamine ja pension') + ' (kontrollitud 16.10.2026).</p>',
    },
    kidsWho: {
      title: 'Keda loetakse lapse kasvatajaks?',
      html: '<p>Õigus tekib, kui oled last kasvatanud <strong>vähemalt 8 aastat</strong>. Kasvataja võib olla:</p>' +
        '<ul><li>lapse vanem (ka lapsendaja);</li><li>vanema abikaasa või registreeritud elukaaslane (nt kasuema või kasuisa);</li><li>eestkostja või hooldaja.</li></ul>' +
        '<p>Kui last on kasvatanud mitu inimest, lepivad nad kokku, kes õigust kasutab.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/types-pensions/old-age-pension-under-favourable-conditions', 'SKA: soodustingimustel vanaduspension') + ', ' + a(SKA + '/en/pension-and-benefits/pension-amount/raising-children-impacts-pensions', 'laste kasvatamine ja pension') + ' (kontrollitud 16.10.2026).</p>',
    },
    kidsEarly: { title: 'Kes kasutab varem pensionile mineku õigust?', html: '<p>Laste eest on <strong>kaks eraldi õigust</strong>: varem pensionile minek (3+ last või puudega laps) ja pensionilisa. Kumbagi saab kasutada <strong>üks vanem</strong>, aga õigused võib vanemate vahel jagada: näiteks üks läheb varem pensionile ja teine saab pensionilisa.</p>' +
        '<ul><li>Vanemad lepivad <strong>kirjalikult</strong> kokku, kes millist õigust kasutab. Üks vanem võib kasutada õigust kõigi laste eest.</li>' +
        '<li>Kokkuleppe puudumisel jagatakse õigus vanemate vahel <strong>võrdselt</strong>.</li>' +
        '<li>Teise vanema nõusolekut pole vaja, kui ta on surnud, temalt on enne lapse 8-aastaseks saamist vanemaõigused ära võetud või tema elukohta ei saa rahvastikuregistri järgi kindlaks teha.</li>' +
        '<li>Kokkulepe ja avaldus esitatakse SKA-le e-postiga või ' + a(SKA_SELF, 'SKA iseteeninduses') + '.</li></ul>' +
        '<p>Tasub mõelda, kellele õigus rohkem annab: näiteks eripensionärile pensionilisa ei lisata, siis võiks seda kasutada teine vanem.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/pension-amount/raising-children-impacts-pensions', 'SKA: laste kasvatamine ja pension') + ' (kontrollitud 16.10.2026).</p>' },
    kidsSup: { title: 'Kes kasutab pensionilisa õigust?', html: '<p>Laste eest on <strong>kaks eraldi õigust</strong>: varem pensionile minek (3+ last või puudega laps) ja pensionilisa. Kumbagi saab kasutada <strong>üks vanem</strong>, aga õigused võib vanemate vahel jagada: näiteks üks läheb varem pensionile ja teine saab pensionilisa.</p>' +
        '<ul><li>Vanemad lepivad <strong>kirjalikult</strong> kokku, kes millist õigust kasutab. Üks vanem võib kasutada õigust kõigi laste eest.</li>' +
        '<li>Kokkuleppe puudumisel jagatakse õigus vanemate vahel <strong>võrdselt</strong>.</li>' +
        '<li>Teise vanema nõusolekut pole vaja, kui ta on surnud, temalt on enne lapse 8-aastaseks saamist vanemaõigused ära võetud või tema elukohta ei saa rahvastikuregistri järgi kindlaks teha.</li>' +
        '<li>Kokkulepe ja avaldus esitatakse SKA-le e-postiga või ' + a(SKA_SELF, 'SKA iseteeninduses') + '.</li></ul>' +
        '<p>Tasub mõelda, kellele õigus rohkem annab: näiteks eripensionärile pensionilisa ei lisata, siis võiks seda kasutada teine vanem.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/pension-amount/raising-children-impacts-pensions', 'SKA: laste kasvatamine ja pension') + ' (kontrollitud 16.10.2026).</p>' },
    hazard: {
      title: 'Mis on tervist kahjustav töö?',
      html: '<p>Kui oled töötanud riigi kinnitatud nimekirja järgi eriti raskel või tervist kahjustaval tööl, saad <strong>soodustingimustel vanaduspensioni</strong>: varem ja ilma vähenduseta. See on tavaline vanaduspension, mitte eripension.</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col"></th><th scope="col">Nimekiri nr 1</th><th scope="col">Nimekiri nr 2</th></tr></thead><tbody>' +
        '<tr><th scope="row">Töö</th><td>eriti raske ja eriti kahjulik</td><td>raske ja kahjulik</td></tr>' +
        '<tr><th scope="row">Varem pensionile</th><td>10 a</td><td>5 a</td></tr>' +
        '<tr><th scope="row">Staaž kokku</th><td>vähemalt 20 a</td><td>üle 25 a</td></tr>' +
        '<tr><th scope="row">Sellest nimekirja tööl</th><td>vähemalt 10 a</td><td>vähemalt 12,5 a</td></tr></tbody></table>' +
        '<p>Töö pidi olema täiskohaga ja sellel tööl ei tohi enam töötada. Muul tööl võid edasi töötada. Nimekirja tööd arvestatakse staaži hulka kuni 31.12.2030 (põlevkivi kaevandamine ja töötlemine kuni 31.12.2049).</p>' +
        '<p><strong>Kust nimekirju näha:</strong> Vabariigi Valitsuse 16.07.1992 määrus nr 206 „Soodustingimustel vanaduspensionile õigust andvate tootmisalade, tööde, kutsealade ja ametikohtade loetelude kinnitamine“ (' + a('https://www.riigiteataja.ee/', 'Riigi Teataja') + ', otsi pealkirja järgi). Nimekirjad on tootmisalade kaupa, näiteks kaevandamine, keemiatööstus, metallitöötlus ja kiirgusega töö. Nimekirja rakendatakse rangelt: kui sinu ametit seal pole, õigust ei teki. Kas sinu töö loeb, ütleb SKA.</p>' +
        '<p>Kui sul on ka lastega soodustus, arvestame neist suurema.</p>' +
        '<p><strong>Põlevkivi kaevandamine ja töötlemine</strong> võib anda õiguse kas siia (varem vanaduspensionile) või väljateenitud aastate pensionile (vt „Eripension“). Need on kaks eri seadust ja korraga makstakse ühte; SKA ütleb, kumb sulle kehtib ja kumb on suurem.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/types-pensions/old-age-pension-under-favourable-conditions', 'SKA: soodustingimustel vanaduspension') + ' (kontrollitud 16.10.2026).</p>',
    },
    sp: {
      title: 'Mis on eripension?',
      html: '<p>Eripension on teatud ametite pension, mida makstakse eraldi seaduse alusel, sageli juba enne pensioniiga. See on riiklik pension (I sammas).</p>' +
        '<ul><li><strong>Ametipension:</strong> kaitseväelane (alates 50 a, 20 a teenistust), politseiametnik, prokurör, kohtunik, Riigikogu liige, õiguskantsler, riigikontrolör.</li>' +
        '<li><strong>Väljateenitud aastate pension:</strong> nt piloot, meremees, balletiartist, päästja, vanglaametnik.</li></ul>' +
        '<p><strong>Uutele töötajatele ametipensioni enam ei teki.</strong> Õigus on neil, kes olid ametis tähtpäeval: kohtunik 1.7.2013, kaitsevägi, politsei ja prokuratuur 31.12.2019, päästja ja vanglaametnik 30.6.2022.</p>' +
        '<p><strong>Väljateenitud aastate pensioni</strong> staaži arvestatakse ametites, kus nõutav staaž on 10 või 12,5 aastat, kuni 31.12.2030 ja ametites, kus see on 15–25 aastat, kuni 31.12.2036. Põlevkivi kaevandamisel, töötlemisel ja rikastamisel kuni 31.12.2049.</p>' +
        '<p><strong>Erinevus tervist kahjustavast tööst:</strong> väljateenitud aastate pension on eraldi pension, mida makstakse ametis töövõime vähenemise tõttu enne pensioniiga. Tervist kahjustav töö (soodustingimustel pension) on tavaline vanaduspension varem. Mõlemal on põlevkivi erand kuni 2049, aga korraga makstakse ühte.</p>' +
        '<p><strong>Kui suur see on:</strong> kaitseväel ja politseil 50% ametipalgast 20 teenistusaasta eest ja iga lisaaasta +2,5%, kokku kuni 75%. Määratud eripensioni näed ' + a(SKA_SELF, 'SKA iseteeninduses') + '; tulevase summa arvuta ise selle reegli järgi.</p>' +
        '<p><strong>Kahte riiklikku pensioni korraga ei maksta.</strong> Kui jõuad pensioniikka (või lastega soodustuse vanusesse), saad valida suurema: eripension või vanaduspension. Eripensioni ei saa edasi lükata, varem võtta ega peatada.</p>' +
        '<p class="small-muted mb-0">Allikad: ' + a(SKA + '/pension-ja-seotud-huvitised/pensioni-liigid/eripensionid', 'SKA eripensionid') + ' (väljateenitud aastate pension ja tähtajad kontrollitud 16.10.2026); ametipensionide tähtpäevad: ametite seadused [secondary, tiimi kokkuvõte 14.10.2026].</p>',
    },
    spStart: {
      title: 'Miks on eripensioni algus oluline?',
      html: '<p>Eripension võib alata palju varem kui pensioniiga, näiteks kaitseväelasel 50-aastaselt. Sellest vanusest saad lisasissetulekut.</p>' +
        '<ul><li><strong>Töö muul erialal ei ole takistus:</strong> saad palka ja eripensioni korraga. II sambasse laekub palgalt edasi.</li>' +
        '<li><strong>Samas ametis</strong> eripensioni sageli ei maksta, siis pane alguseks vanus, mil ametist lahkud.</li>' +
        '<li>Kui saad eripensioni juba, pane vanus, millest see algas. Varasemad sissemaksed on sinu II ja III samba tänases summas juba sees.</li></ul>' +
        '<p class="mb-0">Algusvanuse järgi tekib teekonnale eripensioni samm.</p>',
    },
    pillars: {
      title: 'Miks küsime sammaste ja töö kohta?',
      html: '<p>Nende andmete järgi arvutame, kui palju sul pensionieas sammastes raha on ja kui kaua see kestab.</p>' +
        '<ul><li><strong>II sammas</strong> on kohustuslik kogumispension: osa sinu palgast ja riigi sotsiaalmaksust läheb pensionifondi. Raha saad kasutada alates 5 aastat enne pensioniiga.</li>' +
        '<li><strong>III sammas</strong> on vabatahtlik: maksad ise ja saad tulumaksu tagasi (kuni 15% brutotulust, kuni 6000 € aastas).</li>' +
        '<li><strong>Brutopalk</strong> määrab II samba sissemakse ja selle, kui palju töötamine pensionieas pensioni tõstab.</li></ul>' +
        '<p class="mb-0">Loe lähemalt: ' + a('https://tuleva.ee/', 'Tuleva') + ', ' + a('https://www.pensionikeskus.ee/', 'Pensionikeskus') + ', ' + a(SKA + '/et', 'SKA') + '.</p>',
    },
    p2Rate: {
      title: 'Mida tähendab II samba sissemakse?',
      html: '<ul><li><strong>2%</strong> brutopalgast on vaikimisi.</li><li><strong>4% või 6%</strong>: alates 2025 saad sissemakset vabatahtlikult tõsta. See ei vähenda sinu riikliku pensioni õigusi.</li>' +
        '<li><strong>Riik</strong> lisab alati 4% sinu sotsiaalmaksust, sõltumata sinu valitud määrast.</li><li><strong>Puudub:</strong> sa ei ole II sambaga liitunud või lahkusid sellest.</li></ul>' +
        '<p>Määra saab muuta üks kord aastas. Uus määr kehtib alati jaanuarist (avaldus 30. novembriks).</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.pensionikeskus.ee/ii-sammas/sissemaksed/makse-maara-muutmine/', 'Pensionikeskus: makse määra muutmine') + ' (kontrollitud 16.10.2026).</p>',
    },
    p3Joined: {
      title: 'Miks on oluline, millal III sambaga liitusid?',
      html: '<p>Sellest sõltub, mis vanusest saad III samba raha välja võtta soodsama maksuga.</p>' +
        '<ul><li><strong>Liitusid enne 2021:</strong> soodsam maks kehtib alates 55-aastaselt.</li><li><strong>Liitusid 2021 või hiljem:</strong> soodsam maks kehtib alates 60-aastaselt.</li></ul>' +
        '<p>Soodsam maks tähendab, et kogu raha korraga välja võttes on tulumaks 10% ja fondipensionina 0%. Enne seda vanust on tulumaks 22%. Kogumist peab olema vähemalt 5 aastat.</p>' +
        '<p class="mb-1"><strong>Kust näha, millal liitusid:</strong></p>' +
        '<ul class="mb-0"><li>Pensionikeskuse e-teenuses: vaata, millal said esimesed III samba osakud. ' + a('https://www.pensionikeskus.ee/', 'Pensionikeskus') + '</li>' +
        '<li>Oma panga või Tuleva kontol III samba ülevaates.</li><li>Kui sa ei tea, vali „2021 või hiljem“. Siis ei arvesta lugu soodustust, mida sul pole.</li></ul>',
    },
    fundCur: {
      title: 'Mida tähendab „tootlus pärast inflatsiooni“?',
      html: '<p>See näitab, kui palju sinu raha ostujõud aastas päriselt kasvab, kui fondi kasvust lahutada hindade tõus ja fonditasud.</p>' +
        '<p><strong>Näide:</strong> fond kasvab aastas 6%, hinnad tõusevad 4%. Tootlus pärast inflatsiooni on siis umbes 2%: saad aasta pärast 2% rohkem osta kui täna.</p>' +
        '<ul><li><strong>0%:</strong> raha hoiab väärtust, aga ei kasva.</li><li><strong>2%:</strong> ettevaatlik eeldus.</li><li><strong>4%:</strong> optimistlik eeldus, pikaajaline aktsiafond madala tasuga.</li></ul>' +
        '<p><strong>Kehtib mõlemale sambale korraga.</strong> II ja III samba raha kasvab selles loos sama tootlusega.</p>' +
        '<p><strong>Miks kõige rohkem 4%?</strong> 4% pärast inflatsiooni ja tasusid on madala tasuga indeksfondile juba optimistlik pikaajaline eeldus. Aktsiaturg on pikalt andnud rohkem, aga aastad on väga erinevad ja langused tulevad tihti just enne väljamakseid. Suurem number paneks sambaid üle hindama, sellepärast seda valikut pole.</p>' +
        '<p class="mb-0">Seetõttu on kõik summad selles loos <strong>tänastes eurodes</strong>: saad neid võrrelda tänaste hindadega. Tootlus on eeldus, mitte lubadus.</p>',
    },
    nominal: {
      title: 'Mida näitab „tuleviku hindades“?',
      html: '<p>Tavaliselt näitame kõiki summasid <strong>tänastes eurodes</strong>: 1 000 € 2045. aastal ostab sama palju kui 1 000 € täna. Nii on lihtne võrrelda tänaste hindadega.</p>' +
        '<p><strong>Tuleviku hindades</strong> näeb graafik, tabel ja kokkuvõte välja nii, nagu summad tulevikus päriselt kontol paistavad. Eeldame, et hinnad tõusevad 2% aastas (Euroopa Keskpanga eesmärk). Näiteks 1 500 € kulud täna on 20 aasta pärast u 2 230 €.</p>' +
        '<ul><li><strong>Tulemus ei muutu:</strong> kas raha jätkub ja mis vanuseni, on mõlemas vaates sama. Muutub ainult see, kuidas summad välja näevad.</li>' +
        '<li><strong>Milleks see on hea:</strong> näed, miks tuleviku suurem number ei tähenda tingimata rohkem raha, ja oskad hiljem pangakontol või SKA teates nähtud summat võrrelda. Sama vaate leiad ka Tuleva pensionikalkulaatorist.</li></ul>' +
        '<p class="small-muted mb-0">Hinnatõus on eeldus, mitte prognoos. Päris pensioni indekseeritakse igal aastal ja palgad tõusevad, mida mudel tänastes eurodes ei näita.</p>',
    },
  };
  // KKK 60 a ja pensioniea sammus (sama sisu mõlemas).
  root.ELUKAAR_KKK_FOND = [
    { q: 'Millal valida fondipension?',
      html: '<ul>' +
        '<li><strong>Kui ootad pikka elu.</strong> 65-aastane naine elab keskmiselt veel 21,4 aastat (u 86-aastaseks), mees 16,3 aastat (u 81-aastaseks) (Statistikaamet 2025). See on keskmine: pooled elavad kauem, iga kümnes naine 97-aastaseks ja mees 93-aastaseks. Kui sammaste raha saab otsa, jääb alles ainult riiklik pension.</li>' +
        '<li><strong>Fondipensioni lepingut saab igal aastal uuendada.</strong> Üks leping kestab elada jäänud aastad ja lõpeb. Kui sõlmid igal aastal uue lepingu järelejäänud raha peale (jälle elada jäänud aastate pikkusena), ei saa raha kunagi otsa ja makse jääb maksuvabaks, aga väga kõrges eas on kuumakse väiksem.</li>' +
        '<li><strong>Kui sul on muid sääste või investeeringuid,</strong> millest saad esimestel pensioniaastatel elada, võib samba raha jätta fondi kasvama ja fondipensioni alustada hiljem.</li>' +
        '<li><strong>Kõik korraga välja võtta on maksu mõttes kõige ebasoodsam:</strong> tulumaks on 10% (enne soodusiga 22%). Et väljavõetud raha teeniks sama palju kui fondis, peaks see 10% maksu tasa teenima, see tähendab riskantsemat investeeringut.</li>' +
        '<li><strong>Hoiusel</strong> kaotab raha tavaliselt väärtust: hoiuse intressist läheb 22% tulumaksuks ja ülejäänu jääb tavaliselt hinnatõusust maha. Selles loos eeldame, et hoius kaotab ostujõudu 1% aastas (näiteks intress 3%, pärast maksu 2,3%, hinnad tõusevad 3,3%). See on eeldus, mitte prognoos. Kahju on väiksem kui kõike ära kulutades, aga ikka miinuses.</li>' +
        '<li><strong>Kui muid sääste pole,</strong> ei pruugi riiklikust pensionist ja III sambast elu lõpuni jätkuda. Siis on fondipension kõige kindlam viis.</li></ul>' +
        '<p><strong>Tuleva soovitus:</strong> kasuta II ja III samba raha alles siis, kui seda päriselt vajad. Alates 60. eluaastast on kõige kasulikum igakuine väljamakse ehk fondipension. Kindlustuslepingu tasud on praegu nii kõrged, et Tuleva ei pea seda mõistlikuks.</p>' +
        '<p class="mb-0">' + a('https://tuleva.ee/pensioni-valjamaksed/', 'Loe Tuleva lehelt pensioni väljamaksete kohta') + '</p>' },
    { q: 'Mida teada fondipensioni kohta?',
      html: '<ul>' +
        '<li><strong>Avaldusest piisab.</strong> Raha ei pea kuhugi ümber tõstma: igal kuul müüakse automaatselt väike osa fondiosakutest, ülejäänu jääb fondi.</li>' +
        '<li><strong>Periood ja maks.</strong> Tuleva seadistab perioodiks sinu statistiliselt elada jäänud aastad (keskmisel 65-aastasel u 19 aastat). Sellise perioodiga on väljamaksed tulumaksuvabad.</li>' +
        '<li><strong>Raha teenib edasi tootlust.</strong> Näiteks kui fond kasvab keskmiselt 7% aastas, on makse perioodi lõpus üle kolme korra suurem kui alguses. Makse suurus kõigub koos osaku hinnaga: kui fond kasvab, kasvab ka makse, ja vastupidi.</li>' +
        '<li><strong>Paindlik.</strong> Igakuised väljamaksed saad igal ajal peatada ja hiljem uuesti alustada. Vajadusel saad teha lisaks osalise väljamakse (10% tulumaks), see vähendab hilisemaid kuumakseid.</li>' +
        '<li><strong>Sissemaksed.</strong> II sambast väljamakseid alustades lõpevad II samba sissemaksed igaveseks, ka riigi 4%. III sambasse võid maksta edasi ka siis, kui sealt juba raha võtad, ja saad ikka tulumaksu tagasi.</li>' +
        '<li><strong>Pärandamine.</strong> Fondis olevad II ja III samba osakud on sinu pärandvara. Pärijad saavad need oma pensionikontole või rahana (22% tulumaks); sina ei pea selleks avaldust tegema.</li></ul>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://tuleva.ee/pensioni-valjamaksed/', 'Tuleva: pensioni väljamaksed') + ' (loetud 17.10.2026).</p>' },
    { q: 'Kas fondipensioni saab alustada juba 60-aastaselt?',
      html: '<p><strong>Jah.</strong> II samba fondipensioni saab alustada kuni 5 aastat enne pensioniiga. Kui periood on vähemalt soovitusliku pikkusega (elada jäänud aastad), on väljamaksed tulumaksuvabad. III sambast saad fondipensioni alates 55-aastaselt (liitusid enne 2021) või 60-aastaselt.</p>' +
        '<ul><li>Väljamaksete algus <strong>lõpetab II samba sissemaksed</strong>, ka riigi 4%. Kui töötad edasi, kaotad need.</li>' +
        '<li>Varem alustades on periood pikem ja kuumakse väiksem.</li>' +
        '<li><strong>Kehv tervis:</strong> kui ootad lühemat elu, võib varem alustamine olla mõistlik, sest saad raha kätte, kui seda vajad. Maksuvaba periood arvutatakse aga keskmise eluea järgi, mitte sinu tervise järgi. Täieliku puuduva töövõime korral saad II sambast pensionile jääda igas vanuses ja maksuvabalt.</li></ul>' +
        '<p>Selles loos algab fondipension lihtsuse mõttes pensionieas (või hiljem, kui nii valid). 60-aastaselt alustamist arvutus praegu eraldi ei näita.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.pensionikeskus.ee/ii-sammas/valjamaksed/tahtajaline-pension/', 'Pensionikeskus: tähtajaline pension') + ', ' + a('https://www.pensionikeskus.ee/ii-sammas/valjamaksed/', 'II samba väljamaksed') + ' (kontrollitud 16.10.2026).</p>' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
