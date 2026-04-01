import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const ASSET_TYPES  = ['carrier','destroyer','submarine','airbase','lmsr','conus_base','strike','manual']
const ASSET_STATUS = ['DEPLOYED','SURGE','ELEVATED','ACTIVE','IN PORT','NMC','INACTIVE']
const CENTCOM_RELEVANCE = ['CRITICAL','HIGH','MODERATE','LOW','NMC','NONE']
const LMSR_CATEGORIES   = ['forward','conus_e','conus_w','pacific','inactive']

const EMPTY = {
  name:'', designation:'', country:'US', asset_type:'lmsr', status:'ACTIVE',
  lat:'', lng:'', notes:'', intel_assessment:'', hull_number:'',
  ship_class:'', centcom_relevance:'MODERATE', lmsr_category:'',
  last_location:'', csg_designation:'', air_wing:'', icao_code:'',
  aircraft_types:'', tags:'',
}

const inp = { background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '6px 8px', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, outline: 'none', width: '100%' }
const lbl = { display: 'block', fontSize: 9, letterSpacing: 2, color: '#4a6070', fontFamily: "'Share Tech Mono', monospace", marginBottom: 3 }

export function AssetEditor() {
  const [assets, setAssets]   = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [editId, setEditId]   = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [filterType, setFilterType] = useState('')

  const load = () => supabase.from('assets').select('*').order('asset_type').order('name')
    .then(({ data }) => { setAssets(data || []); setLoading(false) })

  useEffect(() => { load() }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const record = {
      name: form.name, designation: form.designation, country: form.country,
      asset_type: form.asset_type, status: form.status,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      notes: form.notes, intel_assessment: form.intel_assessment,
      hull_number: form.hull_number, ship_class: form.ship_class,
      centcom_relevance: form.centcom_relevance || null,
      lmsr_category: form.lmsr_category || null,
      last_location: form.last_location,
      csg_designation: form.csg_designation,
      air_wing: form.air_wing,
      icao_code: form.icao_code || null,
      aircraft_types: form.aircraft_types ? form.aircraft_types.split(',').map(s => s.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    }
    try {
      if (editId) {
        await supabase.from('assets').update(record).eq('id', editId)
      } else {
        await supabase.from('assets').insert([record])
      }
      setAdding(false); setEditId(null); setForm(EMPTY); load()
    } catch (e) { alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this asset?')) return
    await supabase.from('assets').delete().eq('id', id)
    load()
  }

  function startEdit(a) {
    setEditId(a.id)
    setForm({
      ...EMPTY,
      name: a.name || '', designation: a.designation || '', country: a.country || 'US',
      asset_type: a.asset_type || 'lmsr', status: a.status || 'ACTIVE',
      lat: a.lat || '', lng: a.lng || '', notes: a.notes || '',
      intel_assessment: a.intel_assessment || '',
      hull_number: a.hull_number || '', ship_class: a.ship_class || '',
      centcom_relevance: a.centcom_relevance || 'MODERATE',
      lmsr_category: a.lmsr_category || '', last_location: a.last_location || '',
      csg_designation: a.csg_designation || '', air_wing: a.air_wing || '',
      icao_code: a.icao_code || '',
      aircraft_types: (a.aircraft_types || []).join(', '),
      tags: (a.tags || []).join(', '),
    })
    setAdding(true)
  }

  const filtered = filterType ? assets.filter(a => a.asset_type === filterType) : assets

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, color: '#dceaf0', margin: 0, ...Z, letterSpacing: 3 }}>ASSET REGISTRY</h2>
        <span style={{ background: '#1c2530', color: '#4a6070', padding: '2px 8px', ...Z, fontSize: 10 }}>{filtered.length}</span>
        <button onClick={() => { setAdding(true); setEditId(null); setForm(EMPTY) }}
          style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(57,224,160,.1)', border: '1px solid #39e0a0', color: '#39e0a0', cursor: 'pointer', ...Z, fontSize: 11, letterSpacing: 2 }}>
          + ADD ASSET
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ background: '#0c1018', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '4px 8px', ...Z, fontSize: 11 }}>
          <option value="">ALL TYPES</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div style={{ background: '#0c1018', border: '1px solid #2e3f52', padding: 16, marginBottom: 16 }}>
          <div style={{ ...Z, fontSize: 10, letterSpacing: 3, color: '#4a6070', marginBottom: 12 }}>
            {editId ? '// EDIT ASSET' : '// NEW ASSET'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            {[['NAME', 'name'], ['DESIGNATION', 'designation'], ['COUNTRY', 'country']].map(([l, k]) => (
              <div key={k}><label style={lbl}>{l}</label><input value={form[k]} onChange={e => set(k, e.target.value)} style={inp} /></div>
            ))}
            <div>
              <label style={lbl}>TYPE</label>
              <select value={form.asset_type} onChange={e => set('asset_type', e.target.value)} style={inp}>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>STATUS</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                {ASSET_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>CENTCOM RELEVANCE</label>
              <select value={form.centcom_relevance} onChange={e => set('centcom_relevance', e.target.value)} style={inp}>
                {CENTCOM_RELEVANCE.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {[
              ['LAT','lat'],['LNG','lng'],['HULL NUMBER','hull_number'],
              ['SHIP CLASS','ship_class'],['LAST LOCATION','last_location'],
              ['CSG DESIGNATION','csg_designation'],['AIR WING','air_wing'],['ICAO CODE','icao_code'],
            ].map(([l, k]) => (
              <div key={k}><label style={lbl}>{l}</label><input value={form[k]} onChange={e => set(k, e.target.value)} style={inp} /></div>
            ))}
            <div>
              <label style={lbl}>LMSR CATEGORY</label>
              <select value={form.lmsr_category} onChange={e => set('lmsr_category', e.target.value)} style={inp}>
                <option value="">—</option>
                {LMSR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={lbl}>AIRCRAFT TYPES (comma separated)</label>
              <input value={form.aircraft_types} onChange={e => set('aircraft_types', e.target.value)} style={inp} placeholder="F/A-18E/F, E-2D, EA-18G" />
            </div>
            <div>
              <label style={lbl}>TAGS (comma separated)</label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={lbl}>INTEL ASSESSMENT</label>
            <textarea value={form.intel_assessment} onChange={e => set('intel_assessment', e.target.value)} rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>NOTES</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '7px 20px', border: '1px solid #39e0a0', background: 'rgba(57,224,160,.1)', color: '#39e0a0', cursor: 'pointer', ...Z, fontSize: 11, letterSpacing: 2 }}>
              {saving ? 'SAVING...' : 'SAVE ASSET'}
            </button>
            <button onClick={() => { setAdding(false); setEditId(null); setForm(EMPTY) }}
              style={{ padding: '7px 20px', border: '1px solid #1e2c3a', background: 'transparent', color: '#4a6070', cursor: 'pointer', ...Z, fontSize: 11 }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ ...Z, fontSize: 10, color: '#2e4050' }}>Loading...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0a0e14', borderBottom: '1px solid #1e2c3a' }}>
                {['NAME','TYPE','STATUS','CENTCOM','LOCATION',''].map(h => (
                  <th key={h} style={{ padding: '7px 10px', ...Z, fontSize: 8, letterSpacing: 2, color: '#2e4050', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid rgba(30,44,58,.4)' }}>
                  <td style={{ padding: '6px 10px', color: '#dceaf0', fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: '6px 10px', ...Z, color: '#4a6070', fontSize: 10 }}>{a.asset_type}</td>
                  <td style={{ padding: '6px 10px', ...Z, color: ({ DEPLOYED:'#39e0a0',SURGE:'#e8d040',ELEVATED:'#f0a040',NMC:'#e85040' })[a.status] || '#4a6070', fontSize: 10 }}>{a.status}</td>
                  <td style={{ padding: '6px 10px', ...Z, fontSize: 9, color: ({ CRITICAL:'#e85040',HIGH:'#f0a040',MODERATE:'#50a0e8' })[a.centcom_relevance] || '#2e4050' }}>{a.centcom_relevance || '—'}</td>
                  <td style={{ padding: '6px 10px', color: '#4a6070', fontSize: 10 }}>{a.last_location || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <button onClick={() => startEdit(a)} style={{ background: 'none', border: 'none', color: '#f0a040', cursor: 'pointer', fontSize: 12, marginRight: 8 }}>✎</button>
                    <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', color: '#e85040', cursor: 'pointer', fontSize: 12 }}>✕</button>
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
