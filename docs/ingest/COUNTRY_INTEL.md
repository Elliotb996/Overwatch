# Ingest Contract — Country Intel

**Target table**: `public.country_intel`

## Purpose

Per-country escalation, assessment, and behaviour flags. Drives:
- Country-view overview (which stats panel renders)
- Country marching-ants border animation on tac map
- Tab availability (e.g. STRIKE SITES tab shows only if `has_strike_sites=true`)

One row per country, keyed by `code`. Not for logging specific events — those go to `sigact_feed` or `strike_sites`.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `code` | char(2) | ISO-3166-1 alpha-2, UPPERCASE |
| `name` | text | Display name |
| `escalation` | text | See Escalation levels below |

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `country_type` | text | `hostile` \| `allied_host` \| `neutral`. Default `neutral`. Drives stat panel. **Never shown to user directly** — subjective labels. |
| `summary` | text | Short paragraph overview. Headline analyst view. |
| `threat_window` | text | Descriptive window for current posture, e.g. `'0-72 hours'`, `'Ongoing'`, `'N/A'` |
| `notes` | text | **Dated journal format** — see Journal section below |
| `has_strike_sites` | boolean | Enables STRIKE SITES tab. Default `false`. |
| `has_ports` | boolean | Reserved for port visibility logic. Default `false`. |
| `tier_required` | text | Default `analyst` |

## Escalation levels

Listed by severity. Picks the UI colour and marching-ants ring on the tac map.

| Level | Meaning | UI colour |
|---|---|---|
| `CRITICAL` | Active major kinetic activity | red |
| `SURGE` | Surge of activity, major ongoing operation | red |
| `HIGH` | Elevated risk or limited kinetic | amber |
| `ELEVATED` | Notable activity above baseline | yellow-amber |
| `ACTIVE` | Allied operating country with sustained activity | blue |
| `MODERATE` | Low-level activity, standard monitoring | blue |
| `WATCH` | No current activity, tracked for context | grey |

Default to `WATCH` for countries we track but with nothing currently happening.

## Country Type values

Controls which stats panel renders on the country overview page. Not shown as a label.

| Value | Rule of thumb | Stats shown |
|---|---|---|
| `hostile` | Adversary state with ongoing kinetic or sanctions targeting | Strike sites, destroyed count, escalation, threat window |
| `allied_host` | Country with US/allied military operations, bases, or rotations | AMC flights, SOCOM, tracked bases, naval |
| `neutral` | Everyone else | Minimal — name, escalation, general assessment |

Reclassification examples:
- Iran, Yemen, Syria → `hostile`
- UK, Germany, Jordan, Qatar, Saudi, UAE, Kuwait, Israel, Greece, Italy → `allied_host`
- France (for now), Turkey, Egypt → `neutral`

If in doubt, `neutral`. Upgrading later is easier than mislabelling.

## Journal format for `notes`

The `notes` field is rendered as a dated journal in the country overview. To get the journal rendering, use this format:

```
YYYY-MM-DD: Entry body, one paragraph, plain text.

YYYY-MM-DD: Next entry. Blank line separator.

YYYY-MM-DD: Further entry.
```

The parser splits on `YYYY-MM-DD:` prefixes. Entries render newest-first. The most recent gets a `LATEST` tag.

Legacy notes without date prefixes render as one untagged block — don't break existing data by forcing format conversion.

### Journal writing style

- **Factual, no speculation-as-fact.** ICD 203-aligned.
- **Don't repeat yesterday's entry.** If nothing new, don't add an entry.
- **Cite confidence**: "High confidence"/"Moderate confidence"/"Low confidence" where relevant
- **Flag single-source claims**: "Single-source, unconfirmed"
- **No attribution language**: don't write "sources say". Either it's in the intel or it isn't.

### Good journal entry

```
2026-04-22: Satellite imagery confirms S-400 relocation from Tabriz to Fordow area. High confidence based on commercial imagery 21 Apr. Pattern consistent with strategic reserve dispersal doctrine.
```

### Bad journal entry

```
Iran moved some air defences around this week. Sources say it's related to strikes but who knows.
```

## Dump format (TSV)

Usually only one-off updates. TSV mainly for initial seeding:

```
code	name	escalation	country_type	has_strike_sites	summary
IR	Iran	CRITICAL	hostile	true	Under sustained kinetic campaign since 28 Feb 2026. 8000+ targets struck.
JO	Jordan	ACTIVE	allied_host	false	Primary CENTCOM logistics node. 30+ AMC arrivals/week to OJKA.
GB	United Kingdom	ELEVATED	allied_host	false	Forward bomber & SOCOM hub. Largest US bomber forward deployment since Gulf War.
```

## Handling ambiguity

- **Unknown country**: don't add rows for countries with no tracked activity unless specifically requested. The table shouldn't become a list of every country on earth.
- **Escalation swing**: changes should be backed by intel, not vibes. If downgrading from HIGH to ELEVATED, note it in the journal with the rationale.
- **Country name variants**: use the common short name. "Iran" not "Islamic Republic of Iran". "UK" the code is `GB`.

## Example parses

**Input**: *"Update Iran status — new strike on Fordow overnight, IDF confirms"*

Action: two tables.
1. `strike_sites` gets a new row or status update for Fordow
2. `country_intel` gets a journal entry appended to `notes`:

```
2026-04-23: IDF confirms strike on Fordow Fuel Enrichment Plant. Damage assessment pending. High confidence — IDF statement + imagery expected 24-48h.
```

Escalation stays `CRITICAL` unless materially changed.

**Input**: *"Add country tracking for Poland"*

```json
{
  "code": "PL",
  "name": "Poland",
  "escalation": "WATCH",
  "country_type": "allied_host",
  "has_strike_sites": false,
  "summary": "NATO eastern flank. Major US rotational presence. Tracked for rear-area AMC activity."
}
```
