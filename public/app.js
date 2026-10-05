import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.12.0/dist/maplibre-gl.mjs';

const startPreset = { lat: 25.7663, lon: -80.1937, name: 'Brickell City Centre' };
const destinationPreset = { lat: 25.7650, lon: -80.1341, name: 'South Pointe Park' };

const poiData = [
  { id: 'south-pointe', name: 'South Pointe Park', subtitle: 'Beach sunset walk', category: 'beach', lat: 25.7650, lon: -80.1341, icon: '🏖️', score: '4.9 ★', eta: '12 min', palette: ['#00AEFF', '#006DFF'] },
  { id: 'bayfront', name: 'Bayfront Park', subtitle: 'Waterfront green space', category: 'park', lat: 25.7743, lon: -80.1869, icon: '🌴', score: '4.7 ★', eta: '7 min', palette: ['#00AEFF', '#00D4FF'] },
  { id: 'lummus', name: 'Lummus Park', subtitle: 'Beachfront palm strip', category: 'beach', lat: 25.7829, lon: -80.1340, icon: '🌊', score: '4.8 ★', eta: '14 min', palette: ['#0891B2', '#00AEFF'] },
  { id: 'carbone', name: 'Carbone Miami', subtitle: 'Dinner hotspot', category: 'restaurant', lat: 25.7932, lon: -80.1405, icon: '🍝', score: '4.8 ★', eta: '16 min', palette: ['#00AEFF', '#2563EB'] },
  { id: 'perez', name: 'Pérez Art Museum', subtitle: 'Culture by the bay', category: 'park', lat: 25.7856, lon: -80.1864, icon: '🎨', score: '4.7 ★', eta: '9 min', palette: ['#0284C7', '#00AEFF'] },
  { id: 'joes', name: "Joe's Stone Crab", subtitle: 'Classic Miami dining', category: 'restaurant', lat: 25.7680, lon: -80.1405, icon: '🦀', score: '4.8 ★', eta: '13 min', palette: ['#0078FF', '#00AEFF'] }
];

const routeModes = {
  fastest: {
    label: '⚡ Fastest',
    color: '#00AEFF',
    soft: '#8FDDFF',
    trafficLabel: 'Moderate',
    trafficTone: 'amber',
    trafficDelay: 4,
    congestion: 62,
    descriptor: 'Best ETA'
  },
  shortest: {
    label: '🌿 Shortest',
    color: '#22C55E',
    soft: '#9DE7B2',
    trafficLabel: 'Light',
    trafficTone: 'green',
    trafficDelay: 2,
    congestion: 34,
    descriptor: 'Least distance'
  }
};

let start = { ...startPreset };
let destination = { ...destinationPreset };
let routes = [];
let selectedMode = 'fastest';
let startMarker;
let destinationMarker;
let poiMarkers = [];
let carMarker;
let animationFrame;
let cameraFrameCounter = 0;
let storyRotationTimer;
let activeStoryIndex = 0;

const elements = {
  routeOptions: document.querySelector('#routeOptions'),
  engineBadge: document.querySelector('#engineBadge'),
  routeStatus: document.querySelector('#routeStatus'),
  startButton: document.querySelector('#startButton'),
  resetButton: document.querySelector('#resetButton'),
  swapButton: document.querySelector('#swapButton'),
  recenterButton: document.querySelector('#recenterButton'),
  instructionCard: document.querySelector('#instructionCard'),
  instructionText: document.querySelector('#instructionText'),
  storyRail: document.querySelector('#storyRail'),
  tripTitle: document.querySelector('#tripTitle'),
  hotspotCount: document.querySelector('#hotspotCount'),
  trafficSummary: document.querySelector('#trafficSummary'),
  modeSummary: document.querySelector('#modeSummary')
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-80.165, 25.773],
  zoom: 12.55,
  pitch: 48,
  bearing: -10,
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

map.on('load', async () => {
  addCoreMarkers();
  addPoiMarkers();
  renderStories();
  syncTripTitle();
  await calculateRoutes();
  startStoryRotation();
});

map.on('click', async (event) => {
  stopAnimation();
  destination = { lat: event.lngLat.lat, lon: event.lngLat.lng, name: 'Selected destination' };
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  syncTripTitle();
  elements.routeStatus.textContent = 'Recalculating…';
  await calculateRoutes();
});

function createMarkerElement(className, inner = '') {
  const element = document.createElement('button');
  element.className = className;
  element.type = 'button';
  if (inner) element.innerHTML = inner;
  return element;
}

function addCoreMarkers() {
  startMarker = new maplibregl.Marker({ element: createMarkerElement('start-pin') })
    .setLngLat([start.lon, start.lat])
    .addTo(map);

  destinationMarker = new maplibregl.Marker({ element: createMarkerElement('destination-pin'), anchor: 'bottom' })
    .setLngLat([destination.lon, destination.lat])
    .addTo(map);
}

function addPoiMarkers() {
  poiMarkers.forEach((marker) => marker.remove());
  poiMarkers = poiData.map((poi) => {
    const element = createMarkerElement(
      `poi-marker ${poi.category}`,
      `<span>${poi.icon}</span><strong>${shortCategoryLabel(poi.category)}</strong>`
    );
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      focusPoi(poi);
    });

    return new maplibregl.Marker({ element, anchor: 'bottom' })
      .setLngLat([poi.lon, poi.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 14 }).setHTML(`
          <div class="popup-card">
            <strong>${poi.name}</strong>
            <span>${poi.subtitle}</span>
            <small>${poi.score} · ${capitalize(poi.category)}</small>
          </div>
        `)
      )
      .addTo(map);
  });
}

function syncTripTitle() {
  elements.tripTitle.textContent = `${shortPlaceName(start.name)} → ${shortPlaceName(destination.name)}`;
}

function shortPlaceName(name) {
  return name.replace(' City Centre', '').replace(' Park', '').replace(' Miami', '');
}

async function focusPoi(poi) {
  stopAnimation();
  destination = { lat: poi.lat, lon: poi.lon, name: poi.name };
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  syncTripTitle();
  map.flyTo({ center: [poi.lon, poi.lat], zoom: 13.5, pitch: 54, duration: 1200, essential: true });
  elements.routeStatus.textContent = `Routing to ${poi.name}…`;
  await calculateRoutes();
  setActiveStoryById(poi.id);
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

    routes = decorateRoutes(data.routes);
    setEngineBadge(data.engine === 'valhalla' ? 'live' : 'fallback');
    elements.routeStatus.textContent =
      data.engine === 'valhalla'
        ? 'Live Valhalla route with simulated traffic'
        : 'Local fallback active with simulated traffic';

    renderRouteOptions();
    drawRoutes();
    fitRoutes();
    updateSummary();
    elements.startButton.disabled = false;
  } catch (error) {
    console.error(error);
    elements.routeStatus.textContent = 'Could not load routes';
    setEngineBadge('fallback');
  }
}

function decorateRoutes(rawRoutes) {
  return rawRoutes.map((route) => {
    const presentation = routeModes[route.mode] || routeModes.fastest;
    const baseMinutes = Math.max(1, Math.round(route.summary.time / 60));
    const nearbySpots = getNearbySpots(route.coordinates);
    return {
      ...route,
      ...presentation,
      nearbySpots,
      travelMinutes: baseMinutes + presentation.trafficDelay,
      distanceMiles: Number(route.summary.length).toFixed(1)
    };
  });
}

function getNearbySpots(coordinates) {
  if (!coordinates?.length) return [];
  const sample = coordinates.filter((_, index) => index % Math.max(1, Math.floor(coordinates.length / 6)) === 0);
  return poiData
    .map((poi) => {
      const minDistance = sample.reduce((best, coordinate) => {
        const d = roughDistanceMiles(poi.lon, poi.lat, coordinate[0], coordinate[1]);
        return Math.min(best, d);
      }, Number.POSITIVE_INFINITY);
      return { poi, minDistance };
    })
    .filter((item) => item.minDistance < 2.2)
    .sort((a, b) => a.minDistance - b.minDistance)
    .slice(0, 4)
    .map((item) => item.poi);
}

function roughDistanceMiles(lon1, lat1, lon2, lat2) {
  const dx = (lon1 - lon2) * 54.6;
  const dy = (lat1 - lat2) * 69.0;
  return Math.sqrt(dx * dx + dy * dy);
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
    button.style.setProperty('--route-color', route.color);
    button.style.setProperty('--route-soft', route.soft);

    const hotspotNames = route.nearbySpots.slice(0, 2).map((spot) => spot.name).join(' · ') || 'Explore hotspots';

    button.innerHTML = `
      <div class="route-card-top">
        <div class="label-group">
          <span class="label-title">${route.label}</span>
          <span class="label-caption">${route.descriptor}</span>
        </div>
        <span class="route-swatch"></span>
      </div>
      <div class="time-row">
        <div class="time">${route.travelMinutes} min</div>
        <div class="eta-pill ${route.trafficTone}">+${route.trafficDelay} min traffic</div>
      </div>
      <div class="meta">${route.distanceMiles} mi · congestion ${route.congestion}% · ${route.trafficLabel.toLowerCase()}</div>
      <div class="traffic-bar" aria-hidden="true">
        <span style="width:${route.congestion}%"></span>
      </div>
      <div class="spot-preview">${hotspotNames}</div>
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
  updateSummary();
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
    const haloId = `${sourceId}-halo`;
    const lineId = `${sourceId}-line`;
    const dashId = `${sourceId}-dash`;

    [lineId, haloId, dashId].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, { type: 'geojson', data: routeGeoJSON(route) });
    map.addLayer({
      id: haloId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': route.mode === selectedMode ? 12 : 10,
        'line-opacity': 0.92
      }
    });
    map.addLayer({
      id: lineId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.color,
        'line-width': route.mode === selectedMode ? 7 : 5,
        'line-opacity': route.mode === selectedMode ? 0.98 : 0.58
      }
    });
    map.addLayer({
      id: dashId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': route.soft,
        'line-width': route.mode === selectedMode ? 3 : 2,
        'line-opacity': route.mode === selectedMode ? 0.85 : 0.45,
        'line-dasharray': [0.6, 1.7]
      }
    });
  }
  styleRouteLayers();
}

function styleRouteLayers() {
  for (const route of routes) {
    const selected = route.mode === selectedMode;
    const lineId = `route-${route.mode}-line`;
    const haloId = `route-${route.mode}-halo`;
    const dashId = `route-${route.mode}-dash`;

    if (!map.getLayer(lineId)) continue;

    map.setPaintProperty(lineId, 'line-color', route.color);
    map.setPaintProperty(lineId, 'line-width', selected ? 7 : 5);
    map.setPaintProperty(lineId, 'line-opacity', selected ? 0.98 : 0.58);
    map.setPaintProperty(haloId, 'line-width', selected ? 12 : 10);
    map.setPaintProperty(dashId, 'line-width', selected ? 3 : 2);
    map.setPaintProperty(dashId, 'line-opacity', selected ? 0.85 : 0.45);

    map.moveLayer(haloId);
    map.moveLayer(lineId);
    map.moveLayer(dashId);
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
    padding: { top: 225, left: 70, right: 70, bottom: 360 },
    duration: 900,
    maxZoom: 14.8
  });
}

function updateSummary() {
  const route = routes.find((item) => item.mode === selectedMode) || routes[0];
  if (!route) return;
  elements.hotspotCount.textContent = `${route.nearbySpots.length || 0} nearby`;
  elements.trafficSummary.textContent = `${route.trafficLabel} · +${route.trafficDelay} min`;
  elements.modeSummary.textContent = route.label.replace(/^[^A-Za-z]+\s*/, '');
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = undefined;
  cameraFrameCounter = 0;
  if (carMarker) {
    carMarker.remove();
    carMarker = undefined;
  }
  elements.instructionCard.classList.add('hidden');
  elements.startButton.textContent = 'Start smooth navigation';
}

function startNavigationDemo() {
  stopAnimation();
  const route = routes.find((item) => item.mode === selectedMode);
  if (!route?.coordinates?.length) return;

  elements.startButton.textContent = 'Navigating…';
  elements.instructionCard.classList.remove('hidden');

  carMarker = new maplibregl.Marker({ element: createMarkerElement('car-puck', '<span>➤</span>'), anchor: 'center' })
    .setLngLat(route.coordinates[0])
    .addTo(map);

  const points = densify(route.coordinates, 260);
  const duration = 12000;
  const begin = performance.now();

  map.easeTo({ center: route.coordinates[0], zoom: 14.3, pitch: 62, duration: 650, essential: true });

  function animate(now) {
    const progress = Math.min(1, (now - begin) / duration);
    const eased = 1 - Math.pow(1 - progress, 2.4);
    const index = Math.min(points.length - 2, Math.floor(eased * (points.length - 2)));
    const coordinate = points[index];
    const next = points[index + 1];
    const bearing = getBearing(coordinate, next);

    carMarker.setLngLat(coordinate);

    const maneuverIndex = Math.min(
      Math.max(0, (route.maneuvers?.length || 1) - 1),
      Math.floor(progress * (route.maneuvers?.length || 1))
    );
    elements.instructionText.textContent = route.maneuvers?.[maneuverIndex] || 'Continue on selected route';

    cameraFrameCounter += 1;
    if (cameraFrameCounter % 8 === 0) {
      map.easeTo({
        center: coordinate,
        bearing,
        pitch: 62,
        zoom: 14.35,
        duration: 420,
        essential: true
      });
    }

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      elements.instructionText.textContent = 'You have arrived';
      elements.startButton.textContent = 'Replay navigation';
      map.easeTo({ center: coordinate, bearing, pitch: 54, zoom: 14.2, duration: 900, essential: true });
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

function getBearing(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const toDegrees = (radians) => (radians * 180) / Math.PI;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lon2 - lon1));
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function renderStories() {
  elements.storyRail.innerHTML = '';

  poiData.forEach((poi, index) => {
    const button = document.createElement('button');
    button.className = `story-card ${poi.category} ${index === activeStoryIndex ? 'active' : ''}`;
    button.type = 'button';
    button.dataset.poiId = poi.id;
    button.style.setProperty('--story-start', poi.palette[0]);
    button.style.setProperty('--story-end', poi.palette[1]);
    button.innerHTML = `
      <div class="story-photo" aria-hidden="true">
        <div class="story-glow"></div>
        <div class="story-icon">${poi.icon}</div>
      </div>
      <div class="story-meta">
        <div class="story-topline">
          <span>${capitalize(poi.category)}</span>
          <span>${poi.score}</span>
        </div>
        <strong>${poi.name}</strong>
        <p>${poi.subtitle}</p>
        <div class="story-footer">
          <span>${poi.eta}</span>
          <span>Tap to route</span>
        </div>
      </div>
    `;
    button.addEventListener('click', () => focusPoi(poi));
    elements.storyRail.appendChild(button);
  });
}

function setActiveStoryById(poiId) {
  const index = poiData.findIndex((poi) => poi.id === poiId);
  if (index === -1) return;
  activeStoryIndex = index;
  syncStoryActiveState();
}

function syncStoryActiveState() {
  const cards = [...elements.storyRail.querySelectorAll('.story-card')];
  cards.forEach((card, index) => {
    card.classList.toggle('active', index === activeStoryIndex);
  });
  const activeCard = cards[activeStoryIndex];
  activeCard?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function startStoryRotation() {
  clearInterval(storyRotationTimer);
  storyRotationTimer = setInterval(() => {
    activeStoryIndex = (activeStoryIndex + 1) % poiData.length;
    syncStoryActiveState();
  }, 3200);
}

function shortCategoryLabel(category) {
  return category === 'restaurant' ? 'FOOD' : category === 'beach' ? 'BEACH' : 'PARK';
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

elements.startButton.addEventListener('click', startNavigationDemo);

elements.resetButton.addEventListener('click', async () => {
  stopAnimation();
  start = { ...startPreset };
  destination = { ...destinationPreset };
  selectedMode = 'fastest';
  startMarker.setLngLat([start.lon, start.lat]);
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  syncTripTitle();
  await calculateRoutes();
  map.flyTo({ center: [-80.165, 25.773], zoom: 12.55, pitch: 48, bearing: -10, duration: 850, essential: true });
});

elements.swapButton.addEventListener('click', async () => {
  stopAnimation();
  [start, destination] = [destination, start];
  startMarker.setLngLat([start.lon, start.lat]);
  destinationMarker.setLngLat([destination.lon, destination.lat]);
  syncTripTitle();
  await calculateRoutes();
});

elements.recenterButton.addEventListener('click', fitRoutes);
