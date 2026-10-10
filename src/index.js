// Tulevane Mina – Worker.
// /api/tts  → eesti kõnesüntees (TartuNLP Neurokõne) tulevase mina kõne jaoks.
// /api/s    → anonüümsed mängusündmused ja tagasiside (Cloudflare D1, binding DB). Otsus: otsuste logi 7.10.
// /tulemused → variantide võrdlus (parooliga, Cloudflare secret TULEMUSED_VOTI); /tulemused.csv → vastused CSV-na.
// Parool on valikuline: kui Cloudflare secret PROTO_VOTI on seatud, küsib sait parooli; ilma selleta on sait avatud.
// Heidi Reinson andis 8.10 loa häkatonil avalikult testida (otsuste logi). /tulemused kasutab alati eraldi parooli TULEMUSED_VOTI.
// /api/mang/tuba → lauamängu võrgutoad (sama D1, tabel mang_toad): olek JSON-ina, versiooniga, et samaaegsed käigud ei kirjutaks üksteist üle.
// /api/r    → õnneratta maandumisleht /ratas/: anonüümsed vastused ja eraldi e-posti tabel (ei seo sid-iga).
// Kõik muu → staatilised failid kaustast public/.

const TTS_URL = "https://api.tartunlp.ai/text-to-speech/v2";
const SPEAKERS = new Set(["albert", "indrek", "kalev", "kylli", "lee", "liivika", "luukas", "mari", "meelis", "peeter", "tambet", "vesta"]);
const MAX_CHARS = 400; // üks kõne, mitte terve raamat

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isResults = url.pathname === "/tulemused" || url.pathname === "/tulemused.csv" || url.pathname === "/tulemused-meilid.csv";
    if (!isResults) { const gate = protoGate(request, env, url); if (gate) return gate; }
    // Lauamäng kolis arhiivi (9.10). Vana aadress (ka prinditud QR-kood) annab teadlikult veateate, mitte ei suuna edasi.
    if (url.pathname === "/mang" || url.pathname.startsWith("/mang/")) return gone();
    if (url.pathname === "/api/tts") return tts(request, url);
    if (url.pathname === "/api/s") return collect(request, env, url);
    if (url.pathname === "/api/p") return collectPlaan(request, env, url);
    if (url.pathname === "/api/r") return collectRatas(request, env, url);
    if (url.pathname.startsWith("/api/mang/tuba")) return room(request, env, url);
    if (url.pathname === "/tulemused-meilid.csv") return meilidCsv(request, env);
    if (url.pathname === "/tulemused" || url.pathname === "/tulemused.csv") return results(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

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
  const where = all ? "" : " WHERE host = ?";
  const bindHost = (st) => (all ? st : st.bind(url.hostname));
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
.small{font-size:13px;color:#6b7074}ul{padding-left:18px;display:grid;gap:6px}li span{font-size:12px;color:#6b7074;margin-right:6px}a{color:#006ce6}</style></head><body><main>
<h1>Tulevane Mina · tulemused</h1>
<p class="small">${all ? "Kõik keskkonnad (ka eelvaated)." : "Ainult " + esc(url.hostname) + "."} Vastuseid kokku ${ans.length}. Väikese valimi juures on erinevused suunavad, mitte statistiliselt olulised. <a href="?${all ? "" : "koik=1"}">${all ? "Näita ainult seda keskkonda" : "Näita ka eelvaateid"}</a> · <a href="/tulemused.csv${all ? "?koik=1" : ""}">Laadi CSV</a></p>
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
  const where = all ? "" : " WHERE host = ?";
  const bind = (q) => (all ? q : q.bind(url.hostname));
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
// Õnneratas (/ratas/): seitse küsimust, esimene keerutus määrab järjekorra. Vastused anonüümsed (sid on ainult seansi juhuslik tunnus).
// E-post läheb eraldi tabelisse ilma sid-ita, et seda ei saaks vastustega siduda.
const R_EV = new Set(["spin", "answer", "done", "email"]);
const R_VALIK = new Set(["tean", "umbes", "eitea"]);
const R_NIMED = ["Vajadus", "Riiklik pension", "Sambad", "Kõrvalraha", "Eluiga", "Auto ja kodu", "Ära koonerda"];
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
  const where = all ? "" : " WHERE host = ?";
  const and = all ? " WHERE" : " AND";
  const bind = (q) => (all ? q : q.bind(url.hostname));
  const q = async (sql) => (await bind(env.DB.prepare(sql)).all()).results;
  const num = async (sql) => (await q(sql))[0]?.n || 0;
  const alustas = await num("SELECT COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'spin'");
  const lopetas = await num("SELECT COUNT(DISTINCT sid) AS n FROM ratas_sundmused" + where + and + " ev = 'done'");
  const meile = (await (all ? env.DB.prepare("SELECT COUNT(*) AS n FROM ratas_meilid") : env.DB.prepare("SELECT COUNT(*) AS n FROM ratas_meilid WHERE host = ?").bind(url.hostname)).all()).results[0]?.n || 0;
  // iga (sid, sektor) viimane vastus
  const vast = await q("SELECT a.sektor, a.pos, a.valik, a.tekst, a.allikas FROM ratas_sundmused a JOIN (SELECT MAX(id) AS id FROM ratas_sundmused WHERE ev = 'answer' GROUP BY sid, sektor) m ON m.id = a.id" + (all ? "" : " WHERE a.host = ?"));
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
  return `<section><h2>Õnneratas (/ratas/)</h2><p style="font-size:28px;line-height:36px;margin:0"><b>${lopetas}</b> lõpetanud · ${alustas} keerutanud · ${meile} e-posti</p><p class="small">E-postid: <a href="/tulemused-meilid.csv">laadi CSV</a> (ei ole vastustega seotud). Väike valim, loe hüpoteesina.</p></section><section><h2>Ratas: kus „ei tea“</h2><div class="wrap">${t}</div></section><section><h2>Ratas: kui kaugele jõuti</h2><p class="small">Kui palju vastajaid vastas küsimusele nr N (järjekord on igaühel erinev).</p><div class="wrap">${t2}</div></section><section><h2>Ratas: kanalid</h2><p class="small">Esimese küsimuse jaotus: ${R_NIMED.map((n, i) => n + " " + (esN[i] || 0)).join(", ")}.</p><div class="wrap">${kt}</div></section><section><h2>Ratas: vabatekst (mis jäi katmata)</h2><ul>${tx || "<li>Veel pole.</li>"}</ul></section>`;
}

function gone() {
  const html = `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tulevane Mina · seda lehte enam pole</title>
<style>body{margin:0;font-family:Roboto,Arial,sans-serif;color:#293036;background:#fff}main{max-width:520px;margin:0 auto;padding:48px 16px;display:grid;gap:16px}h1{font-family:Merriweather,Georgia,serif;color:#002f63;margin:0;font-size:26px;line-height:34px}p{margin:0;line-height:1.5}a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;border-radius:8px;background:#006ce6;color:#fff;text-decoration:none;font-weight:500}</style></head>
<body><main><h1>Seda prototüüpi enam pole</h1><p>Lauamäng oli Tulevase Mina varasem katsetus ja see on nüüd suletud.</p><p><a href="/">Proovi uut prototüüpi</a></p></main></body></html>`;
  return new Response(html, { status: 410, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } });
}
