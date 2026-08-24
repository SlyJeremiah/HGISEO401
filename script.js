const DATA_URL = 'data/sites.geojson';

const CATEGORY_COLORS = {
  'Ranger Post': '#6fa8dc',
  'Waterhole': '#4fb6c6',
  'Infrastructure': '#c6954f',
  'Wildlife Sighting': '#7cb86b',
  'Incident': '#c65f4f',
};
const DEFAULT_COLOR = '#a9a26b';

let map, markersLayer;
let allFeatures = [];
let activeCategories = new Set(); // empty = show all
let searchTerm = '';
let markerById = new Map();

init();

async function init() {
  map = L.map('map', { zoomControl: true }).setView([-18.85, 26.8], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: ${res.status}`);
    const geojson = await res.json();
    allFeatures = geojson.features || [];
  } catch (err) {
    console.error(err);
    document.getElementById('entries').innerHTML =
      `<li class="entry"><div class="entry-body"><div class="entry-name">Could not load data</div>
       <div class="entry-notes">${err.message}</div></div></li>`;
    return;
  }

  buildFilterChips();
  render();

  document.getElementById('search').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });
}

function buildFilterChips() {
  const categories = [...new Set(allFeatures.map(f => f.properties.category))].sort();
  const wrap = document.getElementById('filters');
  wrap.innerHTML = '';

  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = cat;
    chip.style.setProperty('--chip-color', CATEGORY_COLORS[cat] || DEFAULT_COLOR);
    chip.addEventListener('click', () => {
      if (activeCategories.has(cat)) activeCategories.delete(cat);
      else activeCategories.add(cat);
      chip.classList.toggle('active');
      render();
    });
    wrap.appendChild(chip);
  });
}

function getFiltered() {
  return allFeatures.filter(f => {
    const p = f.properties;
    const matchesCategory = activeCategories.size === 0 || activeCategories.has(p.category);
    const haystack = `${p.name} ${p.category} ${p.status} ${p.notes || ''}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function render() {
  const filtered = getFiltered();
  renderMarkers(filtered);
  renderList(filtered);
}

function renderMarkers(features) {
  markersLayer.clearLayers();
  markerById.clear();

  features.forEach((f, i) => {
    const [lng, lat] = f.geometry.coordinates;
    const color = CATEGORY_COLORS[f.properties.category] || DEFAULT_COLOR;

    const marker = L.circleMarker([lat, lng], {
      radius: 7,
      color: color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.55,
    });

    marker.bindPopup(
      `<div class="popup-title">${escapeHtml(f.properties.name)}</div>
       <div class="popup-notes">${escapeHtml(f.properties.category)} · ${escapeHtml(f.properties.status)}<br>${escapeHtml(f.properties.notes || '')}</div>`
    );

    marker.addTo(markersLayer);
    markerById.set(f, marker);
  });
}

function renderList(features) {
  const list = document.getElementById('entries');
  list.innerHTML = '';

  features.forEach((f, i) => {
    const p = f.properties;
    const color = CATEGORY_COLORS[p.category] || DEFAULT_COLOR;

    const li = document.createElement('li');
    li.className = 'entry';
    li.innerHTML = `
      <span class="entry-index">${String(i + 1).padStart(2, '0')}</span>
      <div class="entry-body">
        <div class="entry-name">${escapeHtml(p.name)}</div>
        <div class="entry-meta">
          <span class="tag" style="background:${color}">${escapeHtml(p.category)}</span>
          <span class="status">${escapeHtml(p.status)}</span>
        </div>
        <div class="entry-notes">${escapeHtml(p.notes || '')}</div>
      </div>`;

    li.addEventListener('click', () => {
      const marker = markerById.get(f);
      if (!marker) return;
      map.flyTo(marker.getLatLng(), 13, { duration: 0.6 });
      marker.openPopup();
    });

    list.appendChild(li);
  });

  document.getElementById('count').textContent =
    `${features.length} of ${allFeatures.length} entries`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}