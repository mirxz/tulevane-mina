// Paberlaua kaaslane: kaardipakid, elukell ja tulevase mina kõne. Midagi ei salvestata.
import { lifeThreshold } from "./engine.js";
import { speak, stopSpeak, esc, say, SAFE } from "./yhine.js";

const $ = (id) => document.getElementById(id);
const C = await (await fetch("kaardid.json")).json();
const decks = {};
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function draw(key, items) { if (!decks[key] || !decks[key].length) decks[key] = shuffle(items); return decks[key].shift(); }
const card = (cls, head, body) => `<div class="gamecard ${cls}"><div class="head"><span>${head}</span></div><div class="body">${body}</div></div>`;

let round = 0;
$("b-maj").onclick = () => { const c = draw("maj", C.majandus); round++; $("voor").textContent = "Voor " + round; $("o-maj").innerHTML = card("k-majandus", "Majandus", `<b>${esc(c.nimi)}</b><span class="small">${esc(c.tekst)}</span>`) + `<p class="small">Seejärel: sambad kasvavad, palk või pension kontole, kulud maha.</p>`; };
$("b-sy").onclick = () => { const era = $("s-era").value; const c = draw("sy" + era, C.sundmus.filter((x) => x.ajastu === era)); $("o-sy").innerHTML = card("k-sundmus", "Sündmus · ajastu " + era, `<b>${esc(c.nimi)}</b><span class="small">${esc(c.tekst)}</span>`); };

let veMode = "Paar";
document.querySelectorAll("[data-ve]").forEach((b) => (b.onclick = () => { veMode = b.dataset.ve; document.querySelectorAll("[data-ve]").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
$("b-ve").onclick = () => { const c = draw("ve" + veMode, C.vestlus.filter((x) => x.rezhiim === veMode)); $("o-ve").innerHTML = card("k-vestlus", "Vestlus · " + veMode, `<p style="margin:0">${esc(c.tekst)}</p>`) + (veMode === "Paar" ? `<p class="small">Kokkulepe = mõlemale +1 Lähedased.</p>` : ""); };

$("b-ek").onclick = () => {
  const age = Number($("e-age").value), mod = Number($("e-risk").value) + Number($("e-hp").value);
  const d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6), t = lifeThreshold(age), total = d1 + d2 + mod;
  const dead = age >= 95 || total <= t;
  $("o-ek").innerHTML = `<div class="dice" aria-hidden="true"><span class="die">${d1}</span><span class="die">${d2}</span></div>
  <p class="small" style="text-align:center">${d1} + ${d2}${mod ? (mod > 0 ? " + " : " − ") + Math.abs(mod) : ""} = <b>${total}</b> · piir ${t}${age >= 95 ? " · 95 lõpetab mängu" : ""}</p>
  <div class="${dead ? "loss-box" : "gain-box"}"><p class="big">${dead ? "Elu lõpeb " + age + "-aastaselt" : "Elad edasi"}</p><p class="small" style="text-align:center;margin:0">${dead ? "Loe punktid kokku ja võta vastu viimane kõne." : "Järgmine voor."}</p></div>`;
  say(`Veeretus ${d1} ja ${d2}, kokku ${total}, piir ${t}. ${dead ? "Elu lõpeb." : "Elad edasi."}`);
};

$("t-card").innerHTML = C.tulevane.map((c, i) => `<option value="${i}">${esc(c.tingimus.replace("Ajastu lõpp: ", ""))}</option>`).join("");
let calling = false;
function phone(talk) {
  const name = $("t-nimi").value.trim() || "Mina", c = C.tulevane[Number($("t-card").value)], age = $("t-age").value;
  $("o-tel").innerHTML = `<section class="phone" aria-label="Kõne"><div class="av" aria-hidden="true">${esc(name[0])}</div><p class="who" style="margin:0">Tulevane ${esc(name)}</p><p style="margin:0">${age}-aastane</p>
  ${talk ? `<q>${esc(c.tekst.replace(/[„“]/g, ""))}</q><div class="grid2"><button type="button" class="btn out" id="t-again">Kuula uuesti</button><button type="button" class="btn" id="t-end">Lõpeta kõne</button></div>`
    : `<div class="grid2"><button type="button" class="btn out" id="t-no">Ära vasta</button><button type="button" class="btn accept" id="t-yes">Võta vastu</button></div>`}
  <p class="safe">${SAFE}</p></section>`;
  if (talk) { $("t-again").onclick = () => speak(c.tekst, $("t-voice").value); $("t-end").onclick = () => { stopSpeak(); $("o-tel").innerHTML = ""; $("b-tel").focus(); }; speak(c.tekst, $("t-voice").value); $("t-end").focus(); }
  else { $("t-yes").onclick = () => phone(true); $("t-no").onclick = () => { $("o-tel").innerHTML = ""; $("b-tel").focus(); }; $("t-yes").focus(); }
}
$("b-tel").onclick = () => phone(false);
