"""Extract general-election results per district from a Wikipedia state House elections page."""
import json, re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from wptables import _P

def house_results(path):
    html = json.load(open(path))["parse"]["text"]
    # split into sections at <h2 id="District_N">
    parts = re.split(r'<h2[^>]*id="District_(\d+)"[^>]*>', html)
    out = {}
    for k in range(1, len(parts), 2):
        dist, chunk = int(parts[k]), parts[k + 1]
        p = _P(); p.feed(chunk)
        general = None
        for t in p.tables:
            rows = t["rows"]
            if any(re.search(r"\b(gain from|hold)\b", " ".join(r), re.I) for r in rows) and any("Total votes" in " ".join(r) for r in rows):
                general = t
        if not general: out[dist] = None; continue
        cands, total, result = [], None, None
        for r in general["rows"]:
            j = " ".join(r)
            if re.search(r"\b(gain from|hold)\b", j, re.I): result = re.sub(r"\[.*?\]", "", j).strip()
            elif "Total votes" in j:
                total = int(re.sub(r"[^\d]", "", next(c for c in r if re.search(r"\d{3}", c))))
            elif len(r) >= 4:
                party, name, votes = r[-4], r[-3], r[-2]
                if re.fullmatch(r"[\d,]+", votes or ""):
                    cands.append({"party": party, "name": re.sub(r"\s*\((incumbent|write-in)\)|\[.*?\]", "", name).strip(), "votes": int(votes.replace(",", ""))})
        out[dist] = {"candidates": cands, "total": total, "result": result}
    return out

if __name__ == "__main__":
    for f in sys.argv[1:]:
        res = house_results(f)
        print("==", f.split("wp_")[1][:60], len(res))
        for d, v in sorted(res.items()):
            if not v: print(" ", d, "NONE"); continue
            top = sorted(v["candidates"], key=lambda c: -c["votes"])[:2]
            print(" ", d, v["result"], "|", "; ".join(f"{c['party'][:3]} {c['name']} {c['votes']:,}" for c in top), "| total", v["total"])
