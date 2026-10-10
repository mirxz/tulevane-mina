// Õnneratas: maandumisleht ja sisend-/resoneerimistest. Üks küsimus korraga; esimene keerutus määrab järjekorra.
// Salvestame vastused anonüümselt (/api/r). E-post läheb eraldi tabelisse ega seo end vastustega.
const COL = ["#ff7a70", "#ffa352", "#ffd54a", "#8fd45a", "#4fd1c5", "#6aaef0", "#a58bf0"];
const SEKTORID = [
  { nimi: "Vajadus", q: "Homme hommikul ei pea sa enam tööle minema. Kui palju raha kuus on vaja, et su elu ikka hea tunduks?" },
  { nimi: "Riiklik pension", q: "Kas sa tead, mis pensioni sulle riik lubab?" },
  { nimi: "Sambad", q: "Kui palju on sul pensionisammastes ja kas sa tead, kus see on?" },
  { nimi: "Kõrvalraha", q: "Kui palju raha on sul kõrval, mida saaksid homme kasutada?" },
  { nimi: "Eluiga", q: "Kui peaksid panema number: mis vanuses sa lahkud? Ja kas su raha on selleks ajaks veel olemas?" },
  { nimi: "Auto ja kodu", q: "Kas sa tahad ka 80-aastaselt oma autoga sõita ja oma kodus ärgata? Mis see sulle maksab?" },
  { nimi: "Ära koonerda", q: "Mille pärast sa 80-aastaselt ei tahaks öelda: oleks ma siis ikka lubanud?" },
];
const VALIKUD = [["tean", "Tean täpselt"], ["umbes", "Umbes"], ["eitea", "Ei tea"]];
const N = SEKTORID.length;

const $app = document.getElementById("app");
const $teade = document.getElementById("teade");
const alk = (new URLSearchParams(location.search).get("k") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
const sid = (() => { try { return crypto.randomUUID(); } catch { return "s" + Math.random().toString(36).slice(2) + Date.now().toString(36); } })();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const st = { samm: "intro", jarjekord: [], i: 0, vastused: {}, angle: 0, maandus: -1, meil: "" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function send(o) {
  try { fetch("/api/r", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sid, alk, ...o }), keepalive: true }).catch(() => {}); } catch {}
}
function say(t) { $teade.textContent = ""; setTimeout(() => ($teade.textContent = t), 30); }
function fokus() { const h = $app.querySelector("h1, h2"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: false }); } }

function ratas() {
  const seg = 360 / N, R = 190, cx = 200, cy = 200;
  const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
  let w = "";
  SEKTORID.forEach((s, i) => {
    const [x1, y1] = pt(i * seg, R), [x2, y2] = pt((i + 1) * seg, R);
    w += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${COL[i]}" stroke="#fff" stroke-width="3"/>`;
    const mid = (i + 0.5) * seg;
    w += `<g transform="translate(${cx} ${cy}) rotate(${mid})"><text transform="rotate(${mid > 180 ? 90 : -90})" x="${mid > 180 ? -44 : 44}" y="7" text-anchor="${mid > 180 ? "end" : "start"}" font-size="19" font-weight="700" fill="#002f63" font-family="Roboto,Arial,sans-serif">${esc(s.nimi)}</text></g>`;
  });
  return `<div class="wheelbox"><svg viewBox="0 0 400 400" role="img" aria-label="Vikerkaarevärvi õnneratas seitsme sektoriga: ${SEKTORID.map((s) => s.nimi).join(", ")}"><circle cx="200" cy="200" r="196" fill="#002f63"/><g id="kettaGrp" style="transform:rotate(${st.angle}deg)">${w}</g><circle cx="200" cy="200" r="30" fill="#fff" stroke="#002f63" stroke-width="5"/><circle cx="200" cy="200" r="7" fill="#fce228" stroke="#002f63" stroke-width="2"/></svg>
<svg class="pointer" viewBox="-2 -4 34 40" aria-hidden="true"><path d="M15 34 L1 4 Q15 -4 29 4 Z" fill="#fce228" stroke="#002f63" stroke-width="3" stroke-linejoin="round"/></svg></div>`;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function intro() {
  st.samm = "intro";
  $app.innerHTML = `<section class="intro"><h1>Mis elu sa võidad?</h1>
<p>Keeruta ratast. Ta valib, millise pensioniküsimusega alustad. Kokku seitse küsimust, umbes kaks minutit.</p>
${ratas()}
<div id="alla"><button class="btn block spinbtn" id="spin">Keeruta ratast</button></div>
<p class="hint">Mäng ja test, mitte ennustus ega nõuanne. Nime ei küsi, vastused on anonüümsed.</p></section>`;
  $app.querySelector("#spin").addEventListener("click", keeruta);
  document.title = "Mis elu sa võidad? · Tulevane Mina";
}

function keeruta() {
  const btn = $app.querySelector("#spin"); btn.disabled = true; btn.textContent = "Ratas keerleb…";
  const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  const t = Math.floor(rnd() * N), frac = 0.15 + rnd() * 0.7, seg = 360 / N;
  const sihtNurk = (((-(t + frac) * seg - st.angle) % 360) + 360) % 360;
  st.angle += (reduce ? 0 : 360 * 5) + sihtNurk;
  st.maandus = t;
  st.jarjekord = [t, ...shuffle([...Array(N).keys()].filter((x) => x !== t))];
  send({ ev: "spin", jarjekord: st.jarjekord.join(",") });
  const g = $app.querySelector("#kettaGrp");
  requestAnimationFrame(() => requestAnimationFrame(() => (g.style.transform = `rotate(${st.angle}deg)`)));
  setTimeout(maandus, reduce ? 200 : 5000);
}

function maandus() {
  const s = SEKTORID[st.maandus];
  $app.querySelector("#alla").innerHTML = `<div class="landed" style="background:${COL[st.maandus]}"><span>Ratas peatus</span><b>${esc(s.nimi)}</b><span>Alustad sellega. Ülejäänud kuus tulevad segamini.</span></div>
<button class="btn block spinbtn" id="alusta" style="margin-top:12px">Alusta küsimustega</button>`;
  say("Ratas peatus sektoril " + s.nimi);
  const b = $app.querySelector("#alusta"); b.addEventListener("click", () => { st.i = 0; kysimus(); }); b.focus();
}

function kysimus() {
  st.samm = "q";
  const sek = st.jarjekord[st.i], s = SEKTORID[sek], v = st.vastused[sek] || { valik: "", tekst: "" };
  const seg = st.jarjekord.map((x, k) => `<i class="${k < st.i ? "done" : k === st.i ? "now" : ""}" style="${k < st.i ? "background:" + COL[x] : ""}"></i>`).join("");
  $app.innerHTML = `<div class="prog" role="progressbar" aria-label="Edenemine" aria-valuemin="1" aria-valuemax="${N}" aria-valuenow="${st.i + 1}" aria-valuetext="Küsimus ${st.i + 1} / ${N}">${seg}</div>
<div class="proglab"><span>Küsimus ${st.i + 1} / ${N}</span><span>${N - st.i - 1 ? "veel " + (N - st.i - 1) : "viimane"}</span></div>
<span class="chipS" style="background:${COL[sek]}">${esc(s.nimi)}</span>
<h2 class="qh">${esc(s.q)}</h2>
<fieldset><legend class="sr">Sinu vastus</legend>${VALIKUD.map(([k, l]) => `<label class="ch"><input type="radio" name="valik" value="${k}" ${v.valik === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
<label class="f"><span>Oma sõnadega (pole kohustuslik)</span><textarea id="tekst" maxlength="280" placeholder="Mis tuli pähe? Ära kirjuta nime ega numbreid.">${esc(v.tekst)}</textarea></label>
<div class="sticky${st.i ? "" : " solo"}">${st.i ? '<button class="btn out" id="tagasi">Tagasi</button>' : ""}<button class="btn" id="edasi" ${v.valik ? "" : "disabled"}>${st.i === N - 1 ? "Lõpeta" : "Edasi"}</button></div>`;
  const edasi = $app.querySelector("#edasi");
  $app.querySelectorAll("input[name=valik]").forEach((r) => r.addEventListener("change", () => (edasi.disabled = false)));
  edasi.addEventListener("click", () => {
    const valik = $app.querySelector("input[name=valik]:checked")?.value; if (!valik) return;
    const tekst = $app.querySelector("#tekst").value.trim().slice(0, 280);
    st.vastused[sek] = { valik, tekst };
    send({ ev: "answer", sektor: sek, pos: st.i + 1, valik, tekst });
    if (st.i === N - 1) lopp(); else { st.i++; kysimus(); }
  });
  const tg = $app.querySelector("#tagasi");
  if (tg) tg.addEventListener("click", () => { const valik = $app.querySelector("input[name=valik]:checked")?.value; if (valik) st.vastused[sek] = { valik, tekst: $app.querySelector("#tekst").value.trim().slice(0, 280) }; st.i--; kysimus(); });
  say("Küsimus " + (st.i + 1) + " / " + N + ": " + s.nimi);
  fokus(); window.scrollTo(0, 0);
}

function lopp() {
  st.samm = "lopp";
  send({ ev: "done" });
  const cnt = { tean: 0, umbes: 0, eitea: 0 }; Object.values(st.vastused).forEach((a) => cnt[a.valik]++);
  const eitea = Object.entries(st.vastused).filter(([, a]) => a.valik === "eitea").map(([k]) => SEKTORID[k].nimi);
  const jutt = eitea.length ? `Sa ei teadnud ${eitea.length === 1 ? "ühte asja" : eitea.length + " asja"}: ${eitea.map((x) => x.toLowerCase()).join(", ")}. Just seal aitab elukaar.` : "Sa teadsid kõike täpselt või umbes. Seda juhtub harva.";
  $app.innerHTML = `<section class="card thanks"><h1>Aitäh, see aitas meid</h1>
<p>See oli sisendi- ja resoneerimistest. Me ei andnud sulle vastust, tahame teada, millest sa aru said ja mis jäi puudu.</p>
<div class="sumrow"><div><b>${cnt.tean}</b><span>täpselt</span></div><div><b>${cnt.umbes}</b><span>umbes</span></div><div><b>${cnt.eitea}</b><span>ei tea</span></div></div>
<p class="small">${esc(jutt)}</p></section>
<form class="card" id="meil" novalidate><h2>Tahad päris lahendust proovida?</h2>
<p>Pühapäeva hommikul avame prototüübi, kus ehitad oma pensionipõlve kiht kihi haaval ja näed, kas raha jätkub. Jäta e-post, saadame lingi.</p>
<label class="f"><span>E-post</span><input type="email" id="email" autocomplete="email" inputmode="email" placeholder="nimi@näide.ee"></label>
<div class="hp" aria-hidden="true"><label>Ära täida <input type="text" id="veeb" tabindex="-1" autocomplete="off"></label></div>
<label class="chk"><input type="checkbox" id="nous"><span>Nõustun, et mulle saadetakse selle prototüübi testilink. Kasutame e-posti ainult selleks ega seo seda sinu vastustega.</span></label>
<p class="err" id="viga" role="alert" hidden></p>
<button class="btn block" type="submit">Saada mulle link</button>
<p class="small">E-posti ei pea jätma. Vastused on ka ilma selleta salvestatud.</p></form>
<div class="card"><h2>Näita sõbrale</h2><p class="small">Mida rohkem erinevaid inimesi vastab, seda parem lahendus.</p><button class="btn out block" id="jaga">Jaga ratast</button></div>`;
  $app.querySelector("#meil").addEventListener("submit", meil);
  $app.querySelector("#jaga").addEventListener("click", jaga);
  document.title = "Aitäh · Tulevane Mina";
  say("Aitäh, vastused on salvestatud."); fokus(); window.scrollTo(0, 0);
}

async function meil(e) {
  e.preventDefault();
  const f = e.currentTarget, v = f.querySelector("#email").value.trim(), er = f.querySelector("#viga");
  er.hidden = true;
  if (f.querySelector("#veeb").value) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 120) { er.textContent = "Kontrolli e-posti aadressi."; er.hidden = false; f.querySelector("#email").focus(); return; }
  if (!f.querySelector("#nous").checked) { er.textContent = "Märgi ära, et nõustud lingi saatmisega."; er.hidden = false; f.querySelector("#nous").focus(); return; }
  const nupp = f.querySelector("button[type=submit]"); nupp.disabled = true;
  try {
    const r = await fetch("/api/r", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ev: "email", email: v, alk }) });
    if (!r.ok) throw new Error();
    f.innerHTML = '<div class="ok" role="status"><b>Aitäh!</b> Saadame lingi pühapäeva hommikul.</div>';
    say("E-post salvestatud");
  } catch { nupp.disabled = false; er.textContent = "Ei saanud salvestada. Proovi hetke pärast uuesti."; er.hidden = false; }
}

async function jaga() {
  const url = location.origin + "/ratas/?k=jagatud", data = { title: "Mis elu sa võidad?", text: "Keeruta pensioniratast. Seitse küsimust, kaks minutit.", url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); say("Link kopeeritud"); $app.querySelector("#jaga").textContent = "Link kopeeritud"; } catch { prompt("Kopeeri link", url); }
}

intro();
