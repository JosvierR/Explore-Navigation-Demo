import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 4173);
const VALHALLA_BASE = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de';
const CLIENT_ID = process.env.VALHALLA_CLIENT_ID || 'exploreapphq.com-navigation-demo';

const fallbackRoutes = {
  fastest: {
    source: 'fallback',
    mode: 'fastest',
    summary: { time: 780, length: 5.4 },
    coordinates: [
      [-80.1937, 25.7663], [-80.1921, 25.7712], [-80.1870, 25.7765],
      [-80.1790, 25.7800], [-80.1680, 25.7810], [-80.1560, 25.7800],
      [-80.1460, 25.7775], [-80.1380, 25.7712], [-80.1341, 25.7650]
    ],
    maneuvers: [
      'Head north toward Downtown Miami',
      'Continue toward MacArthur Causeway',
      'Keep right toward Miami Beach',
      'Continue south toward South Pointe',
      'Arrive at South Pointe Park'
    ]
  },
  shortest: {
    source: 'fallback',
    mode: 'shortest',
    summary: { time: 900, length: 4.8 },
    coordinates: [
      [-80.1937, 25.7663], [-80.1880, 25.7680], [-80.1810, 25.7710],
      [-80.1720, 25.7730], [-80.1610, 25.7735], [-80.1500, 25.7720],
      [-80.1420, 25.7690], [-80.1341, 25.7650]
    ],
    maneuvers: [
      'Head east toward Biscayne Bay',
      'Continue on the shorter local-road route',
      'Cross toward Miami Beach',
      'Continue south',
      'Arrive at South Pointe Park'
    ]
  }
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function decodePolyline6(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);

    coordinates.push([lon / 1e6, lat / 1e6]);
  }

  return coordinates;
}

async function fetchRoute(start, destination, shortest) {
  const payload = {
    locations: [
      { lat: start.lat, lon: start.lon },
      { lat: destination.lat, lon: destination.lon }
    ],
    costing: 'auto',
    costing_options: { auto: { shortest } },
    units: 'miles',
    directions_options: { language: 'en-US' }
  };

  const url = `${VALHALLA_BASE}/route?json=${encodeURIComponent(JSON.stringify(payload))}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Client-Id': CLIENT_ID
    },
    signal: AbortSignal.timeout(7000)
  });

  if (!response.ok) {
    throw new Error(`Valhalla ${response.status}`);
  }

  const data = await response.json();
  const leg = data?.trip?.legs?.[0];
  if (!leg?.shape || !data?.trip?.summary) {
    throw new Error('Unexpected Valhalla response');
  }

  return {
    source: 'valhalla',
    mode: shortest ? 'shortest' : 'fastest',
    summary: {
      time: data.trip.summary.time,
      length: data.trip.summary.length
    },
    coordinates: decodePolyline6(leg.shape),
    maneuvers: (leg.maneuvers || []).map((item) => item.instruction).filter(Boolean)
  };
}

async function handleRoute(req, res) {
  let raw = '';
  for await (const chunk of req) raw += chunk;

  try {
    const body = JSON.parse(raw || '{}');
    const start = body.start;
    const destination = body.destination;
    if (![start?.lat, start?.lon, destination?.lat, destination?.lon].every(Number.isFinite)) {
      return json(res, 400, { error: 'start and destination coordinates are required' });
    }

    try {
      const [fastest, shortest] = await Promise.all([
        fetchRoute(start, destination, false),
        fetchRoute(start, destination, true)
      ]);
      return json(res, 200, { engine: 'valhalla', routes: [fastest, shortest] });
    } catch (error) {
      console.warn('Valhalla unavailable, serving demo fallback:', error.message);
      return json(res, 200, {
        engine: 'fallback',
        warning: 'Live routing unavailable. Showing local demo geometry.',
        routes: [fallbackRoutes.fastest, fallbackRoutes.shortest]
      });
    }
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

async function serveStatic(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/route') {
    return handleRoute(req, res);
  }
  if (req.method === 'GET') {
    return serveStatic(req, res);
  }
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(port, () => {
  console.log(`Explore Navigation Demo → http://localhost:${port}`);
});
