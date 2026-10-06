# Tulevane Mina

Tuleva häkatoni 2026 prototüüp: pane pensioniaastad panuseks, ratas veeretab su elu läbi suremusstatistika ja tulevane sina helistab. Lõpuks näitab mäng kõiki elusid ja paljastab kasiinovõtted.

Kogu mäng on üks fail: `public/index.html`. Serverit ega andmebaasi pole. Mäng ei salvesta midagi ega kogu isikuandmeid.

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
- Üks fail, väliseid skripte ei ole. Lubatud on ainult Google Fonts.
- Ei mingit analüütikat, küpsiseid ega andmete saatmist. Kui tahame mõõta, otsustame selle enne logis.
- Arvud tulevad allikast. Kui muudad kordajaid, suremusmudelit või pensioniiga, uuenda ka testi oodatud väärtust (`tests/smoke.mjs`) ja allikaviidet lehe jaluses.
- Tuleva logo avalikul lehel ei kasuta. Silt „prototüüp“ ja lahtiütlus jäävad alles.
- **Külmutus:** viimased 60 minutit enne lõppesitlust `main`-i ei muudeta. Esitlus tehakse versioonist, mis on märgitud git-sildiga `pitch`.
- **Tagasivõtmine:** Cloudflare → Workers & Pages → tulevane-mina → Deployments → eelmine versioon → Rollback. Või `git revert` ja uus pull request.

## Käsitsi kontrollnimekiri (eelvaade telefonis)

- [ ] Avaneb telefonis, teksti ei lõigata ja külgsuunas kerida ei saa.
- [ ] Sünniaasta, sugu ja pension muudavad pensioniiga ja eeldatavat eluiga.
- [ ] Panus: kõik 11 koefitsiendinuppu töötavad ja kupong muutub.
- [ ] Ratas keerleb ja jääb seisma, keskel on vanus.
- [ ] Kõne heliseb. Nii „Vasta“ kui ka „Keeldu“ viivad tsitaadini.
- [ ] Tõde: graafik, kolm numbrit, paljastatud võtted ja tabel on olemas.
- [ ] „Proovi teist panust“ ja „Alusta otsast“ töötavad.
- [ ] Mõlemad sood ja vähemalt valikud −5, 0 ja +5 on läbi proovitud.

## Kohalik test

```
npm install
npx playwright install chromium
npx wrangler dev            # http://localhost:8787
npm test                    # teises aknas
```

## Ühekordne seadistus

1. **GitHub:** repo on [mirxz/tulevane-mina](https://github.com/mirxz/tulevane-mina) (privaatne kuni pühapäevase demoni) ja lisa sinna selle kausta failid, näiteks GitHub Desktopis: *Add existing repository* → *Publish*.
2. **Cloudflare:** Workers & Pages → *Create* → *Import a repository* → vali `tulevane-mina`.
   - Workeri nimi: `tulevane-mina` (peab klappima `wrangler.jsonc` failiga).
   - Build command: tühi.
   - Deploy command: `npx wrangler deploy`.
   - Production branch: `main`. Luba *non-production branch builds* (eelvaated).
3. Kirjuta tekkinud aadressid ülal olevasse tabelisse.

## Allikad

- Pensioni kordajad: Sotsiaalkindlustusamet, paindlik vanaduspension.
- Suremus: Gompertzi mudel, kalibreeritud Eurostati 2023 eeldatavale elueale 65-aastaselt (mehed 15,9, naised 21,1 a).
- Pensioniiga: TulevaEE/onboarding-client `pensionCalculator/calculation.ts` (MIT).
