import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const CORONET_STATUS = ['PLANNED','ACTIVE','IN TRANSIT','COMPLETE']
const inp = { background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '6px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, outline: 'none', width: '100%' }
const lbl = { display: 'block', fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: "'Share Tech Mono', monospace", marginBottom: 3 }

const EMPTY = {
  callsign:'', status:'PLANNED', ac_type:'', ac_category:'fighter', quantity:'',
  unit:'', origin_icao:'', origin_name:'', dest_icao:'', dest_name:'',
  tanker_details:'', notes:'', tier_required:'analyst',
}

export function CoronetEditor() {
  const [coronets, setCoronets] = useState([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)

  const load = () => supabase.from('coronets').select('*').order('created_at', { ascending: false })
    .then(({ data }) => { setCoronets(data || []); setLoading(false) })

  useEffect(() => { load() }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    try {
      const record = { ...form }
      if (editId) await supabase.from('coronets').update(record).eq('id', editId)
      else await supabase.from('coronets').insert([record])
      setAdding(false); setEditId(null); setForm(EMPTY); load()
    } catch (e) { alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this CORONET mission?')) return
    await supabase.from('coronets').delete().eq('id', id)
    load()
  }

  const STATUS_COL = { ACTIVE:'#39e0a0', 'IN TRANSIT':'#f0a040', COMPLETE:'#2e4050', PLANNED:'#50a0e8' }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ ...Z, fontSize: 16, color: '#dceaf0', margin: 0, letterSpacing: 3 }}>CORONET MISSIONS</h2>
        <button onClick={() => { setAdding(true); setEditId(null); setForm(EMPTY) }}
          style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(57,224,160,.1)', border: '1px solid #39e0a0', color: '#39e0a0', cursor: 'pointer', ...Z, fontSize: 11, letterSpacing: 2 }}>
          + ADD CORONET
        </button>
      </div>

      {adding && (
        <div style={{ background: '#0c1018', border: '1px solid #2e3f52', padding: 16, marginBottom: 16 }}>
          <div style={{ ...Z, fontSize: 10, letterSpacing: 3, color: '#4a6070', marginBottom: 12 }}>
            {editId ? '// EDIT CORONET' : '// NEW CORONET MISSION'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            {[
              ['CALLSIGN / NAME', 'callsign'],
              ['AIRCRAFT TYPE', 'ac_type'],
              ['QUANTITY', 'quantity'],
              ['UNIT', 'unit'],
              ['ORIGIN ICAO', 'origin_icao'],
              ['ORIGIN NAME', 'origin_name'],
              ['DEST ICAO', 'dest_icao'],
              ['DEST NAME', 'dest_name'],
            ].map(([l, k]) => (
              <div key={k}><label style={lbl}>{l}</label><input value={form[k]} onChange={e => set(k, e.target.value)} style={inp} /></div>
            ))}
            <div>
              <label style={lbl}>STATUS</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                {CORONET_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>TIER REQUIRED</label>
              <select value={form.tier_required} onChange={e => set('tier_required', e.target.value)} style={inp}>
                <option value="free">FREE</option>
                <option value="analyst">ANALYST+</option>
                <option value="premium">PREMIUM+</option>
                <option value="admin">ADMIN ONLY</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={lbl}>TANKER DETAILS</label>
            <input value={form.tanker_details} onChange={e => set('tanker_details', e.target.value)} style={inp} placeholder="2× KC-46 from Pittsburgh ARB, mission GOLD 51..." />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>NOTES</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '7px 20px', border: '1px solid #39e0a0', background: 'rgba(57,224,160,.1)', color: '#39e0a0', cursor: 'pointer', ...Z, fontSize: 11, letterSpacing: 2 }}>
              {saving ? 'SAVING...' : 'SAVE CORONET'}
            </button>
            <button onClick={() => { setAdding(false); setEditId(null) }}
              style={{ padding: '7px 20px', border: '1px solid #1e2c3a', background: 'transparent', color: '#4a6070', cursor: 'pointer', ...Z, fontSize: 11 }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ ...Z, fontSize: 10, color: '#2e4050' }}>Loading...</div>
      ) : coronets.length === 0 ? (
        <div style={{ ...Z, fontSize: 10, color: '#2e4050', padding: 20 }}>NO CORONET MISSIONS ON FILE</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#0a0e14', borderBottom: '1px solid #1e2c3a' }}>
              {['CALLSIGN','A/C TYPE','QTY','ORIGIN','DEST','STATUS','TIER',''].map(h => (
                <th key={h} style={{ padding: '7px 10px', ...Z, fontSize: 8, letterSpacing: 2, color: '#2e4050', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coronets.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(30,44,58,.4)' }}>
                <td style={{ padding: '6px 10px', color: '#dceaf0', fontWeight: 600 }}>{c.callsign}</td>
                <td style={{ padding: '6px 10px', ...Z, color: '#b8ccd8' }}>{c.ac_type || '—'}</td>
                <td style={{ padding: '6px 10px', ...Z, color: '#4a6070' }}>{c.quantity || '—'}</td>
                <td style={{ padding: '6px 10px', ...Z, color: '#50a0e8' }}>{c.origin_icao || '—'}</td>
                <td style={{ padding: '6px 10px', ...Z, color: '#39e0a0' }}>{c.dest_icao || '—'}</td>
                <td style={{ padding: '6px 10px', ...Z, fontSize: 9, color: STATUS_COL[c.status] || '#4a6070' }}>{c.status}</td>
                <td style={{ padding: '6px 10px', ...Z, fontSize: 9, color: '#4a6070' }}>{c.tier_required}</td>
                <td style={{ padding: '6px 10px' }}>
                  <button onClick={() => { setEditId(c.id); setForm({ callsign:c.callsign||'', status:c.status||'PLANNED', ac_type:c.ac_type||'', ac_category:c.ac_category||'fighter', quantity:c.quantity||'', unit:c.unit||'', origin_icao:c.origin_icao||'', origin_name:c.origin_name||'', dest_icao:c.dest_icao||'', dest_name:c.dest_name||'', tanker_details:c.tanker_details||'', notes:c.notes||'', tier_required:c.tier_required||'analyst' }); setAdding(true) }}
                    style={{ background:'none',border:'none',color:'#f0a040',cursor:'pointer',fontSize:12,marginRight:8 }}>✎</button>
                  <button onClick={() => handleDelete(c.id)}
                    style={{ background:'none',border:'none',color:'#e85040',cursor:'pointer',fontSize:12 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
