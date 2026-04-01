import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ICAO_COORDS, MC_FLAG_COLORS } from '../lib/constants'

const S = {
  wrap: { fontFamily: "'Share Tech Mono', monospace", minWidth: 200, fontSize: 11 },
  label: { fontSize: 9, letterSpacing: 2, color: '#4a6070', marginBottom: 2 },
  val: { color: '#dceaf0', marginBottom: 6 },
}

function FlightLines({ flights }) {
  return flights.map(f => {
    const origin = ICAO_COORDS[f.base]
    const dest   = ICAO_COORDS[f.destination]
    if (!origin || !dest) return null
    const color = MC_FLAG_COLORS[f.mc_flag]?.text || '#4a6070'
    return (
      <Polyline key={f.id + '_line'} positions={[origin, dest]}
        pathOptions={{ color, weight: 1, opacity: 0.3, dashArray: '4 4' }} />
    )
  })
}

function BaseMarkers({ flights, byBase, onSelect }) {
  return Object.keys(byBase).map(icao => {
    const coords = ICAO_COORDS[icao]
    if (!coords) return null
    const data  = byBase[icao]
    const surge = data.socom > 3 || data.total > 8
    return (
      <CircleMarker key={icao} center={coords}
        radius={surge ? 8 : 6}
        pathOptions={{
          fillColor: data.socom > 0 ? '#a060e8' : '#50a0e8',
          fillOpacity: 0.9,
          color: surge ? '#e8d040' : 'rgba(255,255,255,0.2)',
          weight: surge ? 2 : 1,
        }}
        eventHandlers={{ click: () => onSelect && onSelect(icao) }}>
        <Tooltip direction="top" offset={[0, -8]} permanent={data.total > 5}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#dceaf0' }}>
            {icao}{data.total > 1 ? ` ×${data.total}` : ''}
          </span>
        </Tooltip>
        <Popup>
          <div style={S.wrap}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dceaf0', marginBottom: 8 }}>{icao}</div>
            <div style={S.label}>TOTAL FLIGHTS</div><div style={S.val}>{data.total}</div>
            <div style={S.label}>ACTIVE</div><div style={S.val}>{data.active}</div>
            {data.socom > 0 && <><div style={S.label}>SOF</div><div style={{ ...S.val, color: '#a060e8' }}>{data.socom}</div></>}
            <div style={S.label}>TOP DEST</div>
            <div style={{ ...S.val, color: '#39e0a0' }}>
              {Object.entries(data.dests).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—'}
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
        radius={isHot ? 9 : 6}
        pathOptions={{
          fillColor: '#39e0a0', fillOpacity: 0.75,
          color: isHot ? '#e8d040' : 'rgba(57,224,160,0.4)',
          weight: isHot ? 2 : 1,
        }}>
        <Tooltip direction="top" offset={[0, -8]} permanent={data.total > 4}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#39e0a0' }}>
            {icao} ↓{data.total}
          </span>
        </Tooltip>
        <Popup>
          <div style={S.wrap}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#39e0a0', marginBottom: 8 }}>{icao} — DEST</div>
            <div style={S.label}>INBOUND</div><div style={S.val}>{data.total}</div>
            {data.socom > 0 && <><div style={S.label}>SOF</div><div style={{ ...S.val, color: '#a060e8' }}>{data.socom}</div></>}
            <div style={S.label}>FROM</div>
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
      center={[28, 42]}
      zoom={3}
      style={{ width: '100%', height: '100%', background: '#07090b' }}
      zoomControl={true}
      attributionControl={false}
      preferCanvas={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      {layers.routes && <FlightLines flights={flights} />}
      {layers.bases  && <BaseMarkers flights={flights} byBase={byBase} onSelect={onBaseSelect} />}
      {layers.dests  && <DestMarkers byDest={byDest} />}
    </MapContainer>
  )
}
