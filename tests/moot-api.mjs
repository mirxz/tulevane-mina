// Mõõtmine päris brauseris: avaleht → elukaar → tulemus → tagasiside; /api/e kontrollid; tulemuste leht (vajab TULEMUSED_PAROOL).
// Kasutus: TULEMUSED_PAROOL=… node tests/moot-api.mjs [URL]   (vaikimisi http://127.0.0.1:8787; .dev.vars TULEMUSED_VOTI väärtus)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
const parool = process.env.TULEMUSED_PAROOL;
let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) passed++; else { failed++; console.log("  ✗ " + msg); } };
const CHART = readFileSync(join(here, "..", "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const BS = readFileSync(join(here, "..", "node_modules/bootstrap/dist/css/bootstrap.min.css"), "utf8");
const kanal = "t" + Date.now().toString(36).slice(-8); // igal jooksul oma kanal, et tulemuste lehelt oma read üles leida
const post = (body, headers = {}) => fetch(url + "/api/e", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

console.log("\n/api/e kontrollid");
const ok0 = { sid: "abcdefgh1234", ev: "maandumine", k: "", p: "", samm: null, nimi: "" };
check((await post(ok0)).status === 200, "korrektne sündmus võetakse vastu");
check((await post({ ...ok0, ev: "hack" })).status === 400, "tundmatu sündmus lükatakse tagasi");
check((await post({ ...ok0, sid: "x" })).status === 400, "vigane seansi tunnus lükatakse tagasi");
check((await post({ ...ok0, p: "<script>" })).status === 400, "tundmatu profiil lükatakse tagasi");
check((await post({ ...ok0, samm: 99 })).status === 400, "võimatu samm lükatakse tagasi");
check((await post({ ...ok0, nimi: "a b<c>" })).status === 400, "vigane nimi lükatakse tagasi");
check((await post({ ...ok0, summa: "12345" })).status === 400, "tundmatu väli (nt sisestatud summa) lükatakse tagasi, mitte ei ignoreerita vaikselt");
check((await post({ ...ok0, nimi: "palk 3000" })).status === 400, "tekst tühikuga ei kõlba valiku nimeks");
check((await post("x".repeat(2000))).status === 413, "liiga suur päring lükatakse tagasi");
check((await post("ei ole json")).status === 400, "vigane JSON lükatakse tagasi");
check((await fetch(url + "/api/e")).status === 405, "GET pole lubatud");
const botKanal = "bot" + kanal.slice(0, 8);
check((await post({ ...ok0, sid: "botbotbot123", k: botKanal }, { "user-agent": "facebookexternalhit/1.1" })).status === 200, "robot saab 200, aga ei salvestu");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function uusKontekst(extra = {}) {
  const ctx = await browser.newContext({ reducedMotion: "reduce", ...extra });
  await ctx.route("**/cdn.jsdelivr.net/npm/chart.js**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
  await ctx.route("**/cdn.jsdelivr.net/npm/bootstrap**", (r) => r.fulfill({ contentType: "text/css", body: BS }));
  await ctx.route("**/fonts.g*/**", (r) => r.abort());
  return ctx;
}

console.log("\nLäbimäng: avaleht → elukaar → tulemus → tagasiside");
const ctx = await uusKontekst();
const page = await ctx.newPage();
const sund = [], vead = [];
page.on("request", (r) => { if (r.url().endsWith("/api/e")) { try { sund.push(JSON.parse(r.postData() || "{}")); } catch {} } });
page.on("pageerror", (e) => vead.push(e.message));
await page.goto(url + "/?k=" + kanal, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.minaMoot);
await page.waitForTimeout(300);
check(sund.some((e) => e.ev === "maandumine" && e.k === kanal), "avaleht saatis 'maandumine' kanaliga");
await Promise.all([page.waitForURL(/\/elukaar\//), page.click('a[href*="p=liige-steady"]')]);
await page.waitForFunction(() => window.Chart && document.querySelector("#path button"));
await page.waitForTimeout(300);
check(sund.some((e) => e.ev === "edasi" && e.p === "liige-steady" && e.k === kanal), "profiili valik saadeti 'edasi' sündmusena");
check(sund.some((e) => e.ev === "elukaar" && e.p === "liige-steady" && e.k === kanal), "elukaar saatis 'elukaar' sündmuse profiili ja kanaliga");
check(sund.some((e) => e.ev === "samm" && e.samm === 0), "esimene samm (0) logiti");
const sid = new Set(sund.map((e) => e.sid));
check(sid.size === 1 && /^[a-z0-9-]{8,60}$/i.test([...sid][0]), "kõik sündmused samast seansist (üks sid)");
// sisestus (arv) ei tohi mõõtmisse jõuda; valikud ja nupud jõuavad
await page.fill("#birthYear", "1971"); await page.fill("#p2", "12345");
await page.$eval('input[name="payout"][value="fund"]', (e) => e.click());
await page.click("#nextBtn"); // päris hiireklikk (sündmus on usaldatud), mitte skripti click()
await page.locator("#path button").last().click();
await page.waitForTimeout(500);
check(sund.some((e) => e.ev === "klikk" && e.nimi === "r:payout=fund"), "valik (radio) logiti nimega, mitte tekstiga");
check(sund.some((e) => e.ev === "klikk" && e.nimi === "b:nextBtn"), "nupp 'Edasi' logiti");
check(sund.some((e) => e.ev === "klikk" && e.nimi === "b:rada"), "raja nupp logiti");
check(sund.some((e) => e.ev === "samm" && e.samm === 9), "tulemuse samm (9) logiti");
check(!JSON.stringify(sund).includes("12345") && !JSON.stringify(sund).includes("1971"), "sisestatud arve (sünniaasta, II samba summa) ei lähe mõõtmisse");
check(sund.every((e) => Object.keys(e).sort().join() === "ev,k,nimi,p,samm,sid"), "iga sündmus sisaldab ainult lubatud välju");
const enne = sund.length;
// tagasiside leht: sama seanss ja kanal
await page.goto(url + "/tagasiside/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const tag = sund.slice(enne).find((e) => e.ev === "tagasiside");
check(tag && tag.sid === [...sid][0] && tag.k === kanal, "tagasiside leht jätkab sama mõõtmisseanssi ja kanalit (ilma ?k= aadressis)");
const t = [];
page.on("request", (r) => { if (r.url().endsWith("/api/t")) t.push(JSON.parse(r.postData() || "{}")); });
await page.$eval('input[name="taitmine"][value="jah"]', (e) => e.click());
await page.$eval('input[name="vanus_vastus"][value="ei"]', (e) => e.click());
await page.$eval('input[name="uus"][value="ei"]', (e) => e.click());
await page.$eval('input[name="muudaks"][value="ei"]', (e) => e.click());
await page.$eval("#saada", (e) => e.click());
await page.waitForTimeout(800);
check(t.length === 1 && t[0].alk === kanal, "tagasiside vastus sai kanali");
check(t.length === 1 && t[0].sid !== [...sid][0] && /^[a-z0-9-]{8,60}$/i.test(t[0].sid), "tagasiside vastuse tunnus on eraldi: erineb mõõtmise seansi tunnusest, seega ei saa vastust liikumisega siduda");
check(vead.filter((m) => !/Chart is not defined/.test(m)).length === 0, "lehe vigu pole: " + vead.join("; "));

console.log("\nDo Not Track");
const dnt = await uusKontekst();
await dnt.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { value: "1" }));
const pd = await dnt.newPage(); let dn = 0;
pd.on("request", (r) => { if (r.url().endsWith("/api/e")) dn++; });
await pd.goto(url + "/?k=" + kanal + "dnt", { waitUntil: "domcontentloaded" }); await pd.waitForTimeout(500);
check(dn === 0, "'Ära jälgi' korral ei saadeta midagi");

if (parool) {
  console.log("\nTulemuste leht");
  const auth = { authorization: "Basic " + Buffer.from("x:" + parool).toString("base64") };
  const html = await (await fetch(url + "/tulemused", { headers: auth })).text();
  const txt = html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const h of ["Mõõtmine (kellaajad Tallinna aja järgi)", "Kutsekirjad", "Funnel kanalite kaupa", "Maandumisleht (avaleht)", "Elukaar: kasutus", "Elukaare seansi pikkus", "Kanalite kaupa:", "Millal vastati:"]) check(html.includes(h), "tulemuste lehel on '" + h + "'");
  const rida = new RegExp(kanal + " 1 1 \\(100%\\) 1 \\(100%\\) 1 \\(100%\\) 1 \\(100%\\) 1 \\d+:\\d\\d / \\d+:\\d\\d \\(1\\)").test(txt);
  check(rida, "funnel: oma kanal " + kanal + " — maandus 1, edasi 1, elukaar 1, tulemus 1, tagasiside leht 1, vastas 1, seansi pikkus mm:ss: " + ((new RegExp(kanal + ".{0,90}").exec(txt) || [""])[0]));
  check(/liige-steady \d+ \d+ \d+/.test(txt), "eelprofiilide tabelis on liige-steady");
  check(txt.includes("b:rada") || txt.includes("r:payout=fund"), "klikkide tabelis on valik");
  check(!txt.includes(botKanal) && !txt.includes(kanal + "dnt"), "robot ega 'Ära jälgi' kasutaja ei jõudnud tabelisse");
  check(!/NaN|Infinity|undefined/.test(txt), "tulemuste lehel pole NaN/Infinity/undefined");
  check(/keskmine · \d+:\d\d mediaan/.test(txt), "tulemuste lehel on elukaare seansi keskmine pikkus");
  check(!/Teekond:|Viimati \(|Viimased seansid/.test(txt) && !html.includes(String([...sid][0])), "tulemuste lehel pole ühe kasutaja teekonda ega seansi tunnust");
  check(/Täna tundide kaupa \(Tallinna aeg\)/.test(txt) && /Kõik päevad kokku, kellaaja järgi/.test(txt), "tunnivaated on Tallinna ajas");
} else console.log("(tulemuste lehe kontroll vahele: pane TULEMUSED_PAROOL)");
await browser.close();
console.log(`\nMõõtmine: ${passed} kontrolli läbis, ${failed} kukkus`);
process.exit(failed ? 1 : 0);
