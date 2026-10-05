# Explore Navigation Demo — Mobile-First Implementation Task

## Goal

Turn the current desktop/web proof of concept into a polished **mobile-first Explore navigation experience** that looks and behaves like a real screen from Explore, not a generic responsive map.

The finished result must be easy to demo on a phone viewport and should feel consistent with Explore's existing visual identity.

## Brand requirements

- Explore primary blue: **#00AEFF**.
- Blue is the dominant action/navigation color.
- White surfaces, dark charcoal text, soft gray secondary text.
- Green may be used only to distinguish the **Shortest** route.
- Orange/red/yellow should be reserved for traffic/congestion states and warnings.
- Do not turn the overall product into a multi-color dashboard.
- Avoid generic AI-dashboard styling.
- Keep the look clean, modern, mobile, smooth and Explore-specific.

## Target devices

Design and test at minimum:

- iPhone 15 / 393 × 852
- iPhone 15 Pro Max / 430 × 932
- Pixel 8 / 412 × 915
- Small Android / 360 × 800

The desktop presentation view can remain usable, but mobile is the source of truth.

---

# 1. Mobile layout architecture

Rebuild the screen into three primary layers.

## Layer A — Full-screen map

The map must occupy the entire viewport.

Requirements:

- no fixed desktop-width card assumptions
- support portrait viewport first
- respect iOS/Android safe areas
- controls must never collide with Dynamic Island/notch/home indicator
- user puck and route must remain visible when sheets/cards expand
- preserve map gestures:
  - pinch zoom
  - pan
  - rotate
  - pitch where supported

Map should feel visually lightweight so Explore POIs and routes are easy to scan.

## Layer B — Explore discovery rail

At the top of the map add a compact Explore discovery experience.

Mobile behavior:

- horizontally scrollable cards
- approximately 140–165px wide
- 88–110px high in collapsed form
- active card slightly enlarges or elevates
- smooth snap scrolling
- card tap selects destination
- marker and card selection stay synchronized

Each card should contain:

- place image or visual thumbnail
- place name
- category
- rating
- short ETA from user
- small Explore blue route/action cue

Categories for demo:

- Restaurants
- Parks
- Beaches
- Culture / attractions

Do not let the rail cover too much of the map.

### Image behavior

For the demo, cards may use local/static image URLs or visual placeholders.

Production-ready structure should support:

```ts
{
  id,
  name,
  category,
  imageUrl,
  rating,
  latitude,
  longitude,
  eta,
  source
}
```

Cards should have a subtle animated treatment:

- gentle scale on active card
- parallax/gradient movement if lightweight
- no distracting looping animation
- honor prefers-reduced-motion

---

# 2. Mobile bottom sheet

Replace the large desktop panel with a mobile bottom sheet.

Recommended states:

## Collapsed

Height approximately 120–150px.

Show:

- destination
- selected route ETA
- distance
- traffic state
- main blue Start button

## Medium

Show:

- route alternatives
- congestion
- route colors
- nearby Explore places
- Start navigation CTA

## Expanded

Optional for demo.

Can contain:

- route details
- Explore places along route
- simulated traffic legend
- technical demo info

Use a visible grab handle.

If implementing only web:

- use pointer/touch events
- CSS transforms
- requestAnimationFrame
- snap to predefined positions

If porting into React Native later:

- use a native-quality bottom sheet solution
- ensure gestures do not fight MapLibre gestures

---

# 3. Route design

The two route alternatives must be instantly distinguishable.

## Fastest

Explore blue:

`#00AEFF`

Selected:

- 7–8px route width
- white halo
- high opacity

Unselected:

- 4–5px
- lower opacity

## Shortest

Green:

`#22C55E`

Same selected/unselected behavior.

## Future Explore Route

Do not fully implement yet unless trivial, but architecture should support:

```ts
mode: "explore"
```

Possible future color:

- deeper blue / cyan variant, not orange

Future scoring may use:

- travel time
- distance
- Explore POIs
- popularity
- scenic value
- community validation
- safety

---

# 4. Simulated traffic visualization

Traffic must be clearly labeled as simulated in this demo.

Do not imply that Explore currently owns live Waze-quality traffic.

Add a compact traffic model to each route:

```ts
{
  level: "light" | "moderate" | "heavy",
  delayMinutes: number,
  congestionPercent: number
}
```

UI:

- Light = green
- Moderate = amber
- Heavy = red

Show:

- ETA
- delay
- congestion %
- small bar/indicator

Example:

```text
14 min
+4 min traffic
62% congestion
```

Add visible copy somewhere:

`Traffic simulated for product demo`

---

# 5. Navigation mode

When user presses Start:

Transition from route overview to navigation mode.

## Navigation mode layout

Top:

- next maneuver card
- turn icon
- street/instruction
- distance to maneuver

Map:

- user/car puck
- route
- follow camera

Bottom:

- ETA
- remaining time
- remaining distance
- End button

## Camera behavior

Make movement feel Waze/Apple Maps-like without copying their UI.

Requirements:

- smooth interpolate location
- bearing follows route
- pitch increases during active navigation
- camera center should place puck slightly below center so road ahead is visible
- avoid calling expensive camera updates every animation frame
- throttle/animate camera updates

Demo animation:

- 10–15 seconds
- smooth easing
- no teleporting between route vertices

At arrival:

- show arrived state
- camera settles
- restore overview option

---

# 6. POI markers

Map should show Explore POIs even before a route is selected.

Marker categories:

- Beach
- Park
- Restaurant
- Attraction

Rules:

- markers should be compact
- avoid large labels at low zoom
- active destination marker should visually dominate
- selected marker should highlight with Explore blue
- tapping marker:
  - selects corresponding card
  - opens small place preview
  - allows route recalculation

At dense zoom levels prepare structure for clustering later.

---

# 7. Explore visual system

## Colors

```css
--explore-blue: #00AEFF;
--explore-blue-dark: #007FCC;
--explore-blue-deep: #006DFF;
--text-primary: #111318;
--text-secondary: #66717F;
--surface: #FFFFFF;
--surface-soft: #F4F7FA;
--route-shortest: #22C55E;
--traffic-light: #22C55E;
--traffic-moderate: #F59E0B;
--traffic-heavy: #EF4444;
```

## Radius

- cards: 16–22px
- bottom sheet: 26–30px top radius
- buttons: 14–18px
- small chips: pill

## Shadows

Use subtle elevation.

Avoid:

- huge dark shadows
- neon glow
- glass everywhere
- excessive gradients

Explore blue gradient is acceptable only for:

- primary CTA
- logo mark
- active hero accents

---

# 8. Interaction details

Add polished feedback:

- active route card transition
- marker selected state
- bottom sheet snap transition
- button press scale: 0.97–0.99
- cards use 180–280ms transitions
- destination change uses smooth map flyTo
- route redraw should feel immediate
- show skeleton/spinner while calculating routes

Prevent:

- double route requests
- navigation animation continuing after route change
- duplicate map layers
- stale destination state
- touch events propagating from markers into map destination selection

---

# 9. State model

Keep state clear.

Recommended structure:

```ts
type RouteMode = "fastest" | "shortest" | "explore";

type NavigationState =
  | "overview"
  | "routing"
  | "ready"
  | "navigating"
  | "arrived";

type TrafficLevel =
  | "light"
  | "moderate"
  | "heavy";
```

Track:

- origin
- destination
- POIs
- available routes
- selected route
- traffic simulation
- active POI
- navigation progress
- sheet state
- engine status

Avoid DOM state being the source of truth.

---

# 10. Routing behavior

Keep current backend contract:

`POST /api/route`

Request:

```json
{
  "start": {
    "lat": 25.7663,
    "lon": -80.1937
  },
  "destination": {
    "lat": 25.765,
    "lon": -80.1341
  }
}
```

Response should continue supporting:

- fastest
- shortest
- coordinates
- distance
- time
- maneuvers

Live routing:

Valhalla.

Fallback:

local demo geometry.

The UI must clearly indicate when fallback is active.

---

# 11. Mobile usability

Minimum touch targets:

44 × 44px.

Ensure:

- no important control is under safe areas
- text remains readable at 360px width
- bottom CTA reachable with thumb
- cards do not require precision taps
- bottom sheet can be dismissed/collapsed naturally
- route selection requires one tap
- marker selection works reliably

---

# 12. Performance

Target smoothness:

- 60fps where possible
- no layout thrashing while moving puck
- do not rebuild every marker each frame
- throttle camera updates
- cache route data during demo session
- do not repeatedly fetch unchanged routes

Avoid loading huge imagery.

Use optimized thumbnails.

---

# 13. Accessibility

Implement:

- aria labels on web buttons
- visible focus states
- sufficient contrast
- reduced-motion support
- semantic button elements
- route colors must not be the only differentiator
- route cards must say Fastest / Shortest in text

---

# 14. Demo-specific behavior

The demo should open in Miami with:

Origin:

Brickell.

Default destination:

South Pointe.

Visible demo POIs:

- South Pointe Park
- Bayfront Park
- Lummus Park
- Carbone Miami
- Pérez Art Museum
- Joe's Stone Crab

All locations should remain clearly labeled as demo content.

Simulated traffic values are allowed.

---

# 15. Quality gates

Before finishing, verify:

## Code

```bash
npm run check
npm start
```

## API

```text
GET / -> 200
POST /api/route -> 200
```

Both route modes must exist.

## Desktop

Test at 1440×900.

## Mobile

Test at:

- 393×852
- 430×932
- 360×800

Verify:

- top rail is scrollable
- bottom sheet fits
- map is interactable
- route cards are readable
- Start CTA is visible
- safe areas work
- no horizontal page overflow
- no overlapping controls

## Navigation

Verify:

- Start begins animation
- puck moves smoothly
- camera follows
- instructions update
- changing route stops previous animation
- selecting a POI recalculates
- Reset restores original state

---

# 16. Definition of done

This task is complete only when:

1. The first visual impression is unmistakably **Explore blue**.
2. The map dominates the mobile screen.
3. Explore places are visible and useful.
4. Place cards feel like Explore discovery content.
5. Fastest and Shortest are visually distinct.
6. ETA, traffic delay and congestion are easy to understand.
7. Traffic is explicitly described as simulated.
8. Navigation movement is smooth.
9. The UI works at 360px wide.
10. No important content is obscured by safe areas.
11. The demo continues working when live Valhalla is unavailable.
12. `npm run check` passes.
13. Browser/mobile viewport verification passes.
14. No changes are made to Explore production code from this demo task.

---

# Production follow-up

After the mobile web demo is approved, port the validated interaction model into Explore mobile using:

- MapLibre React Native
- Ferrostar
- Valhalla
- real device location
- native safe areas
- native gesture/bottom-sheet handling

Do not combine that production migration with this demo task.
