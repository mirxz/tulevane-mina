// Tulevane Mina – lauamängu digiversioon.
// L2: üksi telefonis. L3: paar või seltskond kas ühes telefonis (kordamööda) või igaüks oma telefonis (võrgutuba /api/mang/tuba).
// Reeglid elavad failis engine.js; siin on ainult kasutajaliides ja toa sünkroonimine.
import * as E from "./engine.js";
import { speak, stopSpeak, esc, say, SAFE, eur } from "./yhine.js";

const app = document.getElementById("app");
const chip = document.getElementById("chip");
let C = null; // kaardid
let S = null; // mänguolek
const DEF_CUSTOM = { vanus: 35, too: 3, vaba: 2, ii: 5, fond: "kallis", tervis: 6, lahedased: 3, room: 2 };
const ui = {
  mode: "yksi", device: "yks", n: 3, err: "", ack: 0, uncovered: "", health: {}, phone: null, lastView: "",
  players: [0, 1, 2, 3, 4, 5].map((i) => ({ name: "", start: [1, 2, 0, 3, 4, 1][i], voice: i % 2 ? "N" : "M", custom: { ...DEF_CUSTOM } })),
};
const net = { code: null, ver: 0, seat: null, timer: null };

// ---------- käivitus ----------
(async function init() {
  C = await (await fetch("kaardid.json")).json();
  E.riskOf.cards = C;
  const q = new URLSearchParams(location.search);
  const code = (q.get("tuba") || "").toUpperCase();
  if (/^[A-Z]{5}$/.test(code)) await join(code);
  render();
})();

// ---------- abifunktsioonid ----------
const count = () => (ui.mode === "yksi" ? 1 : ui.mode === "paar" ? 2 : ui.n);
const pById = (s, id) => s.players.find((p) => p.id === id);
const eraName = (age) => E.ERAS.find((e) => e.id === E.eraOf(age)).nimi;
const resultsKey = () => (S ? S.round + (S.over ? 1000 : 0) : 0);
const defaultName = (i) => (ui.mode === "yksi" ? "Mina" : ui.mode === "paar" ? ["Mina", "Kaaslane"][i] : "Mängija " + (i + 1));
const bar = (label, v) => `<div class="bar"><span>${label}</span><span class="track" aria-hidden="true"><span class="fill" style="width:${v * 10}%;display:block"></span></span><b>${v}</b></div>`;
const btn = (act, label, extra = "", cls = "btn") => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${label}</button>`;

function currentPlayer() {
  if (!S) return null;
  if (net.code) return net.seat ? pById(S, net.seat) : null;
  return S.players.find((p) => p.alive && !p.ready) || null;
}

function view() {
  if (!S) return "setup";
  if (net.code && !net.seat) return "koht";
  if (ui.ack !== resultsKey() && ui.ack !== 0) return "tulemus";
  if (S.over) return "lopp";
  const p = currentPlayer();
  if (net.code) return p && p.alive && !p.ready ? "kaik" : "ootan";
  if (S.mode !== "yksi" && ui.uncovered !== p.id + ":" + S.round) return "kate";
  return "kaik";
}

// ---------- muudatused (kohalik või võrgutuba) ----------
// fn(s) muudab olekut; tagastab vea teksti või midagi muud. Võrgus proovitakse 409 korral uuesti värske olekuga.
// Käigud lähevad järjekorras, et kiired puudutused ei jookseks võrgus üksteisest mööda.
let chain = Promise.resolve();
let busy = 0, touched = 0;
function act(fn) { busy++; const r = chain.then(() => actNow(fn)).finally(() => busy--); chain = r.catch(() => {}); return r; }
async function actNow(fn) {
  ui.err = "";
  if (!net.code) { const r = fn(S); if (typeof r === "string") ui.err = r; render(); return typeof r !== "string"; }
  for (let i = 0; i < 5; i++) {
    const draft = structuredClone(S);
    const r = fn(draft);
    if (typeof r === "string") { ui.err = r; render(); return false; }
    let res;
    try { res = await fetch(`/api/mang/tuba/${net.code}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ver: net.ver, olek: draft }) }); }
    catch { ui.err = "Ühendus katkes. Proovi uuesti."; render(); return false; }
    if (res.ok) { net.ver = (await res.json()).ver; S = draft; render(); return true; }
    if (res.status === 409) { await pull(true); continue; }
    ui.err = "Tuba ei vastanud (" + res.status + ")."; render(); return false;
  }
  ui.err = "Liiga palju samaaegseid käike. Proovi uuesti."; render(); return false;
}
async function pull(force) {
  try {
    const r = await fetch(`/api/mang/tuba/${net.code}?ver=${force ? 0 : net.ver}`, { cache: "no-store" });
    if (r.status === 404) return "puudub";
    if (!r.ok) return "viga";
    const j = await r.json();
    if (j.muutus && (force || j.ver > net.ver)) { net.ver = j.ver; S = j.olek; return "muutus"; }
    return "sama";
  } catch { return "viga"; }
}
async function join(code) {
  net.code = code;
  const r = await pull(true);
  if (r === "puudub" || r === "viga") { net.code = null; ui.err = r === "puudub" ? "Sellise koodiga tuba ei leitud." : "Tuppa ei saanud ühendust."; return false; }
  try { net.seat = localStorage.getItem("mina-tuba-" + code); } catch {}
  if (net.seat && !pById(S, net.seat)) net.seat = null;
  ui.ack = resultsKey();
  history.replaceState(null, "", "?tuba=" + code);
  startPolling();
  return true;
}
function startPolling() {
  clearInterval(net.timer);
  net.timer = setInterval(async () => { if (document.hidden || busy || Date.now() - touched < 600) return; if ((await pull(false)) === "muutus") render(); }, 1500);
}

// ---------- vaated ----------
function render() {
  const v = view();
  const focusKey = document.activeElement?.dataset?.k;
  chip.textContent = S ? `Voor ${S.round}${net.code ? " · tuba " + net.code : ""}` : "Lauamäng v0.1";
  app.innerHTML = (ui.err ? `<p class="note" role="alert">${esc(ui.err)}</p>` : "") + ({ setup, koht, tulemus, lopp, kaik, ootan, kate })[v]();
  app.querySelectorAll("[data-act]").forEach((el) => { el.dataset.k = el.dataset.act + "|" + (el.dataset.id || "") + "|" + (el.dataset.o || "") + "|" + (el.dataset.d || ""); });
  if (v !== ui.lastView) { ui.lastView = v; const h = app.querySelector("h1, h2"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: false }); } window.scrollTo(0, 0); }
  else if (focusKey) { const el = [...app.querySelectorAll("[data-k]")].find((x) => x.dataset.k === focusKey); if (el) el.focus({ preventScroll: true }); }
}

function setup() {
  const n = count();
  const modes = [["yksi", "Üksi", "Planeerimisõhtu iseendaga"], ["paar", "Paar", "Kahe elu kokkulepped"], ["seltskond", "Seltskond", "3–6 mängijat, sõbrad või pere"]];
  let h = `<section class="hero"><h1>Elu viieaastaste voorudena</h1>
  <p>Igas voorus on sul 3 tegevusmärki, üks sündmus ja üks vestlus. Ajastu lõpus helistab sulle tulevane sina. Mäng lõpeb, kui elukell nii otsustab.</p>
  <p class="small">Mängid paberlauaga? <a href="kaaslane.html">Ava kaaslane</a>: elukell, kaardid ja kõned.</p></section>
  <section class="card" aria-labelledby="h-kes"><h2 id="h-kes">Kes mängib?</h2><div class="grid3">`;
  for (const [k, l, d] of modes) h += `<button type="button" class="opt" data-act="mode" data-o="${k}" aria-pressed="${ui.mode === k}"><b>${l}</b><span class="small">${d}</span></button>`;
  h += `</div>`;
  if (ui.mode !== "yksi") {
    h += `<h3>Kuidas mängite?</h3><div class="grid2">
    <button type="button" class="opt" data-act="device" data-o="yks" aria-pressed="${ui.device === "yks"}"><b>Ühes telefonis</b><span class="small">Annate telefoni kordamööda edasi</span></button>
    <button type="button" class="opt" data-act="device" data-o="tuba" aria-pressed="${ui.device === "tuba"}"><b>Igaüks oma telefonis</b><span class="small">Loote toa ja jagate koodi</span></button></div>`;
  }
  if (ui.mode === "seltskond") h += `<label class="f">Mängijaid<select data-in="n">${[3, 4, 5, 6].map((x) => `<option ${x === ui.n ? "selected" : ""}>${x}</option>`).join("")}</select></label>`;
  h += `</section>`;
  for (let i = 0; i < n; i++) {
    const pl = ui.players[i];
    h += `<section class="card" aria-labelledby="h-p${i}"><h2 id="h-p${i}">${n === 1 ? "Sinu stardikaart" : "Mängija " + (i + 1)}</h2>
    <label class="f">Nimi<input type="text" maxlength="20" data-in="name" data-i="${i}" value="${esc(pl.name)}" placeholder="${esc(defaultName(i))}" autocomplete="off"></label>
    <label class="f">Stardikaart<select data-in="start" data-i="${i}">${C.start.map((s, k) => `<option value="${k}" ${k === pl.start ? "selected" : ""}>${esc(s.nimi)}${s.vanus ? " · " + s.vanus + " a" : ""}</option>`).join("")}</select></label>
    <p class="small">${esc(C.start[pl.start].lisa)}</p>`;
    if (pl.start === 5) {
      const c = pl.custom;
      const num = (k, l, lo, hi) => `<label class="f">${l}<input type="number" inputmode="numeric" min="${lo}" max="${hi}" data-in="c-${k}" data-i="${i}" value="${c[k]}"></label>`;
      h += `<div class="grid2">${num("vanus", "Vanus", 25, 75)}${num("too", "Palk voorus (münti)", 0, 10)}${num("vaba", "Kontol (münti)", 0, 40)}${num("ii", "II sammas (münti)", 0, 60)}
      <label class="f">Fond<select data-in="c-fond" data-i="${i}"><option value="kallis" ${c.fond === "kallis" ? "selected" : ""}>Aktiivne / kallis</option><option value="indeks" ${c.fond === "indeks" ? "selected" : ""}>Indeksfond</option></select></label>
      ${num("tervis", "Tervis 1–10", 1, 10)}${num("lahedased", "Lähedased 1–10", 1, 10)}${num("room", "Rõõm 1–10", 1, 10)}</div>
      <p class="small">Suurusjärgud, mitte täpsed summad: 1 münt ≈ 5 000 €. Midagi ei salvestata${ui.device === "tuba" && ui.mode !== "yksi" ? " peale mängutoa oleku (3 päeva)" : ""}.</p>`;
    }
    h += `<label class="f">Tulevase mina hääl<select data-in="voice" data-i="${i}"><option value="M" ${pl.voice === "M" ? "selected" : ""}>Mehehääl</option><option value="N" ${pl.voice === "N" ? "selected" : ""}>Naisehääl</option></select></label></section>`;
  }
  const online = ui.mode !== "yksi" && ui.device === "tuba";
  h += btn("start", online ? "Loo tuba" : "Alusta mängu", "", "btn block");
  h += `<section class="card" aria-labelledby="h-liitu"><h2 id="h-liitu">Sõber lõi juba toa?</h2><div class="row"><label class="sr" for="kood">Toa kood</label><input id="kood" type="text" maxlength="5" autocapitalize="characters" autocomplete="off" placeholder="ABCDE" data-in="kood" style="flex:1;text-transform:uppercase">${btn("join", "Liitu")}</div></section>`;
  return h;
}

function koht() {
  const link = location.origin + "/mang/?tuba=" + net.code;
  let h = `<section class="hero"><h1>Tuba ${net.code}</h1><p>Jaga koodi või linki. Iga mängija avab selle oma telefonis ja valib, kes ta on.</p>
  <p class="code" aria-label="Toa kood ${net.code.split("").join(" ")}">${net.code}</p><p class="small" style="word-break:break-all">${esc(link)}</p>
  <div class="row">${btn("share", "Jaga linki", "", "btn out")}</div></section>
  <section class="card"><h2>Kes sina oled?</h2><div class="grid2">`;
  for (const p of S.players) {
    const taken = S.claims && S.claims[p.id];
    h += `<button type="button" class="opt" data-act="seat" data-id="${p.id}" ${taken ? "disabled" : ""}><b>${esc(p.name)}</b><span class="small">${taken ? "Juba võetud" : esc(p.startName) + " · " + p.age + " a"}</span></button>`;
  }
  h += `</div><p class="small">Mäng algab kohe, kui oled koha valinud. Su tervisekaarti näed ainult sina.</p></section>`;
  return h;
}

function kate() {
  const p = currentPlayer();
  return `<section class="hero" style="text-align:center"><h1>Anna telefon: ${esc(p.name)}</h1><p>Teised, palun ärge piiluge: tervisekaart on salajane.</p>
  ${btn("uncover", "Olen " + esc(p.name) + ", alusta käiku", "", "btn block")}</section>${othersList()}`;
}

function othersList() {
  const rows = S.players.map((p) => `<li>${esc(p.name)}: ${!p.alive ? "lahkus " + p.diedAt + "-aastaselt" : p.ready ? "käik tehtud" : "mõtleb"}</li>`).join("");
  return `<section class="card"><h3>Laud</h3><ul class="small" style="margin:0;padding-left:18px">${rows}</ul></section>`;
}

function ootan() {
  const p = currentPlayer();
  const waiting = S.players.filter((x) => x.alive && !x.ready).map((x) => esc(x.name));
  const head = p && !p.alive ? `<h1>${esc(p.name)} lahkus ${p.diedAt}-aastaselt</h1><p>Võid edasi kaasa elada ja vestlustes kaasa rääkida.</p>` : `<h1>Käik tehtud</h1><p>Ootame: ${waiting.join(", ") || "kõik on valmis"}.</p>`;
  return `<section class="hero">${head}</section>${S.groupCard !== null && S.mode === "seltskond" ? groupCard() : ""}${othersList()}`;
}

function groupCard() {
  return `<div class="gamecard k-vestlus"><div class="head"><span>Ühine vestlus</span><span>kõik</span></div><div class="body"><p style="margin:0">${esc(C.vestlus[S.groupCard].tekst)}</p></div></div>`;
}

function kaik() {
  const s = S, p = currentPlayer();
  const eco = C.majandus[s.ecoNow];
  const sum = (s.roundSummary.find((r) => r.id === p.id) || { lines: [] }).lines;
  const base = 65 + p.pensionShift;
  let h = `<section class="card"><div class="between"><h2>${esc(p.name)}, ${p.age}</h2><span class="chip">Ajastu ${E.eraOf(p.age)} · ${eraName(p.age)}</span></div>
  <div class="gamecard k-majandus"><div class="head"><span>Majandus</span><span>voor ${s.round}</span></div><div class="body"><b>${esc(eco.nimi)}</b><span class="small">${esc(eco.tekst)}</span></div></div>
  ${sum.length ? `<ul class="small" style="margin:0;padding-left:18px">${sum.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
  ${s.mode === "seltskond" && s.groupCard !== null ? groupCard() : ""}</section>`;

  // seis
  const pens = p.pension.choice ? `${p.pension.amount} / voor ${p.pension.start}-st` : `${base}-st`;
  h += `<section class="card" aria-labelledby="h-seis"><h3 id="h-seis">Sinu seis</h3>
  <div class="money"><div><b>${p.konto}</b><span>Konto</span></div><div><b>${p.ii}</b><span>II sammas · ${p.fund === "indeks" ? "indeks" : "kallis"}</span></div><div><b>${p.iii}</b><span>III sammas</span></div><div><b style="font-size:15px">${pens}</b><span>Riiklik pension</span></div></div>
  <p class="small">${p.working ? `Töötad, palk ${p.too} münti voorus${p.partTime ? " (pool koormust)" : ""}.` : "Pensionil, elamiskulu " + (E.COSTS_RETIRED + p.costsExtra) + " voorus."}${p.kodu ? ` Kodu väärtus ${p.kodu.value}${p.kodu.loan ? ", laenu " + p.kodu.loan + " vooru" : ", laen makstud"}.` : ""} Vara kokku ${E.vara(p)} münti ≈ ${eur(E.vara(p))}.</p>
  <div class="res">${bar("Tervis", p.tervis)}${bar("Lähedased", p.lahedased)}${bar("Rõõm", p.room)}</div>
  <p class="small">Turvalisus <b>${p.turvalisus}</b> · Mured <b class="${p.mured ? "bad" : ""}">${p.mured}</b>${p.parand ? " · Pärandi kaart" : ""}</p>`;
  const r = E.riskOf(p, C), open = ui.health[p.id];
  h += `<button type="button" class="btn out" data-act="health" data-id="${p.id}" aria-expanded="${!!open}" aria-controls="tk-${p.id}">${open ? "Peida tervisekaart" : "Vaata peidetud tervisekaarti"}</button>
  <div id="tk-${p.id}" class="gamecard k-tervis" ${open ? "" : "hidden"}><div class="head"><span>Tervisekaart</span><span>salajane</span></div><div class="body"><b>${esc(r.klass)}</b><span class="small">${esc(r.tekst)}</span>${p.riskNeutral ? '<span class="ok">Tervisekontroll: miinus on ohjatud.</span>' : ""}</div></div></section>`;

  // 1. otsused
  const doneEra = p.decisionsDone.filter((i) => C.otsus[i].ajastu === E.eraOf(p.age)).length;
  const pend = p.pendingDecisions.filter((i) => !(C.otsus[i].nimi === "Riikliku pensioni ajastus" && p.pension.choice) && !(C.otsus[i].nimi === "Sammaste väljamakse" && (p.fp.on || p.fp.lumpDone)));
  h += `<section class="card" aria-labelledby="h-ots"><h3 id="h-ots">1. Ajastu otsused</h3>`;
  if (doneEra >= 2) h += `<p class="small">Selle ajastu 2 otsust on tehtud. Järgmised tulevad uue ajastuga.</p>`;
  else if (!pend.length) h += `<p class="small">Selles ajastus pole otsuseid jäänud.</p>`;
  else {
    h += `<p class="small">Ajastus saad teha kuni 2 otsust (${doneEra}/2). Võid ka oodata järgmise voorini.</p>`;
    for (const i of pend) {
      const c = C.otsus[i];
      const opts = c.nimi === "Riikliku pensioni ajastus"
        ? [["a", `Varem (${base - 5})`, "6 münti voorus kogu eluks"], ["b", `Õigel ajal (${base})`, "8 münti voorus"], ["c", `Hiljem (${base + 5})`, "11 münti voorus, kuni selleni töötad"]]
        : [["a", "A", c.a], ["b", "B", c.b]];
      h += `<div class="gamecard k-otsus"><div class="head"><span>Otsus · ajastu ${c.ajastu}</span>${c.poord === false ? "" : '<span>pöördumatu</span>'}</div><div class="body"><b>${esc(c.nimi)}</b><span class="small">${esc(c.tekst)}</span>
      ${opts.map(([o, l, t]) => `<button type="button" class="opt" data-act="decide" data-d="${i}" data-o="${o}"><b>${esc(l)}</b><span class="small">${esc(t)}</span></button>`).join("")}</div></div>`;
    }
  }
  h += `</section>`;

  // 2. tegevusmärgid
  const free = E.freeTokens(p), a = p.actions;
  const others = s.players.filter((x) => x.alive && x.id !== p.id);
  const rows = [["lisatoo", "Lisatöö: +1 münt", p.working], ["tervis", "Tervis +1", true], ["lahedased", "Lähedased +1", true], ["room", "Rõõm +1", true], ["roomPaid", "Rõõm rahaga: 2 münti → +3", true], ["aita", "Aita teist: tema Tervis +1", others.length > 0]];
  h += `<section class="card" aria-labelledby="h-tok"><div class="between"><h3 id="h-tok">2. Tegevusmärgid</h3><span class="chip">vabu ${free} / ${p.tokens}</span></div>`;
  for (const [k, l, on] of rows) {
    if (!on) continue;
    h += `<div class="tok"><span>${l}</span><button type="button" data-act="tok" data-o="${k}" data-d="-1" aria-label="${l}: vähem" ${a[k] ? "" : "disabled"}>−</button><output aria-label="${l}">${a[k]}</output><button type="button" data-act="tok" data-o="${k}" data-d="1" aria-label="${l}: rohkem" ${free ? "" : "disabled"}>+</button></div>`;
  }
  if (others.length && a.aita) h += `<label class="f">Keda aitad?<select data-in="aitaKellele">${others.map((x) => `<option value="${x.id}" ${a.aitaKellele === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>`;
  if (p.working) {
    const locked = p.noIiiRounds && s.round <= p.noIiiRounds;
    h += `<div class="tok"><span>III sambasse sel voorul (münti)${p.iiiAuto ? " + 1 automaatselt" : ""}</span><button type="button" data-act="iii" data-d="-1" aria-label="III sammas: vähem" ${p.iiiDeposit ? "" : "disabled"}>−</button><output aria-label="III sambasse">${p.iiiDeposit}</output><button type="button" data-act="iii" data-d="1" aria-label="III sammas: rohkem" ${!locked && p.iiiDeposit < p.konto ? "" : "disabled"}>+</button></div>
    <p class="small">${locked ? "Sinu stardikaart ei luba esimesel kahel voorul III sambasse panna." : "Iga 4 sissemakstud mündi eest +1 tulumaksutagastust. Sissemaks ei võta tegevusmärki."}</p>`;
  }
  h += `</section>`;

  // 3. sündmus
  h += `<section class="card" aria-labelledby="h-sy"><h3 id="h-sy">3. Sündmus</h3>`;
  if (p.event === null) h += `<p class="small">Paiguta märgid enne. Mõni sündmus vaatab, kuhu oma aja panid.</p>${btn("event", "Tõmba sündmuskaart", "", "btn out")}`;
  else { const ev = C.sundmus[p.event]; h += `<div class="gamecard k-sundmus"><div class="head"><span>Sündmus · ajastu ${ev.ajastu}</span></div><div class="body"><b>${esc(ev.nimi)}</b><span class="small">${esc(ev.tekst)}</span><b>${esc(p.eventResult)}</b></div></div>`; }
  h += `</section>`;

  // 4. vestlus
  if (s.mode !== "seltskond" && p.vestlus !== null) {
    h += `<section class="card" aria-labelledby="h-ve"><h3 id="h-ve">4. Vestlus</h3><div class="gamecard k-vestlus"><div class="head"><span>Vestlus</span><span>${E.modeLabel(s.mode)}</span></div><div class="body"><p style="margin:0">${esc(C.vestlus[p.vestlus].tekst)}</p></div></div>`;
    if (s.mode === "paar") h += s.agreedRound === s.round ? `<p class="ok">Kokkulepe sõlmitud: Lähedased +1 mõlemale.</p>` : `${btn("agree", "Jõudsime kokkuleppele", "", "btn out")}<p class="small">Kui räägite küsimuse läbi ja lepite milleski kokku, saavad mõlemad +1 Lähedased.</p>`;
    else h += `<p class="small">Mõtle või kirjuta vastus paberile. Seda ei salvestata.</p>`;
    h += `</section>`;
  }
  h += btn("finish", "Lõpetan käigu", p.event === null ? "disabled aria-describedby=\"fin-n\"" : "", "btn block") + (p.event === null ? `<p class="small" id="fin-n">Tõmba enne sündmuskaart.</p>` : "");
  if (s.log.length || p.log.length) h += `<details class="card"><summary>Käikude logi</summary><ul class="small">${[...p.log].reverse().slice(0, 12).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>`;
  return h;
}

function tulemus() {
  const calls = S.lastCalls || [];
  const dead = new Set(calls.filter((c) => c.kind === "lopp").map((c) => c.id));
  if (ui.phone) return phone();
  let h = `<section class="hero"><h1>${S.over ? "Viimane voor" : "Viis aastat möödus"}</h1><p>Kõik said 5 aastat vanemaks. 55+ võtab vanus 1 Tervise. 60+ veeretatakse elukella.</p></section><section class="card"><h2>Elukell</h2><ul style="margin:0;padding-left:18px;display:grid;gap:6px">`;
  for (const p of S.players) {
    if (!p.alive && !dead.has(p.id)) continue;
    const L = p.lastLife && p.age >= 60 && (p.alive || dead.has(p.id)) ? ` Veeretus ${p.lastLife.roll}${p.lastLife.mod ? (p.lastLife.mod > 0 ? " + " : " − ") + Math.abs(p.lastLife.mod) : ""}, piir ${p.lastLife.t}.` : "";
    h += `<li><b>${esc(p.name)}</b>: ${dead.has(p.id) ? `<span class="bad">lahkus ${p.diedAt}-aastaselt.</span>` : `on nüüd ${p.age}.`}${L}</li>`;
  }
  h += `</ul></section>`;
  const mine = calls.filter((c) => !net.code || c.id === net.seat);
  if (mine.length) {
    h += `<section class="card"><h2>Telefon heliseb</h2>`;
    for (const c of mine) { const p = pById(S, c.id); h += btn("call", `Tulevane ${esc(p.name)} helistab`, `data-id="${c.id}"`, "btn accept block"); }
    h += `<p class="small">${SAFE}</p></section>`;
  }
  h += btn("ack", S.over ? "Vaata lõpptulemust" : "Järgmine voor", "", "btn block");
  return h;
}

function callerAge(p, kind) { return kind === "lopp" ? p.diedAt : Math.max(87, p.age + 10); }
function phone() {
  const { id, kind, talk } = ui.phone;
  const p = pById(S, id);
  const c = C.tulevane[p.call] || C.tulevane[C.tulevane.length - 1];
  const age = callerAge(p, kind);
  let h = `<section class="phone" aria-labelledby="h-tel"><div class="av" aria-hidden="true">${esc(p.name[0] || "M")}</div><h2 id="h-tel" class="who" style="color:#fff">Tulevane ${esc(p.name)}</h2><p style="margin:0">${age}-aastane${kind === "lopp" ? " · viimane kõne" : ""}</p>`;
  if (!talk) h += `<div class="grid2">${btn("ring-no", "Ära vasta", "", "btn out")}${btn("ring-yes", "Võta vastu", "", "btn accept")}</div>`;
  else h += `<q>${esc(c.tekst.replace(/[„“]/g, ""))}</q><p class="small" style="color:#c9e0ee;margin:0">${esc(c.tingimus)}</p><div class="grid2">${btn("ring-again", "Kuula uuesti", "", "btn out")}${btn("ring-end", "Lõpeta kõne", "", "btn")}</div>`;
  h += `<p class="safe">${SAFE}</p></section>`;
  return h;
}

function lopp() {
  const g = E.goal(S);
  let h = `<section class="hero"><h1>${g.ok ? "Hea elu" : "Elu sai elatud"}</h1><p>${esc(g.tekst)}. Tulemus: <b>${g.tulemus}</b> / ${g.siht}.</p></section>
  <section class="card"><h2>Punktid</h2><div style="overflow-x:auto" tabindex="0" role="region" aria-label="Punktitabel"><table class="score"><tr><th>Mängija</th><th>Rõõm</th><th>Lähed.</th><th>Tervis/2</th><th>Turval.</th><th>Pärand</th><th>Mured</th><th>Kokku</th></tr>`;
  for (const p of S.players) { const sc = p.score || E.score(p); h += `<tr><td>${esc(p.name)} · ${p.diedAt || p.age}</td><td>${sc.room}</td><td>${sc.lahedased}</td><td>${sc.tervis}</td><td>${sc.turvalisus}</td><td>${sc.parand}</td><td>${sc.mured}</td><td><b>${sc.kokku}</b></td></tr>`; }
  h += `</table></div></section><section class="card"><h2>Pärast mängu</h2><p>Mis oli üks otsus, mille te päris elus teeksite teisiti? Kirjuta see üles. Mängu tulemusi ei salvestata.</p></section>${btn("restart", "Uus mäng", "", "btn block")}`;
  return h;
}

// ---------- sündmused ----------
const H = {
  mode: (d) => { ui.mode = d.o; if (ui.mode === "yksi") ui.device = "yks"; render(); },
  device: (d) => { ui.device = d.o; render(); },
  start: async () => {
    const setupObj = { mode: ui.mode, players: ui.players.slice(0, count()).map((pl, i) => ({ name: pl.name.trim() || defaultName(i), voice: pl.voice, start: pl.start === 5 ? customStart(pl.custom) : pl.start })) };
    const s = E.newGame(C, setupObj);
    if (ui.mode !== "yksi" && ui.device === "tuba") {
      s.claims = {};
      try {
        const r = await fetch("/api/mang/tuba", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ olek: s }) });
        if (!r.ok) throw 0;
        const j = await r.json();
        S = s; net.code = j.kood; net.ver = j.ver; ui.ack = resultsKey();
        history.replaceState(null, "", "?tuba=" + j.kood);
        startPolling();
      } catch { ui.err = "Tuba ei õnnestunud luua. Proovige ühes telefonis."; }
    } else { S = s; ui.ack = resultsKey(); }
    say("Mäng algas.");
    render();
  },
  join: async () => { const code = (document.getElementById("kood").value || "").toUpperCase().trim(); if (!/^[A-Z]{5}$/.test(code)) { ui.err = "Toa kood on 5 tähte."; render(); return; } ui.err = ""; await join(code); render(); },
  share: async () => { const link = location.origin + "/mang/?tuba=" + net.code; try { if (navigator.share) await navigator.share({ title: "Tulevane Mina", text: "Tule mängima, toa kood " + net.code, url: link }); else { await navigator.clipboard.writeText(link); say("Link kopeeritud."); } } catch {} },
  seat: async (d) => { const ok = await act((s) => { s.claims = s.claims || {}; if (s.claims[d.id]) return "See koht on juba võetud."; s.claims[d.id] = true; }); if (ok) { net.seat = d.id; try { localStorage.setItem("mina-tuba-" + net.code, d.id); } catch {} render(); } },
  uncover: () => { const p = currentPlayer(); ui.uncovered = p.id + ":" + S.round; render(); },
  health: (d) => { ui.health[d.id] = !ui.health[d.id]; render(); },
  decide: (d) => { const id = currentPlayer().id; act((s) => E.decide(C, s, pById(s, id), Number(d.d), d.o) || undefined).then((ok) => ok && say("Otsus tehtud.")); },
  tok: (d) => { const id = currentPlayer().id; act((s) => { const p = pById(s, id); if (!E.setAction(s, p, d.o, Number(d.d))) return "Vabu märke pole."; if (d.o === "aita" && !p.actions.aitaKellele) p.actions.aitaKellele = s.players.find((x) => x.alive && x.id !== id).id; }); },
  iii: (d) => { const id = currentPlayer().id; act((s) => { const p = pById(s, id); E.setIiiDeposit(p, p.iiiDeposit + Number(d.d)); }); },
  event: () => { const id = currentPlayer().id; act((s) => { E.drawEvent(C, s, pById(s, id)); }).then(() => { const p = currentPlayer(); if (p && p.event !== null) say(C.sundmus[p.event].nimi + ". " + p.eventResult); }); },
  agree: () => act((s) => { E.agree(s); }),
  finish: (d, b) => { b.disabled = true; b.textContent = net.code ? "Saadan…" : "Lõpetan…"; const id = currentPlayer().id; ui.health = {}; act((s) => { E.finishTurn(C, s, pById(s, id)); if (E.allReady(s)) E.endRound(C, s); }); },
  call: (d) => { const c = S.lastCalls.find((x) => x.id === d.id); ui.phone = { id: d.id, kind: c.kind, talk: false }; render(); },
  "ring-yes": () => { ui.phone.talk = true; render(); playCall(); },
  "ring-again": () => playCall(),
  "ring-no": () => { ui.phone = null; render(); },
  "ring-end": () => { stopSpeak(); ui.phone = null; render(); },
  ack: () => { ui.ack = resultsKey(); ui.phone = null; render(); },
  restart: () => { clearInterval(net.timer); S = null; net.code = null; net.seat = null; ui.ack = 0; history.replaceState(null, "", location.pathname); render(); },
};
function playCall() { const p = pById(S, ui.phone.id); const c = C.tulevane[p.call] || C.tulevane[C.tulevane.length - 1]; speak(c.tekst, p.voice); }
function customStart(c) {
  const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  return { nimi: "Minu enda elu", vanus: n(c.vanus, 25, 75), too: n(c.too, 0, 10), vaba: n(c.vaba, 0, 40), ii: n(c.ii, 0, 60), fond: c.fond, tervis: n(c.tervis, 1, 10), lahedased: n(c.lahedased, 1, 10), room: n(c.room, 1, 10) };
}

app.addEventListener("pointerdown", () => { touched = Date.now(); });
app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const f = H[b.dataset.act];
  if (f) f(b.dataset, b);
});
app.addEventListener("input", (e) => {
  const t = e.target, k = t.dataset.in, i = Number(t.dataset.i);
  if (!k || t.tagName === "SELECT") return;
  if (k === "name") ui.players[i].name = t.value;
  else if (k.startsWith("c-")) ui.players[i].custom[k.slice(2)] = t.value;
});
app.addEventListener("change", (e) => {
  const t = e.target, k = t.dataset.in, i = Number(t.dataset.i);
  if (!k || t.tagName !== "SELECT") return;
  if (k === "n") ui.n = Number(t.value);
  else if (k === "start") ui.players[i].start = Number(t.value);
  else if (k === "voice") ui.players[i].voice = t.value;
  else if (k === "c-fond") ui.players[i].custom.fond = t.value;
  else if (k === "aitaKellele") { const id = currentPlayer().id; act((s) => { pById(s, id).actions.aitaKellele = t.value; }); return; }
  render();
});
app.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "kood") H.join(); });
