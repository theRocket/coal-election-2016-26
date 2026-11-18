import * as d3 from "d3";
import { feature, mesh } from "topojson-client";

const BASE = import.meta.env.BASE_URL;
const W = 975;
const H = 610;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FILL_MS = reduceMotion ? 0 : 700;
const ZOOM_MS = reduceMotion ? 0 : 1200;

// FIPS codes
const FOCUS_STATES = ["39", "42"]; // Ohio, Pennsylvania
const REGION_STATES = ["39", "42", "54", "21", "18"]; // + West Virginia, Kentucky, Indiana

const fmt = d3.format(",");
const pct = (v, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}%`;
let colorCache = {};
const countyLabel = (n) => (/\b(County|Parish|Borough|Census Area)$/i.test(n.trim()) ? n.trim() : `${n.trim()} County`);
const cssVar = (name) =>
  (colorCache[name] ??= getComputedStyle(document.documentElement).getPropertyValue(name).trim());

const svg = d3.select("#map");
const legendEl = document.getElementById("legend");
const tipEl = document.getElementById("tooltip");
const hintEl = document.getElementById("hint");
const mapWrap = document.querySelector(".map-wrap");
const titleEl = document.getElementById("scene-title");
const zoomBtn = document.getElementById("zoom-toggle");

const path = d3.geoPath(); // us-10m-v1.json is pre-projected (Albers USA, 975×610)

const str = (d) => ({ ...d, id: d.id.trim() });
const [us, electoral, countyCoal, stateCoal, countyElect, countySwing, ohSenate, house, cd] = await Promise.all([
  d3.json(`${BASE}data/us-10m-v1.json`),
  d3.json(`${BASE}data/electoral2016.json`),
  d3.csv(`${BASE}data/coalprod_bycounty.csv`, (d) => ({
    ...str(d),
    total_mines: +d.total_mines,
    total_prod_tons: +d.total_prod_tons,
  })),
  d3.csv(`${BASE}data/coalprod_change2015.csv`, (d) => ({
    ...str(d),
    no_mines_2014: +d.no_mines_2014,
    no_mines_2015: +d.no_mines_2015,
    chg_no_mines: +d.chg_no_mines,
    no_employ_2014: +d.no_employ_2014,
    no_employ_2015: +d.no_employ_2015,
    chg_no_employ: +d.chg_no_employ,
  })),
  d3.csv(`${BASE}data/countyelectdiffs_paoh.csv`, (d) => ({
    ...str(d),
    votes_2012: +d.votes_2012,
    votes_2016: +d.votes_2016,
    change_repub: +d.change_repub,
  })),
  d3.csv(`${BASE}data/county_swing_2024_2026.csv`, (d) => ({
    ...str(d),
    margin24: +d.margin24,
    margin26: +d.margin26,
    swing: +d.swing,
    flipped: d.flipped === "1",
  })),
  d3.csv(`${BASE}data/oh_senate_2024_2026.csv`, (d) => ({
    ...str(d),
    margin24: +d.margin24,
    margin26: +d.margin26,
    swing: +d.swing,
    flipped: d.flipped === "1",
  })),
  d3.csv(`${BASE}data/house_2026_oh_pa.csv`, (d) => ({
    ...str(d),
    district: +d.district,
    dem_pct: +d.dem_pct,
    rep_pct: +d.rep_pct,
    margin: +d.margin,
    flipped: d.flipped === "1",
  })),
  // 2026 (120th Congress) district boundaries, pre-projected to match us-10m-v1.json
  d3.json(`${BASE}data/districts_2026_oh_pa.json`),
]);

const electById = new Map(electoral.map((d) => [d.id, d]));
// Pledged electoral votes per candidate; states with a `split` (Maine) award electors by district.
const electoralTotals = { D: 0, R: 0 };
for (const s of electoral) {
  if (s.split) for (const k in s.split) electoralTotals[k] += s.split[k];
  else electoralTotals[s.winner] += s.votes;
}
const countyCoalById = new Map(countyCoal.map((d) => [d.id, d]));
const stateCoalById = new Map(stateCoal.map((d) => [d.id, d]));
const countyElectById = new Map(countyElect.map((d) => [d.id, d]));
const countySwingById = new Map(countySwing.map((d) => [d.id, d]));
const ohSenateById = new Map(ohSenate.map((d) => [d.id, d]));
const houseById = new Map(house.map((d) => [d.id, d]));
const districts = feature(cd, cd.objects.districts).features;
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
const seatCount = (st, key = "winner") => {
  const hs = house.filter((h) => h.state === st);
  const count = (p, k) => hs.filter((h) => h[k] === p).length;
  return { D: count("D", key), R: count("R", key) };
};

// Candidates for the 2024 → 2026 comparison: [Democrat, Republican]
const CANDIDATES = {
  pres24: { OH: ["Harris", "Trump"], PA: ["Harris", "Trump"] },
  gov26: { OH: ["Acton", "Ramaswamy"], PA: ["Shapiro", "Garrity"] },
};
const marginLabel = (m, [dem, rep]) => (m >= 0 ? `${dem} +${m.toFixed(1)}` : `${rep} +${(-m).toFixed(1)}`);

const states = feature(us, us.objects.states).features;
const counties = feature(us, us.objects.counties).features;
const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const stateName = new Map(electoral.map((d) => [d.id, STATE_NAMES[d.name] ?? d.name]));

// ---------- Scales ----------
const employScale = d3.scaleDiverging([-25, 0, 25], d3.interpolateBrBG).clamp(true);
const tonsExtent = d3.extent(countyCoal, (d) => Math.max(1, d.total_prod_tons));
const tonsScale = d3
  .scaleSequentialLog(tonsExtent, (t) => d3.interpolateYlOrBr(0.25 + 0.75 * t))
  .clamp(true);
const shiftScale = d3.scaleDiverging([-0.2, 0, 0.6], (t) => d3.interpolateRdBu(1 - t)).clamp(true);
// Margin swing in points: negative = toward Republicans (red), positive = toward Democrats (blue).
const swingScale = d3.scaleDiverging([-30, 0, 30], d3.interpolateRdBu).clamp(true);
const senateSwingScale = d3.scaleDiverging([-15, 0, 15], d3.interpolateRdBu).clamp(true);
const houseMarginScale = d3.scaleDiverging([-40, 0, 40], d3.interpolateRdBu).clamp(true);

// ---------- Scenes ----------
const scenes = {
  electoral: {
    title: "Electoral College results, 2016",
    level: "state",
    fill: (d) => {
      const s = electById.get(d.id);
      if (!s) return cssVar("--land");
      return s.winner === "D" ? cssVar("--dem") : cssVar("--rep");
    },
    showFocus: true,
    hint: "Hover or tap a state to see its electoral votes",
    tip: (d) => {
      const s = electById.get(d.id);
      if (!s) return null;
      const dem = s.winner === "D";
      return {
        title: stateName.get(d.id) ?? s.name,
        tag: { cls: dem ? "dem" : "rep", text: dem ? "Clinton" : "Trump" },
        rows: s.split
          ? [
              ["Electoral votes", s.votes],
              ["Clinton", s.split.D],
              ["Trump", s.split.R],
            ]
          : [["Electoral votes", s.votes]],
        note: s.split ? "Electors split by congressional district" : null,
      };
    },
    legend: () =>
      swatches([
        { color: cssVar("--dem"), label: `Clinton (D) · ${electoralTotals.D}` },
        { color: cssVar("--rep"), label: `Trump (R) · ${electoralTotals.R}` },
        { outline: cssVar("--focus"), label: "Ohio & Pennsylvania" },
      ]),
  },

  stateCoal: {
    title: "Change in coal mining employment, 2014 → 2015",
    level: "state",
    fill: (d) => {
      const s = stateCoalById.get(d.id);
      return s ? employScale(s.chg_no_employ) : cssVar("--land-muted");
    },
    hint: "Hover or tap a coal state to see its decline",
    tip: (d) => {
      const s = stateCoalById.get(d.id);
      if (!s) return { title: stateName.get(d.id) ?? electById.get(d.id)?.name ?? "—", note: "No coal mining employment" };
      return {
        title: s.State,
        sub: "2014 → 2015",
        rows: [
          ["Mines", `${s.no_mines_2014} → ${s.no_mines_2015}`, pct(s.chg_no_mines)],
          ["Workers", `${fmt(s.no_employ_2014)} → ${fmt(s.no_employ_2015)}`, pct(s.chg_no_employ)],
        ],
      };
    },
    legend: () =>
      ramp({
        title: "Coal employment change",
        interpolator: (t) => employScale(-25 + 50 * t),
        labels: ["−25%", "0", "+25%"],
      }) + swatches([{ color: cssVar("--land-muted"), label: "No coal mining" }]),
  },

  countyCoal: {
    title: "Coal production by county",
    level: "county",
    fill: (d) => {
      const c = countyCoalById.get(d.id);
      return c ? tonsScale(Math.max(1, c.total_prod_tons)) : cssVar("--land-muted");
    },
    hint: "Hover or tap a coal county to see its production",
    tip: (d) => {
      const c = countyCoalById.get(d.id);
      if (!c) return null;
      return {
        title: `${countyLabel(c.name)}, ${c.state}`,
        rows: [
          ["Total mines", c.total_mines],
          ["Underground", c.no_underground],
          ["Surface", c.no_surface],
          ["Produced", `${fmt(c.total_prod_tons)} tons`],
        ],
      };
    },
    legend: () =>
      ramp({
        title: "Coal produced (short tons, log scale)",
        interpolator: (t) => tonsScale(Math.exp(Math.log(tonsExtent[0]) + t * (Math.log(tonsExtent[1]) - Math.log(tonsExtent[0])))),
        labels: [d3.format(".2s")(tonsExtent[0]), d3.format(".2s")(tonsExtent[1])],
      }),
  },

  countyElection: {
    title: "Change in Republican votes, 2012 → 2016",
    level: "county",
    fill: (d) => {
      const c = countyElectById.get(d.id);
      return c ? shiftScale(c.change_repub) : cssVar("--land-muted");
    },
    showCoalOutline: true,
    hint: "Hover or tap an Ohio or Pennsylvania county",
    tip: (d) => {
      const c = countyElectById.get(d.id);
      if (!c) return null;
      return {
        title: `${countyLabel(c.cty_name)}, ${c.state}`,
        tag: countyCoalById.has(d.id) ? { cls: "coal", text: "Coal county" } : null,
        sub: "Republican presidential votes",
        rows: [
          ["2012", fmt(c.votes_2012)],
          ["2016", fmt(c.votes_2016)],
          ["Change", pct(c.change_repub * 100, 0)],
        ],
      };
    },
    legend: () =>
      ramp({
        title: "Change in Republican votes",
        interpolator: (t) => shiftScale(-0.2 + 0.8 * t),
        labels: ["−20%", "0", "+60%"],
        stops: [0, 0.25, 1],
      }) + swatches([{ outline: cssVar("--coal"), label: "Coal-mining county" }]),
  },

  countySwing: {
    title: "Swing in margin, 2024 President → 2026 Governor",
    level: "county",
    fill: (d) => {
      const c = countySwingById.get(d.id);
      return c ? swingScale(c.swing) : cssVar("--land-muted");
    },
    showCoalOutline: true,
    flips: () => counties.filter((c) => countySwingById.get(c.id)?.flipped),
    hint: "Hover or tap an Ohio or Pennsylvania county",
    tip: (d) => {
      const c = countySwingById.get(d.id);
      if (!c) return null;
      const sw = c.swing;
      return {
        title: `${countyLabel(c.name)}, ${c.state}`,
        tag: c.flipped ? { cls: "dem", text: "Flipped D" } : null,
        sub: countyCoalById.has(d.id) ? "Coal-mining county" : null,
        rows: [
          ["2024 President", marginLabel(c.margin24, CANDIDATES.pres24[c.state])],
          ["2026 Governor", marginLabel(c.margin26, CANDIDATES.gov26[c.state])],
          ["Swing", `${sw >= 0 ? "D" : "R"} +${Math.abs(sw).toFixed(1)} pts`],
        ],
      };
    },
    legend: () =>
      ramp({
        title: "Margin swing (percentage points)",
        interpolator: (t) => swingScale(-30 + 60 * t),
        labels: ["R +30", "0", "D +30"],
      }) +
      swatches([
        { outline: cssVar("--focus"), label: "Flipped R → D" },
        { outline: cssVar("--coal"), label: "Coal-mining county" },
      ]),
  },

  ohSenate: {
    title: "Ohio Senate: Sherrod Brown's swing, 2024 → 2026",
    level: "county",
    fill: (d) => {
      const c = ohSenateById.get(d.id);
      return c ? senateSwingScale(c.swing) : cssVar("--land-muted");
    },
    showCoalOutline: true,
    flips: () => counties.filter((c) => ohSenateById.get(c.id)?.flipped),
    hint: "Hover or tap an Ohio county",
    tip: (d) => {
      const c = ohSenateById.get(d.id);
      if (!c) return null;
      return {
        title: `${countyLabel(c.name)}, OH`,
        tag: c.flipped ? { cls: "dem", text: "Flipped D" } : null,
        sub: countyCoalById.has(d.id) ? "Coal-mining county" : null,
        rows: [
          ["2024 vs. Moreno", marginLabel(c.margin24, ["Brown", "Moreno"])],
          ["2026 vs. Husted", marginLabel(c.margin26, ["Brown", "Husted"])],
          ["Swing", `${c.swing >= 0 ? "D" : "R"} +${Math.abs(c.swing).toFixed(1)} pts`],
        ],
      };
    },
    legend: () =>
      ramp({
        title: "Swing in Brown's margin (points)",
        interpolator: (t) => senateSwingScale(-15 + 30 * t),
        labels: ["R +15", "0", "D +15"],
      }) +
      swatches([
        { outline: cssVar("--focus"), label: "Flipped to Brown" },
        { outline: cssVar("--coal"), label: "Coal-mining county" },
      ]),
  },

  house: {
    title: "U.S. House, 2026: winning margin by district",
    level: "district",
    fill: (d) => {
      const h = houseById.get(d.id);
      return h ? houseMarginScale(h.margin) : cssVar("--land-muted");
    },
    showCoalOutline: true,
    flips: () => districts.filter((d) => houseById.get(d.id)?.flipped),
    hint: "Hover or tap a congressional district",
    tip: (d) => {
      const h = houseById.get(d.id);
      if (!h) return null;
      const rows = [[`${h.dem_name} (D)`, `${h.dem_pct.toFixed(1)}%`]];
      if (h.rep_name) rows.push([`${h.rep_name} (R)`, `${h.rep_pct.toFixed(1)}%`]);
      rows.push(["Margin", marginLabel(h.margin, ["D", "R"])], ["Held in 2024 by", h.winner_2024 === "D" ? "Democrats" : "Republicans"]);
      return {
        title: `${h.state === "OH" ? "Ohio" : "Pennsylvania"}'s ${ordinal(h.district)} District`,
        tag: h.flipped
          ? { cls: h.winner === "D" ? "dem" : "rep", text: `Flipped ${h.winner}` }
          : { cls: h.winner === "D" ? "dem" : "rep", text: h.winner === "D" ? "Dem. hold" : "Rep. hold" },
        sub: h.source,
        rows,
      };
    },
    legend: () => {
      const seats = (st) => {
        const now = seatCount(st), was = seatCount(st, "winner_2024");
        return `${st === "OH" ? "Ohio" : "Pennsylvania"}: ${now.D} D – ${now.R} R (was ${was.D}–${was.R})`;
      };
      return (
        ramp({
          title: "Winning margin (points)",
          interpolator: (t) => houseMarginScale(-40 + 80 * t),
          labels: ["R +40", "0", "D +40"],
        }) +
        swatches([
          { outline: cssVar("--focus"), label: "Flipped R → D" },
          { outline: cssVar("--coal"), label: "Coal-mining county" },
        ]) +
        `<div class="seat-summary">${seats("OH")}<br>${seats("PA")}</div>`
      );
    },
  },
};

// ---------- Legend helpers ----------
function swatches(items) {
  return `<ul class="swatches">${items
    .map(
      (i) =>
        `<li><span class="sw" style="${i.outline ? `border:2px solid ${i.outline}` : `background:${i.color}`}"></span>${i.label}</li>`,
    )
    .join("")}</ul>`;
}

function ramp({ title, interpolator, labels, stops }) {
  const n = 12;
  const grad = d3.range(n + 1).map((i) => `${interpolator(i / n)} ${((i / n) * 100).toFixed(1)}%`);
  const pos = stops ?? labels.map((_, i) => i / (labels.length - 1));
  return `<div class="ramp"><div class="ramp-title">${title}</div>
    <div class="ramp-bar" style="background:linear-gradient(to right, ${grad.join(",")})"></div>
    <div class="ramp-labels">${labels
      .map((l, i) => `<span style="left:${pos[i] * 100}%">${l}</span>`)
      .join("")}</div></div>`;
}

// ---------- Draw base layers ----------
d3.select("#loading").remove();
const root = svg.append("g").attr("class", "zoom-root");

const countyPaths = root
  .append("g")
  .attr("class", "counties")
  .selectAll("path")
  .data(counties)
  .join("path")
  .attr("d", path);

root
  .append("path")
  .attr("class", "county-mesh")
  .attr("d", path(mesh(us, us.objects.counties, (a, b) => a !== b && a.id.slice(0, 2) === b.id.slice(0, 2))));

const statePaths = root
  .append("g")
  .attr("class", "states")
  .selectAll("path")
  .data(states)
  .join("path")
  .attr("d", path);

const districtG = root.append("g").attr("class", "districts");
const districtPaths = districtG.selectAll("path").data(districts).join("path").attr("d", path);
districtG.append("path").attr("class", "district-mesh").attr("d", path(mesh(cd, cd.objects.districts, (a, b) => a !== b)));

root.append("path").attr("class", "state-mesh").attr("d", path(mesh(us, us.objects.states, (a, b) => a !== b)));
root.append("path").attr("class", "nation-outline").attr("d", path(mesh(us, us.objects.states, (a, b) => a === b)));

const coalOutline = root
  .append("path")
  .attr("class", "coal-outline")
  .attr("d", path({ type: "FeatureCollection", features: counties.filter((c) => countyCoalById.has(c.id)) }));

// Outline of whatever the current scene marks as flipped (counties or districts); set in render().
const flipOutline = root.append("path").attr("class", "flip-outline");

const focusOutline = root
  .append("path")
  .attr("class", "focus-outline")
  .attr("d", path({ type: "FeatureCollection", features: states.filter((s) => FOCUS_STATES.includes(s.id)) }));

const hoverPath = root.append("path").attr("class", "hover-outline");

// ---------- Interaction ----------
let scene = null;

function tipHtml(t) {
  const tag = t.tag ? `<span class="tag ${t.tag.cls}">${t.tag.text}</span>` : "";
  const sub = t.sub ? `<div class="tip-sub">${t.sub}</div>` : "";
  const note = t.note ? `<div class="tip-note">${t.note}</div>` : "";
  const rows = (t.rows ?? [])
    .map(([k, v, chg]) => {
      const cls = chg ? (chg.startsWith("−") ? "down" : chg.startsWith("+") ? "up" : "") : "";
      return `<tr><th>${k}</th><td>${v}</td>${chg ? `<td class="chg ${cls}">${chg}</td>` : ""}</tr>`;
    })
    .join("");
  return `<div class="tip-head"><strong>${t.title}</strong>${tag}</div>${sub}${note}${rows ? `<table>${rows}</table>` : ""}`;
}

// Position the tooltip near the pointer, flipping so it stays inside the map area.
function placeTip(event) {
  const wrap = mapWrap.getBoundingClientRect();
  const x = event.clientX - wrap.left;
  const y = event.clientY - wrap.top;
  const { offsetWidth: w, offsetHeight: h } = tipEl;
  const gap = 14;
  let left = x + gap;
  let top = y - h - gap;
  if (left + w > wrap.width) left = x - w - gap;
  if (left < 0) left = Math.max(0, Math.min(wrap.width - w, x - w / 2));
  if (top < 0) top = y + gap;
  if (top + h > wrap.height) top = Math.max(0, wrap.height - h);
  tipEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

let tipFor = null;
function showTip(event, d) {
  const t = scenes[scene].tip(d);
  if (!t) return hideTip();
  if (tipFor !== d) {
    tipEl.innerHTML = tipHtml(t);
    tipFor = d;
  }
  tipEl.hidden = false;
  placeTip(event);
  hoverPath.attr("d", path(d)).attr("opacity", 1);
}
function hideTip() {
  tipEl.hidden = true;
  tipFor = null;
  hoverPath.attr("opacity", 0);
}

for (const sel of [statePaths, countyPaths, districtPaths]) {
  sel
    .on("pointerenter pointermove", (e, d) => {
      if (e.pointerType === "mouse") showTip(e, d);
    })
    .on("click", (e, d) => {
      e.stopPropagation();
      showTip(e, d);
    })
    .on("pointerleave", (e) => {
      if (e.pointerType === "mouse") hideTip();
    });
}
// Touch: tapping anywhere off a shape dismisses the tooltip.
document.addEventListener("click", hideTip);
window.addEventListener("scroll", () => tipFor && !matchMedia("(hover: hover)").matches && hideTip(), { passive: true });

// ---------- Zoom ----------
function regionTransform() {
  const [[x0, y0], [x1, y1]] = path.bounds({
    type: "FeatureCollection",
    features: states.filter((s) => REGION_STATES.includes(s.id)),
  });
  const k = 0.92 * Math.min(W / (x1 - x0), H / (y1 - y0));
  return d3.zoomIdentity.translate(W / 2 - (k * (x0 + x1)) / 2, H / 2 - (k * (y0 + y1)) / 2).scale(k);
}
const REGION = regionTransform();
let view = "us";

function setView(v) {
  view = v;
  const t = v === "region" ? REGION : d3.zoomIdentity;
  root.transition("zoom").duration(ZOOM_MS).ease(d3.easeCubicInOut).attr("transform", t.toString());
  svg.classed("zoomed", v === "region");
  zoomBtn.setAttribute("aria-pressed", String(v === "region"));
  zoomBtn.textContent = v === "region" ? "Show whole U.S." : "Focus on coal region";
}
zoomBtn.addEventListener("click", () => setView(view === "region" ? "us" : "region"));

// ---------- Scene rendering ----------
function render(name, animate = true) {
  const s = scenes[name];
  const changed = name !== scene;
  scene = name;
  const ms = animate ? FILL_MS : 0;
  colorCache = {};

  titleEl.textContent = s.title;
  legendEl.innerHTML = s.legend();
  svg.attr("data-level", s.level);
  if (changed) {
    hideTip();
    hintEl.textContent = s.hint;
  }

  if (s.level === "state") {
    statePaths.transition("fill").duration(ms).attr("fill", s.fill);
  } else if (s.level === "district") {
    districtPaths.transition("fill").duration(ms).attr("fill", s.fill);
    countyPaths.transition("fill").duration(ms).attr("fill", cssVar("--land-muted"));
  } else {
    countyPaths.transition("fill").duration(ms).attr("fill", s.fill);
  }
  focusOutline.classed("on", !!s.showFocus);
  coalOutline.classed("on", !!s.showCoalOutline);
  if (s.flips) flipOutline.attr("d", path({ type: "FeatureCollection", features: s.flips() }));
  flipOutline.classed("on", !!s.flips);
}

// ---------- Scrollytelling ----------
const steps = [...document.querySelectorAll(".step")];
let activeStep = null;

function activate(step) {
  if (step === activeStep) return;
  activeStep?.classList.remove("is-active");
  step.classList.add("is-active");
  activeStep = step;
  if (step.dataset.scene !== scene) render(step.dataset.scene);
  if (step.dataset.view !== view) setView(step.dataset.view);
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) activate(e.target);
  },
  // On narrow screens the map is pinned over the top half, so trigger lower down.
  { rootMargin: window.matchMedia("(max-width: 860px)").matches ? "-70% 0px -25% 0px" : "-45% 0px -45% 0px" },
);
steps.forEach((s) => observer.observe(s));

render(steps[0].dataset.scene, false);
setView(steps[0].dataset.view);
activate(steps[0]);

// Re-read theme colors if the OS color scheme changes.
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => render(scene, false));
