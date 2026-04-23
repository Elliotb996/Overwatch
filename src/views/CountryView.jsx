import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { mkSiteIcon } from '../lib/mapIcons'
import { InlineIcon } from '../lib/iconLibrary'

const Z = { fontFamily:"'Share Tech Mono',monospace" }
const R = { fontFamily:"'Rajdhani',sans-serif" }
const C = {
  g:'#39e0a0',a:'#f0a040',r:'#e85040',b:'#50a0e8',p:'#a060e8',
  y:'#e8d040',t1:'#b8ccd8',t2:'#4a6070',t3:'#28404c',tb:'#dceaf0',
  bg:'#07090b',bg2:'#0c1018',bg3:'#101620',bg4:'#161e28',br:'#1e2c3a',
}
const ESC_COLORS = {
  CRITICAL:{c:'#e85040',bg:'rgba(232,80,64,.15)',border:'rgba(232,80,64,.4)'},
  HIGH:    {c:'#f0a040',bg:'rgba(240,160,64,.12)',border:'rgba(240,160,64,.35)'},
  ELEVATED:{c:'#e8d040',bg:'rgba(232,208,64,.1)', border:'rgba(232,208,64,.3)'},
  SURGE:   {c:'#e85040',bg:'rgba(232,80,64,.15)', border:'rgba(232,80,64,.4)'},
  MODERATE:{c:'#50a0e8',bg:'rgba(80,160,232,.1)', border:'rgba(80,160,232,.3)'},
  ACTIVE:  {c:'#50a0e8',bg:'rgba(80,160,232,.1)', border:'rgba(80,160,232,.3)'},
  WATCH:   {c:'#4a6070',bg:'rgba(74,96,112,.1)',  border:'rgba(74,96,112,.3)'},
}

// Strike site status → colour. Drives both icon border and list tag.
const SITE_STATUS_COL = { DESTROYED:C.r, DAMAGED:C.a, ACTIVE:C.g, UNKNOWN:C.t2 }


// ── mkStrikeCluster — count badge for clustered strikes (low zoom) ──
// Worst-status wins: if any DESTROYED in cluster → red, else DAMAGED → amber, else grey
function mkStrikeCluster(count, worstStatus) {
  const col = SITE_STATUS_COL[worstStatus] || C.r
  const size = 26
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <svg viewBox="0 0 20 20" width="${size}" height="${size}" style="display:block;overflow:visible">
        <rect x="3" y="3" width="14" height="14" fill="rgba(7,9,11,0.85)" stroke="${col}" stroke-width="1.2"/>
        <path d="M1,1 L4,1 M1,1 L1,4 M19,1 L16,1 M19,1 L19,4 M1,19 L4,19 M1,19 L1,16 M19,19 L16,19 M19,19 L19,16"
              stroke="${col}" stroke-width="1" fill="none"/>
        <line x1="10" y1="5" x2="10" y2="15" stroke="${col}" stroke-width="0.8" opacity="0.5"/>
        <line x1="5" y1="10" x2="15" y2="10" stroke="${col}" stroke-width="0.8" opacity="0.5"/>
        <circle cx="10" cy="10" r="2.5" fill="${col}"/>
      </svg>
      <div style="position:absolute;top:-8px;right:-10px;min-width:18px;height:13px;padding:0 3px;
        background:${col};color:#07090b;font-family:'Share Tech Mono',monospace;font-size:8px;
        font-weight:700;display:flex;align-items:center;justify-content:center;
        border:1px solid #07090b;box-sizing:border-box;pointer-events:none">${count}</div>
    </div>`,
  })
}


function TierGate({required,current,children}) {
  const TO={free:0,analyst:1,premium:2,admin:3,owner:4}
  if((TO[current]||0)>=(TO[required]||0)) return children
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:10,background:'rgba(7,9,11,.5)',border:`1px solid ${C.br}`,borderRadius:2,textAlign:'center',margin:16}}>
      <div style={{...R,fontSize:13,fontWeight:700,color:C.t2,letterSpacing:2}}>{required.toUpperCase()} TIER</div>
      <div style={{...Z,fontSize:9,color:C.t3,maxWidth:200}}>Upgrade to access this intelligence layer.</div>
    </div>
  )
}

function getCountryICAOs(code) {
  const m={
    JO:['OJKA','OJMS','OJAQ','OJMF'],
    IL:['LLOV','LLNV','LLBG','LLHZ'],
    KW:['OKAS','OKBK'],
    SA:['OEPS','OERK','OEJN'],
    QA:['OTBH'],
    AE:['OMDM','OMAM','OMAD','OMDB'],
    DE:['ETAR','ETAD','ETNN'],
    GB:['EGVA','EGUN','EGUL'],
    GR:['LGEL','LGSA','LGAT'],
    IT:['LIPA','LIQL'],
    IR:['OIII','OIKB','OIMM','OICC'],
    FR:['LFPG','LFML'],
    YE:['OYAA','OYHD'],
    SY:['OSDI','OSKL'],
  }
  return m[code]||[]
}

function getCountryCenter(code) {
  const m={
    IR:[33.0,53.7],JO:[31.5,36.5],IL:[31.5,35.0],KW:[29.3,47.5],
    SA:[24.0,45.0],AE:[24.5,54.5],DE:[51.0,10.5],GB:[53.5,-1.5],
    GR:[39.0,22.5],QA:[25.3,51.2],IT:[42.5,12.5],FR:[46.5,2.5],
    YE:[15.5,48.0],SY:[35.0,38.0],
  }
  return m[code]||[30,40]
}

function getCountryZoom(code) {
  const m={
    IR:5, JO:7, IL:8, KW:8, SA:5, QA:9, AE:7,
    DE:6, GB:6, GR:7, IT:6, FR:6, YE:6, SY:7,
  }
  return m[code]||5
}

// ── parseIntelJournal ──
// Splits intel.notes into dated entries. Accepts either:
//   "2026-03-28: entry body\n2026-03-26: another entry"
// or legacy freeform text (treated as one untagged entry).
// Entries returned newest-first if dates parse.
function parseIntelJournal(text) {
  if(!text || !text.trim()) return []
  // Match lines starting with YYYY-MM-DD: followed by content until next date or EOF
  const re = /^(\d{4}-\d{2}-\d{2})\s*[:\-—]\s*([\s\S]*?)(?=^\d{4}-\d{2}-\d{2}\s*[:\-—]|\Z)/gm
  const entries = []
  let match
  while((match = re.exec(text)) !== null) {
    entries.push({ date: match[1], body: match[2].trim() })
  }
  if(entries.length === 0) {
    // No dated entries — treat whole thing as one untagged block
    return [{ date: null, body: text.trim() }]
  }
  // Sort newest first
  return entries.sort((a,b) => (b.date||'').localeCompare(a.date||''))
}

export function CountryView({auth}) {
  const {code} = useParams()
  const navigate = useNavigate()
  const [intel,setIntel] = useState(null)
  const [sites,setSites] = useState([])
  const [assets,setAssets] = useState([])
  const [flights,setFlights] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)
  const [tab,setTab] = useState('OVERVIEW')
  const [selSite,setSelSite] = useState(null)
  const siteListRef = useRef(null)

  useEffect(()=>{
    async function load(){
      try {
        const [
          {data:intel},
          {data:sites},
          {data:assets},
          {data:flights}
        ] = await Promise.all([
          supabase.from('country_intel').select('*').eq('code',code.toUpperCase()).maybeSingle(),
          supabase.from('strike_sites').select('*').eq('country_code',code.toUpperCase()).order('strike_date',{ascending:false}),
          supabase.from('assets').select('*').order('asset_type'),
          supabase.from('amc_flights').select('*').order('dep_date',{ascending:false}).limit(500),
        ])
        setIntel(intel)
        setSites(sites||[])
        const countryIcaos = getCountryICAOs(code.toUpperCase())
        const countryAssets = (assets||[]).filter(a =>
          countryIcaos.includes((a.icao_code||'').toUpperCase())
        )
        setAssets(countryAssets)
        setFlights((flights||[]).filter(f=>countryIcaos.includes(f.destination?.toUpperCase())))
      } catch(e) {
        console.error('CountryView load error:', e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  },[code])

  // When tab changes, clear selection so STRIKE SITES tab defaults to map view
  useEffect(()=>{ setSelSite(null) }, [tab])

  useEffect(()=>{
    if(selSite && siteListRef.current) {
      const el = siteListRef.current.querySelector(`[data-site-id="${selSite.id}"]`)
      if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'})
    }
  },[selSite])

  if(loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,...Z,color:C.t2,fontSize:11,letterSpacing:3}}>
      LOADING INTEL...
    </div>
  )

  if(error) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:C.bg,gap:12}}>
      <div style={{...Z,fontSize:11,color:C.r,letterSpacing:2}}>⚠ LOAD ERROR</div>
      <div style={{...Z,fontSize:9,color:C.t2}}>{error}</div>
      <button onClick={()=>navigate('/')} style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'6px 16px',cursor:'pointer',marginTop:8}}>← WORLD MAP</button>
    </div>
  )

  const esc = ESC_COLORS[intel?.escalation||'WATCH']
  const hasStrikeSites = intel?.has_strike_sites === true && sites.length > 0
  const tabs = ['OVERVIEW', ...(hasStrikeSites?['STRIKE SITES']:[]), 'ASSETS', 'FLIGHTS', 'IMAGERY']

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{background:C.bg4,borderBottom:`1px solid ${C.br}`,padding:'0 20px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16,height:52}}>
          <button onClick={()=>navigate('/')}
            style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 12px',cursor:'pointer',letterSpacing:2}}>
            ← WORLD MAP
          </button>
          <div style={{...R,fontSize:20,fontWeight:700,color:C.tb}}>{intel?.name||code}</div>
          <div style={{...Z,fontSize:9,color:C.t3,letterSpacing:1}}>{code.toUpperCase()}</div>
          {intel?.escalation&&(
            <div style={{...R,fontSize:12,fontWeight:700,padding:'3px 12px',borderRadius:1,color:esc.c,background:esc.bg,border:`1px solid ${esc.border}`,letterSpacing:2}}>
              {intel.escalation}
            </div>
          )}
          {intel?.threat_window&&!['N/A','N/A - cooperative','Ongoing'].includes(intel.threat_window)&&(
            <div style={{...Z,fontSize:9,color:C.a,letterSpacing:1}}>⏱ {intel.threat_window}</div>
          )}
          <div style={{marginLeft:'auto',display:'flex',gap:12,...Z,fontSize:9,color:C.t3}}>
            <span>▲ {flights.length} flights</span>
            {hasStrikeSites&&<span style={{color:C.r}}>⊕ {sites.length} sites</span>}
            <span>▢ {assets.filter(a=>a.asset_type==='airbase').length} bases</span>
          </div>
        </div>
        <div style={{display:'flex',gap:0,borderTop:`1px solid ${C.br}`}}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'8px 16px',cursor:'pointer',
                color:tab===t?C.a:C.t2,background:'transparent',border:'none',
                borderBottom:`2px solid ${tab===t?C.a:'transparent'}`,whiteSpace:'nowrap'}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {tab==='OVERVIEW'&&<OverviewTab intel={intel} sites={sites} assets={assets} flights={flights} auth={auth} navigate={navigate} hasStrikeSites={hasStrikeSites} code={code} selSite={selSite} setSelSite={setSelSite} onExpandSite={(s)=>{setSelSite(s);setTab('STRIKE SITES')}} />}
        {tab==='STRIKE SITES'&&<StrikeSitesTab sites={sites} auth={auth} selSite={selSite} setSelSite={setSelSite} code={code} siteListRef={siteListRef} />}
        {tab==='ASSETS'&&<AssetsTab assets={assets} auth={auth} navigate={navigate} />}
        {tab==='FLIGHTS'&&<FlightsTab flights={flights} auth={auth} />}
        {tab==='IMAGERY'&&<ImageryTab assetId={code.toUpperCase()} auth={auth} />}
      </div>
    </div>
  )
}

// ── OverviewTab ──
// Layout: 38% left (intel journal + stats) | 62% right (map + site preview).
// Map fills its panel. Stats are 2-col. Intel is a dated journal.
function OverviewTab({intel,sites,assets,flights,auth,navigate,hasStrikeSites,code,selSite,setSelSite,onExpandSite}) {
  const airbases = assets.filter(a=>a.asset_type==='airbase')
  const naval = assets.filter(a=>['carrier','destroyer','submarine'].includes(a.asset_type))
  const journal = parseIntelJournal(intel?.notes)

  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'minmax(340px, 38%) 1fr',overflow:'hidden'}}>

      {/* LEFT: intel journal + stats */}
      <div style={{borderRight:`1px solid ${C.br}`,overflow:'auto',padding:'20px 20px 24px'}}>

        {/* Summary block */}
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginBottom:10}}>INTEL ASSESSMENT</div>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9,marginBottom:16,padding:'12px 14px',background:C.bg3,borderLeft:`2px solid ${C.b}`,borderRadius:1}}>
            {intel?.summary || 'No assessment on file.'}
          </div>
        </TierGate>

        {/* Quick stats — 2 column */}
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginTop:18,marginBottom:10}}>QUICK STATS</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
          {[
            {v:flights.length,l:'AMC FLIGHTS',c:C.b},
            {v:hasStrikeSites?sites.length:0,l:'STRIKE SITES',c:C.r},
            {v:airbases.length,l:'AIRBASES',c:C.g},
            {v:flights.filter(f=>f.mc_flag==='socom').length,l:'SOCOM',c:C.p},
            {v:naval.length,l:'NAVAL',c:C.b},
            {v:hasStrikeSites?sites.filter(s=>s.status==='DESTROYED').length:0,l:'DESTROYED',c:C.r},
          ].map(({v,l,c})=>(
            <div key={l} style={{padding:'10px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <div style={{...R,fontSize:18,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{...Z,fontSize:8,color:C.t3,marginTop:3,letterSpacing:1}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Intel journal — dated entries, newest first */}
        {journal.length > 0 && (
          <>
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginTop:18,marginBottom:10}}>
              <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3}}>INTEL JOURNAL</div>
              <div style={{...Z,fontSize:8,color:C.t3}}>{journal.length} {journal.length===1?'entry':'entries'}</div>
            </div>
            <TierGate required="analyst" current={auth?.tier||'free'}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {journal.map((entry,i)=>(
                  <div key={i} style={{padding:'10px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderLeft:`2px solid ${i===0?C.a:C.t3}`,borderRadius:1}}>
                    {entry.date && (
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                        <span style={{...Z,fontSize:10,fontWeight:700,color:i===0?C.a:C.t2,letterSpacing:1}}>{entry.date}</span>
                        {i===0 && <span style={{...Z,fontSize:8,color:C.a,padding:'1px 5px',border:`1px solid ${C.a}44`,letterSpacing:1}}>LATEST</span>}
                      </div>
                    )}
                    <div style={{...Z,fontSize:10,color:C.t1,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{entry.body}</div>
                  </div>
                ))}
              </div>
            </TierGate>
          </>
        )}

        {/* Tracked bases */}
        {airbases.length>0&&(
          <>
            <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginTop:18,marginBottom:10}}>TRACKED BASES</div>
            {airbases.map(a=>(
              <div key={a.id} onClick={()=>navigate(`/airbase/${a.icao_code||a.id}`)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',marginBottom:4,background:C.bg3,border:`1px solid ${C.br}`,cursor:'pointer',borderRadius:1,transition:'border-color .15s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.b}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.br}>
                <svg viewBox="0 0 20 20" width="14" height="14" style={{flexShrink:0}}>
                  <rect x="5" y="5" width="10" height="10" fill="none" stroke={C.g} strokeWidth="1"/>
                  <circle cx="10" cy="10" r="1.2" fill={C.g}/>
                </svg>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{...R,fontSize:13,fontWeight:600,color:C.tb,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                  <div style={{...Z,fontSize:9,color:C.t2}}>{a.designation||a.icao_code}</div>
                </div>
                <div style={{...Z,fontSize:9,color:a.status==='SURGE'?C.r:a.status==='ELEVATED'?C.a:C.g}}>{a.status}</div>
                <span style={{...Z,fontSize:9,color:C.b}}>→</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* RIGHT: map + site preview strip */}
      <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,padding:'10px 16px',borderBottom:`1px solid ${C.br}`,flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
          <span>{hasStrikeSites?'STRIKE SITES & ASSETS':'ASSETS MAP'}</span>
          {hasStrikeSites && <span style={{color:C.t3}}>·</span>}
          {hasStrikeSites && <span style={{...Z,fontSize:8,color:C.t3}}>{sites.length} sites tracked</span>}
          {selSite && <span style={{color:C.a,marginLeft:'auto',...Z,fontSize:9}}>● {selSite.name}</span>}
        </div>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{flex:1,minHeight:300,position:'relative'}}>
            <CountryMap sites={hasStrikeSites?sites:[]} assets={assets} code={code} selSite={selSite} setSelSite={setSelSite} onExpand={onExpandSite} />
          </div>
        </TierGate>
        {hasStrikeSites && sites.length>0 && (
          <div style={{flexShrink:0,borderTop:`1px solid ${C.br}`,maxHeight:160,overflow:'auto',background:C.bg2}}>
            <TierGate required="analyst" current={auth?.tier||'free'}>
              <div style={{padding:'6px 12px',...Z,fontSize:8,color:C.t3,letterSpacing:2,borderBottom:`1px solid ${C.br}`}}>
                RECENT STRIKES ({Math.min(5,sites.length)} of {sites.length})
              </div>
              {sites.slice(0,5).map(s=>(
                <div key={s.id} onClick={()=>setSelSite(selSite?.id===s.id?null:s)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderBottom:`1px solid rgba(30,44,58,.4)`,cursor:'pointer',background:selSite?.id===s.id?'rgba(80,160,232,.06)':'transparent'}}>
                  <InlineIcon id={s.site_type} status={s.status} size={14} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...R,fontSize:12,fontWeight:600,color:C.tb,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</div>
                    <div style={{...Z,fontSize:8,color:C.t2}}>{s.strike_date||'—'} · {s.source||'—'}</div>
                  </div>
                  <span style={{...Z,fontSize:9,color:SITE_STATUS_COL[s.status]||C.t2}}>{s.status}</span>
                </div>
              ))}
            </TierGate>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// STRIKE SITE CLUSTER LAYER
// Mirrors AirbaseClusterLayer in MapView. Below zoom threshold, sites within
// px radius collapse into one count-badge marker. Click to fan out.
// ══════════════════════════════════════════════════════════════
const SITE_CLUSTER_ZOOM = 7   // below this zoom, cluster
const SITE_CLUSTER_PX   = 32  // merge radius
const SITE_FAN_PX       = 52  // fan spread radius

function computeSiteClusters(items, map) {
  const pts = items.map(s => ({
    ...s,
    px: map.latLngToContainerPoint([parseFloat(s.lat), parseFloat(s.lng)])
  }))
  const assigned = new Set()
  const clusters = []
  pts.forEach((a, i) => {
    if(assigned.has(i)) return
    const group = [a]; assigned.add(i)
    pts.forEach((b, j) => {
      if(assigned.has(j)) return
      const dx = a.px.x - b.px.x, dy = a.px.y - b.px.y
      if(Math.sqrt(dx*dx + dy*dy) < SITE_CLUSTER_PX) { group.push(b); assigned.add(j) }
    })
    const cLat = group.reduce((s,x)=>s+parseFloat(x.lat),0)/group.length
    const cLng = group.reduce((s,x)=>s+parseFloat(x.lng),0)/group.length
    clusters.push({ id:`sc_${i}`, sites:group, lat:cLat, lng:cLng })
  })
  return clusters
}

function getSiteFanPositions(centerLat, centerLng, count, map) {
  const center = map.latLngToContainerPoint([centerLat, centerLng])
  const arc = Math.min(count * 30, 200)
  const startAngle = -90 - arc / 2
  return Array.from({length: count}, (_, i) => {
    const angle = (startAngle + (count > 1 ? (i / (count - 1)) * arc : 0)) * (Math.PI / 180)
    const px = center.x + Math.cos(angle) * SITE_FAN_PX
    const py = center.y + Math.sin(angle) * SITE_FAN_PX
    return map.containerPointToLatLng([px, py])
  })
}

function worstStatusOf(sites) {
  if(sites.some(s => s.status === 'DESTROYED')) return 'DESTROYED'
  if(sites.some(s => s.status === 'DAMAGED'))   return 'DAMAGED'
  if(sites.some(s => s.status === 'ACTIVE'))    return 'ACTIVE'
  return 'UNKNOWN'
}

function StrikeSiteClusterLayer({ sites, selSite, setSelSite, onExpand }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const [expandedId, setExpandedId] = useState(null)
  const [fanPositions, setFanPositions] = useState([])

  useMapEvents({
    zoom:      () => { setZoom(map.getZoom()); setExpandedId(null) },
    dragstart: () => setExpandedId(null),
    click:     () => setExpandedId(null),
  })

  const valid = sites.filter(s => s.lat && s.lng)

  // Above threshold: all markers rendered individually
  if(zoom >= SITE_CLUSTER_ZOOM) {
    return (
      <>
        {valid.map(s => (
          <SingleSiteMarker key={s.id} site={s} selSite={selSite} setSelSite={setSelSite} onExpand={onExpand} />
        ))}
      </>
    )
  }

  // Below threshold: cluster
  const clusters = computeSiteClusters(valid, map)
  return (
    <>
      {clusters.map(cl => {
        if(cl.sites.length === 1) {
          return <SingleSiteMarker key={cl.id} site={cl.sites[0]} selSite={selSite} setSelSite={setSelSite} onExpand={onExpand} />
        }
        const isExpanded = expandedId === cl.id
        const worst = worstStatusOf(cl.sites)

        if(isExpanded) {
          const positions = fanPositions.length === cl.sites.length ? fanPositions
            : getSiteFanPositions(cl.lat, cl.lng, cl.sites.length, map)
          return (
            <div key={cl.id}>
              <Marker position={[cl.lat, cl.lng]}
                icon={mkStrikeCluster(cl.sites.length, worst)}
                eventHandlers={{click:(e)=>{L.DomEvent.stopPropagation(e); setExpandedId(null)}}} />
              {cl.sites.map((s, i) => {
                const pos = positions[i] || {lat:cl.lat, lng:cl.lng}
                return (
                  <Marker key={s.id} position={[pos.lat, pos.lng]}
                    icon={mkSiteIcon(s.site_type || s.site_category, s.status)}
                    eventHandlers={{click:(e)=>{
                      L.DomEvent.stopPropagation(e)
                      setSelSite(selSite?.id === s.id ? null : s)
                      setExpandedId(null)
                    }}}>
                    <Tooltip direction="top" offset={[0,-12]} opacity={1} className="ow-tip">
                      <span style={{...R,fontSize:11,fontWeight:600,color:C.tb}}>{s.name}</span>
                    </Tooltip>
                  </Marker>
                )
              })}
            </div>
          )
        }

        return (
          <Marker key={cl.id} position={[cl.lat, cl.lng]}
            icon={mkStrikeCluster(cl.sites.length, worst)}
            eventHandlers={{click:(e)=>{
              L.DomEvent.stopPropagation(e)
              const pos = getSiteFanPositions(cl.lat, cl.lng, cl.sites.length, map)
              setFanPositions(pos)
              setExpandedId(cl.id)
            }}}>
            <Tooltip direction="top" offset={[0,-14]} opacity={1} className="ow-tip">
              <span style={{...R,fontSize:12,fontWeight:700,color:C.tb}}>{cl.sites.length} strike sites</span>
              <span style={{...Z,fontSize:9,color:SITE_STATUS_COL[worst]||C.t2,marginLeft:6}}>{worst}</span>
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}

function SingleSiteMarker({site, selSite, setSelSite, onExpand}) {
  const isSel = selSite?.id === site.id
  const col = SITE_STATUS_COL[site.status] || C.t2
  return (
    <Marker position={[parseFloat(site.lat), parseFloat(site.lng)]}
      icon={mkSiteIcon(site.site_type || site.site_category, site.status)}
      eventHandlers={{click:(e)=>{L.DomEvent.stopPropagation(e); setSelSite(isSel ? null : site)}}}>
      <Tooltip direction="top" offset={[0,-12]} opacity={1} className="ow-tip">
        <span style={{...Z,fontSize:9,color:col,letterSpacing:1,display:'inline-flex',alignItems:'center'}}><InlineIcon id={site.site_type} status={site.status} size={12} /></span>
        <span style={{...R,fontSize:12,fontWeight:700,color:C.tb,marginLeft:6}}>{site.name}</span>
      </Tooltip>
      <Popup closeButton={false}>
        <div style={{...Z,fontSize:10,minWidth:200}}>
          <div style={{...R,fontSize:13,fontWeight:700,color:C.tb,marginBottom:3}}>{site.name}</div>
          <div style={{color:col,marginBottom:3,fontSize:9,letterSpacing:1}}>{site.status} · {site.site_type?.toUpperCase()}</div>
          {site.geo_confirmed&&<div style={{...Z,fontSize:8,color:C.g,marginBottom:3}}>✓ GEO CONFIRMED</div>}
          <div style={{color:C.t2,fontSize:9,lineHeight:1.5}}>{(site.description||'').slice(0,100)}{site.description?.length>100?'...':''}</div>
          <div onClick={()=>{ setSelSite(site); onExpand?.(site) }} style={{...R,fontSize:10,fontWeight:600,color:C.a,marginTop:6,cursor:'pointer',letterSpacing:1}}>▼ EXPAND DETAIL →</div>
        </div>
      </Popup>
    </Marker>
  )
}

// ── CountryMap ──
// Base tile + strike cluster layer + airbases/naval context markers.
// Shared inline CSS lifted from MapView for tooltip styling.
function CountryMap({sites,assets,code,selSite,setSelSite,onExpand}) {
  const navToBase = useNavigate()
  const center = getCountryCenter(code)
  const zoom = getCountryZoom(code)
  const airbases = assets.filter(a => a.lat && a.lng && a.asset_type === 'airbase')
  const naval = assets.filter(a => a.lat && a.lng && ['carrier','destroyer','submarine'].includes(a.asset_type))

  return (
    <>
      <style>{`.ow-tip{background:rgba(7,9,11,.95)!important;border:1px solid #2e3f52!important;border-radius:2px!important;padding:4px 8px!important;box-shadow:0 6px 18px rgba(0,0,0,0.55)!important}.ow-tip::before{display:none!important}`}</style>
      <MapContainer key={code} center={center} zoom={zoom} style={{width:'100%',height:'100%'}} zoomControl={false} attributionControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={18} />
        {sites.length > 0 && (
          <StrikeSiteClusterLayer sites={sites} selSite={selSite} setSelSite={setSelSite} onExpand={onExpand} />
        )}
        {airbases.map(a=>(
          <Marker key={a.id} position={[parseFloat(a.lat),parseFloat(a.lng)]}
            icon={mkSiteIcon('airbase', a.status==='SURGE'?'DESTROYED':a.status==='ELEVATED'?'DAMAGED':'ACTIVE')}
            eventHandlers={{click:()=>navToBase(`/airbase/${(a.icao_code||a.id||'').toUpperCase()}`)}}>
            <Tooltip direction="top" offset={[0,-10]} opacity={1} className="ow-tip">
              <span style={{...Z,fontSize:9,color:C.g}}>{(a.icao_code||'').toUpperCase()}</span>
              <span style={{...R,fontSize:11,fontWeight:600,color:C.tb,marginLeft:6}}>{a.name}</span>
            </Tooltip>
          </Marker>
        ))}
        {naval.map(a=>(
          <Marker key={a.id} position={[parseFloat(a.lat),parseFloat(a.lng)]} icon={mkSiteIcon('naval', 'ACTIVE')}>
            <Tooltip direction="top" offset={[0,-8]} opacity={1} className="ow-tip">
              <span style={{...R,fontSize:11,fontWeight:600,color:C.tb}}>{a.name}</span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </>
  )
}

// ── StrikeSitesTab ──
// Split: 320px list | map or detail pane.
// Selection toggles between map (default) and detail. No blank state.
function StrikeSitesTab({sites,auth,selSite,setSelSite,code,siteListRef}) {
  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'320px 1fr',overflow:'hidden'}}>
      <div ref={siteListRef} style={{borderRight:`1px solid ${C.br}`,overflow:'auto'}}>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{padding:'8px 14px',...Z,fontSize:9,color:C.t3,letterSpacing:2,borderBottom:`1px solid ${C.br}`,background:C.bg4}}>
            {sites.length} SITES · Click to focus
          </div>
          {sites.length===0&&<div style={{...Z,fontSize:10,color:C.t3,padding:20}}>No strike sites logged.</div>}
          {sites.map(s=>{
            const sc = SITE_STATUS_COL[s.status]||C.t2
            const isSel = selSite?.id===s.id
            return (
              <div key={s.id} data-site-id={s.id}
                onClick={()=>setSelSite(isSel?null:s)}
                style={{padding:'10px 14px',borderBottom:`1px solid rgba(30,44,58,.4)`,cursor:'pointer',
                  background:isSel?'rgba(80,160,232,.08)':'transparent',
                  borderLeft:`3px solid ${isSel?C.b:'transparent'}`,transition:'all .15s'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <InlineIcon id={s.site_type} status={s.status} size={14} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...R,fontSize:13,fontWeight:600,color:C.tb,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</div>
                    <div style={{...Z,fontSize:8,color:C.t2}}>{s.site_type?.toUpperCase()} · {s.strike_date||'Date unknown'}</div>
                  </div>
                  <span style={{...Z,fontSize:9,padding:'1px 5px',borderRadius:1,color:sc,background:`${sc}22`}}>{s.status}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{...Z,fontSize:8,color:C.t3,flex:1}}>{s.source}</div>
                  {s.geo_confirmed&&<span style={{...Z,fontSize:8,color:C.g,border:`1px solid ${C.g}44`,padding:'1px 4px',borderRadius:1}}>✓ GEO</span>}
                  {s.x_url&&<span style={{...Z,fontSize:8,color:C.b,border:`1px solid ${C.b}44`,padding:'1px 4px',borderRadius:1}}>𝕏</span>}
                </div>
              </div>
            )
          })}
        </TierGate>
      </div>
      <div style={{overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {selSite ? (
          <SiteDetail site={selSite} auth={auth} onClose={()=>setSelSite(null)} />
        ) : (
          <>
            <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,padding:'10px 14px',borderBottom:`1px solid ${C.br}`,flexShrink:0,display:'flex',alignItems:'center',gap:10}}>
              <span>STRIKE SITES MAP</span>
              <span style={{color:C.t3}}>·</span>
              <span style={{...Z,fontSize:8,color:C.t3}}>Click marker or list item to expand</span>
            </div>
            <TierGate required="analyst" current={auth?.tier||'free'}>
              <div style={{flex:1,minHeight:400,position:'relative'}}>
                <CountryMap sites={sites} assets={[]} code={code} selSite={selSite} setSelSite={setSelSite} />
              </div>
            </TierGate>
          </>
        )}
      </div>
    </div>
  )
}

function SiteDetail({site,auth,onClose}) {
  const sc = SITE_STATUS_COL[site.status]||C.t2
  return (
    <div style={{overflow:'auto',height:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
        <InlineIcon id={site.site_type} status={site.status} size={16} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{...R,fontSize:17,fontWeight:700,color:C.tb}}>{site.name}</div>
          <div style={{...Z,fontSize:9,color:C.t2}}>{site.site_type?.toUpperCase()}</div>
        </div>
        <div style={{...Z,fontSize:12,fontWeight:700,color:sc,padding:'4px 12px',background:`${sc}22`,border:`1px solid ${sc}44`,borderRadius:1,letterSpacing:1}}>{site.status}</div>
        <button onClick={onClose} style={{...Z,fontSize:12,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 8px',cursor:'pointer'}}>✕</button>
      </div>
      <div style={{padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          {[
            {l:'STRIKE DATE',v:site.strike_date||'Unknown'},
            {l:'SOURCE',v:site.source||'—'},
            {l:'SITE TYPE',v:site.site_type?.toUpperCase()},
            {l:'STATUS',v:site.status},
          ].map(({l,v})=>(
            <div key={l} style={{padding:'8px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <div style={{...Z,fontSize:8,color:C.t3,letterSpacing:1,marginBottom:3}}>{l}</div>
              <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{v}</div>
            </div>
          ))}
        </div>
        {site.geo_confirmed&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',background:'rgba(57,224,160,.08)',border:`1px solid ${C.g}44`,borderRadius:1,marginBottom:12}}>
            <span style={{color:C.g}}>✓</span>
            <span style={{...Z,fontSize:9,color:C.g,letterSpacing:2}}>GEO-CONFIRMED LOCATION</span>
          </div>
        )}
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>ASSESSMENT</div>
        <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9,marginBottom:16}}>{site.description}</div>
        <TierGate required="premium" current={auth?.tier||'free'}>
          <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>COORDINATES</div>
          <div style={{padding:'8px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,...Z,fontSize:11,color:C.y,marginBottom:12,fontWeight:700}}>
            {parseFloat(site.lat).toFixed(6)}°N, {parseFloat(site.lng).toFixed(6)}°E
          </div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <a href={`https://www.google.com/maps?q=${site.lat},${site.lng}&t=k`} target="_blank" rel="noopener noreferrer"
              style={{...Z,fontSize:9,color:C.b,padding:'4px 10px',border:`1px solid ${C.b}44`,borderRadius:1,textDecoration:'none'}}>↗ Google Maps</a>
            <a href={`https://zoom.earth/#${site.lat},${site.lng},14z`} target="_blank" rel="noopener noreferrer"
              style={{...Z,fontSize:9,color:C.b,padding:'4px 10px',border:`1px solid ${C.b}44`,borderRadius:1,textDecoration:'none'}}>↗ Zoom.Earth</a>
          </div>
        </TierGate>
        {site.x_url&&(
          <div style={{marginBottom:16}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>SOURCE / X POST</div>
            <a href={site.x_url} target="_blank" rel="noopener noreferrer"
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,textDecoration:'none'}}>
              <span style={{...Z,fontSize:14,color:C.tb}}>𝕏</span>
              <div>
                <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{site.x_username||'View on X'}</div>
                <div style={{...Z,fontSize:9,color:C.b}}>↗ Open post</div>
              </div>
            </a>
          </div>
        )}
        {site.image_url ? (
          <div style={{marginBottom:16}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>IMAGERY</div>
            <img src={site.image_url} alt={site.image_label||'Strike imagery'}
              style={{width:'100%',borderRadius:2,border:`1px solid ${C.br}`,maxHeight:300,objectFit:'cover'}} />
          </div>
        ) : (
          <div style={{padding:'16px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,textAlign:'center',...Z,fontSize:9,color:C.t3,marginBottom:16}}>
            No imagery catalogued. Add via admin panel.
          </div>
        )}
      </div>
    </div>
  )
}

function AssetsTab({assets,auth,navigate}) {
  const groups={
    airbase:assets.filter(a=>a.asset_type==='airbase'),
    carrier:assets.filter(a=>a.asset_type==='carrier'),
    destroyer:assets.filter(a=>a.asset_type==='destroyer'),
    submarine:assets.filter(a=>a.asset_type==='submarine'),
    lmsr:assets.filter(a=>a.asset_type==='lmsr'),
  }
  return (
    <div style={{flex:1,overflow:'auto',padding:20}}>
      {Object.entries(groups).filter(([,v])=>v.length>0).map(([type,list])=>(
        <div key={type} style={{marginBottom:20}}>
          <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginBottom:10}}>{type.toUpperCase()}S ({list.length})</div>
          {list.map(a=>(
            <div key={a.id} onClick={()=>a.asset_type==='airbase'&&navigate(`/airbase/${a.icao_code||a.id}`)}
              style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',marginBottom:4,background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,cursor:a.asset_type==='airbase'?'pointer':'default'}}>
              <div style={{flex:1}}>
                <div style={{...R,fontSize:14,fontWeight:600,color:C.tb}}>{a.name}</div>
                <div style={{...Z,fontSize:9,color:C.t2}}>{a.designation||a.icao_code}</div>
              </div>
              <div style={{...Z,fontSize:9,color:a.status==='SURGE'?C.r:a.status==='ELEVATED'?C.a:C.g}}>{a.status}</div>
              {a.asset_type==='airbase'&&<span style={{...Z,fontSize:9,color:C.b}}>→ VIEW</span>}
            </div>
          ))}
        </div>
      ))}
      {assets.length===0&&<div style={{...Z,fontSize:10,color:C.t3}}>No assets logged for this country.</div>}
    </div>
  )
}

function FlightsTab({flights,auth}) {
  return (
    <div style={{flex:1,overflow:'auto'}}>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <div style={{padding:'8px 14px',background:C.bg4,borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2}}>
          {flights.length} inbound AMC flights tracked to this country
        </div>
        {flights.length===0?(
          <div style={{...Z,fontSize:10,color:C.t3,padding:20}}>No flights tracked to this country's ICAO codes.</div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{background:C.bg4}}>
                {['DATE','CALLSIGN','HEX','ORIGIN','DESTINATION','TYPE','STATUS'].map(h=>(
                  <th key={h} style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,padding:'6px 10px',borderBottom:`1px solid ${C.br}`,textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flights.map(f=>(
                <tr key={f.id} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                  <td style={{padding:'5px 10px',...Z,color:C.t3,fontSize:10}}>{f.dep_date?.slice(5)||'—'}</td>
                  <td style={{padding:'5px 10px',...R,fontWeight:700,color:C.tb,fontSize:12}}>{f.callsign?.replace(/^REACH\s*/i,'RCH')}</td>
                  <td style={{padding:'5px 10px',...Z,color:C.y,fontSize:10}}>{f.hex||'—'}</td>
                  <td style={{padding:'5px 10px',...Z,color:C.b,fontSize:10}}>{f.base||'—'}</td>
                  <td style={{padding:'5px 10px',...Z,color:C.g,fontSize:10}}>{f.destination||'—'}</td>
                  <td style={{padding:'5px 10px'}}>
                    <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:1,
                      background:f.mc_flag==='socom'?'rgba(160,96,232,.15)':'rgba(80,160,232,.12)',
                      border:`1px solid ${f.mc_flag==='socom'?'rgba(160,96,232,.4)':'rgba(80,160,232,.3)'}`,
                      color:f.mc_flag==='socom'?C.p:C.b}}>
                      {f.mc_flag==='socom'?'SOCOM':'AMC'}
                    </span>
                  </td>
                  <td style={{padding:'5px 10px',...R,fontSize:10,color:{ACTIVE:C.g,COMPLETE:C.t3}[f.status]||C.t2}}>{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TierGate>
    </div>
  )
}

function ImageryTab({assetId,auth}) {
  const [images,setImages] = useState([])
  useEffect(()=>{
    supabase.from('imagery_meta').select('*').eq('asset_id',assetId).eq('asset_type','country')
      .order('created_at',{ascending:false}).then(({data})=>setImages(data||[]))
  },[assetId])
  return (
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <TierGate required="premium" current={auth?.tier||'free'}>
        {images.length===0?(
          <div style={{textAlign:'center',padding:40,...Z,fontSize:10,color:C.t3}}>
            No imagery catalogued for this country yet.
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {images.map(img=>(
              <div key={img.id} style={{background:C.bg3,border:`1px solid ${C.br}`,borderRadius:2,overflow:'hidden'}}>
                <div style={{height:120,background:'#0c1018',display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:9,color:C.t3}}>[SAT IMAGE]</div>
                <div style={{padding:'8px 10px'}}>
                  <div style={{...R,fontSize:12,fontWeight:600,color:C.tb}}>{img.label}</div>
                  <div style={{...Z,fontSize:9,color:C.t2}}>{img.captured_date} · {img.source}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TierGate>
    </div>
  )
}
