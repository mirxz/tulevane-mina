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
      html: '<p>Naised elavad Eestis keskmiselt kauem kui mehed. Sellest sõltub, mitu aastat peab sinu raha kestma.</p>' +
        '<p><strong>Elada jäänud aastad (Statistikaamet, 2025. a):</strong></p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Vanus</th><th scope="col">Mehed</th><th scope="col">Naised</th></tr></thead>' +
        '<tbody><tr><th scope="row">60</th><td>19,8 a</td><td>25,8 a</td></tr><tr><th scope="row">65</th><td>16,3 a</td><td>21,4 a</td></tr></tbody></table>' +
        '<p><strong>Muu:</strong> arvutus kasutab Statistikaameti kogu rahvastiku andmeid, mehed ja naised koos (65-aastaselt 19,3 a).</p>' +
        '<p><strong>Fondipensioni maksuvaba periood on kõigile sama</strong>, soost sõltumata: Statistikaameti kogu rahvastiku elada jäänud aastad (65-aastaselt 19,3 a). Nii arvutab ka Sotsiaalkindlustusameti kalkulaator.</p>' +
        '<p>Oodatav eluiga on aastatega pikenenud. Alates 2027. a on pensioniiga seotud 65-aastaste keskmise eluea muutusega. Mis vanuses sina pensionile lähed, näed elukaare sammudest. Arvutus kasutab Statistikaameti viimast avaldatud elutabelit (' + ((window.ELUTABEL && window.ELUTABEL.aasta) || '') + ') ega ennusta eluea pikenemist.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://andmed.stat.ee/et/stat/rahvastik__rahvastikusundmused__surmad/RV045', 'Statistikaamet RV045 ja RV046') + ', elutabel ' + ((window.ELUTABEL && window.ELUTABEL.aasta) || '') + ' (viimane avaldatud aasta).</p>',
    },
    pensionAge: {
      title: 'Kuidas pensioniiga määratakse?',
      html: '<p><strong>Elukaar arvutab sinu pensioniea ise</strong> sünniaasta järgi ja täidab välja „Pensioniiga“. Muuda seda ainult siis, kui tahad arvutada teise vanusega või kui Sotsiaalkindlustusameti kalkulaator näitab sulle muud aastat.</p>' +
        '<p><strong>Seadus (RPKS § 7, alates 2027. a):</strong> pensioniiga on 65 aastat, millele liidetakse 65-aastaste eeldatava eluea muutus. Võrreldakse viie aasta keskmist eluiga (4–8 aastat varem) baasperioodiga 2018–2022. Pensioniiga leitakse kuu täpsusega, see võib tõusta kõige rohkem 3 kuud aastas ja minister kehtestab selle kaks aastat ette.</p>' +
        '<p>Pensioniiga kehtib <strong>kalendriaasta järgi</strong>: sinu pensioniiga on see, mis kehtib aastal, mil sa sellesse vanusesse jõuad.</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Aasta</th><th scope="col">Pensioniiga</th></tr></thead><tbody>' +
        '<tr><th scope="row">2026. a</th><td>65 a</td></tr><tr><th scope="row">2027. a</th><td>65 a 1 k (kehtestatud)</td></tr>' +
        '<tr><th scope="row">2028. a</th><td>65 a 3 k (kehtestatud)</td></tr><tr><th scope="row">2029. a</th><td>65 a 4 k (eelnõu)</td></tr>' +
        '<tr><th scope="row">2030.–2032. a</th><td>u 65 a 7 k … 66 a (prognoos)</td></tr><tr><th scope="row">hiljem</th><td>u 66 a (prognoos)</td></tr></tbody></table>' +
        '<p><strong>Täpset pensioniiga pärast 2029. aastat ei tea keegi.</strong> See sõltub sellest, kui kaua inimesed tulevikus elavad. Arvutame nagu Sotsiaalkindlustusameti kalkulaator: eeldame, et eluiga jääb viimase avaldatud aasta tasemele (2025. a: 65-aastased elavad keskmiselt veel 18,9 aastat). Kui eluiga pikeneb, tõuseb ka pensioniiga: näiteks Tuleva kogumiskalkulaator eeldab 1,5 kuud iga sünniaasta kohta pärast 1962. aastat.</p>' +
        '<p><strong>Täpsem aasta SKA-st:</strong> ' + a('https://iseteenindus.sotsiaalkindlustusamet.ee/self-service/pension-calculator', 'SKA iseteenindus') + ' → Kalkulaatorid → Pensionikalkulaator → Prognoosimine → „Pensionile jäämine“: vali „Vanaduspension“ ja vaata „Pensionile jäämise aeg“. Lahuta sellest aastast oma sünniaasta, nii saad oma pensioniea. Kui see erineb Elukaare omast, vali SKA vanus väljal „Pensioniiga“.</p>' +
        '<p>SKA-s vali kindlasti „Vanaduspension“, mitte varem pensionile minek laste või tervist kahjustava töö eest. Varem minekut küsib Elukaar eraldi ja lahutab need aastad ise.</p>' +
        '<p class="small-muted mb-0">Allikad: ' + a('https://www.riigiteataja.ee/akt/RPKS', 'Riikliku pensionikindlustuse seadus § 7 ja § 7¹') + ', ' + a('https://sotsiaalkindlustusamet.ee/pension-ja-seotud-huvitised/pensioni-taotlemine/pensioniiga', 'SKA: pensioniiga') + ', ' + a('https://andmed.stat.ee/et/stat/rahvastik__rahvastikusundmused__surmad/RV045', 'Statistikaamet RV045') + ' (kontrollitud 16.10.2026).</p>',
    },

    p1: {
      title: 'Mis on riiklik pension?',
      html: '<p>Riiklik vanaduspension (I sammas) on enamikule pensionäridest peamine sissetulek. Selle suurus mõjutab toimetulekut pensionieas kõige rohkem. Siin ei ole arvestatud sinu muid sääste.</p>' +
        '<p><strong>Kust võtta summa:</strong> ' + a(SKA_SELF + 'self-service/pension-calculator', 'SKA iseteeninduse pensionikalkulaator') + ', osa <strong>„Prognoosimine“</strong>:</p>' +
        '<ol><li>Lülita sisse „Arvesta kogunenud pensioni andmeid“ ja sisesta oma brutopalk, II samba sissemakse ja III samba sissemakse.</li>' +
        '<li>Kui olid ametnik enne 2013. a, lülita sisse „Olen töötanud vähemalt 10 aastat avalikus teenistuses kuni 31.03.2018“ ja vali aastad. Laste pensionilisa võid lisada või jätta: Elukaar küsib laste juures üle, kas prognoos selle sisaldab.</li>' +
        '<li>Vali „Pensionile jäämine“ alt <strong>„Vanaduspension“</strong> (mitte laste eest varem ega paindlik pension, need arvestab Elukaar ise).</li>' +
        '<li>Ava „Prognoosi tulemus“ juures detailandmed ja võta rida <strong>„I sammas“</strong>. See on summa enne tulumaksu, tänastes eurodes.</li></ol>' +
        '<p><strong>Ära võta:</strong></p><ul>' +
        '<li>„Prognoosi tulemus“ kokku: see sisaldab ka II ja III sammast, mida Elukaar arvutab ise (läheks topelt);</li>' +
        '<li>„Praeguseks kogunenud pension“ ega „Pensionisambad“ vaate I samba summa: see on tänane seis ilma tulevaste tööaastateta.</li></ul>' +
        '<p>Pensioniea leiad samast kohast („Pensionile jäämise aeg“ miinus sünniaasta). Prognoos eeldab, et palk jääb samaks; kui palk muutub, arvuta prognoos uuesti.</p>' +
        '<p><strong>Kuidas see kujuneb:</strong></p><ul>' +
        '<li><strong>Baasosa:</strong> kõigil sama.</li>' +
        '<li><strong>Staažiosa:</strong> tööaastad kuni 1998. a. Iga aasta annab sama palju, palk ei loe.</li>' +
        '<li><strong>Kindlustusosa (1999.–2020. a):</strong> sinu eest makstud sotsiaalmaksu järgi. Kahekordne palk annab kaks korda rohkem.</li>' +
        '<li><strong>Ühendosa (alates 2021. a):</strong> pool palga järgi, pool kõigile võrdselt. Kahekordne palk annab umbes 1,5 korda rohkem.</li></ul>' +
        '<p><strong>Tundub palga kohta väike?</strong> Alates 2021. a sõltub riiklik pension palgast vähem (ühendosa). II sambaga liitunul on riiklik pension väiksem, sest 4% palgast läheb II sambasse. Seetõttu võib vanem inimene, kellel on palju tööaastaid enne 1999. a, saada suuremat riiklikku pensioni kui noorem ja suurema palgaga inimene. Noorema riikliku pensioni kõrvale tuleb II samba raha.</p>' +
        '<p>Pensioni indekseeritakse igal aastal 1. aprillist. Arvutus on tänastes eurodes, seega kasv pärast hinnatõusu jääb välja.</p>',
    },
    special: {
      title: 'Millised tööga seotud erijuhud pensioni mõjutavad?',
      html: '<p>Märgi need, mis sind puudutavad. Iga linnuke avab oma küsimused, teised jäävad peitu.</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Erijuht</th><th scope="col">Mida annab</th><th scope="col">Koos teistega</th></tr></thead><tbody>' +
        '<tr><th scope="row">Tervist kahjustav töö</th><td>varem pensionile vähendamata (nimekiri nr 1: 10 a, nr 2: 5 a), nimekiri nr 1 lisa</td><td>varem mineku aastad lastega ei liitu: kehtib suurem</td></tr>' +
        '<tr><th scope="row">Eripension, ametipension või väljateenitud aastate pension</th><td>eraldi pension enne pensioniiga</td><td>pensionieas valid ühe: eripension või vanaduspension (tavaliselt suurema)</td></tr>' +
        '<tr><th scope="row">Päästeteenistus</th><td>pensioni ootel kuni 5 a varem (staaž ≥ 15 a), vanaduspension +10 … +50% (kuni 2043. a)</td><td>liitub lastega; kui on ka eripension, valid pensionieas ühe</td></tr>' +
        '<tr><th scope="row">Ametnik enne 2013. a</th><td>vanaduspension +10 … +50% teenistusstaaži järgi (üleminekusäte); lisa see Sotsiaalkindlustusameti prognoosi</td><td>päästeteenistuse suurendusega ei liitu</td></tr>' +
        '<tr><th scope="row">Muu (represseeritu jt)</th><td>Elukaar ei arvuta</td><td>küsi Sotsiaalkindlustusametist</td></tr></tbody></table>' +
        '<p><strong>Korraga makstakse ainult ühte riiklikku pensioni.</strong> Kui sul on õigus mitmele, pead valima, kumba kasutad. Valik võib vanusega muutuda.</p>' +
        '<p><strong>Pead valima ühe:</strong></p><ul>' +
        '<li><strong>Eripension ja vanaduspension:</strong> enne pensioniiga saad eripensioni. Pensionieas valid, kumba saad: tavaliselt valitakse suurem. Elukaar valib vaikimisi suurema, aga saad ise valida.</li>' +
        '<li><strong>Eripension ja tervist kahjustava töö eest varem vanaduspension:</strong> kui mõlemad on võimalikud samas vanuses, valid ühe. Põlevkivi kaevandamine ja töötlemine võib anda õiguse kummalegi.</li>' +
        '<li><strong>Päästeteenistuse suurendusega vanaduspension ja eripension:</strong> pensionieas valid ühe, tavaliselt suurema.</li></ul>' +
        '<p><strong>Kehtivad koos:</strong></p><ul>' +
        '<li>Laste soodustused (varem pensionile, pensionilisa) liituvad kõigiga. Laste ja tervist kahjustava töö eest varem mineku aastad aga ei liitu: kehtib see, mis annab rohkem aastaid.</li>' +
        '<li>Nimekirja nr 1 lisa ja päästeteenistuse suurendus lisanduvad vanaduspensionile, mitte eripensionile.</li>' +
        '<li>II ja III sammas liituvad alati: neid saad iga riikliku pensioni kõrvale.</li></ul>' +
        '<p class="mb-0">Kui sul on mitu erijuhtu korraga, kontrolli oma õigusi Sotsiaalkindlustusametist.</p>',
    },
    rescue: {
      title: 'Mida annab päästeteenistus pensionile?',
      html: '<p>Päästeteenistuse seadus annab kaks soodustust:</p>' +
        '<p><strong>1. Varem töölt ära:</strong> kui päästeteenistuse staaž on vähemalt 15 aastat, võid lõpetada töö kuni 5 aastat enne pensioniiga. Kuni pensionieani maksab päästeasutus sulle toetust, mis on sama suur kui sinu vanaduspension koos suurendusega. Seaduses on selle nimi <strong>„vanaduspensioni ootel oleva päästeteenistuja toetus“</strong>. Toetust ei maksta, kui töötad edasi päästjana. Pensionieas maksab vanaduspensioni edasi Sotsiaalkindlustusamet. Elukaar eeldab ettevaatlikult, et toetuselt sotsiaalmaksu ei maksta, seega ilma palgatööta II sambasse sissemakseid ei tule.</p>' +
        '<p><strong>2. Vanaduspensioni suurendus</strong> päästeteenistuse staaži järgi:</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Staaž</th><th scope="col">Suurendus</th></tr></thead><tbody>' +
        '<tr><th scope="row">10–15 a</th><td>+10%</td></tr><tr><th scope="row">16–20 a</th><td>+20%</td></tr><tr><th scope="row">21–25 a</th><td>+25%</td></tr>' +
        '<tr><th scope="row">26–30 a</th><td>+40%</td></tr><tr><th scope="row">üle 30 a</th><td>+50%</td></tr></tbody></table>' +
        '<p>Suurendatud pensioni makstakse pärast päästeteenistusest lahkumist. <strong>Suurenduse säte kehtib 28.02.2043. a-ni</strong>: kes läheb pensionile hiljem, seda seaduse praeguse teksti järgi ei saa.</p>' +
        '<p>Kui saad ka eripensioni (väljateenitud aastate pensioni), valid pensionieas, kumba saad: tavaliselt suurema. Staaži tõendab Päästeamet.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.riigiteataja.ee/akt/106072023069?leiaKehtiv', 'päästeteenistuse seadus § 18 ja § 19') + ' (kehtiv sõnastus 01.10.2026, kontrollitud 17.10.2026).</p>',
    },
    rescueBasis: {
      title: 'Ootetoetus või laste eest pension?',
      html: '<p>Kui sul on õigus nii päästja ootetoetusele kui ka laste eest varem pensionile, saad korraga ühte: ootetoetust ei maksta, kui saad juba riiklikku pensioni.</p>' +
        '<p><strong>Ootetoetus ei ole pension.</strong> Seda maksab päästeasutus vanaduspensioni suuruses (koos päästja suurendusega). Laste pensionilisa on vanaduspensioni osa, mida maksab Sotsiaalkindlustusamet. Seepärast arvestab Elukaar ettevaatlikult: ootetoetusele laste lisa ei lisandu, see algab koos vanaduspensioniga.</p>' +
        '<p><strong>II sammas ootetoetuse ajal:</strong> Elukaar eeldab samuti ettevaatlikult, et ootetoetuselt sotsiaalmaksu ei maksta. Kui sa ei tööta, II sambasse sissemakseid (sinu 2–6% ja riigi 4%) ei tule. Raha kasvab fondis edasi.</p>' +
        '<ul><li><strong>Kasvatad lapsi üksi:</strong> laste õigused (varem minek ja pensionilisa) jäävad sulle. Laste eest pension annab kohe ka pensionilisa.</li>' +
        '<li><strong>Partneriga:</strong> otsustate koos. Sina võid võtta ootetoetuse ja teine vanem kasutab laste eest varem pensionile mineku õigust. Selle valid laste juures: „Varem pensionile mineku õigust kasutab“.</li>' +
        '<li><strong>Mõlemad järjest:</strong> kui lapsed annavad näiteks 3 a varem, saad 2 a ootetoetust ja siis 3 a enne pensioniiga laste eest vanaduspensioni koos laste lisaga.</li></ul>' +
        '<p class="mb-0">Võrdle tulemust: Elukaar arvutab valitud variandi ja näitab, millal toetus lõpeb ja pension algab.</p>',
    },
    civil: {
      title: 'Kes saab ametniku teenistusstaaži eest pensioni suurendust?',
      html: '<p>Avaliku teenistuse seaduse § 113 on <strong>üleminekusäte</strong>. Vanaduspensioni suurendust saavad:</p><ul>' +
        '<li>need, kellele seda maksti juba enne 1. aprilli 2013. a;</li>' +
        '<li>need, kellel oli 1. aprilliks 2013. a vajalik teenistusstaaž vana avaliku teenistuse seaduse järgi;</li>' +
        '<li>need, kes jätkasid soodustingimustel teenistust: nende staaži arvestati veel 5 aastat, kuni 2018. a.</li></ul>' +
        '<p>Hiljem ametnikuks saanud seda suurendust ei saa.</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Teenistusstaaž</th><th scope="col">Suurendus</th></tr></thead><tbody>' +
        '<tr><th scope="row">10–15 a</th><td>+10%</td></tr><tr><th scope="row">16–20 a</th><td>+20%</td></tr><tr><th scope="row">21–25 a</th><td>+25%</td></tr>' +
        '<tr><th scope="row">26–30 a</th><td>+40%</td></tr><tr><th scope="row">üle 30 a</th><td>+50%</td></tr></tbody></table>' +
        '<p>Päästeteenistujale seda ei kohaldata: päästjal on oma suurendus (päästeteenistuse seadus). Kas sul on õigus, ütleb Sotsiaalkindlustusamet.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.riigiteataja.ee/akt/ATS?leiaKehtiv', 'avaliku teenistuse seadus § 113') + ' (kehtiv sõnastus 01.10.2026, kontrollitud 17.10.2026).</p>',
    },
    kids: {
      title: 'Kuidas lapsed pensioni mõjutavad?',
      html: '<p>Lapse kasvatamine (vähemalt 8 aastat) annab kaks eraldi õigust. Üks vanem võib kasutada <strong>mõlemat õigust kõigi laste eest</strong>, aga õigused võib ka vanemate vahel jagada. Vanemad lepivad kirjalikult kokku, kokkuleppe puudumisel jagatakse õigus võrdselt.</p>' +
        '<ul><li>Teise vanema nõusolekut pole vaja, kui ta on surnud, temalt on enne lapse 8-aastaseks saamist vanemaõigused ära võetud või tema elukohta ei saa rahvastikuregistri järgi kindlaks teha.</li>' +
        '<li>Kokkulepe ja avaldus esitatakse Sotsiaalkindlustusametile e-postiga või ' + a(SKA_SELF, 'iseteeninduses') + '.</li>' +
        '<li>Tasub mõelda, kellele õigus rohkem annab: näiteks eripensionärile pensionilisa ei lisata, siis võiks seda kasutada teine vanem.</li></ul>' +
        '<p><strong>1. Varem pensionile ilma vähenduskordajata:</strong></p><ul><li>3 last: 1 a varem</li><li>4 last: 3 a varem</li><li>5 või enam last või puudega laps: 5 a varem</li></ul><p>Riiklikku pensioni ei vähendata nagu paindliku pensioniga varem minnes (kuni −30,7%). Kuumakse tuleb siiski veidi väiksem, sest tööaastaid jääb vähemaks, aga kokku saad riiklikku pensioni tavaliselt rohkem, sest seda makstakse kauem. Kui alustad varem ka II samba väljamakseid, on ka see kuumakse väiksem: sissemakseid on vähem ja raha jagatakse pikema aja peale.</p><p><strong>Kokku saad riiklikku pensioni tavaliselt rohkem</strong>, sest seda makstakse 1–5 aastat kauem. Näiteks 3 last, 1 a varem: kuumakse u 12 € väiksem (19 aasta peale u 2 700 €), aga lisa-aasta pension on u 10 000 €.</p>' +
        '<p><strong>Võid edasi töötada.</strong> Kuni sa II sambast raha välja ei võta, laekuvad sinna riikliku pensioni kõrvalt edasi sinu ja riigi sissemaksed. Kui esitad II samba väljamakse avalduse (ka fondipensioni), lõpevad sissemaksed mõne kuu pärast: 31. augustil, 31. detsembril või 30. aprillil, olenevalt avalduse ajast. Elukaares vasta pensionile mineku sammus (teekonnal sinu pensionile mineku vanus, nt „63 a“) küsimusele „Kas töötad pensioni ajal edasi?“: „Töötan edasi“. Siis algavad II samba väljamaksed töö lõppedes.</p>' +
        '<p class="small-muted">Allikas: ' + a('https://www.pensionikeskus.ee/ii-sammas/valjamaksed/', 'Pensionikeskus: II samba väljamaksed') + ' (kontrollitud 16.10.2026).</p>' +
        '<p><strong>2. Pensionilisa:</strong></p><ul>' +
        '<li>1981.–2012. a sündinud laps: 3,5 aastahinnet (1,5 + 2)</li>' +
        '<li>enne 1981. a sündinud laps: 1,5 aastahinnet + 2 aastat staaži (staažiaasta on sama väärt kui aastahinne), kokku samuti 3,5</li>' +
        '<li>2013. a või hiljem sündinud laps: riik maksab ühe vanema II sambasse 4% Eesti keskmisest kuutulust (2026. a: 76,12 €, 2027. a: 80,76 € kuus) kuni lapse 3-aastaseks saamiseni. Kui lisamakseid tehti alla 36 kuu (nt liitusid II sambaga hiljem), saad ülejäänud kuude eest osa pensionilisast: näiteks 12 kuud lisamakseid annab 2/3 lisast (RPKS § 24 lg 6). Üle 3-aastase lapse real on väli „Riigi lisamakse II sambasse (kuud)“: see on eeltäidetud (II sambas 36, muidu 0). Muuda, kui lapse esimesel 3 aastal muutus sinu II samba olek, näiteks liitusid hiljem, lahkusid või peatasid maksed.</li>' +
        '<li>ilma II sambata 3,5 aastahinnet:<ul><li>2013. a – aug 2021. a sündinud lapse eest, kui oled ise sündinud enne 1983. a;</li><li>sept 2021. a või hiljem sündinud lapse eest, kui sa ei olnud lapse esimesel kolmel aastal II sambas.</li></ul></li></ul>' +
        '<p>Aastahinne on alates 1.04.2026 10,48 € kuus. Näiteks kaks 1991.–2012. a sündinud last annavad u 73 € kuus.</p>' +
        '<p>Eripensionile lisa ei lisata. Kui eripensionär läheb pensionieas üle vanaduspensionile, lisandub lisa sellele.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/pension-amount/raising-children-impacts-pensions', 'SKA: laste kasvatamine ja pension') + ', ' + a('https://www.riigiteataja.ee/akt/RPKS?leiaKehtiv', 'RPKS § 24 lg 1¹ ja § 28') + ', ' + a('https://www.riigiteataja.ee/akt/KoPS', 'KoPS § 10') + ' (kontrollitud 16.10.2026).</p>',
    },
    kidsWho: {
      title: 'Keda loetakse lapse kasvatajaks?',
      html: '<p>Õigus laste eest varem pensionile minna ja saada pensionilisa tekib, kui oled last kasvatanud <strong>vähemalt 8 aastat</strong>. Kasvataja võib olla:</p>' +
        '<ul><li>lapse vanem (ka lapsendaja);</li><li>vanema abikaasa või registreeritud elukaaslane (nt kasuema või kasuisa);</li><li>eestkostja või hooldaja.</li></ul>' +
        '<p>Kui last on kasvatanud mitu inimest, lepivad nad kirjalikult kokku, kes millist õigust kasutab. Üks inimene võib kasutada mõlemat õigust.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/types-pensions/old-age-pension-under-favourable-conditions', 'SKA: soodustingimustel vanaduspension') + ', ' + a(SKA + '/en/pension-and-benefits/pension-amount/raising-children-impacts-pensions', 'laste kasvatamine ja pension') + ' (kontrollitud 16.10.2026).</p>',
    },
    hazard: {
      title: 'Mis on tervist kahjustav töö?',
      html: '<p>Kui oled töötanud riigi kinnitatud nimekirja järgi eriti raskel või tervist kahjustaval tööl, saad <strong>soodustingimustel vanaduspensioni</strong>. See on tavaline vanaduspension, mitte eripension. See annab kaks soodustust:</p>' +
        '<p><strong>1. Varem pensionile ilma vähenduskordajata:</strong> nimekiri nr 1 kuni 10 a, nimekiri nr 2 kuni 5 a varem. Võid minna ka vähem aastaid varem: vali see väljal „Mitu aastat varem plaanid pensionile minna?“.</p>' +
        '<p><strong>2. Pensionilisa (ainult nimekiri nr 1):</strong> iga nimekirja nr 1 tööaasta lisab pensionile 3,1% aastahindest (u 0,32 € kuus), allmaatöö aasta lisaks 21,9% (u 2,29 € kuus). Selleks küsime, mitu aastat sa nimekirja tööl töötasid. Nimekirja nr 2 töö annab tööaastad nagu iga teine töö, aga lisa selle eest pole.</p>' +
        '<p><strong>Tingimused:</strong></p>' +
        '<table class="table table-sm"><thead><tr><th scope="col"></th><th scope="col">Nimekiri nr 1</th><th scope="col">Nimekiri nr 2</th></tr></thead><tbody>' +
        '<tr><th scope="row">Töö</th><td>eriti raske ja eriti kahjulik</td><td>raske ja kahjulik</td></tr>' +
        '<tr><th scope="row">Varem pensionile</th><td>10 a</td><td>5 a</td></tr>' +
        '<tr><th scope="row">Staaž kokku</th><td>vähemalt 20 a</td><td>vähemalt 25 a</td></tr>' +
        '<tr><th scope="row">Sellest nimekirja tööl</th><td>vähemalt 10 a</td><td>vähemalt 12,5 a</td></tr></tbody></table>' +
        '<p>Töö pidi olema täiskohaga. Soodustingimustel pensioni saad siis, kui sa sellel tööl enam ei tööta. Muul tööl võid edasi töötada. Nimekirja tööd arvestatakse staaži hulka kuni 31.12.2030 (põlevkivi kaevandamine ja töötlemine kuni 31.12.2049).</p>' +
        '<p><strong>Kust nimekirju näha:</strong> Vabariigi Valitsuse 16.07.1992 määrus nr 206 „Soodustingimustel vanaduspensionile õigust andvate tootmisalade, tööde, kutsealade ja ametikohtade loetelude kinnitamine“ (' + a('https://www.riigiteataja.ee/akt/24317', 'Riigi Teataja') + ', kehtib kuni 31.12.2030). Nimekirjad on tootmisalade kaupa, näiteks kaevandamine, keemiatööstus, metallitöötlus ja kiirgusega töö. Nimekirja rakendatakse rangelt: kui sinu ametit seal pole, õigust ei teki. Kas sinu töö loeb, ütleb Sotsiaalkindlustusamet.</p>' +
        '<p>Elukaar tingimusi ei kontrolli: eeldame, et tead oma staaži. Kas sul on õigus, ütleb Sotsiaalkindlustusamet.</p>' +
        '<p>Kui sul on ka lastega soodustus: kui on mõlemad, kehtib see, mis annab rohkem aastaid varem; aastad ei liitu.</p>' +
        '<p><strong>Põlevkivi kaevandamine ja töötlemine</strong> võib anda õiguse kas siia (varem vanaduspensionile) või väljateenitud aastate pensionile (vt „Eripension“). Need on kaks eri seadust ja korraga makstakse ühte: valid ise, Sotsiaalkindlustusamet ütleb, kumb on suurem.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a(SKA + '/en/pension-and-benefits/types-pensions/old-age-pension-under-favourable-conditions', 'SKA: soodustingimustel vanaduspension') + ', ' + a('https://www.riigiteataja.ee/akt/SVPS', 'Soodustingimustel vanaduspensionide seadus (SVPS) § 1') + ', ' + a('https://www.riigiteataja.ee/akt/24317', 'nimekirjad nr 1 ja 2 (VV määrus nr 206)') + ' (kontrollitud 16.10.2026).</p>',
    },
    sp: {
      title: 'Mis on eripension?',
      html: '<p>Eripension on teatud ametite pension, mida makstakse eraldi seaduse alusel, sageli juba enne pensioniiga. See on riiklik pension (I sammas).</p>' +
        '<ul><li><strong>Ametipension:</strong> kaitseväelane (alates 50 a, 20 a teenistust), politseiametnik, prokurör, kohtunik, Riigikogu liige, õiguskantsler, riigikontrolör.</li>' +
        '<li><strong>Väljateenitud aastate pension:</strong> nt piloot, meremees, balletiartist, päästja, vanglaametnik.</li></ul>' +
        '<p><strong>Uutele töötajatele ametipensioni enam ei teki.</strong> Õigus on neil, kes olid ametis tähtpäeval: kohtunik 1.7.2013, kaitsevägi, politsei ja prokuratuur 31.12.2019, päästja ja vanglaametnik 30.6.2022.</p>' +
        '<p><strong>Väljateenitud aastate pensioni</strong> staaži arvestatakse ametites, kus nõutav staaž on 10 või 12,5 aastat, kuni 31.12.2030 ja ametites, kus see on 15–25 aastat, kuni 31.12.2036. Põlevkivi kaevandamisel, töötlemisel ja rikastamisel kuni 31.12.2049.</p>' +
        '<p><strong>Erinevus tervist kahjustavast tööst:</strong> väljateenitud aastate pension on eraldi pension, mida makstakse ametis töövõime vähenemise tõttu enne pensioniiga. Tervist kahjustav töö (soodustingimustel pension) on tavaline vanaduspension varem. Mõlemal on põlevkivi erand kuni 2049. a, aga korraga makstakse ühte: valid ise.</p>' +
        '<p><strong>Kui suur see on:</strong> kaitseväel ja politseil 50% ametipalgast 20 teenistusaasta eest ja iga lisaaasta +2,5%, kokku kuni 75%. Määratud eripensioni näed ' + a(SKA_SELF, 'SKA iseteeninduses') + '; tulevase summa arvuta ise selle reegli järgi.</p>' +
        '<p><strong>Kahte riiklikku pensioni korraga ei maksta.</strong> Kui jõuad pensioniikka (või lastega soodustuse vanusesse), saad valida suurema: eripension või vanaduspension. Eripensioni ei saa edasi lükata, varem võtta ega peatada.</p>' +
        '<p class="small-muted mb-0">Allikad: ' + a(SKA + '/pension-ja-seotud-huvitised/pensioni-liigid/eripensionid', 'SKA eripensionid') + ' (väljateenitud aastate pension ja tähtajad kontrollitud 16.10.2026); ametipensionide tähtpäevad: ametite seadused [secondary, tiimi kokkuvõte 14.10.2026].</p>',
    },
    spStart: {
      title: 'Miks on eripensioni algus oluline?',
      html: '<p>Eripension võib alata palju varem kui pensioniiga, näiteks kaitseväelasel 50-aastaselt. Sellest vanusest saad lisasissetulekut.</p>' +
        '<p><strong>Kehtivad vana süsteemi reeglid.</strong> Paljud eripensionid on üleminekusätted: neid saavad need, kes asusid ametisse või täitsid tingimused enne seaduse muudatust. Hiljem alustanutele kehtivad tavalised pensionireeglid. Kas sul on õigus, mis vanusest ja millise valemiga, ütleb sinu asutus või Sotsiaalkindlustusamet. Elukaar eeldab, et tead oma eripensioni summat ja algusvanust.</p>' +
        '<ul><li><strong>Töö muul erialal ei ole takistus:</strong> saad palka ja eripensioni korraga. II sambasse laekub palgalt edasi.</li>' +
        '<li><strong>Samas ametis</strong> (või sellega võrdsustatud ametis) töötamise ajal eripensioni ei maksta (nt politseinik, kaitseväelane, päästja, vanglaametnik, kohtunik, prokurör). Pane alguseks vanus, mil ametist lahkud. Näiteks kaitseväe eripensioni ei maksta politseis töötamise ajal ja politsei eripensioni ei maksta kaitseväe tegevteenistuse ajal.</li>' +
        '<li>Kui saad eripensioni juba, pane vanus, millest see algas. Varasemad sissemaksed on sinu II ja III samba tänases summas juba sees.</li></ul>' +
        '<p class="mb-0">Algusvanuse järgi tekib teekonnale eripensioni samm.</p>',
    },
    pillars: {
      title: 'Miks küsime sammaste ja töö kohta?',
      html: '<p>Nende andmete järgi arvutame, kui palju sul pensionieas sammastes raha on ja kui kaua see kestab.</p>' +
        '<ul><li><strong>II sammas</strong> on kohustuslik kogumispension: osa sinu palgast ja riigi sotsiaalmaksust läheb pensionifondi. Raha saad kasutada alates 5 aastat enne pensioniiga. Varem välja võtta saab ainult ühe korra 22% tulumaksuga (vt „II samba sissemakse“ selgitus).</li>' +
        '<li><strong>III sammas</strong> on vabatahtlik: maksad ise ja saad tulumaksu tagasi (kuni 15% brutotulust, kuni 6000 € aastas).</li>' +
        '<li><strong>Brutopalk</strong> määrab II samba sissemakse ja selle, kui palju töötamine pensionieas pensioni tõstab.</li></ul>' +
        '<p class="mb-0">Loe lähemalt: ' + a('https://tuleva.ee/', 'Tuleva') + ', ' + a('https://www.pensionikeskus.ee/', 'Pensionikeskus') + ', ' + a(SKA + '/et', 'SKA') + '.</p>',
    },
    soodusYears: {
      title: 'Mis juhtub, kui lähed varem pensionile?',
      html: '<p>Varem pensionile saab minna kahel moel:</p>' +
        '<p><strong>1. Soodustusega, vähendamata.</strong> Laste (3+ last või puudega laps) või tervist kahjustava töö eest saad minna varem ja riiklikku pensioni <strong>ei vähendata</strong>. Kuumakse on siiski veidi väiksem, sest tööaastaid jääb vähemaks: palga 4 000 € korral u 12 € kuus iga aasta eest. Kokku saad aga tavaliselt rohkem, sest pensioni makstakse kauem (vt allpool). Sotsiaalkindlustusameti kalkulaatoris: 3 last (1 a varem) 853 €, 4 last (3 a) 829 €, 5 last (5 a) 805 € tavalise 865 € asemel.</p>' +
        '<p><strong>2. Paindlik pension varem, vähendusega.</strong> Kui soodustust pole või lähed varem, kui soodustus lubab, saad minna kuni 5 aastat varem, aga riiklikku pensioni <strong>vähendatakse eluks ajaks</strong>:</p>' +
        '<table class="table table-sm"><thead><tr><th scope="col">Varem</th><th scope="col">Vähendus</th></tr></thead><tbody>' +
        '<tr><th scope="row">1 a</th><td>−7,17%</td></tr><tr><th scope="row">2 a</th><td>−13,78%</td></tr><tr><th scope="row">3 a</th><td>−19,88%</td></tr>' +
        '<tr><th scope="row">4 a</th><td>−25,5%</td></tr><tr><th scope="row">5 a</th><td>−30,67%</td></tr></tbody></table>' +
        '<p>Vähendus arvutatakse pensionilt, millest on maha võetud puuduvad tööaastad. Näiteks 3 a varem: (865 € − 3 × 12,2 €) × (1 − 19,88%) = 664 €, nagu Sotsiaalkindlustusameti kalkulaatoris. Kui lähed varem, kui soodustus lubab, kehtib vähendus kõigi varasemate aastate kohta.</p>' +
        '<p><strong>Soodustusega varem minnes saad riiklikku pensioni kokku tavaliselt rohkem:</strong> aasta varem minnes saad 12 kuu pensioni juurde (nt 12 × 853 € ≈ 10 200 €), väiksema kuumakse tõttu jääb 20 aasta jooksul saamata u 2 900 €. Paindliku pensioni vähendus jääb aga eluks ajaks, nii et pika eluga saad kokku vähem.</p>' +
        '<p>Õigus ei kohusta: võid minna ka hiljem, kuni tavalise pensionieani.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.riigiteataja.ee/akt/RPKS', 'RPKS § 10') + ', ' + a('https://www.riigiteataja.ee/akt/SVPS', 'SVPS § 1') + ', Sotsiaalkindlustusameti pensionikalkulaator, paindlik pension (kontrollitud 16.10.2026).</p>',
    },
    household: {
      title: 'Mis muutub, kui elad pensionil üksi?',
      html: '<p>Üksi elades on kulud inimese kohta suuremad: kodu ja arved maksad ainult sina. Paaris elades on summad sinu osa paari kuludest.</p>' +
        '<p><strong>Üksi elava pensionäri toetus:</strong> 200 € üks kord aastas, koos oktoobri pensioniga. Seda saab vanaduspensionieas inimene, kes elab rahvastikuregistri järgi üksi ja kelle kätte saadav pension on alla 992 € kuus (2026. a). Taotlema ei pea, SKA maksab ise. Hooldekodus elavale inimesele toetust ei maksta. Arvutus seda toetust ei lisa (u 17 € kuus).</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://sotsiaalkindlustusamet.ee/pension-ja-seotud-huvitised/muud-pensioniga-seotud-huvitised-ja-toetused/uksi-elava-pensionari', 'SKA: üksi elava pensionäri toetus') + ' (kontrollitud 16.10.2026).</p>',
    },
    gross: {
      title: 'Kuidas palk arvutuses muutub?',
      html: '<p>Eeldame, et <strong>palk tõuseb 3% aastas</strong> ja hinnad 2% aastas (Euroopa Keskpanga eesmärk). Tänases rahas kasvab palk seega umbes 1% aastas. II samba sissemaksed (sinu 2, 4 või 6% ja riigi 4%) on protsent palgast, seega kasvavad need tänases rahas samuti umbes 1% aastas.</p>' +
        '<p>Kõik summad on tänastes eurodes. Riikliku pensioni prognoos tuleb SKA-st ja eeldab, et sinu palk keskmise palga suhtes jääb samaks.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://github.com/TulevaEE/onboarding-client', 'Tuleva kalkulaator (onboarding-client)') + ', ' + a('https://www.ecb.europa.eu/mopo/strategy/html/index.et.html', 'Euroopa Keskpank: inflatsioonieesmärk 2%') + '.</p>',
    },
    p3Monthly: {
      title: 'Kuidas III samba sissemakse arvutuses muutub?',
      html: '<p>Eeldame, et maksad III sambasse <strong>igal aastal sama summa eurodes</strong>. Tulumaksusoodustuse piir on 15% brutotulust, kuid mitte üle 6 000 € aastas, ja see piir ei tõuse koos hindadega. III samba makse ei ole protsent palgast, seega see ei kasva koos palgaga nagu II samba sissemakse (u 1% aastas). Kuna hinnad tõusevad 2% aastas, on sama summa tänases rahas igal aastal u 2% väiksem. See puudutab ainult uut sissemakset: sambas olev raha kasvab valitud tootluse võrra (vaikimisi 2% aastas pärast inflatsiooni).</p>' +
        '<p>Kui tõstad makset koos hindadega, kasvab vara rohkem. Maksusoodustuse piir (6 000 € aastas) on seaduses kindel summa. Võimalik, et seda tulevikus hindade tõustes muudetakse, aga seda ei saa ette teada, seega arvutus kasutab praegust piiri.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.emta.ee/', 'EMTA: III samba maksusoodustus') + ', ' + a('https://github.com/TulevaEE/onboarding-client', 'Tuleva kalkulaator') + '.</p>',
    },
    p2Rate: {
      title: 'Mida tähendab II samba sissemakse?',
      html: '<ul><li><strong>2%</strong> brutopalgast on vaikimisi.</li><li><strong>4% või 6%</strong>: alates 2025. a saad sissemakset vabatahtlikult tõsta. See ei vähenda sinu riikliku pensioni õigusi.</li>' +
        '<li><strong>Riik</strong> lisab II sambasse lisaks 4% sinu brutopalgast (sotsiaalmaksu arvelt), sõltumata sellest, kas maksad ise 2%, 4% või 6%.</li><li><strong>Puudub:</strong> sa ei ole II sambaga liitunud või lahkusid sellest.</li></ul>' +
        '<p>Sissemakse määra (2%, 4% või 6%) saab muuta üks kord aastas. Uus määr kehtib jaanuarist, kui esitad avalduse 30. novembriks.</p>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.pensionikeskus.ee/ii-sammas/sissemaksed/makse-maara-muutmine/', 'Pensionikeskus: makse määra muutmine') + ' (kontrollitud 16.10.2026).</p>' +
        '<p class="mt-3"><strong>Kas II samba raha saab enne pensioniiga välja võtta?</strong></p><ul>' +
        '<li><strong>Alates 5 aastat enne pensioniiga</strong> saad raha kasutada pensionina: fondipension elada jäänud aastate peale on tulumaksuvaba, korraga välja võttes on tulumaks 10%.</li>' +
        '<li><strong>Varem</strong> saad raha välja võtta 22% tulumaksuga. Alates 01.11.2026 saab seda teha <strong>ainult ühe korra</strong>. Siis lõpevad sinu ja riigi sissemaksed ning uuesti saad alustada 5 aasta pärast (varem 10 aastat).</li>' +
        '<li><strong>Alates 2028. a</strong> saab välja võtta ka osa rahast. Kes lõpetas ainult maksed (raha välja võtmata), võib siis kohe uuesti alustada.</li>' +
        '<li>Välja võetud raha ei kasva pensioniks edasi ja riigi 4% jääb saamata, seega pensioniks jääb vähem.</li></ul>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.riigiteataja.ee/akt/KoPS', 'Kogumispensionide seadus § 27¹, § 27², § 43¹') + ' (redaktsioonid 01.11.2026 ja 01.01.2028, kontrollitud 16.10.2026).</p>',
    },
    p3Joined: {
      title: 'Miks on oluline, millal III sambaga liitusid?',
      html: '<p>Sellest sõltub, mis vanusest saad kogu III samba raha välja võtta väiksema tulumaksuga (10%, muidu 22%).</p>' +
        '<ul><li><strong>Liitusid enne 2021. a:</strong> soodsam maks kehtib alates 55-aastaselt.</li><li><strong>Liitusid 2021. a või hiljem:</strong> soodsam maks kehtib alates 60-aastaselt.</li></ul>' +
        '<p>Soodsam maks tähendab, et kogu raha korraga välja võttes on tulumaks 10% ja fondipensionina 0%. Enne seda vanust on tulumaks 22%. Kogumist peab olema vähemalt 5 aastat.</p>' +
        '<p class="mb-1"><strong>Kust näha, millal liitusid:</strong></p>' +
        '<ul class="mb-0"><li>Pensionikeskuse e-teenuses: vaata, millal said esimesed III samba osakud. ' + a('https://www.pensionikeskus.ee/', 'Pensionikeskus') + '</li>' +
        '<li>Oma panga või Tuleva kontol III samba ülevaates.</li><li>Kui sa ei tea, vali „2021. a või hiljem“. Siis ei arvesta lugu soodustust, mida sul pole.</li></ul>',
    },
    fundCur: {
      title: 'Mida tähendab „tootlus pärast inflatsiooni“?',
      html: '<p>See näitab, kui palju sinu raha ostujõud aastas päriselt kasvab, kui fondi kasvust lahutada hindade tõus ja fonditasud.</p>' +
        '<p><strong>Näide:</strong> fond kasvab aastas 6%, hinnad tõusevad 4%. Tootlus pärast inflatsiooni on siis umbes 2%: saad aasta pärast 2% rohkem osta kui täna.</p>' +
        '<ul><li><strong>0%:</strong> raha hoiab väärtust, aga ei kasva.</li><li><strong>2%:</strong> ettevaatlik eeldus.</li><li><strong>4%:</strong> optimistlik eeldus, pikaajaline aktsiafond madala tasuga.</li></ul>' +
        '<p><strong>Kehtib mõlemale sambale korraga.</strong> II ja III samba raha kasvab Elukaares sama tootlusega.</p>' +
        '<p><strong>Miks kõige rohkem 4%?</strong> 4% pärast inflatsiooni ja tasusid on madala tasuga indeksfondile juba optimistlik pikaajaline eeldus. Aktsiaturg on pikalt andnud rohkem, aga aastad on väga erinevad ja langused tulevad tihti just enne väljamakseid. Suurem number paneks sambaid üle hindama, sellepärast seda valikut pole.</p>' +
        '<p class="mb-0">Seetõttu on kõik summad Elukaares <strong>tänastes eurodes</strong>: saad neid võrrelda tänaste hindadega. Tootlus on eeldus, mitte lubadus.</p>',
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
        '<li><strong>Kui ootad pikka elu.</strong> 65-aastane naine elab keskmiselt veel 21,4 aastat (u 86-aastaseks), mees 16,3 aastat (u 81-aastaseks) (Statistikaamet 2025. a). See on keskmine: pooled elavad kauem, iga kümnes naine 97-aastaseks ja mees 93-aastaseks. Kui sammaste raha saab otsa, jääb alles ainult riiklik pension.</li>' +
        '<li><strong>Fondipensioni lepingut saab igal aastal uuendada.</strong> Üks leping kestab elada jäänud aastad ja lõpeb. Kui sõlmid igal aastal uue lepingu järelejäänud raha peale (jälle elada jäänud aastate pikkusena), ei saa raha kunagi otsa ja makse jääb maksuvabaks, aga väga kõrges eas on kuumakse väiksem.</li>' +
        '<li><strong>Kui sul on muid sääste või investeeringuid,</strong> millest saad esimestel pensioniaastatel elada, võib samba raha jätta fondi kasvama ja fondipensioni alustada hiljem.</li>' +
        '<li><strong>Kõik korraga välja võtta on maksu mõttes kõige ebasoodsam:</strong> tulumaks on 10% (enne soodusiga 22%). Et väljavõetud raha teeniks sama palju kui fondis, peaks see 10% maksu tasa teenima, see tähendab riskantsemat investeeringut.</li>' +
        '<li><strong>Hoiusel</strong> kaotab raha tavaliselt väärtust: hoiuse intressist läheb 22% tulumaksuks ja ülejäänu jääb enamasti hinnatõusust maha. Elukaares eeldame, et hoius kaotab ostujõudu 1% aastas (näiteks intress 3%, pärast maksu 2,3%, hinnad tõusevad 3,3%). See on eeldus, mitte prognoos. Kahju on väiksem kui kõike ära kulutades, aga ikka miinuses.</li>' +
        '<li><strong>Kui muid sääste pole,</strong> ei pruugi riiklikust pensionist ja III sambast elu lõpuni jätkuda. Siis on fondipension kõige kindlam viis.</li></ul>' +
        '<p><strong>Tuleva soovitus:</strong> kasuta II ja III samba raha alles siis, kui seda päriselt vajad. Fondipension (igakuine väljamakse) on maksuvaba ja välja võtmata raha kasvab fondis edasi; korraga või osade kaupa välja võttes on tulumaks 10%. Kindlustuslepingu tasud on praegu nii kõrged, et Tuleva ei pea seda mõistlikuks.</p>' +
        '<p class="mb-0">' + a('https://tuleva.ee/pensioni-valjamaksed/', 'Loe Tuleva lehelt pensioni väljamaksete kohta') + '</p>' },
    { q: 'Mida teada fondipensioni kohta?',
      html: '<ul>' +
        '<li><strong>Avaldusest piisab.</strong> Raha ei pea kuhugi ümber tõstma: igal kuul müüakse automaatselt väike osa fondiosakutest, ülejäänu jääb fondi.</li>' +
        '<li><strong>Periood ja maks.</strong> Fondihaldur (nt Tuleva) seadistab perioodiks sinu statistiliselt elada jäänud aastad (keskmisel 65-aastasel u 19 aastat). Sellise perioodiga on väljamaksed tulumaksuvabad. Elukaar ümardab perioodi täisaastateks (nt 18,56 → 19 a). Kui sinu lepingus arvestatakse kuudes, võib kuumakse olla kuni u 2% suurem.</li>' +
        '<li><strong>Raha teenib edasi tootlust.</strong> Näiteks kui fond kasvab keskmiselt 7% aastas, on makse perioodi lõpus üle kolme korra suurem kui alguses. Väljamakse suurus kõigub koos osaku hinnaga: kui fond kasvab, kasvab ka väljamakse, ja vastupidi.</li>' +
        '<li><strong>Paindlik.</strong> Igakuised väljamaksed saad igal ajal peatada ja hiljem uuesti alustada. Vajadusel saad teha lisaks osalise väljamakse (10% tulumaks), see vähendab hilisemaid kuumakseid.</li>' +
        '<li><strong>Sissemaksed.</strong> II sambast väljamakseid alustades lõpevad II samba sissemaksed igaveseks, ka riigi 4%. III sambasse võid maksta edasi ka siis, kui sealt juba raha võtad, ja saad ikka tulumaksu tagasi.</li>' +
        '<li><strong>Pärandamine.</strong> Fondis olevad II ja III samba osakud on sinu pärandvara. Pärijad saavad need oma pensionikontole või rahana (22% tulumaks); sina ei pea selleks avaldust tegema.</li></ul>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://tuleva.ee/pensioni-valjamaksed/', 'Tuleva: pensioni väljamaksed') + ' (loetud 17.10.2026).</p>' },
    { q: 'Kas fondipensioni saab alustada juba 60-aastaselt?',
      html: '<p><strong>Jah.</strong> II samba fondipensioni saab alustada kuni 5 aastat enne pensioniiga. Kui periood on vähemalt soovitusliku pikkusega (elada jäänud aastad Statistikaameti järgi), on väljamaksed tulumaksuvabad. III sambast saad fondipensioni alates 55-aastaselt (liitusid enne 2021. a) või 60-aastaselt.</p>' +
        '<ul><li>Väljamaksete algus <strong>lõpetab II samba sissemaksed</strong>, ka riigi 4%. Kui töötad edasi, kaotad need.</li>' +
        '<li>Varem alustades on periood pikem ja kuumakse väiksem.</li>' +
        '<li><strong>Kehv tervis:</strong> kui ootad lühemat elu, võib varem alustamine olla mõistlik, sest saad raha kätte, kui seda vajad. Maksuvaba periood arvutatakse aga keskmise eluea järgi, mitte sinu tervise järgi. Täieliku puuduva töövõime korral saad II sambast pensionile jääda igas vanuses ja maksuvabalt.</li></ul>' +
        '<p class="small-muted mb-0">Allikas: ' + a('https://www.pensionikeskus.ee/ii-sammas/valjamaksed/tahtajaline-pension/', 'Pensionikeskus: tähtajaline pension') + ', ' + a('https://www.pensionikeskus.ee/ii-sammas/valjamaksed/', 'II samba väljamaksed') + ' (kontrollitud 16.10.2026).</p>' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
