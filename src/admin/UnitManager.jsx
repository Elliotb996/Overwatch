// src/admin/UnitManager.jsx
// Manages unit ↔ base assignments — replaces all hardcoded unit names
// Admin updates this when units rotate; no code changes needed

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CONUS_BASES = [
  { icao: 'KPOB', name: 'Pope Field',    type: 'Army AAF' },
  { icao: 'KSVN', name: 'Hunter AAF',   type: 'Army AAF' },
  { icao: 'KCVS', name: 'Altus AFB',    type: 'AFB' },
  { icao: 'KHOP', name: 'Campbell AAF', type: 'Army AAF' },
  { icao: 'KGRF', name: 'McChord/JBLM', type: 'AFB' },
  { icao: 'KNTU', name: 'NAS Oceana',   type: 'NAS' },
  { icao: 'KTCM', name: 'McChord',      type: 'AFB' },
  { icao: 'KHRT', name: 'Hurlburt Field', type: 'AFB' },
  { icao: 'KNKX', name: 'MCAS Miramar', type: 'MCAS' },
]

export function UnitManager() {
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [editId,      setEditId]      = useState(null)
  const [form,        setForm]        = useState({
    base_icao: '', unit_name: '', unit_short: '', parent_command: '',
    valid_from: '', valid_until: '', notes: ''
  })

  useEffect(() => {
    supabase.from('unit_assignments')
      .select('*')
      .order('base_icao')
      .then(({ data }) => { setAssignments(data || []); setLoading(false) })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    const record = {
      base_icao:      form.base_icao,
      unit_name:      form.unit_name,
      unit_short:     form.unit_short,
      parent_command: form.parent_command,
      valid_from:     form.valid_from || null,
      valid_until:    form.valid_until || null,
      notes:          form.notes,
      updated_at:     new Date().toISOString(),
    }

    if (editId) {
      await supabase.from('unit_assignments').update(record).eq('id', editId)
    } else {
      await supabase.from('unit_assignments').insert([record])
    }

    const { data } = await supabase.from('unit_assignments').select('*').order('base_icao')
    setAssignments(data || [])
    setEditId(null)
    setForm({ base_icao: '', unit_name: '', unit_short: '', parent_command: '', valid_from: '', valid_until: '', notes: '' })
  }

  async function expire(id) {
    await supabase.from('unit_assignments').update({ valid_until: new Date().toISOString().slice(0,10) }).eq('id', id)
    const { data } = await supabase.from('unit_assignments').select('*').order('base_icao')
    setAssignments(data || [])
  }

  // Active = no valid_until or valid_until in future
  const active   = assignments.filter(a => !a.valid_until || a.valid_until > new Date().toISOString().slice(0,10))
  const archived = assignments.filter(a => a.valid_until && a.valid_until <= new Date().toISOString().slice(0,10))

  return (
    <div style={{ padding: 20, fontFamily: "'Exo 2', sans-serif" }}>
      <h2 style={{ fontSize: 18, color: '#dceaf0', marginBottom: 4 }}>UNIT ASSIGNMENTS</h2>
      <p style={{ fontSize: 11, color: '#4a6070', fontFamily: 'monospace', marginBottom: 16 }}>
        Units rotate. Update this table — no code changes needed. Old assignments auto-archive.
      </p>

      {/* Add/Edit form */}
      <div style={{ background: '#0c1018', border: '1px solid #1e2c3a', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={lbl}>BASE (ICAO)</label>
            <select value={form.base_icao} onChange={e => set('base_icao', e.target.value)} style={inp}>
              <option value="">Select base...</option>
              {CONUS_BASES.map(b => <option key={b.icao} value={b.icao}>{b.icao} — {b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>UNIT NAME (FULL)</label>
            <input value={form.unit_name} onChange={e => set('unit_name', e.target.value)}
              placeholder="101st Airborne Division" style={inp} />
          </div>
          <div>
            <label style={lbl}>UNIT SHORT</label>
            <input value={form.unit_short} onChange={e => set('unit_short', e.target.value)}
              placeholder="101st ABN" style={inp} />
          </div>
          <div>
            <label style={lbl}>PARENT COMMAND</label>
            <input value={form.parent_command} onChange={e => set('parent_command', e.target.value)}
              placeholder="XVIII ABN Corps" style={inp} />
          </div>
          <div>
            <label style={lbl}>VALID FROM</label>
            <input type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>VALID UNTIL (blank = ongoing)</label>
            <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} style={inp} />
          </div>
        </div>
        <button onClick={handleSave}
          style={{ padding: '7px 20px', border: '1px solid #39e0a0', background: 'rgba(57,224,160,.1)', color: '#39e0a0', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
          {editId ? 'UPDATE ASSIGNMENT' : 'ADD ASSIGNMENT'}
        </button>
      </div>

      {/* Active assignments */}
      <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: 3, color: '#39e0a0', fontFamily: 'monospace' }}>
        ACTIVE ASSIGNMENTS ({active.length})
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 24 }}>
        <thead>
          <tr style={{ background: '#101620', borderBottom: '1px solid #1e2c3a' }}>
            {['BASE','UNIT','SHORT','COMMAND','FROM','ACTIONS'].map(h => (
              <th key={h} style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, color: '#4a6070', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid rgba(30,44,58,.5)' }}>
              <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#50a0e8', fontWeight: 700 }}>{a.base_icao}</td>
              <td style={{ padding: '6px 10px', color: '#dceaf0' }}>{a.unit_name}</td>
              <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#b8ccd8' }}>{a.unit_short}</td>
              <td style={{ padding: '6px 10px', color: '#4a6070' }}>{a.parent_command}</td>
              <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#4a6070' }}>{a.valid_from || '—'}</td>
              <td style={{ padding: '6px 10px' }}>
                <button onClick={() => { setEditId(a.id); setForm({ base_icao: a.base_icao, unit_name: a.unit_name, unit_short: a.unit_short, parent_command: a.parent_command, valid_from: a.valid_from || '', valid_until: a.valid_until || '', notes: a.notes || '' }) }}
                  style={{ background: 'none', border: 'none', color: '#f0a040', cursor: 'pointer', marginRight: 8 }}>✎ Edit</button>
                <button onClick={() => expire(a.id)}
                  style={{ background: 'none', border: 'none', color: '#e85040', cursor: 'pointer', fontSize: 11 }}>Expire</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {archived.length > 0 && (
        <details>
          <summary style={{ fontSize: 10, letterSpacing: 3, color: '#4a6070', fontFamily: 'monospace', cursor: 'pointer' }}>
            ARCHIVED ({archived.length})
          </summary>
          <div style={{ marginTop: 8, opacity: .5, fontSize: 11 }}>
            {archived.map(a => (
              <div key={a.id} style={{ padding: '4px 0', fontFamily: 'monospace', color: '#4a6070' }}>
                {a.base_icao} — {a.unit_short} (expired {a.valid_until})
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: 'monospace', marginBottom: 4 }
const inp = { width: '100%', background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, outline: 'none' }
