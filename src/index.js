// Tulevane Mina – Worker.
// /api/tts  → eesti kõnesüntees (TartuNLP Neurokõne) tulevase mina kõne jaoks.
// /api/s    → anonüümsed mängusündmused ja tagasiside (Cloudflare D1, binding DB). Otsus: otsuste logi 7.10.
// /tulemused → variantide võrdlus (parooliga, Cloudflare secret TULEMUSED_VOTI); /tulemused.csv → vastused CSV-na.
// Parool on valikuline: kui Cloudflare secret PROTO_VOTI on seatud, küsib sait parooli; ilma selleta on sait avatud.
// Heidi Reinson andis 8.10 loa häkatonil avalikult testida (otsuste logi). /tulemused kasutab alati eraldi parooli TULEMUSED_VOTI.
// /api/mang/tuba → lauamängu võrgutoad (sama D1, tabel mang_toad): olek JSON-ina, versiooniga, et samaaegsed käigud ei kirjutaks üksteist üle.
// /api/t    → lõpu tagasiside leht /tagasiside/: anonüümsed vastused (täitmine, vanus, uus teadmine, muutus, vaba kommentaar).
// /api/r    → õnneratta maandumisleht /ratas/: anonüümsed vastused ja eraldi e-posti tabel (ei seo sid-iga).
// /api/e    → mõõtmine (10.10): avaleht, elukaar ja tagasiside lehe sündmused (maandumine, seansi sammud, valikute klikid). Anonüümne, aeg UTC-s, tulemustel Tallinna aja järgi.
// Kõik muu → staatilised failid kaustast public/.

import { sundmusteVaade, kutseVaade, tagasisideKanaliVaade } from "./moot.js";

const TTS_URL = "https://api.tartunlp.ai/text-to-speech/v2";
const SPEAKERS = new Set(["albert", "indrek", "kalev", "kylli", "lee", "liivika", "luukas", "mari", "meelis", "peeter", "tambet", "vesta"]);
const MAX_CHARS = 400; // üks kõne, mitte terve raamat

// Toodangu aadressid (10.10): sama Worker vastab nii workers.dev kui ka oma domeeni alt.
// Tulemuste leht koondab kõigi toodangu aadresside vastused; eelvaated jäävad eraldi.
const TOODANG = ["mina.tulevane.workers.dev", "tulevanemina.ee", "www.tulevanemina.ee"];
const hostid = (url) => (TOODANG.includes(url.hostname) ? TOODANG : [url.hostname]);
const hostIn = (url, col = "host") => col + " IN (" + hostid(url).map(() => "?").join(", ") + ")";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isResults = url.pathname === "/saada" || url.pathname === "/tulemused" || url.pathname === "/tulemused.csv" || url.pathname === "/tulemused-meilid.csv" || url.pathname === "/tulemused-tagasiside.csv" || url.pathname === "/tulemused-ratas.csv" || url.pathname === "/tulemused-plaan.csv";
    // Kutsekirja klikk (10.10): avalehe ?k=kutse-a|b|c loetakse enne parooli, et klikk läheks kirja ka siis, kui sait on parooliga.
    if (url.pathname === "/" && request.method === "GET" && KUTSE_K.test(url.searchParams.get("k") || "")) await logKlikk(env, url);
    if (!isResults) { const gate = protoGate(request, env, url); if (gate) return gate; }
    // Lauamäng kolis arhiivi (9.10). Vana aadress (ka prinditud QR-kood) annab teadlikult veateate, mitte ei suuna edasi.
    if (url.pathname === "/mang" || url.pathname.startsWith("/mang/")) return gone();
    // Vanad aadressid kolisid 10.10 arhiivi (avalehele tuli Kadi uus leht). Ka prinditud QR-koodid (/ratas/?k=a5) jäävad tööle, päring säilib.
    const kolis = arhiiviAadress(url);
    if (kolis) return Response.redirect(url.origin + kolis + url.search, 302);
    if (url.pathname === "/api/tts") return tts(request, url);
    if (url.pathname === "/api/s") return collect(request, env, url);
    if (url.pathname === "/api/p") return collectPlaan(request, env, url);
    if (url.pathname === "/api/r") return collectRatas(request, env, url);
    if (url.pathname === "/api/t") return collectTagasiside(request, env, url);
    if (url.pathname === "/api/e") return collectSundmus(request, env, url);
    if (url.pathname.startsWith("/api/mang/tuba")) return room(request, env, url);
    if (url.pathname === "/tulemused-meilid.csv") return meilidCsv(request, env);
    if (url.pathname === "/tulemused-tagasiside.csv") return tagasisideCsv(request, env);
    if (url.pathname === "/tulemused-ratas.csv") return ratasCsv(request, env);
    if (url.pathname === "/tulemused-plaan.csv") return plaanCsv(request, env);
    if (url.pathname === "/tulemused" || url.pathname === "/tulemused.csv") return results(request, env, url);
    if (url.pathname === "/saada") return saada(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

// Vana aadress → uus aadress arhiivis (null, kui aadress pole kolinud).
function arhiiviAadress(url) {
  const p = url.pathname;
  for (const nimi of ["ratas", "kalkulaator", "plaan"]) {
    if (p === "/" + nimi || p.startsWith("/" + nimi + "/")) return "/arhiiv" + p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prototüübi parool (HTTP Basic auth, kasutajanimi ükskõik mis). Tagastab vastuse, kui ligipääs pole lubatud.
function protoGate(request, env, url) {
  if (!env.PROTO_VOTI) return null; // parool pole seatud: sait on avatud
  if (checkBasic(request, env.PROTO_VOTI)) return null;
  return new Response("Tulevane Mina on parooliga.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "www-authenticate": 'Basic realm="Tulevane Mina", charset="UTF-8"', "x-robots-tag": "noindex" } });
}
function checkBasic(request, secret) {
  const h = request.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  try {
    const raw = new TextDecoder().decode(Uint8Array.from(atob(h.slice(6)), (c) => c.charCodeAt(0)));
    return raw.split(":").slice(1).join(":") === secret;
  } catch { return false; }
}

async function tts(request, url) {
  let text, speaker, speed;
  if (request.method === "GET" && url.searchParams.has("proov")) {
    // Brauseris kiire kontroll: /api/tts?proov=1&haal=albert
    text = "Tere! Siin räägib sinu tulevane mina.";
    speaker = (url.searchParams.get("haal") || "albert").toLowerCase();
    speed = 0.9;
  } else if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ viga: "Vigane JSON" }, 400); }
    text = String(body.text || "").trim();
    speaker = String(body.speaker || "albert").toLowerCase();
    speed = Number(body.speed) || 1;
  } else {
    return json({ viga: "Kasuta POST-päringut või ?proov=1" }, 405);
  }

  if (!text) return json({ viga: "Tekst puudub" }, 400);
  if (text.length > MAX_CHARS) return json({ viga: `Tekst on pikem kui ${MAX_CHARS} märki` }, 400);
  if (!SPEAKERS.has(speaker)) return json({ viga: "Tundmatu hääl", lubatud: [...SPEAKERS] }, 400);
  speed = Math.min(1.3, Math.max(0.7, speed));

  let upstream;
  try {
    upstream = await fetch(TTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/wav" },
      body: JSON.stringify({ text, speaker, speed }),
    });
  } catch (e) {
    return json({ viga: "Kõnesünteesiga ei saanud ühendust" }, 502);
  }
  if (!upstream.ok) return json({ viga: "Kõnesüntees vastas veaga", staatus: upstream.status }, 502);

  return new Response(upstream.body, {
    headers: { "content-type": "audio/wav", "cache-control": "public, max-age=3600" },
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

// ---------------------------------------------------------------------------
// Tagasiside: ainult lubatud väärtused, IP-d ega mängu sisendeid ei salvestata.
const GAMES = new Set(["panus", "kingitus", "kupong"]);
const ASSIGN = new Set(["panus", "kingitus", "kupong", "link"]);
const EVENTS = new Set(["start", "reveal", "feedback"]);
const ENUMS = {
  tegevus: new Set(["fonditasu", "pensioniiga", "lahedane", "midagi"]),
  tunne: new Set(["aus", "manipuleeriv", "eioska", ""]),
  segment: new Set(["eimotle", "kogunteadmata", "saastumaar", "optimeerija", "parand", ""]),
};
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS sundmused (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, sid TEXT, ev TEXT, loos TEXT, mang TEXT)",
  "CREATE TABLE IF NOT EXISTS vastused (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, sid TEXT, loos TEXT, mang TEXT, moistis INTEGER, vastus TEXT, moju INTEGER, tegevus TEXT, tunne TEXT, segment TEXT, eelistus TEXT, meelde TEXT, mangitud TEXT)",
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((q) => db.prepare(q)));
  schemaReady = true;
}
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

async function collect(request, env, url) {
  if (request.method !== "POST") return json({ viga: "Kasuta POST-päringut" }, 405);
  if (!env.DB) return json({ viga: "Andmebaas pole seadistatud" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ viga: "Vigane JSON" }, 400); }
  const sid = clean(b.sid, 40), ev = clean(b.ev, 12), loos = clean(b.loos, 12), mang = clean(b.mang, 12);
  if (!/^[a-z0-9-]{8,40}$/i.test(sid) || !EVENTS.has(ev) || !ASSIGN.has(loos) || !GAMES.has(mang)) return json({ viga: "Vigased väärtused" }, 400);
  const ts = new Date().toISOString(), host = url.hostname;
  await ensureSchema(env.DB);
  const stmts = [env.DB.prepare("INSERT INTO sundmused (ts, host, sid, ev, loos, mang) VALUES (?, ?, ?, ?, ?, ?)").bind(ts, host, sid, ev, loos, mang)];
  if (ev === "feedback") {
    const f = b.vastus || {};
    const moju = Number(f.moju);
    const tegevus = clean(f.tegevus, 20), tunne = clean(f.tunne, 20), segment = clean(f.segment, 20);
    const mangitud = String(f.mangitud || "").split(",").filter((g) => GAMES.has(g)).join(",");
    const eelistus = GAMES.has(f.eelistus) ? f.eelistus : "";
    if (!(moju >= 1 && moju <= 5) || !ENUMS.tegevus.has(tegevus) || !ENUMS.tunne.has(tunne) || !ENUMS.segment.has(segment)) return json({ viga: "Vigane vastus" }, 400);
    stmts.push(env.DB.prepare("INSERT INTO vastused (ts, host, sid, loos, mang, moistis, vastus, moju, tegevus, tunne, segment, eelistus, meelde, mangitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(ts, host, sid, loos, mang, f.moistis ? 1 : 0, clean(f.vastus, 40), moju, tegevus, tunne, segment, eelistus, clean(f.meelde, 280), mangitud));
  }
  await env.DB.batch(stmts);
  return json({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Tulemused: HTTP Basic auth, parool = secret TULEMUSED_VOTI (kasutajanimi ükskõik mis).
function authorized(request, env) {
  if (!env.TULEMUSED_VOTI) return false;
  const h = request.headers.get("authorization") || "";
  return checkBasic(request, env.TULEMUSED_VOTI);
}
const NAMES = { panus: "Pensioniratas", kingitus: "Kingitus", kupong: "Elu-kupong" };
const SEGN = { eimotle: "Ei mõtle pensionile", kogunteadmata: "Kogub, aga ei tea fonde", saastumaar: "Teab säästumäära, tahab nõu", optimeerija: "Optimeerib portfelli", parand: "Mõtleb pärandile", "": "Ei vastanud" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pc = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–");

async function results(request, env, url) {
  if (!env.TULEMUSED_VOTI) return new Response("Tulemuste parool (secret TULEMUSED_VOTI) pole seadistatud.", { status: 503 });
  if (!authorized(request, env)) return new Response("Sisesta parool", { status: 401, headers: { "www-authenticate": 'Basic realm="Tulevane Mina tulemused", charset="UTF-8"' } });
  if (!env.DB) return new Response("Andmebaas pole seadistatud.", { status: 503 });
  await ensureSchema(env.DB);
  const all = url.searchParams.get("koik") === "1";
  const where = all ? "" : " WHERE " + hostIn(url);
  const bindHost = (st) => (all ? st : st.bind(...hostid(url)));
  const ans = (await bindHost(env.DB.prepare("SELECT * FROM vastused" + where + " ORDER BY ts")).all()).results;
  if (url.pathname.endsWith(".csv")) {
    const cols = ["ts", "host", "loos", "mang", "moistis", "vastus", "moju", "tegevus", "tunne", "segment", "eelistus", "mangitud", "meelde"];
    const csv = [cols.join(",")].concat(ans.map((r) => cols.map((c) => '"' + String(r[c] ?? "").replace(/"/g, '""') + '"').join(","))).join("\n");
    return new Response("\ufeff" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="tulevane-mina-vastused.csv"' } });
  }
  const evs = (await bindHost(env.DB.prepare("SELECT mang, ev, loos, COUNT(DISTINCT sid) AS n FROM sundmused" + where + " GROUP BY mang, ev, loos")).all()).results;
  const g = {};
  for (const k of Object.keys(NAMES)) g[k] = { start: 0, reveal: 0, loosStart: 0, ans: [] };
  for (const e of evs) { if (!g[e.mang]) continue; if (e.ev === "start") { g[e.mang].start += e.n; if (e.loos === e.mang) g[e.mang].loosStart += e.n; } if (e.ev === "reveal") g[e.mang].reveal += e.n; }
  const loosed = (await bindHost(env.DB.prepare("SELECT loos, COUNT(DISTINCT sid) AS n FROM sundmused" + where + (all ? " WHERE" : " AND") + " ev = 'start' GROUP BY loos")).all()).results;
  const loosN = Object.fromEntries(loosed.map((r) => [r.loos, r.n]));
  for (const a of ans) if (g[a.mang]) g[a.mang].ans.push(a);
  const pref = {}; for (const a of ans) if (a.eelistus) pref[a.eelistus] = (pref[a.eelistus] || 0) + 1;
  const row = (label, f) => "<tr><th>" + label + "</th>" + Object.keys(NAMES).map((k) => "<td>" + f(g[k], k) + "</td>").join("") + "</tr>";
  const share = (arr, pred) => pc(arr.filter(pred).length, arr.length);
  const avg = (arr) => (arr.length ? (arr.reduce((s, a) => s + a.moju, 0) / arr.length).toFixed(1).replace(".", ",") : "–");
  const score = (G) => (G.ans.length ? Math.round(100 * G.ans.filter((a) => a.moistis && a.tegevus !== "midagi").length / G.ans.length) + "%" : "–");
  let table = "<table><tr><th></th>" + Object.values(NAMES).map((n) => "<th>" + n + "</th>").join("") + "</tr>";
  table += row("Alustas mängu", (G) => G.start);
  table += row("Jõudis tõe-ekraanile", (G) => G.reveal + " (" + pc(G.reveal, G.start) + ")");
  table += row("Andis tagasisidet", (G) => G.ans.length + " (" + pc(G.ans.length, G.reveal) + ")");
  table += row("Loositi / jäi loositud mängu juurde", (G, k) => (loosN[k] || 0) + " / " + pc(G.loosStart, loosN[k] || 0));
  table += row("<b>Sai aru ja tegutseks</b>", (G) => "<b>" + score(G) + "</b>");
  table += row("Vastas arusaamise küsimusele õigesti", (G) => share(G.ans, (a) => a.moistis));
  table += row("Pani mõtlema (1–5)", (G) => avg(G.ans));
  table += row("Teeks midagi", (G) => share(G.ans, (a) => a.tegevus !== "midagi"));
  table += row("… kontrolliks fonditasu", (G) => share(G.ans, (a) => a.tegevus === "fonditasu"));
  table += row("… vaataks pensioniiga", (G) => share(G.ans, (a) => a.tegevus === "pensioniiga"));
  table += row("… räägiks lähedasega", (G) => share(G.ans, (a) => a.tegevus === "lahedane"));
  table += row("Tundus aus", (G) => share(G.ans, (a) => a.tunne === "aus"));
  table += row("Tundus manipuleeriv", (G) => share(G.ans, (a) => a.tunne === "manipuleeriv"));
  table += row("Eelistati võrdluses", (G, k) => pref[k] || 0);
  table += "</table>";
  let seg = "<table><tr><th>Segment</th>" + Object.values(NAMES).map((n) => "<th>" + n + "</th>").join("") + "</tr>";
  for (const [sk, sn] of Object.entries(SEGN)) {
    seg += "<tr><th>" + sn + "</th>" + Object.keys(NAMES).map((k) => { const A = g[k].ans.filter((a) => a.segment === sk); return "<td>" + (A.length ? A.length + " · " + score({ ans: A }) : "–") + "</td>"; }).join("") + "</tr>";
  }
  seg += "</table>";
  const quotes = ans.filter((a) => a.meelde).slice(-60).reverse().map((a) => "<li><span>" + NAMES[a.mang] + "</span> " + esc(a.meelde) + "</li>").join("");
  const html = `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tulevane Mina · tulemused</title>
<style>body{font-family:Roboto,Arial,sans-serif;color:#293036;margin:0;padding:16px;background:#fff}main{max-width:900px;margin:0 auto;display:grid;gap:20px}h1,h2{font-family:Merriweather,Georgia,serif;color:#002f63;margin:0}h1{font-size:26px}h2{font-size:19px}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:6px 8px;border-bottom:1px solid #e0e6ec;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}th:first-child{text-align:left;font-weight:400;white-space:normal}tr:first-child th{font-weight:600;color:#002f63}
.small{font-size:13px;color:#6b7074}ul{padding-left:18px;display:grid;gap:6px}li span{font-size:12px;color:#6b7074;margin-right:6px}a{color:#006ce6}main{grid-template-columns:minmax(0,1fr)}.hbwrap{margin:10px 0}.hbt{margin:0 0 4px}.hb{display:flex;gap:2px;align-items:flex-end}.hb>div{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}.hb .bar{height:72px;width:100%;display:flex;align-items:flex-end;border-bottom:1px solid #c9d1d9}.hb i{display:block;width:100%;background:#006ce6;min-height:1px}.hb .n{font-size:10px;height:12px;line-height:12px;color:#293036}.hb .h{font-size:10px;color:#6b7074}</style></head><body><main>
<h1>Tulevane Mina · tulemused</h1>
<p class="small">${all ? "Kõik keskkonnad (ka eelvaated)." : "Ainult " + esc(hostid(url).join(", ")) + "."} Vastuseid kokku ${ans.length}. Väikese valimi juures on erinevused suunavad, mitte statistiliselt olulised. <a href="?${all ? "" : "koik=1"}">${all ? "Näita ainult seda keskkonda" : "Näita ka eelvaateid"}</a> · CSV: <a href="/tulemused-tagasiside.csv">tagasiside</a> · <a href="/tulemused-ratas.csv">ratas</a> · <a href="/tulemused-plaan.csv">plaan</a> · <a href="/tulemused-meilid.csv">e-postid</a> · <a href="/tulemused.csv${all ? "?koik=1" : ""}">varasemad mängud</a></p>
${await mootTulemused(env, url, all)}
${await tagasisideTulemused(env, url, all)}
${await ratasTulemused(env, url, all)}
${await plaanTulemused(env, url, all)}
<section><h2>Varasemad mängud: variandid kõrvuti</h2><p class="small">Peamine mõõdik: osa vastajatest, kes vastas arusaamise küsimusele õigesti ja valis mõne tegevuse.</p><div class="wrap">${table}</div></section>
<section><h2>Segmentide kaupa</h2><p class="small">Vastajaid · peamine mõõdik</p><div class="wrap">${seg}</div></section>
<section><h2>Mis jäi meelde</h2><ul>${quotes || "<li>Veel pole.</li>"}</ul></section>
</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// ---------------------------------------------------------------------------
// Lauamängu võrgutoad. Ainult mänguolek (nimed, mängu ressursid); isikuandmeid ega IP-sid ei salvestata. Toad kustuvad 3 päevaga.
const ROOM_ABC = "ABCDEFGHJKMNPRSTUVXYZ";
const ROOM_MAX = 200000;
let roomReady = false;
async function ensureRoom(db) {
  if (roomReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS mang_toad (kood TEXT PRIMARY KEY, ver INTEGER NOT NULL, olek TEXT NOT NULL, ts TEXT NOT NULL)").run();
  roomReady = true;
}
async function room(request, env, url) {
  if (!env.DB) return json({ viga: "Andmebaas pole seadistatud" }, 503);
  await ensureRoom(env.DB);
  const code = (url.pathname.split("/")[4] || "").toUpperCase();
  const now = new Date().toISOString();
  const readBody = async () => { const t = await request.text(); if (t.length > ROOM_MAX) throw new Error("liiga suur"); return JSON.parse(t); };
  if (!code && request.method === "POST") {
    let b; try { b = await readBody(); } catch { return json({ viga: "Vigane olek" }, 400); }
    await env.DB.prepare("DELETE FROM mang_toad WHERE ts < ?").bind(new Date(Date.now() - 3 * 864e5).toISOString()).run();
    for (let i = 0; i < 8; i++) {
      const k = Array.from(crypto.getRandomValues(new Uint8Array(5)), (x) => ROOM_ABC[x % ROOM_ABC.length]).join("");
      const r = await env.DB.prepare("INSERT OR IGNORE INTO mang_toad (kood, ver, olek, ts) VALUES (?, 1, ?, ?)").bind(k, JSON.stringify(b.olek ?? null), now).run();
      if (r.meta.changes) return json({ kood: k, ver: 1 }, 200);
    }
    return json({ viga: "Ei leidnud vaba koodi" }, 500);
  }
  if (!/^[A-Z]{5}$/.test(code)) return json({ viga: "Vigane toa kood" }, 400);
  if (request.method === "GET") {
    const r = await env.DB.prepare("SELECT ver, olek FROM mang_toad WHERE kood = ?").bind(code).first();
    if (!r) return json({ viga: "Tuba ei leitud" }, 404);
    const known = Number(url.searchParams.get("ver"));
    if (known && known === r.ver) return json({ ver: r.ver, muutus: false }, 200);
    return new Response('{"ver":' + r.ver + ',"muutus":true,"olek":' + r.olek + "}", { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  if (request.method === "PUT") {
    let b; try { b = await readBody(); } catch { return json({ viga: "Vigane olek" }, 400); }
    const ver = Number(b.ver);
    const r = await env.DB.prepare("UPDATE mang_toad SET ver = ver + 1, olek = ?, ts = ? WHERE kood = ? AND ver = ?").bind(JSON.stringify(b.olek ?? null), now, code, ver).run();
    if (!r.meta.changes) {
      const cur = await env.DB.prepare("SELECT ver FROM mang_toad WHERE kood = ?").bind(code).first();
      return json({ viga: cur ? "Keegi jõudis enne" : "Tuba ei leitud", ver: cur?.ver }, cur ? 409 : 404);
    }
    return json({ ver: ver + 1 }, 200);
  }
  return json({ viga: "Lubatud: POST, GET, PUT" }, 405);
}

// ---------------------------------------------------------------------------
// Plaani prototüüp (9.10): kolm vaadet. Salvestame ainult vaate, sündmuse ja tagasiside, mitte kasutaja summasid ega vanust.
const VAADE = new Set(["kalk", "kaar", "korv"]);
const PLOOS = new Set(["kalk", "kaar", "korv", "link"]);
const P_EV = new Set(["start", "feedback", "share"]);
const P_ENUM = { katab: new Set(["jah", "ei", "eitea"]), hirm: new Set(["otsa", "elamata", "molemad", "kumbki"]) };
const P_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS plaan_sundmused (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, sid TEXT, ev TEXT, loos TEXT, vaade TEXT, enne INTEGER, allikas TEXT)",
  "CREATE TABLE IF NOT EXISTS plaan_vastused (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, sid TEXT, loos TEXT, vaade TEXT, katab TEXT, oige INTEGER, enne INTEGER, kindlus INTEGER, hirm TEXT, eelistus TEXT, nahtud TEXT, kommentaar TEXT, allikas TEXT)",
];
let pReady = false;
async function ensurePlaan(db) {
  if (pReady) return;
  await db.batch(P_SCHEMA.map((q) => db.prepare(q)));
  // varem loodud tabelitele lisame allika veeru (kui see juba olemas, ignoreerime viga)
  for (const t of ["plaan_sundmused", "plaan_vastused"]) { try { await db.prepare("ALTER TABLE " + t + " ADD COLUMN allikas TEXT").run(); } catch {} }
  pReady = true;
}
async function collectPlaan(request, env, url) {
  if (request.method !== "POST") return json({ viga: "Kasuta POST-päringut" }, 405);
  if (!env.DB) return json({ viga: "Andmebaas pole seadistatud" }, 503);
  let b; try { b = await request.json(); } catch { return json({ viga: "Vigane JSON" }, 400); }
  const sid = clean(b.sid, 40), ev = clean(b.ev, 12), loos = clean(b.loos, 12), vaade = clean(b.vaade, 12);
  const alk = String(b.alk || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  if (!/^[a-z0-9-]{8,40}$/i.test(sid) || !P_EV.has(ev) || !PLOOS.has(loos) || !VAADE.has(vaade)) return json({ viga: "Vigased väärtused" }, 400);
  const n15 = (v) => { const n = Number(v); return n >= 1 && n <= 5 ? Math.round(n) : null; };
  const ts = new Date().toISOString(), host = url.hostname;
  await ensurePlaan(env.DB);
  const st = [env.DB.prepare("INSERT INTO plaan_sundmused (ts, host, sid, ev, loos, vaade, enne, allikas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(ts, host, sid, ev, loos, vaade, n15(b.enne), alk)];
  if (ev === "feedback") {
    const f = b.vastus || {};
    if (!P_ENUM.katab.has(f.katab) || !P_ENUM.hirm.has(f.hirm) || !n15(f.kindlus)) return json({ viga: "Vigane vastus" }, 400);
    const nahtud = String(f.nahtud || "").split(",").filter((v) => VAADE.has(v)).join(",");
    st.push(env.DB.prepare("INSERT INTO plaan_vastused (ts, host, sid, loos, vaade, katab, oige, enne, kindlus, hirm, eelistus, nahtud, kommentaar, allikas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(ts, host, sid, loos, vaade, f.katab, f.oige ? 1 : 0, n15(f.enne), n15(f.kindlus), f.hirm, VAADE.has(f.eelistus) ? f.eelistus : "", nahtud, clean(f.kommentaar, 280), alk));
  }
  await env.DB.batch(st);
  return json({ ok: true }, 200);
}
async function plaanTulemused(env, url, all) {
  await ensurePlaan(env.DB);
  const where = all ? "" : " WHERE " + hostIn(url);
  const bind = (q) => (all ? q : q.bind(...hostid(url)));
  const ans = (await bind(env.DB.prepare("SELECT * FROM plaan_vastused" + where + " ORDER BY ts")).all()).results;
  const starts = (await bind(env.DB.prepare("SELECT vaade, COUNT(DISTINCT sid) AS n FROM plaan_sundmused" + where + (all ? " WHERE" : " AND") + " ev = 'start' GROUP BY vaade")).all()).results;
  const sn = Object.fromEntries(starts.map((r) => [r.vaade, r.n]));
  const PN = { kalk: "Kalkulaator", kaar: "Elukaar", korv: "Ostukorv" };
  const cnt = async (q) => (await bind(env.DB.prepare(q)).all()).results;
  const sidn = (await cnt("SELECT COUNT(DISTINCT sid) AS n FROM plaan_sundmused" + where))[0]?.n || 0;
  const jagas = (await cnt("SELECT COUNT(DISTINCT sid) AS n FROM plaan_sundmused" + where + (all ? " WHERE" : " AND") + " ev = 'share'"))[0]?.n || 0;
  const kanalid = await cnt("SELECT COALESCE(NULLIF(allikas, ''), 'otse') AS k, COUNT(DISTINCT sid) AS n FROM plaan_sundmused" + where + (all ? " WHERE" : " AND") + " ev = 'start' GROUP BY 1 ORDER BY n DESC");
  const lopet = {}; for (const a of ans) { const k = a.allikas || "otse"; lopet[k] = (lopet[k] || 0) + 1; }
  const kt = "<table><tr><th>Kanal (?k=…)</th><th>Alustas</th><th>Vastas</th></tr>" + (kanalid.map((r) => "<tr><th>" + esc(r.k) + "</th><td>" + r.n + "</td><td>" + (lopet[r.k] || 0) + "</td></tr>").join("") || "<tr><td colspan=3>Veel pole.</td></tr>") + "</table>";
  const G = {}; for (const k of Object.keys(PN)) G[k] = ans.filter((a) => a.vaade === k);
  const avg = (A, f) => { const v = A.map(f).filter((x) => x); return v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1).replace(".", ",") : "–"; };
  const share = (A, f) => pc(A.filter(f).length, A.length);
  const pref = {}; for (const a of ans) if (a.eelistus) pref[a.eelistus] = (pref[a.eelistus] || 0) + 1;
  const row = (l, f) => "<tr><th>" + l + "</th>" + Object.keys(PN).map((k) => "<td>" + f(G[k], k) + "</td>").join("") + "</tr>";
  let t = "<table><tr><th></th>" + Object.values(PN).map((n) => "<th>" + n + "</th>").join("") + "</tr>";
  t += row("Avas vaate", (A, k) => sn[k] || 0);
  t += row("Vastas", (A) => A.length);
  t += row("<b>Vastas „katab?“ õigesti</b>", (A) => "<b>" + share(A, (a) => a.oige) + "</b>");
  t += row("Ei teadnud", (A) => share(A, (a) => a.katab === "eitea"));
  t += row("Kindlus enne → pärast (1–5)", (A) => avg(A, (a) => a.enne) + " → " + avg(A, (a) => a.kindlus));
  t += row("Hirm: raha saab otsa", (A) => share(A, (a) => a.hirm === "otsa"));
  t += row("Hirm: jään elamata", (A) => share(A, (a) => a.hirm === "elamata"));
  t += row("Eelistati võrdluses", (A, k) => pref[k] || 0);
  t += "</table>";
  const q = ans.filter((a) => a.kommentaar).slice(-60).reverse().map((a) => "<li><span>" + PN[a.vaade] + "</span> " + esc(a.kommentaar) + "</li>").join("");
  return `<section><h2>Seis praegu</h2><p style="font-size:28px;line-height:36px;margin:0"><b>${ans.length}</b> lõpetanud · ${sidn} seadet alustanud · ${jagas} jaganud</p></section><section><h2>Kanalid</h2><p class="small">Lisa linkidele <code>?k=fb</code>, <code>?k=reklaam</code>, <code>?k=lkd</code>, <code>?k=tuleva</code>. Jagamisnupu link lisab <code>jagatud</code>.</p><div class="wrap">${kt}</div></section><section><h2>Plaani vaated (9.10)</h2><p class="small">Peamine mõõdik: vastas küsimusele „Kas plaan katab vajaduse elu lõpuni?“ mudeliga sama vastuse. Vastuseid ${ans.length}.</p><div class="wrap">${t}</div></section><section><h2>Mis aitas või segas</h2><ul>${q || "<li>Veel pole.</li>"}</ul></section>`;
}

// ---------------------------------------------------------------------------
// Õnneratas (/arhiiv/ratas/): seitse küsimust, esimene keerutus määrab järjekorra. Vastused anonüümsed (sid on ainult seansi juhuslik tunnus).
// E-post läheb eraldi tabelisse ilma sid-ita, et seda ei saaks vastustega siduda.
const R_EV = new Set(["spin", "answer", "done", "email"]);
const R_VALIK = new Set(["tean", "umbes", "eitea"]);
const R_NIMED = ["Kuu kulud", "Riiklik pension", "II ja III sammas", "Säästud", "Kui kaua elad", "Auto ja kodu", "Unistused"];
const R_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS ratas_sundmused (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, sid TEXT, ev TEXT, allikas TEXT, jarjekord TEXT, sektor INTEGER, pos INTEGER, valik TEXT, tekst TEXT)",
  "CREATE TABLE IF NOT EXISTS ratas_meilid (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, email TEXT NOT NULL UNIQUE, allikas TEXT)",
];
let rReady = false;
async function ensureRatas(db) { if (rReady) return; await db.batch(R_SCHEMA.map((q) => db.prepare(q))); rReady = true; }
const maskTekst = (t) => clean(t, 280).replace(/\S+@\S+/g, "[e-post]").replace(/\d[\d\s-]{5,}\d/g, "[number]");
async function collectRatas(request, env, url) {
  if (request.method !== "POST") return json({ viga: "Kasuta POST-päringut" }, 405);
  if (!env.DB) return json({ viga: "Andmebaas pole seadistatud" }, 503);
  let b; try { b = await request.json(); } catch { return json({ viga: "Vigane JSON" }, 400); }
  const ev = clean(b.ev, 8);
  const alk = String(b.alk || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  const ts = new Date().toISOString(), host = url.hostname;
  if (!R_EV.has(ev)) return json({ viga: "Vigased väärtused" }, 400);
  await ensureRatas(env.DB);
  if (ev === "email") {
    const email = clean(b.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ viga: "Vigane e-post" }, 400);
    await env.DB.prepare("INSERT OR IGNORE INTO ratas_meilid (ts, host, email, allikas) VALUES (?, ?, ?, ?)").bind(ts, host, email, alk).run();
    return json({ ok: true }, 200);
  }
  const sid = clean(b.sid, 60);
  if (!/^[a-z0-9-]{8,60}$/i.test(sid)) return json({ viga: "Vigased väärtused" }, 400);
  let jarjekord = "", sektor = null, pos = null, valik = "", tekst = "";
  if (ev === "spin") {
    const j = String(b.jarjekord || "").split(",").map(Number);
    if (j.length !== 7 || new Set(j).size !== 7 || j.some((x) => !(x >= 0 && x <= 6))) return json({ viga: "Vigane järjekord" }, 400);
    jarjekord = j.join(",");
  }
  if (ev === "answer") {
    sektor = Number(b.sektor); pos = Number(b.pos); valik = clean(b.valik, 8);
    if (!(sektor >= 0 && sektor <= 6) || !(pos >= 1 && pos <= 7) || !R_VALIK.has(valik)) return json({ viga: "Vigane vastus" }, 400);
    tekst = maskTekst(b.tekst);
  }
  await env.DB.prepare("INSERT INTO ratas_sundmused (ts, host, sid, ev, allikas, jarjekord, sektor, pos, valik, tekst) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(ts, host, sid, ev, alk, jarjekord, sektor, pos, valik, tekst).run();
  return json({ ok: true }, 200);
}
async function meilidCsv(request, env) {
  if (!env.TULEMUSED_VOTI) return new Response("Tulemuste parool (secret TULEMUSED_VOTI) pole seadistatud.", { status: 503 });
  if (!authorized(request, env)) return new Response("Sisesta parool", { status: 401, headers: { "www-authenticate": 'Basic realm="Tulevane Mina tulemused", charset="UTF-8"' } });
  if (!env.DB) return new Response("Andmebaas pole seadistatud.", { status: 503 });
  await ensureRatas(env.DB);
  const rows = (await env.DB.prepare("SELECT ts, email, allikas FROM ratas_meilid ORDER BY ts").all()).results;
  const csv = ["ts,email,allikas"].concat(rows.map((r) => ['"' + r.ts + '"', '"' + String(r.email).replace(/"/g, '""') + '"', '"' + (r.allikas || "") + '"'].join(","))).join("\n");
  return new Response("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="ratas-meilid.csv"', "cache-control": "no-store" } });
}
async function ratasTulemused(env, url, all) {
  await ensureRatas(env.DB);
  const where = all ? "" : " WHERE " + hostIn(url);
  const and = all ? " WHERE" : " AND";
  const bind = (q) => (all ? q : q.bind(...hostid(url)));
  const q = async (sql) => (await bind(env.DB.prepare(sql)).all()).results;
  const num = async (sql) => (await q(sql))[0]?.n || 0;
  const alustas = await num("SELECT COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'spin'");
  const lopetas = await num("SELECT COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'done'");
  const meile = (await (all ? env.DB.prepare("SELECT COUNT(*) AS n FROM ratas_meilid") : env.DB.prepare("SELECT COUNT(*) AS n FROM ratas_meilid WHERE " + hostIn(url)).bind(...hostid(url))).all()).results[0]?.n || 0;
  // iga (sid, sektor) viimane vastus
  const vast = await q("SELECT a.sektor, a.pos, a.valik, a.tekst, a.allikas FROM ratas_sundmused a JOIN (SELECT MAX(id) AS id FROM ratas_sundmused WHERE ev = 'answer' GROUP BY sid, sektor) m ON m.id = a.id" + (all ? "" : " WHERE " + hostIn(url, "a.host")));
  const pc = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–");
  const S = R_NIMED.map((nimi, i) => { const A = vast.filter((v) => v.sektor === i); const c = (k) => A.filter((v) => v.valik === k).length; return { nimi, n: A.length, t: c("tean"), u: c("umbes"), e: c("eitea"), tekstid: A.filter((v) => v.tekst) }; });
  let t = "<table><tr><th>Sektor</th><th>Vastuseid</th><th>Tean</th><th>Umbes</th><th>Ei tea</th><th>Ei tea %</th></tr>" + S.map((s) => "<tr><th>" + s.nimi + "</th><td>" + s.n + "</td><td>" + s.t + "</td><td>" + s.u + "</td><td>" + s.e + "</td><td><b>" + pc(s.e, s.n) + "</b></td></tr>").join("") + "</table>";
  const pos = await q("SELECT pos, COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'answer' GROUP BY pos ORDER BY pos");
  const posN = Object.fromEntries(pos.map((r) => [r.pos, r.n]));
  let t2 = "<table><tr><th>Küsimus järjekorras</th>" + [1, 2, 3, 4, 5, 6, 7].map((p) => "<th>" + p + "</th>").join("") + "</tr><tr><th>Vastajaid</th>" + [1, 2, 3, 4, 5, 6, 7].map((p) => "<td>" + (posN[p] || 0) + "</td>").join("") + "</tr></table>";
  const esimene = await q("SELECT CAST(substr(jarjekord, 1, 1) AS INTEGER) AS s, COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'spin' GROUP BY 1");
  const esN = Object.fromEntries(esimene.map((r) => [r.s, r.n]));
  const kanalid = await q("SELECT COALESCE(NULLIF(allikas, ''), 'otse') AS k, COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'spin' GROUP BY 1 ORDER BY n DESC");
  const kl = await q("SELECT COALESCE(NULLIF(allikas, ''), 'otse') AS k, COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'done' GROUP BY 1");
  const klN = Object.fromEntries(kl.map((r) => [r.k, r.n]));
  const kt = "<table><tr><th>Kanal (?k=…)</th><th>Keeras</th><th>Lõpetas</th></tr>" + (kanalid.map((r) => "<tr><th>" + esc(r.k) + "</th><td>" + r.n + "</td><td>" + (klN[r.k] || 0) + "</td></tr>").join("") || "<tr><td colspan=3>Veel pole.</td></tr>") + "</table>";
  const tx = S.flatMap((s) => s.tekstid.slice(-15).map((v) => "<li><span>" + s.nimi + " · " + ({ tean: "tean", umbes: "umbes", eitea: "ei tea" }[v.valik]) + "</span> " + esc(v.tekst) + "</li>")).join("");
  return `<section><h2>Õnneratas (/arhiiv/ratas/)</h2><p style="font-size:28px;line-height:36px;margin:0"><b>${lopetas}</b> lõpetanud · ${alustas} keerutanud · ${meile} e-posti</p><p class="small">E-postid: <a href="/tulemused-meilid.csv">laadi CSV</a> (ei ole vastustega seotud). Väike valim, loe hüpoteesina.</p></section><section><h2>Ratas: kus „ei tea“</h2><div class="wrap">${t}</div></section><section><h2>Ratas: kui kaugele jõuti</h2><p class="small">Kui palju vastajaid vastas küsimusele nr N (järjekord on igaühel erinev).</p><div class="wrap">${t2}</div></section><section><h2>Ratas: kanalid</h2><p class="small">Esimese küsimuse jaotus: ${R_NIMED.map((n, i) => n + " " + (esN[i] || 0)).join(", ")}.</p><div class="wrap">${kt}</div></section><section><h2>Ratas: vabatekst (mis jäi katmata)</h2><ul>${tx || "<li>Veel pole.</li>"}</ul></section>`;
}


// ---------------------------------------------------------------------------
// Mõõtmine (10.10): avaleht, elukaar ja tagasiside lehe sündmused. Salvestame ainult seansi juhusliku tunnuse (sid), kanali (?k=), eelprofiili (?p=),
// sammu numbri ja valikute nimed (nt radio "payout=fund"); mitte sisestatud summasid, vanust ega IP-d. Aeg salvestatakse UTC-s, kuvatakse Tallinna aja järgi.
const E_EV = new Set(["maandumine", "edasi", "elukaar", "samm", "klikk", "tagasiside"]);
const E_KEYS = new Set(["sid", "ev", "k", "p", "samm", "nimi"]); // muid välju ei võeta vastu (sisestatud väärtused ei saa kogemata kaasa tulla)
const E_BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse/i; // linkide eelvaate- ja otsingurobotid (JS-i jooksutavad robotid) jäävad statistikast välja
// Põhimõtted (ANALUUTIKA.md): sisestatud väärtusi ei salvestata; tagasiside ei seostu seansiga ega isikuandmetega; statistika on minimaalne ja anonüümne.
// Seega ei hoia me sündmuste logi ega ühe kasutaja teekonda: seansi kohta on ÜKS kokkuvõtterida (algus, lõpp, kaugeim samm, kanal, eelprofiil)
// ja vaated/klikid on tunnipõhised loendurid ilma seansitunnuseta.
const E_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS mina_seansid (sid TEXT PRIMARY KEY, host TEXT, k TEXT, p TEXT, esimene TEXT NOT NULL, viimane TEXT NOT NULL, samm_max INTEGER NOT NULL DEFAULT -1, klikke INTEGER NOT NULL DEFAULT 0, maandus INTEGER NOT NULL DEFAULT 0, edasi INTEGER NOT NULL DEFAULT 0, elukaar INTEGER NOT NULL DEFAULT 0, tagasiside INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS mina_loendur (tund TEXT NOT NULL, host TEXT NOT NULL, ev TEXT NOT NULL, k TEXT NOT NULL DEFAULT '', samm INTEGER NOT NULL DEFAULT -1, nimi TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tund, host, ev, k, samm, nimi))",
];
let eReady = false;
async function ensureMoot(db) {
  if (eReady) return;
  await db.batch(E_SCHEMA.map((q) => db.prepare(q)));
  eReady = true;
}
async function collectSundmus(request, env, url) {
  if (request.method !== "POST") return json({ viga: "Kasuta POST-päringut" }, 405);
  if (!env.DB) return json({ viga: "Andmebaas pole seadistatud" }, 503);
  if (E_BOT.test(request.headers.get("user-agent") || "")) return json({ ok: true }, 200); // robotid ei lähe statistikasse
  const text = await request.text();
  if (text.length > 1000) return json({ viga: "Liiga suur" }, 413);
  let b; try { b = JSON.parse(text); } catch { return json({ viga: "Vigane JSON" }, 400); }
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some((x) => !E_KEYS.has(x))) return json({ viga: "Tundmatu väli" }, 400);
  const sid = clean(b.sid, 60), ev = clean(b.ev, 12);
  if (!/^[a-z0-9-]{8,60}$/i.test(sid) || !E_EV.has(ev)) return json({ viga: "Vigased väärtused" }, 400);
  const k = String(b.k || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  const p = clean(b.p, 20);
  if (!T_ALGPUNKT.has(p)) return json({ viga: "Vigane profiil" }, 400);
  let samm = -1;
  if (b.samm !== null && b.samm !== undefined && b.samm !== "") { samm = Math.round(Number(b.samm)); if (!(samm >= 0 && samm <= 30)) return json({ viga: "Vigane samm" }, 400); }
  const nimi = clean(b.nimi, 40);
  if (nimi && !/^[a-z0-9:=_.-]{1,40}$/i.test(nimi)) return json({ viga: "Vigane nimi" }, 400);
  const ts = new Date().toISOString(), tund = ts.slice(0, 13), host = url.hostname;
  // Loenduri võti: profiil (edasi, elukaar) või valiku nimi (klikk); muu tekst ei satu loendurisse.
  const loendurNimi = ev === "klikk" ? nimi : ev === "edasi" || ev === "elukaar" ? p : "";
  const loendurSamm = ev === "samm" || ev === "klikk" ? samm : -1;
  await ensureMoot(env.DB);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO mina_loendur (tund, host, ev, k, samm, nimi, n) VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT (tund, host, ev, k, samm, nimi) DO UPDATE SET n = n + 1").bind(tund, host, ev, k, loendurSamm, loendurNimi),
    env.DB.prepare("INSERT INTO mina_seansid (sid, host, k, p, esimene, viimane, samm_max, klikke, maandus, edasi, elukaar, tagasiside) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (sid) DO UPDATE SET viimane = excluded.viimane, k = CASE WHEN mina_seansid.k = '' THEN excluded.k ELSE mina_seansid.k END, p = CASE WHEN mina_seansid.p = '' THEN excluded.p ELSE mina_seansid.p END, samm_max = MAX(mina_seansid.samm_max, excluded.samm_max), klikke = mina_seansid.klikke + excluded.klikke, maandus = MAX(mina_seansid.maandus, excluded.maandus), edasi = MAX(mina_seansid.edasi, excluded.edasi), elukaar = MAX(mina_seansid.elukaar, excluded.elukaar), tagasiside = MAX(mina_seansid.tagasiside, excluded.tagasiside)")
      .bind(sid, host, k, ev === "edasi" || ev === "elukaar" ? p : "", ts, ts, ev === "samm" ? samm : -1, ev === "klikk" ? 1 : 0, ev === "maandumine" ? 1 : 0, ev === "edasi" ? 1 : 0, ev === "elukaar" ? 1 : 0, ev === "tagasiside" ? 1 : 0),
  ]);
  return json({ ok: true }, 200);
}
async function mootTulemused(env, url, all) {
  await ensureMoot(env.DB); await ensureKutse(env.DB);
  const w = all ? "" : " WHERE " + hostIn(url);
  const bind = (st) => (all ? st : st.bind(...hostid(url)));
  const seansid = (await bind(env.DB.prepare("SELECT k, p, esimene, viimane, samm_max, klikke, maandus, edasi, elukaar, tagasiside FROM mina_seansid" + w + " ORDER BY esimene DESC LIMIT 30000")).all()).results;
  const loendur = (await bind(env.DB.prepare("SELECT tund, ev, k, samm, nimi, n FROM mina_loendur" + w)).all()).results;
  const klikid = (await bind(env.DB.prepare("SELECT ts, k FROM kutse_klikid" + w)).all()).results;
  const saadetud = (await env.DB.prepare("SELECT variant, SUM(ok) AS ok, SUM(vigu) AS vigu FROM kutse_saadetud GROUP BY variant").all()).results;
  await ensureTagasiside(env.DB);
  const tag = (await bind(env.DB.prepare("SELECT allikas FROM tagasiside_vastused" + w)).all()).results;
  return `<section><h2>Mõõtmine (kellaajad Tallinna aja järgi)</h2><p class="small">Andmebaasis on aeg UTC-s, siin on kõik tunnid ja päevad Tallinna ajas. CSV-des on aeg endiselt UTC (ts-veerg). Kanali saad linkidele lisada nii: <code>?k=fb</code>, <code>?k=lkd</code>, <code>?k=tuleva</code>. Mõõtmise põhimõtted: sisestatud väärtusi ei salvestata, tagasiside ei seostu seansiga ega isikuandmetega, statistika on minimaalne ja anonüümne (ühe kasutaja teekonda ei hoia). Seansse on ${seansid.length}${seansid.length >= 30000 ? " (näidatud on viimased 30 000)" : ""}.</p></section>${kutseVaade(saadetud, klikid)}${sundmusteVaade(seansid, loendur, tag)}`;
}

// ---------------------------------------------------------------------------
// Lõpu tagasiside (/tagasiside/, 10.10): neli mõõdet ja vaba kommentaar. Anonüümne; sid on ainult seansi juhuslik tunnus (sama vastaja uuesti saatmine asendab eelmise).
// Mõõdame: kas oskas andmeid täita, kas oskab 5–10 min pärast öelda vanuse, kuni milleni raha jätkub, kas nimetas uue teadmise, kas muudaks plaani.
const T_ENUM = {
  kestus: new Set(["", "alla2", "2_5", "5_10", "yle10"]),
  taitmine: new Set(["jah", "osaliselt", "ei"]),
  vanus_vastus: new Set(["jah", "umbes", "ei"]),
  uus: new Set(["jah", "ei"]),
  muudaks: new Set(["jah", "votiolla", "ei"]),
};
const T_ALGPUNKT = new Set(["", "konto-naidis", "tuhi", "valja", "liige-power", "liige-steady", "liige-coaster", "liige-single", "liige-gone", "mitte-power", "mitte-steady", "mitte-coaster", "mitte-single", "mitte-gone"]);
const T_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS tagasiside_vastused (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, sid TEXT NOT NULL UNIQUE, allikas TEXT, algpunkt TEXT, algpunkt0 TEXT, vahetusi INTEGER, muutis INTEGER, kestus TEXT, taitmine TEXT, taitmine_tekst TEXT, vanus_vastus TEXT, vanus INTEGER, uus TEXT, uus_tekst TEXT, muudaks TEXT, muudaks_tekst TEXT, kommentaar TEXT)",
];
let tReady = false;
async function ensureTagasiside(db) {
  if (tReady) return;
  await db.batch(T_SCHEMA.map((q) => db.prepare(q)));
  for (const c of ["algpunkt0 TEXT", "vahetusi INTEGER", "muutis INTEGER"]) { try { await db.prepare("ALTER TABLE tagasiside_vastused ADD COLUMN " + c).run(); } catch {} } // vana tabel ilma uute veergudeta
  tReady = true;
}
const maskPikk = (t, max) => clean(t, max).replace(/\S+@\S+/g, "[e-post]").replace(/\d[\d\s-]{5,}\d/g, "[number]");
async function collectTagasiside(request, env, url) {
  if (request.method !== "POST") return json({ viga: "Kasuta POST-päringut" }, 405);
  if (!env.DB) return json({ viga: "Andmebaas pole seadistatud" }, 503);
  let b; try { b = await request.json(); } catch { return json({ viga: "Vigane JSON" }, 400); }
  const sid = clean(b.sid, 60);
  if (!/^[a-z0-9-]{8,60}$/i.test(sid)) return json({ viga: "Vigased väärtused" }, 400);
  const alk = String(b.alk || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  const f = b.vastus || {};
  const algpunkt = clean(b.algpunkt, 20), algpunkt0 = clean(b.algpunkt0, 20), kestus = clean(f.kestus, 8), taitmine = clean(f.taitmine, 12), vv = clean(f.vanus_vastus, 8), uus = clean(f.uus, 4), muudaks = clean(f.muudaks, 8);
  if (!T_ALGPUNKT.has(algpunkt) || !T_ALGPUNKT.has(algpunkt0) || !T_ENUM.kestus.has(kestus) || !T_ENUM.taitmine.has(taitmine) || !T_ENUM.vanus_vastus.has(vv) || !T_ENUM.uus.has(uus) || !T_ENUM.muudaks.has(muudaks)) return json({ viga: "Vigane vastus" }, 400);
  let vanus = null;
  if (vv !== "ei" && f.vanus !== "" && f.vanus != null) { vanus = Math.round(Number(f.vanus)); if (!(vanus >= 18 && vanus <= 130)) return json({ viga: "Vigane vanus" }, 400); }
  const vahetusi = Math.min(20, Math.max(0, Math.round(Number(b.vahetusi) || 0))), muutis = b.muutis ? 1 : 0;
  const ts = new Date().toISOString(), host = url.hostname;
  await ensureTagasiside(env.DB);
  await env.DB.prepare("INSERT OR REPLACE INTO tagasiside_vastused (ts, host, sid, allikas, algpunkt, algpunkt0, vahetusi, muutis, kestus, taitmine, taitmine_tekst, vanus_vastus, vanus, uus, uus_tekst, muudaks, muudaks_tekst, kommentaar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(ts, host, sid, alk, algpunkt, algpunkt0, vahetusi, muutis, kestus, taitmine, maskPikk(f.taitmine_tekst, 400), vv, vanus, uus, maskPikk(f.uus_tekst, 400), muudaks, maskPikk(f.muudaks_tekst, 400), maskPikk(f.kommentaar, 1500)).run();
  return json({ ok: true }, 200);
}
async function tagasisideCsv(request, env) {
  if (!env.TULEMUSED_VOTI) return new Response("Tulemuste parool (secret TULEMUSED_VOTI) pole seadistatud.", { status: 503 });
  if (!authorized(request, env)) return new Response("Sisesta parool", { status: 401, headers: { "www-authenticate": 'Basic realm="Tulevane Mina tulemused", charset="UTF-8"' } });
  if (!env.DB) return new Response("Andmebaas pole seadistatud.", { status: 503 });
  await ensureTagasiside(env.DB);
  const rows = (await env.DB.prepare("SELECT * FROM tagasiside_vastused ORDER BY ts").all()).results;
  const cols = ["ts", "host", "allikas", "algpunkt0", "algpunkt", "vahetusi", "muutis", "taitmine", "taitmine_tekst", "vanus_vastus", "vanus", "uus", "uus_tekst", "muudaks", "muudaks_tekst", "kommentaar"];
  const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => '"' + String(r[c] ?? "").replace(/"/g, '""') + '"').join(","))).join("\n");
  return new Response("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="tagasiside.csv"', "cache-control": "no-store" } });
}
async function tagasisideTulemused(env, url, all) {
  await ensureTagasiside(env.DB);
  const st = env.DB.prepare("SELECT * FROM tagasiside_vastused" + (all ? "" : " WHERE " + hostIn(url)) + " ORDER BY ts");
  const A = (await (all ? st : st.bind(...hostid(url))).all()).results;
  const n = A.length;
  const sh = (f) => pc(A.filter(f).length, n);
  const row = (l, f) => "<tr><th>" + l + "</th><td>" + A.filter(f).length + "</td><td><b>" + sh(f) + "</b></td></tr>";
  const ages = A.map((a) => a.vanus).filter((v) => v != null).sort((a, b) => a - b);
  const med = ages.length ? ages[Math.floor(ages.length / 2)] : "–";
  const t = "<table><tr><th>Mõõde</th><th>Vastajaid</th><th>Osa</th></tr>"
    + row("1. Täitis andmed ise (jah)", (a) => a.taitmine === "jah") + row("1. … osaliselt", (a) => a.taitmine === "osaliselt") + row("1. … ei saanud", (a) => a.taitmine === "ei")
    + row("2. Oskab öelda vanuse, milleni raha jätkub (jah)", (a) => a.vanus_vastus === "jah") + row("2. … umbes", (a) => a.vanus_vastus === "umbes") + row("2. … ei oska", (a) => a.vanus_vastus === "ei")
    + row("3. Nimetas midagi, mida enne ei teadnud", (a) => a.uus === "jah")
    + row("4. Muudaks plaani või käitumist (jah)", (a) => a.muudaks === "jah") + row("4. … võib-olla", (a) => a.muudaks === "votiolla") + row("4. … ei", (a) => a.muudaks === "ei") + "</table>";
  const alg = {};
  for (const a of A) { const k = a.algpunkt || "määramata"; (alg[k] = alg[k] || { n: 0, jah: 0, vanus: 0, uus: 0, muuda: 0, muutis: 0, vahetas: 0, esimene: 0 }); const g = alg[k]; g.n++; if (a.taitmine === "jah") g.jah++; if (a.vanus_vastus === "jah") g.vanus++; if (a.uus === "jah") g.uus++; if (a.muudaks === "jah") g.muuda++; if (a.muutis) g.muutis++; if (a.vahetusi > 0) g.vahetas++; if (a.algpunkt0 === a.algpunkt) g.esimene++; }
  const at = "<table><tr><th>Viimane algpunkt</th><th>Vastajaid</th><th>Täitis ise</th><th>Oskab vanust</th><th>Uus teadmine</th><th>Muudaks</th><th>Muutis andmeid</th><th>Vahetas algpunkti</th></tr>" + (Object.entries(alg).sort((x, y) => y[1].n - x[1].n).map(([k, g]) => "<tr><th>" + esc(k) + "</th><td>" + g.n + "</td><td>" + pc(g.jah, g.n) + "</td><td>" + pc(g.vanus, g.n) + "</td><td>" + pc(g.uus, g.n) + "</td><td>" + pc(g.muuda, g.n) + "</td><td>" + pc(g.muutis, g.n) + "</td><td>" + pc(g.vahetas, g.n) + "</td></tr>").join("") || "<tr><td colspan=8>Veel pole.</td></tr>") + "</table>";
  const esimesed = {}; for (const a of A) { const k = a.algpunkt0 || "otse (ilma valikuta)"; esimesed[k] = (esimesed[k] || 0) + 1; }
  const et = "<table><tr><th>Maandumislehel valitud algpunkt</th><th>Vastajaid</th></tr>" + (Object.entries(esimesed).sort((x, y) => y[1] - x[1]).map(([k, v]) => "<tr><th>" + esc(k) + "</th><td>" + v + "</td></tr>").join("") || "<tr><td colspan=2>Veel pole.</td></tr>") + "</table>";
  const li = (key, label) => A.filter((a) => a[key]).slice(-40).reverse().map((a) => "<li><span>" + label + "</span> " + esc(a[key]) + "</li>").join("");
  return `<section><h2>Tagasiside (/tagasiside/)</h2><p style="font-size:28px;line-height:36px;margin:0"><b>${n}</b> vastust · vanuse mediaan ${med}</p><p class="small">Vastajaid on vähe, loe hüpoteesina. <a href="/tulemused-tagasiside.csv">Laadi CSV</a>.</p><div class="wrap">${t}</div>${tagasisideKanaliVaade(A)}</section><section><h2>Tagasiside: algpunktid</h2><p class="small">„Muutis andmeid“: muutis algandmeid pärast profiili valimist (sisu ei salvestata). „Vahetas algpunkti“: valis elukaare lehel teise profiili.</p><div class="wrap">${at}</div><p class="small" style="margin-top:12px">Esimene valik maandumislehelt:</p><div class="wrap">${et}</div></section><section><h2>Tagasiside: vaba kommentaar (kõige olulisem)</h2><ul>${li("kommentaar", "kommentaar") || "<li>Veel pole.</li>"}</ul></section><section><h2>Tagasiside: täpsustused</h2><ul>${li("taitmine_tekst", "mis segas") + li("uus_tekst", "uus teadmine") + li("muudaks_tekst", "muudaks") || "<li>Veel pole.</li>"}</ul></section>`;
}

// CSV-väljavõtted (parooliga, kõik keskkonnad; veerus host on näha, kust vastus tuli). Sid-i ei ekspordita.
async function csvVastus(request, env, fail, sql, cols, nimi, muuda) {
  if (!env.TULEMUSED_VOTI) return new Response("Tulemuste parool (secret TULEMUSED_VOTI) pole seadistatud.", { status: 503 });
  if (!authorized(request, env)) return new Response("Sisesta parool", { status: 401, headers: { "www-authenticate": 'Basic realm="Tulevane Mina tulemused", charset="UTF-8"' } });
  if (!env.DB) return new Response("Andmebaas pole seadistatud.", { status: 503 });
  await fail(env.DB);
  let rows = (await env.DB.prepare(sql).all()).results;
  if (muuda) rows = rows.map(muuda);
  const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => '"' + String(r[c] ?? "").replace(/"/g, '""') + '"').join(","))).join("\n");
  return new Response("\ufeff" + csv + "\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="' + nimi + '"', "cache-control": "no-store" } });
}
const ratasCsv = (request, env) => csvVastus(request, env, ensureRatas,
  "SELECT a.ts, a.host, a.allikas, a.sektor, a.pos, a.valik, a.tekst FROM ratas_sundmused a JOIN (SELECT MAX(id) AS id FROM ratas_sundmused WHERE ev = 'answer' GROUP BY sid, sektor) m ON m.id = a.id ORDER BY a.ts",
  ["ts", "host", "allikas", "sektor", "sektor_nimi", "pos", "valik", "tekst"], "ratas-vastused.csv", (r) => ({ ...r, sektor_nimi: R_NIMED[r.sektor] || "" }));
const plaanCsv = (request, env) => csvVastus(request, env, ensurePlaan,
  "SELECT ts, host, loos, vaade, katab, oige, enne, kindlus, hirm, eelistus, nahtud, kommentaar, allikas FROM plaan_vastused ORDER BY ts",
  ["ts", "host", "loos", "vaade", "katab", "oige", "enne", "kindlus", "hirm", "eelistus", "nahtud", "kommentaar", "allikas"], "plaan-vastused.csv");

function gone() {
  const html = `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tulevane Mina · seda lehte enam pole</title>
<style>body{margin:0;font-family:Roboto,Arial,sans-serif;color:#293036;background:#fff}main{max-width:520px;margin:0 auto;padding:48px 16px;display:grid;gap:16px}h1{font-family:Merriweather,Georgia,serif;color:#002f63;margin:0;font-size:26px;line-height:34px}p{margin:0;line-height:1.5}a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;border-radius:8px;background:#006ce6;color:#fff;text-decoration:none;font-weight:500}</style></head>
<body><main><h1>Seda prototüüpi enam pole</h1><p>Lauamäng oli Tulevase Mina varasem katsetus ja see on nüüd suletud.</p><p><a href="/">Proovi uut prototüüpi</a></p></main></body></html>`;
  return new Response(html, { status: 410, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } });
}

// ---------------------------------------------------------------------------
// Kutsekirjad (10.10): /saada saadab Cloudflare Email Service'i kaudu (binding EMAIL, Workers Paid) aadressilt mirko@tulevanemina.ee.
// Parool sama mis tulemustel (TULEMUSED_VOTI). Töötab ainult toodangu aadressil, eelvaated ei saada kirju.
// Iga saaja saab eraldi kirja (aadressid ei paista teistele). Aadresse ega sisu ei salvestata; D1-sse läheb ainult saatmise kokkuvõte.
// Lingi {link} asemele tuleb https://tulevanemina.ee/?k=kutse-<variant>; avalehe klikid loetakse tabelisse kutse_klikid (ilma IP ja küpsiseta).
const KUTSE_K = /^kutse-[abc]$/;
const SAATJA = { email: "mirko@tulevanemina.ee", name: "Mirko · Tulevane Mina" };
const MAX_SAAJAID = 100;
async function ensureKutse(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS kutse_klikid (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, host TEXT, k TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS kutse_saadetud (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, variant TEXT, teema TEXT, ok INTEGER, vigu INTEGER)"),
  ]);
}
async function logKlikk(env, url) {
  if (!env.DB) return;
  try { await ensureKutse(env.DB); await env.DB.prepare("INSERT INTO kutse_klikid (ts, host, k) VALUES (?, ?, ?)").bind(new Date().toISOString(), url.hostname, url.searchParams.get("k")).run(); } catch {}
}
const htmlKirjaks = (tekst, link) => '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:560px">' +
  esc(tekst).split(/\n{2,}/).map((p) => "<p>" + p.replace(/\n/g, "<br>").split(esc(link)).join('<a href="' + esc(link) + '">' + esc(link) + "</a>") + "</p>").join("") + "</div>";
async function saada(request, env, url) {
  if (!env.TULEMUSED_VOTI) return new Response("Parool (secret TULEMUSED_VOTI) pole seadistatud.", { status: 503 });
  if (!authorized(request, env)) return new Response("Sisesta parool", { status: 401, headers: { "www-authenticate": 'Basic realm="Tulevane Mina tulemused", charset="UTF-8"' } });
  const toodang = TOODANG.includes(url.hostname);
  const leht = (sisu) => new Response(`<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Kutsekirjad</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;line-height:1.45;color:#111;background:#fff}label{display:block;margin:12px 0 4px;font-weight:600}textarea,input,select{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #999;border-radius:6px}textarea{min-height:120px}button{margin-top:16px;padding:10px 16px;font:inherit;border-radius:6px;border:0;background:#0b5;color:#fff;cursor:pointer}.small{color:#555;font-size:14px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}.viga{color:#b00}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:6px}</style></head><body>${sisu}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  if (!env.DB) return new Response("Andmebaas pole seadistatud.", { status: 503 });
  await ensureKutse(env.DB);
  const klikid = (await env.DB.prepare("SELECT k, COUNT(*) AS n FROM kutse_klikid GROUP BY k ORDER BY k").all()).results;
  const saadetud = (await env.DB.prepare("SELECT variant, SUM(ok) AS ok, SUM(vigu) AS vigu FROM kutse_saadetud GROUP BY variant ORDER BY variant").all()).results;
  const kokkuvote = `<h2>Seis</h2><table><tr><th>Variant</th><th>Saadetud</th><th>Klikke avalehel</th></tr>${["a", "b", "c"].map((v) => {
    const s = saadetud.find((r) => r.variant === v) || {}, k = klikid.find((r) => r.k === "kutse-" + v) || {};
    return `<tr><td>${v.toUpperCase()}</td><td>${s.ok || 0}${s.vigu ? ' <span class="viga">(' + s.vigu + " viga)</span>" : ""}</td><td>${k.n || 0}</td></tr>`;
  }).join("")}</table><p class="small">Klikk = avalehe avamine lingiga ?k=kutse-… (sama inimene võib klikkida mitu korda). Väikese valimi juures on erinevused suunavad, mitte statistiliselt olulised.</p>`;

  if (request.method === "GET") {
    return leht(`<h1>Kutsekirjad</h1>${toodang ? "" : '<p class="viga">See on eelvaade: kirju siit ei saadeta.</p>'}
<form method="post">
<label for="aadressid">Saajad (üks rida või koma kohta, kuni ${MAX_SAAJAID})</label><textarea id="aadressid" name="aadressid" required></textarea>
<label for="variant">Variant</label><select id="variant" name="variant"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>
<label for="teema">Teema</label><input id="teema" name="teema" required maxlength="150">
<label for="tekst">Tekst ({link} asendub variandi lingiga)</label><textarea id="tekst" name="tekst" required style="min-height:260px">Tere!

…

{link}

Kui sa ei soovi rohkem kirju, vasta lihtsalt sellele kirjale.

Mirko
Tulevane Mina</textarea>
<label><input type="checkbox" name="saada" value="1" style="width:auto"> Saada päriselt (ilma linnukeseta näed ainult eelvaadet)</label>
<button type="submit">Edasi</button>
</form>${kokkuvote}`);
  }
  if (request.method !== "POST") return new Response("Meetod pole lubatud", { status: 405 });
  const f = await request.formData();
  const variant = String(f.get("variant") || "");
  if (!["a", "b", "c"].includes(variant)) return leht('<p class="viga">Vigane variant.</p><p><a href="/saada">Tagasi</a></p>');
  const teema = clean(f.get("teema"), 150), tekstSisend = String(f.get("tekst") || "").slice(0, 8000);
  const link = "https://tulevanemina.ee/?k=kutse-" + variant;
  const tekst = tekstSisend.replace(/\r\n/g, "\n").split("{link}").join(link);
  const koik = String(f.get("aadressid") || "").split(/[\s,;]+/).map((a) => a.trim().toLowerCase()).filter(Boolean);
  const aadressid = [...new Set(koik)].filter((a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
  const vigased = [...new Set(koik)].filter((a) => !aadressid.includes(a));
  if (!teema || !tekstSisend.trim() || !aadressid.length) return leht('<p class="viga">Teema, tekst ja vähemalt üks korrektne aadress on kohustuslikud.</p><p><a href="/saada">Tagasi</a></p>');
  if (aadressid.length > MAX_SAAJAID) return leht(`<p class="viga">Korraga kuni ${MAX_SAAJAID} saajat.</p><p><a href="/saada">Tagasi</a></p>`);
  const paris = f.get("saada") === "1";
  const eelvaade = `<p>Variant <b>${variant.toUpperCase()}</b> · saajaid <b>${aadressid.length}</b>${vigased.length ? ' · <span class="viga">vigased aadressid jäid välja: ' + esc(vigased.join(", ")) + "</span>" : ""}</p><p><b>Teema:</b> ${esc(teema)}</p><pre>${esc(tekst)}</pre>`;
  if (!paris) return leht(`<h1>Eelvaade</h1>${eelvaade}<p class="small">Midagi ei saadetud. Mine tagasi ja pane linnuke „Saada päriselt“.</p><p><a href="/saada">Tagasi</a></p>`);
  if (!toodang) return leht('<p class="viga">Eelvaatest kirju ei saadeta.</p>');
  if (!env.EMAIL) return leht('<p class="viga">E-posti binding (EMAIL) pole seadistatud.</p>');
  const html = htmlKirjaks(tekst, link);
  let ok = 0; const vead = [];
  for (const a of aadressid) {
    try { await env.EMAIL.send({ to: a, from: SAATJA, replyTo: SAATJA.email, subject: teema, text: tekst, html }); ok++; }
    catch (e) { vead.push(a + ": " + (e.code || e.message || "viga")); if (e.code === "E_DAILY_LIMIT_EXCEEDED" || e.code === "E_RATE_LIMIT_EXCEEDED") { vead.push("Peatusin: limiit täis, ülejäänud jäid saatmata."); break; } }
  }
  await env.DB.prepare("INSERT INTO kutse_saadetud (ts, variant, teema, ok, vigu) VALUES (?, ?, ?, ?, ?)").bind(new Date().toISOString(), variant, teema, ok, vead.length).run();
  return leht(`<h1>Saadetud: ${ok} / ${aadressid.length}</h1>${vead.length ? '<p class="viga">' + vead.map(esc).join("<br>") + "</p>" : ""}${eelvaade}<p><a href="/saada">Tagasi</a></p>`);
}
