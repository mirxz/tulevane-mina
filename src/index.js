// Tulevane Mina – Worker.
// /api/tts  → eesti kõnesüntees (TartuNLP Neurokõne) tulevase mina kõne jaoks.
// Kõik muu → staatilised failid kaustast public/.

const TTS_URL = "https://api.tartunlp.ai/text-to-speech/v2";
const SPEAKERS = new Set(["albert", "indrek", "kalev", "kylli", "lee", "liivika", "luukas", "mari", "meelis", "peeter", "tambet", "vesta"]);
const MAX_CHARS = 400; // üks kõne, mitte terve raamat

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/tts") return tts(request, url);
    return env.ASSETS.fetch(request);
  },
};

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
