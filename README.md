# OVERWATCH — OSINT Tactical Platform

## Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React 18 + Vite | Free |
| Map | Leaflet + React-Leaflet | Free |
| Database | Supabase (PostgreSQL) | Free tier |
| Auth | Supabase Auth | Free tier |
| File storage | Supabase Storage | Free tier (1GB) |
| Hosting | Vercel | Free tier |
| ACARS ingest | FastAPI (Python) | ~€5/mo (Hetzner) |

---

## Project Structure

```
overwatch/
├── src/
│   ├── App.jsx                    # Root layout, router
│   ├── main.jsx                   # Entry point
│   ├── lib/
│   │   ├── supabase.js            # Supabase client
│   │   └── constants.js           # Tier definitions, category colours
│   ├── hooks/
│   │   ├── useFlights.js          # AMC flight data hook
│   │   ├── useAssets.js           # Naval/airbase assets hook
│   │   ├── useAuth.js             # Auth + tier management
│   │   └── useCoronets.js         # CORONET data hook
│   ├── components/
│   │   ├── Header.jsx             # Top bar, clock, tier badge
│   │   ├── TacticalMap.jsx        # Leaflet map, marker rendering
│   │   ├── CornetPanel.jsx        # Left panel CORONET list
│   │   ├── LayerToggles.jsx       # Layer controls
│   │   ├── AssetList.jsx          # Right-side asset registry
│   │   ├── DetailPanel.jsx        # Asset detail view
│   │   ├── AirbaseModal.jsx       # Base slide-up modal (flights/imagery/intel)
│   │   ├── ShipDetail.jsx         # CSG expansion + sightings
│   │   ├── IcaoPopup.jsx          # Clickable ICAO code popup
│   │   ├── SignactFeed.jsx        # Bottom-right live feed
│   │   └── TierGate.jsx           # Content gating wrapper
│   ├── views/
│   │   ├── MapView.jsx            # Main tactical map view
│   │   ├── ConusView.jsx          # CONUS departure bases view
│   │   └── SealiftView.jsx        # LMSR ship tracker view
│   └── admin/
│       ├── AdminLayout.jsx        # Admin panel wrapper
│       ├── FlightEditor.jsx       # Add/edit AMC flights (table UI)
│       ├── AssetEditor.jsx        # Add/edit bases, ships, events
│       ├── CoronetEditor.jsx      # Add/edit CORONET missions
│       ├── ImageryUpload.jsx      # Upload sat imagery to Supabase Storage
│       └── UnitManager.jsx        # Manage unit→base assignments (replaces hardcoding)
├── database/
│   ├── schema.sql                 # Full Supabase schema
│   ├── seed_flights.sql           # Import current AMC_Origin_Tracker data
│   └── seed_assets.sql            # Import current asset data
├── scripts/
│   ├── import_xlsx.py             # Parse Excel workbook → Supabase POST
│   └── acars_ingest.py            # FastAPI endpoint for bot integration
├── package.json
├── vite.config.js
└── .env.example
```

---

## Quick Start

### 1. Supabase project setup
```bash
# Create project at supabase.com (free)
# Copy project URL and anon key
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 2. Database setup
```bash
# In Supabase dashboard → SQL Editor
# Run: database/schema.sql
# Run: database/seed_flights.sql
# Run: database/seed_assets.sql
```

### 3. Frontend
```bash
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
# Set env vars in Vercel dashboard
```

### 5. ACARS bot integration
```bash
# On your server (or same Hetzner VPS)
pip install fastapi uvicorn supabase-py
python scripts/acars_ingest.py
# Your bot POSTs to https://your-server/ingest
```

---

## Excel → Database Import

When you have a new version of the workbook:

```bash
python scripts/import_xlsx.py --file AMC_Origin_Tracker_v15.xlsx --table amc_flights
```

This parses the workbook, deduplicates against existing records, and upserts new ones.

---

## Tier System (Supabase Auth)

| Tier | Supabase Role | Access |
|---|---|---|
| free | authenticated | Completed CORONETs, basic ship positions |
| analyst | analyst (custom claim) | Active CORONETs, full flight tables, route history |
| premium | premium (custom claim) | Satellite imagery, full ACARS feed |
| admin | service_role | All data + edit access |

Set tier via Supabase dashboard: Auth → Users → Edit user → app_metadata → `{"tier": "analyst"}`

---

## Admin Data Management

Navigate to `/admin` (requires admin tier). From there you can:
- Add/edit AMC flights directly in a table
- Manage CORONET missions (add route waypoints on map)
- Upload satellite imagery (stored in Supabase Storage, tier-gated)
- Manage unit→base assignments (no more hardcoded units)
- Place manual events on the map
- Edit airbase intel assessments

---

## ACARS Bot Integration

Your existing bot should add one POST after each decoded message:

```python
import httpx

async def on_acars_decoded(msg):
    # ... existing decode logic ...
    
    await httpx.post("https://your-server/ingest", json={
        "mc": msg.mission_code,        # "JAM 6519 Y1 069"
        "callsign": msg.callsign,      # "RCH335"
        "hex": msg.hex,                # "AE0817"
        "serial": msg.serial,          # "00-0181"
        "origin": msg.origin_icao,     # "KSVN"
        "dest": msg.dest_icao,         # "LLOV"
        "via": msg.via_icao,           # "ETAR"
        "first_hop": msg.first_hop,    # "KBGR"
        "dep_date": msg.dep_date,      # "2026-03-10"
        "status": "ACTIVE",
        "notes": msg.raw_notes,
        "source": "acars_bot"
    })
```

Map auto-updates within ~5 seconds via Supabase realtime subscriptions.

---

## Contributor Rev Share (Future)

When a paid user views a piece of intel that was contributed by a specific user:
1. The view is logged to `intel_views` table with `contributor_id`
2. Monthly cron job calculates view counts per contributor
3. Revenue share pot is distributed proportionally via Stripe

Schema is already in `database/schema.sql` — just needs Stripe wired in.
