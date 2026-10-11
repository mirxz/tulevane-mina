// Analüütika põhimõtete automaattestid (vt ANALUUTIKA.md). Ilma serverita: kontrollib lähtekoodi ja andmebaasi skeemi.
//   1. Kliendi sisestatud muutujaid ei salvestata kunagi.
//   2. Tagasisidet ei seostata vastaja e-posti ega muu isikuandmega.
//   3. Üldine kasutusstatistika on minimaalne ja anonüümne (ühe kasutaja detailset liikumist ei jälgita).
// Kui üks neist kukub, ära muuda testi vaikselt: muuda ANALUUTIKA.md koos testiga ja põhjenda PR-is.
// Kasutus: node tests/privaatsus.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const juur = process.env.PRIVAATSUS_JUUR || join(dirname(fileURLToPath(import.meta.url)), "..");
const loe = (p) => readFileSync(join(juur, p), "utf8");
let ok = 0, fail = 0;
const check = (c, m) => { if (c) ok++; else { fail++; console.log("  ✗ " + m); } };

const index = loe("src/index.js"), moot = loe("public/mootmine.js"), story = loe("public/elukaar/story.js");
const avaleht = loe("public/index.html"), elukaarHtml = loe("public/elukaar/index.html"), tagasiHtml = loe("public/tagasiside/index.html");

// ---- Skeemi lugemine: iga CREATE TABLE sõne index.js-ist ----
const tabelid = {};
for (const m of index.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([^"]+)\)"/g)) {
  const veerud = m[2].split(/,\s*(?![^()]*\))/).map((x) => x.trim().split(/\s+/)[0]).filter((x) => x && x !== "PRIMARY");
  tabelid[m[1]] = veerud;
}
const nimed = Object.keys(tabelid).sort();

// ---- Iga tabel peab olema nimetatud ühes rühmas; uus tabel nõuab teadlikku otsust ----
const ANALUUTIKA = { // mõõtmine: täpne veergude loetelu
  mina_seansid: "sid,host,k,p,esimene,viimane,samm_max,klikke,maandus,edasi,elukaar,tagasiside",
  mina_loendur: "tund,host,ev,k,samm,nimi,n",
};
const MUU = { // muud tabelid, mille veerud on samuti fikseeritud
  kutse_klikid: "id,ts,host,k", kutse_saadetud: "id,ts,variant,teema,ok,vigu",
  ratas_meilid: "id,ts,host,email,allikas",
  tagasiside_vastused: "id,ts,host,sid,allikas,algpunkt,algpunkt0,vahetusi,muutis,kestus,taitmine,taitmine_tekst,vanus_vastus,vanus,uus,uus_tekst,muudaks,muudaks_tekst,kommentaar",
};
const PARAND = ["sundmused", "vastused", "mang_toad", "plaan_sundmused", "plaan_vastused", "ratas_sundmused"]; // arhiiveeritud prototüüpide pärand: ei kasva, uusi ei lisata
const tuntud = new Set([...Object.keys(ANALUUTIKA), ...Object.keys(MUU), ...PARAND]);
check(nimed.length >= 10, "skeemi lugemine leidis tabelid (" + nimed.length + ")");
for (const n of nimed) check(tuntud.has(n), "tabel '" + n + "' ei ole privaatsustestis nimetatud: otsusta, kas see on analüütika, tagasiside, e-post või pärand, ja lisa siia");
for (const [n, v] of Object.entries({ ...ANALUUTIKA, ...MUU })) check((tabelid[n] || []).join() === v, "tabeli '" + n + "' veerud on muutunud (lubatud: " + v + "; praegu: " + (tabelid[n] || []).join() + ")");

// ---- Põhimõte 3: minimaalne ja anonüümne ----
const sea = tabelid.mina_seansid || [], loend = tabelid.mina_loendur || [];
check(!sea.some((v) => /^(ev|nimi|tee|teekond|path|ts|id|ip|ua|agent|sammud|klikid)$/i.test(v)), "seansirida ei sisalda sündmust, nime, teekonda ega aega-per-sündmus");
check(sea.includes("sid") && !loend.includes("sid"), "loendurites ei ole seansi tunnust");
check(!/ip|agent|ua|email|nimi_/i.test(sea.filter((v) => v !== "k").join(",").replace(/klikke|samm_max/g, "")), "seansirida ei sisalda IP-d, brauseri infot ega e-posti");
check(/PRIMARY KEY \(tund, host, ev, k, samm, nimi\)/.test(index), "loendur on tunnipõhine (võti sisaldab tundi, mitte hetke ega seanssi)");
check(loend[0] === "tund", "loenduri aeg on tunni täpsusega");
// ühtegi INSERT-i mõõtmise tabelitesse ei tehta ilma loenduri/seansi upsertita (üksiksündmuse logi puudub)
const insertid = [...index.matchAll(/INSERT (?:OR \w+ )?INTO (mina_\w+)/g)].map((m) => m[1]);
check(insertid.length === 2 && insertid.every((t) => ["mina_loendur", "mina_seansid"].includes(t)), "mõõtmise tabelitesse kirjutatakse ainult kokkuvõtterida ja loendurit: " + insertid.join());
check([...index.matchAll(/INSERT (?:OR \w+ )?INTO mina_\w+[^`"]*"/g)].every((m) => /ON CONFLICT/.test(m[0])), "mõõtmise INSERT on alati upsert (üks rida seansi/tunni kohta, mitte rida sündmuse kohta)");
check(!/cf-connecting-ip|x-forwarded-for|x-real-ip|request\.cf\b|\.headers\.get\(["']user-agent["']\)[^;]*\.bind|set-cookie/i.test(index.replace(/E_BOT\.test\(request\.headers\.get\("user-agent"\)[^)]*\)\)/, "")), "server ei loe IP-d, ei salvesta brauseri infot ega pane küpsiseid");
check(!/document\.cookie|localStorage|indexedDB|fingerprint|canvas\.toDataURL|getClientRects/.test(moot + story + avaleht + tagasiHtml), "kliendi kood ei kasuta küpsiseid, püsivat salvestust ega sõrmejälge");
check(/doNotTrack/.test(moot), "'Ära jälgi' lülitab mõõtmise välja");
// tulemuste leht ei näita üksikut seanssi ega teekonda
const vaade = loe("src/moot.js");
check(!/\.sid\b|\bsid:|\bsid\b\s*[,)]/i.test(vaade.replace(/\/\/.*$/gm, "")), "tulemuste vaated ei kasuta seansi tunnust ega ühe kasutaja teekonda");
check(!/SELECT[^"`]*\bsid\b[^"`]*FROM mina_/i.test(index), "tulemuste päringud ei loe seansi tunnust välja");

// ---- Põhimõte 1: kliendi sisestatud muutujaid ei salvestata ----
const E_KEYS = (/const E_KEYS = new Set\(\[([^\]]*)\]\)/.exec(index) || [])[1] || "";
check(E_KEYS.replace(/["\s]/g, "") === "sid,ev,k,p,samm,nimi", "server võtab vastu ainult väljad sid, ev, k, p, samm, nimi (praegu: " + E_KEYS + ")");
check(/Object\.keys\(b\)\.some\(\(x\) => !E_KEYS\.has\(x\)\)\) return json\(\{ viga: "Tundmatu väli" \}, 400\)/.test(index), "tundmatu väli lükatakse tagasi (400), mitte ei ignoreerita vaikselt");
check(/JSON\.stringify\(\{ sid: sid, ev: ev, k: k, p: o\.p \|\| "", samm: o\.samm == null \? null : o\.samm, nimi: o\.nimi \|\| "" \}\)/.test(moot), "mootmine.js saadab täpselt need kuus välja");
// kõik minaMoot-kutsed on teadaolevad vormid; uus kutse peab läbima ülevaatuse (siia lisamine)
const lubatudKutsed = [
  /minaMoot\('samm', \{ samm: step \}\)/, /minaMoot\('elukaar', \{ p: profiil \}\)/,
  /minaMoot\('klikk', \{ samm: step, nimi: nimi\('r:' \+ t\.name \+ '=' \+ t\.value\) \}\)/, /minaMoot\('klikk', \{ samm: step, nimi: nimi\('s:p3Joined=' \+ t\.value\) \}\)/,
  /minaMoot\('klikk', \{ samm: step, nimi: 'b:rada' \}\)/, /minaMoot\('klikk', \{ samm: step, nimi: nimi\('b:' \+ b\.id\) \}\)/,
];
for (const r of story.split("\n").filter((r) => /window\.minaMoot\('/.test(r))) for (const m of r.matchAll(/window\.minaMoot\('[^;]*?\}\)/g)) check(lubatudKutsed.some((re) => re.test(m[0])), "elukaare uus mõõtmiskutse vajab ülevaatust: " + m[0]);
check(story.split("\n").filter((r) => /window\.minaMoot\('/.test(r)).length >= 5, "elukaare mõõtmiskutsed leitud");
check(/\.type === 'radio'|t\.type === 'radio'/.test(story) && /isTrusted/.test(story), "elukaarel mõõdetakse ainult raadionuppe, valikut p3Joined ja nuppe (ja ainult kasutaja päris tegevusi)");
check(!/minaMoot\([^)]*(\.value\b(?!\))|readInput|getElementById\([^)]*\)\.value|\$\([^)]*\)\.value)/.test(story.split("\n").filter((r) => /minaMoot\(/.test(r)).filter((r) => !/t\.value\)|t\.name/.test(r)).join("\n")), "mõõtmiskutsed ei loe sisestatud väärtusi");
check(/\/\^\[a-z0-9:=_\.-\]\{1,40\}\$\/i/.test(index), "serveri nime muster lubab ainult tähemärke valiku tähise jaoks (ilma tühiku ja tekstita)");
// kõik valikud (radio, select), mida mõõdetakse, on lehel ette antud väärtustega; vabad väljad saadavad midagi
const radiod = [...elukaarHtml.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]);
check(radiod.length >= 4 && radiod.every((r) => /value="[a-z0-9_.-]+"/i.test(r)), "kõigil elukaare raadionuppudel on lehel antud lühike väärtus");
const sel = /<select[^>]*id="p3Joined"[\s\S]*?<\/select>/.exec(elukaarHtml);
check(sel && [...sel[0].matchAll(/<option[^>]*value="([^"]*)"/g)].every((m) => /^[a-z0-9_.-]*$/i.test(m[1])), "valiku 'p3Joined' väärtused on lehel antud");
check(!/minaMoot/.test(loe("public/arhiiv/kasiino.html")), "arhiivi mängud ei kasuta uut mõõtmist");

// ---- Põhimõte 2: tagasiside ei seostu isikuandmetega ----
const tv = tabelid.tagasiside_vastused || [];
check(!tv.some((v) => /mail|nimi|name|tel|phone|ip|agent|ua|isik|kontakt|isikukood|^user/i.test(v.replace(/^(taitmine|uus|muudaks)_tekst$/, "x"))), "tagasiside tabelis ei ole e-posti, nime, telefoni, IP-d ega brauseri infot");
const emailTabelid = nimed.filter((n) => (tabelid[n] || []).some((v) => /mail/i.test(v)));
check(emailTabelid.join() === "ratas_meilid", "ainult üks tabel hoiab e-posti: " + emailTabelid.join());
for (const n of emailTabelid) check(!(tabelid[n] || []).some((v) => /^(sid|vastus|loos|valik|tekst|jarjekord|sektor|ev)$/.test(v)), "e-posti tabel '" + n + "' ei sisalda seansi tunnust ega vastuseid");
check(!/mina_seansid[\s\S]{0,400}email|email[\s\S]{0,400}mina_seansid/.test(index.split("\n").filter((r) => /INSERT|SELECT|JOIN/.test(r)).join("\n")), "e-posti ja seansside tabeleid ei ühendata päringus");
check(![...index.matchAll(/"[^"]*\bJOIN\b[^"]*"/g)].some((m) => /tagasiside_vastused|mina_|ratas_meilid|kutse_/.test(m[0])), "tagasiside, mõõtmise tabeleid ega e-posti ei ühendata JOIN-iga mingi teise tabeliga");
check(!/mina_sid|minaSid/.test(tagasiHtml.replace(/\/\/.*$/gm, "").replace(/\(mootmine\.js\)|mõõtmise seansi tunnus[^.]*\./g, "")), "tagasiside leht ei kasuta mõõtmise seansi tunnust");
check(/sid = crypto\.randomUUID\(\)/.test(tagasiHtml), "tagasiside tunnus on eraldi juhuslik UUID");
check(!/tagasiside_vastused[^"`;]*mina_(seansid|loendur)|mina_(seansid|loendur)[^"`;]*tagasiside_vastused/.test(index.split("\n").filter((r) => /SELECT|INSERT|UPDATE/.test(r)).join("\n")), "ühtegi päringut ei tehta, mis puudutaks korraga tagasisidet ja mõõtmise tabeleid");
check(/\\S\+@\\S\+/.test(index) && /\[e-post\]/.test(index) && /maskPikk\(f\.kommentaar/.test(index) && /maskPikk\(f\.uus_tekst/.test(index) && /maskPikk\(f\.taitmine_tekst/.test(index) && /maskPikk\(f\.muudaks_tekst/.test(index), "tagasiside vabatekstidest eemaldatakse e-posti aadressid");
const bodyVoti = /const keha = \{([^}]*)\}|var keha = \{([^}]*)\}/.exec(tagasiHtml);
check(bodyVoti && !/mina|email|mail/i.test(bodyVoti[0].replace(/mina_/g, "")), "tagasiside päring ei sisalda e-posti");

// ---- Privaatsusleht (/privaatsus/) peab vastama tegelikkusele ja olema leitav ----
const leht = loe("public/privaatsus/index.html").replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
check(/href="\/privaatsus\/"/.test(avaleht) && /href="\/privaatsus\/"/.test(elukaarHtml), "privaatsuslehele viitavad avaleht ja elukaar");
check(/brauseris/.test(leht) && /ei kasuta küpsiseid/i.test(leht) && /IP-aadress/.test(leht) && /Ära jälgi/.test(leht) && /Tagasiside/.test(leht), "privaatsusleht ütleb: andmed jäävad brauserisse, küpsiseid ja IP-d pole, 'Ära jälgi', tagasiside");
check(/mirko@tulevanemina\.ee/.test(leht), "privaatsuslehel on kontakt andmekaitse küsimuste jaoks");
check(/ei salvesta teekonda/i.test(leht), "privaatsusleht lubab, et teekonda ei salvestata (kontrollib reegel 3)");
check(!/tagasiside[^.]*seotud[^.]*seansi/i.test(leht) || /ei ole seotud/i.test(leht), "privaatsusleht ei väida, et tagasiside on seotud külastusega");
check(!/arhiiv|õnneratas|lauamäng/i.test(leht), "privaatsusleht käib ainult elukaare tööriista kohta (arhiivi mänge ei lubata sama tekstiga)");

// ---- Pärand: ei kasva ----
const FIKSEERITUD = {
  sundmused: "id,ts,host,sid,ev,loos,mang",
  plaan_sundmused: "id,ts,host,sid,ev,loos,vaade,enne,allikas",
  ratas_sundmused: "id,ts,host,sid,ev,allikas,jarjekord,sektor,pos,valik,tekst",
  mang_toad: "kood,ver,olek,ts",
};
for (const [n, v] of Object.entries(FIKSEERITUD)) check((tabelid[n] || []).join() === v, "pärandtabel '" + n + "' ei tohi kasvada");

console.log(`\nAnalüütika põhimõtted: ${ok} kontrolli läbis, ${fail} kukkus`);
process.exit(fail ? 1 : 0);
