import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATIC_CARRIERS, STATIC_LMSR, USCARRIERS_LINKS } from '../lib/staticAssets'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8', p:'#a060e8',
  y:'#e8d040', t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28', br:'#1e2c3a',
}

const CENTCOM_COL = { CRITICAL:C.r, HIGH:C.a, MODERATE:C.b, LOW:C.t2, NONE:C.t3 }
const STATUS_COL  = { DEPLOYED:C.g, SURGE:C.r, ELEVATED:C.a, ACTIVE:C.g, REFIT:C.t3, 'IN PORT':C.t2 }

// ── Coming Soon Gate ──────────────────────────────────
function ComingSoonGate({ auth, children }) {
  if (auth?.isAdmin) return children
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:C.bg, gap:20, padding:40 }}>
      <div style={{ fontSize:40, opacity:.15 }}>🚢</div>
      <div style={{ ...Z, fontSize:13, letterSpacing:4, color:C.t2 }}>SEALIFT TRACKER</div>
      <div style={{ ...R, fontSize:28, fontWeight:700, color:C.tb, letterSpacing:2 }}>COMING SOON</div>
      <div style={{ ...Z, fontSize:10, color:C.t3, maxWidth:400, textAlign:'center', lineHeight:1.8 }}>
        Full sealift tracking with LMSR positions, prepositioning status, and CSG logistics integration is in active development.
      </div>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        {['LMSR TRACKING','AIS INTEGRATION','ROUTE PLOTTING'].map(f=>(
          <span key={f} style={{...Z,fontSize:9,padding:'4px 10px',border:`1px solid ${C.br}`,color:C.t3,borderRadius:1}}>{f}</span>
        ))}
      </div>
      <div style={{ ...Z, fontSize:9, color:C.t3, marginTop:16, opacity:.5 }}>
        Available to Analyst tier and above on launch
      </div>
    </div>
  )
}

export function SealiftView({ auth }) {
  return (
    <ComingSoonGate auth={auth}>
      <SealiftContent auth={auth} />
    </ComingSoonGate>
  )
}

function SealiftContent({ auth }) {
  const [dbAssets, setDbAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    supabase.from('assets').select('*')
      .in('asset_type', ['carrier','lmsr','destroyer'])
      .then(({ data }) => { setDbAssets(data||[]); setLoading(false) })
  }, [])

  // ── Merge static + DB (same pattern as MapView) ────
  const dbByName = {}
  dbAssets.forEach(a => { if(a.name) dbByName[a.name.toLowerCase()] = a })

  const carriers = STATIC_CARRIERS.map(s => {
    const db = dbByName[s.name.toLowerCase()]
    if(!db) return s
    return { ...s, status:db.status||s.status, lat:db.lat!=null?parseFloat(db.lat):s.lat, lng:db.lng!=null?parseFloat(db.lng):s.lng, notes:db.notes||s.notes }
  })

  const lmsrs = STATIC_LMSR.map(s => {
    const db = dbByName[s.name.toLowerCase()]
    if(!db) return s
    return { ...s, centcom:db.centcom_relevance||s.centcom, loc:db.last_location||s.loc, lastRpt:db.last_report_date||s.lastRpt }
  })

  const allAssets = [
    ...carriers.map(a=>({...a,_section:'carrier'})),
    ...lmsrs.map(a=>({...a,_section:'lmsr'})),
  ]

  const filtered = filterType==='all' ? allAssets
    : allAssets.filter(a=>a._section===filterType)

  const selAsset = selected ? allAssets.find(a=>a.id===selected) : null
  const deployedCarriers = carriers.filter(c=>c.status==='DEPLOYED').length
  const critLmsr = lmsrs.filter(l=>['CRITICAL','HIGH'].includes(l.centcom)).length

  return (
    <div style={{flex:1,display:'flex',overflow:'hidden'}}>
      {/* ── Left panel ── */}
      <div style={{width:340,borderRight:`1px solid ${C.br}`,display:'flex',flexDirection:'column',background:C.bg2}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.br}`,background:C.bg4}}>
          <div style={{...R,fontSize:13,fontWeight:700,letterSpacing:2,color:C.tb,marginBottom:4}}>NAVAL POSTURE</div>
          <div style={{display:'flex',gap:16,...Z,fontSize:9,color:C.t2}}>
            <span style={{color:C.g}}>● {deployedCarriers} CSG deployed</span>
            <span style={{color:C.a}}>{critLmsr} LMSR critical/high</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${C.br}`}}>
          {[['all',`ALL (${allAssets.length})`],['carrier',`CSG (${carriers.length})`],['lmsr',`LMSR (${lmsrs.length})`]].map(([k,lbl])=>(
            <button key={k} onClick={()=>setFilterType(k)}
              style={{...R,fontSize:11,fontWeight:600,letterSpacing:1,flex:1,padding:'8px 0',cursor:'pointer',
                color:filterType===k?C.a:C.t2,background:'transparent',border:'none',
                borderBottom:`2px solid ${filterType===k?C.a:'transparent'}`}}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{padding:20,...Z,fontSize:10,color:C.t3}}>LOADING...</div>
          ) : filtered.map(a=>(
            <AssetRow key={a.id} asset={a} selected={selected===a.id} onClick={()=>setSelected(selected===a.id?null:a.id)} />
          ))}
        </div>
      </div>

      {/* ── Right: detail ── */}
      <div style={{flex:1,overflowY:'auto',background:C.bg}}>
        {selAsset ? <AssetDetail asset={selAsset} auth={auth} /> : <SummaryPanel carriers={carriers} lmsrs={lmsrs} />}
      </div>
    </div>
  )
}

function AssetRow({ asset, selected, onClick }) {
  const sCol = STATUS_COL[asset.status] || C.t2
  const cCol = CENTCOM_COL[asset.centcom] || C.t3
  const isCarrier = asset._section==='carrier'
  return (
    <div onClick={onClick} style={{padding:'10px 14px',cursor:'pointer',
      background:selected?'rgba(80,160,232,.06)':'transparent',
      borderBottom:`1px solid rgba(30,44,58,.4)`,
      borderLeft:`2px solid ${selected?C.b:'transparent'}`}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
        <span style={{fontSize:14,marginTop:1}}>{isCarrier?'🚢':'🚛'}</span>
        <div style={{flex:1}}>
          <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{asset.name}</div>
          <div style={{...Z,fontSize:9,color:C.t2}}>{asset.hull||asset.sub}</div>
          {asset.loc&&<div style={{...Z,fontSize:8,color:C.t3,marginTop:2}}>{asset.loc}</div>}
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{...Z,fontSize:9,color:sCol}}>{asset.status}</div>
          {asset.centcom&&<div style={{...Z,fontSize:8,color:cCol,marginTop:2}}>{asset.centcom}</div>}
          {asset.csg&&<div style={{...Z,fontSize:8,color:C.b,marginTop:2}}>{asset.csg}</div>}
        </div>
      </div>
    </div>
  )
}

function AssetDetail({ asset, auth }) {
  const isCarrier = asset._section==='carrier'
  const sCol = STATUS_COL[asset.status]||C.t2
  const cCol = CENTCOM_COL[asset.centcom]||C.t3
  const uscarriersUrl = USCARRIERS_LINKS[asset.id]

  return (
    <div>
      {/* Header */}
      <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.br}`,background:C.bg2}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}>
          <span style={{fontSize:28}}>{isCarrier?'🚢':'🚛'}</span>
          <div style={{flex:1}}>
            <div style={{...R,fontSize:22,fontWeight:700,color:C.tb}}>{asset.name}</div>
            <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{...Z,fontSize:12,color:sCol,padding:'3px 10px',border:`1px solid ${sCol}44`,borderRadius:1}}>{asset.status}</div>
            {asset.csg&&<div style={{...R,fontSize:11,color:C.b,marginTop:4,fontWeight:600}}>{asset.csg}</div>}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {asset.centcom&&<MetaBox label="CENTCOM" value={asset.centcom} color={cCol} />}
          {asset.loc&&<MetaBox label="POSITION" value={asset.loc} />}
          {asset.lastRpt&&<MetaBox label="LAST REPORT" value={asset.lastRpt} />}
        </div>
      </div>

      {/* Notes */}
      {asset.notes&&(
        <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:6}}>NOTES</div>
          <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.8}}>{asset.notes}</div>
        </div>
      )}

      {/* Air wing — carriers only */}
      {isCarrier&&asset.squadrons?.length>0&&(
        <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:10}}>AIR WING — {asset.csg}</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {asset.squadrons.map((sq,i)=>{
              const parts=sq.match(/^(.+?)\s+\((.+)\)$/)
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
                  <span style={{...R,fontSize:13,fontWeight:700,color:C.tb,minWidth:90}}>{parts?.[1]||sq}</span>
                  <span style={{...Z,fontSize:10,color:C.b}}>{parts?.[2]||''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Battle group */}
      {isCarrier&&asset.escorts?.length>0&&(
        <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:10}}>BATTLE GROUP</div>
          {asset.escorts.map((e,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',marginBottom:4,background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <span style={{fontSize:14}}>⚓</span>
              <div style={{flex:1}}>
                <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{e.name}</div>
                <div style={{...Z,fontSize:9,color:C.t2}}>{e.sub}</div>
              </div>
              <span style={{...R,fontSize:10,color:C.t3}}>{e.role}</span>
              <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(e.name)}`} target="_blank" rel="noopener noreferrer"
                style={{...Z,fontSize:8,color:C.b,padding:'2px 6px',border:`1px solid ${C.b}33`,borderRadius:1,textDecoration:'none'}}>↗</a>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {asset.tags?.length>0&&(
        <div style={{padding:'12px 24px',borderBottom:`1px solid ${C.br}`,display:'flex',flexWrap:'wrap',gap:4}}>
          {asset.tags.map(t=>(
            <span key={t} style={{...Z,fontSize:9,padding:'2px 6px',borderRadius:1,background:'rgba(57,224,160,.08)',border:'1px solid rgba(57,224,160,.2)',color:C.g}}>{t}</span>
          ))}
        </div>
      )}

      {/* External link */}
      {uscarriersUrl&&(
        <div style={{padding:'12px 24px'}}>
          <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:6}}>EXTERNAL SOURCES</div>
          <a href={uscarriersUrl} target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,textDecoration:'none'}}>
            <span style={{...Z,fontSize:9,color:C.b}}>↗</span>
            <span style={{...R,fontSize:12,fontWeight:600,color:C.tb}}>USCarriers.net — {asset.name} History</span>
            <span style={{...Z,fontSize:8,color:C.t3,marginLeft:'auto'}}>DEPLOYMENT LOG</span>
          </a>
        </div>
      )}
    </div>
  )
}

function MetaBox({ label, value, color }) {
  return (
    <div style={{padding:'8px 10px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
      <div style={{...Z,fontSize:8,color:C.t3,marginBottom:3,letterSpacing:1}}>{label}</div>
      <div style={{...R,fontSize:12,fontWeight:600,color:color||C.tb}}>{value}</div>
    </div>
  )
}

function SummaryPanel({ carriers, lmsrs }) {
  const deployed = carriers.filter(c=>c.status==='DEPLOYED')
  const critLmsr = lmsrs.filter(l=>['CRITICAL','HIGH'].includes(l.centcom))
  return (
    <div style={{padding:32}}>
      <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginBottom:24}}>FORCE POSTURE SUMMARY — SELECT ASSET FOR DETAIL</div>
      <div style={{marginBottom:24}}>
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:10,borderBottom:`1px solid ${C.br}`,paddingBottom:6}}>CARRIER STRIKE GROUPS — DEPLOYED</div>
        {deployed.map(c=>(
          <div key={c.id} style={{display:'flex',gap:12,marginBottom:8,alignItems:'center'}}>
            <span style={{fontSize:14}}>🚢</span>
            <span style={{...R,fontSize:14,fontWeight:600,color:C.tb,flex:1}}>{c.name}</span>
            <span style={{...Z,fontSize:9,color:C.b}}>{c.csg}</span>
            <span style={{...Z,fontSize:9,color:STATUS_COL[c.status]||C.t2}}>{c.status}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:10,borderBottom:`1px solid ${C.br}`,paddingBottom:6}}>LMSR — CRITICAL / HIGH</div>
        {critLmsr.map(l=>(
          <div key={l.id} style={{display:'flex',gap:12,marginBottom:8,alignItems:'center'}}>
            <span style={{fontSize:14}}>🚛</span>
            <span style={{...R,fontSize:13,fontWeight:600,color:C.tb,flex:1}}>{l.name}</span>
            <span style={{...Z,fontSize:9,color:C.t2}}>{l.loc?.split('—')[0]?.trim()||'—'}</span>
            <span style={{...Z,fontSize:9,color:CENTCOM_COL[l.centcom]||C.t2}}>{l.centcom}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
