# Ebb

*mood has rhythm. watch yours.*

A private, installable mood-tracking PWA. Track how you feel on a 1–5 scale, see your trajectory, and get time-aware activity suggestions that learn what actually helps you over time.

Ebb is the successor to Momentum — same idea, redesigned from scratch with a quieter identity, a real prediction graph, and an activity engine that won't suggest "ten minutes of morning sunlight" at 11pm.

## Stack

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- ES modules, loaded directly by the browser
- Progressive Web App — installable on iOS/Android, works offline
- Data lives in `localStorage` — nothing ever leaves your device

## Running locally

```bash
# From the project root:
python -m http.server 8765
# Open http://localhost:8765 in your browser
```

Any static file server works. No npm, no node, no build step.

## Deploying

The project ships as static files. Drop the project directory into Netlify (drag-and-drop deploy) or point a Netlify site at a GitHub repo to auto-deploy on push.

## Data model

All data is kept in `localStorage` under the `ebb.v1.*` namespace. See the design spec at `docs/superpowers/specs/2026-04-23-ebb-redesign-design.md` for schema details.

Settings → *Export data* produces a single JSON file of everything. This is the migration path if Ebb ever moves to a real backend.

## Features

- **Daily check-in** — one tap for mood, one optional line of note
- **Trend + Signal graph** — 14 days of past data as faded dots, smoothed trend line through them, 7-day forecast with a confidence band that widens the further out it looks
- **Time-aware activity suggestions** — filtered by your wake/sleep hours and whether it's daylight
- **Preference learning** — activities you complete surface more often; activities you skip surface less
- **30-day calendar** — compact heat strip for pattern recognition
- **Settings** — adjust wake/sleep hours, pick an activity category preference, export your data

## Design spec

Full spec at `docs/superpowers/specs/2026-04-23-ebb-redesign-design.md`.

## Previous version

The baseline Momentum app is preserved at the initial commit of this repo, before the rename and redesign.
