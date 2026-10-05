# Explore Navigation Demo

A small proof-of-concept for an open-source navigation layer inside **Explore**.

The demo shows the core product idea before we touch the production mobile app:

- MapLibre GL for the map renderer
- OpenFreeMap / OpenStreetMap map data
- Valhalla for real routing
- **Fastest** vs **Shortest** routes
- route selection and map fitting
- a lightweight turn-by-turn animation
- local fallback geometry if the public routing demo is unavailable

## Run it

Requirements: Node.js 20+.

```bash
npm start
```

Open:

```text
http://localhost:4173
```

No npm install is required. MapLibre is loaded from the official CDN in the browser.

## Demo flow (60 seconds)

1. Open the app and show the Explore-style navigation map.
2. Point out the two route choices: **Fastest** and **Shortest**.
3. Toggle between them so the route line changes.
4. Click anywhere on the map to move the destination and recalculate.
5. Press **Start navigation demo** to animate the navigation puck and instructions.
6. Explain that production Explore would replace the animation with real GPS + Ferrostar navigation state.

## Architecture

```text
Explore UI
   |
   v
MapLibre
   |
   +---- OpenFreeMap / OpenStreetMap tiles
   |
   v
Explore routing endpoint
   |
   v
Valhalla
   +---- fastest route
   +---- shortest=true route

Production mobile phase:
MapLibre React Native + Ferrostar + Valhalla
```

## Why the tiny Node server?

Valhalla's own HTTP service does not provide CORS handling by itself. Production deployments normally put a reverse proxy/API layer in front of it. This demo does the same thing with a dependency-free Node server and also attaches an identifying `X-Client-Id` header to public demo-server requests.

## Public demo services

This repository intentionally uses public/open demo infrastructure only for a proof-of-concept. It is **not** the production architecture.

For production Explore:

- self-host Valhalla or use a supported routing provider
- self-host tiles or select a provider with an SLA
- use rate limiting, caching, monitoring and authentication on the routing gateway
- integrate Ferrostar for mobile navigation state, off-route detection and rerouting
- move route preferences into Explore's product layer (`Fastest`, `Shortest`, later `Explore`)

## Mobile integration note

Current MapLibre React Native docs require a native build (not Expo Go) and recommend React Native 0.80+. That compatibility should be resolved before landing the mobile implementation into Explore.

## License

Demo code: MIT. Third-party map/routing data and libraries retain their own licenses and attribution requirements.
