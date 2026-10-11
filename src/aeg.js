// Aja abifunktsioonid. Andmebaasis hoitakse aega endiselt UTC-s (ISO-string); kõik tulemuste lehel näidatud kellaajad ja
// tundide kaupa jaotused arvutatakse Tallinna aja järgi (suve- ja talveaeg arvestatud).
export const TZ = "Europe/Tallinn";
const osad = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// ISO-aeg (UTC) → { paev: "2026-10-11", tund: 0..23, kell: "07:05", aeg: "11.10 07:05" } Tallinna aja järgi; vigase sisendi korral null.
export function tallinn(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const p = {};
  for (const x of osad.formatToParts(d)) p[x.type] = x.value;
  const tund = Number(p.hour) % 24;
  const hh = String(tund).padStart(2, "0");
  return { paev: p.year + "-" + p.month + "-" + p.day, tund, kell: hh + ":" + p.minute, aeg: p.day + "." + p.month + " " + hh + ":" + p.minute };
}
// Täna (Tallinna aja järgi) kuupäevana.
export const tanaPaev = (now = new Date()) => tallinn(now.toISOString()).paev;
