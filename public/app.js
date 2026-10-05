import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.12.0/dist/maplibre-gl.mjs';

const startPreset = { lat: 25.7663, lon: -80.1937, name: 'Brickell City Centre' };
const destinationPreset = { lat: 25.7650, lon: -80.1341, name: 'South Pointe Park' };

let start = { ...startPreset };
let destination = { ...destinationPreset };
let routes = [];
let selectedMode = 'fastest';
let startMarker;
let destinationMarker;
let carMarker;
let animationFrame;

const elements = {
  routeOptions: document.querySelector('#routeOptions'),
  engineBadge: document.querySelector('#engineBadge'),
  routeStatus: document.querySelector('#routeStatus'),
  startButton: document.querySelector('#startButton'),
  resetButton: document.querySelector('#resetButton'),
  swapButton: document.querySelector('#swapButton'),
  recenterButton: document.querySelector('#recenterButton'),
  instructionCard: document.querySelector('#instructionCard'),
  instructionText: document.querySelector('#instructionText')
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-80.165, 25.773],
  zoom: 12.6,
  pitch: 42,
  bearing: -8,
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

map.on('load', async () => {
  addMarkers();
  await calculateRoutes();
});

map.on('click', async (event) => {
  stopAnimation();
  destination = { lat: event.lngLat.lat, lon: event.lngLat.lng, name: 'Selected destination' };
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  elements.routeStatus.textContent = 'Recalculating…';
  await calculateRoutes();
});

function createMarkerElement(className) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function addMarkers() {
  startMarker = new maplibregl.Marker({ element: createMarkerElement('start-pin') })
    .setLngLat([start.lon, start.lat])
    .addTo(map);

  destinationMarker = new maplibregl.Marker({ element: createMarkerElement('destination-pin'), anchor: 'bottom' })
    .setLngLat([destination.lon, destination.lat])
    .addTo(map);
}

async function calculateRoutes() {
  setEngineBadge('loading');
  elements.startButton.disabled = true;

  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, destination })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Route request failed');

    routes = data.routes;
    setEngineBadge(data.engine === 'valhalla' ? 'live' : 'fallback');
    elements.routeStatus.textContent = data.engine === 'valhalla' ? 'Live Valhalla route' : 'Local fallback active';
    renderRouteOptions();
    drawRoutes();
    fitRoutes();
    elements.startButton.disabled = false;
  } catch (error) {
    console.error(error);
    elements.routeStatus.textContent = 'Could not load routes';
    setEngineBadge('fallback');
  }
}

function setEngineBadge(state) {
  elements.engineBadge.className = 'engine-badge';
  if (state === 'live') {
    elements.engineBadge.textContent = '● Valhalla live';
    elements.engineBadge.classList.add('live');
  } else if (state === 'fallback') {
    elements.engineBadge.textContent = '● Demo fallback';
    elements.engineBadge.classList.add('fallback');
  } else {
    elements.engineBadge.textContent = 'Connecting…';
  }
}

function renderRouteOptions() {
  elements.routeOptions.innerHTML = '';

  for (const route of routes) {
    const button = document.createElement('button');
    button.className = `route-option ${route.mode === selectedMode ? 'selected' : ''}`;
    button.dataset.mode = route.mode;
    button.innerHTML = `
      <div class="label">
        <span>${route.mode === 'fastest' ? '⚡ Fastest' : '↔ Shortest'}</span>
        <span class="route-swatch"></span>
      </div>
      <div class="time">${Math.max(1, Math.round(route.summary.time / 60))} min</div>
      <div class="meta">${Number(route.summary.length).toFixed(1)} mi · ${route.mode === 'fastest' ? 'time optimized' : 'distance optimized'}</div>
    `;
    button.addEventListener('click', () => selectRoute(route.mode));
    elements.routeOptions.appendChild(button);
  }
}

function selectRoute(mode) {
  selectedMode = mode;
  stopAnimation();
  renderRouteOptions();
  styleRouteLayers();
}

function routeGeoJSON(route) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: route.coordinates },
    properties: { mode: route.mode }
  };
}

function drawRoutes() {
  for (const route of routes) {
    const sourceId = `route-${route.mode}`;
    const outlineId = `${sourceId}-outline`;
    const layerId = `${sourceId}-line`;

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(outlineId)) map.removeLayer(outlineId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, { type: 'geojson', data: routeGeoJSON(route) });
    map.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.92 }
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#9faab5', 'line-width': 6, 'line-opacity': 0.85 }
    });
  }
  styleRouteLayers();
}

function styleRouteLayers() {
  for (const route of routes) {
    const layerId = `route-${route.mode}-line`;
    if (!map.getLayer(layerId)) continue;
    const selected = route.mode === selectedMode;
    map.setPaintProperty(layerId, 'line-color', selected ? '#00AEF0' : '#aab3bd');
    map.setPaintProperty(layerId, 'line-width', selected ? 7 : 5);
    map.setPaintProperty(layerId, 'line-opacity', selected ? 0.98 : 0.56);
    map.moveLayer(`route-${route.mode}-outline`);
    map.moveLayer(layerId);
  }
}

function fitRoutes() {
  const points = routes.flatMap((route) => route.coordinates);
  if (!points.length) return;
  const bounds = points.reduce(
    (box, coordinate) => box.extend(coordinate),
    new maplibregl.LngLatBounds(points[0], points[0])
  );
  map.fitBounds(bounds, {
    padding: { top: 130, left: 70, right: 70, bottom: 330 },
    duration: 700,
    maxZoom: 14.8
  });
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = undefined;
  if (carMarker) {
    carMarker.remove();
    carMarker = undefined;
  }
  elements.instructionCard.classList.add('hidden');
  elements.startButton.textContent = 'Start navigation demo';
}

function startNavigationDemo() {
  stopAnimation();
  const route = routes.find((item) => item.mode === selectedMode);
  if (!route?.coordinates?.length) return;

  elements.startButton.textContent = 'Navigating…';
  elements.instructionCard.classList.remove('hidden');

  carMarker = new maplibregl.Marker({ element: createMarkerElement('car-puck'), anchor: 'center' })
    .setLngLat(route.coordinates[0])
    .addTo(map);

  const points = densify(route.coordinates, 220);
  const duration = 9000;
  const begin = performance.now();

  function animate(now) {
    const progress = Math.min(1, (now - begin) / duration);
    const eased = 1 - Math.pow(1 - progress, 2.2);
    const index = Math.min(points.length - 1, Math.floor(eased * (points.length - 1)));
    const coordinate = points[index];
    carMarker.setLngLat(coordinate);

    const maneuverIndex = Math.min(
      Math.max(0, (route.maneuvers?.length || 1) - 1),
      Math.floor(progress * (route.maneuvers?.length || 1))
    );
    elements.instructionText.textContent = route.maneuvers?.[maneuverIndex] || 'Continue on selected route';

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      elements.instructionText.textContent = 'You have arrived';
      elements.startButton.textContent = 'Replay navigation';
    }
  }

  animationFrame = requestAnimationFrame(animate);
}

function densify(coordinates, targetCount) {
  if (coordinates.length < 2) return coordinates;
  const segments = coordinates.length - 1;
  const perSegment = Math.max(2, Math.floor(targetCount / segments));
  const result = [];

  for (let i = 0; i < segments; i += 1) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    for (let step = 0; step < perSegment; step += 1) {
      const t = step / perSegment;
      result.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t
      ]);
    }
  }
  result.push(coordinates.at(-1));
  return result;
}

elements.startButton.addEventListener('click', startNavigationDemo);

elements.resetButton.addEventListener('click', async () => {
  stopAnimation();
  start = { ...startPreset };
  destination = { ...destinationPreset };
  selectedMode = 'fastest';
  startMarker.setLngLat([start.lon, start.lat]);
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  await calculateRoutes();
});

elements.swapButton.addEventListener('click', async () => {
  stopAnimation();
  [start, destination] = [destination, start];
  startMarker.setLngLat([start.lon, start.lat]);
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  await calculateRoutes();
});

elements.recenterButton.addEventListener('click', fitRoutes);
