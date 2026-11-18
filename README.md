# Coal Country, 2016–2026

An interactive, scroll-driven D3 map about how the decline of coal mining in Ohio and Pennsylvania helped deliver both swing states, and the Electoral College, to Trump in the 2016 U.S. presidential election, and how both states swung sharply back toward Democrats in 2026, when Josh Shapiro (Pennsylvania, +22.4 points) and Amy Acton (Ohio, +7.9 points) won the governor's races, Sherrod Brown flipped Ohio's Senate seat, and Democrats flipped seven House seats across the two states. Every county in both states moved toward Democrats, though most coal counties still voted Republican.

**Live:** https://ryanrickerts.dev/coal-election-2016-26/

This rebuilds my 2017 final project for CS 498 (Data Visualization) in the UIUC Master of Computer Science in Data Science program. The original reveal.js slideshow is still up at [theRocket/UIUC-CS498-FinalProj](https://github.com/theRocket/UIUC-CS498-FinalProj) ([live](https://ryanrickerts.dev/UIUC-CS498-FinalProj/)).

## What changed from the 2017 version

- A single sticky map that changes scenes as you scroll. It replaces the vendored reveal.js fork.
- D3 v4 → v7 and topojson-client 3, bundled with Vite. No CDN scripts at runtime.
- Responsive SVG that works on phones. Hover or tap a shape to see its data.
- Quantitative color scales (coal tonnage, employment change, vote shift) replace flat category fills, and each scene has a legend.
- The "Focus on coal region" zoom is computed from state bounds instead of hard-coded pixel offsets.
- Light and dark themes, plus support for `prefers-reduced-motion`.
- Data fixes: Virginia is now correctly marked as a Clinton state, and the CSVs are normalized (no BOM, LF line endings).
- New 2026 scene: each Ohio and Pennsylvania county's swing from the 2024 presidential race to the 2026 governor's race, with flipped counties outlined.
- New 2026 scene: Sherrod Brown's Ohio Senate swing by county, from his 2024 loss to Bernie Moreno to his 2026 win over Jon Husted.
- New 2026 scene: U.S. House results on the 2026 district map for Ohio and Pennsylvania, with flipped seats outlined.

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

Pushing to `main` builds the site and deploys it to GitHub Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). In the repo settings, under **Pages → Source**, choose **GitHub Actions**.

## Data

All files are in [`public/data/`](public/data/):

| File | Contents | Source |
| --- | --- | --- |
| `us-10m-v1.json` | Pre-projected U.S. states and counties TopoJSON | [us-atlas](https://github.com/topojson/us-atlas) |
| `electoral2016.json` | 2016 electoral votes and winner by state | Townhall.com |
| `coalprod_change2015.csv` | Mines and coal employment by state, 2014 vs. 2015 | [EIA](https://www.eia.gov/coal/data.php) |
| `coalprod_bycounty.csv` | Mines and production (short tons) by county | [EIA](https://www.eia.gov/coal/data.php) |
| `countyelectdiffs_paoh.csv` | Republican presidential votes by county in OH and PA, 2012 vs. 2016 | Townhall.com |
| `county_swing_2024_2026.csv` | 2024 President and 2026 Governor margins and swing by county in OH and PA (2026 unofficial). Built by [`scripts/build_county_swing.py`](scripts/build_county_swing.py) | [PA Dept. of State](https://www.electionreturns.pa.gov/), [Ohio SOS](https://liveresults.ohiosos.gov/), [Wikipedia (OH 2024 certified)](https://en.wikipedia.org/wiki/2024_United_States_presidential_election_in_Ohio) |
| `oh_senate_2024_2026.csv` | Sherrod Brown's margin by Ohio county, 2024 (vs. Moreno) and 2026 (vs. Husted, unofficial). Built by [`scripts/build_senate_house.py`](scripts/build_senate_house.py) | [Ohio SOS](https://liveresults.ohiosos.gov/), [Wikipedia (2024 certified)](https://en.wikipedia.org/wiki/2024_United_States_Senate_election_in_Ohio) |
| `house_2026_oh_pa.csv` | 2026 House result and 2024 holding party per district, OH and PA. Built by [`scripts/build_senate_house.py`](scripts/build_senate_house.py) | Ohio SOS; [NBC News](https://www.nbcnews.com/politics/2026-elections/pennsylvania-house-results) (PA, 99% reporting); Wikipedia (2024) |
| `districts_2026_oh_pa.json` | 2026 (120th Congress) district boundaries for OH and PA, pre-projected TopoJSON. Built by [`scripts/build_districts.mjs`](scripts/build_districts.mjs) | [Census TIGER/Line 2026](https://www2.census.gov/geo/tiger/TIGER2026/CD/) |
