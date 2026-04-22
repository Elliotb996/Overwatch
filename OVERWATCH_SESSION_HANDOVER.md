# OVERWATCH — Session Handover Document
**For:** New Claude instance  
**Date:** 21 April 2026  
**Purpose:** Full context transfer — read this before touching any code

---

## What OVERWATCH Is

A paid military OSINT intelligence platform targeting the OSINT community and Polymarket traders. Tracks AMC airlift activity, carrier strike groups, LMSR sealift ships, CORONET fighter deployments, and airbase activity across CENTCOM/EUCOM AORs. Monetised via tiered subscriptions.

**Live URL:** https://overwatch-vert.vercel.app  
**GitHub:** Elliotb996/Overwatch (public)  
**Supabase:** yaxydgdrlviyzlyybaiz (Stockholm, North EU)  
**Stack:** React/Vite frontend → Vercel, Supabase (PostgreSQL + Storage + Realtime)

**Deploy workflow:**
```bash
cd ~/Desktop/Overwatch
git add -A && git commit -m "message"
git pull --rebase && git push
```
GitHub MCP can read files but **cannot push** (403). All pushes go via terminal.

---

## People

- **Elliot** (elliot-butler@hotmail.co.uk) — platform owner, `owner` tier
- **TannerTanner** — collaborator, runs ACARS decode Discord bot

---

## Tier Hierarchy

```
owner (4) > admin (3) > premium (2) > analyst (1) > free (0)
```

Defined in `src/lib/supabase.js` as `TIER_ORDER`.  
Tier is read **from `user_profiles` table** (not JWT cache) — `src/hooks/useAuth.js`.  
`TierGate` components must include `owner:4` in their local TO object or they will gate the owner out.  

**Critical bug history:** `TierGate` in `AirbaseView.jsx` was missing `owner` from its hardcoded tier order, causing owner to be treated as free. Always check `TierGate` when adding new gated views.

---

## Current File State (as of session end)

| File | Location | Status |
|------|----------|--------|
| `MapView.jsx` | `src/views/` | Working — aircraft section redesigned |
| `AirbaseView.jsx` | `src/views/` | Working — TierGate fixed |
| `SealiftView.jsx` | `src/views/` | Working — coming soon gate for non-admin |
| `ConusView.jsx` | `src/views/` | Working — coming soon gate for non-admin |
| `Header.jsx` | `src/components/` | Working — owner/admin/tier badges |
| `LoginPage.jsx` | `src/components/` | Working — replaces AuthGate |
| `useAuth.js` | `src/hooks/` | Working — reads tier from DB not JWT |
| `supabase.js` | `src/lib/` | Working — TIER_ORDER includes owner:4 |
| `AdminLayout.jsx` | `src/admin/` | Working — includes ACCOUNTS nav |
| `UserManager.jsx` | `src/admin/` | Working — upsert tier save |
| `staticAssets.js` | `src/lib/` | Created — shared carrier/LMSR data |

**AuthGate has been removed.** The old `src/components/AuthGate.jsx` is dead code. Login is handled entirely by Supabase auth via `LoginPage.jsx`.

---

## Database — Key Tables

```
amc_flights          — flight records (main dataset)
assets               — carriers, airbases, LMSR, destroyers, submarines
user_profiles        — account tiers (authoritative, not JWT)
imagery_meta         — satellite imagery metadata + Supabase Storage paths
country_intel        — country escalation levels for GeoJSON overlay
sigact_feed          — live SIGACT events feed
csg_ships            — carrier strike group escort ships
ship_sightings       — AIS/OSINT ship position sightings
mc_char1/2/3_ref     — mission code character reference tables
mc_unit_codes        — 62 unit code entries
callsign_reference   — callsign lookup
aircraft_type_ref    — aircraft type reference
airport_reference    — ~100 airports
```

**RLS pattern:** All tables use open `FOR ALL USING (true)` policies. Restrictive RLS consistently breaks admin writes — do not add restrictive policies.

**Supabase MCP discipline:**
- `apply_migration` for DDL (CREATE TABLE, triggers, types, ALTER)
- `execute_sql` for DML (INSERT, UPDATE, SELECT)

---

## Map Configuration — CRITICAL

**Tile URL (do not change):**
```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```
CSS filter: `brightness(0.8) saturate(0.55)` — no hue-rotate  
**Aggressive filters cause completely black map.** This has regressed multiple times.

**GeoJSON country overlay — Option C (currently active):**
- Countries invisible by default
- Hover triggers escalation-coloured border glow (fill 8% opacity, border weight 2, opacity 0.9)
- Mouseout clears entirely
- Click navigates to `/country/{code}`

---

## Known Architectural Problem — NEEDS FIXING NEXT SESSION

### Aircraft Data Structure is Broken

**The problem:** The `qty` field in `aircraftTypes` arrays is free-text intelligence notes — "41+ staged (11x Silent Knight)", "19+ tracked arrivals", "assessed". This is OSINT narrative masquerading as structured data. No UI design can make this look clean because the data itself is unstructured.

**The correct architecture:**

```
SIDE PANEL (asset detail popout) should show:
  - Aircraft type
  - Unit/wing assignment
  NOT: quantities, status notes, tail numbers

EXPANDED MODAL (▼ EXPAND DETAIL) should show:
  - Type + quantity (structured integer field, not free text)
  - Unit assignment
  - Operational status tag (DEPLOYED / SURGE / TRANSITING etc)

FULL AIRBASE PAGE (/airbase/EGVA) should show:
  - Full aircraft inventory with tail numbers
  - Flight log (arrivals/departures)
  - Satellite imagery
  - Intel assessment
```

**Logistics vs stationed aircraft must be separated:**
- C-17s, C-5s, KC-135s transiting a base = **logistics flight log entries** → go in ARRIVALS tab, NOT in "Aircraft on Station"
- F-22s, B-52s, MC-130Js resident at a base = **stationed aircraft** → go in Aircraft on Station
- This distinction must be enforced at data entry level, not display level

**The `aircraftTypes` array needs restructuring:**
```javascript
// Current (broken):
{ type: 'MC-130J Commando II', qty: '41+ staged (11x Silent Knight)', role: 'SOCOM Assault/Infiltration', tails: [...] }

// Target (correct):
{ type: 'MC-130J Commando II', unit: '352nd SOG / 1st SOW', count: 41, variant: 'Silent Knight', role: 'SOCOM Assault/Infiltration', tails: [...] }
```

**Design standard for aircraft rows (uniform across ALL views):**
```
AIRCRAFT ON STATION        UNIT
MC-130J Commando II        352nd SOG / AFSOC
AC-130J Ghostrider         1st SOW / AFSOC
B-52H Stratofortress       5 BW / 2 BW
```
- Single font (Rajdhani)
- Single colour (C.tb white for type, C.t2 grey for unit)
- No quantities in side panel
- No emojis anywhere
- Quantities only in expanded/full views
- Uniform across every single base — driven by structured data

---

## Design Standards

**Fonts:**
- `'Share Tech Mono', monospace` → all labels, codes, numbers, data values (var Z)
- `'Rajdhani', sans-serif` → names, headings, button text (var R)

**Colour palette:**
```javascript
C = {
  g:'#39e0a0',   // green — active/deployed/owner
  a:'#f0a040',   // amber — elevated/admin  
  r:'#e85040',   // red — surge/critical
  b:'#50a0e8',   // blue — AMC/data values
  p:'#a060e8',   // purple — SOCOM
  y:'#e8d040',   // yellow — army/quantities
  t1:'#b8ccd8',  // light text
  t2:'#4a6070',  // dim text
  t3:'#28404c',  // very dim text
  tb:'#dceaf0',  // bright text (names)
  bg:'#07090b',  // background
  br:'#1e2c3a',  // border
}
```

**No emojis in any UI element.** Not in buttons, not in headers, not in aircraft sections.  
Use coloured dots, letter codes, or nothing at all instead.

---

## Current Operational Scenario Context (Op Epic Fury)

An active US-led military campaign in CENTCOM AOR. Key intelligence picture:
- **RAF Fairford (EGVA):** 8x B-52H + 18x+ B-1B — largest US forward bomber deployment since Gulf War
- **RAF Mildenhall (EGUN):** 41+ MC-130J staged (11x Silent Knight mod), 3x AC-130 gunship
- **CVN-78 Gerald R. Ford:** Adriatic, EUCOM/CENTCOM direction, CSG-12
- **CVN-72 Abraham Lincoln:** 5th Fleet/Arabian Sea, Houthi suppression
- **CVN-77 George H.W. Bush:** Atlantic transit, EUCOM-bound
- **LMSR Pililaau:** Diego Garcia departure imminent
- **OJKA Jordan:** 30+ C-17 arrivals, highest single-destination volume
- **LLOV Ovda AB:** 26 confirmed arrivals, all SOCOM flagged

---

## What Was Done This Session

1. **Imagery upload system** — Supabase Storage bucket `imagery`, `imagery_meta` table, upload form with write-up/tier/source, edit/delete panel
2. **Ship reposition** — drag-on-map with amber confirm bar, admin only
3. **Coming soon gates** — CONUS and Sealift locked to non-admin with feature preview
4. **Auth overhaul** — AuthGate removed, single LoginPage, tier read from DB not JWT
5. **Account manager** — `/admin/users` with tier buttons, notes, search/filter
6. **Owner tier** — `owner(4)` added above admin, ◈ OWNER badge in green in header
7. **TierGate fix** — owner:4 added to TierGate's local TO object in AirbaseView
8. **SIGACT feed** — collapsed by default
9. **Country overlay** — Option C (invisible until hover, escalation border glow)
10. **Aircraft section** — multiple redesign attempts; still not right (see architectural problem above)

---

## What Needs Doing Next (Priority Order)

1. **Fix aircraft data structure** — separate logistics from stationed aircraft, add unit field, structured count field
2. **Uniform aircraft display** — type + unit only in side panel, same format every base, no free-text qty
3. **AirbaseView aircraft tab** — same treatment as side panel, consistent
4. **CONUS bases** — expandable modals matching AOR base behaviour (currently just a coming soon page for non-admin)
5. **Sealift page data sync** — carriers have no aircraft/squadron data on sealift page yet (partially done via staticAssets.js but needs wiring)
6. **Hierarchical navigation** — World → Country → Airbase → Aircraft category → Individual airframe
7. **ACARS ingest pipeline** — wire Discord bot's decode logic into the pipeline
8. **ADS-B/ACARS live feeds** — automated data ingestion
9. **Social media scraping** — X/Twitter monitoring, WarshipCam for ship positions

---

## Standing Instructions for Claude

You are an analytical partner, not a classifier. Elliot is domain-expert level in AMC mission codes, ACARS, AIS, sealift/airlift logistics. Do not explain basics.

Before writing any code:
1. Pull the current file from GitHub first — never edit blind
2. Check what's actually broken before touching anything
3. Think about data structure before thinking about CSS
4. Test all logic paths including owner/admin/premium/analyst/free tiers

**Analytical standards (ICD 203):** Separate facts from assumptions from inferences. Flag confidence levels. Raise alternative hypotheses before committing to a lead assessment.
