# Ingest Contract — Ports

**Target table**: `public.assets` where `asset_type = 'port'`

## Purpose

Maritime ports tracked on the OVERWATCH platform. Includes naval bases, major commercial container ports, oil terminals, and dual-use facilities. The `key_port` flag controls whether a port appears on the main tactical map at world zoom — reserve it for ports of genuine strategic significance (Bandar Abbas, Jebel Ali, Kharg, Fujairah, etc). Minor ports get `key_port = false` and only appear on the country-view map.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `name` | text | Full port name, e.g. "Bandar Abbas Naval Base", "Port of Jebel Ali" |
| `asset_type` | enum | Always `'port'` for this contract |
| `country` | char(2) | ISO-3166-1 alpha-2, UPPERCASE. Host country for ports (unlike airbases). A US naval facility at Bahrain is `country='BH'` with a `notes` field noting US operator — ports are infrastructure of the host state. |
| `lat` | numeric | WGS84 decimal degrees |
| `lng` | numeric | WGS84 decimal degrees |
| `port_category` | text | `naval` \| `commercial` \| `dual_use` \| `oil_terminal` |
| `key_port` | boolean | `true` if port should appear on main world-zoom tac map. Default `false`. |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `designation` | text | Short form e.g. "NB BANDAR ABBAS" or container terminal code |
| `status` | text | `ACTIVE` \| `CLOSED` \| `DAMAGED` \| `RESTRICTED`. Default `ACTIVE`. |
| `tonnage_class` | text | Descriptive: `megaport` \| `major` \| `regional` \| `local` — subjective but useful for filtering |
| `notes` | text | Operator details, adjacent infrastructure, ship sighting history |
| `intel_assessment` | text | Analyst summary |
| `tags` | text[] | e.g. `['USCENTCOM','AOR','CRITICAL-CHOKEPOINT']` |
| `tier_required` | enum | Default `free` |

## What counts as a "key port"

A port should be `key_port = true` only if it meets at least one of:
- Hosts permanent foreign naval presence (e.g. NSA Bahrain, Djibouti, Rota)
- Top-50 global container port by TEU
- Primary oil export terminal for a sanctioned state
- Strategic chokepoint (Hormuz, Bab-el-Mandeb, Bosphorus, Malacca adjacent)
- Single-country lifeline port (Aqaba for Jordan, Eilat for Israel)

Everything else stays `key_port = false`. The main tac map should not be polluted with cargo terminals.

## Naming conventions

- **Naval bases**: "Bandar Abbas Naval Base", not "Bandar Abbas Port" when the primary function is military.
- **Commercial ports**: "Port of [City]" is preferred. "Port of Jebel Ali", "Port of Singapore".
- **Oil terminals**: include "Terminal" in name. "Kharg Island Oil Terminal", "Ras Tanura Terminal".
- **Dual-use**: if meaningfully both (e.g. Fujairah), pick `port_category='dual_use'` and reflect in `notes`.

## Dump format (TSV)

```
name	country	lat	lng	port_category	key_port	tonnage_class	status	designation	notes
Bandar Abbas Naval Base	IR	27.158	56.200	naval	true	major	ACTIVE	IRIN HQ	Iranian regular navy HQ; Kilo SSK berths
Port of Jebel Ali	AE	25.011	55.054	commercial	true	megaport	ACTIVE	JEBEL ALI	World's 9th busiest container port
Kharg Island Oil Terminal	IR	29.225	50.318	oil_terminal	true	major	ACTIVE	KHARG	Primary Iranian crude export
```

## Handling ambiguity

- **Multiple facilities at one port**: prefer one row for the port as a whole. If facilities are genuinely separate (different coords, different operators), split.
- **Ports vs bases on land**: if the primary facility is land-based with a port annex, use `airbase` or similar. If the primary facility is the port itself, use `port`.
- **Unclear category**: default to `commercial`. Can be updated later.
- **`key_port` unclear**: default `false`. Upgrading later is easier than polluting the map.

## Example parse

Input: *"Chinese container ship Ever Given berthed at Fujairah bunker terminal"*

Output: this is a ship sighting, not a port definition. Fujairah already exists (or should). Route ship sighting data to `ship_sightings` table instead.

Input: *"New port facility opened at Chabahar, Iran — Indian-funded, 2nd phase complete"*

Output: new row, `name='Port of Chabahar'`, `country='IR'`, `port_category='commercial'`, `key_port=true` (sanctioned state + India-backed geopolitical significance), `notes` capturing the Indian investment detail.
