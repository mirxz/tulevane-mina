# Tulevane Mina: üleandmine Tuleva tiimile

Oct 26, 2026 · @Mirko Känd

## Kokkuvõte

Tuleva AS saab 2026-10-26 tulevanemina.ee domeeni; see dokument ütleb, mis sellega koos muutub, mis on prototüübis olemas ja mida kolme arvutusmootori võrdlus näitas.

Dokumenti ja kaasasolevaid oskusi võib kasutada nii, et Tuleva tiim jätkab saidiga või võtab ainult domeeni ja kasutab leide oma koodi kontrollimiseks. Kumb neist, on lahtine (vt „Lahtised küsimused“).

Üleandmisse kuulub ainult projekti tehniline ja arvutuslik teadmine. Üleandja isiklikud oskused, mälu ja muud töömaterjalid ei kuulu siia. Prototüübi märkmete järgi kuuluvad häkatonil tehtud töö varalised õigused Tulevale; seda ei ole selle dokumendi jaoks uuesti kinnitatud (TBC).

## Domeen ja sait (tulevanemina.ee)

Domeen läheb 2026-10-26 üle Tuleva AS-ile; ilma Workeri uuesti avaldamiseta Tuleva Cloudflare'i kontol jääb sait kättesaadavaks ainult workers.dev aadressil. Allolev tabel näitab, mis on praegu domeeni küljes ja mis juhtub.

| Osa | Kus praegu | Mis juhtub üleandmisel |
| --- | --- | --- |
| Registreering | Zone.ee, üleandja nimel | Registreerija vahetus Tuleva AS-ile Zone.ee-s. Tuleva Zone.ee konto: TBC |
| DNS-tsoon | Üleandja Cloudflare'i konto (nimeserverid brenna ja burt .ns.cloudflare.com) | Tuleva lisab domeeni oma Cloudflare'i kontole, kirjed eksporditakse vanast tsoonist ja imporditakse uude, nimeserverid vahetatakse Zone.ee-s. Vana tsoon muutub olekusse „Moved Away“. SSL-sertifikaadid tehakse uues kontos uuesti |
| Sait | Worker `mina`, custom domain tulevanemina.ee ja www.tulevanemina.ee | Workeri custom domain töötab ainult sama konto tsooniga. Kui tsoon liigub, peab Tuleva Workeri oma kontole avaldama (repo, D1, saladused PROTO\_VOTI ja TULEMUSED\_VOTI) või jääb sait ainult workers.dev aadressile |
| Tagasiside andmed | D1 andmebaas `mina-tagasiside` üleandja kontol | Enne üleandmist eksportida: `npx wrangler d1 export mina-tagasiside --remote --output=mina-tagasiside.sql`. Kellele andmed jäävad: TBC |
| E-post | Cloudflare Email Routing domeeni aadressilt üleandja postkasti | Lõpeb, kui tsoon liigub. Privaatsuspoliitika kontaktaadress ja private alfa kutsete saatja tuleb muuta |
| workers.dev | mina.tulevane.workers.dev üleandja kontol | Jääb üleandja kontole: jätta tööle, suunata tulevanemina.ee-le või sulgeda |
| Kood | GitHubi repo mirxz/tulevane-mina (privaatne) | Vajadusel Settings → Transfer ownership Tuleva GitHubi organisatsiooni |

Tsooni liigutamise sammud kirjeldab [Cloudflare'i juhend domeeni liigutamise kohta](https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/) (link on üleandja märkmetest, selle dokumendi jaoks uuesti avamata).

## Mis on prototüübis olemas ja kus

Sait on ühe failina mäng pluss väike Cloudflare Worker, mis teenindab ainult kolme aadressigruppi: häälekõne, mõõtmine ja tulemuste leht. Seis kuupäevaga 2026-10-10; hilisemat seisu ei ole siin kontrollitud (TBC).

- **Hostimine:** Cloudflare Workers, Worker `mina`. `wrangler.jsonc`: `main` src/index.js, staatilised failid `ASSETS` all, `run_worker_first` ainult `/api/*`, `"previews": {}` (vajalik eelvaate-harude buildiks). Aadressid `tulevanemina.ee`, `www.tulevanemina.ee` ja workers.dev.
- **Hääl:** `/api/tts` kutsub TartuNLP Neurokõne avalikku API-t (hääled albert ja kylli, kiirus 0,9). TartuNLP-i teavituskiri (ping@tartunlp.ai) on koostamata või saatmata: TBC.
- **Mõõtmine:** `/api/s` kirjutab D1 baasi `mina-tagasiside` (binding `DB`, ka eelvaadete plokis), tabelid `sundmused` ja `vastused`. IP-sid ega mängu sisendeid ei salvestata, analüütikat pole. `/tulemused` ja `/tulemused.csv` on Basic auth'i taga.
- **Saladused (ainult nimed, väärtused on Cloudflare'is):** `PROTO_VOTI` lülitab kogu saidi parooli taha, `TULEMUSED_VOTI` kaitseb tulemuste lehte. Kas parooliga kaitse jääb: TBC.
- **Testid:** GitHub Actions suitsutest (wrangler dev + Playwright, telefon ja arvuti) kontrollib mudeli põhiarve, kõne turvarida, paljastust, ligipääsetavust (axe-core, WCAG 2.1 AA) ja et konsoolis vigu pole. Arvude muutmisel uuenda testi oodatud väärtust.
- **Tagasivõtt:** Cloudflare Deployments → Rollback.

**Turvareeglid mängu sisus, mida jätkamisel säilitada:** häälekõne ei küsi kunagi koode, PIN-i, ID-kaarti, Smart-ID-d, linke ega ülekandeid; turvarida on alati nähtav; päris kõnesid ja häälekloonimist ei ole; mängu lõpus paljastatakse petturivõtted.

**Mudel (lihtsustatud):** SKA paindliku pensioni kordajad; suremus Gompertzi seadusega (b = 0,1), kalibreeritud Eurostati 2023 järelejäänud elueale 65-aastaselt; pensioniiga 65 + 1,5 kuud iga sünniaasta kohta alates 1962; ilma indekseerimise, maksude ja diskonteerimiseta. Pensioniea reegel erineb Tuleva ja Meelise mootorist, vt järgmine jaotus.

## Arvutusloogika: I sammas (riiklik pension)

Lisatud 2026-10-26. Koodi vastuvõtja peab teadma, mida mudel teeb ja mis on kontrollimata. See ei ole juriidiline hinnang.

**Kus kood on:** täisvalem (baasosa, staaž, aastakoefitsiendid) on arhiivi kalkulaatoris `public/arhiiv/kalkulaator/riiklik.js` (andmed `public/arhiiv/kalkulaator/andmed/kihid.js`) ja plaani mudeli funktsioonis `plaan()` failis `public/arhiiv/plaan/mudel.js`. Elukaare leht (`public/elukaar/pension.js`) arvutab riikliku pensioni juurdekasvu töötades samade aastahinde ja osakute reeglitega.

- **Valem:** pension = 399,24 + 10,477 · (staaž + koefitsient). Ühendosa = (kindlustusosak + solidaarosak) / 2 × aastahind (RPKS § 11 lg 1 p 4 ja lg 1²).
- **Kindlustusosak** = palk / keskmine brutokuupalk (RPKS § 12 lg 1). **Solidaarosak** = palk / töötasu alammäär, kuni 1,0; II sambaga liitunul 0,8 (RPKS § 13¹ lg 2, 6, 7).
- **Ümberarvutus** igal 1. aprillil (RPKS § 25 lg 1 p 1). Aastahind 10,477 € alates 2026-04-01.
- **Edasilükatud pension:** kordaja kogu pensionile (RPKS § 11¹ lg 1 ja 5). **Paindlik pension:** varem 1–5 aastat staaži 20–40 aasta järgi, hiljem vähemalt 15 aasta staažiga (RPKS § 9¹).
- **Mudeli eeldused:** indekseerimine 80% reaalpalga kasvust (vaikimisi 1,5% reaalselt, projekti eeldus); palk ja riiklik pension on Elukaare lehel reaalselt konstantsed; mudel ei arvesta hooldust ega tervist.

### Kontrollimata (TBC)

- Pensioniea väärtused 2027–2029 (ministri määrus kaks aastat ette): kood arvutab need RPKS § 7 ja § 7¹ valemiga ja märgib tulemuseks 65 a 1 k (2027), 65 a 3 k (2028) ja 65 a 4 k (2029), kontrollituna 2026-10-26; sõltumatu kinnitus määrusest: TBC.
- 80% kindlustusosak II sambaga liitunul (järeldub sotsiaalmaksuseadusest, mida ei kontrollitud): TBC.
- Edasilükkamise protsendid (ministri määrus, RPKS § 11¹ lg 3): TBC.
- Aastahind 10,477 €: ainult SKA ja ERR järgi, kinnita Vabariigi Valitsuse 2026. aasta indeksi korraldusest (RPKS § 26 lg 5¹): TBC.
- Keskmine brutokuupalk 2 092 € (Statistikaamet PA103) ja töötasu alammäär 946 € (Vabariigi Valitsuse määrus nr 36): TBC.
- Sõltumatu kontroll puudub: valemit ei ole võrreldud SKA kalkulaatoriga (3–5 välist näidet): TBC.
- Prototüüp ei küsi paindliku pensioni staažinõuet (20–40 a); see on eeldus, mida tekst peab nimetama.
- Kogumispensionide seaduse 2027-01-01 jõustuv redaktsioon on lugemata; viited kontrollida enne avalikustamist.

Allikafailid (väide-hinnang-viide tabel, kolme mootori võrdlus 12 profiilil, mudeli kirjeldus) on üleandja projektimärkmetes ega ole selles repos: TBC, kas ja millal need Tulevale antakse. Selle dokumendi jaotised „Arvutusmootorite võrdlus“ ja „Seadusviidete kontroll“ on nende kokkuvõte.

## Arvutusmootorite võrdlus: Mirko, Meelis ja Tuleva

Megakalkulaatori praegune mootor ületab alla 65-aastaste kapitali 65-aastaselt 15–22%, sest kasv loetakse kaks korda; Tuleva enda kogumisloogika ja Mirko mootor annavad joondatud sisenditel euro täpsusega sama vastuse. Võrdlus tehti 2026-10-10 kolme sõltumatu koodibaasiga 12 profiilil (harness `valid/vordlus.mjs`); profiilide tabelit siia ei kopeeri.

| Mootor | Allikas | Vara 65-aastaselt Mirko mootori suhtes | Märkus |
| --- | --- | --- | --- |
| Mirko | `public/plaan/mudel.js` | võrdlusalus | – |
| Tuleva | TulevaEE/wordpress-theme `203d7a9`: `calculator.js` (kogumine), `main.js` `calculatePayout` (väljamakse) | täpselt sama | 5 juhtu kontrollitud live tuleva.ee tulemusega; katab ainult II samba kogumist ja väljamakset (ei III sammast, riiklikku pensioni, saldosisendit ega sugu) |
| Meelis uus | tuleva-tulevik HEAD `0258543` (ümber kirjutatud, plaanipõhine `simulate`) | +0,4…+1,2% | Arvatav põhjus: sissemakse aasta alguses vs lõpus. Kinnitamata, tuleb Meelisega kinnitada; viga see ei ole |
| Meelis vana (megakalkulaator) | tuleva-tulevik `31208b8`, sama koopia mis `public/kalkulaator/mootor.js` | +21,9% (vanus ≤ 55), +14,9% (vanus 58), tootlus 2% | Kasv loetakse topelt, vt leid 1 |

### Leiud

1. **Topeltkasv megakalkulaatori mootoris.** Kapital 65-aastaselt on tegelikust suurem teguriga (1 + r)^(pensioniiga − max(vanus, 55)). Kontrollitud kõigil 12 profiilil: tegelik suhe võrdub ennustatud suhtega neljanda komakohani. Põhjus: `fund *= 1 + r` jätkub realoopis pensioniigast nooremate vanuste jaoks pärast eelnevat akumuleerimist. Tootlusel 0% viga ei avaldu, seepärast jääb see 0%-ga testimisel märkamata.
2. **Pensioniiga lahkneb.** Meelise mootor 65 a 4 k, Mirko mootor 66–69 (vana valem 65 + (sünniaasta − 1962) · 1,5 / 12 kuud), Tuleva 65. Seaduse põhjal tuleb valida üks; konkreetsed 2027–2029 väärtused tulevad ministri määrusega (TBC).
3. **Tuleva väljamakse ei arvesta sugu.** Fikseeritud 19 aastat annab 100 000 € juures 439 € kuus, kuigi Tuleva enda kogusummavalem 3% juures annab 452 €. Samal sisendil 65-aastaselt: Meelis 521 € (mees) / 397 € (naine), Mirko 510 / 389, Tuleva 439.
4. **Elutabel on kõigil kolmel identne** (Statistikaamet 2025), seega andmete osas pole see sõltumatu kontroll.
5. **Riiklikku pensioni ei saa võrrelda.** Tuleval seda pole, Meelisel pole samas mahus, seega on ainult Mirko valem (399,24 + 10,477 · (staaž + koefitsient)). Vajab väliste näidetega kontrolli (SKA kalkulaator, 3–5 inimest).
6. **Jätkusuutlik kuuvajadus erineb:** Meelis vana on kõige kõrgem (leiu 1 tõttu), Meelis uus madalaim, Mirko vahepeal (nt mitte-steady profiil 1500 / 1390 / 1410 €). Mõnel profiilil erineb ka otsus vajaduse 1300 € juures.
7. **Fondipensioni väljamakse kuju.** Mirko repos oli ajutiselt annuiteet (tasane makse); seadus seda ei nõua: euro makse = osakud × puhasväärtus ja osakuid võetakse tagasi osakute arv / veel tegemata väljamaksed (KoPS § 52³ lg 7–8, § 60¹ lg 5 ja 8). Meelise repos on see juba `fund / left`, ehk õige. Mirko repo parandus on eraldi harul, seis 2026-10-12: ootab push'i ja live'i (praegune seis: TBC).

### Soovitus

Vahetada megakalkulaatori mootor Meelise viimase versiooni vastu pärast tema kinnitust ajastuse kohta, korrata harness'i ja valida pensioniiga. Mingit muudatust ei ole võrdluse käigus Meelise ega Tuleva repos tehtud ega pushitud.

### Seadusviidete kontroll: staatus ja piirid

Viited kontrolliti 2026-10-12 Riigi Teataja tervikteksti vastu (kogumispensionide seadus kehtivusega 2025-06-01 kuni 2026-12-31, tulumaksuseadus ja riikliku pensionikindlustuse seadus kehtivusega 2026-10-01 kuni 2026-12-31). Kogumispensionide seaduse 2027-01-01 redaktsiooni ei ole loetud. See ei ole juriidiline hinnang.

- **Parandatud viited:** III samba vanusepiir on pensioniiga miinus 5 aastat (KoPS § 63 lg 3), 55 aastat kehtib ainult neile, kes omandasid osakuid enne 2021 (§ 72⁷ lg 2); 10% maks eeldab lisaks viit aastat esmasest omandamisest (TuMS § 21 lg 3 p 1). Esimene väljamakse ei lõpeta II samba sissemakseid kohe, vaid 30. aprillil, 31. augustil või 31. detsembril (KoPS § 7 lg 3).
- **Kontrollimata (`[unverified]`; täpsemalt jaotises „Arvutusloogika: I sammas“):** pensioniea väärtused 2027–2029 (hilisem kontroll koodis, vt sealt), edasilükatud pensioni protsendid (ministri määrus), kindlustusosaku 80%, keskmine brutokuupalk ja sotsiaalmaksuseaduse neli punkti. Aastahind 10,477 € on `[secondary]` (SKA, ERR) ja vajab Vabariigi Valitsuse 2026. aasta indeksi korraldust.
- **Tähised:** `[verified]` = seaduse tekst loetud, `[secondary]` = ainult EMTA, SKA või ajakirjanduse leht, `[unverified]` = ei õnnestunud kontrollida.

## Disainisüsteemi allikad

Prototüübi disaini tokenid (värvid, kirjatüübid, nupu kaal) on võetud Tuleva enda avalikest repodest, TulevaEE/onboarding-client (MIT) ja TulevaEE/wordpress-theme, ning kontrollitud tuleva.ee arvutatud stiilide vastu. Wordpress-theme repo litsents: TBC.

## Lahtised küsimused (TBC)

- [ ] Kes on Tuleva kontaktisik üleandmisel? TBC
- [ ] Kas Tuleva võtab ainult domeeni või ka saidi (Worker, kood, D1)? TBC
- [ ] Kes on tagasiside andmete ja häkatonil kogutud e-posti aadresside vastutav töötleja? TBC
- [ ] Kas domeeni aadressil e-posti suunamine jääb Tuleva tsooni või kaob? TBC
- [ ] Kas DNS jääb üleminekuks vanasse tsooni või liigub kohe Tuleva kontole? TBC
- [ ] Kas parooliga kaitse (`PROTO_VOTI`) jääb? TBC
- [ ] Kas saidi avalik kasutus vajab Tuleva poolset luba ja kellelt? TBC
- [ ] Kes teavitab TartuNLP-d, et sait kasutab nende avalikku häälteenust? TBC
- [ ] Millise pensioniea reegli järgi mootorid joondatakse (leid 2)? TBC
- [ ] Kes vahetab megakalkulaatori mootori ja kes räägib Meelisega ajastuse kinnitamise (leid 1)? TBC
- [ ] Kes kontrollib I samba arvutusloogika avatud punktid (jaotis „Kontrollimata“) enne avalikustamist? TBC
- [ ] Kas Mirko repo fondipensioni parandus läks live'i ja kas harness `valid/vordlus.mjs` antakse Tulevale? TBC

## Kaasasolevad oskused ja allikad

Kaasas on kaks Claude'i oskust, mis on kirjutatud nullist selle dokumendi põhjal; neis ei ole üleandja isiklikku sisu ega saladuste väärtusi. Kuhu need Tuleva repos või Claude'i organisatsioonis paigutada: TBC Tuleva tiimiga.

| Oskus | Millal kasutada | Fail |
| --- | --- | --- |
| `tulevane-mina-arvutuste-kontroll` | Pensioniarvutuste kontroll seaduse või teise mootori vastu: meetod, allikatähised, teadaolevad lõksud | `tulevane-mina-arvutuste-kontroll/SKILL.md` |
| `tulevane-mina-sait` | Saidi hooldus ja arendus, saladuste nimed, mängu turvareeglid, domeeni liigutamine teise Cloudflare'i kontosse | `tulevane-mina-sait/SKILL.md` |

### Allikad

Lingid on üleandja märkmetest, selle dokumendi jaoks uuesti avamata.

- [Riigi Teataja: kogumispensionide seadus](https://www.riigiteataja.ee/akt/KoPS)
- [Rahandusministri määrus nr 41, lisa 1](https://www.riigiteataja.ee/aktilisa/0000/1308/6135/13086138.pdf)
- [Cloudflare: Move a domain between Cloudflare accounts](https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/)
- Koodiallikad: TulevaEE/onboarding-client, TulevaEE/wordpress-theme, tuleva-tulevik, mirxz/tulevane-mina
