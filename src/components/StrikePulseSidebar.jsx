import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { InlineIcon } from '../lib/iconLibrary'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8',
  t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28', br:'#1e2c3a',
}
const STATUS_COL = { DESTROYED: C.r, DAMAGED: C.a, ACTIVE: C.g, UNKNOWN: C.t2 }

export function StrikePulseSidebar({ countryCode, pulseRow, onClose }) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!countryCode) return
    setLoading(true)
    setSites([])
    supabase
      .from('strike_sites')
      .select('id,name,site_type,site_category,status,strike_date,source,geo_confirmed')
      .eq('country_code', countryCode)
      .order('strike_date', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setSites(data || [])
        setLoading(false)
      })
  }, [countryCode])

  const totalCount = pulseRow
    ? (pulseRow.strikes_24h || 0)
    : 0
  const recencyCol = totalCount > 0 ? C.r : C.a

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: C.bg4,
        borderBottom: `1px solid ${C.br}`, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...Z, fontSize: 8, letterSpacing: 3, color: C.t3, marginBottom: 2 }}>
            STRIKE PULSE
          </div>
          <div style={{ ...R, fontSize: 16, fontWeight: 700, color: C.tb, letterSpacing: 1 }}>
            {countryCode}
          </div>
        </div>
        {pulseRow && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...Z, fontSize: 8, color: C.t3, letterSpacing: 1, marginBottom: 2 }}>24H STRIKES</div>
            <div style={{ ...Z, fontSize: 18, fontWeight: 700, color: recencyCol }}>
              {pulseRow.strikes_24h || 0}
            </div>
          </div>
        )}
        <button
          onClick={onClose}
          style={{ ...Z, fontSize: 12, color: C.t2, background: 'transparent', border: `1px solid ${C.br}`, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Pulse counts strip */}
      {pulseRow && (
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${C.br}`,
          flexShrink: 0,
        }}>
          {[['1H', pulseRow.strikes_1h], ['12H', pulseRow.strikes_12h], ['24H', pulseRow.strikes_24h],
            ['48H', pulseRow.strikes_48h], ['72H', pulseRow.strikes_72h], ['7D', pulseRow.strikes_7d]].map(([label, val]) => (
            <div key={label} style={{
              flex: 1, padding: '6px 4px', textAlign: 'center',
              borderRight: `1px solid ${C.br}`,
            }}>
              <div style={{ ...Z, fontSize: 7, color: C.t3, letterSpacing: 1, marginBottom: 2 }}>{label}</div>
              <div style={{ ...Z, fontSize: 11, color: (val || 0) > 0 ? C.a : C.t3 }}>{val || 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Site list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ ...Z, fontSize: 8, color: C.t3, letterSpacing: 2, padding: '8px 14px 4px', borderBottom: `1px solid ${C.br}` }}>
          RECENT STRIKES ({sites.length})
        </div>
        {loading && (
          <div style={{ ...Z, fontSize: 9, color: C.t3, padding: 20 }}>Loading…</div>
        )}
        {!loading && sites.length === 0 && (
          <div style={{ ...Z, fontSize: 9, color: C.t3, padding: 20 }}>No strike sites logged.</div>
        )}
        {sites.map(s => {
          const sc = STATUS_COL[s.status] || C.t2
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderBottom: `1px solid rgba(30,44,58,.4)`,
            }}>
              <InlineIcon id={s.site_type || s.site_category || 'facility'} status={s.status} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  ...R, fontSize: 12, fontWeight: 600, color: C.tb,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {s.name}
                </div>
                <div style={{ ...Z, fontSize: 8, color: C.t2 }}>
                  {s.site_type?.toUpperCase() || '—'} · {s.strike_date || 'Date unknown'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ ...Z, fontSize: 9, color: sc }}>{s.status}</span>
                {s.geo_confirmed && (
                  <span style={{ ...Z, fontSize: 7, color: C.g, border: `1px solid ${C.g}44`, padding: '1px 4px' }}>GEO</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
