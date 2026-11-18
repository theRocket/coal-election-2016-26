"""Build public/data/county_swing_2024_2026.csv for Ohio and Pennsylvania.

Usage (needs openpyxl):
    python scripts/build_county_swing.py <download_dir> public/data/countyelectdiffs_paoh.csv public/data/county_swing_2024_2026.csv

Expected files in <download_dir>:
  cb_105_1.json  PA 2024 President by county. Pennsylvania Department of State API:
                 https://www.electionreturns.pa.gov/api/ElectionReturn/GetCountyBreak?officeId=1&districtId=1&methodName=GetCountyBreak&electionid=105&electiontype=G&isactive=0
  cb_117_3.json  PA 2026 Governor by county. Same API with officeId=3, electionid=117, isactive=1.
  wp_oh24.json   OH 2024 President by county (certified canvass, as tabulated on Wikipedia):
                 https://en.wikipedia.org/w/api.php?action=parse&page=2024_United_States_presidential_election_in_Ohio&prop=text&format=json&formatversion=2
  oh_2026.xlsx   OH 2026 unofficial canvass ("All Results" download at https://liveresults.ohiosos.gov/).
                 Replace with the certified canvass once it is published.

Margins are (D - R) / all votes in the race, in percentage points. The swing is the 2026 margin minus the 2024 margin.
"""
import csv, json, re, html, sys
import openpyxl

dl, fips_csv, out = sys.argv[1:4]
norm = lambda s: re.sub(r"[^a-z]", "", s.lower().replace("county", ""))

fips = {}
for r in csv.DictReader(open(fips_csv)):
    fips[(r["state"], norm(r["cty_name"]))] = r["id"]

data = {}  # id -> dict

def put(st, name, key, dem, rep, total):
    fid = fips.get((st, norm(name)))
    if not fid:
        raise SystemExit(f"no FIPS for {st} {name!r}")
    d = data.setdefault(fid, {"id": fid, "state": st, "name": name.title()})
    d[f"{key}_dem"], d[f"{key}_rep"], d[f"{key}_total"] = dem, rep, total

# --- Pennsylvania (Dept. of State API): 2024 President (office 1), 2026 Governor (office 3)
def pa(path, key):
    o = json.load(open(path))
    while isinstance(o, str): o = json.loads(o)
    for county in o["Election"]["Statewide"]:
        for cname, cands in county.items():
            dem = sum(int(c["Votes"]) for c in cands if c["PartyName"] == "DEM")
            rep = sum(int(c["Votes"]) for c in cands if c["PartyName"] == "REP")
            put("PA", cname, key, dem, rep, sum(int(c["Votes"]) for c in cands))
pa(f"{dl}/cb_105_1.json", "pres24")
pa(f"{dl}/cb_117_3.json", "gov26")

# --- Ohio 2024 President (Wikipedia county table, from SOS certified canvass)
t = json.load(open(f"{dl}/wp_oh24.json"))["parse"]["text"]
tb = re.findall(r"<table[^>]*>.*?</table>", t, re.S)[36]
clean = lambda c: html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
num = lambda s: int(s.replace(",", ""))
for r in re.findall(r"<tr[^>]*>(.*?)</tr>", tb, re.S):
    c = [clean(x) for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
    if len(c) == 10 and c[0] not in ("Totals",) and c[1][0].isdigit():
        put("OH", c[0], "pres24", num(c[3]), num(c[1]), num(c[9]))

# --- Ohio 2026 Governor (SOS unofficial canvass xlsx, 'Statewide Offices' sheet)
ws = openpyxl.load_workbook(f"{dl}/oh_2026.xlsx", read_only=True, data_only=True)["Statewide Offices"]
rows = list(ws.iter_rows(values_only=True))
race, head = rows[0], rows[1]
start = next(i for i, v in enumerate(race) if v and v.startswith("Governor"))
end = next((i for i in range(start + 1, len(race)) if race[i]), len(race))
cols = range(start, end)
dcol = [i for i in cols if head[i].endswith("(D)")]
rcol = [i for i in cols if head[i].endswith("(R)")]
assert len(dcol) == 1 and len(rcol) == 1, (dcol, rcol, [head[i] for i in cols])
print("OH gov columns:", [head[i] for i in cols])
for r in rows[2:]:
    if not r[0] or r[0] in ("Total", "Percentage"): continue
    put("OH", r[0], "gov26", r[dcol[0]], r[rcol[0]], sum(r[i] or 0 for i in cols))

# --- derive margins (D − R as % of all votes in that race), swing, flips
out_rows = []
for d in sorted(data.values(), key=lambda d: d["id"]):
    assert all(k in d for k in ("pres24_total", "gov26_total")), d
    m24 = 100 * (d["pres24_dem"] - d["pres24_rep"]) / d["pres24_total"]
    m26 = 100 * (d["gov26_dem"] - d["gov26_rep"]) / d["gov26_total"]
    d.update(margin24=round(m24, 2), margin26=round(m26, 2), swing=round(m26 - m24, 2),
             flipped=int(m24 < 0 < m26))
    out_rows.append(d)

fields = ["id", "state", "name", "pres24_dem", "pres24_rep", "pres24_total",
          "gov26_dem", "gov26_rep", "gov26_total", "margin24", "margin26", "swing", "flipped"]
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n"); w.writeheader(); w.writerows(out_rows)

for st in ("OH", "PA"):
    s = [d for d in out_rows if d["state"] == st]
    tot = lambda k: sum(d[k] for d in s)
    print(st, "counties", len(s),
          "| 2024 pres D", tot("pres24_dem"), "R", tot("pres24_rep"),
          "| 2026 gov D", tot("gov26_dem"), "R", tot("gov26_rep"),
          "| flipped", sum(d["flipped"] for d in s),
          "| swing min/max", min(d["swing"] for d in s), max(d["swing"] for d in s))
