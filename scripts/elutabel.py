#!/usr/bin/env python3
"""Tõmbab Statistikaameti elutabeli (RV045, RV046) ja kirjutab public/plaan/elutabel.js (ES moodul).

Kasutus: python3 scripts/elutabel.py
Allikas: https://andmed.stat.ee/api/v1/et/stat/RV045 ja RV046 (viimane avaldatud aasta).
"""
import itertools
import json
import pathlib
import urllib.request

API = "https://andmed.stat.ee/api/v1/et/stat/"
AGES = [str(a) for a in range(0, 101)]
SEXES = {"2": "M", "3": "N"}


def query(table, extra):
    body = {
        "query": extra + [
            {"code": "Sugu", "selection": {"filter": "item", "values": list(SEXES)}},
            {"code": "Vanus", "selection": {"filter": "item", "values": AGES}},
            {"code": "Aasta", "selection": {"filter": "top", "values": ["1"]}},
        ],
        "response": {"format": "json-stat2"},
    }
    req = urllib.request.Request(API + table, data=json.dumps(body).encode(), method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.load(r)
    dims = d["id"]
    labels = [list(d["dimension"][k]["category"]["index"].keys()) for k in dims]
    year = list(d["dimension"]["Aasta"]["category"]["label"].values())[0]
    out = {s: [None] * 101 for s in SEXES.values()}
    for idx, v in zip(itertools.product(*[range(s) for s in d["size"]]), d["value"]):
        lab = {dims[i]: labels[i][j] for i, j in enumerate(idx)}
        out[SEXES[lab["Sugu"]]][int(lab["Vanus"])] = v
    return year, out


year1, survivors = query("RV046", [{"code": "Näitaja", "selection": {"filter": "item", "values": ["2"]}}])
year2, life_exp = query("RV045", [])
assert year1 == year2, (year1, year2)
data = {
    "allikas": "Statistikaamet RV045 (elada jäänud aastad) ja RV046 (ellujääjad sünnipõlvkonna hulgast)",
    "aasta": year1,
    "ellujaajad": survivors,
    "elada_jaanud": life_exp,
}
target = pathlib.Path(__file__).resolve().parent.parent / "public" / "plaan" / "elutabel.js"
target.write_text(
    "// Genereeritud: scripts/elutabel.py. Ära muuda käsitsi.\n"
    "export const ELUTABEL = " + json.dumps(data, ensure_ascii=False) + ";\n",
    encoding="utf-8",
)
print("Kirjutatud", target, "aasta", year1)
