// src/admin/FlightEditor.jsx
// Spreadsheet-style table for adding / editing AMC flights
// Accessible at /admin/flights (admin tier only)

import { useState } from 'react'
import { useFlights, useFlightMutations } from '../hooks/useFlights'

const MC_FLAGS   = ['amc', 'socom', 'marine', 'ang', 'afrc', 'unknown']
const STATUSES   = ['ACTIVE', 'COMPLETE', 'PENDING', 'CANCELLED']
const DEST_BASES = ['LLOV','OJKA','OKAS','OMDM','OTBH','LGEL','ETAR']
const CONUS_BASES = ['KPOB','KSVN','KCVS','KHOP','KGRF','KNTU','KTCM','KHRT','KNKX']

const EMPTY_FLIGHT = {
  base: '', dep_date: '', callsign: '', hex: '', serial: '',
  mission_code: '', first_hop: '', via: 'ETAR', destination: '',
  return_mc: '', status: 'ACTIVE', notes: ''
}

export function FlightEditor() {
  const { flights, loading, refetch } = useFlights({ limit: 200 })
  const { addFlight, updateFlight, deleteFlight } = useFlightMutations()

  const [adding,   setAdding]   = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState(EMPTY_FLIGHT)
  const [saving,   setSaving]   = useState(false)
  const [filter,   setFilter]   = useState({ base: '', dest: '', flag: '' })

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSave() {
    setSaving(true)
    try {
      if (editId) {
        await updateFlight(editId, form)
      } else {
        await addFlight(form)
      }
      setAdding(false); setEditId(null); setForm(EMPTY_FLIGHT)
      refetch()
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this flight record?')) return
    await deleteFlight(id)
    refetch()
  }

  function startEdit(f) {
    setEditId(f.id)
    setForm({
      base: f.base, dep_date: f.dep_date, callsign: f.callsign,
      hex: f.hex, serial: f.serial, mission_code: f.mission_code,
      first_hop: f.first_hop, via: f.via, destination: f.destination,
      return_mc: f.return_mc, status: f.status, notes: f.notes || ''
    })
    setAdding(true)
  }

  const filtered = flights.filter(f =>
    (!filter.base || f.base === filter.base) &&
    (!filter.dest || f.destination === filter.dest) &&
    (!filter.flag || f.mc_flag === filter.flag)
  )

  return (
    <div style={{ padding: '20px', fontFamily: "'Exo 2', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, color: '#dceaf0', margin: 0 }}>AMC FLIGHT RECORDS</h2>
        <span style={{ background: '#1c2530', color: '#4a6070', padding: '2px 8px', fontFamily: 'monospace', fontSize: 11 }}>
          {filtered.length} records
        </span>
        <button onClick={() => { setAdding(true); setEditId(null); setForm(EMPTY_FLIGHT) }}
          style={{ marginLeft: 'auto', padding: '6px 16px', background: 'rgba(57,224,160,.1)', border: '1px solid #39e0a0', color: '#39e0a0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: 2 }}>
          + ADD FLIGHT
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'ORIGIN', key: 'base', opts: ['', ...CONUS_BASES] },
          { label: 'DEST',   key: 'dest', opts: ['', ...DEST_BASES] },
          { label: 'MC FLAG', key: 'flag', opts: ['', ...MC_FLAGS] },
        ].map(({ label, key, opts }) => (
          <select key={key} value={filter[key]}
            onChange={e => setFilter(f => ({ ...f, [key]: e.target.value }))}
            style={{ background: '#0c1018', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
            <option value="">{label}: ALL</option>
            {opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Add / Edit form */}
      {adding && (
        <div style={{ background: '#0c1018', border: '1px solid #2e3f52', padding: 16, marginBottom: 16, borderRadius: 2 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#4a6070', marginBottom: 12, fontFamily: 'monospace' }}>
            {editId ? '// EDIT FLIGHT' : '// NEW FLIGHT'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
            {[
              ['ORIGIN (ICAO)', 'base', 'text', 'KSVN'],
              ['DEP DATE', 'dep_date', 'date', ''],
              ['CALLSIGN', 'callsign', 'text', 'RCH335'],
              ['HEX', 'hex', 'text', 'AE0817'],
              ['SERIAL', 'serial', 'text', '00-0181'],
              ['MISSION CODE', 'mission_code', 'text', 'JAM 6519 Y1 069'],
              ['FIRST HOP', 'first_hop', 'text', 'KBGR'],
              ['VIA', 'via', 'text', 'ETAR'],
              ['DESTINATION', 'destination', 'text', 'LLOV'],
              ['RETURN MC', 'return_mc', 'text', ''],
            ].map(([label, field, type, placeholder]) => (
              <div key={field}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: 'monospace', marginBottom: 3 }}>{label}</div>
                <input type={type} value={form[field] || ''} placeholder={placeholder}
                  onChange={e => set(field, e.target.value)}
                  style={{ width: '100%', background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, outline: 'none' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: 'monospace', marginBottom: 3 }}>STATUS</div>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                style={{ width: '100%', background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: 'monospace', marginBottom: 3 }}>NOTES</div>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ width: '100%', background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, outline: 'none', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '7px 20px', border: '1px solid #39e0a0', background: 'rgba(57,224,160,.1)', color: '#39e0a0', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
              {saving ? 'SAVING...' : 'SAVE RECORD'}
            </button>
            <button onClick={() => { setAdding(false); setEditId(null); setForm(EMPTY_FLIGHT) }}
              style={{ padding: '7px 20px', border: '1px solid #1e2c3a', background: 'transparent', color: '#4a6070', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: '#4a6070', fontFamily: 'monospace', fontSize: 11 }}>Loading...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#101620', borderBottom: '1px solid #1e2c3a' }}>
                {['DATE','CS','MISSION CODE','ORIGIN','DEST','VIA','FLAG','STATUS',''].map(h => (
                  <th key={h} style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, color: '#4a6070', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid rgba(30,44,58,.5)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#4a6070' }}>{f.dep_date?.slice(5) || '—'}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: '#dceaf0' }}>{f.callsign}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', letterSpacing: '.3px' }}>{f.mission_code}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#50a0e8' }}>{f.base}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#50a0e8' }}>{f.destination}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#4a6070' }}>{f.via || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{
                      padding: '2px 6px', fontSize: 9, letterSpacing: .5, borderRadius: 1,
                      background: f.mc_flag === 'socom' ? 'rgba(160,96,232,.15)' : f.mc_flag === 'marine' ? 'rgba(232,208,64,.1)' : 'rgba(80,160,232,.12)',
                      color:      f.mc_flag === 'socom' ? '#a060e8' : f.mc_flag === 'marine' ? '#e8d040' : '#50a0e8',
                      border: `1px solid ${f.mc_flag === 'socom' ? 'rgba(160,96,232,.3)' : 'rgba(80,160,232,.25)'}`
                    }}>{(f.mc_flag || 'amc').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: f.status === 'ACTIVE' ? '#39e0a0' : '#324050' }}>{f.status}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <button onClick={() => startEdit(f)}
                      style={{ background: 'none', border: 'none', color: '#f0a040', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>✎</button>
                    <button onClick={() => handleDelete(f.id)}
                      style={{ background: 'none', border: 'none', color: '#e85040', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
