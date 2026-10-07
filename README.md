# Tulevane Mina

Tuleva häkatoni 2026 prototüüp: pane pensioniaastad panuseks, ratas veeretab su elu läbi suremusstatistika ja tulevane sina helistab. Lõpuks näitab mäng kõiki elusid ja paljastab kasiinovõtted.

Mäng on üks fail: `public/index.html`. Lisaks on üks väike liides `src/index.js` (`/api/tts`), mis loeb tulevase mina kõne ette eesti häälega. Andmebaasi pole, mäng ei salvesta midagi ega kogu isikuandmeid.

## Aadressid

| Mis | Aadress | Kust tuleb |
| --- | --- | --- |
| Toodang (žürii, testijad) | https://mina.tulevane.workers.dev | haru `main` |
| Eelvaade | `https://<haru>-mina.tulevane.workers.dev` | iga teine haru |

## Töövoog

1. **Otsus.** Mida muudame, on kirjas [otsuste logis](https://claude.ai/code/artifact/db97d812-22e1-4c5c-a076-89b7571d2a54). Ilma otsuseta toodangusse ei liigu midagi.
2. **Ehitus.** Muudatus tehakse uues harus nimega `muudatus/<lühike-nimi>`, näiteks `muudatus/reinsoni-viited`. Kiired katsetused võib teha enne claude.ai artefaktis.
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

## Käsitsi kontrollnimekiri (eelvaade telefonis)

- [ ] Avaneb telefonis, teksti ei lõigata ja külgsuunas kerida ei saa.
- [ ] Sünniaasta, sugu ja pension muudavad pensioniiga ja eeldatavat eluiga.
- [ ] Panus: kõik 11 koefitsiendinuppu töötavad ja kupong muutub.
- [ ] Ratas keerleb ja jääb seisma, keskel on vanus.
- [ ] Kõne heliseb. Nii „Vasta“ kui ka „Keeldu“ viivad tsitaadini ja hääl loeb selle ette. Turvarida on nähtav.
- [ ] Tõde: graafik, kolm numbrit, paljastatud võtted ja tabel on olemas.
- [ ] „Proovi teist panust“ ja „Alusta otsast“ töötavad.
- [ ] Mõlemad sood ja vähemalt valikud −5, 0 ja +5 on läbi proovitud.
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

## Allikad

- Pensioni kordajad: Sotsiaalkindlustusamet, paindlik vanaduspension.
- Suremus: Gompertzi mudel, kalibreeritud Eurostati 2023 eeldatavale elueale 65-aastaselt (mehed 15,9, naised 21,1 a).
- Pensioniiga: TulevaEE/onboarding-client `pensionCalculator/calculation.ts` (MIT).
