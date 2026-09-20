# Sakhi Dispatch — police/helpline dashboard

Vite + React + Tailwind. Connects to the Sakhi WebSocket API and shows
`ACTIVE_EMERGENCY_DISPATCH` payloads the instant an incident hits the
severe stage — nothing renders here for the mild stage.

## Setup

```
npm install
cp .env.example .env
```

Edit `.env` and set `VITE_WS_URL` to the `WebSocketUrl` output from the
backend's `sam deploy` (starts with `wss://`, not `https://`).

```
npm run dev
```

## What it does

- **Incident rail** (left): every dispatch received this session, newest
  first. A pulsing red dot means unacknowledged; it turns to a solid
  green dot once acknowledged.
- **Siren**: synthesized in-browser via the Web Audio API (no audio
  file to ship or license) and plays continuously while at least one
  incident is unacknowledged. Stops the instant the last one is
  acknowledged.
- **Map + dossier** (right): selecting an incident shows its location
  on an OpenStreetMap embed (no API key needed) and the victim's name,
  age, phone, address, and photo alongside an "Acknowledge" control.

State is in-memory only — refreshing the page clears the incident
list. That's fine for a hackathon demo; if you need dispatches to
survive a refresh, have the dashboard call `GET /incidents/{id}/status`
for any incidents already at `SEVERE_ACTIVE` on load instead of relying
solely on the WebSocket feed.

## Deploying (Amplify)

```
npm run build
```

Push this folder to a Git repo and connect it in Amplify Hosting, or
drag-and-drop the `dist/` folder for a manual deploy. Either way, set
`VITE_WS_URL` as an environment variable in the Amplify app settings —
it's read at build time, not runtime.
