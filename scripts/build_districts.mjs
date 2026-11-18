// Build public/data/districts_2026_oh_pa.json: 2026 (120th Congress) districts for Ohio and Pennsylvania,
// projected into the same pixel space as us-10m-v1.json (geoAlbersUsa, scale 1280, translate [480, 300]).
//
// Usage: node scripts/build_districts.mjs <dir> public/data/districts_2026_oh_pa.json
// where <dir>/x39 and <dir>/x42 hold the unzipped Census TIGER/Line files
//   https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_39_cd120.zip
//   https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_42_cd120.zip
import { writeFileSync } from "fs";
import * as shp from "shapefile";
import { geoAlbersUsa } from "d3-geo";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";
import { feature } from "topojson-client";

const [dir, out] = process.argv.slice(2);
const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
const project = (geom) => {
  // stream through projection into planar coordinates
  const t = (coords) => coords.map((c) => proj(c));
  const map = (g) => g.type === "Polygon" ? { type: "Polygon", coordinates: g.coordinates.map(t) }
    : { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(t)) };
  return map(geom);
};
const feats = [];
for (const st of ["39", "42"]) {
  const src = await shp.open(`${dir}/x${st}/tl_2026_${st}_cd120.shp`);
  let r;
  while (!(r = await src.read()).done) {
    const p = r.value.properties;
    feats.push({ type: "Feature", id: p.GEOID, properties: { state: st === "39" ? "OH" : "PA", district: +p.CD120FP }, geometry: project(r.value.geometry) });
  }
}
let topo = topology({ districts: { type: "FeatureCollection", features: feats } }, 1e5);
topo = presimplify(topo);
topo = simplify(topo, 0.02); // planar area threshold in px² — the map is ~975px wide
// round coordinates via quantization already applied (1e5)
writeFileSync(out, JSON.stringify(topo));
const back = feature(topo, topo.objects.districts).features;
console.log("districts", back.length, "bytes", JSON.stringify(topo).length, "ids", back.map((f) => f.id).sort().join(" "));
