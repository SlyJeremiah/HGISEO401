# Field Log — Conservation Site Map

A lightweight web-GIS app that renders a GeoJSON dataset on an interactive map,
with a searchable, filterable "field log" sidebar. Pure HTML/CSS/JS — no build
step, so it deploys to Netlify as-is.

- Map: [Leaflet](https://leafletjs.com/) + CARTO dark basemap tiles
- Data: `data/sites.geojson` (swap in your own file, same structure)
- No framework, no bundler — just static files

## Project structure

```
geo-app/
├── index.html
├── style.css
├── script.js
├── netlify.toml
├── data/
│   └── sites.geojson
└── README.md
```

## Using your own data

Replace `data/sites.geojson` with your own FeatureCollection of Points.
Each feature should have these properties (rename in `script.js` if yours differ):

```json
{
  "type": "Feature",
  "properties": {
    "name": "Site name",
    "category": "Category used for color-coding and filter chips",
    "status": "Status label",
    "notes": "Optional description shown in popup and sidebar"
  },
  "geometry": { "type": "Point", "coordinates": [lng, lat] }
}
```

Category colors are defined in `CATEGORY_COLORS` at the top of `script.js` —
add an entry for each new category so it gets a distinct color instead of
falling back to the default khaki tone. Also update the map's initial
`setView([lat, lng], zoom)` in `script.js` to center on your data.

## Run locally

Any static server works, since `fetch()` needs HTTP (not `file://`):

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000`.

## Version control with GitHub

```bash
cd geo-app
git init
git add .
git commit -m "Initial commit: geo app scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy on Netlify

**Option A — connect the GitHub repo (recommended, auto-deploys on push):**
1. Push this project to a GitHub repo (above).
2. In Netlify: **Add new site → Import an existing project → GitHub**.
3. Select the repo. Build settings are already picked up from `netlify.toml`
   (publish directory `.`, no build command needed).
4. Deploy. Every push to `main` will redeploy automatically.

**Option B — drag and drop:**
1. In Netlify: **Add new site → Deploy manually**.
2. Drag the whole `geo-app` folder onto the upload area.

## Notes

- `netlify.toml` sets the correct content type and CORS header for the
  `.geojson` file, and falls back unmatched routes to `index.html`.
- The map, filters, and search all operate on features loaded client-side —
  there's no backend. For larger datasets you'd want to switch to vector
  tiles or a tiled GeoJSON service instead of one flat file.
