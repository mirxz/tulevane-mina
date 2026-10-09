// Mootori test: mängib palju juhuslikke mänge läbi ja kontrollib, et kõik lõpevad ja numbrid on mõistlikud.
import { readFileSync } from "node:fs";
import * as E from "../public/arhiiv/lauamang/engine.js";
const cards = JSON.parse(readFileSync(new URL("../public/arhiiv/lauamang/kaardid.json", import.meta.url), "utf8"));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("  ✗ " + m); } };
const stats = { rounds: [], scores: [], deaths: [] };
for (let g = 0; g < 400; g++) {
  const r = rng(g + 1);
  const mode = ["yksi", "paar", "seltskond"][g % 3];
  const n = mode === "yksi" ? 1 : mode === "paar" ? 2 : 4;
  const players = Array.from({ length: n }, (_, i) => ({ name: "M" + i, start: (g + i) % 5 }));
  const s = E.newGame(cards, { mode, players }, r);
  let guard = 0;
  while (!s.over && guard++ < 30) {
    for (const p of s.players.filter((x) => x.alive && !x.ready)) {
      for (const ci of p.pendingDecisions.slice(0, 2)) E.decide(cards, s, p, ci, r() < 0.5 ? "a" : (cards.otsus[ci].nimi === "Riikliku pensioni ajastus" ? ["a", "b", "c"][Math.floor(r() * 3)] : "b"), r);
      const keys = p.working ? ["lisatoo", "tervis", "lahedased", "room", "roomPaid"] : ["tervis", "lahedased", "room", "roomPaid"];
      for (let t = 0; t < 4; t++) E.setAction(s, p, keys[Math.floor(r() * keys.length)], 1);
      if (p.working && p.konto > 2) E.setIiiDeposit(p, 1);
      E.drawEvent(cards, s, p, r);
      E.finishTurn(cards, s, p);
      ok(p.konto >= 0, "konto negatiivne"); ok(p.tervis >= 0 && p.tervis <= 10, "tervis vahemikust väljas");
    }
    if (s.mode === "paar" && r() < 0.5) E.agree(s);
    E.endRound(cards, s, r);
  }
  ok(s.over, "mäng ei lõppenud 30 vooruga");
  stats.rounds.push(s.round);
  for (const p of s.players) { stats.scores.push(p.score.kokku); stats.deaths.push(p.diedAt); }
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`400 mängu: keskmiselt ${avg(stats.rounds).toFixed(1)} vooru, punktid ${avg(stats.scores).toFixed(1)} (min ${Math.min(...stats.scores)}, max ${Math.max(...stats.scores)}), lahkumise vanus ${avg(stats.deaths).toFixed(1)}`);
ok(avg(stats.deaths) > 70 && avg(stats.deaths) < 90, "keskmine lahkumise vanus ebarealistlik");
console.log(fail ? `${fail} viga` : "Mootor korras");
process.exit(fail ? 1 : 0);
