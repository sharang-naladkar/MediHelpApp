# MediDrone

Minimal, real, installable PWA for out-of-hospital cardiac arrest SOS triggering.
No mock data, no demo mode, no fake GPS. Stateless client — the only local state
is the one-time user profile (localStorage); everything else goes over REST to the
external MediDrone backend.

## Run

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL to the real backend
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm start                    # service worker + manifest are active in prod
```

## Env

- `NEXT_PUBLIC_API_BASE_URL` — public backend base URL, inlined at build time.
  Never hardcoded in source. If it is unset, the app shows a visible
  "backend not configured" state instead of silently hanging.

## Backend contract (REST)

- `POST {base}/api/v1/emergencies`
  body: `{ "lat": number, "lng": number, "accuracy": number,
          "timestamp": ISO8601, "name": string, "phone": string,
          "aadhaar_last4": string }`
  → `200 { "emergency_id": string }`
- `GET {base}/api/v1/emergencies/{emergency_id}` → status object whose `status`
  is one of `RECEIVED, DRONE_ASSIGNED, MISSION_GENERATED, DISPATCHED, EN_ROUTE,
  APPROACHING, ARRIVED, AED_DELIVERED, COMPLETED, FAILED`.

Polled every 5 s until a terminal state (`COMPLETED` / `FAILED`). Poll failures
are shown and back off (5 s → 30 s cap); the API origin is never cached by the
service worker.

## Screens

1. **Setup** (first launch only) — full name, phone, Aadhaar last 4 digits
   (labelled "for identification only"). Saved client-side only; future launches
   go straight Home.
2. **Home / SOS** — one tap → real `getCurrentPosition`
   (`enableHighAccuracy`, `maximumAge: 0`) → POST → status screen.
   No confirmation dialogs. Geolocation denial/timeout shows Retry + a
   "Call emergency services (112)" fallback; network errors retry with backoff.

## PWA

`public/manifest.webmanifest` + `public/sw.js` (hand-rolled, versioned shell
cache). The worker intercepts same-origin static assets/navigations only —
cross-origin API traffic is never touched.

## Notes

- Required functional fix/coverage icons regenerate via `npm run icons`.
