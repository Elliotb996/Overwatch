import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { ICON_IDS, SITE_ICON_META, SITE_ICONS, STATE_COLORS, InlineIcon } from '../lib/iconLibrary'

const Z={fontFamily:"'Share Tech Mono',monospace"}
const R={fontFamily:"'Rajdhani',sans-serif"}
const C={
  g:'#39e0a0',a:'#f0a040',r:'#e85040',b:'#50a0e8',p:'#a060e8',
  y:'#e8d040',t1:'#b8ccd8',t2:'#4a6070',t3:'#28404c',tb:'#dceaf0',
  bg:'#07090b',bg2:'#0c1018',bg3:'#101620',bg4:'#161e28',br:'#1e2c3a',
}
const ESC_OPTIONS=['NORMAL','ELEVATED','HIGH','CRITICAL']
const TYPE_OPTIONS=['hostile','allied_host','allied_non_host','neutral','partner']
const ESC_COL={CRITICAL:C.r,HIGH:C.a,ELEVATED:C.y,NORMAL:C.t2}

const COUNTRY_DEFAULTS=[
  {code:'IR',name:'Iran'},{code:'JO',name:'Jordan'},{code:'IL',name:'Israel'},
  {code:'KW',name:'Kuwait'},{code:'SA',name:'Saudi Arabia'},{code:'QA',name:'Qatar'},
  {code:'AE',name:'United Arab Emirates'},{code:'GB',name:'United Kingdom'},
  {code:'DE',name:'Germany'},{code:'GR',name:'Greece'},{code:'IT',name:'Italy'},
  {code:'FR',name:'France'},{code:'YE',name:'Yemen'},{code:'SY',name:'Syria'},
  {code:'IQ',name:'Iraq'},{code:'LB',name:'Lebanon'},
]

function Toggle({on,onClick,label}) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
      <div style={{width:36,height:18,background:on?C.g:C.br,borderRadius:9,position:'relative',transition:'.2s',flexShrink:0}}>
        <div style={{position:'absolute',width:12,height:12,background:on?C.bg:'#4a6070',borderRadius:'50%',top:3,left:on?21:3,transition:'.2s'}} />
      </div>
      <span style={{...Z,fontSize:10,color:on?C.g:C.t2,letterSpacing:1}}>{label}</span>
    </div>
  )
}

// ── Pin Drop Map Component ─────────────────────────
function PinDropInner({onPin}) {
  useMapEvents({ click(e){ onPin(e.latlng.lat, e.latlng.lng) } })
  return null
}

function PinDropMap({lat, lng, onPin, center}) {
  const markerIcon = L.divIcon({
    html:`<div style="width:14px;height:14px;background:#e85040;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(232,80,64,.8)"></div>`,
    className:'',iconSize:[14,14],iconAnchor:[7,7]
  })
  return (
    <div style={{height:220,borderRadius:2,overflow:'hidden',border:'1px solid #1e2c3a',marginBottom:12}}>
      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:'#4a6070',padding:'4px 8px',background:'#0c1018',letterSpacing:1}}>
        CLICK MAP TO DROP PIN · {lat&&lng ? `${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lng).toFixed(4)}°E` : 'No pin set'}
      </div>
      <MapContainer center={center||[32,44]} zoom={5} style={{width:'100%',height:'calc(100% - 20px)'}} zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" />
        <PinDropInner onPin={onPin} />
        {lat&&lng&&(
          <Marker position={[parseFloat(lat),parseFloat(lng)]} icon={markerIcon} />
        )}
      </MapContainer>
    </div>
  )
}

// ── Country center lookup for pin map ───────────────
const COUNTRY_CENTERS = {
  IR:[33,53],JO:[31.2,36.5],IL:[31.5,35],KW:[29.3,47.5],SA:[24,45],QA:[25.3,51.2],
  AE:[24.5,54.5],DE:[51,10],GB:[53,-1.5],GR:[39,22.5],IT:[42.5,12.5],FR:[46,2.5],
  YE:[15.5,48],SY:[35,38],IQ:[33,44],LB:[33.8,35.8],
}

// ── Visual icon picker — replaces the plain site_type <select> ──
// Shows all 21 library icons in a grid with label so the user has a
// visual reference when assigning a type to a strike site.
function IconPicker({ value, onChange }) {
  const statusColor = { nominal:C.g, elevated:C.a, critical:C.r, dormant:C.t2 }
  // Group icons by section for visual separation
  const groups = [
    { label:'STRIKE SITES', ids: ICON_IDS.slice(0,9) },
    { label:'ENERGY',       ids: ICON_IDS.slice(9,15) },
    { label:'STRATEGIC',    ids: ICON_IDS.slice(15) },
  ]
  return (
    <div style={{background:C.bg2,border:`1px solid ${C.br}`,borderRadius:1}}>
      {groups.map(grp => (
        <div key={grp.label}>
          <div style={{...Z,fontSize:7,color:C.t3,letterSpacing:3,padding:'5px 10px 3px',borderBottom:`1px solid ${C.br}`}}>
            {grp.label}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(62px,1fr))',gap:2,padding:4}}>
            {grp.ids.map(id => {
              const meta   = SITE_ICON_META[id]
              const isSel  = value === id
              const col    = isSel ? C.a : C.t3
              return (
                <div key={id} onClick={() => onChange(id)}
                  style={{
                    display:'flex',flexDirection:'column',alignItems:'center',gap:3,
                    padding:'6px 2px 4px',cursor:'pointer',borderRadius:1,
                    background: isSel ? 'rgba(240,160,64,0.12)' : 'transparent',
                    border:`1px solid ${isSel ? C.a : 'transparent'}`,
                    transition:'background .1s',
                  }}
                  onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background='rgba(255,255,255,.04)' }}
                  onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background='transparent' }}>
                  <div style={{color:col,width:28,height:28,flexShrink:0}}
                    dangerouslySetInnerHTML={{__html:SITE_ICONS[id]}} />
                  <div style={{...Z,fontSize:6.5,color:isSel?C.a:C.t2,textAlign:'center',
                    letterSpacing:0.3,lineHeight:1.2,wordBreak:'break-word',width:'100%',
                    paddingInline:1}}>
                    {meta.name.split(' · ')[0].split(' / ')[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CountryEditor() {
  const [countries, setCountries] = useState([])
  const [sites, setSites] = useState([])
  const [editingCountry, setEditingCountry] = useState(null)
  const [editingSite, setEditingSite] = useState(null)
  const [tab, setTab] = useState('COUNTRIES')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [newSite, setNewSite] = useState(false)

  useEffect(()=>{ load() },[])

  async function load() {
    const [{data:c},{data:s}] = await Promise.all([
      supabase.from('country_intel').select('*').order('code'),
      supabase.from('strike_sites').select('*').order('country_code,strike_date',{ascending:false}),
    ])
    // Merge with defaults so all countries show
    const existing = c||[]
    const merged = COUNTRY_DEFAULTS.map(d=>{
      return existing.find(e=>e.code===d.code) || {...d, escalation:'NORMAL', country_type:'neutral', summary:'', threat_window:'', has_strike_sites:false, has_ports:false}
    })
    // Add any DB countries not in defaults
    existing.filter(e=>!COUNTRY_DEFAULTS.find(d=>d.code===e.code)).forEach(e=>merged.push(e))
    setCountries(merged)
    setSites(s||[])
  }

  function flash(m,isErr=false){setMsg({text:m,err:isErr});setTimeout(()=>setMsg(null),3000)}

  async function saveCountry(country) {
    setSaving(true)
    const payload={
      code:country.code, name:country.name,
      escalation:country.escalation||'WATCH',
      country_type:country.country_type||'neutral',
      summary:country.summary||'',
      threat_window:country.threat_window||'',
      notes:country.notes||'',
      has_strike_sites:!!country.has_strike_sites,
      has_ports:!!country.has_ports,
      tier_required:country.tier_required||'analyst',
      updated_at:new Date().toISOString(),
    }
    const {error} = await supabase.from('country_intel').upsert(payload,{onConflict:'code'})
    setSaving(false)
    if(error){flash('Save failed: '+error.message,true);return}
    flash('Saved '+country.code)
    setEditingCountry(null)
    load()
  }

  async function saveSite(site) {
    setSaving(true)
    const payload={
      name:site.name,country_code:site.country_code,
      lat:parseFloat(site.lat),lng:parseFloat(site.lng),
      site_type:site.site_type||'strike',
      status:site.status||'UNKNOWN',
      strike_date:site.strike_date||null,
      source:site.source||'',
      source_url:site.source_url||'',
      x_url:site.x_url||'',
      x_username:site.x_username||'',
      description:site.description||'',
      geo_confirmed:!!site.geo_confirmed,
      image_url:site.image_url||'',
      tier_required:site.tier_required||'analyst',
    }
    let error
    if(site.id && !site._new) {
      ({error} = await supabase.from('strike_sites').update(payload).eq('id',site.id))
    } else {
      ({error} = await supabase.from('strike_sites').insert(payload))
    }
    setSaving(false)
    if(error){flash('Save failed: '+error.message,true);return}
    flash('Site saved')
    setEditingSite(null)
    setNewSite(false)
    load()
  }

  async function deleteSite(id) {
    if(!confirm('Delete this strike site?')) return
    await supabase.from('strike_sites').delete().eq('id',id)
    load()
  }

  const country = editingCountry
  const site = editingSite

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      {/* Header */}
      <div style={{background:C.bg4,borderBottom:`1px solid ${C.br}`,padding:'10px 20px',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
        <span style={{...R,fontSize:18,fontWeight:700,color:C.tb}}>Country Intel Manager</span>
        {msg&&<span style={{...Z,fontSize:10,color:msg.err?C.r:C.g,letterSpacing:1,marginLeft:'auto'}}>{msg.text}</span>}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
        {['COUNTRIES','STRIKE SITES'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'8px 18px',cursor:'pointer',
              color:tab===t?C.a:C.t2,background:'transparent',border:'none',
              borderBottom:`2px solid ${tab===t?C.a:'transparent'}`}}>
            {t}
          </button>
        ))}
      </div>

      {/* ── COUNTRIES TAB ── */}
      {tab==='COUNTRIES'&&!country&&(
        <div style={{flex:1,overflow:'auto'}}>
          <div style={{padding:'8px 20px',borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2}}>
            {countries.length} countries tracked · Click to edit escalation, intel summary, and feature toggles
          </div>
          {countries.map(c=>{
            const col=ESC_COL[c.escalation]||C.t2
            return (
              <div key={c.code}
                onClick={()=>setEditingCountry({...c})}
                style={{display:'flex',alignItems:'center',gap:16,padding:'12px 20px',borderBottom:`1px solid rgba(30,44,58,.4)`,cursor:'pointer',transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(80,160,232,.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{...Z,fontSize:11,fontWeight:700,color:C.t3,width:28}}>{c.code}</div>
                <div style={{...R,fontSize:15,fontWeight:600,color:C.tb,flex:1}}>{c.name||c.code}</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {c.has_strike_sites&&<span style={{...Z,fontSize:8,color:C.r,border:`1px solid ${C.r}44`,padding:'2px 5px',borderRadius:1}}>STRIKE SITES</span>}
                  {c.has_ports&&<span style={{...Z,fontSize:8,color:C.b,border:`1px solid ${C.b}44`,padding:'2px 5px',borderRadius:1}}>PORTS</span>}
                  {c.summary&&<span style={{...Z,fontSize:8,color:C.g,border:`1px solid ${C.g}44`,padding:'2px 5px',borderRadius:1}}>INTEL</span>}
                </div>
                <div style={{...Z,fontSize:11,fontWeight:700,color:col,padding:'2px 10px',border:`1px solid ${col}44`,borderRadius:1,letterSpacing:1}}>
                  {c.escalation||'WATCH'}
                </div>
                <span style={{...Z,fontSize:9,color:C.t3}}>→</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── COUNTRY EDIT FORM ── */}
      {tab==='COUNTRIES'&&country&&(
        <div style={{flex:1,overflow:'auto',padding:24,maxWidth:700}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
            <button onClick={()=>setEditingCountry(null)}
              style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 12px',cursor:'pointer'}}>
              ← BACK
            </button>
            <div style={{...R,fontSize:20,fontWeight:700,color:C.tb}}>{country.name||country.code}</div>
            <div style={{...Z,fontSize:10,color:C.t3}}>{country.code}</div>
          </div>

          {/* Escalation + Country Type */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div>
              <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>ESCALATION LEVEL</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {ESC_OPTIONS.map(e=>{
                  const col=ESC_COL[e]||C.t2
                  const sel=country.escalation===e
                  return (
                    <button key={e} onClick={()=>setEditingCountry(c=>({...c,escalation:e}))}
                      style={{...R,fontSize:12,fontWeight:700,padding:'5px 14px',cursor:'pointer',letterSpacing:1,
                        color:sel?C.bg:col,background:sel?col:'transparent',
                        border:`1px solid ${col}`,borderRadius:1}}>
                      {e}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>COUNTRY TYPE</div>
              <select value={country.country_type||'neutral'} onChange={e=>setEditingCountry(c=>({...c,country_type:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',cursor:'pointer'}}>
                {TYPE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Toggles — legacy manual tab overrides */}
          <div style={{opacity:0.5,marginBottom:20}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>LEGACY MANUAL TAB OVERRIDES</div>
            <div style={{display:'flex',gap:24,padding:'12px 16px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <Toggle on={!!country.has_strike_sites} label="STRIKE SITES" onClick={()=>setEditingCountry(c=>({...c,has_strike_sites:!c.has_strike_sites}))} />
              <Toggle on={!!country.has_ports} label="PORTS/NAVAL" onClick={()=>setEditingCountry(c=>({...c,has_ports:!c.has_ports}))} />
            </div>
          </div>

          {/* Threat window */}
          <div style={{marginBottom:16}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:6}}>THREAT WINDOW</div>
            <input value={country.threat_window||''} onChange={e=>setEditingCountry(c=>({...c,threat_window:e.target.value}))}
              placeholder="e.g. 0-72 hours, N/A - cooperative"
              style={{width:'100%',padding:'8px 12px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
          </div>

          {/* Tier required */}
          <div style={{marginBottom:16}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:6}}>MINIMUM TIER TO VIEW</div>
            <div style={{display:'flex',gap:6}}>
              {['free','analyst','premium'].map(t=>(
                <button key={t} onClick={()=>setEditingCountry(c=>({...c,tier_required:t}))}
                  style={{...R,fontSize:12,fontWeight:700,padding:'4px 14px',cursor:'pointer',
                    color:(country.tier_required||'analyst')===t?C.bg:C.t2,
                    background:(country.tier_required||'analyst')===t?C.b:'transparent',
                    border:`1px solid ${C.br}`,borderRadius:1,letterSpacing:1}}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{marginBottom:16}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:6}}>INTEL SUMMARY (analyst tier)</div>
            <textarea value={country.summary||''} onChange={e=>setEditingCountry(c=>({...c,summary:e.target.value}))}
              rows={6} placeholder="Full intel assessment text..."
              style={{width:'100%',padding:'10px 12px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',resize:'vertical',boxSizing:'border-box',lineHeight:1.7}} />
          </div>

          {/* Notes */}
          <div style={{marginBottom:20}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:6}}>NOTES</div>
            <textarea value={country.notes||''} onChange={e=>setEditingCountry(c=>({...c,notes:e.target.value}))}
              rows={3} placeholder="Additional notes, caveats, caveats..."
              style={{width:'100%',padding:'10px 12px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',resize:'vertical',boxSizing:'border-box',lineHeight:1.7}} />
          </div>

          <button onClick={()=>saveCountry(country)} disabled={saving}
            style={{...R,fontSize:14,fontWeight:700,letterSpacing:2,padding:'10px 32px',cursor:'pointer',
              background:saving?C.br:C.g,color:C.bg,border:'none',borderRadius:1}}>
            {saving?'SAVING...':'SAVE COUNTRY INTEL'}
          </button>
        </div>
      )}

      {/* ── STRIKE SITES TAB ── */}
      {tab==='STRIKE SITES'&&!editingSite&&(
        <div style={{flex:1,overflow:'auto'}}>
          <div style={{padding:'8px 20px',borderBottom:`1px solid ${C.br}`,display:'flex',alignItems:'center',gap:12}}>
            <span style={{...Z,fontSize:9,color:C.t2}}>{sites.length} strike sites across all countries</span>
            <button onClick={()=>setEditingSite({_new:true,country_code:'IR',status:'UNKNOWN',site_type:'strike',geo_confirmed:false,tier_required:'analyst'})}
              style={{...R,fontSize:11,fontWeight:700,letterSpacing:2,padding:'4px 14px',background:'rgba(57,224,160,.12)',border:`1px solid ${C.g}`,color:C.g,cursor:'pointer',marginLeft:'auto'}}>
              + ADD SITE
            </button>
          </div>
          {sites.map(s=>{
            const sc={DESTROYED:C.r,DAMAGED:C.a,ACTIVE:C.g,UNKNOWN:C.t2}[s.status]||C.t2
            return (
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 20px',borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                <InlineIcon id={s.site_type||'facility'} status={s.status} size={16} />
                <div style={{...Z,fontSize:9,fontWeight:700,color:C.t3,width:24}}>{s.country_code}</div>
                <div style={{flex:1}}>
                  <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{s.name}</div>
                  <div style={{...Z,fontSize:8,color:C.t2}}>{s.site_type?.toUpperCase()} · {s.strike_date||'Date unknown'} · {s.source||'—'}</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {s.geo_confirmed&&<span style={{...Z,fontSize:8,color:C.g,border:`1px solid ${C.g}44`,padding:'1px 5px',borderRadius:1}}>GEO✓</span>}
                  {s.x_url&&<span style={{...Z,fontSize:8,color:C.b,border:`1px solid ${C.b}44`,padding:'1px 5px',borderRadius:1}}>𝕏</span>}
                </div>
                <span style={{...Z,fontSize:9,color:sc}}>{s.status}</span>
                <button onClick={()=>setEditingSite({...s})}
                  style={{...Z,fontSize:9,padding:'3px 10px',background:'transparent',border:`1px solid ${C.br}`,color:C.t2,cursor:'pointer',borderRadius:1}}>EDIT</button>
                <button onClick={()=>deleteSite(s.id)}
                  style={{...Z,fontSize:9,padding:'3px 8px',background:'transparent',border:`1px solid rgba(232,80,64,.3)`,color:C.r,cursor:'pointer',borderRadius:1}}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── STRIKE SITE EDIT FORM ── */}
      {tab==='STRIKE SITES'&&editingSite&&(
        <div style={{flex:1,overflow:'auto',padding:24,maxWidth:700}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
            <button onClick={()=>setEditingSite(null)}
              style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 12px',cursor:'pointer'}}>
              ← BACK
            </button>
            <div style={{...R,fontSize:18,fontWeight:700,color:C.tb}}>{site._new?'New Strike Site':site.name}</div>
          </div>
          {/* Pin Drop Map */}
          <div style={{marginBottom:12}}>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:6,letterSpacing:2}}>PIN DROP — Click map to set coordinates</div>
            <PinDropMap
              lat={site.lat} lng={site.lng}
              center={COUNTRY_CENTERS[site.country_code||'IR']||[32,44]}
              onPin={(lat,lng)=>setEditingSite(s=>({...s,lat:lat.toFixed(5),lng:lng.toFixed(5)}))}
            />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            {/* Country */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>COUNTRY</div>
              <select value={site.country_code||'IR'} onChange={e=>setEditingSite(s=>({...s,country_code:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}}>
                {countries.map(c=>(
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            {/* Name */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>SITE NAME</div>
              <input value={site.name||''} onChange={e=>setEditingSite(s=>({...s,name:e.target.value}))}
                placeholder="Natanz Nuclear Facility"
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
            {/* Site type — visual icon picker spanning both columns */}
            <div style={{gridColumn:'1 / -1'}}>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:6,letterSpacing:2}}>
                SITE TYPE / ICON
                {site.site_type&&<span style={{color:C.a,marginLeft:8}}>{SITE_ICON_META[site.site_type]?.name||site.site_type}</span>}
              </div>
              <IconPicker value={site.site_type||'facility'} onChange={v=>setEditingSite(s=>({...s,site_type:v}))} />
            </div>
            {/* Status */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>STATUS</div>
              <select value={site.status||'UNKNOWN'} onChange={e=>setEditingSite(s=>({...s,status:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}}>
                {['DESTROYED','DAMAGED','ACTIVE','UNKNOWN'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Lat */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>LATITUDE</div>
              <input value={site.lat||''} onChange={e=>setEditingSite(s=>({...s,lat:e.target.value}))} type="number" step="0.0001" placeholder="33.7238"
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.y,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
            {/* Lng */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>LONGITUDE</div>
              <input value={site.lng||''} onChange={e=>setEditingSite(s=>({...s,lng:e.target.value}))} type="number" step="0.0001" placeholder="51.7268"
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.y,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
            {/* Strike date */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>STRIKE DATE</div>
              <input value={site.strike_date||''} onChange={e=>setEditingSite(s=>({...s,strike_date:e.target.value}))} type="date"
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
            {/* Source */}
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>SOURCE</div>
              <input value={site.source||''} onChange={e=>setEditingSite(s=>({...s,source:e.target.value}))} placeholder="Satellite / OSINT / ArmchairAdml"
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
          </div>
          {/* X Post fields */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>X POST URL</div>
              <input value={site.x_url||''} onChange={e=>setEditingSite(s=>({...s,x_url:e.target.value}))} placeholder="https://x.com/..."
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.b,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>X USERNAME</div>
              <input value={site.x_username||''} onChange={e=>setEditingSite(s=>({...s,x_username:e.target.value}))} placeholder="@ArmchairAdml"
                style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.b,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
            </div>
          </div>
          {/* Image URL */}
          <div style={{marginBottom:12}}>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>IMAGE URL (optional)</div>
            <input value={site.image_url||''} onChange={e=>setEditingSite(s=>({...s,image_url:e.target.value}))} placeholder="https://..."
              style={{width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}} />
          </div>
          {/* Geo confirmed toggle */}
          <div style={{marginBottom:16,padding:'10px 14px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
            <Toggle on={!!site.geo_confirmed} label="GEO-CONFIRMED LOCATION" onClick={()=>setEditingSite(s=>({...s,geo_confirmed:!s.geo_confirmed}))} />
          </div>
          {/* Description */}
          <div style={{marginBottom:20}}>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:5,letterSpacing:2}}>ASSESSMENT / DESCRIPTION</div>
            <textarea value={site.description||''} onChange={e=>setEditingSite(s=>({...s,description:e.target.value}))}
              rows={5} placeholder="Detailed assessment of the site and strike..."
              style={{width:'100%',padding:'10px 12px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,...Z,fontSize:11,borderRadius:1,outline:'none',resize:'vertical',boxSizing:'border-box',lineHeight:1.7}} />
          </div>
          <button onClick={()=>saveSite(site)} disabled={saving}
            style={{...R,fontSize:14,fontWeight:700,letterSpacing:2,padding:'10px 32px',cursor:'pointer',
              background:saving?C.br:C.g,color:C.bg,border:'none',borderRadius:1}}>
            {saving?'SAVING...':'SAVE STRIKE SITE'}
          </button>
        </div>
      )}
    </div>
  )
}
