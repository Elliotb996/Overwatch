import L from 'leaflet'
import { mkSiteIconHtml, STATE_COLORS, SITE_ICON_META } from './iconLibrary.js'

// Maps strike_sites.status → iconLibrary state key
const _statusToState = { ACTIVE:'nominal', DAMAGED:'elevated', DESTROYED:'critical', UNKNOWN:'dormant' }

// Unified site icon — uses the 21-icon SVG library.
// iconId: any key from ICON_IDS (missile, nuclear, radar, etc.) — falls back to 'facility'.
// status: ACTIVE | DAMAGED | DESTROYED | UNKNOWN
// alerts: integer badge count (0 = no badge)
export function mkSiteIcon(iconId, status, alerts = 0) {
  const state = _statusToState[status] || 'dormant'
  const color = STATE_COLORS[state]
  const id    = SITE_ICON_META[iconId] ? iconId : 'facility'
  const badge = alerts > 0
    ? `<div style="position:absolute;top:-8px;right:-10px;min-width:18px;height:13px;padding:0 3px;background:${color};color:#07090b;font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid #07090b;box-sizing:border-box;pointer-events:none">+${alerts}</div>`
    : ''
  return L.divIcon({
    className: '',
    iconSize:  [22, 22],
    iconAnchor:[11, 11],
    html: `<div style="position:relative;display:inline-block;width:22px;height:22px;">${mkSiteIconHtml(id, color, 22, { state })}${badge}</div>`,
  })
}

export function mkIcon(sym, color, size = 18, badge = null) {
  const bdg = badge
    ? `<div style="position:absolute;top:-7px;right:-5px;background:#e85040;color:#fff;font-family:'Share Tech Mono',monospace;font-size:7px;font-weight:700;padding:0 3px;line-height:11px;min-width:11px;text-align:center;box-sizing:border-box">${badge}</div>`
    : ''
  return L.divIcon({
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      ${bdg}
      <div style="
        width:${size}px;height:${size}px;
        background:rgba(7,9,11,0.92);
        border:1px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-family:'Share Tech Mono',monospace;
        font-size:${Math.max(7, Math.round(size * 0.44))}px;
        font-weight:700;color:#dceaf0;
        box-sizing:border-box;
      ">${sym}</div>
    </div>`,
  })
}

// label: full hull e.g. "CVN-78", "DDG-51", "T-AK-304". Width scales to text length.
export function mkTrackBlock(label, color) {
  const w = Math.min(Math.max(label.length * 6 + 10, 34), 58)
  return L.divIcon({
    className: '',
    iconSize:   [w, 14],
    iconAnchor: [w / 2, 7],
    html: `<div style="width:${w}px;height:14px;background:rgba(7,9,11,0.92);border:1px solid ${color};display:flex;align-items:center;justify-content:center;font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;color:#dceaf0;box-sizing:border-box;overflow:hidden;white-space:nowrap;letter-spacing:0.3px;">${label}</div>`,
  })
}

// Static SVG replica of AirbaseMarker.jsx — required for Leaflet divIcon (no React hooks).
// Status mapping: SURGE→red, ELEVATED→amber, ACTIVE→green, MODERATE→blue, else→slate
export function mkAirbaseIcon(status, alerts = 0) {
  const cfg = {
    SURGE:    { color: '#e85040', fill: 'rgba(232,80,64,0.10)'  },
    ELEVATED: { color: '#f0a040', fill: 'rgba(240,160,64,0.08)' },
    ACTIVE:   { color: '#39e0a0', fill: 'rgba(57,224,160,0.08)' },
    MODERATE: { color: '#50a0e8', fill: 'rgba(80,160,232,0.08)' },
  }
  const { color, fill } = cfg[status] || { color: '#4a6070', fill: 'transparent' }
  const badge = alerts > 0
    ? `<div style="position:absolute;top:-8px;right:-10px;min-width:18px;height:13px;padding:0 3px;background:${color};color:#07090b;font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid #07090b;box-sizing:border-box;pointer-events:none">+${alerts}</div>`
    : ''
  return L.divIcon({
    className: '',
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="position:relative;width:20px;height:20px">
      <svg viewBox="0 0 20 20" width="20" height="20" style="display:block;overflow:visible">
        <rect x="4" y="4" width="12" height="12" fill="${fill}" stroke="${color}" stroke-width="1"/>
        <path d="M1,1 L4,1 M1,1 L1,4 M19,1 L16,1 M19,1 L19,4 M1,19 L4,19 M1,19 L1,16 M19,19 L16,19 M19,19 L19,16"
              stroke="${color}" stroke-width="1" fill="none"/>
        <circle cx="10" cy="10" r="1.6" fill="${color}"/>
      </svg>
      ${badge}
    </div>`,
  })
}

// Crosshair-in-square: strategic strike sites. Color-coded by status.
export function mkStrikeMapIcon(status = 'ACTIVE') {
  const col = { DESTROYED: '#e85040', DAMAGED: '#f0a040', ACTIVE: '#39e0a0', UNKNOWN: '#4a6070' }[status] || '#4a6070'
  return L.divIcon({
    className: '',
    iconSize:   [16, 16],
    iconAnchor: [8, 8],
    html: `<svg viewBox="0 0 20 20" width="16" height="16" style="display:block;overflow:visible">
      <rect x="3" y="3" width="14" height="14" fill="rgba(7,9,11,0.85)" stroke="${col}" stroke-width="1"/>
      <path d="M1,1 L4,1 M1,1 L1,4 M19,1 L16,1 M19,1 L19,4 M1,19 L4,19 M1,19 L1,16 M19,19 L16,19 M19,19 L19,16" stroke="${col}" stroke-width="1" fill="none"/>
      <line x1="10" y1="4.5" x2="10" y2="8" stroke="${col}" stroke-width="0.8"/>
      <line x1="10" y1="12" x2="10" y2="15.5" stroke="${col}" stroke-width="0.8"/>
      <line x1="4.5" y1="10" x2="8" y2="10" stroke="${col}" stroke-width="0.8"/>
      <line x1="12" y1="10" x2="15.5" y2="10" stroke="${col}" stroke-width="0.8"/>
      <circle cx="10" cy="10" r="1.8" fill="none" stroke="${col}" stroke-width="0.8"/>
      <circle cx="10" cy="10" r="0.7" fill="${col}"/>
    </svg>`,
  })
}

// Diamond: infrastructure sites. Amber by default.
export function mkInfraIcon(status = 'ACTIVE') {
  const col = { DESTROYED: '#e85040', DAMAGED: '#f0a040', ACTIVE: '#f0a040', UNKNOWN: '#4a6070' }[status] || '#f0a040'
  return L.divIcon({
    className: '',
    iconSize:   [16, 16],
    iconAnchor: [8, 8],
    html: `<svg viewBox="0 0 20 20" width="16" height="16" style="display:block;overflow:visible">
      <path d="M10,2 L18,10 L10,18 L2,10 Z" fill="rgba(7,9,11,0.85)" stroke="${col}" stroke-width="1"/>
      <circle cx="10" cy="10" r="1.5" fill="${col}"/>
    </svg>`,
  })
}

// Strike pulse badge: corner-ticked square + count chip. hot=red, warm=amber, old=slate.
export function mkPulseIcon(count, recency = 'old') {
  const col = recency === 'hot' ? '#e85040' : recency === 'warm' ? '#f0a040' : '#4a6070'
  return L.divIcon({
    className: '',
    iconSize:   [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="position:relative;width:26px;height:26px">
      <svg viewBox="0 0 20 20" width="26" height="26" style="display:block;overflow:visible">
        <rect x="4" y="4" width="12" height="12" fill="${col}18" stroke="${col}" stroke-width="1.2"/>
        <path d="M1,1 L4,1 M1,1 L1,4 M19,1 L16,1 M19,1 L19,4 M1,19 L4,19 M1,19 L1,16 M19,19 L16,19 M19,19 L19,16" stroke="${col}" stroke-width="1" fill="none"/>
        <circle cx="10" cy="10" r="2" fill="${col}"/>
      </svg>
      <div style="position:absolute;top:-8px;right:-10px;min-width:18px;height:13px;padding:0 3px;background:${col};color:#07090b;font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid #07090b;box-sizing:border-box">${count}</div>
    </div>`,
  })
}

// Cluster badge: corner-ticked square + asset count chip. Color follows max status in cluster.
export function mkClusterIcon(count, maxStatus) {
  const col = maxStatus === 'SURGE' ? '#e85040' : maxStatus === 'ELEVATED' ? '#f0a040' : '#39e0a0'
  return L.divIcon({
    className: '',
    iconSize:  [28, 28],
    iconAnchor:[14, 14],
    html: `<div style="position:relative;width:28px;height:28px;">
      <svg viewBox="0 0 20 20" width="28" height="28" style="display:block;overflow:visible">
        <rect x="4" y="4" width="12" height="12" fill="${col}12" stroke="${col}" stroke-width="1"/>
        <path d="M1,1 L4,1 M1,1 L1,4 M19,1 L16,1 M19,1 L19,4 M1,19 L4,19 M1,19 L1,16 M19,19 L16,19 M19,19 L19,16"
              stroke="${col}" stroke-width="1" fill="none"/>
        <circle cx="10" cy="10" r="1.6" fill="${col}"/>
      </svg>
      <div style="position:absolute;top:-8px;right:-10px;min-width:18px;height:13px;padding:0 3px;
        background:${col};color:#07090b;font-family:'Share Tech Mono',monospace;font-size:8px;
        font-weight:700;display:flex;align-items:center;justify-content:center;
        border:1px solid #07090b;box-sizing:border-box">${count}</div>
    </div>`,
  })
}

// Maps UI pulse-window labels to strike_pulse view column names.
export const PULSE_COLS = {
  '1h':  'strikes_1h',
  '12h': 'strikes_12h',
  '24h': 'strikes_24h',
  '48h': 'strikes_48h',
  '72h': 'strikes_72h',
  '7d':  'strikes_7d',
}
