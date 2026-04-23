# Ebb — Design Spec

*Redesign of the Momentum PWA. Approved 2026-04-23.*

## 1. Identity

- **Name:** Ebb
- **Tagline:** *mood has rhythm. watch yours.*
- **Scope (v1):** Personal + close friends. Each user installs and logs independently. No accounts, no sync, no social layer. Architecture leaves a clean migration path to a future backend-backed public launch.
- **Visual direction:** Still Water. Soft blue-grays on off-white. Georgia serif for display, system sans for body. Atmospheric, quiet, honest.

## 2. Feature set

| Feature | Status | Rationale |
|---|---|---|
| Mood check-in (1–5 + optional note) | Keep | Core. |
| Time-aware activity suggestion | **Overhaul** | Current suggestions are generic and time-inappropriate. |
| Trajectory graph | **Overhaul → Trend + Signal** | Current is line-with-dots; new is faded raw dots + smoothed trend + forecast with confidence band. |
| 30-day calendar heat strip | Keep, demoted | Good for monthly pattern recognition, but secondary to the graph. |
| One inline consistency stat | Keep (simplified) | Three-card stats row cut to one line. |
| Wins log | **Cut** | Separate feature from mood tracking. Don't ship two half-features. |
| Milestones / badges | **Cut** | Gamification conflicts with Ebb's honesty principle. Rewards engagement, not truth. |
| First-run preference ask | Keep | One chip row after first check-in. Skippable. |
| Settings (wake/sleep, category) | **New** | Makes time-awareness actually work; exposes category filter. |

## 3. Architecture

- Vanilla HTML/CSS/JS, ES modules, **no build step.**
- PWA: manifest + service worker, installable, offline-capable.
- Deploy: existing Netlify/GitHub setup, unchanged.

### File layout
```
/
├── index.html              — lean shell, mount point
├── manifest.json           — rebranded Ebb
├── sw.js                   — cache bump
├── icons/                  — new palette (192, 512)
├── docs/superpowers/specs/ — this spec
├── css/
│   ├── tokens.css          — design tokens as CSS variables
│   ├── base.css            — reset, typography, layout
│   └── components.css      — buttons, scale, card, graph, modal
└── js/
    ├── app.js              — entry, wires modules, mounts on DOMContentLoaded
    ├── store.js            — localStorage wrapper, schema-versioned keys, migration
    ├── util.js             — date helpers, DOM helpers, toast
    ├── mood.js             — check-in UI + submit + logged state
    ├── activities.js       — engine: filter, score, pick, reroll, complete
    ├── activities-library.js — content (~60 tagged activities)
    ├── graph.js            — Trend + Signal canvas renderer
    ├── calendar.js         — 30-day compact heat strip
    └── settings.js         — cog modal
```

## 4. Data model

All keys namespaced `ebb.v1.*`. A future sync backend can read and migrate the whole namespace cleanly.

```js
ebb.v1.schema_version    // 1
ebb.v1.entries           // [{ date: ISO, mood: 1..5, note: string }]
ebb.v1.activity_log      // [{ id, date, completed, helped? }]
ebb.v1.activity_scores   // { [activity_id]: number }  default 1.0, bounded [0.3, 2.0]
ebb.v1.prefs             // { category, wake_hour: 7, sleep_hour: 23 }
ebb.v1.daily             // { [date]: { shown: string[], completed: number, rerolls: number } }
```

## 5. Graph — Trend + Signal

- 14-day window visible.
- Raw mood dots at muted color, 40% opacity — the noise.
- EMA-smoothed trend line (α = 0.3) — the signal.
- Forecast: 7 days, weighted linear regression on smoothed series (linear weights favor recent points).
- Confidence band: thin, ±0.3 at day +1 widening linearly to ±0.7 at day +7. Same ink, 8% fill.
- Zones (thriving 3.5+, watch 2.5–3.5, struggling <2.5): subtle background fills @ 15% opacity.
- **No benefit-nudge.** Forecast reflects mood data only. Completing activities does not tilt the projection — only future mood entries do.

## 6. Activity system

### Tagged activity shape
```js
{
  id: 'walk_5min',
  text: 'Walk to the end of your street',
  instructions: '...',
  why: '...',
  category: 'physical' | 'creative' | 'social' | 'spiritual',
  mood_range: [1, 2, 3],                              // applicable moods
  time_of_day: ['morning','afternoon','evening'],     // when it makes sense
  requires_daylight: true,                            // filtered out after sunset
  benefit: 1 | 2 | 3,                                 // relative impact tier
}
```

### Time-of-day buckets (driven by user's wake/sleep settings)

| Bucket | Window |
|---|---|
| `morning` | wake → wake + 4h |
| `afternoon` | wake + 4h → wake + 8h |
| `evening` | wake + 8h → sleep − 1h |
| `late_night` | sleep − 1h → wake |

`requires_daylight` additionally filters out activities past ~8pm (approximated locally, no geolocation — keeps data private).

### Pick algorithm

1. Filter pool by `mood_range ∋ current_mood` AND `time_of_day ∋ current_bucket` AND (`!requires_daylight` OR current hour is daylight).
2. Apply user's category preference; fall back to all categories if the pool empties.
3. Exclude items already shown this session.
4. Sort by `score × random(0.85, 1.15)` — preference-weighted with jitter to avoid ruts.
5. Return top item.

### Preference learning rules

Score defaults to 1.0. Bounded [0.3, 2.0].

| Event | Multiplier |
|---|---|
| Completed + "this helped" | × 1.20 |
| Completed (no feedback) | × 1.05 |
| Rerolled past (seen, skipped) | × 0.92 |
| Shown 3× in 7 days, never selected | × 0.70 (applied once) |

### Content rewrite

All ~60 activities are rewritten. Guidelines:
- No clinical or research name-drops ("BDNF", "affect labeling", "diving reflex", "parasympathetic nervous system"). The mechanism doesn't belong in the UI.
- Direct, concrete, short. "Step outside. 60 seconds. Just air." beats "Natural light and movement break cortisol patterns."
- No "research-backed" framing. Ebb doesn't sell.
- Activities balanced across categories and mood levels so the engine has real choices at every tag combination.

### Caps (preserved from baseline)

- 2 rerolls / day
- 3 activity completions / day

## 7. Check-in UX

- Large 1–5 scale, serif numerals, subdued selection feedback.
- Single-line optional note (`<input>`, not `<textarea>` — forces brevity).
- Primary button: "Log today."
- After submit, the check-in region collapses into a quiet logged state with the day's suggested activity card beneath it.
- Reopening after submit shows logged state. "Change today's entry" secondary action reopens the picker.

## 8. First-run flow

- Initial view: app name + today's date + "Log today's mood to begin."
- After first check-in submits: one chip row — *What tends to help you? (skip if unsure)* → `physical · creative · social · spiritual · show me anything`. Sets `prefs.category`.
- No multi-step onboarding. No tutorial overlay.

## 9. Settings

Accessed via a small cog in the top-right.
- **Wake time** (default 7am)
- **Sleep time** (default 11pm)
- **Activity category** (physical / creative / social / spiritual / show me anything)
- **Export data** → JSON download of all `ebb.v1.*` keys. Future-proofs migration to a backend.
- **Dark mode** → rendered but disabled with "coming later" label. Tokens are already prepared.

## 10. Out of scope (v1)

- Accounts, auth, cloud sync
- Social / shared streaks / friend-visible data
- Active Dusk dark mode (tokens prepared)
- Push notifications
- Analytics
- Automated test suite

## 11. Testing plan (manual)

- **Golden path:** fresh localStorage → greeting → log mood 3 with note → activity suggestion appears → reroll → commit → complete → reload → logged state persists.
- **Time gate:** stub `Date` or set sleep_hour early → confirm no daylight-required activities suggested.
- **Preference learning:** complete same activity 3× → confirm score reaches ~1.16 and resurfaces more often. Reroll-past same activity 3× → confirm score ~0.78.
- **Migration:** seed `localStorage.momentum_v3` with baseline-format entries → reload → confirm `ebb.v1.entries` populated.
- **PWA:** install on iPhone Safari and Android Chrome → offline check-in works.
- **Mobile sanity:** 375px viewport → no horizontal scroll, scale tappable.
- **Schema version:** `ebb.v1.schema_version === 1` after first load.

## 12. Migration (Momentum → Ebb)

One-time on first load:
- If `ebb.v1.schema_version` is unset AND `momentum_v3` exists → copy entries into `ebb.v1.entries` preserving date/mood/note.
- If `momentum_pref` exists → `ebb.v1.prefs.category`.
- Milestones and wins: **not migrated.** The keys remain in localStorage until the user clears them.
- Set `ebb.v1.schema_version = 1`.
