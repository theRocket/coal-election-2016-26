"""Build the data for scene 6 (Ohio Senate) and scene 7 (House races in Ohio and Pennsylvania).

Usage (needs openpyxl):
    python scripts/build_senate_house.py <download_dir> public/data

Writes:
  oh_senate_2024_2026.csv   Sherrod Brown's margin by Ohio county, 2024 vs. 2026
  house_2026_oh_pa.csv      2026 House result per district (OH + PA), with 2024 party for flip detection

Expected files in <download_dir>:
  oh_2026.xlsx   Ohio SOS 2026 unofficial canvass ("All Results" at https://liveresults.ohiosos.gov/).
                 Read from its "U.S. Congress" sheet: the Senate special election and all 15 House districts.
  wp_2024_United_States_Senate_election_in_Ohio.json
  wp_2024_United_States_House_of_Representatives_elections_in_Ohio.json
  wp_2024_United_States_House_of_Representatives_elections_in_Pennsylvania.json
                 Wikipedia parse API output, e.g.
                 https://en.wikipedia.org/w/api.php?action=parse&page=<page>&prop=text&format=json&formatversion=2
Also reads scripts/pa_house_2026_nbc.csv: Pennsylvania 2026 House percentages and total votes copied from
NBC News district pages (99% reporting, last updated Nov. 17, 2026, 11:42 PM ET). NBC did not show
candidate vote counts, so Pennsylvania House margins use its percentages.

Margins are (D - R) as a share of all votes in the race, in percentage points.
"""
import csv, os, re, sys
import openpyxl

sys.path.insert(0, os.path.dirname(__file__))
from wptables import tables
from wp_house import house_results

dl, out_dir = sys.argv[1:3]
here = os.path.dirname(__file__)
norm = lambda s: re.sub(r"[^a-z]", "", s.lower().replace("county", ""))
num = lambda s: int(re.sub(r"[^\d]", "", s))

# County FIPS for Ohio, from the existing 2012-2016 file
fips = {norm(r["cty_name"]): r["id"] for r in csv.DictReader(open(f"{out_dir}/countyelectdiffs_paoh.csv")) if r["state"] == "OH"}

# ---------- Ohio 2026 workbook: "U.S. Congress" sheet ----------
ws = openpyxl.load_workbook(f"{dl}/oh_2026.xlsx", read_only=True, data_only=True)["U.S. Congress"]
rows = list(ws.iter_rows(values_only=True))
race_row, head, total_row = rows[0], rows[1], rows[2]
races, cur = {}, None
for i in range(8, len(head)):
    if race_row[i]:
        cur = race_row[i].replace("\n", " ").strip()
    races.setdefault(cur, []).append(i)
party = lambda h: (re.search(r"\((D|R)\)\s*$", h or "") or [None, None])[1]
clean_name = lambda h: re.sub(r"\s*\(.*?\)\*?\s*$", "", h).replace("  ", " ").strip()

# ---------- Scene 6: Ohio Senate, Brown 2024 vs. 2026 ----------
sen_cols = next(c for name, c in races.items() if name.startswith("U.S. Senator"))
b26 = next(i for i in sen_cols if party(head[i]) == "D")
h26 = next(i for i in sen_cols if party(head[i]) == "R")
senate = {}
for r in rows[2:]:
    if not r[0] or r[0] in ("Total", "Percentage"):
        continue
    fid = fips[norm(r[0])]
    tot = sum(r[i] or 0 for i in sen_cols)
    senate[fid] = {"id": fid, "name": r[0], "brown26": r[b26], "husted26": r[h26], "total26": tot}

t24 = next(t for t in tables(f"{dl}/wp_2024_United_States_Senate_election_in_Ohio.json")
           if t["rows"] and t["rows"][0] and t["rows"][0][0].startswith("County") and "Moreno" in " ".join(t["rows"][0]))
for r in t24["rows"][2:]:
    if len(r) == 10 and r[0] != "Totals":
        d = senate[fips[norm(r[0])]]
        d.update(moreno24=num(r[1]), brown24=num(r[3]), total24=num(r[9]))

with open(f"{out_dir}/oh_senate_2024_2026.csv", "w", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["id", "name", "brown24", "moreno24", "total24", "brown26", "husted26", "total26", "margin24", "margin26", "swing", "flipped"])
    for d in sorted(senate.values(), key=lambda d: d["id"]):
        m24 = 100 * (d["brown24"] - d["moreno24"]) / d["total24"]
        m26 = 100 * (d["brown26"] - d["husted26"]) / d["total26"]
        w.writerow([d["id"], d["name"], d["brown24"], d["moreno24"], d["total24"], d["brown26"], d["husted26"], d["total26"],
                    round(m24, 2), round(m26, 2), round(m26 - m24, 2), int(m24 < 0 < m26)])
S = lambda k: sum(d[k] for d in senate.values())
print(f"OH Senate 2024 Brown {S('brown24'):,} Moreno {S('moreno24'):,} | 2026 Brown {S('brown26'):,} Husted {S('husted26'):,} of {S('total26'):,}")

# ---------- Scene 7: House 2026 by district ----------
def winner_party(res):
    top = max(res["candidates"], key=lambda c: c["votes"])
    return "D" if top["party"].startswith("Dem") else "R" if top["party"].startswith("Rep") else "O"

prev = {("OH", d): winner_party(v) for d, v in house_results(f"{dl}/wp_2024_United_States_House_of_Representatives_elections_in_Ohio.json").items()}
prev |= {("PA", d): winner_party(v) for d, v in house_results(f"{dl}/wp_2024_United_States_House_of_Representatives_elections_in_Pennsylvania.json").items()}

house = []
for name, cols in races.items():
    m = re.match(r"Representative to Congress - District (\d+)", name or "")
    if not m:
        continue
    dist = int(m.group(1))
    tot = sum(total_row[i] or 0 for i in cols)
    dcol = next(i for i in cols if party(head[i]) == "D")
    rcol = next(i for i in cols if party(head[i]) == "R")
    dp, rp = 100 * total_row[dcol] / tot, 100 * total_row[rcol] / tot
    house.append(dict(id=f"39{dist:02d}", state="OH", district=dist, dem_name=clean_name(head[dcol]), dem_pct=round(dp, 1),
                      rep_name=clean_name(head[rcol]), rep_pct=round(rp, 1), total_votes=tot, source="Ohio SOS unofficial canvass"))
for r in csv.DictReader(open(f"{here}/pa_house_2026_nbc.csv")):
    house.append(dict(id=f"42{int(r['district']):02d}", state="PA", district=int(r["district"]), dem_name=r["dem_name"],
                      dem_pct=float(r["dem_pct"]), rep_name=r["rep_name"], rep_pct=float(r["rep_pct"] or 0),
                      total_votes=int(r["total_votes"]), source="NBC News, 99% reporting"))

with open(f"{out_dir}/house_2026_oh_pa.csv", "w", newline="") as f:
    fields = ["id", "state", "district", "dem_name", "dem_pct", "rep_name", "rep_pct", "total_votes", "margin", "winner", "winner_2024", "flipped", "source"]
    w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
    w.writeheader()
    for h in sorted(house, key=lambda h: h["id"]):
        h["margin"] = round(h["dem_pct"] - h["rep_pct"], 1)
        h["winner"] = "D" if h["margin"] > 0 else "R"
        h["winner_2024"] = prev[(h["state"], h["district"])]
        h["flipped"] = int(h["winner"] != h["winner_2024"])
        w.writerow(h)
for st in ("OH", "PA"):
    hs = [h for h in house if h["state"] == st]
    print(st, "seats D", sum(h["winner"] == "D" for h in hs), "R", sum(h["winner"] == "R" for h in hs),
          "| 2024 D", sum(prev[(st, h["district"])] == "D" for h in hs),
          "| flips", [f"{st}-{h['district']} {h['winner_2024']}→{h['winner']}" for h in hs if h["flipped"]])
