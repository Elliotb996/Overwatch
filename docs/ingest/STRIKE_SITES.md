# Ingest Contract — Strike Sites & Strategic Infrastructure

**Target table**: `public.strike_sites`

## Purpose

This table is **dual-purpose**:
1. Strike sites — locations that have been attacked (kinetic, cyber, sabotage)
2. Strategic infrastructure — locations of significance that may or may not yet be struck

Both live here because a site's status evolves: a nuclear plant is tracked as `ACTIVE` today, potentially `DAMAGED` tomorrow. Same row throughout its lifecycle. Don't create separate rows for "pre-strike" and "post-strike" versions of the same facility.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `name` | text | Official or commonly reported facility name |
| `country_code` | char(2) | ISO-3166-1 alpha-2, UPPERCASE |
| `lat` | numeric | WGS84 decimal degrees. Best available precision. |
| `lng` | numeric | WGS84 decimal degrees |
| `site_type` | text | See Site Types below |
| `status` | text | `ACTIVE` \| `DAMAGED` \| `DESTROYED` \| `UNKNOWN`. Default `ACTIVE` for untouched strategic sites. |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `strike_date` | date | Date of strike. Required if status is DAMAGED or DESTROYED. |
| `strike_timestamp` | timestamptz | Precise strike time if known. Drives 1h/12h pulse windows on the main map. Leave null if only a date is known. |
| `source` | text | Where we got the report — `"Satellite"`, `"OSINT"`, `"ACLED"`, `"IDF Statement"`, `"ArmchairAdml"`, etc |
| `source_url` | text | Direct link to primary source |
| `x_url` | text | X/Twitter post URL if that's the primary source |
| `x_username` | text | X handle (without @) |
| `description` | text | Analyst summary. No attribution language. |
| `geo_confirmed` | boolean | `true` only if coordinates are imagery-confirmed, not just implied by a text report. Default `false`. |
| `image_url` | text | Strike imagery (satellite, damage assessment) |
| `image_label` | text | Short caption for imagery |
| `site_category` | text | See Categories below |
| `is_strategic` | boolean | Appears in the Strategic Sites layer on tac map |
| `is_infrastructure` | boolean | Appears in the Infrastructure layer on tac map |
| `tier_required` | text | Default `analyst` |

## Site Types

Controls icon shape on maps. Pick the most specific that applies.

| Type | Examples |
|---|---|
| `nuclear` | Enrichment plants, reactors, fuel fabrication, weapons storage suspected |
| `missile` | Launch sites, production, storage bunkers, IRGC missile garrisons |
| `naval` | Naval bases, shipyards, submarine pens — when the facility itself is the target |
| `airbase` | Airfields attacked, hardened shelters, runway strikes |
| `radar` | Air-defence radars, early warning |
| `facility` | Generic government, research, military R&D — catch-all |
| `strike` | Use only when none of the above fit (e.g. urban target, leadership compound) |

Do not invent new types. If nothing fits, use `strike` and put specifics in `description`.

## Categories

Separate from `site_type`. Controls which **layer** the site appears on.

| Category | Meaning | When to use |
|---|---|---|
| `strategic` | Military-strategic targets | Nuclear, missile, most airbase, most naval, air defence |
| `energy` | Oil, gas, power, pipelines | Refineries, terminals, power plants |
| `c2` | Command & control | MOD HQ, IRGC HQ, communications centres |
| `airdef` | Dedicated air defence sites | S-400 batteries, SAM sites |
| `industrial` | Weapons production, dual-use industry | UAV factories, munitions plants, centrifuge manufacturing |
| `generic` | Doesn't fit clearly | Default catch-all |

Flag helpers:
- `is_strategic = true` for categories `strategic`, `c2`, `airdef`
- `is_infrastructure = true` for category `energy`

## Status meanings

- `ACTIVE` — target exists, not known to be struck. Use for strategic infrastructure we're tracking.
- `DAMAGED` — struck, partial loss of function, BDA suggests reparable
- `DESTROYED` — struck, complete loss of function, or facility no longer identifiable on imagery
- `UNKNOWN` — reported as struck but effects unverifiable

## Dump format (TSV)

```
name	country_code	lat	lng	site_type	status	strike_date	source	description	geo_confirmed	site_category	is_strategic	is_infrastructure
Natanz FEP	IR	33.7248	51.7262	nuclear	DAMAGED	2026-03-01	Satellite	Surface buildings struck; underground halls status uncertain	true	strategic	true	false
Kharg Oil Terminal	IR	29.225	50.318	facility	ACTIVE				commercial imagery tracking	false	energy	false	true
```

## Naming conventions

- **Facility names**: the name used in reporting, not a paraphrase. "Natanz Fuel Enrichment Plant" not "Natanz Enrichment Complex".
- **Short forms**: acceptable if widely used. "Fordow" works without "Fuel Enrichment Plant".
- **Cities**: only when the facility name is literally the city. "Tehran airstrike" is not a name — extract what was struck or skip.

## Handling ambiguity

- **Location precision**: if coords come from a news report without imagery, `geo_confirmed = false`. If from analyst-verified satellite imagery or official release, `geo_confirmed = true`. Do not invent precision.
- **Casualty counts**: do not capture. We track material damage, not casualties. Mentioning civilian casualties in `description` is fine if it affects the assessment.
- **Contested reports**: conflicting damage reports → `status = 'UNKNOWN'`, note both in `description`.
- **Untracked sites referenced in passing**: if a report mentions a site we haven't tracked, add it with `status='ACTIVE'` and note the reference.

## Example parses

**Input**: *"Israeli strike on Natanz nuclear facility overnight. IAEA reports damage to above-ground halls. Centrifuge hall status unclear."*

```json
{
  "name": "Natanz Fuel Enrichment Plant",
  "country_code": "IR",
  "lat": 33.7248,  // looked up from known Natanz coords
  "lng": 51.7262,
  "site_type": "nuclear",
  "status": "DAMAGED",
  "strike_date": "<today>",
  "source": "IAEA",
  "description": "Above-ground halls damaged per IAEA. Underground centrifuge halls status unverified.",
  "geo_confirmed": true,
  "site_category": "strategic",
  "is_strategic": true,
  "is_infrastructure": false
}
```

**Input**: *"Tracking Iranian IRGC missile production at Parchin — new expansion visible on imagery"*

```json
{
  "name": "Parchin Military Complex",
  "country_code": "IR",
  "lat": 35.5194,  // Parchin
  "lng": 51.7731,
  "site_type": "missile",
  "status": "ACTIVE",
  "source": "Satellite",
  "description": "IRGC missile production. New expansion observed on commercial imagery.",
  "geo_confirmed": true,
  "site_category": "industrial",
  "is_strategic": false,
  "is_infrastructure": true  // industrial, not strategic — it's capacity, not a completed strategic asset
}
```
