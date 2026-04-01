import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MC_FLAG_COLORS, STATUS_COLORS } from '../lib/constants'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const KNOWN_NAMES = {
  KSVN:'Hunter AAF', KPOB:'Pope Field', KHOP:'Campbell AAF', KGRF:'Gray AAF (JBLM)',
  KTCM:'McChord AFB', KNTU:'NAS Oceana', KHRT:'Hurlburt Field', KMCF:'MacDill AFB',
  KCHS:'Charleston AFB', KDOV:'Dover AFB', KSUU:'Travis AFB', KNKX:'MCAS Miramar',
  LLOV:'Ovda AB (Israel)', OJKA:'King Abdullah II AB (Jordan)', OJMS:'Muwaffaq Salti AB (Jordan)',
  OKAS:'Ali Al Salem AB (Kuwait)', OMDM:'Al Minhad AB (UAE)', OMAM:'Al Dhafra AB (UAE)',
  OTBH:'Al Udeid AB (Qatar)', ORAA:'Al Asad AB (Iraq)', OEPS:'Prince Sultan AB (KSA)',
  LGEL:'Elefsis AB (Greece)', ETAR:'Ramstein AB (Germany)', LIPA:'Aviano AB (Italy)',
  LTAG:'Incirlik AB (Turkey)', FJDG:'Diego Garcia',
}

export function AirbaseModal({ icao, onClose, userTier }) {
  const [flights, setFlights] = useState([])
  const [unit, setUnit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('flights')

  useEffect(() => {
    if (!icao) return
    setLoading(true)

    Promise.all([
      supabase.from('amc_flights').select('*')
        .or(`base.eq.${icao},destination.eq.${icao}`)
        .order('dep_date', { ascending: false })
        .limit(100),
      supabase.from('unit_assignments').select('*')
        .eq('base_icao', icao)
        .is('valid_until', null)
        .limit(1)
    ]).then(([{ data: fl }, { data: un }]) => {
      setFlights(fl || [])
      setUnit(un?.[0] || null)
      setLoading(false)
    })
  }, [icao])

  if (!icao) return null

  const outbound = flights.filter(f => f.base === icao)
  const inbound  = flights.filter(f => f.destination === icao)
  const socom    = flights.filter(f => f.mc_flag === 'socom')

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 420,
      background: 'rgba(7,9,11,.97)', borderLeft: '1px solid #1e2c3a',
      zIndex: 900, display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(12px)',
    }} className="fade-in">
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2c3a', display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...Z, fontSize: 18, fontWeight: 700, color: '#dceaf0', letterSpacing: 2 }}>{icao}</div>
          <div style={{ fontSize: 11, color: '#4a6070', marginTop: 2 }}>{KNOWN_NAMES[icao] || 'Unknown facility'}</div>
          {unit && (
            <div style={{ ...Z, fontSize: 10, color: '#50a0e8', marginTop: 4 }}>
              {unit.unit_short} · {unit.parent_command}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, ...Z, fontSize: 10, color: '#4a6070', marginTop: 2 }}>
          <span>{outbound.length} OUT</span>
          <span style={{ color: '#39e0a0' }}>{inbound.length} IN</span>
          {socom.length > 0 && <span style={{ color: '#a060e8' }}>{socom.length} SOF</span>}
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a6070', cursor: 'pointer', fontSize: 18, marginLeft: 12, lineHeight: 1 }}>
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2c3a' }}>
        {['flights', 'intel'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              ...Z, fontSize: 9, letterSpacing: 2, padding: '8px 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? '#dceaf0' : '#4a6070',
              borderBottom: tab === t ? '2px solid #39e0a0' : '2px solid transparent',
            }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, ...Z, fontSize: 10, color: '#2e4050' }}>Loading...</div>
        ) : tab === 'flights' ? (
          <FlightsTab flights={flights} icao={icao} />
        ) : (
          <IntelTab icao={icao} unit={unit} />
        )}
      </div>
    </div>
  )
}

function FlightsTab({ flights, icao }) {
  if (!flights.length) return (
    <div style={{ padding: 20, fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#2e4050' }}>
      NO FLIGHT RECORDS
    </div>
  )
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr style={{ background: '#0a0e14' }}>
          {['DATE','CS','MISSION CODE','DIR','FLAG'].map(h => (
            <th key={h} style={{ padding: '6px 10px', ...Z, fontSize: 8, letterSpacing: 2, color: '#2e4050', textAlign: 'left' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {flights.map(f => {
          const col = MC_FLAG_COLORS[f.mc_flag] || MC_FLAG_COLORS.unknown
          const dir = f.base === icao ? '↑' : '↓'
          return (
            <tr key={f.id} style={{ borderBottom: '1px solid rgba(30,44,58,.4)' }}>
              <td style={{ padding: '5px 10px', ...Z, color: '#2e4050', fontSize: 10 }}>{f.dep_date?.slice(5) || '—'}</td>
              <td style={{ padding: '5px 10px', ...Z, color: '#dceaf0', fontWeight: 600 }}>{f.callsign}</td>
              <td style={{ padding: '5px 10px', ...Z, fontSize: 10, color: '#b8ccd8', letterSpacing: '.3px' }}>{f.mission_code}</td>
              <td style={{ padding: '5px 10px', ...Z, color: dir === '↑' ? '#50a0e8' : '#39e0a0', fontWeight: 700 }}>{dir}</td>
              <td style={{ padding: '5px 10px' }}>
                <span style={{ ...col, padding: '1px 5px', fontSize: 8, letterSpacing: .5 }}>{(f.mc_flag||'amc').toUpperCase()}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function IntelTab({ icao, unit }) {
  return (
    <div style={{ padding: 16 }}>
      {unit ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 3, color: '#4a6070', marginBottom: 10 }}>CURRENT ASSIGNMENT</div>
          <div style={{ fontSize: 13, color: '#dceaf0', marginBottom: 4 }}>{unit.unit_name}</div>
          <div style={{ ...Z, fontSize: 10, color: '#50a0e8', marginBottom: 4 }}>{unit.unit_short}</div>
          <div style={{ fontSize: 11, color: '#4a6070' }}>{unit.parent_command}</div>
          {unit.valid_from && <div style={{ ...Z, fontSize: 9, color: '#2e4050', marginTop: 6 }}>Since {unit.valid_from}</div>}
          {unit.notes && <div style={{ fontSize: 11, color: '#b8ccd8', marginTop: 10, lineHeight: 1.6 }}>{unit.notes}</div>}
        </div>
      ) : (
        <div style={{ ...Z, fontSize: 10, color: '#2e4050', marginBottom: 16 }}>NO UNIT ASSIGNMENT ON FILE</div>
      )}
    </div>
  )
}
