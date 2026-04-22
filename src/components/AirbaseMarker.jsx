// src/components/AirbaseMarker.jsx
// OVERWATCH airbase/airport map marker.
// - Corner-ticked square glyph, state-colored, no letters.
// - Optional alert-count badge ("+N") top-right.
// - Hover reveals a portalled tooltip (escapes all parent stacking contexts).
// - Pure React + SVG; no external UI deps.

import { useState, useId, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const STATE_COLORS = {
  nominal:  '#39e0a0',
  elevated: '#f0a040',
  dormant:  '#4a6070',
}
const STATE_FILL = {
  nominal:  'rgba(57,224,160,0.08)',
  elevated: 'rgba(240,160,64,0.08)',
  dormant:  'transparent',
}
const STATE_LABEL = {
  nominal:  'NOMINAL',
  elevated: 'ELEVATED',
  dormant:  'DORMANT',
}

const INK          = '#07090b'
const PANEL        = '#0c1018'
const BORDER_LIGHT = '#2e3f52'
const TEXT_BRIGHT  = '#dceaf0'
const TEXT_DEEP    = '#4a6070'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }

/**
 * @param {object} p
 * @param {string} p.name     Airfield name
 * @param {string} p.code     ICAO (or IATA) code
 * @param {'nominal'|'elevated'|'dormant'} [p.status='nominal']
 * @param {number} [p.alerts=0] "+N" badge top-right when > 0
 * @param {string} [p.region] Region line in tooltip
 * @param {number} [p.flights7d] Flights-in-last-7-days in tooltip
 * @param {number} [p.size=20] Glyph size in px
 * @param {'top'|'bottom'|'left'|'right'} [p.tooltipSide='top']
 * @param {(e:React.MouseEvent)=>void} [p.onClick]
 */
export function AirbaseMarker({
  name, code, status = 'nominal', alerts = 0,
  region, flights7d, size = 20, tooltipSide = 'top', onClick,
}) {
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const tipId = useId()
  const rootRef = useRef(null)
  const open = hover || focused

  const color = STATE_COLORS[status] ?? STATE_COLORS.nominal
  const fill  = STATE_FILL[status]   ?? STATE_FILL.nominal

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: size, height: size,
        cursor: onClick ? 'pointer' : 'default',
        // Only raise z while open — avoids creating idle stacking contexts that
        // compete with the portalled tooltip.
        zIndex: open ? 10 : 'auto',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : 'img'}
      aria-label={`${name} (${code}) — ${STATE_LABEL[status]}${alerts ? `, ${alerts} alerts` : ''}`}
      aria-describedby={open ? tipId : undefined}
    >
      <svg viewBox="0 0 20 20" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
        <rect x="4" y="4" width="12" height="12" fill={fill} stroke={color} strokeWidth="1"/>
        <path d="M1,1 L4,1 M1,1 L1,4 M19,1 L16,1 M19,1 L19,4 M1,19 L4,19 M1,19 L1,16 M19,19 L16,19 M19,19 L19,16"
              stroke={color} strokeWidth="1" fill="none"/>
        <circle cx="10" cy="10" r="1.6" fill={color}/>
        {open && status !== 'dormant' && (
          <circle cx="10" cy="10" fill="none" stroke={color} strokeWidth="1" opacity="0.45">
            <animate attributeName="r" from="6" to="14" dur="1.6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" repeatCount="indefinite"/>
          </circle>
        )}
      </svg>

      {alerts > 0 && (
        <div style={{
          position: 'absolute', top: -8, right: -10,
          minWidth: 20, height: 14, padding: '0 4px',
          background: color, color: INK,
          ...Z, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${INK}`, pointerEvents: 'none',
        }}>
          +{alerts}
        </div>
      )}

      {open && (
        <TooltipPortal
          id={tipId} anchorRef={rootRef} side={tooltipSide}
          name={name} code={code} status={status}
          region={region} flights7d={flights7d} color={color}
        />
      )}
    </div>
  )
}

function TooltipPortal({ id, anchorRef, side, name, code, status, region, flights7d, color }) {
  const [coords, setCoords] = useState(null)

  useLayoutEffect(() => {
    function update() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setCoords({
        cx: r.left + r.width / 2, cy: r.top + r.height / 2,
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorRef])

  if (!coords || typeof document === 'undefined') return null

  const OFFSET = 12
  const style = { position: 'fixed', zIndex: 2147483647, pointerEvents: 'none' }
  switch (side) {
    case 'bottom':
      style.top = coords.bottom + OFFSET; style.left = coords.cx
      style.transform = 'translateX(-50%)'; break
    case 'left':
      style.top = coords.cy; style.left = coords.left - OFFSET
      style.transform = 'translate(-100%, -50%)'; break
    case 'right':
      style.top = coords.cy; style.left = coords.right + OFFSET
      style.transform = 'translateY(-50%)'; break
    case 'top':
    default:
      style.top = coords.top - OFFSET; style.left = coords.cx
      style.transform = 'translate(-50%, -100%)'
  }

  return createPortal(
    <div id={id} role="tooltip" style={style}>
      <div style={{
        minWidth: 180,
        background: PANEL,
        border: `1px solid ${BORDER_LIGHT}`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.35)',
        padding: '9px 12px 10px',
        whiteSpace: 'nowrap',
        borderLeft: `2px solid ${color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
          <span style={{ ...Z, fontSize: 11, letterSpacing: 2, color }}>{code}</span>
          <span style={{
            marginLeft: 'auto', ...Z, fontSize: 8, letterSpacing: 2,
            padding: '2px 6px', color, border: `1px solid ${color}`, opacity: 0.85,
          }}>{STATE_LABEL[status]}</span>
        </div>
        <div style={{
          ...R, fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
          color: TEXT_BRIGHT,
          marginBottom: region || typeof flights7d === 'number' ? 7 : 0,
        }}>
          {name}
        </div>
        {region && <MetaRow label="REGION" value={region} />}
        {typeof flights7d === 'number' && (
          <MetaRow label="LAST 7 DAYS" value={`${flights7d.toLocaleString()} flights`} />
        )}
      </div>
    </div>,
    document.body
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 20, lineHeight: 1.75,
    }}>
      <span style={{ ...Z, fontSize: 9, letterSpacing: 1.5, color: TEXT_DEEP }}>{label}</span>
      <span style={{ ...R, fontSize: 12, fontWeight: 500, letterSpacing: 0.5, color: TEXT_BRIGHT }}>{value}</span>
    </div>
  )
}
