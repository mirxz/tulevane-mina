// Ühised abifunktsioonid: kõne (TartuNLP /api/tts), HTML-i turvaline väljund, ekraanilugeja teated.
let audio = null;
export const VOICE = { M: "albert", N: "kylli" };
export async function speak(text, voice = "M") {
  stopSpeak();
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: String(text).replace(/[„“"]/g, "").slice(0, 380), speaker: VOICE[voice] || "albert", speed: 0.95 }),
    });
    if (!r.ok) return false;
    const url = URL.createObjectURL(await r.blob());
    audio = new Audio(url);
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
export function stopSpeak() { if (audio) { audio.pause(); audio = null; } }
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function say(text) { const el = document.getElementById("teade"); if (!el) return; el.textContent = ""; setTimeout(() => (el.textContent = text), 30); }
export const SAFE = "Mängukõne. Päris tulevane sina ei küsi kunagi koode, PIN-i ega raha.";
export const eur = (coins) => (coins * 5000).toLocaleString("et-EE") + " €";
