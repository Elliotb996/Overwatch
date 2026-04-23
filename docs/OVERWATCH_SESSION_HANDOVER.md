# OVERWATCH — Session Handover Document
_Last updated: Session 6 — 22 Apr 2026_

---

## What Is OVERWATCH

Paid military OSINT intelligence platform. Palantir-style dark UI. Targeting the OSINT community and Polymarket traders who want fast, aggregated military intelligence. Tracks AMC airlift activity, carrier strike groups, LMSR sealift, CORONET fighter deployments, and airbase activity across CENTCOM/EUCOM AORs.

**Live URL:** https://overwatch-vert.vercel.app  
**GitHub:** Elliotb996/Overwatch (public repo)  
**Supabase:** yaxydgdrlviyzlyybaiz (Stockholm, North EU)  
**Deploy cmd:** `cd ~/Desktop/Overwatch && git add -A && git commit -m "msg" && git pull --rebase && git push`

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, react-router-dom |
| Map | react-leaflet v4, Leaflet.js |
| Backend | Supabase (PostgreSQL + Realtime) |
| Hosting | Vercel (GitHub integration, auto-deploy on push) |
| Fonts | Rajdhani (labels/headers), Share Tech Mono (data/values) |

---

## Design Standards — STRICTLY ENFORCED

- **Rajdhani**: all labels, headings, names, status text, buttons
- **Share Tech Mono**: all data values, codes, numbers, IDs, ICAO codes
- **Zero emojis** anywhere in the operational UI
- **No pulse animations** on map markers
- **Colour palette** (never deviate):

```js
const C = {
  g:'#39e0a0',  // green  — active/nominal
  a:'#f0a040',  // amber  — elevated/warning
  r:'#e85040',  // red    — surge/critical
  b:'#50a0e8',  // blue   — naval/info
  p:'#a060e8',  // purple — SOCOM (secondary metric only)
  y:'#e8d040',  // yellow — LMSR sealift
  t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28',
  br:'#1e2c3a', br2:'#273a4c',
}
```

- **Map tile:** `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` — filter `brightness(0.8) saturate(0.55)` ONLY. No hue-rotate. Aggressive filters = black map (do not change).
- **TierGate** must always include `owner:4` in its local TO object or owner is locked out.

---

## File Structure (key files)

```
src/
  views/
    MapView.jsx          ← Main map, all markers, cluster layer
    AirbaseView.jsx      ← /airbase/:icao full page
    CountryView.jsx      ← /country/:code intel page
  components/
    AirbaseMarker.jsx    ← React SVG marker (for sidebar/list use)
  admin/
    OsintIngest.jsx      ← Admin OSINT paste + AI parse UI
    AdminLayout.jsx      ← Admin nav
  hooks/
    useFlights.js        ← AMC flights from Supabase
    useAssets.js         ← DB assets
    useAuth.js           ← Reads tier from user_profiles (not JWT)
  lib/
    supabase.js          ← Supabase client + TIER_ORDER
```

---

## Database Schema (Supabase: yaxydgdrlviyzlyybaiz)

### Core tables

| Table | Purpose |
|-------|---------|
| `amc_flights` | Flight log: callsign, hex, mission_code, base, destination, dep_date, mc_flag |
| `assets` | DB-tracked assets (enriches STATIC_ASSETS in MapView) |
| `stationed_aircraft` | Approved stationed aircraft (tails only, no callsigns) |
| `acars_staging` | Raw ACARS/ADS-B ingest staging table |
| `osint_ingest` | Admin OSINT paste queue with AI parse + approval workflow |
| `country_intel` | Country escalation levels, summaries, strike site flags |
| `strike_sites` | Strike site records with lat/lng, status, imagery |
| `sigact_feed` | Real-time SIGACT feed events |
| `imagery_meta` | Uploaded satellite/OSINT imagery metadata |
| `user_profiles` | User tier (free/analyst/premium/admin/owner) |

### Reference tables
- `mc_char1/2/3_ref` — Mission code character position lookups
- `mc_unit_codes` (62 entries) — AMC unit codes
- `callsign_reference`, `aircraft_type_ref`, `airport_reference` (~100 entries)

### RLS Policy
All tables require open `FOR ALL USING (true)` policies. Restrictive RLS consistently breaks admin writes. Do not add restrictive policies.

### Classification trigger
`classify_mc_flag` auto-tags SOCOM and Army-Z records in `amc_flights`.

---

## Tier System

```
free: 0 | analyst: 1 | premium: 2 | admin: 3 | owner: 4
```

TierGate example (MUST include owner:4):
```jsx
function TierGate({required, current, children}) {
  const TO = {free:0, analyst:1, premium:2, admin:3, owner:4}
  if ((TO[current]||0) >= (TO[required]||0)) return children
  return <div>ACCESS RESTRICTED — {required.toUpperCase()} TIER REQUIRED</div>
}
```

Admin account: elliot-butler@hotmail.co.uk (admin tier in DB)

---

## Data Architecture

### Aircraft data
- `normalizeAircraft(raw)` in MapView — single normalizer for all aircraft data sources
- **Logistics transits** (C-17/C-5/KC-135 passing through) are NEVER in `aircraftTypes[]` — they belong in flight logs only
- `aircraftTypes[]` contains only **stationed** aircraft
- **Tail numbers** only in tails arrays — callsigns belong in `amc_flights` table only
- Exception: HEEL 51/53/55 retained (AC-130s have no public tail, callsign is only identifier)

### Asset merge pattern
`STATIC_ASSETS` is the source of truth. DB data enriches static entries (arr_count, intel, status). DB-only entries are appended as `dbExtras`.

### SOCOM data point
SOCOM is a valid intel signal but NOT a headline metric. It is:
- In the 6th stat box of AirbaseView overview (secondary position)
- Removed from MapView header bar
- Removed from AirbaseView header stats
- Still shown in flight table type column and detail panels

---

## Map Markers

### Airbase markers (`mkAirbaseIcon`)
SVG corner-tick square (identical to `AirbaseMarker.jsx` design):
- Status → colour: SURGE=red, ELEVATED=amber, ACTIVE=green, MODERATE=blue, else=grey
- Badge = 7-day arrival count (not SOCOM count)
- `className:''` critical — removes Leaflet white background
- `iconSize:[20,20]`, `iconAnchor:[10,10]`
- `zIndexOffset={1000}` — airbases render above naval markers

### Cluster layer (`AirbaseClusterLayer`)
- Below zoom 6: bases within 36px cluster into single marker with count badge
- `CLUSTER_MODE = 'fanout'` — click fans individual markers in 160° arc upward
- `CLUSTER_MODE = 'zoom'` — click auto-zooms to fit cluster bounds (Option A fallback)
- Expanding cluster: click individual base selects it, fan collapses
- Zoom/pan/map-click all collapse any open fan

### Naval markers (`mkTrackBlock`)
- Single-line rectangle: hull designation in Share Tech Mono (e.g. "CVN-78", "DDG-51")
- `iconSize:[44,14]` — thin horizontal bar
- Tooltip on hover shows full ship name (Rajdhani)
- NO popup on click (naval assets open in right panel only)
- Colours: carriers=blue (red if SURGE), destroyers=blue, subs=purple, LMSR=yellow

### Airbase popup card (click)
Matches this exact design:
```
┌──────────────────────────────────────────┐
│ LIPA  ITALY                   [NOMINAL]  │
│ Aviano AB                                │
│ ARR  0    DEP  12    7D  94             │
│──────────────────────────────────────────│
│ → AIRBASE VIEW        ▼ EXPAND          │
└──────────────────────────────────────────┘
```
CSS class `ow-ab-popup` strips Leaflet's default white card.

### Map interaction rules
- `boxZoom={false}` prop + `DisableBoxZoom` component + `.leaflet-zoom-box{display:none!important}` CSS — three-layer approach to ensure BoxZoom never shows
- `PopupAutoClose` component closes popup on zoom or drag
- Marker click uses `L.DomEvent.stopPropagation` — prevents map click handler from clearing selection
- Country hover: `fillColor:'#ffffff', fillOpacity:0.08` — subtle white lightening only, no colour fill

---

## AirbaseView Page

**Tabs:** OVERVIEW | ARRIVALS | DEPARTURES | AIRCRAFT | AIRFIELD MAP | IMAGERY | INTEL

**Header stats:** INBOUND | OUTBOUND | TOTAL OPS (SOCOM removed from headline)

**Overview stats grid (6 boxes):**
1. INBOUND
2. OUTBOUND
3. LAST 7D
4. TOTAL OPS
5. AC TYPES
6. SOCOM (secondary)

**Overview mini-map:** ESRI satellite tiles, zoom 13  
**AirfieldMap tab:** ESRI satellite default, zoom 15, SAT/STREET toggle, external links to Google Sat / Zoom.Earth / OSM

**Aircraft tab:**
- All categories expanded by default (Set-based, multi-expand)
- Tails expandable per type row (also Set-based, multiple open simultaneously)
- Each tail = JetPhotos link: `https://www.jetphotos.com/registration/{tail}`
- Empty tails array → shows "N/A"

---

## OSINT Ingest Pipeline

**Admin UI:** `/admin/ingest` — `OsintIngest.jsx`

Flow:
1. Admin pastes raw text (X post, Telegram, spotter log, ACARS decode)
2. AI Parse (Claude Sonnet via Anthropic API) extracts structured JSON
3. Shows confidence score + schema preview
4. Admin approves → pushes to target table (`amc_flights`, `stationed_aircraft`, or `sigact_feed`)
5. Admin rejects → record marked rejected

**Staging table:** `acars_staging` — raw ACARS/ADS-B JSON from scraper feed  
**Parse queue:** `osint_ingest` — all admin paste entries with status tracking

---

## Operational Context (Op EPIC FURY)

Current scenario in the static data:
- Multi-carrier posture: CVN-78 (Adriatic), CVN-72 (Arabian Sea), CVN-77 (Atlantic transit)
- EGVA (RAF Fairford): 8x B-52H + 18+ B-1B — largest US forward bomber deployment since Gulf War
- EGUN (RAF Mildenhall): 41+ MC-130J, SOCOM hub, AFSOC
- LLOV (Ovda, Israel): 26 SOCOM C-17 arrivals, strategic pre-positioning
- OJKA (Jordan): highest single-destination volume, 30+ arrivals
- 5x LMSR ships tracked: T-AK-304, T-AK-3011, T-AK-3005, T-AK-3012, T-AKR-9

---

## Known Issues / Next Steps

### High priority
- [ ] **Airbase clustering density** — need to add all actual AOR airbases (LTAG, LCPH, OJKF, OKKK, OMDM, OMAM etc)
- [ ] **ACARS ingest pipeline** — wire tbg.airframes.io/mcsearch scraper feed → `acars_staging` → `amc_flights`
- [ ] **CONUS base modal** — expand modal for CONUS departure bases (matching AOR base behaviour)
- [ ] **Real 7-day count** — currently `arrCnt` static field used as proxy; needs live DB query `WHERE dep_date >= NOW() - INTERVAL '7 days'`

### Medium priority
- [ ] **Day toggle on badge** — 1/3/7/14 day toggle for airbase arrival badge count
- [ ] **WarshipCam integration** — scrape ship positions for live naval track updates
- [ ] **ATC transcript monitoring** — auto-ingest approach
- [ ] **X/social scraping** — semi-automated feed for OSINT ingest queue

### UI/UX backlog
- [ ] **Hierarchical navigation** — World → Country → Airbase → Aircraft type → Individual airframe
- [ ] **CORONET routing arcs** — draw North Atlantic Track arc lines on map for active CORONETs
- [ ] **Airbase popup cluster** — fan-out works, but consider adding transition animation CSS
- [ ] **UK/FR/CN/other-nation airbases** — expand beyond US assets; SOCOM metric irrelevant for non-US

### Architecture
- [ ] **`stationed_aircraft` table** — fully migrate from STATIC_ASSETS static JS arrays to DB
- [ ] **Mission code decode bot** — wire Discord ACARS decode bot logic into `acars_staging` ingest pipeline
- [ ] **ADS-B feed integration** — live position updates for naval track blocks

---

## Critical Architectural Rules (Never Violate)

1. **Mission code character positions are absolute** — 4th char "A" = Army-funded; 2nd char "J" = positioning leg
2. **Never hardcode unit names** — use mission code patterns (Y1/Y2 = SOCOM, PMZ/PVZ = Marine)
3. **CORONET routing** — UK-bound arcs through 41–53°N (North Atlantic Tracks), NOT Azores latitude
4. **Supabase DDL** → use `apply_migration`; **DML** → use `execute_sql`
5. **Map tile never change** — any filter change risks black map; only `brightness(0.8) saturate(0.55)` on dark tiles
6. **Tails array** = registration numbers ONLY; callsigns belong in `amc_flights`
7. **TierGate always needs owner:4** — missing it locks out the owner account
