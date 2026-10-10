// Kalkulaator /kalkulaator/: andmekihid, vaikeväärtused, muutmine ja taastamine, graafik, ligipääsetavus (mobiil ja arvuti).
// Kasutus: node tests/kalkulaator.mjs <URL>   (vaikimisi http://127.0.0.1:8787)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const url = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function a11y(page, label) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}
for (const [label, viewport] of [["mobiil 375 px", { width: 375, height: 800 }], ["arvuti 1280 px", { width: 1280, height: 900 }]]) {
  console.log("\nKalkulaator (" + label + ")");
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (new URL(r.url()).origin === url && r.status() >= 400) errors.push(r.status() + " " + r.url()); });
  const resp = await page.goto(url + "/arhiiv/kalkulaator/");
  check(resp.status() === 200, "leht avaneb");
  await page.waitForSelector("#answer strong");
  check((await page.textContent("h1")).includes("jätkub elu lõpuni"), "pealkiri");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "pole külgsuunalist kerimist");
  // vaikeväärtused ja allikamärgid
  check((await page.$$(".f")).length >= 14, "kõik sisendid on olemas (" + (await page.$$(".f")).length + ")");
  check(await page.evaluate(() => [...document.querySelectorAll(".f .src")].every((s) => s.querySelector(".chip"))), "igal sisendil on andmekihi märk");
  await page.click(".grp[data-g=vajadus] > button.h");
  check((await page.textContent("#s-need")).includes("Statistikaamet"), "kulude vaikeväärtus tuleb Statistikaametist");
  check((await page.textContent("#s-fond")).includes("Tuleva aruanded"), "fondi tasu tuleb Tuleva aruannetest");
  check(Number(await page.inputValue("#f-need")) === 790, "vajadus = 790 € (LE205)");
  // muutmine → "Sina" + taasta
  const before = await page.textContent("#answer");
  if (!(await page.isVisible("#p1Break"))) await page.click('.grp[data-g="riik"] > button.h');
  check(await page.isVisible("#p1Break table") && !(await page.isVisible("#f-p1Monthly")), "riikliku pensioni valemi lahkamine nähtav, käsitsi väli peidus");
  const pb0 = await page.textContent("#p1Break");
  await page.fill("#f-gross", "4500");
  check((await page.textContent("#p1Break")) !== pb0, "palga muutus muudab riikliku pensioni arvutust");
  check((await page.textContent("#s-gross")).includes("Sina"), "muudetud väli saab märgi „Sina“");
  check(await page.isVisible('[data-reset="gross"]'), "ilmub „Taasta“ nupp");
  check((await page.textContent("#answer")) !== before, "vastus muutub");
  await page.click('[data-reset="gross"]');
  await page.click('label[for="f-p1Mode-1"]');
  check((await page.isVisible("#f-p1Monthly")) && !(await page.isVisible("#p1Break table")), "käsitsi režiim: sisestusväli nähtav, tabel peidus");
  await page.click('label[for="f-p1Mode-0"]');
  check(Number(await page.inputValue("#f-gross")) === 2515 && (await page.textContent("#s-gross")).includes("Tuleva aruanded"), "taastamine toob tagasi vaikeväärtuse ja kihi");
  check((await page.textContent("#answer")) === before, "vastus on taas sama");
  // tootlus liugur (grupp on vaikimisi kokku volditud)
  check(await page.getAttribute(".grp[data-g=eeldus] > button.h", "aria-expanded") === "false", "Tootluse grupp on vaikimisi kokku volditud");
  await page.click(".grp[data-g=eeldus] > button.h");
  await page.fill("#f-realReturn", "0.04");
  check((await page.textContent("#o-realReturn")).includes("4"), "liugur näitab väärtust");
  // alguspunkt
  await page.click('[data-start="konto-naidis"]');
  check(Number(await page.inputValue("#f-sunniaasta")) === 1968 && (await page.inputValue("#f-pensionAge")) === "66", "Tuleva konto näide: sünniaasta 1968, pensioniiga 66");
  check((await page.textContent("#s-p2")).includes("Tuleva konto"), "II samba vara tuleb kontolt");
  check(Number(await page.inputValue("#f-realReturn")) === 0.02, "alguspunkti vahetus lähtestab ka tootluse");
  check((await page.$$("[data-start]")).length === 12, "alguspunkte 12: 10 persoonat + konto näide + tühi");
  await page.click('[data-start="mitte-single"]');
  check(Number(await page.inputValue("#f-gross")) === 1727 && Number(await page.inputValue("#f-p3")) === 6290 && Number(await page.inputValue("#f-p2")) === 0, "Single Pillar mitteliige: palk 1 727, III 6 290, II 0");
  check((await page.textContent("#startDetail")).includes("54 739"), "persoona eelandmed: inimeste arv nähtav");
  check((await page.getAttribute('[data-start="mitte-single"]', "aria-pressed")) === "true", "valitud persoon on märgitud");
  await page.click('[data-start="liige-gone"]');
  check(Number(await page.inputValue("#f-p2")) === 0 && Number(await page.inputValue("#f-p3")) === 0 && (await page.textContent("#answer")).length > 20, "Gone: vara 0 €, kalkulaator vastab ikka");
  await page.click('[data-start="konto-naidis"]');
  // stsenaariumid
  check((await page.$$("#tabs button")).length === 4, "neli väljamakse viisi");
  await page.click('#tabs button[data-id="C"]');
  check(await page.isVisible("#deferral"), "edasilükkamise valik ilmub viisi C puhul");
  await page.selectOption("#deferral", "3");
  check((await page.textContent("#compare")).includes("Kannab elu lõpuni"), "võrdlustabel on olemas");
  // graafik
  check((await page.$$("#chart rect")).length > 5, "graafikul on tulbad");
  await page.focus("#chart");
  const r0 = await page.textContent("#readout");
  await page.keyboard.press("ArrowRight");
  check((await page.textContent("#readout")) !== r0, "nooleklahv liigutab graafiku näitu");
  // kihid
  const layers = await page.$$eval("#kihid > li", (l) => l.map((x) => x.textContent));
  check(layers.length === 6 && layers.some((t) => t.includes("Statistikaamet")) && layers.some((t) => t.includes("Tuleva aruanded")), "andmekihtide loend (6 kihti)");
  check((await page.textContent("#rank")).includes("Eesti kogujatest"), "asukoht Eesti kogujate hulgas");
  // vigane sisend
  await page.fill("#f-sunniaasta", "1800");
  check((await page.textContent("#answer")).includes("1940"), "vale sünniaasta annab selge teate");
  await page.fill("#f-sunniaasta", "1980");
  check(await page.isVisible("#answer strong"), "toibub õigest sünniaastast");
  check(errors.length === 0, "ilma vigadeta" + (errors.length ? ": " + errors.join(" | ") : ""));
  await a11y(page, label);
  await page.close();
}
await browser.close();
console.log(failed ? "\n" + failed + " testi ebaõnnestus" : "\nKõik kalkulaatori testid läbitud");
process.exit(failed ? 1 : 0);
