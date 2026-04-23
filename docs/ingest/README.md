# OVERWATCH Ingest Contracts

These are the authoritative specs for how data gets into the OVERWATCH Supabase database. One doc per category. Every bulk dump or parsed OSINT should follow these contracts.

## How to use this

**For the human (Elliot):**
- When starting a new chat to process a data dump, paste the relevant contract along with the raw data. Claude will parse to spec.
- When writing a dump by hand or from a spreadsheet, use the TSV format at the bottom of the relevant doc as the header row.

**For Claude (future sessions):**
- Read the relevant contract before touching the database. Don't freestyle field names or invent enum values.
- If a row doesn't fit the contract, flag it in the parse report rather than forcing a fit.
- For bulk ingests, stage to `bulk_ingest` first, never insert directly to the target table. The user approves the push.

## The contracts

| Contract | Target table(s) | Purpose |
|---|---|---|
| [AIRBASES.md](AIRBASES.md) | `assets` where `asset_type='airbase'` | Airfields OVERWATCH tracks |
| [PORTS.md](PORTS.md) | `assets` where `asset_type='port'` | Maritime ports, naval bases, terminals |
| [STRIKE_SITES.md](STRIKE_SITES.md) | `strike_sites` | Strike sites AND strategic/infrastructure sites (dual-purpose) |
| [STATIONED_AIRCRAFT.md](STATIONED_AIRCRAFT.md) | `stationed_aircraft` | Aircraft stationed at a base (not flights) |
| [COUNTRY_INTEL.md](COUNTRY_INTEL.md) | `country_intel` | Per-country escalation, assessment, journal |

## Not covered by contracts

These tables have their own workflows, not bulk ingest:

| Table | Workflow |
|---|---|
| `amc_flights` | Parsed from ACARS via Discord bot, or manual entry via admin UI |
| `acars_staging` | Scraper ingest, not a contract — it's a raw queue |
| `osint_ingest` | Admin paste queue with Claude API parse, handled by `OsintIngest.jsx` |
| `coronets` / `coronet_sorties` | Specialised, manual entry |
| `imagery_meta` | Admin upload workflow |
| `sigact_feed` | Real-time feed — manual or admin-triggered |

## Core principles

**1. One source of truth per fact.**
A nuclear facility is one row in `strike_sites`, not two (one for "strategic site" and one for "struck site"). Its `status` field evolves.

**2. Don't invent enum values.**
If a value isn't in the allowed list, use the closest-fit or the `generic`/`other` catchall. Never silently widen the enum.

**3. Coordinates: WGS84, decimal degrees, best available precision.**
Don't fabricate precision. If a news report says "near Tehran", don't invent coords. Either find the facility coords or skip the row.

**4. `geo_confirmed = true` means imagery-confirmed.**
Not "I saw it on Twitter". Not "the news said it was". Imagery or official release.

**5. Country field meaning depends on asset type.**
- Airbases: operator country (US F-35s at RAF Lakenheath → `country='US'`)
- Ports: host country (US ships at Bahrain → `country='BH'`, note the operator in `notes`)
- Strike sites: host country always
- Country intel: obviously the country itself

**6. Never insert directly on bulk dumps.**
Stage to `bulk_ingest` with `parse_status='pending'`, show validation report, await explicit approval. One-off single-row inserts (tweet parsing) can go direct to `osint_ingest` for review.

**7. Do not fabricate.**
Better to skip a row with a "missing field" flag than invent a plausible value. The user reviews and fills gaps manually.

## Dump format recommendations

**For tabular data from spreadsheets**: TSV (tab-separated). Headers in row 1 matching the field names in the contract. Easy to copy-paste from Google Sheets / Excel.

**For freeform OSINT (tweets, posts)**: paste the raw text. Claude parses per the relevant contract and shows you the structured output before writing.

**For large machine-generated data (scrapers)**: JSON Lines (one JSON object per row). Saves you field-ordering issues and is unambiguous about null vs empty.

## Parse reports

When Claude processes a dump, it produces a report like:

```
Dump received: 42 rows
Target contract: STRIKE_SITES
Staged to: bulk_ingest (id=abc-...)

Valid rows: 38
Flagged rows: 4
  - Row 12: missing country_code
  - Row 19: invalid site_type 'factory' (did you mean 'facility'?)
  - Row 27: lat/lng out of range
  - Row 34: name already exists in strike_sites (potential duplicate — ID abc-def)

Ready for review. Approve with: "push bulk_ingest abc-..."
Reject with: "reject bulk_ingest abc-..."
```

Follow this pattern every time.
