-- ═══════════════════════════════════════════
-- OVERWATCH — Supabase Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Enable RLS on all tables
-- Enable realtime on key tables

-- ─── EXTENSIONS ───────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── ENUM TYPES ───────────────────────────
create type mission_status as enum ('ACTIVE', 'COMPLETE', 'PENDING', 'CANCELLED');
create type coronet_status as enum ('ACTIVE', 'IN TRANSIT', 'COMPLETE', 'PLANNED');
create type asset_status as enum ('DEPLOYED', 'SURGE', 'ELEVATED', 'ACTIVE', 'IN PORT', 'NMC', 'INACTIVE');
create type asset_type as enum ('carrier', 'destroyer', 'submarine', 'airbase', 'lmsr', 'conus_base', 'strike', 'manual');
create type mc_flag as enum ('socom', 'amc', 'marine', 'ang', 'afrc', 'unknown');
create type tier_level as enum ('free', 'analyst', 'premium', 'admin');
create type event_type as enum ('STRIKE', 'NAVAL', 'AIRSPACE', 'SIGINT', 'GROUND', 'OTHER');
create type confidence_level as enum ('HIGH', 'MODERATE', 'LOW', 'UNCONFIRMED');

-- ─── AMC FLIGHTS ──────────────────────────
-- Core flight data — populated from ACARS bot and Excel imports
create table amc_flights (
  id            uuid primary key default uuid_generate_v4(),
  
  -- Origin
  base          char(4) not null,          -- ICAO departure base, e.g. KSVN
  dep_date      date,
  
  -- Identification
  callsign      varchar(12),               -- RCH335
  hex           varchar(8),                -- AE0817
  serial        varchar(12),               -- 00-0181
  
  -- Mission code (full string + parsed fields)
  mission_code  varchar(32),               -- JAM 6519 Y1 069
  mc_prefix     char(3),                   -- JAM
  mc_id         varchar(6),                -- 6519
  mc_suffix     varchar(8),                -- Y1
  mc_julian     varchar(3),                -- 069
  mc_flag       mc_flag default 'unknown', -- socom / amc / marine etc
  
  -- Routing
  first_hop     char(4),                   -- KBGR
  via           char(4),                   -- ETAR
  destination   char(4),                   -- LLOV
  
  -- Return mission
  return_mc     varchar(32),
  
  -- Status
  status        mission_status default 'ACTIVE',
  dest_arr_date date,
  dest_dep_date date,
  onward        char(4),
  
  -- Notes and metadata
  notes         text,
  source        varchar(32) default 'manual', -- 'acars_bot', 'manual', 'xlsx_import'
  contributor_id uuid references auth.users(id),
  
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  
  -- Prevent exact duplicates
  unique (callsign, dep_date, mission_code)
);

-- Index for common queries
create index idx_flights_base on amc_flights(base);
create index idx_flights_dest on amc_flights(destination);
create index idx_flights_date on amc_flights(dep_date desc);
create index idx_flights_mc_flag on amc_flights(mc_flag);
create index idx_flights_status on amc_flights(status);
create index idx_flights_hex on amc_flights(hex);

-- Enable realtime
alter publication supabase_realtime add table amc_flights;

-- ─── CORONET MISSIONS ─────────────────────
create table coronets (
  id              uuid primary key default uuid_generate_v4(),
  callsign        varchar(32) not null,    -- CORONET EAST 051
  status          coronet_status default 'PLANNED',
  
  -- Aircraft
  ac_type         varchar(16),             -- F-22A
  ac_category     varchar(16),             -- fighter, bomber, tanker, etc
  quantity        varchar(8),              -- 6x
  unit            varchar(64),             -- 27th Fighter Squadron
  
  -- Route endpoints
  origin_icao     char(4),
  origin_name     varchar(64),
  dest_icao       char(4),
  dest_name       varchar(64),
  
  -- Route waypoints (ordered array of [lat, lng] pairs)
  route_points    jsonb,                   -- [[37.08,-76.36],[41,-60],...]
  
  -- Tanker support
  tanker_details  text,
  
  -- Last known position
  last_lat        decimal(8,4),
  last_lng        decimal(8,4),
  last_update     timestamptz,
  
  -- Tier gating
  tier_required   tier_level default 'analyst',
  
  -- Intel
  notes           text,
  contributor_id  uuid references auth.users(id),
  
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Individual CORONET sorties (cell/leg tracking)
create table coronet_sorties (
  id              uuid primary key default uuid_generate_v4(),
  coronet_id      uuid references coronets(id) on delete cascade,
  
  sortie_date     date,
  cell_number     int,                     -- Cell 1, Cell 2
  leg_number      int,                     -- Leg 1 (outbound), Leg 2 (return)
  
  -- Aircraft (receiver)
  callsign        varchar(16),             -- TABOR 31
  hex             varchar(8),
  serial          varchar(12),
  ac_type         varchar(16),             -- F-22A
  
  -- Tanker
  tanker_callsign varchar(16),             -- GOLD 51
  tanker_hex      varchar(8),
  tanker_serial   varchar(12),
  tanker_origin   char(4),                 -- ADFF0D from Pittsburgh ARS
  
  origin_icao     char(4),
  dest_icao       char(4),
  
  notes           text,
  movement_type   varchar(16),             -- Refuelling, Receiver
  
  created_at      timestamptz default now()
);

-- ─── ASSETS (Naval, Airbase, Events) ──────
create table assets (
  id              uuid primary key default uuid_generate_v4(),
  name            varchar(128) not null,
  designation     varchar(64),             -- CVN-78, OTBH // Qatar, etc
  country         char(2),                 -- US, UK, FR, IT
  asset_type      asset_type not null,
  status          asset_status default 'ACTIVE',
  
  -- Position
  lat             decimal(8,5),
  lng             decimal(8,5),
  
  -- Classification
  aircraft_types  text[],                  -- ['F/A-18E/F', 'E-2D', 'EA-18G']
  
  -- Surge tracking (for airbases)
  arr_count_48h   int default 0,
  dep_count_48h   int default 0,
  socom_count_48h int default 0,
  
  -- LMSR specific
  hull_number     varchar(16),
  ship_class      varchar(32),
  centcom_relevance varchar(16),           -- CRITICAL, HIGH, MODERATE, LOW, NMC, NONE
  last_report_date date,
  last_location   text,
  lmsr_category   varchar(16),             -- forward, conus_e, conus_w, pacific, inactive
  
  -- Carrier specific
  csg_designation varchar(16),             -- CSG-12
  air_wing        varchar(64),
  
  -- CONUS base specific
  icao_code       char(4),                 -- For conus_base type
  base_type       varchar(16),             -- AFB, AAF, NAS, MCAS
  
  -- Content
  notes           text,
  intel_assessment text,
  tags            text[],
  
  -- Tier gating
  tier_required   tier_level default 'free',
  
  contributor_id  uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_assets_type on assets(asset_type);
create index idx_assets_country on assets(country);
create index idx_assets_status on assets(status);
alter publication supabase_realtime add table assets;

-- ─── CARRIER GROUP COMPOSITION ────────────
create table csg_ships (
  id              uuid primary key default uuid_generate_v4(),
  carrier_id      uuid references assets(id) on delete cascade,
  name            varchar(64),
  designation     varchar(64),             -- DDG-57 // Arleigh Burke Flt I
  role            varchar(64),             -- ASW Lead, AAW/BMD, etc
  status          varchar(32) default 'DEPLOYED',
  notes           text
);

-- ─── SHIP SIGHTINGS ───────────────────────
create table ship_sightings (
  id              uuid primary key default uuid_generate_v4(),
  asset_id        uuid references assets(id) on delete cascade,
  sighting_date   date not null,
  source          varchar(64),             -- WarshipCam, AIS, USNI, Social
  description     text,
  image_url       text,                    -- Supabase Storage URL
  lat             decimal(8,5),
  lng             decimal(8,5),
  contributor_id  uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ─── UNIT ASSIGNMENTS ─────────────────────
-- Replaces hardcoded unit references
-- Admin manages this — units rotate, this table does not require code changes
create table unit_assignments (
  id              uuid primary key default uuid_generate_v4(),
  base_icao       char(4) not null,
  unit_name       varchar(128),            -- "101st Airborne Division"
  unit_short      varchar(32),             -- "101st ABN"
  parent_command  varchar(64),             -- "XVIII ABN Corps"
  valid_from      date,
  valid_until     date,                    -- null = currently active
  notes           text,
  updated_by      uuid references auth.users(id),
  updated_at      timestamptz default now()
);

create index idx_unit_base on unit_assignments(base_icao, valid_until);

-- ─── IMAGERY ──────────────────────────────
create table imagery (
  id              uuid primary key default uuid_generate_v4(),
  asset_id        uuid references assets(id) on delete cascade,
  
  capture_date    date,
  source          varchar(64),             -- Sentinel-2, Planet Labs, OSINT
  description     text,
  
  -- File stored in Supabase Storage bucket 'imagery'
  storage_path    text,                    -- e.g. 'llov/2026-03-30.jpg'
  
  -- Tier gating
  tier_required   tier_level default 'premium',
  
  contributor_id  uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ─── MANUAL EVENTS ────────────────────────
create table manual_events (
  id              uuid primary key default uuid_generate_v4(),
  title           varchar(128) not null,
  event_type      event_type not null,
  lat             decimal(8,5),
  lng             decimal(8,5),
  notes           text,
  tags            text[],
  confidence      confidence_level default 'MODERATE',
  status          varchar(32) default 'ACTIVE',
  contributor_id  uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter publication supabase_realtime add table manual_events;

-- ─── SIGACT FEED ──────────────────────────
create table sigact_feed (
  id              uuid primary key default uuid_generate_v4(),
  event_time      timestamptz default now(),
  content_html    text not null,
  source          varchar(64),
  tier_required   tier_level default 'free',
  contributor_id  uuid references auth.users(id),
  created_at      timestamptz default now()
);

alter publication supabase_realtime add table sigact_feed;

-- ─── INTEL VIEWS (for rev share) ──────────
create table intel_views (
  id              uuid primary key default uuid_generate_v4(),
  viewer_id       uuid references auth.users(id),
  contributor_id  uuid references auth.users(id),
  content_type    varchar(32),             -- 'flight', 'imagery', 'coronet', 'intel_note'
  content_id      uuid,
  viewed_at       timestamptz default now()
);

create index idx_views_contributor on intel_views(contributor_id, viewed_at);

-- Monthly view counts (materialised for rev share calculation)
create table monthly_view_summary (
  id              uuid primary key default uuid_generate_v4(),
  contributor_id  uuid references auth.users(id),
  year_month      char(7),                 -- '2026-04'
  view_count      int default 0,
  rev_share_pct   decimal(5,2),
  paid_out        boolean default false,
  created_at      timestamptz default now()
);

-- ─── AIRPORT REFERENCE ────────────────────
create table airport_reference (
  icao            char(4) primary key,
  iata            char(3),
  name            varchar(128),
  location        varchar(128),
  country         char(2),
  lat             decimal(8,5),
  lng             decimal(8,5),
  airport_type    varchar(32),             -- 'military', 'civil', 'joint'
  notes           text
);

-- ─── ROW LEVEL SECURITY ───────────────────
-- amc_flights: readable by all authenticated, writable by analysts+
alter table amc_flights enable row level security;
create policy "flights_read" on amc_flights for select to authenticated using (true);
create policy "flights_insert" on amc_flights for insert to authenticated
  with check (auth.jwt() ->> 'tier' in ('analyst', 'premium', 'admin'));
create policy "flights_update" on amc_flights for update to authenticated
  using (auth.jwt() ->> 'tier' = 'admin' or contributor_id = auth.uid());

-- assets: readable by all authenticated
alter table assets enable row level security;
create policy "assets_read" on assets for select to authenticated using (true);
create policy "assets_write" on assets for all to authenticated
  using (auth.jwt() ->> 'tier' = 'admin');

-- coronets: tier-gated read
alter table coronets enable row level security;
create policy "coronets_free" on coronets for select to authenticated
  using (
    tier_required = 'free'
    or auth.jwt() ->> 'tier' in ('analyst', 'premium', 'admin')
    or (tier_required = 'analyst' and auth.jwt() ->> 'tier' in ('analyst', 'premium', 'admin'))
    or (tier_required = 'premium' and auth.jwt() ->> 'tier' in ('premium', 'admin'))
    or (tier_required = 'admin' and auth.jwt() ->> 'tier' = 'admin')
  );

-- imagery: premium+
alter table imagery enable row level security;
create policy "imagery_premium" on imagery for select to authenticated
  using (
    tier_required = 'free'
    or auth.jwt() ->> 'tier' in ('premium', 'admin')
  );
create policy "imagery_insert" on imagery for insert to authenticated
  with check (auth.jwt() ->> 'tier' = 'admin');

-- unit_assignments: readable by all, writable by admin
alter table unit_assignments enable row level security;
create policy "units_read" on unit_assignments for select to authenticated using (true);
create policy "units_write" on unit_assignments for all to authenticated
  using (auth.jwt() ->> 'tier' = 'admin');

-- ─── HELPER FUNCTIONS ─────────────────────
-- Auto-classify mission code flag on insert
create or replace function classify_mc_flag()
returns trigger as $$
begin
  -- SOCOM: Y1 or Y2 in mission suffix field
  if new.mission_code ~* '\bY[12]\b' then
    new.mc_flag := 'socom';
  -- Marine: PMZ or PVZ prefix patterns
  elsif new.mission_code ~* '^P[MV]Z' then
    new.mc_flag := 'marine';
  -- ANG: J-prefix (TWCF funded ANG)
  elsif left(new.mission_code, 1) = 'J' then
    new.mc_flag := 'ang';
  -- AFRC: X or Q prefix
  elsif left(new.mission_code, 1) in ('X', 'Q') then
    new.mc_flag := 'afrc';
  -- Default AMC
  else
    new.mc_flag := 'amc';
  end if;
  
  -- Parse prefix
  new.mc_prefix := left(regexp_replace(new.mission_code, '\s.*', ''), 3);
  
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_classify_mc
  before insert or update on amc_flights
  for each row execute function classify_mc_flag();

-- Updated_at trigger
create or replace function touch_updated_at()
returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

create trigger trg_assets_updated on assets before update for each row execute function touch_updated_at();
create trigger trg_coronets_updated on coronets before update for each row execute function touch_updated_at();
