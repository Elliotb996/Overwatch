import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

const STATUS_COLOR = {
  DEPLOYED: '#39e0a0', SURGE: '#e8d040', ELEVATED: '#f0a040',
  ACTIVE: '#50a0e8', 'IN PORT': '#4a6070', NMC: '#e85040', INACTIVE: '#1e2c3a'
}

const CENTCOM_COLOR = {
  CRITICAL: '#e85040', HIGH: '#f0a040', MODERATE: '#50a0e8',
  LOW: '#4a6070', NMC: '#e85040', NONE: '#1e2c3a'
}

export function SealiftView({ auth }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    supabase.from('assets').select('*, csg_ships(*)').order('status')
      .then(({ data }) => { setAssets(data || []); setLoading(false) })
  }, [])

  const carriers = assets.filter(a => a.asset_type === 'carrier')
  const lmsrs    = assets.filter(a => a.asset_type === 'lmsr')
  const airbases = assets.filter(a => a.asset_type === 'airbase')
  const strikes  = assets.filter(a => a.asset_type === 'strike')
  const manual   = assets.filter(a => a.asset_type === 'manual')

  const filtered = filter === 'all' ? assets
    : filter === 'carrier' ? carriers
    : filter === 'lmsr'    ? lmsrs
    : filter === 'airbase' ? airbases
    : assets.filter(a => a.asset_type === filter)

  const selectedAsset = selected ? assets.find(a => a.id === selected) : null

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: 380, borderRight: '1px solid #1e2c3a', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2c3a' }}>
          <div style={{ ...Z, fontSize: 11, letterSpacing: 3, color: '#dceaf0', marginBottom: 8 }}>
            FORCE POSTURE — ASSETS
          </div>
          <div style={{ display: 'flex', gap: 12, ...Z, fontSize: 9, color: '#4a6070' }}>
            <span>{carriers.filter(c => c.status === 'DEPLOYED').length} CSG deployed</span>
            <span style={{ color: '#e8d040' }}>{lmsrs.filter(l => l.centcom_relevance === 'CRITICAL' || l.centcom_relevance === 'HIGH').length} LMSR high</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', padding: '0 8px', borderBottom: '1px solid #1e2c3a', overflowX: 'auto' }}>
          {[
            { k: 'all',      label: `ALL (${assets.length})` },
            { k: 'carrier',  label: `CSG (${carriers.length})` },
            { k: 'lmsr',     label: `LMSR (${lmsrs.length})` },
            { k: 'airbase',  label: `AB (${airbases.length})` },
          ].map(({ k, label }) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{
                ...Z, fontSize: 8, letterSpacing: 1.5, padding: '8px 10px',
                background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                color: filter === k ? '#dceaf0' : '#4a6070',
                borderBottom: filter === k ? '2px solid #39e0a0' : '2px solid transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Asset list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, ...Z, fontSize: 10, color: '#2e4050' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, ...Z, fontSize: 10, color: '#2e4050' }}>NO ASSETS ON FILE</div>
          ) : filtered.map(a => (
            <AssetRow key={a.id} asset={a} selected={selected === a.id}
              onClick={() => setSelected(selected === a.id ? null : a.id)} />
          ))}
        </div>
      </div>

      {/* Right — detail */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedAsset ? (
          <AssetDetail asset={selectedAsset} auth={auth} />
        ) : (
          <SealiftSummary carriers={carriers} lmsrs={lmsrs} />
        )}
      </div>
    </div>
  )
}

function AssetRow({ asset, selected, onClick }) {
  const sColor = STATUS_COLOR[asset.status] || '#4a6070'
  const cColor = asset.centcom_relevance ? CENTCOM_COLOR[asset.centcom_relevance] : null

  return (
    <div onClick={onClick}
      style={{
        padding: '10px 16px', cursor: 'pointer',
        background: selected ? 'rgba(80,160,232,.05)' : 'transparent',
        borderBottom: '1px solid rgba(30,44,58,.4)',
        borderLeft: selected ? '2px solid #50a0e8' : '2px solid transparent',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ ...Z, fontSize: 12, color: '#dceaf0', fontWeight: 600 }}>{asset.name}</span>
            {asset.designation && <span style={{ ...Z, fontSize: 9, color: '#4a6070' }}>{asset.designation}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#4a6070' }}>{asset.country}</span>
            {asset.last_location && <span style={{ fontSize: 10, color: '#4a6070' }}>· {asset.last_location}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span style={{ ...Z, fontSize: 9, letterSpacing: 1, color: sColor }}>{asset.status}</span>
          {cColor && asset.centcom_relevance !== 'NONE' && (
            <span style={{ ...Z, fontSize: 8, letterSpacing: 1, color: cColor }}>{asset.centcom_relevance}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function AssetDetail({ asset, auth }) {
  const [sightings, setSightings] = useState([])
  useEffect(() => {
    supabase.from('ship_sightings').select('*').eq('asset_id', asset.id)
      .order('sighting_date', { ascending: false }).limit(10)
      .then(({ data }) => setSightings(data || []))
  }, [asset.id])

  const sColor = STATUS_COLOR[asset.status] || '#4a6070'

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2c3a' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...Z, fontSize: 20, color: '#dceaf0', fontWeight: 700 }}>{asset.name}</div>
            {asset.designation && <div style={{ ...Z, fontSize: 12, color: '#4a6070', marginTop: 2 }}>{asset.designation}</div>}
            {asset.ship_class && <div style={{ fontSize: 11, color: '#4a6070', marginTop: 2 }}>{asset.ship_class}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...Z, fontSize: 11, color: sColor, letterSpacing: 1 }}>{asset.status}</div>
            {asset.centcom_relevance && asset.centcom_relevance !== 'NONE' && (
              <div style={{ ...Z, fontSize: 9, color: CENTCOM_COLOR[asset.centcom_relevance], marginTop: 3, letterSpacing: 1 }}>
                CENTCOM: {asset.centcom_relevance}
              </div>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          {asset.last_location && <Meta label="LAST LOCATION" value={asset.last_location} />}
          {asset.last_report_date && <Meta label="LAST REPORT" value={asset.last_report_date} />}
          {asset.lmsr_category && <Meta label="CATEGORY" value={asset.lmsr_category.toUpperCase()} />}
          {asset.hull_number && <Meta label="HULL" value={asset.hull_number} />}
          {asset.csg_designation && <Meta label="CSG" value={asset.csg_designation} />}
          {asset.air_wing && <Meta label="AIR WING" value={asset.air_wing} />}
        </div>
      </div>

      {/* Aircraft types */}
      {asset.aircraft_types?.length > 0 && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e2c3a' }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#2e4050', marginBottom: 8 }}>AIRCRAFT TYPES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {asset.aircraft_types.map(t => (
              <span key={t} style={{ ...Z, fontSize: 9, padding: '3px 8px', border: '1px solid #1e2c3a', color: '#b8ccd8' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* CSG ships */}
      {asset.csg_ships?.length > 0 && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e2c3a' }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#2e4050', marginBottom: 8 }}>STRIKE GROUP COMPOSITION</div>
          {asset.csg_ships.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 11 }}>
              <span style={{ ...Z, color: '#50a0e8', width: 140 }}>{s.designation}</span>
              <span style={{ color: '#b8ccd8' }}>{s.name}</span>
              <span style={{ color: '#4a6070', marginLeft: 'auto' }}>{s.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Intel assessment */}
      {asset.intel_assessment && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e2c3a' }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#2e4050', marginBottom: 8 }}>INTEL ASSESSMENT</div>
          <div style={{ fontSize: 11, color: '#b8ccd8', lineHeight: 1.7 }}>{asset.intel_assessment}</div>
        </div>
      )}

      {/* Notes */}
      {asset.notes && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e2c3a' }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#2e4050', marginBottom: 8 }}>NOTES</div>
          <div style={{ fontSize: 11, color: '#4a6070', lineHeight: 1.6 }}>{asset.notes}</div>
        </div>
      )}

      {/* Sightings */}
      {sightings.length > 0 && (
        <div style={{ padding: '14px 24px' }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#2e4050', marginBottom: 10 }}>RECENT SIGHTINGS</div>
          {sightings.map(s => (
            <div key={s.id} style={{ marginBottom: 10, padding: '8px 12px', background: '#0a0e14', borderLeft: '2px solid #1e2c3a' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                <span style={{ ...Z, fontSize: 9, color: '#2e4050' }}>{s.sighting_date}</span>
                <span style={{ ...Z, fontSize: 9, color: '#4a6070' }}>{s.source}</span>
              </div>
              {s.description && <div style={{ fontSize: 11, color: '#b8ccd8' }}>{s.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, letterSpacing: 2, color: '#2e4050', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#b8ccd8' }}>{value}</div>
    </div>
  )
}

function SealiftSummary({ carriers, lmsrs }) {
  const deployed = carriers.filter(c => ['DEPLOYED','SURGE','ELEVATED'].includes(c.status))
  const critLmsr = lmsrs.filter(l => ['CRITICAL','HIGH'].includes(l.centcom_relevance))

  return (
    <div style={{ padding: 32 }}>
      <div style={{ ...Z, fontSize: 9, letterSpacing: 3, color: '#2e4050', marginBottom: 20 }}>FORCE POSTURE SUMMARY</div>

      <SummarySection title="CARRIER STRIKE GROUPS — DEPLOYED">
        {deployed.length === 0
          ? <div style={{ fontSize: 11, color: '#2e4050' }}>No deployed CSGs on file</div>
          : deployed.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 11 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#dceaf0', width: 160 }}>{c.name}</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#4a6070' }}>{c.designation}</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: STATUS_COLOR[c.status], marginLeft: 'auto' }}>{c.status}</span>
            </div>
          ))
        }
      </SummarySection>

      <SummarySection title="LMSR — CRITICAL/HIGH RELEVANCE">
        {critLmsr.length === 0
          ? <div style={{ fontSize: 11, color: '#2e4050' }}>No high-relevance LMSR on file</div>
          : critLmsr.map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 11 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#dceaf0', width: 200 }}>{l.name}</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#4a6070' }}>{l.last_location || '—'}</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: CENTCOM_COLOR[l.centcom_relevance], marginLeft: 'auto' }}>{l.centcom_relevance}</span>
            </div>
          ))
        }
      </SummarySection>

      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#1e2c3a', marginTop: 24 }}>
        SELECT AN ASSET FOR DETAIL VIEW
      </div>
    </div>
  )
}

function SummarySection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: 3, color: '#2e4050', marginBottom: 10, borderBottom: '1px solid #1e2c3a', paddingBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
