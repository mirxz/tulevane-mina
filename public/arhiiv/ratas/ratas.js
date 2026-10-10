// Õnneratas: maandumisleht ja sisend-/resoneerimistest. Üks küsimus korraga; esimene keerutus määrab järjekorra.
// Salvestame vastused anonüümselt (/api/r). E-post läheb eraldi tabelisse ega seo end vastustega.
const COL = ["#ff7a70", "#ffa352", "#ffd54a", "#8fd45a", "#4fd1c5", "#6aaef0", "#a58bf0"];
const SEKTORID = [
  { nimi: "Kuu kulud", q: "Homme hommikul ei pea sa enam tööle minema. Kas tead, kui palju raha kuus sul vaja on, et elu ikka hea tunduks?" },
  { nimi: "Riiklik pension", q: "Kas tead, kui suurt pensioni riik sulle maksma hakkab?" },
  { nimi: "II ja III sammas", q: "Kas tead, kui palju raha on sul pensionisammastes ja kus see raha on?" },
  { nimi: "Säästud", q: "Kas tead, kui palju on sul kõrvale pandud raha, mida saaksid kohe kasutada?" },
  { nimi: "Kui kaua elad", q: "Kas tead, mis vanuseni sa tõenäoliselt elad ja kas su rahast jätkub nii kauaks?" },
  { nimi: "Auto ja kodu", q: "Kas tead, mis maksab see, et saaksid ka 80-aastaselt oma autoga sõita ja oma kodus ärgata?" },
  { nimi: "Unistused", q: "Kas tead, mida tahad endale pensionil kindlasti lubada, et 80-aastaselt ei peaks kahetsema?" },
];
const VALIKUD = [["tean", "Tean täpselt"], ["umbes", "Tean umbes"], ["eitea", "Ei tea"]];
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
    const [rot, x, anchor] = silt(mid);
    w += `<g transform="translate(${cx} ${cy}) rotate(${mid})"><text class="lbl" data-mid="${mid}" transform="rotate(${rot})" x="${x}" y="7" text-anchor="${anchor}" font-size="19" font-weight="700" fill="#002f63" font-family="Roboto,Arial,sans-serif">${esc(s.nimi)}</text></g>`;
  });
  return `<div class="wheelbox"><svg viewBox="0 0 400 400" role="img" aria-label="Vikerkaarevärvi õnneratas seitsme sektoriga: ${SEKTORID.map((s) => s.nimi).join(", ")}"><circle cx="200" cy="200" r="196" fill="#002f63"/><g id="kettaGrp" style="transform:rotate(${st.angle}deg)">${w}</g><circle cx="200" cy="200" r="30" fill="#fff" stroke="#002f63" stroke-width="5"/><circle cx="200" cy="200" r="7" fill="#fce228" stroke="#002f63" stroke-width="2"/></svg>
<svg class="pointer" viewBox="-2 -4 34 40" aria-hidden="true"><path d="M15 34 L1 4 Q15 -4 29 4 Z" fill="#fce228" stroke="#002f63" stroke-width="3" stroke-linejoin="round"/></svg></div>`;
}

// Silt loetakse ekraani, mitte ketta järgi: vasakul poolel pööratakse ümber, et tekst poleks tagurpidi.
function silt(mid) { const abs = (((mid + st.angle) % 360) + 360) % 360; return abs > 180 ? [90, -44, "end"] : [-90, 44, "start"]; }
function pooraSildid() {
  $app.querySelectorAll(".lbl").forEach((t) => { const [rot, x, anchor] = silt(+t.dataset.mid); t.setAttribute("transform", `rotate(${rot})`); t.setAttribute("x", x); t.setAttribute("text-anchor", anchor); });
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function intro() {
  st.samm = "intro";
  $app.innerHTML = `<section class="intro"><h1>Mis elu sa võidad?</h1>
<p class="lead">Ole enda vastu aus: keeruta pensioniratast ja ütle, millised teemad oled enda jaoks läbi mõelnud.</p>
<p>Seitse küsimust, vastamine võtab umbes kaks minutit.</p>
<p>Ratas valib, millisele küsimusele vastad esimesena.</p>
${ratas()}
<div id="alla"><button class="btn block spinbtn" id="spin">Keeruta ratast</button></div>
<p class="hint">See ei ole ennustus ega finantsnõuanne. Vastused on anonüümsed.<br>Kui jätad lõpus e-posti, ei seo me seda vastustega.</p></section>`;
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
  pooraSildid();
  $app.querySelector("#alla").innerHTML = `<div class="landed" style="background:${COL[st.maandus]}"><span>Ratas peatus</span><b>${esc(s.nimi)}</b><span>Esimene küsimus on sellel teemal, seejärel tulevad ülejäänud kuus.</span></div>
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
<fieldset id="valikud" role="radiogroup" aria-required="true" aria-describedby="valikViga"><legend class="req">Vali vastus (kohustuslik)</legend>${VALIKUD.map(([k, l]) => `<label class="ch"><input type="radio" name="valik" value="${k}" ${v.valik === k ? "checked" : ""}><span>${l}</span></label>`).join("")}<p class="err fielderr" id="valikViga" role="alert" hidden></p></fieldset>
<label class="f"><span>Mida tahaksid lisada? (pole kohustuslik)</span><textarea id="tekst" maxlength="280" aria-describedby="tekstVihje">${esc(v.tekst)}</textarea><span class="small" id="tekstVihje">Ära kirjuta nime ega numbreid.</span></label>
<div class="sticky${st.i ? "" : " solo"}">${st.i ? '<button class="btn out" id="tagasi">Tagasi</button>' : ""}<button class="btn" id="edasi">${st.i === N - 1 ? "Lõpeta" : "Edasi"}</button></div>`;
  const edasi = $app.querySelector("#edasi");
  const $fs = $app.querySelector("#valikud"), $viga = $app.querySelector("#valikViga");
  const vigaPeitu = () => { $viga.hidden = true; $viga.textContent = ""; $fs.classList.remove("invalid"); $fs.querySelectorAll("input").forEach((r) => r.removeAttribute("aria-invalid")); };
  $app.querySelectorAll("input[name=valik]").forEach((r) => r.addEventListener("change", vigaPeitu));
  edasi.addEventListener("click", () => {
    const valik = $app.querySelector("input[name=valik]:checked")?.value;
    if (!valik) {
      $viga.textContent = "Vali üks vastus, et edasi minna."; $viga.hidden = false; $fs.classList.add("invalid");
      $fs.querySelectorAll("input").forEach((r) => r.setAttribute("aria-invalid", "true"));
      $fs.querySelector("input").focus(); return;
    }
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
  const jutt = eitea.length ? `${eitea.length === 1 ? "Üks teema" : eitea.length + " teemat"} jäi sulle lahtiseks: ${eitea.map((x) => x.toLowerCase()).join(", ")}. Pühapäeval avatav prototüüp aitab need välja selgitada.` : "Sa teadsid kõike täpselt või umbes. Seda juhtub harva.";
  $app.innerHTML = `<section class="card thanks"><h1>Aitäh, see aitas meid</h1>
<p>Siin polnud õigeid ega valesid vastuseid. Tahtsime teada, mida sa oma pensionist juba tead ja mis on veel lahtine.</p>
<div class="sumrow"><div><b>${cnt.tean}</b><span>täpselt</span></div><div><b>${cnt.umbes}</b><span>umbes</span></div><div><b>${cnt.eitea}</b><span>ei tea</span></div></div>
<p class="small">${esc(jutt)}</p></section>
<form class="card" id="meil" novalidate><h2>Tahad päris lahendust proovida?</h2>
<p>Pühapäeva hommikul avame prototüübi, kus ehitad oma pensionipõlve kiht kihi haaval ja näed, kas raha jätkub. Jäta e-post, saadame lingi.</p>
<label class="f"><span>E-post</span><input type="email" id="email" autocomplete="email" inputmode="email" placeholder="nimi@näide.ee"></label>
<div class="hp" aria-hidden="true"><label>Ära täida <input type="text" id="veeb" tabindex="-1" autocomplete="off"></label></div>
<label class="chk"><input type="checkbox" id="nous"><span>Nõustun, et mulle saadetakse selle prototüübi testilink. Kasutame e-posti ainult selleks ega seo seda sinu vastustega.</span></label>
<p class="err" id="viga" role="alert" hidden></p>
<button class="btn block" type="submit">Saada mulle link</button>
<p class="small">E-posti ei pea jätma. Su vastused on salvestatud ka ilma selleta.</p></form>
<div class="card"><h2>Näita sõbrale</h2><p class="small">Mida rohkem erinevaid inimesi vastab, seda parema lahenduse saame teha.</p><button class="btn out block" id="jaga">Jaga ratast</button></div>`;
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
  } catch { nupp.disabled = false; er.textContent = "E-posti salvestamine ebaõnnestus. Proovi hetke pärast uuesti."; er.hidden = false; }
}

async function jaga() {
  const url = location.origin + "/arhiiv/ratas/?k=jagatud", data = { title: "Mis elu sa võidad?", text: "Keeruta pensioniratast. Seitse küsimust, kaks minutit.", url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); say("Link kopeeritud"); $app.querySelector("#jaga").textContent = "Link kopeeritud"; } catch { prompt("Kopeeri link", url); }
}

intro();
