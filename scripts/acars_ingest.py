#!/usr/bin/env python3
"""
OVERWATCH — ACARS Ingest Endpoint
FastAPI service that accepts decoded ACARS messages from your bot
and writes them to Supabase.

Deploy on same server as your bot, or a small Hetzner VPS (~€5/mo).

Usage:
    pip install fastapi uvicorn supabase httpx
    uvicorn acars_ingest:app --host 0.0.0.0 --port 8000

Your bot adds one line after each decode:
    await httpx.post("http://your-server:8000/ingest", json={...})
"""

import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from supabase import create_client, Client

# ─── Config ────────────────────────────────────────────────
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_KEY     = os.environ["SUPABASE_SERVICE_KEY"]  # Service key, not anon
INGEST_SECRET    = os.environ.get("INGEST_SECRET", "change_me_in_prod")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
app = FastAPI(title="OVERWATCH ACARS Ingest", version="1.0")


# ─── Models ────────────────────────────────────────────────
class FlightIngest(BaseModel):
    mc:           str                        # "JAM 6519 Y1 069"
    callsign:     Optional[str] = None       # "RCH335"
    hex:          Optional[str] = None       # "AE0817"
    serial:       Optional[str] = None       # "00-0181"
    origin:       Optional[str] = None       # "KSVN"
    dest:         Optional[str] = None       # "LLOV"
    via:          Optional[str] = None       # "ETAR"
    first_hop:    Optional[str] = None       # "KBGR"
    dep_date:     Optional[str] = None       # "2026-03-10" (ISO)
    status:       str = "ACTIVE"
    notes:        Optional[str] = None
    source:       str = "acars_bot"


# ─── Mission code parser ────────────────────────────────────
def parse_mc(mc: str) -> dict:
    """
    Parse AMC mission code into structured fields.
    e.g. "JAM 6519 Y1 069" → {prefix: "JAM", mc_id: "6519", suffix: "Y1", julian: "069"}
    """
    parts  = mc.strip().split()
    prefix = parts[0][:3] if parts else None
    mc_id  = parts[1] if len(parts) > 1 else None
    suffix = parts[2] if len(parts) > 2 else None
    julian = parts[3] if len(parts) > 3 else None

    # Classify
    flag = "amc"
    if suffix and re.match(r'^Y[12]$', suffix, re.I):
        flag = "socom"
    elif prefix and re.match(r'^P[MV]Z', prefix, re.I):
        flag = "marine"
    elif prefix and prefix[0] in ('J', 'j'):
        flag = "ang"
    elif prefix and prefix[0] in ('X', 'Q', 'x', 'q'):
        flag = "afrc"

    return {
        "mc_prefix":  prefix,
        "mc_id":      mc_id,
        "mc_suffix":  suffix,
        "mc_julian":  julian,
        "mc_flag":    flag,
    }


# ─── Endpoints ─────────────────────────────────────────────
@app.post("/ingest")
async def ingest_flight(
    payload:    FlightIngest,
    x_secret:   str = Header(None, alias="X-Ingest-Secret")
):
    """Accept a decoded ACARS message and write to Supabase."""
    if x_secret != INGEST_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")

    parsed = parse_mc(payload.mc)

    record = {
        "base":         payload.origin.upper() if payload.origin else None,
        "dep_date":     payload.dep_date or datetime.now(timezone.utc).date().isoformat(),
        "callsign":     payload.callsign,
        "hex":          payload.hex,
        "serial":       payload.serial,
        "mission_code": payload.mc,
        "first_hop":    payload.first_hop.upper() if payload.first_hop else None,
        "via":          payload.via.upper() if payload.via else None,
        "destination":  payload.dest.upper() if payload.dest else None,
        "status":       payload.status,
        "notes":        payload.notes,
        "source":       payload.source,
        **parsed,
    }

    # Upsert — if same callsign+date+mc exists, update status/notes
    result = supabase.table("amc_flights").upsert(
        record,
        on_conflict="callsign,dep_date,mission_code"
    ).execute()

    return {"ok": True, "mc_flag": parsed["mc_flag"], "id": result.data[0]["id"] if result.data else None}


@app.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


@app.get("/stats")
async def stats(x_secret: str = Header(None, alias="X-Ingest-Secret")):
    """Quick stats endpoint for monitoring."""
    if x_secret != INGEST_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret")

    result = supabase.table("amc_flights") \
        .select("status, mc_flag", count="exact") \
        .execute()

    by_flag   = {}
    by_status = {}
    for row in (result.data or []):
        f = row.get("mc_flag", "unknown")
        s = row.get("status",  "UNKNOWN")
        by_flag[f]   = by_flag.get(f, 0) + 1
        by_status[s] = by_status.get(s, 0) + 1

    return {"total": result.count, "by_flag": by_flag, "by_status": by_status}
