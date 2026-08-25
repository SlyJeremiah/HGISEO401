// ---------- Configure your layers here ----------
// Each entry is one GeoJSON file rendered as one toggleable layer.
// type: 'point' | 'line' | 'polygon' — controls how it's drawn.
// categorize: (points only) if true, colors features by their
//   `category` property using CATEGORY_COLORS; if false/omitted,
//   the whole layer uses `color`.
const LAYER_CONFIG = [
  {
    id: 'sites',
    label: 'Sites',
    file: 'data/sites.geojson',
    type: 'point',
    categorize: true,
    color: '#a9a26b',
  },
  {
    id: 'routes',
    label: 'Patrol Routes',
    file: 'data/routes.geojson',
    type: 'line',
    color: '#c6954f',
  },
  {
    id: 'boundary',
    label: 'Park Boundary',
    file: 'data/boundary.geojson',
    type: 'polygon',
    color: '#7cb86b',
  },
];

const CATEGORY_COLORS = {
  'Ranger Post': '#6fa8dc',
  'Waterhole': '#4fb6c6',
  'Infrastructure': '#c6954f',
  'Wildlife Sighting': '#7cb86b',
  'Incident': '#c65f4f',
};
const DEFAULT_COLOR = '#a9a26b';

let map;
let layers = {};      // id -> { config, leafletLayer, features: [], visible: bool }
let searchTerm = '';

init();

async function init() {
  map = L.map('map', { zoomControl: true }).setView([-18.85, 26.8], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const results = await Promise.allSettled(
    LAYER_CONFIG.map(cfg => loadLayer(cfg))
  );

  results.forEach((result, i) => {
    const cfg = LAYER_CONFIG[i];
    if (result.status === 'fulfilled') {
      layers[cfg.id] = result.value;
      layers[cfg.id].leafletLayer.addTo(map);
    } else {
      console.error(`Failed to load layer "${cfg.id}":`, result.reason);
      layers[cfg.id] = { config: cfg, leafletLayer: null, features: [], visible: false, error: result.reason.message };
    }
  });

  fitToAllLayers();
  buildLayerToggles();
  render();

  document.getElementById('search').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });
}

async function loadLayer(cfg) {
  const res = await fetch(cfg.file);
  if (!res.ok) throw new Error(`${cfg.file}: ${res.status}`);
  const geojson = await res.json();
  const features = geojson.features || [];

  const leafletLayer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const color = cfg.categorize
        ? (CATEGORY_COLORS[feature.properties.category] || DEFAULT_COLOR)
        : cfg.color;
      return L.circleMarker(latlng, {
        radius: 7,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.55,
      });
    },
    style: () => ({
      color: cfg.color,
      weight: cfg.type === 'polygon' ? 2 : 3,
      fillColor: cfg.color,
      fillOpacity: cfg.type === 'polygon' ? 0.15 : 0,
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(popupHtml(feature, cfg));
    },
  });

  return { config: cfg, leafletLayer, features, visible: true };
}

function popupHtml(feature, cfg) {
  const p = feature.properties || {};
  const title = p.name || p.Name || Object.values(p)[0] || cfg.label;
  const rows = Object.entries(p)
    .filter(([k]) => k.toLowerCase() !== 'name')
    .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`)
    .join('<br>');
  return `<div class="popup-title">${escapeHtml(title)}</div>
          <div class="popup-notes">${escapeHtml(cfg.label)}${rows ? '<br>' + rows : ''}</div>`;
}

function fitToAllLayers() {
  const active = Object.values(layers).filter(l => l.leafletLayer);
  if (!active.length) return;
  const group = L.featureGroup(active.map(l => l.leafletLayer));
  const bounds = group.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
}

function buildLayerToggles() {
  const wrap = document.getElementById('filters');
  wrap.innerHTML = '';

  LAYER_CONFIG.forEach(cfg => {
    const state = layers[cfg.id];
    const row = document.createElement('label');
    row.className = 'layer-toggle';
    if (state.error) row.classList.add('layer-error');

    const count = state.features ? state.features.length : 0;

    row.innerHTML = `
      <input type="checkbox" ${state.visible ? 'checked' : ''} ${state.error ? 'disabled' : ''} />
      <span class="swatch" style="background:${cfg.color}"></span>
      <span class="layer-name">${escapeHtml(cfg.label)}</span>
      <span class="layer-count">${state.error ? 'failed to load' : count}</span>
    `;

    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', () => {
      state.visible = checkbox.checked;
      if (state.visible) {
        state.leafletLayer.addTo(map);
      } else {
        map.removeLayer(state.leafletLayer);
      }
      render();
    });

    wrap.appendChild(row);
  });
}

function getVisibleFeatures() {
  const out = [];
  Object.values(layers).forEach(state => {
    if (!state.visible || !state.features) return;
    state.features.forEach(f => out.push({ feature: f, config: state.config, layerState: state }));
  });
  if (!searchTerm) return out;
  return out.filter(({ feature, config }) => {
    const p = feature.properties || {};
    const haystack = `${config.label} ${Object.values(p).join(' ')}`.toLowerCase();
    return haystack.includes(searchTerm);
  });
}

function render() {
  renderList(getVisibleFeatures());
}

function renderList(items) {
  const list = document.getElementById('entries');
  list.innerHTML = '';

  items.forEach((item, i) => {
    const { feature, config } = item;
    const p = feature.properties || {};
    const title = p.name || p.Name || Object.values(p)[0] || config.label;
    const secondary = Object.entries(p).find(([k]) => k.toLowerCase() !== 'name');

    const li = document.createElement('li');
    li.className = 'entry';
    li.innerHTML = `
      <span class="entry-index">${String(i + 1).padStart(2, '0')}</span>
      <div class="entry-body">
        <div class="entry-name">${escapeHtml(title)}</div>
        <div class="entry-meta">
          <span class="tag" style="background:${config.color}">${escapeHtml(config.label)}</span>
          ${secondary ? `<span class="status">${escapeHtml(secondary[0])}: ${escapeHtml(secondary[1])}</span>` : ''}
        </div>
      </div>`;

    li.addEventListener('click', () => {
      focusFeature(feature);
    });

    list.appendChild(li);
  });

  const totalLoaded = Object.values(layers).reduce((sum, l) => sum + (l.features ? l.features.length : 0), 0);
  document.getElementById('count').textContent = `${items.length} of ${totalLoaded} entries`;
}

function focusFeature(feature) {
  const geom = feature.geometry;
  if (!geom) return;

  let latlng;
  if (geom.type === 'Point') {
    latlng = [geom.coordinates[1], geom.coordinates[0]];
    map.flyTo(latlng, 13, { duration: 0.6 });
  } else {
    const tempLayer = L.geoJSON(feature);
    const bounds = tempLayer.getBounds();
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6 });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
