// Mõõtmise vaated tulemuste lehele (puhtad funktsioonid: andmed sisse, HTML välja, et neid saaks ilma serverita testida).
// Kõik kellaajad ja tunnijaotused on Tallinna aja järgi (vt aeg.js). Andmed on anonüümsed: sid on ainult seansi juhuslik tunnus.
import { tallinn, tanaPaev } from "./aeg.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pc = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–");
const kanal = (k) => k || "otse";

// Elukaare sammud (data-label failis public/elukaar/index.html). Sammud 1–3 jäävad praegu vahele.
export const SAMMUD = ["Sina", "0–18", "18", "18–55", "55 a", "60", "65", "66+", "Kulud", "Tulemus"];
export const VIIMANE_SAMM = SAMMUD.length - 1;
export const sammNimi = (n) => (n >= 0 && n < SAMMUD.length ? n + " · " + SAMMUD[n] : "samm " + n);

// 24 tunni tulpdiagramm (CSS-iga, ilma teegita). counts: 24 arvu.
export function tunniTulbad(counts, pealkiri) {
  const max = Math.max(1, ...counts), kokku = counts.reduce((a, b) => a + b, 0);
  const kirjeldus = pealkiri + ": kokku " + kokku + ". " + counts.map((n, h) => String(h).padStart(2, "0") + ":00 " + n).filter((_, h) => counts[h] > 0).join(", ");
  return '<div class="hbwrap"><p class="small hbt"><b>' + esc(pealkiri) + "</b> · kokku " + kokku + '</p><div class="hb" role="img" aria-label="' + esc(kirjeldus) + '">' +
    counts.map((n, h) => '<div title="' + String(h).padStart(2, "0") + ":00 · " + n + '"><span class="n">' + (n || "") + '</span><div class="bar"><i style="height:' + Math.round((100 * n) / max) + '%"></i></div><span class="h">' + h + "</span></div>").join("") + "</div></div>";
}
// rows: [{ ts }]. Tagastab { tana: [24], koik: [24], paevad: [{ paev, n }] viimased 7 päeva }.
export function tunniJaotus(rows, now = new Date()) {
  const tana = Array(24).fill(0), koik = Array(24).fill(0), paevad = {};
  const t0 = tanaPaev(now);
  for (const r of rows) {
    const t = tallinn(r.ts); if (!t) continue;
    const w = r.n == null ? 1 : Number(r.n) || 0; // r.n: loenduri väärtus (mitu sündmust tunni jooksul)
    koik[t.tund] += w; paevad[t.paev] = (paevad[t.paev] || 0) + w;
    if (t.paev === t0) tana[t.tund] += w;
  }
  const seitse = [];
  for (let i = 6; i >= 0; i--) { const p = tanaPaev(new Date(now.getTime() - i * 864e5)); seitse.push({ paev: p, n: paevad[p] || 0 }); }
  return { tana, koik, paevad: seitse };
}
export function ajaplokk(rows, nimi, now = new Date()) {
  const j = tunniJaotus(rows, now);
  const seitse = "<table><tr><th>Päev (Tallinn)</th>" + j.paevad.map((d) => "<th>" + d.paev.slice(5).replace("-", ".") + "</th>").join("") + "</tr><tr><th>" + esc(nimi) + "</th>" + j.paevad.map((d) => "<td>" + d.n + "</td>").join("") + "</tr></table>";
  return tunniTulbad(j.tana, "Täna tundide kaupa (Tallinna aeg) · " + nimi) + tunniTulbad(j.koik, "Kõik päevad kokku, kellaaja järgi · " + nimi) + '<div class="wrap">' + seitse + "</div>";
}

// ---- Kutsekirjad: saadetud → klikid allika (variandi) lõikes ----
// saadetud: [{ variant, ok, vigu }]; klikid: [{ ts, k }]
export function kutseVaade(saadetud, klikid, now = new Date()) {
  const rida = (v) => {
    const s = saadetud.find((r) => r.variant === v) || {}, n = klikid.filter((r) => r.k === "kutse-" + v).length;
    return { v, ok: Number(s.ok) || 0, vigu: Number(s.vigu) || 0, n };
  };
  const R = ["a", "b", "c"].map(rida);
  const kokkuOk = R.reduce((a, r) => a + r.ok, 0), kokkuN = R.reduce((a, r) => a + r.n, 0);
  const t = "<table><tr><th>Allikas (?k=…)</th><th>Saadetud</th><th>Klikke</th><th>Klikke / saadetud</th></tr>" +
    R.map((r) => "<tr><th>kutse-" + r.v + "</th><td>" + r.ok + (r.vigu ? " (" + r.vigu + " viga)" : "") + "</td><td>" + r.n + "</td><td><b>" + pc(r.n, r.ok) + "</b></td></tr>").join("") +
    "<tr><th>Kokku</th><td>" + kokkuOk + "</td><td>" + kokkuN + "</td><td><b>" + pc(kokkuN, kokkuOk) + "</b></td></tr></table>";
  return '<section><h2>Kutsekirjad</h2><p class="small">Konversioon = klikke avalehel / saadetud kirju. Klikk loetakse avalehe avamisel lingiga ?k=kutse-…; sama inimene võib klikkida mitu korda ja linkide eelvaate robotid võivad lisada klikke, seega ületada 100% on võimalik. Väike valim, loe hüpoteesina.</p><div class="wrap">' + t + "</div>" + ajaplokk(klikid, "klikke", now) + "</section>";
}

// ---- Elukaare ja maandumislehe vaated: seansside kokkuvõtted + tunniloendurid ----
// Meil ei ole sündmuste logi ega ühe kasutaja teekonda. seansid: [{ k, p, esimene, viimane, samm_max, klikke, maandus, edasi, elukaar, tagasiside }] (üks rida seansi kohta, ilma tunnuseta);
// loendur: [{ tund: "2026-10-11T07" (UTC), ev, k, samm, nimi, n }] (tunnipõhised summad, ilma seansita).
const loendurRead = (L, ev) => L.filter((r) => r.ev === ev).map((r) => ({ ts: r.tund + ":30:00Z", n: r.n })); // keset tundi: Tallinna ja UTC tunnid on täistunnid, nii langeb ts õigesse tundi

// Seansi pikkus = esimesest viimase tegevuseni (lehe avamine, samm või klikk). Lahkumist ega aegumist ei mõõda; üksiku tegevusega seansid (pikkus 0) jäävad välja.
export function seansiPikkused(seansid) {
  return seansid.map((s) => (Date.parse(s.viimane) - Date.parse(s.esimene)) / 1000).filter((x) => x > 0 && isFinite(x)).sort((a, b) => a - b);
}
export const mediaan = (a) => (a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null);
export const keskmine = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export function mmss(sek) {
  if (sek == null || !isFinite(sek)) return "–";
  const t = Math.round(sek);
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
}

export function sundmusteVaade(seansid, loendur, tagasisideRows, now = new Date()) {
  const kanalid = [...new Set(seansid.map((s) => kanal(s.k)))].sort();
  const tagN = {}; for (const a of tagasisideRows) { const k = kanal(a.allikas); tagN[k] = (tagN[k] || 0) + 1; }
  for (const k of Object.keys(tagN)) if (!kanalid.includes(k)) kanalid.push(k);
  const loe = (arr, f) => arr.filter(f).length;
  const sammud = [
    ["Maandus", (s) => s.maandus], ["Valis profiili", (s) => s.edasi], ["Elukaar avati", (s) => s.elukaar],
    ["Jõudis tulemuseni", (s) => s.samm_max >= VIIMANE_SAMM], ["Tagasiside leht", (s) => s.tagasiside],
  ];
  const kohad = (arr, i) => { const n = loe(arr, sammud[i][1]); return n + (i ? " (" + pc(n, loe(arr, sammud[i - 1][1])) + ")" : ""); };
  const pikkus = (arr) => { const a = seansiPikkused(arr.filter((s) => s.elukaar)); return a.length ? mmss(keskmine(a)) + " / " + mmss(mediaan(a)) + " (" + a.length + ")" : "–"; };
  const funnelRida = (nimi, arr, vastas) => "<tr><th>" + esc(nimi) + "</th>" + sammud.map((_, i) => "<td>" + kohad(arr, i) + "</td>").join("") + "<td>" + vastas + "</td><td>" + pikkus(arr) + "</td></tr>";
  const funnel = "<table><tr><th>Kanal (?k=…)</th>" + sammud.map((x) => "<th>" + x[0] + "</th>").join("") + "<th>Vastas</th><th>Elukaare pikkus<br>keskm. / mediaan (n)</th></tr>" +
    (seansid.length || tagasisideRows.length ? kanalid.map((k) => funnelRida(k, seansid.filter((s) => kanal(s.k) === k), tagN[k] || 0)).join("") + funnelRida("Kokku", seansid, tagasisideRows.length) : "<tr><td colspan=8>Veel pole.</td></tr>") + "</table>";

  // Elukaare seansi pikkus (üldine)
  const pk = seansiPikkused(seansid.filter((s) => s.elukaar));
  const pikkuseKast = pk.length
    ? '<p style="font-size:28px;line-height:36px;margin:0"><b>' + mmss(keskmine(pk)) + "</b> keskmine · " + mmss(mediaan(pk)) + " mediaan</p>"
    : '<p style="margin:0">Veel pole piisavalt andmeid.</p>';

  // Eelprofiilid (seansi esimese valitud profiili järgi)
  const profiilid = {};
  for (const s of seansid) { if (!s.edasi && !s.elukaar) continue; const p = s.p || "määramata"; (profiilid[p] = profiilid[p] || { edasi: 0, avas: 0, tulemus: 0 }); const g = profiilid[p]; if (s.edasi) g.edasi++; if (s.elukaar) g.avas++; if (s.samm_max >= VIIMANE_SAMM) g.tulemus++; }
  const pt = "<table><tr><th>Eelprofiil (?p=…)</th><th>Valis maandumislehel</th><th>Elukaar avati</th><th>Jõudis tulemuseni</th><th>% avanenutest</th></tr>" +
    (Object.entries(profiilid).sort((a, b) => b[1].avas - a[1].avas || b[1].edasi - a[1].edasi).map(([p, g]) => "<tr><th>" + esc(p) + "</th><td>" + g.edasi + "</td><td>" + g.avas + "</td><td>" + g.tulemus + "</td><td>" + pc(g.tulemus, g.avas) + "</td></tr>").join("") || "<tr><td colspan=5>Veel pole.</td></tr>") + "</table>";

  // Elukaar: seansid tundide kaupa (seansi esimene tegevus), kaugeim samm, valitud vaated ja klikid
  const elukaarSeansse = seansid.filter((s) => s.elukaar || s.samm_max >= 0);
  const kasutus = elukaarSeansse.map((s) => ({ ts: s.esimene }));
  const kaugeim = {}; for (const s of elukaarSeansse) if (s.samm_max >= 0) kaugeim[s.samm_max] = (kaugeim[s.samm_max] || 0) + 1;
  const vaated = {}, klikkSammul = {};
  for (const r of loendur) { if (r.ev === "samm") vaated[r.samm] = (vaated[r.samm] || 0) + r.n; if (r.ev === "klikk") klikkSammul[r.samm] = (klikkSammul[r.samm] || 0) + r.n; }
  const sammuRead = SAMMUD.map((nimi, n) => ({ n, nimi, kaugeim: kaugeim[n] || 0, vaated: vaated[n] || 0, klikke: klikkSammul[n] || 0 })).filter((r) => r.kaugeim || r.vaated || r.klikke);
  const st = "<table><tr><th>Samm</th><th>Seansse, kus see oli kõige kaugem</th><th>% seanssidest</th><th>Vaatamisi</th><th>Klikke</th></tr>" + (sammuRead.map((r) => "<tr><th>" + esc(sammNimi(r.n)) + "</th><td>" + r.kaugeim + "</td><td>" + pc(r.kaugeim, elukaarSeansse.length) + "</td><td>" + r.vaated + "</td><td>" + r.klikke + "</td></tr>").join("") || "<tr><td colspan=5>Veel pole.</td></tr>") + "</table>";
  const klikid = {};
  for (const r of loendur) if (r.ev === "klikk" && r.nimi) klikid[r.nimi] = (klikid[r.nimi] || 0) + r.n;
  const kt = "<table><tr><th>Klikk / valik</th><th>Klikke</th></tr>" + (Object.entries(klikid).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([nimi, n]) => "<tr><th>" + esc(nimi) + "</th><td>" + n + "</td></tr>").join("") || "<tr><td colspan=2>Veel pole.</td></tr>") + "</table>";

  return '<section><h2>Funnel kanalite kaupa</h2><p class="small">Üks seanss = üks brauseri vahekaart (juhuslik tunnus, ilma küpsise ja IP-ta). Sulgudes osa eelmisest sammust. Elukaare otselingiga tulijad on ilma maandumiseta, seetõttu võivad hilisemad sammud olla suuremad kui varasemad. Tagasiside vastused on kanali kaupa eraldi, need ei ole seansiga seotud.</p><div class="wrap">' + funnel + "</div></section>" +
    '<section><h2>Elukaare seansi pikkus</h2>' + pikkuseKast + '<p class="small">Esimesest viimase tegevuseni (lehe avamine, samm või klikk). Lahkumist ega aegumist me ei mõõda, seega on see alt hinnang. Üksiku tegevusega seansid (pikkus 0) ei ole sees. Seansse arvestatud: ' + pk.length + ".</p></section>" +
    '<section><h2>Maandumisleht (avaleht)</h2><p class="small">Millal maanduti (lehe avamisi tunnis) ja milline eelprofiil valiti elukaarele minekuks.</p>' + ajaplokk(loendurRead(loendur, "maandumine"), "maandumisi", now) + '<p class="small" style="margin-top:12px">Eelprofiilide kaupa:</p><div class="wrap">' + pt + "</div></section>" +
    '<section><h2>Elukaar: kasutus</h2><p class="small">Seansi esimene tegevus tundide kaupa; sammud ja klikid näitavad, kuhu inimesed jõuavad. Klikkidest salvestame ainult valikute nimed (nt makseviisi valik) tunnipõhiste summadena, mitte sisestatud väärtusi ega üksiku kasutaja teekonda.</p>' + ajaplokk(kasutus, "seansse", now) +
    '<p class="small" style="margin-top:12px">Klikke tundide kaupa:</p>' + ajaplokk(loendurRead(loendur, "klikk"), "klikke", now) +
    '<p class="small" style="margin-top:12px">Sammud:</p><div class="wrap">' + st + '</div><p class="small" style="margin-top:12px">Enim klikitud valikud:</p><div class="wrap">' + kt + "</div></section>";
}

// ---- Tagasiside: allika lõikes ja kellaajaliselt ----
// A: tagasiside_vastused read ({ ts, allikas, taitmine, vanus_vastus, uus, muudaks }).
export function tagasisideKanaliVaade(A, now = new Date()) {
  const G = {};
  for (const a of A) { const k = kanal(a.allikas); const g = (G[k] = G[k] || { n: 0, jah: 0, vanus: 0, uus: 0, muuda: 0 }); g.n++; if (a.taitmine === "jah") g.jah++; if (a.vanus_vastus === "jah") g.vanus++; if (a.uus === "jah") g.uus++; if (a.muudaks === "jah") g.muuda++; }
  const kt = "<table><tr><th>Kanal (?k=…)</th><th>Vastajaid</th><th>Täitis ise</th><th>Oskab vanust</th><th>Uus teadmine</th><th>Muudaks</th></tr>" +
    (Object.entries(G).sort((x, y) => y[1].n - x[1].n).map(([k, g]) => "<tr><th>" + esc(k) + "</th><td>" + g.n + "</td><td>" + pc(g.jah, g.n) + "</td><td>" + pc(g.vanus, g.n) + "</td><td>" + pc(g.uus, g.n) + "</td><td>" + pc(g.muuda, g.n) + "</td></tr>").join("") || "<tr><td colspan=6>Veel pole.</td></tr>") + "</table>";
  return '<p class="small" style="margin-top:12px">Kanalite kaupa:</p><div class="wrap">' + kt + '</div><p class="small" style="margin-top:12px">Millal vastati:</p>' + ajaplokk(A, "vastuseid", now);
}
