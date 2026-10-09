// Tulevane Mina – lauamängu reeglimootor (paberprototüübi v0.1 reeglid).
// Puhtad funktsioonid: olek sisse, olek välja. Kasutavad nii üksi- ja kordamööda mäng kui ka võrgutoad.
// Juhuslikkus tuleb parameetrist rnd (vaikimisi Math.random), et teste saaks korrata.

export const ERAS = [
  { id: "I", nimi: "Alustamine", from: 0, to: 40 },
  { id: "II", nimi: "Ehitamine", from: 40, to: 55 },
  { id: "III", nimi: "Üleminek", from: 55, to: 70 },
  { id: "IV", nimi: "Saak", from: 70, to: 999 },
];
export const eraOf = (age) => ERAS.find((e) => age >= e.from && age < e.to).id;
export const MAX_AGE = 95;
export const COSTS_RETIRED = 7;
export const PENSION = { varem: 6, oige: 8, hiljem: 11 };
export const FP_ROUNDS = (age) => (age < 65 ? 5 : age < 70 ? 4 : age < 75 ? 3 : 2);
const LIFE = [[90, 7], [85, 6], [80, 5], [75, 4], [70, 3], [65, 3], [60, 2]];
export const lifeThreshold = (age) => { for (const [a, t] of LIFE) if (age >= a) return t; return 0; };

const clamp = (v, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, v));
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const d6 = (rnd) => 1 + Math.floor(rnd() * 6);
const vara = (p) => p.konto + p.ii + p.iii + (p.kodu ? p.kodu.value : 0);
const log = (s, p, t) => { (p ? p.log : s.log).push(t); };

// ---------- uus mäng ----------
export function newGame(cards, setup, rnd = Math.random) {
  riskOf.cards = cards;
  // setup: { mode: 'yksi'|'paar'|'seltskond', players: [{ name, start: index | custom{...}, voice:'M'|'N' }] }
  const healthDeck = shuffle(cards.tervis.map((_, i) => i), rnd);
  const players = setup.players.map((pl, i) => {
    const sc = typeof pl.start === "number" ? cards.start[pl.start] : pl.start;
    const p = {
      id: "p" + (i + 1), name: pl.name || "Mängija " + (i + 1), voice: pl.voice || "M",
      startName: sc.nimi, age: sc.vanus || 35, too: sc.too || 3, konto: sc.vaba || 0, ii: sc.ii || 0,
      fund: sc.fond === "indeks" ? "indeks" : "kallis", iii: 0, iiiAuto: false,
      tervis: clamp(sc.tervis || 6), lahedased: clamp(sc.lahedased || 3), room: clamp(sc.room || 2),
      mured: 0, turvalisus: 0, parand: sc.nimi === "Mõtlen pärandile", kodu: null,
      risk: healthDeck[i % healthDeck.length], riskShown: false, riskNeutral: false, tervisekontroll: false,
      alive: true, diedAt: null, working: true, partTime: false, iiPause: 0, iiWithdrawn: false,
      pension: { choice: null, start: null, amount: 0 }, pensionShift: 0, fp: { on: false, lumpDone: false },
      costsExtra: 0, careLoss: false, temp: [], actions: { lisatoo: 0, tervis: 0, lahedased: 0, room: 0, roomPaid: 0, aita: 0, aitaKellele: null },
      tokens: 3, iiiDeposit: 0, pendingDecisions: [], decisionsDone: [], event: null, eventDone: false,
      vestlus: null, vestlusDone: false, ready: false, call: null, log: [], score: null,
      noIiiRounds: sc.nimi === "Mõtlen hiljem" ? 2 : 0,
    };
    return p;
  });
  const decks = {};
  for (const e of ERAS) decks[e.id] = shuffle(cards.sundmus.map((c, i) => (c.ajastu === e.id ? i : -1)).filter((i) => i >= 0), rnd);
  const s = {
    v: 1, mode: setup.mode, round: 0, phase: "turn", players, decks,
    eco: shuffle(cards.majandus.map((_, i) => i), rnd), ecoNow: null,
    vestlus: shuffle(cards.vestlus.map((c, i) => (c.rezhiim === modeLabel(setup.mode) ? i : -1)).filter((i) => i >= 0), rnd),
    groupCard: null, log: [], over: false, roundSummary: [],
  };
  startRound(cards, s, rnd, true);
  return s;
}
export const modeLabel = (m) => (m === "paar" ? "Paar" : m === "seltskond" ? "Seltskond" : "Üksi");

// ---------- vooru algus: majandus, kasv, sissetulek, uus sündmus ja vestlus ----------
export function startRound(cards, s, rnd = Math.random, first = false) {
  s.round += 1;
  if (!s.eco.length) s.eco = shuffle(cards.majandus.map((_, i) => i), rnd);
  s.ecoNow = s.eco.shift();
  const eco = cards.majandus[s.ecoNow];
  s.roundSummary = [];
  if (s.mode === "seltskond") { if (!s.vestlus.length) s.vestlus = refillVestlus(cards, s, rnd); s.groupCard = s.vestlus.shift(); }
  for (const p of s.players.filter((x) => x.alive)) {
    const lines = [];
    // pensioniiga: reform nihutab nooremate oma
    if (eco.nimi === "Pensionireform" && p.age < 55 && !p.pension.choice) { p.pensionShift = 5; lines.push("Pensionireform: sinu pensioniiga nihkub 5 aastat hiljemaks."); }
    // fondide kasv
    if (!first) {
      const g2 = Math.floor(p.ii / (p.fund === "indeks" ? 4 : 5)), g3 = Math.floor(p.iii / 4);
      p.ii += g2; p.iii += g3;
      if (g2 + g3) lines.push(`Sambad kasvasid +${g2 + g3}.`);
      if (eco.nimi === "Turud tõusevad" && p.ii + p.iii > 0) { p.ii += p.ii > 0 ? 1 : 0; p.iii += p.iii > 0 ? 1 : 0; lines.push("Turud tõusid: sambad +1."); }
      if (eco.nimi === "Turud langevad") { const l2 = Math.floor(p.ii / 5), l3 = Math.floor(p.iii / 5); p.ii -= l2; p.iii -= l3; if (l2 + l3) lines.push(`Turud langesid: sambad −${l2 + l3}.`); }
      if (eco.nimi === "Kõrge inflatsioon") { const l = Math.floor(p.konto / 4); p.konto -= l; if (l) lines.push(`Inflatsioon sõi kontolt ${l}.`); }
      if (eco.nimi === "Intressid tõusevad") { if (p.kodu && p.kodu.loan > 0) { p.konto -= 1; lines.push("Kodulaenu intress: −1."); } const g = Math.floor(p.konto / 5); if (g) { p.konto += g; lines.push(`Hoiuse intress +${g}.`); } }
    }
    // pensioni algus
    autoPension(p);
    // sissetulek ja kulud
    let income = 0, cost = 0;
    const tempIncome = p.temp.filter((t) => t.kind === "income").reduce((a, t) => a + t.delta, 0);
    if (p.working) {
      income += Math.max(0, p.too + tempIncome);
      if (eco.nimi === "Palgad kasvavad") income += 1;
      if (p.iiPause > 0) p.iiPause -= 1; else p.ii += 1;
    } else {
      if (p.pension.start && p.age >= p.pension.start) { income += p.pension.amount + (eco.nimi === "Palgad kasvavad" ? 1 : 0); }
      if (p.partTime && p.tervis > 3) income += 2;
      cost += COSTS_RETIRED + p.costsExtra;
    }
    if (p.kodu && p.kodu.loan > 0) { cost += 1; p.kodu.loan -= 1; } else if (p.kodu && p.kodu.loan === 0) { income += 1; }
    if (p.fp.on && p.age >= 60) { const pile = p.ii + p.iii; if (pile > 0) { const pay = Math.ceil(pile / FP_ROUNDS(p.age)); const from2 = Math.min(p.ii, pay); p.ii -= from2; p.iii -= pay - from2; income += pay; lines.push(`Fondipension +${pay}.`); } }
    if (p.careLoss) { p.lahedased = clamp(p.lahedased - 1); lines.push("Koduhooldus: Lähedased −1."); }
    const extraCost = p.temp.filter((t) => t.kind === "cost").reduce((a, t) => a + t.delta, 0);
    cost += extraCost;
    p.konto += income - cost;
    if (income) lines.push(`Sissetulek +${income}.`); if (cost) lines.push(`Elamiskulu −${cost}.`);
    if (p.konto < 0) { p.konto = 0; p.mured += 1; p.room = clamp(p.room - 1); lines.push("Raha ei jätkunud: Mure ja Rõõm −1."); }
    else if (!first) p.turvalisus += 1;
    // III samba automaatne sissemakse
    if (p.iiiAuto && p.konto >= 1 && p.working) { p.konto -= 1; addIii(p, 1); }
    // ajutised mõjud aeguvad
    p.temp = p.temp.map((t) => ({ ...t, rounds: t.rounds - 1 })).filter((t) => t.rounds > 0);
    // käik
    p.tokens = 3 - (p.partTime && !p.working ? 1 : 0) - p.temp.filter((t) => t.kind === "tokens").reduce((a, t) => a + t.delta, 0);
    p.tokens = Math.max(1, p.tokens);
    p.actions = { lisatoo: 0, tervis: 0, lahedased: 0, room: 0, roomPaid: 0, aita: 0, aitaKellele: null };
    p.iiiDeposit = 0; p.event = null; p.eventDone = false; p.vestlusDone = false; p.ready = false; p.call = p.call || null;
    if (s.mode !== "seltskond") { if (!s.vestlus.length) s.vestlus = refillVestlus(cards, s, rnd); p.vestlus = s.vestlus.shift(); }
    if (first) p.pendingDecisions = eraDecisions(cards, p);
    s.roundSummary.push({ id: p.id, lines });
  }
  s.phase = "turn";
}
function refillVestlus(cards, s, rnd) { return shuffle(cards.vestlus.map((c, i) => (c.rezhiim === modeLabel(s.mode) ? i : -1)).filter((i) => i >= 0), rnd); }
function addIii(p, n) { p.iii += n; p.iiiPaid = (p.iiiPaid || 0) + n; const bonus = Math.floor(p.iiiPaid / 4) - (p.iiiBonus || 0); if (bonus > 0) { p.iii += bonus; p.iiiBonus = (p.iiiBonus || 0) + bonus; } }
function autoPension(p) {
  const base = 65 + p.pensionShift;
  if (!p.pension.choice && p.age >= base) choosePension(p, "oige");
  if (p.pension.start && p.age >= p.pension.start && p.working && !p.partTime) p.working = false;
  if (p.pension.start && p.age >= p.pension.start && p.partTime) p.working = false;
}
export function choosePension(p, choice) {
  const base = 65 + p.pensionShift;
  const start = choice === "varem" ? base - 5 : choice === "hiljem" ? base + 5 : base;
  p.pension = { choice, start, amount: PENSION[choice] };
}
export function eraDecisions(cards, p) {
  const era = eraOf(p.age);
  return cards.otsus.map((c, i) => (c.ajastu === era ? i : -1)).filter((i) => i >= 0 && !p.decisionsDone.includes(i));
}

// ---------- mängija käik ----------
export function canAct(p) { return p.alive && !p.ready; }
export function setAction(s, p, key, delta) {
  const a = p.actions;
  if (delta > 0 && freeTokens(p) < 1) return false;
  if (key === "lisatoo" && !p.working) return false;
  if (key === "aita" && s.players.filter((x) => x.alive).length < 2) return false;
  if (a[key] + delta < 0) return false;
  a[key] += delta; return true;
}
export function decide(cards, s, p, cardIndex, option, rnd = Math.random) {
  const c = cards.otsus[cardIndex]; if (!c || p.decisionsDone.includes(cardIndex)) return "ei";
  const limit = 2; if (p.decisionsDone.filter((i) => eraOf(p.age) === cards.otsus[i].ajastu).length >= limit) return "Selles ajastus oled juba 2 otsust teinud.";
  const msg = applyDecision(s, p, c.nimi, option, rnd);
  if (typeof msg === "string" && msg.startsWith("!")) return msg.slice(1);
  p.decisionsDone.push(cardIndex);
  p.pendingDecisions = p.pendingDecisions.filter((i) => i !== cardIndex);
  log(s, p, `${c.nimi}: ${option === "a" ? "A" : option.toUpperCase()} – ${msg}`);
  return null;
}
export function freeTokens(p) { const a = p.actions; return p.tokens - (a.lisatoo + a.tervis + a.lahedased + a.room + a.roomPaid + a.aita); }
function spendToken(p) { if (freeTokens(p) < 1) return false; p.tokens -= 1; return true; }
function payOr(p, n) { if (p.konto < n) return false; p.konto -= n; return true; }
function applyDecision(s, p, nimi, o, rnd) {
  const partner = s.mode === "paar" ? s.players.find((x) => x !== p && x.alive) : null;
  switch (nimi) {
    case "Fondi valik": if (o === "b") { if (!spendToken(p)) return "!Vahetuseks on vaja 1 vaba tegevusmärki."; p.fund = "indeks"; return "vahetasid indeksfondi"; } return "jäid kallisse fondi";
    case "III sammas": if (o === "b") { if (p.noIiiRounds > 0 && s.round <= p.noIiiRounds) return "!Sinu stardikaart ei luba veel III sammast."; p.iiiAuto = true; return "kogud III sambasse 1 mündi voorus"; } return "ei kogu";
    case "Kodu": if (o === "b") { p.kodu = { loan: 4, value: 6 }; return "ostsid kodu laenuga"; } return "üürid edasi";
    case "Lapsed": if (o === "b") { p.lahedased = clamp(p.lahedased + 3); p.temp.push({ kind: "income", delta: -1, rounds: 2 }); return "pere kasvas"; } return "mitte praegu";
    case "Karjääri pööre": if (o === "b") { p.too += 1; p.temp.push({ kind: "income", delta: -2, rounds: 1 }); return "õpid uut ametit"; } return "jääd senisele kohale";
    case "II samba väljavõtt": if (o === "b") { const g = Math.floor(p.ii * 0.8); p.konto += g; p.ii = 0; p.iiPause = 2; p.iiWithdrawn = true; return `võtsid välja ${g} münti`; } return "jätsid kasvama";
    case "Tervisekontroll": if (o === "b") { if (!spendToken(p)) return "!Kontrolliks on vaja 1 vaba tegevusmärki."; p.tervisekontroll = true; const r = riskOf(p); if (r.klass === "Kõrge risk") { p.riskNeutral = true; return "said teada kõrge riski ja hakkasid seda ohjama"; } p.tervis = clamp(p.tervis + 1); return "Tervis +1"; } return "pole aega";
    case "Vanemate hoolekanne": if (o === "b") { if (!spendToken(p)) return "!Selleks on vaja 1 vaba tegevusmärki."; p.temp.push({ kind: "tokens", delta: 1, rounds: 2 }); p.lahedased = clamp(p.lahedased + 2); return "aitad ise"; } if (!payOr(p, 2)) { p.konto = 0; p.mured += 1; return "abi palkamiseks ei jätkunud raha: Mure"; } return "palkasid abi";
    case "Riikliku pensioni ajastus": choosePension(p, o === "a" ? "varem" : o === "c" ? "hiljem" : "oige"); return `pension algab ${p.pension.start}-aastaselt, ${p.pension.amount} münti voorus`;
    case "Sammaste väljamakse": if (o === "a") { const t = p.ii + p.iii; const tax = Math.floor(t / 10); p.konto += t - tax; p.ii = 0; p.iii = 0; p.fp.lumpDone = true; return `võtsid kõik välja, maks ${tax}`; } p.fp.on = true; return "fondipension, maksuvaba";
    case "Osaline töö": if (o === "b") { if (p.tervis <= 3) return "!Tervis on liiga madal."; p.partTime = true; return "pool koormust pensioni kõrvalt"; } return "lõpetad töö pensionile minnes";
    case "Suur unistus": if (o === "b") { if (!payOr(p, 4)) return "!Raha ei jätku."; p.room = clamp(p.room + 4); if (partner) { p.lahedased = clamp(p.lahedased + 1); partner.lahedased = clamp(partner.lahedased + 1); } return "Rõõm +4"; } return "ei";
    case "Kodu väiksemaks": if (o === "b") { p.konto += 4; p.costsExtra -= 1; p.lahedased = clamp(p.lahedased - 1); if (p.kodu) p.kodu.value = Math.max(0, p.kodu.value - 2); return "kolisid väiksemasse"; } return "jäid";
    case "Testament": if (o === "b") { if (!payOr(p, 1)) return "!Raha ei jätku."; p.parand = true; p.lahedased = clamp(p.lahedased + 1); return "testament tehtud"; } return "hiljem";
    case "Hooldus": if (o === "a") { p.costsExtra += 3; return "hooldekodu"; } p.costsExtra += 1; p.careLoss = true; return "koduhooldus lähedastega";
    case "Kingitus lastelastele": if (o === "b") { if (!payOr(p, 3)) return "!Raha ei jätku."; p.lahedased = clamp(p.lahedased + 2); p.room = clamp(p.room + 1); return "kingitus tehtud"; } return "ei";
    default: return "";
  }
}
export function riskOf(p, cards) { return (cards || riskOf.cards).tervis[p.risk]; }
export function riskMod(p, cards) { const r = riskOf(p, cards); if (p.riskNeutral) return 0; return r.mod === "+1" ? 1 : r.mod === "−1" ? -1 : 0; }

export function setIiiDeposit(p, n) { if (!p.working && n > 0) return false; n = Math.max(0, Math.min(p.konto, n)); p.iiiDeposit = n; return true; }

// sündmus: tõmmatakse käigu ajal ja rakendatakse kohe
export function drawEvent(cards, s, p, rnd = Math.random) {
  if (p.event !== null) return;
  const era = eraOf(p.age);
  if (!s.decks[era].length) s.decks[era] = shuffle(cards.sundmus.map((c, i) => (c.ajastu === era ? i : -1)).filter((i) => i >= 0), rnd);
  p.event = s.decks[era].shift();
  p.eventResult = applyEvent(cards, s, p, cards.sundmus[p.event].nimi, rnd);
  p.eventDone = true;
}
function applyEvent(cards, s, p, nimi, rnd) {
  const a = p.actions;
  switch (nimi) {
    case "Palgatõus": p.temp.push({ kind: "income", delta: 1, rounds: 99, untilEra: true }); return "Vaba raha +1 kuni ajastu lõpuni.";
    case "Auto läks katki": if (p.konto >= 2) { p.konto -= 2; return "−2 münti."; } p.konto = 0; p.mured += 1; return "Raha ei jätkunud: Mure.";
    case "Sport sõpradega": p.tervis = clamp(p.tervis + 1); p.lahedased = clamp(p.lahedased + 1); return "Tervis +1, Lähedased +1.";
    case "Läbipõlemine": if (a.lisatoo >= p.tokens) { p.tervis = clamp(p.tervis - 2); return "Panid kõik Töösse: Tervis −2."; } return "Pääsesid, sest jätsid aega ka muuks.";
    case "Koondamine": p.temp.push({ kind: "income", delta: -99, rounds: 1 }); if (p.konto < 3) { p.mured += 1; return "Järgmisel voorul tulu pole. Puhvrit polnud: Mure."; } return "Järgmisel voorul tulu pole. Puhver aitas.";
    case "Vererõhk tõuseb": if (p.tervisekontroll) return "Tervisekontroll aitas: midagi ei juhtunud."; p.tervis = clamp(p.tervis - 1); return "Tervis −1.";
    case "Edutamine": p.too += 1; return "Töö +1.";
    case "Pärand vanaemalt": p.konto += 3; return "+3 münti.";
    case "Lahutus või lahkuminek": p.konto = Math.floor(p.konto / 2); if (p.kodu) p.kodu.value = Math.floor(p.kodu.value / 2); p.lahedased = clamp(p.lahedased - 2); return "Konto ja kodu pooleks, Lähedased −2.";
    case "Liigesed annavad tunda": if (p.tervis >= 7) return "Tervis on hea: midagi ei juhtunud."; p.tervis = clamp(p.tervis - 1); return "Tervis −1.";
    case "Infarkt": { const roll = d6(rnd) + d6(rnd) + riskMod(p, cards); if (roll <= 5) { p.tervis = clamp(p.tervis - 3); p.working = false; p.partTime = false; if (!p.pension.choice) choosePension(p, "varem"); return `Veeretus ${roll}: Tervis −3, töö lõppes.`; } p.tervis = clamp(p.tervis - 1); return `Veeretus ${roll}: Tervis −1.`; }
    case "Lapselaps sünnib": p.lahedased = clamp(p.lahedased + 2); p.room = clamp(p.room + 1); return "Lähedased +2, Rõõm +1.";
    case "Töövõime langus": if (p.tervis <= 4) { p.too = Math.max(0, p.too - 2); return "Töö −2."; } return "Tervis kandis: midagi ei juhtunud.";
    case "Vana sõber helistab": { const n = p.lahedased <= 2 ? 2 : 1; p.lahedased = clamp(p.lahedased + n); return `Lähedased +${n}.`; }
    case "Telefonipettus": if (p.lahedased >= 4) return "Keegi lähedastest hoiatas õigel ajal."; { const l = Math.min(3, p.konto); p.konto -= l; return `Kaotasid ${l} münti.`; }
    case "Kukkumine": { const n = p.tervis >= 6 ? 1 : 2; p.tervis = clamp(p.tervis - n); return `Tervis −${n}.`; }
    case "Lapselapse külaskäik": p.room = clamp(p.room + 1); p.lahedased = clamp(p.lahedased + 1); return "Rõõm +1, Lähedased +1.";
    case "Ravimite kulu": p.temp.push({ kind: "cost", delta: 1, rounds: 1 }); return "Järgmise vooru kulu +1.";
    case "Kaaslase kaotus": { const partnerGone = s.mode === "paar" && s.players.some((x) => x !== p && !x.alive); if (partnerGone) { p.lahedased = clamp(p.lahedased - 2); return "Lähedased −2."; } p.room = clamp(p.room - 1); return "Rõõm −1."; }
    case "Kooriga laulupeole": p.room = clamp(p.room + 2); p.tervis = clamp(p.tervis + 1); return "Rõõm +2, Tervis +1.";
    default: return "Midagi erilist ei juhtunud.";
  }
}

export function finishTurn(cards, s, p) {
  const a = p.actions;
  // tegevused
  p.konto += a.lisatoo;
  p.tervis = clamp(p.tervis + a.tervis);
  p.lahedased = clamp(p.lahedased + a.lahedased);
  p.room = clamp(p.room + a.room);
  for (let i = 0; i < a.roomPaid; i++) { if (p.konto >= 2) { p.konto -= 2; p.room = clamp(p.room + 3); } else p.room = clamp(p.room + 1); }
  if (a.aita && a.aitaKellele) { const t = s.players.find((x) => x.id === a.aitaKellele && x.alive); if (t) t.tervis = clamp(t.tervis + a.aita); }
  if (p.iiiDeposit > 0) { const n = Math.min(p.iiiDeposit, p.konto); p.konto -= n; addIii(p, n); }
  p.ready = true;
}
export function agree(s) { if (s.mode !== "paar") return; for (const p of s.players.filter((x) => x.alive)) p.lahedased = clamp(p.lahedased + 1); s.agreedRound = s.round; }

// ---------- vooru lõpp: vanus, tervis, elukell, ajastu vahetus ----------
export function allReady(s) { return s.players.filter((p) => p.alive).every((p) => p.ready); }
export function endRound(cards, s, rnd = Math.random) {
  const calls = [];
  for (const p of s.players.filter((x) => x.alive)) {
    const before = eraOf(p.age);
    p.age += 5;
    if (p.age >= 55) p.tervis = clamp(p.tervis - 1);
    let died = false, roll = null;
    if (p.age >= 60) {
      const mod = riskMod(p, cards) + (p.tervis >= 7 ? 1 : 0) + (p.tervis <= 3 ? -1 : 0);
      roll = d6(rnd) + d6(rnd);
      const t = lifeThreshold(p.age);
      if (roll + mod <= t) died = true;
      p.lastLife = { roll, mod, t };
    }
    if (p.age >= MAX_AGE) died = true;
    const after = eraOf(p.age);
    if (died) { p.alive = false; p.diedAt = p.age; p.call = pickCall(cards, p); p.score = score(p); calls.push({ id: p.id, kind: "lopp" }); inherit(s, p); }
    else if (after !== before) { p.call = pickCall(cards, p); calls.push({ id: p.id, kind: "ajastu" }); p.pendingDecisions = eraDecisions(cards, p); p.temp = p.temp.filter((t) => !t.untilEra); }
    else p.call = null;
  }
  s.lastCalls = calls;
  if (s.players.every((p) => !p.alive)) { s.over = true; s.phase = "over"; for (const p of s.players) p.score = p.score || score(p); return; }
  startRound(cards, s, rnd);
}
function inherit(s, p) {
  if (s.mode !== "paar") return;
  const heir = s.players.find((x) => x !== p && x.alive); if (!heir) return;
  const sum = p.konto + p.ii + p.iii; heir.konto += sum; if (p.kodu && !heir.kodu) heir.kodu = p.kodu;
  log(s, heir, `Pärisid ${p.name} varast ${sum} münti.`);
}
export function pickCall(cards, p) {
  const T = cards.tulevane;
  const by = (t) => T.findIndex((c) => c.tingimus.includes(t));
  if (p.iiWithdrawn) return by("II sammas välja võetud");
  if (p.tervis <= 3) return by("Tervis ≤3");
  if (p.mured > 0) return by("Mure");
  if (p.lahedased >= 6) return by("Lähedased ≥6");
  if (p.room >= 6 && p.room >= p.lahedased && p.room >= p.tervis) return by("Rõõm");
  if (vara(p) >= 20) return by("Vara");
  if (p.fund === "indeks") return by("indeksfondi");
  return by("kõik muu");
}
export function score(p) {
  const parts = { room: p.room, lahedased: p.lahedased, tervis: Math.floor(p.tervis / 2), turvalisus: p.turvalisus, parand: p.parand ? Math.floor(vara(p) / 4) : 0, mured: -p.mured };
  parts.kokku = Object.values(parts).reduce((a, b) => a + b, 0);
  return parts;
}
export function goal(s) {
  const alive = s.players.map((p) => (p.score || score(p)).kokku);
  if (s.mode === "yksi") return { siht: 25, tulemus: alive[0], ok: alive[0] >= 25, tekst: "Hea elu: 25+ punkti" };
  if (s.mode === "paar") { const t = alive.reduce((a, b) => a + b, 0); return { siht: 45, tulemus: t, ok: t >= 45, tekst: "Kahe peale 45+ punkti" }; }
  const m = Math.min(...alive); return { siht: 18, tulemus: m, ok: m >= 18, tekst: "Igaühel vähemalt 18 punkti" };
}
export { vara };
