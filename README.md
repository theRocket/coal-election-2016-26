# Coal Country and the 2016 Election

An interactive, scroll-driven D3 map about how the decline of coal mining in Ohio and Pennsylvania lined up with the 2016 U.S. presidential election.

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
