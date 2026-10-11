// Põhimõtete 1 ja 2 päris brauseris ja andmebaasis (vt ANALUUTIKA.md):
//  - sisestatud väärtused (märgitud sentinel-väärtused) ei jõua ühegi mõõtmise ega tagasiside tabelisse;
//  - tagasiside vastus ei ole seotud mõõtmise seansiga ega e-postiga.
// Vajab käimasolevat `wrangler dev` (vaikimisi http://127.0.0.1:8787) ja kohalikku D1 andmebaasi (loeb `wrangler d1 execute --local`).
// Kasutus: node tests/privaatsus-brauser.mjs [URL]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const juur = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = (process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8787").replace(/\/$/, "");
let ok = 0, fail = 0;
const check = (c, m) => { if (c) ok++; else { fail++; console.log("  ✗ " + m); } };
const CHART = readFileSync(join(juur, "node_modules/chart.js/dist/chart.umd.js"), "utf8");
const BS = readFileSync(join(juur, "node_modules/bootstrap/dist/css/bootstrap.min.css"), "utf8");
const sql = (q) => {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "mina-tagasiside", "--local", "--json", "--command", q], { cwd: juur, encoding: "utf8", maxBuffer: 50e6, stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
};
const kanal = "p" + Date.now().toString(36).slice(-8);
// Märgid: kui mõni neist ilmub andmebaasi (v.a. tagasiside vabatekstid, mis on vabatahtlik vastus), on sisestatud väärtus lekkinud.
const MARK = { aasta: "1957", p2: "7654321", palk: "98765", saast: "13579", kulu: "24680", vanus: "63171" };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ reducedMotion: "reduce" });
await ctx.route("**/cdn.jsdelivr.net/npm/chart.js**", (r) => r.fulfill({ contentType: "application/javascript", body: CHART }));
await ctx.route("**/cdn.jsdelivr.net/npm/bootstrap**", (r) => r.fulfill({ contentType: "text/css", body: BS }));
await ctx.route("**/fonts.g*/**", (r) => r.abort());
const page = await ctx.newPage();
const saadetud = [];
page.on("request", (r) => { if (/\/api\/(e|t)$/.test(r.url())) saadetud.push({ url: r.url(), body: r.postData() || "" }); });

await page.goto(url + "/?k=" + kanal, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.minaMoot);
await Promise.all([page.waitForURL(/\/elukaar\//), page.click('a[href*="p=liige-steady"]')]);
await page.waitForFunction(() => window.Chart && document.querySelector("#path button"));

// Täida elukaarel KÕIK sisestusväljad märgiga väärtusega ja klõpsa edasi kuni lõpuni.
let samme = 0;
for (let i = 0; i < 14; i++) {
  await page.evaluate((M) => {
    const jarg = Object.values(M);
    let j = 0;
    for (const el of document.querySelectorAll("input, textarea")) {
      if (el.disabled || el.type === "radio" || el.type === "checkbox" || el.type === "hidden" || el.type === "button") continue;
      if (el.offsetParent === null) continue;
      el.value = el.type === "number" || el.inputMode === "numeric" ? jarg[j++ % jarg.length] : "Mark" + jarg[j++ % jarg.length];
      el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, MARK);
  const nupp = page.locator("#nextBtn");
  if (!(await nupp.isVisible()) || (await nupp.isDisabled())) break;
  await nupp.click(); samme++;
  await page.waitForTimeout(150);
}
check(samme >= 4, "elukaarel liiguti läbi mitu sammu täidetud väljadega (" + samme + ")");
await page.locator("#path button").last().click().catch(() => {});
await page.waitForTimeout(500);

// Tagasiside: täida valikud ja vabatekstid
await page.goto(url + "/tagasiside/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
for (const [n, v] of [["taitmine", "jah"], ["vanus_vastus", "ei"], ["uus", "ei"], ["muudaks", "ei"]]) await page.$eval(`input[name="${n}"][value="${v}"]`, (e) => e.click());
await page.fill("#kommentaar", "Kirjuta mulle mari@example.com või 5551234567");
await page.$eval("#saada", (e) => e.click());
await page.waitForTimeout(900);

console.log("\nVõrgust väljunud andmed");
const mootKeha = saadetud.filter((x) => x.url.endsWith("/api/e")).map((x) => x.body);
check(mootKeha.length >= 6, "mõõtmissündmusi saadeti (" + mootKeha.length + ")");
for (const v of Object.values(MARK)) check(!mootKeha.some((b) => b.includes(v)), "mõõtmise päringutes pole sisestatud väärtust " + v);
check(mootKeha.every((b) => Object.keys(JSON.parse(b)).sort().join() === "ev,k,nimi,p,samm,sid"), "iga mõõtmispäring sisaldab ainult lubatud välju");
check(mootKeha.every((b) => { const n = JSON.parse(b).nimi; return !n || /^[a-z0-9:=_.-]{1,40}$/i.test(n); }), "kõik nimed on valiku tähised (ilma tühikuta)");
const tKeha = saadetud.filter((x) => x.url.endsWith("/api/t")).map((x) => JSON.parse(x.body));
check(tKeha.length === 1, "tagasiside saadeti");
const mootSid = await page.evaluate(() => sessionStorage.getItem("mina_sid"));
check(tKeha[0] && tKeha[0].sid && tKeha[0].sid !== mootSid, "tagasiside tunnus erineb mõõtmise seansi tunnusest");
check(!/mari@example|5551234567/.test(JSON.stringify(Object.keys(tKeha[0] || {}))) , "tagasiside päringu võtmed ei sisalda isikuandmeid");
await browser.close();

console.log("\nAndmebaas (kohalik D1)");
let rows;
try { rows = { seansid: sql("SELECT * FROM mina_seansid"), loendur: sql("SELECT * FROM mina_loendur"), tag: sql("SELECT * FROM tagasiside_vastused WHERE allikas = '" + kanal + "'"), meil: sql("SELECT * FROM ratas_meilid") }; }
catch (e) { check(false, "kohaliku andmebaasi lugemine ebaõnnestus: " + e.message.slice(0, 120)); }
if (rows) {
  const tekstid = [...rows.seansid, ...rows.loendur].flatMap((r) => Object.values(r)).filter((v) => typeof v === "string").join("|");
  for (const v of Object.values(MARK)) check(!tekstid.includes(v), "mõõtmise tabelite tekstiväljades pole sisestatud väärtust " + v);
  const oma = rows.seansid.filter((s) => s.k === kanal);
  check(oma.length === 1, "meie seansist on täpselt üks kokkuvõtterida (" + oma.length + ")");
  const s0 = oma[0] || {};
  check(Object.keys(s0).sort().join() === "edasi,elukaar,esimene,host,k,klikke,maandus,p,samm_max,sid,tagasiside,viimane", "seansirida sisaldab ainult kokkuvõtte veerge");
  check(s0.samm_max >= 4 && s0.klikke >= 2 && s0.elukaar === 1 && s0.maandus === 1 && s0.edasi === 1 && s0.tagasiside === 1, "seansirida on kokkuvõte: kaugeim samm, klikkide arv ja lipud (" + JSON.stringify(s0) + ")");
  check(!JSON.stringify(s0).includes("b:") && !JSON.stringify(s0).includes("r:"), "seansirida ei sisalda valikute nimesid ega teekonda");
  check(rows.loendur.every((r) => !("sid" in r)) && rows.loendur.every((r) => /^\d{4}-\d\d-\d\dT\d\d$/.test(r.tund)), "loendurid on tunnipõhised ja seansita");
  check(rows.tag.length === 1, "tagasiside rida on olemas");
  const t0 = rows.tag[0] || {};
  check(!rows.seansid.some((s) => s.sid === t0.sid) && !rows.loendur.some((r) => JSON.stringify(r).includes(t0.sid || "§")), "tagasiside tunnust ei leidu mõõtmise tabelites");
  check(!/mari@example|5551234567/.test(JSON.stringify(t0)) && /\[e-post\]/.test(t0.kommentaar || "") && /\[number\]/.test(t0.kommentaar || ""), "tagasiside vabatekstist on e-post ja telefon eemaldatud: " + (t0.kommentaar || ""));
  check(!JSON.stringify(rows.meil).includes(t0.sid || "§") && rows.meil.every((m) => Object.keys(m).sort().join() === "allikas,email,host,id,ts"), "e-posti tabel ei ole seotud tagasiside ega seansiga");
}
console.log(`\nAnalüütika põhimõtted (brauser ja andmebaas): ${ok} kontrolli läbis, ${fail} kukkus`);
process.exit(fail ? 1 : 0);
