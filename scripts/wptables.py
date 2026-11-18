"""Minimal nested-safe HTML table extractor for Wikipedia parse output."""
import json, re
from html.parser import HTMLParser

class _P(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables = []; self.stack = []
    def handle_starttag(self, tag, a):
        if tag == "table": self.stack.append({"rows": [], "row": None, "cell": None, "cls": dict(a).get("class", "")})
        elif not self.stack: return
        elif tag == "tr": self.stack[-1]["row"] = []
        elif tag in ("td", "th"): self.stack[-1]["cell"] = []
        elif tag == "br" and self.stack[-1]["cell"] is not None: self.stack[-1]["cell"].append(" ")
    def handle_endtag(self, tag):
        if not self.stack: return
        t = self.stack[-1]
        if tag in ("td", "th") and t["cell"] is not None and t["row"] is not None:
            t["row"].append(re.sub(r"\s+", " ", "".join(t["cell"])).strip()); t["cell"] = None
        elif tag == "tr" and t["row"] is not None:
            t["rows"].append(t["row"]); t["row"] = None
        elif tag == "table":
            self.tables.append(self.stack.pop())
    def handle_data(self, d):
        if self.stack and self.stack[-1]["cell"] is not None: self.stack[-1]["cell"].append(d)

def tables(path):
    p = _P(); p.feed(json.load(open(path))["parse"]["text"]); return p.tables
