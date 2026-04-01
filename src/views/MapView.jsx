import { useState } from 'react'
import { useFlights } from '../hooks/useFlights'
import { TacticalMap } from '../components/TacticalMap'
import { LayerToggles } from '../components/LayerToggles'
import { AirbaseModal } from '../components/AirbaseModal'
import { SignactFeed } from '../components/SignactFeed'
import { MC_FLAG_COLORS } from '../lib/constants'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

export function MapView({ auth }) {
  const { flights, byBase, byDest, loading } = useFlights({ limit: 500 })
  const [layers, setLayers] = useState({ bases: true, dests: true, routes: true })
  const [selectedBase, setSelectedBase] = useState(null)
  const [filter, setFilter] = useState('all')

  const filteredFlights = filter === 'all' ? flights : flights.filter(f => f.mc_flag === filter)
  const filteredByBase  = Object.fromEntries(
    Object.entries(byBase).map(([k, v]) => [k, {
      ...v,
      total:  filter === 'all' ? v.total  : filteredFlights.filter(f => f.base === k).length,
      active: filter === 'all' ? v.active : filteredFlights.filter(f => f.base === k && f.status === 'ACTIVE').length,
      socom:  v.socom,
    }]).filter(([, v]) => v.total > 0)
  )
  const filteredByDest = Object.fromEntries(
    Object.entries(byDest).map(([k, v]) => [k, {
      ...v,
      total: filter === 'all' ? v.total : filteredFlights.filter(f => f.destination === k).length,
      socom: v.socom,
    }]).filter(([, v]) => v.total > 0)
  )

  // Summary stats
  const totalActive = flights.filter(f => f.status === 'ACTIVE').length
  const socomCount  = flights.filter(f => f.mc_flag === 'socom').length
  const destCount   = Object.keys(byDest).length

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 800,
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'rgba(7,9,11,.85)', borderBottom: '1px solid #1e2c3a',
        backdropFilter: 'blur(8px)', padding: '0 12px',
      }}>
        {/* Stats */}
        <Stat label="ACTIVE" value={totalActive} color="#39e0a0" />
        <Stat label="SOF FLAGGED" value={socomCount} color="#a060e8" />
        <Stat label="DESTINATIONS" value={destCount} color="#50a0e8" />
        <Stat label="TOTAL" value={flights.length} color="#4a6070" />

        <div style={{ width: 1, height: 24, background: '#1e2c3a', margin: '0 12px' }} />

        {/* Filter */}
        {['all','socom','amc','marine','ang','afrc'].map(f => {
          const col = f === 'all' ? '#dceaf0' : MC_FLAG_COLORS[f]?.text || '#4a6070'
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                ...Z, fontSize: 9, letterSpacing: 1.5, padding: '8px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: filter === f ? col : '#2e3f52',
                borderBottom: filter === f ? `2px solid ${col}` : '2px solid transparent',
              }}>
              {f.toUpperCase()}
            </button>
          )
        })}

        {loading && (
          <span style={{ ...Z, fontSize: 9, color: '#2e4050', marginLeft: 12, letterSpacing: 2 }}>UPDATING...</span>
        )}
      </div>

      {/* Map */}
      <div style={{ position: 'absolute', top: 37, left: 0, right: 0, bottom: 0 }}>
        <TacticalMap
          flights={filteredFlights}
          byBase={filteredByBase}
          byDest={filteredByDest}
          layers={layers}
          onBaseSelect={setSelectedBase}
        />
      </div>

      {/* Layer toggles */}
      <LayerToggles layers={layers} setLayers={setLayers} />

      {/* SIGACT feed */}
      <SignactFeed auth={auth} />

      {/* Base detail modal */}
      {selectedBase && (
        <AirbaseModal
          icao={selectedBase}
          onClose={() => setSelectedBase(null)}
          userTier={auth.tier}
        />
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '6px 14px', borderRight: '1px solid #1e2c3a' }}>
      <div style={{ ...Z, fontSize: 8, letterSpacing: 2, color: '#2e4050', marginBottom: 1 }}>{label}</div>
      <div style={{ ...Z, fontSize: 16, color, fontWeight: 700, lineHeight: 1 }}>{value}</div>
    </div>
  )
}
