import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import { ICAO_COORDS, MC_FLAG_COLORS, KEY_DESTINATIONS, CONUS_BASES } from '../lib/constants'

// Shared popup styles
const S = {
  wrap: { fontFamily: "'Share Tech Mono', monospace", minWidth: 200, fontSize: 11 },
  label: { fontSize: 9, letterSpacing: 2, color: '#4a6070', marginBottom: 2 },
  val: { color: '#dceaf0', marginBottom: 6 },
  badge: (flag) => ({
    display: 'inline-block', padding: '2px 6px', fontSize: 9, letterSpacing: 1,
    background: MC_FLAG_COLORS[flag]?.bg || MC_FLAG_COLORS.unknown.bg,
    border: `1px solid ${MC_FLAG_COLORS[flag]?.border || MC_FLAG_COLORS.unknown.border}`,
    color: MC_FLAG_COLORS[flag]?.text || MC_FLAG_COLORS.unknown.text,
  }),
}

function FlightLines({ flights, visible }) {
  if (!visible) return null
  return flights.map(f => {
    const origin = ICAO_COORDS[f.base]
    const dest = ICAO_COORDS[f.destination]
    if (!origin || !dest) return null
    const color = MC_FLAG_COLORS[f.mc_flag]?.text || '#4a6070'
    return (
      <Polyline
        key={f.id + '_line'}
        positions={[origin, dest]}
        pathOptions={{ color, weight: 1, opacity: 0.25, dashArray: '4 4' }}
      />
    )
  })
}

function BaseMarkers({ flights, byBase, onSelect }) {
  const bases = Object.keys(byBase)
  return bases.map(icao => {
    const coords = ICAO_COORDS[icao]
    if (!coords) return null
    const data = byBase[icao]
    const isSurge = data.socom > 3 || data.total > 8
    return (
      <CircleMarker key={icao} center={coords}
        radius={isSurge ? 7 : 5}
        pathOptions={{
          fillColor: data.socom > 0 ? '#a060e8' : '#50a0e8',
          fillOpacity: 0.85,
          color: isSurge ? '#e8d040' : 'transparent',
          weight: isSurge ? 1.5 : 0
        }}
        eventHandlers={{ click: () => onSelect && onSelect(icao) }}>
        <Tooltip permanent={data.total > 5} direction="top" offset={[0, -6]}
          style={{ background: 'none', border: 'none', boxShadow: 'none', padding: 0 }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#dceaf0', letterSpacing: 1 }}>
            {icao} {data.total > 1 ? `×${data.total}` : ''}
          </span>
        </Tooltip>
        <Popup>
          <div style={S.wrap}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dceaf0', marginBottom: 8 }}>{icao}</div>
            <div style={S.label}>TOTAL FLIGHTS</div>
            <div style={S.val}>{data.total}</div>
            <div style={S.label}>ACTIVE</div>
            <div style={S.val}>{data.active}</div>
            {data.socom > 0 && <>
              <div style={S.label}>SOCOM FLAGGED</div>
              <div style={{ ...S.val, color: '#a060e8' }}>{data.socom}</div>
            </>}
            <div style={S.label}>TOP DESTINATION</div>
            <div style={{ ...S.val, color: '#39e0a0' }}>
              {Object.entries(data.dests).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'}
            </div>
          </div>
        </Popup>
      </CircleMarker>
    )
  })
}

function DestMarkers({ byDest }) {
  return Object.entries(byDest).map(([icao, data]) => {
    const coords = ICAO_COORDS[icao]
    if (!coords) return null
    const isHot = data.socom > 2 || data.total > 6
    return (
      <CircleMarker key={icao + '_dest'} center={coords}
        radius={isHot ? 8 : 5}
        pathOptions={{
          fillColor: '#39e0a0',
          fillOpacity: 0.7,
          color: isHot ? '#e8d040' : '#39e0a060',
          weight: isHot ? 2 : 1
        }}>
        <Tooltip permanent={data.total > 4} direction="top" offset={[0, -6]}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#39e0a0', letterSpacing: 1 }}>
            {icao} ↓{data.total}
          </span>
        </Tooltip>
        <Popup>
          <div style={S.wrap}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#39e0a0', marginBottom: 8 }}>{icao} — DESTINATION</div>
            <div style={S.label}>INBOUND FLIGHTS</div>
            <div style={S.val}>{data.total}</div>
            {data.socom > 0 && <>
              <div style={S.label}>SOCOM MISSIONS</div>
              <div style={{ ...S.val, color: '#a060e8' }}>{data.socom}</div>
            </>}
            <div style={S.label}>ORIGINATING FROM</div>
            {Object.entries(data.origins).sort((a,b)=>b[1]-a[1]).map(([b,c]) => (
              <div key={b} style={{ color: '#50a0e8', fontSize: 10 }}>{b} ×{c}</div>
            ))}
          </div>
        </Popup>
      </CircleMarker>
    )
  })
}

export function TacticalMap({ flights, byBase, byDest, layers, onBaseSelect }) {
  return (
    <MapContainer
      center={[32, 42]}
      zoom={4}
      style={{ flex: 1, background: '#07090b' }}
      zoomControl={true}
      attributionControl={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

      {layers.routes && <FlightLines flights={flights} visible={true} />}
      {layers.bases  && <BaseMarkers flights={flights} byBase={byBase} onSelect={onBaseSelect} />}
      {layers.dests  && <DestMarkers byDest={byDest} />}
    </MapContainer>
  )
}
