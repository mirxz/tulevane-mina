// Tulevane Mina – Worker.
// /api/tts  → eesti kõnesüntees (TartuNLP Neurokõne) tulevase mina kõne jaoks.
// /api/s    → anonüümsed mängusündmused ja tagasiside (Cloudflare D1, binding DB). Otsus: otsuste logi 7.10.
// /tulemused → variantide võrdlus (parooliga, Cloudflare secret TULEMUSED_VOTI); /tulemused.csv → vastused CSV-na.
// Parool on valikuline: kui Cloudflare secret PROTO_VOTI on seatud, küsib sait parooli; ilma selleta on sait avatud.
// Heidi Reinson andis 8.10 loa häkatonil avalikult testida (otsuste logi). /tulemused kasutab alati eraldi parooli TULEMUSED_VOTI.
// /api/mang/tuba → lauamängu võrgutoad (sama D1, tabel mang_toad): olek JSON-ina, versiooniga, et samaaegsed käigud ei kirjutaks üksteist üle.
// Kõik muu → staatilised failid kaustast public/.

const TTS_URL = "https://api.tartunlp.ai/text-to-speech/v2";
const SPEAKERS = new Set(["albert", "indrek", "kalev", "kylli", "lee", "liivika", "luukas", "mari", "meelis", "peeter", "tambet", "vesta"]);
const MAX_CHARS = 400; // üks kõne, mitte terve raamat

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isResults = url.pathname === "/tulemused" || url.pathname === "/tulemused.csv";
    if (!isResults) { const gate = protoGate(request, env, url); if (gate) return gate; }
    if (url.pathname === "/api/tts") return tts(request, url);
    if (url.pathname === "/api/s") return collect(request, env, url);
    if (url.pathname.startsWith("/api/mang/tuba")) return room(request, env, url);
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
<section><h2>Variandid kõrvuti</h2><p class="small">Peamine mõõdik: osa vastajatest, kes vastas arusaamise küsimusele õigesti ja valis mõne tegevuse.</p><div class="wrap">${table}</div></section>
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
