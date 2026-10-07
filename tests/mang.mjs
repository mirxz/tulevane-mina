// Lauamängu suitsutest: kaaslane (L1), üksi (L2), paar ühes telefonis ja seltskond võrgutoas (L3).
// Kasutus: node tests/mang.mjs <URL>   (vaikimisi http://localhost:8787, vajab wrangler dev + kohalikku D1-te)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const url = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failed++; };
const seen = new Set();
async function a11y(page, label) {
  if (seen.has(label)) return; seen.add(label);
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
    return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", "));
  });
  check(r.length === 0, "ligipääsetavus: " + label + (r.length ? " → " + r.join(" | ") : ""));
}
async function newPage(ctx) {
  const page = await (ctx || browser).newPage({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("response", (r) => { const u = new URL(r.url()); if (u.origin === url && !u.pathname.startsWith("/api/tts") && r.status() >= 400 && r.status() !== 409) page.errors.push(r.status() + " " + u.pathname); });
  return page;
}
const has = (page, sel) => page.locator(sel).count().then((n) => n > 0);
// Võrgus võib küsitlus ekraani vahepeal ümber joonistada, seega lühike ootus ja vaikne vahelejätt.
const click = async (page, sel) => { try { await page.locator(sel).first().click({ timeout: page.online ? 3000 : 10000 }); } catch (e) { if (!page.online) throw e; } await page.waitForTimeout(page.online ? 150 : 40); };

// Üks samm: teeb nähtaval ekraanil mõistliku tegevuse. Tagastab vaate nime.
async function step(page, opts = {}) {
  if (await has(page, "[data-act=restart]")) return "lopp";
  if (await has(page, "[data-act=ring-yes]")) { await click(page, "[data-act=ring-yes]"); return "kone"; }
  if (await has(page, "[data-act=ring-end]")) { await a11y(page, "kõne"); await click(page, "[data-act=ring-end]"); page.called = true; return "kone"; }
  if (await has(page, "[data-act=ack]")) {
    await a11y(page, "vooru tulemus");
    if (!page.called && (await has(page, "[data-act=call]"))) { await click(page, "[data-act=call]"); return "kone"; }
    await click(page, "[data-act=ack]"); return "tulemus";
  }
  if (await has(page, "[data-act=uncover]")) { await a11y(page, "anna telefon"); await click(page, "[data-act=uncover]"); return "kate"; }
  if ((await has(page, "[data-act=event]")) || (await has(page, "[data-act=finish]:not([disabled])"))) {
    await a11y(page, "käik");
    if (await has(page, "[data-act=decide]")) await click(page, "[data-act=decide][data-o=b]");
    for (let i = 0; i < 3; i++) { try { await page.locator("[data-act=tok][data-d='1']:not([disabled])").first().click({ timeout: 2000 }); } catch {} await page.waitForTimeout(page.online ? 250 : 40); }
    if (opts.health && (await has(page, "[data-act=health]"))) { await click(page, "[data-act=health]"); check(await page.isVisible(".k-tervis"), "tervisekaart avaneb"); opts.health = false; }
    if (await has(page, "[data-act=agree]")) await click(page, "[data-act=agree]");
    if (await has(page, "[data-act=event]")) { await click(page, "[data-act=event]"); await page.locator("section .k-sundmus").first().waitFor({ timeout: 8000 }).catch(() => {}); }
    try { await page.locator("[data-act=finish]:not([disabled])").first().click({ timeout: 8000 }); }
    catch { check(false, "käiku ei saanud lõpetada: " + ((await page.locator("[role=alert]").allTextContents()).join(" ") || "nupp lukus") + " · sündmusnupp " + (await page.locator("[data-act=event]").count()) + " · " + (await page.textContent("#h-sy + *").catch(() => "")).slice(0, 80)); throw new Error("stop"); }
    await page.locator("[data-act=finish]").first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    return "kaik";
  }
  await page.waitForTimeout(200);
  return "ootan";
}

// ---------- L1 kaaslane ----------
console.log("\nL1 kaaslane");
{
  const page = await newPage();
  await page.goto(url + "/mang/kaaslane.html");
  await page.click("#b-maj"); check((await page.textContent("#o-maj")).length > 10, "majanduskaart");
  await page.selectOption("#s-era", "III"); await page.click("#b-sy"); check(await page.isVisible("#o-sy .k-sundmus"), "sündmuskaart ajastust III");
  await page.click("[data-ve=Seltskond]"); await page.click("#b-ve"); check(await page.isVisible("#o-ve .k-vestlus"), "vestluskaart");
  await page.selectOption("#e-age", "95"); await page.click("#b-ek"); check((await page.textContent("#o-ek")).includes("Elu lõpeb 95"), "elukell: 95 lõpetab");
  await page.selectOption("#e-age", "60"); await page.click("#b-ek"); check(/Elad edasi|Elu lõpeb/.test(await page.textContent("#o-ek")), "elukell veeretab");
  await page.fill("#t-nimi", "Mirko"); await page.click("#b-tel"); await page.click("#t-yes");
  check((await page.textContent("#o-tel")).includes("Tulevane Mirko") && (await page.textContent("#o-tel")).includes("PIN"), "kõne + turvarida");
  await a11y(page, "kaaslane");
  check(page.errors.length === 0, "vigu pole" + (page.errors.length ? ": " + page.errors.join(" | ") : ""));
  await page.close();
}

// ---------- L2 üksi ----------
console.log("\nL2 üksi");
{
  const page = await newPage();
  await page.goto(url + "/mang/");
  await page.waitForSelector("[data-act=start]");
  await a11y(page, "seadistus");
  await page.selectOption("[data-in=start][data-i='0']", "5");
  check(await page.isVisible("[data-in=c-vanus]"), "„Minu enda elu“ avab väljad");
  await page.fill("[data-in=c-vanus]", "45"); await page.fill("[data-in=name]", "Mirko");
  await click(page, "[data-act=start]");
  check((await page.textContent("h2")).includes("Mirko, 45"), "stardib 45-aastasena");
  const opts = { health: true };
  let v, n = 0, turns = 0;
  while ((v = await step(page, opts)) !== "lopp" && n++ < 200) if (v === "kaik") turns++;
  check(v === "lopp", `mäng lõppes (${turns} käiku)`);
  check(await page.isVisible("table.score"), "punktitabel");
  await a11y(page, "lõpp");
  check(page.called === true, "tulevane mina helistas");
  check(page.errors.length === 0, "vigu pole" + (page.errors.length ? ": " + page.errors.join(" | ") : ""));
  await page.close();
}

// ---------- L3 paar ühes telefonis ----------
console.log("\nL3 paar, üks telefon");
{
  const page = await newPage();
  await page.goto(url + "/mang/");
  await page.waitForSelector("[data-act=start]");
  await click(page, "[data-act=mode][data-o=paar]");
  check(await page.isVisible("[data-act=device][data-o=tuba]"), "seadmevalik paaril");
  await click(page, "[data-act=start]");
  check(await page.isVisible("[data-act=uncover]"), "kate enne käiku");
  let v, n = 0, covers = 0, agreed = false;
  while ((v = await step(page)) !== "lopp" && n++ < 400) { if (v === "kate") covers++; if (!agreed && (await page.locator("text=Kokkulepe sõlmitud").count())) agreed = true; }
  check(v === "lopp", `paari mäng lõppes (${covers} telefoni üleandmist)`);
  check((await page.textContent("main")).includes("Kahe peale"), "paari eesmärk");
  check(page.errors.length === 0, "vigu pole" + (page.errors.length ? ": " + page.errors.join(" | ") : ""));
  await page.close();
}

// ---------- L3 seltskond võrgutoas ----------
console.log("\nL3 seltskond, võrgutuba (3 telefoni)");
{
  const pages = [];
  for (let i = 0; i < 3; i++) pages.push(await newPage(await browser.newContext()));
  const [a, b, c] = pages;
  for (const p of pages) p.online = true;
  await a.goto(url + "/mang/");
  await a.waitForSelector("[data-act=start]");
  await click(a, "[data-act=mode][data-o=seltskond]");
  await click(a, "[data-act=device][data-o=tuba]");
  await a.fill("[data-in=name][data-i='0']", "Anu"); await a.fill("[data-in=name][data-i='1']", "Bert"); await a.fill("[data-in=name][data-i='2']", "Cärol");
  await click(a, "[data-act=start]");
  await a.waitForSelector(".code");
  const code = (await a.textContent(".code")).trim();
  check(/^[A-Z]{5}$/.test(code), "tuba loodud: " + code);
  await a11y(a, "toa kood");
  await click(a, "[data-act=seat][data-id=p1]");
  await b.goto(url + "/mang/?tuba=" + code); await b.waitForSelector("[data-act=seat]");
  check(await b.isDisabled("[data-act=seat][data-id=p1]"), "võetud koht on lukus");
  await click(b, "[data-act=seat][data-id=p2]");
  await c.goto(url + "/mang/"); await c.waitForSelector("#kood"); await c.fill("#kood", code.toLowerCase()); await click(c, "[data-act=join]");
  await c.waitForSelector("[data-act=seat]"); await click(c, "[data-act=seat][data-id=p3]");
  check(await c.isVisible(".k-vestlus"), "ühine vestluskaart näha");
  // mängime 4 vooru korraga kolmes telefonis
  let round = 1, guard = 0;
  while (round < 5 && guard++ < 300) {
    await Promise.all(pages.map((p) => step(p)));
    round = Number(((await a.textContent("#chip")).match(/Voor (\d+)/) || [0, 1])[1]);
    if (await has(a, "[data-act=restart]")) break;
  }
  check(round >= 5 || (await has(a, "[data-act=restart]")), "kolm telefoni jõudsid koos 5. vooru");
  // reload: koht jääb meelde
  await b.reload(); await b.waitForTimeout(800);
  check(!(await has(b, "[data-act=seat]")), "pärast värskendamist on koht meeles");
  const st = await (await fetch(url + "/api/mang/tuba/" + code)).json();
  check(st.ver > 10 && st.olek.players.length === 3, `toa olek serveris (versioon ${st.ver})`);
  const bad = await fetch(url + "/api/mang/tuba/" + code, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ver: 1, olek: {} }) });
  check(bad.status === 409, "vana versiooniga kirjutamine → 409");
  for (const p of pages) check(p.errors.length === 0, "vigu pole" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));
}

await browser.close();
console.log(failed ? `\n${failed} kontrolli kukkus läbi` : "\nKõik korras");
process.exit(failed ? 1 : 0);
