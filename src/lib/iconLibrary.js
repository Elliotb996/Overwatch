import React from 'react'

// ─── Primitive helpers ────────────────────────────────────────────────────
// Mirror the HTML prototype's helper kit, but handle both hex and 'currentColor'
// so SITE_ICONS (static/CSS) and renderSvgString() (Leaflet/programmatic) both work.

const SW = 1.3

function _s(c)          { return `stroke="${c}" stroke-width="${SW}" stroke-linecap="square" fill="none"` }
function _sf(c)         { return `fill="${c}"` }
function _sFilled(c, a = 0.12) {
  if (c === 'currentColor') return `fill="currentColor" fill-opacity="${a}" stroke="currentColor" stroke-width="${SW}"`
  const n = c.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  return `fill="rgba(${r},${g},${b},${a})" stroke="${c}" stroke-width="${SW}"`
}
// Four corner brackets — the shared frame every icon uses
function _brackets(c) {
  return `<path d="M4,4 L9,4 M4,4 L4,9"         ${_s(c)}/>
      <path d="M28,4 L23,4 M28,4 L28,9"          ${_s(c)}/>
      <path d="M4,28 L9,28 M4,28 L4,23"          ${_s(c)}/>
      <path d="M28,28 L23,28 M28,28 L28,23"      ${_s(c)}/>`
}
// Panel dark — used as "hole" fill in intel eye so it reads against dark map tiles
const _BG = '#0a0c10'

// ─── State color palette ──────────────────────────────────────────────────
export const STATE_COLORS = {
  nominal:  '#39e0a0',
  elevated: '#f0a040',
  critical: '#e85040',
  dormant:  '#8aa0b0',
}

// ─── Glyph functions (color) → inner SVG string ───────────────────────────
// Each is a pure function of color. Wrap in renderSvgString() for a full SVG.
// These are kept internal; consumers use SITE_ICONS or renderSvgString().

const GLYPHS = {

  // ── STRIKE SITES ───────────────────────────────────────────────────────

  missile: c => `
      ${_brackets(c)}
      <path d="M16,7 L18.3,10 L18.3,20 L13.7,20 L13.7,10 Z" ${_s(c)}/>
      <line x1="13.7" y1="13" x2="18.3" y2="13" ${_s(c)} opacity="0.55"/>
      <path d="M13.7,17 L11,20 L13.7,20 Z" ${_sFilled(c, 0.25)}/>
      <path d="M18.3,17 L21,20 L18.3,20 Z" ${_sFilled(c, 0.25)}/>
      <line x1="15" y1="21" x2="15" y2="23.5" ${_s(c)} opacity="0.75"/>
      <line x1="17" y1="21" x2="17" y2="23.5" ${_s(c)} opacity="0.75"/>`,

  naval: c => `
      ${_brackets(c)}
      <line x1="16" y1="10" x2="16" y2="22" ${_s(c)}/>
      <line x1="11" y1="13" x2="21" y2="13" ${_s(c)}/>
      <path d="M10,18 Q16,24 22,18" ${_s(c)}/>
      <circle cx="16" cy="10" r="1.4" ${_sf(c)}/>`,

  airbase: c => `
      ${_brackets(c)}
      <line x1="8.5"  y1="7"  x2="8.5"  y2="22" ${_s(c)} opacity="0.65"/>
      <line x1="23.5" y1="7"  x2="23.5" y2="22" ${_s(c)} opacity="0.65"/>
      <path d="M16,7.5 L17,11 L17,14 L22,17 L22,18.5 L17,17.8 L17,20.5 L18.5,22 L13.5,22 L15,20.5 L15,17.8 L10,18.5 L10,17 L15,14 L15,11 Z" ${_sFilled(c, 0.25)}/>
      <line x1="15" y1="23" x2="15" y2="25.5" ${_s(c)} opacity="0.7"/>
      <line x1="17" y1="23" x2="17" y2="25.5" ${_s(c)} opacity="0.7"/>`,

  nuclear: c => `
      ${_brackets(c)}
      <circle cx="16" cy="16" r="9" ${_s(c)}/>
      <path d="M 11.5,9.07 A 8,8 0 0 1 20.5,9.07 L 17.5,14.27 A 2,2 0 0 0 14.5,14.27 Z" ${_sf(c)}/>
      <path d="M 8,20.5 A 8,8 0 0 1 12.5,12.71 L 15.5,17.91 A 2,2 0 0 0 13.268,20.732 Z" ${_sf(c)}/>
      <path d="M 24,20.5 A 8,8 0 0 0 19.5,12.71 L 16.5,17.91 A 2,2 0 0 1 18.732,20.732 Z" ${_sf(c)}/>
      <circle cx="16" cy="16" r="2" ${_sf(c)}/>`,

  facility: c => `
      ${_brackets(c)}
      <rect x="10" y="10" width="12" height="12" ${_s(c)}/>
      <path d="M10,14 L22,14 M10,18 L22,18" ${_s(c)} opacity="0.5"/>
      <rect x="14.5" y="18" width="3" height="4" ${_sf(c)}/>`,

  command: c => `
      ${_brackets(c)}
      <circle cx="16" cy="16" r="7" ${_s(c)}/>
      <polygon points="16,10.5 17.4,14.3 21.2,14.3 18.1,16.6 19.3,20.3 16,18 12.7,20.3 13.9,16.6 10.8,14.3 14.6,14.3" ${_sf(c)}/>`,

  radar: c => `
      ${_brackets(c)}
      <path d="M9,15 A 7,7 0 0 1 21,8" ${_s(c)}/>
      <line x1="9" y1="15" x2="21" y2="8" ${_s(c)} opacity="0.55"/>
      <line x1="15" y1="11.5" x2="17.5" y2="13.2" ${_s(c)}/>
      <circle cx="17.8" cy="13.4" r="0.9" ${_sf(c)}/>
      <line x1="14" y1="14.5" x2="14" y2="22" ${_s(c)}/>
      <line x1="14" y1="22" x2="11" y2="23" ${_s(c)}/>
      <line x1="14" y1="22" x2="17" y2="23" ${_s(c)}/>
      <line x1="9" y1="23.5" x2="23" y2="23.5" ${_s(c)} opacity="0.55"/>`,

  depot: c => `
      ${_brackets(c)}
      <path d="M9,12 L10.5,9 L12,12 L12,20 L9,20 Z" ${_s(c)}/>
      <line x1="9"    y1="13.2" x2="12"   y2="13.2" ${_s(c)} opacity="0.6"/>
      <line x1="9"    y1="18"   x2="12"   y2="18"   ${_s(c)} opacity="0.6"/>
      <path d="M14.5,12 L16,9 L17.5,12 L17.5,20 L14.5,20 Z" ${_sFilled(c, 0.22)}/>
      <line x1="14.5" y1="13.2" x2="17.5" y2="13.2" ${_s(c)} opacity="0.6"/>
      <line x1="14.5" y1="18"   x2="17.5" y2="18"   ${_s(c)} opacity="0.6"/>
      <path d="M20,12 L21.5,9 L23,12 L23,20 L20,20 Z" ${_s(c)}/>
      <line x1="20"   y1="13.2" x2="23"   y2="13.2" ${_s(c)} opacity="0.6"/>
      <line x1="20"   y1="18"   x2="23"   y2="18"   ${_s(c)} opacity="0.6"/>
      <line x1="8" y1="22" x2="24" y2="22" ${_s(c)}/>`,

  drone: c => `
      ${_brackets(c)}
      <path d="M16,10 L16,22" ${_s(c)}/>
      <path d="M7,14 L16,16 L25,14" ${_s(c)}/>
      <path d="M11,21 L16,22 L21,21" ${_s(c)}/>
      <circle cx="16" cy="16" r="1.6" ${_sf(c)}/>`,

  // ── ENERGY & INFRASTRUCTURE ────────────────────────────────────────────

  refinery: c => `
      ${_brackets(c)}
      <rect x="11" y="15" width="3" height="8" ${_s(c)}/>
      <rect x="18" y="12" width="3" height="11" ${_s(c)}/>
      <path d="M12.5,12 Q13.5,10 12.5,9 Q11.5,10 12.5,12" ${_s(c)}/>
      <path d="M19.5,9 Q20.5,7 19.5,6 Q18.5,7 19.5,9" ${_s(c)}/>
      <line x1="9" y1="23" x2="23" y2="23" ${_s(c)}/>`,

  gas: c => `
      ${_brackets(c)}
      <circle cx="16" cy="16" r="6.5" ${_s(c)}/>
      <path d="M10,16 Q13,13 16,16 T22,16" ${_s(c)}/>
      <line x1="16" y1="9.5"  x2="16" y2="11.5" ${_s(c)}/>
      <line x1="16" y1="20.5" x2="16" y2="22.5" ${_s(c)}/>`,

  power: c => `
      ${_brackets(c)}
      <path d="M11,23 L12.5,11 L19.5,11 L21,23 Z" ${_s(c)}/>
      <line x1="11.7" y1="18" x2="20.3" y2="18" ${_s(c)} opacity="0.5"/>
      <path d="M13,9 Q14,7 13,5" ${_s(c)} opacity="0.6"/>
      <path d="M18,9 Q19,7 18,5" ${_s(c)} opacity="0.6"/>`,

  pipeline: c => `
      ${_brackets(c)}
      <line x1="16" y1="9"  x2="16" y2="23" ${_s(c)}/>
      <line x1="9"  y1="16" x2="23" y2="16" ${_s(c)}/>
      <circle cx="16" cy="16" r="3"   ${_sFilled(c, 0.22)}/>
      <circle cx="16" cy="9"  r="1.4" ${_sf(c)}/>
      <circle cx="16" cy="23" r="1.4" ${_sf(c)}/>
      <circle cx="9"  cy="16" r="1.4" ${_sf(c)}/>
      <circle cx="23" cy="16" r="1.4" ${_sf(c)}/>`,

  fuel: c => `
      ${_brackets(c)}
      <ellipse cx="13" cy="11" rx="3"   ry="1.3" ${_s(c)}/>
      <line x1="10"  y1="11" x2="10"  y2="22" ${_s(c)}/>
      <line x1="16"  y1="11" x2="16"  y2="22" ${_s(c)}/>
      <ellipse cx="13" cy="22" rx="3"   ry="1.3" ${_s(c)}/>
      <ellipse cx="21" cy="14" rx="2.5" ry="1.1" ${_s(c)}/>
      <line x1="18.5" y1="14" x2="18.5" y2="22" ${_s(c)}/>
      <line x1="23.5" y1="14" x2="23.5" y2="22" ${_s(c)}/>
      <ellipse cx="21" cy="22" rx="2.5" ry="1.1" ${_s(c)}/>`,

  substation: c => `
      ${_brackets(c)}
      <path d="M17,9 L12,17 L15.5,17 L13.5,23 L20,14 L16.5,14 L18,9 Z" ${_sFilled(c, 0.18)}/>
      <line x1="9" y1="21" x2="23" y2="21" ${_s(c)} opacity="0.5"/>`,

  // ── STRATEGIC ──────────────────────────────────────────────────────────

  c2: c => `
      ${_brackets(c)}
      <rect x="12" y="16" width="8" height="7" ${_s(c)}/>
      <line x1="16" y1="16" x2="16" y2="8" ${_s(c)}/>
      <path d="M12,10 Q16,8 20,10" ${_s(c)}/>
      <path d="M13.5,12 Q16,11 18.5,12" ${_s(c)}/>
      <circle cx="16" cy="8" r="1.3" ${_sf(c)}/>`,

  intel: c => `
      ${_brackets(c)}
      <path d="M8,16 Q16,9 24,16 Q16,23 8,16 Z" ${_s(c)}/>
      <circle cx="16" cy="16" r="2.8" ${_sFilled(c, 0.22)}/>
      <circle cx="16" cy="16" r="0.9" fill="${_BG}"/>`,

  gov: c => `
      ${_brackets(c)}
      <path d="M9,13 L16,9 L23,13 L23,14 L9,14 Z" ${_s(c)}/>
      <line x1="11" y1="15" x2="11" y2="22" ${_s(c)}/>
      <line x1="15" y1="15" x2="15" y2="22" ${_s(c)}/>
      <line x1="17" y1="15" x2="17" y2="22" ${_s(c)}/>
      <line x1="21" y1="15" x2="21" y2="22" ${_s(c)}/>
      <line x1="8" y1="23.5" x2="24" y2="23.5" ${_s(c)}/>`,

  port: c => `
      ${_brackets(c)}
      <line x1="8" y1="20" x2="24" y2="20" ${_s(c)}/>
      <path d="M8,20 L9,23 M24,20 L23,23" ${_s(c)} opacity="0.5"/>
      <rect x="10" y="14" width="5" height="6" ${_s(c)}/>
      <rect x="17" y="11" width="5" height="9" ${_s(c)}/>
      <line x1="10" y1="17" x2="15" y2="17" ${_s(c)} opacity="0.5"/>
      <line x1="17" y1="14" x2="22" y2="14" ${_s(c)} opacity="0.5"/>
      <line x1="17" y1="17" x2="22" y2="17" ${_s(c)} opacity="0.5"/>`,

  bridge: c => `
      ${_brackets(c)}
      <line x1="8" y1="14" x2="24" y2="14" ${_s(c)}/>
      <path d="M10,14 Q16,21 22,14" ${_s(c)}/>
      <line x1="12" y1="14" x2="12" y2="19.5" ${_s(c)} opacity="0.6"/>
      <line x1="16" y1="14" x2="16" y2="20.5" ${_s(c)} opacity="0.6"/>
      <line x1="20" y1="14" x2="20" y2="19.5" ${_s(c)} opacity="0.6"/>
      <path d="M8,22 Q11,20.5 14,22 T20,22 T24,22" ${_s(c)} opacity="0.5"/>`,

  lab: c => `
      ${_brackets(c)}
      <path d="M13,9 L13,14 L9.5,22 Q9,23 10,23 L22,23 Q23,23 22.5,22 L19,14 L19,9" ${_s(c)}/>
      <line x1="12" y1="9" x2="20" y2="9" ${_s(c)}/>
      <path d="M11.5,18 L20.5,18" ${_s(c)}/>
      <circle cx="14"  cy="20" r="0.9" ${_sf(c)}/>
      <circle cx="17.5" cy="21" r="0.9" ${_sf(c)}/>`,
}

// ─── Static SVG strings with currentColor ────────────────────────────────
// Use these in React components — set `color: #hex` on the parent element
// and the SVG inherits it. Fills use fill-opacity so they also inherit color.
export const SITE_ICONS = Object.fromEntries(
  Object.entries(GLYPHS).map(([id, glyph]) => [
    id,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%" style="display:block" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="square">${glyph('currentColor')}</svg>`,
  ])
)

// ─── Metadata ─────────────────────────────────────────────────────────────
export const SITE_ICON_META = {
  missile:    { name: 'MISSILE / SSM',       desc: 'ballistic · launcher · garrison',      group: 'strike'    },
  naval:      { name: 'NAVAL · BASE',         desc: 'ports · docks · fleet anchorage',      group: 'strike'    },
  airbase:    { name: 'AIRBASE',              desc: 'fixed-wing · ISR · tankers',           group: 'strike'    },
  nuclear:    { name: 'NUCLEAR',              desc: 'reactors · enrichment · warheads',     group: 'strike'    },
  facility:   { name: 'MIL FACILITY',         desc: 'garrison · HQ · complex',             group: 'strike'    },
  command:    { name: 'COMMAND',              desc: 'HQ · elite unit · command authority',  group: 'strike'    },
  radar:      { name: 'RADAR / SAM',          desc: 'air-defense · early warning',          group: 'strike'    },
  depot:      { name: 'MUNITIONS DEPOT',      desc: 'ammo · storage · logistics',           group: 'strike'    },
  drone:      { name: 'DRONE · UAV',          desc: 'UAV base · loitering munitions',       group: 'strike'    },
  refinery:   { name: 'OIL REFINERY',         desc: 'crude processing · downstream',        group: 'energy'    },
  gas:        { name: 'GAS TERMINAL',         desc: 'LNG · storage · export',               group: 'energy'    },
  power:      { name: 'POWER PLANT',          desc: 'generation · grid source',             group: 'energy'    },
  pipeline:   { name: 'PIPELINE NODE',        desc: 'junction · pump · metering',           group: 'energy'    },
  fuel:       { name: 'FUEL DEPOT',           desc: 'POL · tank farm · aviation fuel',      group: 'energy'    },
  substation: { name: 'SUBSTATION',           desc: 'transformer · switchgear',             group: 'energy'    },
  c2:         { name: 'C2 · COMMAND',         desc: 'joint ops · theater HQ',               group: 'strategic' },
  intel:      { name: 'INTELLIGENCE',         desc: 'MOIS · agency · analysis',             group: 'strategic' },
  gov:        { name: 'GOVERNMENT',           desc: 'ministry · parliament · palace',       group: 'strategic' },
  port:       { name: 'PORT · HARBOR',        desc: 'commercial · mil · logistics',         group: 'strategic' },
  bridge:     { name: 'BRIDGE · CHOKEPOINT',  desc: 'strait · tunnel · span',               group: 'strategic' },
  lab:        { name: 'RESEARCH · LAB',       desc: 'weapons R&D · enrichment ops',         group: 'strategic' },
}

// Ordered list matching HTML section order (strike → energy → strategic)
export const ICON_IDS = [
  'missile','naval','airbase','nuclear','facility','command','radar','depot','drone',
  'refinery','gas','power','pipeline','fuel','substation',
  'c2','intel','gov','port','bridge','lab',
]

// ─── Programmatic renderer ────────────────────────────────────────────────
// Returns a complete <svg> string with fills rendered correctly for any hex color.
// state: 'nominal' | 'elevated' | 'critical' | 'dormant' — overrides color if provided.
// destroyed: adds diagonal X overstrike (auto-applied when state='critical').
export function renderSvgString(id, color, size = 32, { state = null } = {}) {
  const glyph = GLYPHS[id]
  if (!glyph) return ''
  const col = color || STATE_COLORS[state] || STATE_COLORS.nominal
  const isDormant = state === 'dormant'
  const inner = isDormant ? `<g opacity="0.72">${glyph(col)}</g>` : glyph(col)
  const xMark = ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" overflow="hidden" fill="none">${inner}${xMark}</svg>`
}

// ─── Leaflet divIcon factory ──────────────────────────────────────────────
// Returns the html string suitable for use in L.divIcon({ html: ... }).
// Wrap in L.divIcon in mapIcons.js — iconLibrary stays Leaflet-free.
// size: px dimension of the square icon. Alerts badge rendered externally.
export function mkSiteIconHtml(id, color, size = 24, { state = null } = {}) {
  const col = color || STATE_COLORS[state] || STATE_COLORS.nominal
  const svg = renderSvgString(id, col, size, { state })
  const isPulse = state === 'critical'
  const pulseRing = isPulse
    ? `<span style="position:absolute;inset:1px;border:1px solid ${col};border-radius:50%;opacity:0.35;pointer-events:none;"></span>`
    : ''
  return `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;">${pulseRing}${svg}</span>`
}

// ─── React inline icon component ─────────────────────────────────────────
// Renders the currentColor SVG for any icon ID in a fixed-size div.
// Set `status` to drive color from STATE_COLORS (defaults to nominal green).
export function InlineIcon({ id, status, size = 16 }) {
  const col = STATE_COLORS[status] || STATE_COLORS.nominal
  return React.createElement('div', {
    dangerouslySetInnerHTML: { __html: SITE_ICONS[id] || SITE_ICONS['facility'] },
    style: { width: size, height: size, flexShrink: 0, color: col, lineHeight: 0, display: 'inline-block' },
  })
}
