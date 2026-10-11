// Anonüümne mõõtmine (avaleht, elukaar, tagasiside). Saadab ainult: seansi juhusliku tunnuse, kanali (?k=), eelprofiili, sammu numbri ja valikute nimed.
// Ei kasuta küpsiseid ega IP-d, ei saada sisestatud summasid. Seansi tunnus on sessionStorage'is (kaob vahekaardi sulgemisel).
// "Ära jälgi" (Do Not Track) seade lülitab mõõtmise välja. Saadab /api/e (src/index.js).
(function () {
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") { window.minaMoot = function () {}; return; }
  var ss = {
    get: function (k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };
  var qs = new URLSearchParams(location.search);
  var k = (qs.get("k") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16) || ss.get("mina_k");
  if (k) ss.set("mina_k", k);
  var sid = ss.get("mina_sid");
  if (!/^[a-z0-9-]{8,60}$/i.test(sid)) {
    try { sid = crypto.randomUUID(); } catch (e) { sid = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
    ss.set("mina_sid", sid);
  }
  window.minaSid = sid;
  window.minaK = k;
  window.minaMoot = function (ev, o) {
    o = o || {};
    var body = JSON.stringify({ sid: sid, ev: ev, k: k, p: o.p || "", samm: o.samm == null ? null : o.samm, nimi: o.nimi || "" });
    try { if (navigator.sendBeacon && navigator.sendBeacon("/api/e", new Blob([body], { type: "text/plain" }))) return; } catch (e) {}
    try { fetch("/api/e", { method: "POST", body: body, keepalive: true, headers: { "content-type": "text/plain" } }); } catch (e) {}
  };
})();
