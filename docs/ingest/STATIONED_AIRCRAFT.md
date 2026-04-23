# Ingest Contract — Stationed Aircraft

**Target table**: `public.stationed_aircraft`

## Purpose

Aircraft stationed at a specific airbase. Home-station or detached. Distinguished from AMC flight log (`amc_flights`) — that tracks **missions**, this tracks **presence**.

Rule of thumb: if it lives at the base, it's stationed. If it's passing through, it's a flight log entry. A C-17 that landed, unloaded, and left = flight. A KC-135 detached for 90 days = stationed.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `asset_id` | text | The ICAO code of the host base (e.g. `'EGUL'`, `'OTBH'`). Links to `assets` by matching `icao_code`. |
| `aircraft_type` | text | Full designation with dash, e.g. `'F-35A'`, `'B-52H'`, `'MC-130J'`. See Type Conventions below. |
| `role` | text | Short role description, e.g. `'Fighter'`, `'Strategic Bomber'`, `'Tanker'`, `'SOCOM Assault'`, `'EW'` |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `unit` | text | Owning unit, e.g. `'352nd SOG / 1st SOW'`, `'5 BW / 2 BW'`. Mission code convention — use unit relationships, not invented assignments. |
| `wing` | text | Parent wing if worth separating from unit |
| `count` | int | Numerical count |
| `count_qualifier` | text | `'+'` for "at least N", `'~'` for "approximately". NULL for exact. |
| `status` | text | `DEPLOYED` \| `SURGE` \| `DETACHMENT` \| `DEPARTED` \| `ASSESSED` \| `REFIT`. Default `DEPLOYED`. |
| `tails` | text[] | Array of tail numbers (registration) — e.g. `['60-0040','60-0047']` — NOT callsigns. |
| `confirmed` | boolean | Default `true`. Set `false` for assessed-only presence. |
| `source` | text | Attribution, e.g. `'ArmchairAdml'`, `'ADS-B'`, `'spotter log'` |
| `valid_from` | date | When this stationing began |
| `valid_to` | date | When it ended (for historical / departed records) |

## Type Conventions

**Always use the manufacturer designation with dash.** Examples:

| Correct | Wrong |
|---|---|
| `F-35A`, `F-35B`, `F-35C` | `F35A`, `F 35A`, `F-35` (without variant) |
| `B-52H` | `B52H`, `B-52` |
| `KC-46A`, `KC-135R` | `KC46`, `KC135` |
| `MC-130J` | `MC-130-J`, `MC130J` |
| `E-2D`, `E-3B`, `EA-18G` | `E2D`, `E3`, `EA18G` |

If variant unknown, use the base model: `F-15E` if known to be Strike Eagle, `F-15C` if air-superiority, `F-15` only if genuinely unknown.

## Tails vs Callsigns

**CRITICAL**: This table stores **tails only** — aircraft registration serials. Callsigns belong in `amc_flights`.

- ✅ Tail: `60-0040` (B-52H), `14-5805` (MC-130J), `85-0072` (B-1B)
- ❌ Callsign: `REACH 1234`, `HEEL 51`, `RCH1234`

Exception: AC-130J Ghostriders have no public tails. `HEEL 51`, `HEEL 53`, `HEEL 55` are the only identifiers available. Record these in `tails` despite being callsigns, and note in the source field.

## Status meanings

- `DEPLOYED` — actively present and operating
- `SURGE` — temporary uplift beyond baseline (e.g. bomber task force)
- `DETACHMENT` — limited-duration presence, typically <6 months
- `DEPARTED` — left the base, record retained for history. Set `valid_to`.
- `ASSESSED` — presence inferred but not confirmed
- `REFIT` — on station but not operationally available

## Unit field rules

Mission code conventions are permanent; unit assignments rotate. Do not hardcode a specific wing to a specific aircraft type unless the source explicitly states it.

- ✅ `'94th FS / 1st FW'` (sourced)
- ✅ `'TBD'` (unit unknown)
- ❌ Never fabricate: `'VMFA-314'` because "it's a Marine squadron and USMC F-35s exist"

Use mission code patterns when they apply:
- Y-series SAAMs → SOCOM
- PMZ/PVZ prefixes → Marine
- A-series Army-Z → Army

## Dump format (TSV)

```
asset_id	aircraft_type	unit	count	count_qualifier	role	status	tails	source
EGVA	B-52H	5 BW / 2 BW	8		Strategic Bomber	SURGE	61-0001|61-0035|60-0012	Fairford spotter log 28 Mar
EGUN	MC-130J	352nd SOG / 1st SOW	41	+	SOCOM Assault	SURGE	14-5805	Multiple spotters
EGUL	F-22A	1st FW / Langley AFB	6		Fighter	DETACHMENT		CORONET EAST 051
```

Tails use `|` as intra-cell separator (the database expects a Postgres array). Parser converts to `ARRAY['...','...']` on insert.

## Handling ambiguity

- **Duplicate rows for same type at same base**: if two sources report different counts, take the higher confidence source. Don't create two rows for the same type+base+unit.
- **Count vs tails inconsistency**: if 6 tails listed but count says 8, check for DEPARTED tails that shouldn't be counted. If unresolvable, trust the tail list length.
- **Unit missing**: set `unit = NULL`, add note. Don't guess.
- **Rotation/relief**: if a unit rotates out and another rotates in, the outgoing row gets `status='DEPARTED'` + `valid_to`, new row is created for the incoming unit.

## Example parses

**Input**: *"6x B-52H Stratofortress from the 2nd Bomb Wing arrived at Fairford overnight. Tails include 60-0012, 61-0035, 60-0007."*

```json
{
  "asset_id": "EGVA",
  "aircraft_type": "B-52H",
  "unit": "2 BW",
  "count": 6,
  "role": "Strategic Bomber",
  "status": "SURGE",
  "tails": ["60-0012","61-0035","60-0007"],
  "confirmed": true,
  "source": "Spotter log"
}
```

**Input**: *"REACH 4501 departed Travis bound for Ramstein"*

Output: **do not add** — this is a flight movement, not stationing. Route to `amc_flights` contract.

**Input**: *"Satellite shows ~12 F-16C at Shaw"*

```json
{
  "asset_id": "KSSC",
  "aircraft_type": "F-16C",
  "unit": "20th FW",  // Shaw home unit — acceptable since it's home station
  "count": 12,
  "count_qualifier": "~",
  "role": "Fighter",
  "status": "DEPLOYED",
  "confirmed": false,  // satellite count, approximate
  "source": "Commercial imagery"
}
```
