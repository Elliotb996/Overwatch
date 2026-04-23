# Ingest Contract — Airbases

**Target table**: `public.assets` where `asset_type = 'airbase'`

## Purpose

Airfields tracked on the OVERWATCH platform. Includes active military airbases, major civil dual-use fields, and any airfield OVERWATCH tracks flights to or from. NOT for CONUS departure bases unless they're also operating locations (those have `asset_type='conus_base'`).

## Required fields

| Field | Type | Notes |
|---|---|---|
| `name` | text | Full base name, e.g. "RAF Lakenheath", "King Abdullah II AB" |
| `icao_code` | char(4) | ICAO identifier, UPPERCASE. Required for airbases. |
| `asset_type` | enum | Always `'airbase'` for this contract |
| `country` | char(2) | ISO-3166-1 alpha-2, UPPERCASE. `'US'` for US-operated, `'GB'`, `'IR'`, etc. For US bases abroad, use the **operator** country (`'US'`), not the host (`'GB'`) — the host is inferred from coords + the `country_intel` table. |
| `lat` | numeric | WGS84 decimal degrees |
| `lng` | numeric | WGS84 decimal degrees |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `designation` | text | Short form, e.g. `"EGUL // UK — USAFE HUB"`. Format: `ICAO // country — role` |
| `status` | text | `ACTIVE` \| `SURGE` \| `ELEVATED` \| `MODERATE` \| `DORMANT`. Default `ACTIVE`. |
| `base_type` | text | `AMC` \| `FIGHTER` \| `BOMBER` \| `SOCOM` \| `TANKER` \| `ISR` \| `NAVAL_AIR` \| `MIXED` |
| `arr_count` | int | 7-day arrival count. If unknown, leave null. Don't guess. |
| `socom_count` | int | 7-day SOCOM arrival count. |
| `notes` | text | Anything worth preserving but not structured. |
| `intel_assessment` | text | Analyst summary. Short, no attribution language ("sources say" etc). |
| `tags` | text[] | Array of free-form tags e.g. `['SURGE','AFSOC','OP-EPIC-FURY']` |
| `tier_required` | enum | `free` \| `analyst` \| `premium` \| `admin`. Default `free`. |

## Naming conventions

- **Base names**: use the operator's official name. "RAF Lakenheath" not "Lakenheath AFB". "Al Udeid AB" not "Al Udeid Air Base". Strip redundant words like "Airport" for military bases.
- **ICAO first**: if ICAO is unavailable and only IATA exists, skip the row. Only-IATA airfields aren't useful for AMC flight matching.
- **Country field**: operator, not host. An F-35 detachment at RAF Lakenheath is still a US asset on UK soil; `country='US'`.

## Dump format (TSV)

Expected columns in this order. Headers in row 1. Tab-separated.

```
name	icao_code	country	lat	lng	status	base_type	designation	notes
RAF Lakenheath	EGUL	US	52.409	0.560	ELEVATED	FIGHTER	EGUL // UK — USAFE HUB	48th FW home
Al Udeid AB	OTBH	US	25.117	51.314	SURGE	MIXED	OTBH // Qatar	CENTCOM hub
```

## Handling ambiguity

- **Missing coords**: check the airport_reference table first (`SELECT lat,lng FROM airport_reference WHERE icao=?`). If not there, skip the row and flag it in the parse report.
- **Status unknown**: default to `ACTIVE`. Don't invent a status.
- **Multiple names**: pick the most recognized. "RAF Mildenhall" beats "Mildenhall AB".
- **Already exists**: if `icao_code` already exists in `assets`, treat as UPDATE not INSERT. Flag the conflict so the user can review.

## Example parse

Input: *"6x F-35A from Hill AFB now at Aviano, Italy as of 15 April"*

Output: **do not add** — this is stationed aircraft content, not base definition. Route to `stationed_aircraft` contract. The base Aviano AB already exists; only add aircraft.

Input: *"New USMC detachment opened at Henoko Airfield, Okinawa"*

Output: new row, `name='Henoko Airfield'`, `country='US'`, ICAO if findable, else skip with flag.
