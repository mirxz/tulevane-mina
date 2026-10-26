// Brauseritestid koos kohaliku serveriga: kui pordil 8787 juba jookseb `wrangler dev`, kasutab seda; kui port on vaba,
// käivitab `wrangler dev`, jooksutab `npm run test:brauser` ja paneb serveri kinni. Muu server pordil 8787 → selge veateade.
// TULEMUSED_PAROOL võetakse failist .dev.vars (TULEMUSED_VOTI), kui see on olemas ja keskkonnas pole antud.
// Kasutus: npm run test:koik  (mootor + brauser)  või  node tests/koos-serveriga.mjs
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";

const PORT = 8787, BASE = `http://127.0.0.1:${PORT}`;
const status = async (path) => { try { return (await fetch(BASE + path, { redirect: "manual" })).status; } catch { return 0; } };
// Wrangler: /tulemused küsib parooli (401). Staatiline server (nt python -m http.server): 404 või 501.
const isWrangler = async () => (await status("/tulemused")) === 401;

const env = { ...process.env };
if (!env.TULEMUSED_PAROOL && existsSync(".dev.vars")) {
  const m = /^TULEMUSED_VOTI=(.*)$/m.exec(readFileSync(".dev.vars", "utf8"));
  if (m) env.TULEMUSED_PAROOL = m[1].trim();
}

let server = null;
if (await isWrangler()) {
  console.log(`Kasutan juba käivitatud wrangler dev serverit (${BASE}).`);
} else if ((await status("/")) !== 0) {
  console.error(`Port ${PORT} on hõivatud muu serveriga (mitte wrangler). Vaata: lsof -i :${PORT}`);
  process.exit(1);
} else {
  console.log(`Käivitan wrangler dev (${BASE}) …`);
  server = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--ip", "127.0.0.1"], { stdio: "ignore", detached: true, env });
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) { await new Promise((r) => setTimeout(r, 1000)); ok = await isWrangler(); }
  if (!ok) { console.error("wrangler dev ei käivitunud 60 sekundiga."); process.kill(-server.pid); process.exit(1); }
}

const run = spawn("npm", ["run", "test:brauser"], { stdio: "inherit", env });
const code = await new Promise((r) => run.on("close", r));
if (server) { try { process.kill(-server.pid); } catch {} console.log("wrangler dev pandi kinni."); }
process.exit(code ?? 1);
