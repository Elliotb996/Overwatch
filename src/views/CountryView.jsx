import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

const Z = { fontFamily:"'Share Tech Mono',monospace" }
const R = { fontFamily:"'Rajdhani',sans-serif" }
const C = {
  g:'#39e0a0',a:'#f0a040',r:'#e85040',b:'#50a0e8',p:'#a060e8',
  y:'#e8d040',t1:'#b8ccd8',t2:'#4a6070',t3:'#28404c',tb:'#dceaf0',
  bg:'#07090b',bg2:'#0c1018',bg3:'#101620',bg4:'#161e28',br:'#1e2c3a',br2:'#273a4c',
}

const ESC_COLORS = {
  CRITICAL:{c:'#e85040',bg:'rgba(232,80,64,.15)',border:'rgba(232,80,64,.4)'},
  HIGH:    {c:'#f0a040',bg:'rgba(240,160,64,.12)',border:'rgba(240,160,64,.35)'},
  ELEVATED:{c:'#e8d040',bg:'rgba(232,208,64,.1)', border:'rgba(232,208,64,.3)'},
  MODERATE:{c:'#50a0e8',bg:'rgba(80,160,232,.1)', border:'rgba(80,160,232,.3)'},
  WATCH:   {c:'#4a6070',bg:'rgba(74,96,112,.1)',  border:'rgba(74,96,112,.3)'},
  SURGE:   {c:'#e85040',bg:'rgba(232,80,64,.15)', border:'rgba(232,80,64,.4)'},
}
const SITE_ICONS = {
  strike:'💥',nuclear:'☢️',missile:'🚀',naval:'⚓',airbase:'✈',facility:'🏭',radar:'📡',
}
const SITE_STATUS_COL = {
  DESTROYED:C.r, DAMAGED:C.a, ACTIVE:C.g, UNKNOWN:C.t2,
}

function mkIcon(emoji,color,size=22) {
  const s=size+12
  return L.divIcon({
    html:`<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(7,9,11,.9);border:1.5px solid ${color};border-radius:2px;font-size:${Math.round(size*.5)}px;box-shadow:0 0 8px ${color}44">${emoji}</div>`,
    className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],
  })
}

function TierGate({required,current,children}) {
  const TIER_ORDER={free:0,analyst:1,premium:2,admin:3}
  const ok=(TIER_ORDER[current]||0)>=(TIER_ORDER[required]||0)
  if(ok) return children
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:12,background:'rgba(7,9,11,.6)',border:`1px solid ${C.br}`,borderRadius:2,textAlign:'center'}}>
      <div style={{fontSize:24,opacity:.4}}>🔒</div>
      <div style={{...R,fontSize:13,fontWeight:700,color:C.t2,letterSpacing:2}}>{required.toUpperCase()} TIER REQUIRED</div>
      <div style={{...Z,fontSize:9,color:C.t3,maxWidth:220}}>Upgrade your subscription to access this intelligence layer.</div>
    </div>
  )
}

export function CountryView({auth}) {
  const {code} = useParams()
  const navigate = useNavigate()
  const [intel,setIntel] = useState(null)
  const [sites,setSites] = useState([])
  const [assets,setAssets] = useState([])
  const [flights,setFlights] = useState([])
  const [loading,setLoading] = useState(true)
  const [tab,setTab] = useState('OVERVIEW')
  const [selSite,setSelSite] = useState(null)

  useEffect(()=>{
    async function load() {
      const [{data:intel},{data:sites},{data:assets},{data:flights}] = await Promise.all([
        supabase.from('country_intel').select('*').eq('code',code.toUpperCase()).single(),
        supabase.from('strike_sites').select('*').eq('country_code',code.toUpperCase()).order('strike_date',{ascending:false}),
        supabase.from('assets').select('*').order('asset_type'),
        supabase.from('amc_flights').select('*').order('dep_date',{ascending:false}).limit(500),
      ])
      setIntel(intel)
      setSites(sites||[])
      // Filter assets by country - match against country code mapping
      const countryAssets=(assets||[]).filter(a=>getCountryCode(a.country?.trim())===code.toUpperCase())
      setAssets(countryAssets)
      // Filter flights by destinations in this country
      const destIcaos=getCountryICAOs(code.toUpperCase())
      setFlights((flights||[]).filter(f=>destIcaos.includes(f.destination?.toUpperCase())))
      setLoading(false)
    }
    load()
  },[code])

  if(loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,...Z,color:C.t2,fontSize:11,letterSpacing:3}}>
      LOADING INTEL...
    </div>
  )

  const esc = ESC_COLORS[intel?.escalation||'WATCH']
  const tabs=['OVERVIEW','STRIKE SITES','ASSETS','FLIGHTS','IMAGERY']

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      {/* Header */}
      <div style={{background:C.bg4,borderBottom:`1px solid ${C.br}`,padding:'0 20px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16,height:52}}>
          <button onClick={()=>navigate('/')}
            style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 12px',cursor:'pointer',letterSpacing:2}}>
            ← WORLD MAP
          </button>
          <div style={{...R,fontSize:20,fontWeight:700,color:C.tb}}>{intel?.name||code}</div>
          <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3}}>{code.toUpperCase()}</div>
          {intel?.escalation&&(
            <div style={{...R,fontSize:12,fontWeight:700,padding:'3px 12px',borderRadius:1,color:esc.c,background:esc.bg,border:`1px solid ${esc.border}`,letterSpacing:2}}>
              {intel.escalation}
            </div>
          )}
          {intel?.threat_window&&intel.threat_window!=='N/A'&&intel.threat_window!=='N/A - cooperative'&&intel.threat_window!=='Ongoing'&&(
            <div style={{...Z,fontSize:9,color:C.a,letterSpacing:1}}>⏱ {intel.threat_window}</div>
          )}
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <span style={{...Z,fontSize:9,color:C.t3}}>▲ {flights.length} flights</span>
            <span style={{...Z,fontSize:9,color:C.t3}}>◉ {sites.length} sites</span>
            <span style={{...Z,fontSize:9,color:C.t3}}>✈ {assets.filter(a=>a.asset_type==='airbase').length} bases</span>
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

      {/* Content */}
      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {tab==='OVERVIEW'&&<OverviewTab intel={intel} sites={sites} assets={assets} flights={flights} auth={auth} navigate={navigate} />}
        {tab==='STRIKE SITES'&&<StrikeSitesTab sites={sites} auth={auth} selSite={selSite} setSelSite={setSelSite} code={code} />}
        {tab==='ASSETS'&&<AssetsTab assets={assets} auth={auth} navigate={navigate} />}
        {tab==='FLIGHTS'&&<FlightsTab flights={flights} auth={auth} />}
        {tab==='IMAGERY'&&<ImageryTab assetId={code.toUpperCase()} assetType="country" auth={auth} />}
      </div>
    </div>
  )
}

function OverviewTab({intel,sites,assets,flights,auth,navigate}) {
  const esc=ESC_COLORS[intel?.escalation||'WATCH']
  const airbases=assets.filter(a=>a.asset_type==='airbase')
  const naval=assets.filter(a=>['carrier','destroyer','submarine'].includes(a.asset_type))
  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'auto',gap:0}}>
      {/* Left: Intel summary */}
      <div style={{borderRight:`1px solid ${C.br}`,overflow:'auto',padding:24}}>
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginBottom:12}}>INTEL ASSESSMENT</div>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9,marginBottom:20}}>{intel?.summary||'No assessment on file.'}</div>
          {intel?.notes&&(
            <div style={{padding:'10px 14px',background:C.bg3,borderLeft:`2px solid ${C.a}`,marginBottom:16}}>
              <div style={{...Z,fontSize:9,color:C.t3,marginBottom:4,letterSpacing:2}}>NOTES</div>
              <div style={{...Z,fontSize:10,color:C.t2,lineHeight:1.7}}>{intel.notes}</div>
            </div>
          )}
        </TierGate>
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginTop:20,marginBottom:12}}>QUICK STATS</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {[
            {v:flights.length,l:'AMC FLIGHTS',c:C.b},
            {v:sites.length,l:'STRIKE SITES',c:C.r},
            {v:airbases.length,l:'AIRBASES',c:C.g},
            {v:flights.filter(f=>f.mc_flag==='socom').length,l:'SOCOM',c:C.p},
            {v:naval.length,l:'NAVAL ASSETS',c:C.b},
            {v:sites.filter(s=>s.status==='DESTROYED').length,l:'DESTROYED',c:C.r},
          ].map(({v,l,c})=>(
            <div key={l} style={{padding:'10px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <div style={{...R,fontSize:18,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{...Z,fontSize:8,color:C.t3,marginTop:3,letterSpacing:1}}>{l}</div>
            </div>
          ))}
        </div>
        {airbases.length>0&&(
          <div style={{marginTop:20}}>
            <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,marginBottom:10}}>ACTIVE BASES</div>
            {airbases.map(a=>(
              <div key={a.id} onClick={()=>navigate(`/airbase/${a.icao_code||a.id}`)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',marginBottom:4,background:C.bg3,border:`1px solid ${C.br}`,cursor:'pointer',borderRadius:1}}>
                <span style={{fontSize:14}}>✈</span>
                <div style={{flex:1}}>
                  <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{a.name}</div>
                  <div style={{...Z,fontSize:9,color:C.t2}}>{a.designation}</div>
                </div>
                <div style={{...Z,fontSize:9,color:
                  a.status==='SURGE'?C.r:a.status==='ELEVATED'?C.a:C.g}}>{a.status}</div>
                <span style={{...Z,fontSize:9,color:C.t3}}>→</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Right: mini strike map */}
      <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,padding:'12px 16px',borderBottom:`1px solid ${C.br}`,flexShrink:0}}>KNOWN STRIKE SITES / ASSETS</div>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{flex:1,minHeight:300}}>
            <CountryMap sites={sites} assets={assets} code={intel?.code} />
          </div>
        </TierGate>
        {sites.slice(0,5).length>0&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${C.br}`,maxHeight:200,overflow:'auto'}}>
            <TierGate required="analyst" current={auth?.tier||'free'}>
              {sites.slice(0,5).map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                  <span style={{fontSize:14}}>{SITE_ICONS[s.site_type]||'💥'}</span>
                  <div style={{flex:1}}>
                    <div style={{...R,fontSize:12,fontWeight:600,color:C.tb}}>{s.name}</div>
                    <div style={{...Z,fontSize:9,color:C.t2}}>{s.strike_date||'Date unknown'} · {s.source}</div>
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

function CountryMap({sites,assets,code}) {
  const center=getCountryCenter(code)
  return (
    <MapContainer center={center} zoom={5} style={{width:'100%',height:'100%'}} zoomControl={false} attributionControl={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={18} />
      {sites.filter(s=>s.lat&&s.lng).map(s=>(
        <Marker key={s.id} position={[parseFloat(s.lat),parseFloat(s.lng)]}
          icon={mkIcon(SITE_ICONS[s.site_type]||'💥',SITE_STATUS_COL[s.status]||'#e85040',20)}>
          <Popup closeButton={false}>
            <div style={{...Z,fontSize:10,minWidth:160}}>
              <div style={{...R,fontSize:12,fontWeight:700,color:'#dceaf0',marginBottom:3}}>{s.name}</div>
              <div style={{color:SITE_STATUS_COL[s.status]||'#e85040',marginBottom:2}}>{s.status}</div>
              <div style={{color:'#4a6070',fontSize:9}}>{s.description?.slice(0,80)}...</div>
            </div>
          </Popup>
        </Marker>
      ))}
      {assets.filter(a=>a.lat&&a.lng&&a.asset_type==='airbase').map(a=>(
        <Marker key={a.id} position={[parseFloat(a.lat),parseFloat(a.lng)]}
          icon={mkIcon('✈','#50a0e8',20)}>
          <Popup closeButton={false}>
            <div style={{...Z,fontSize:10}}><div style={{...R,fontSize:12,fontWeight:700,color:'#dceaf0'}}>{a.name}</div></div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

function StrikeSitesTab({sites,auth,selSite,setSelSite,code}) {
  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'340px 1fr',overflow:'hidden'}}>
      <div style={{borderRight:`1px solid ${C.br}`,overflow:'auto'}}>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          {sites.length===0&&<div style={{...Z,fontSize:10,color:C.t3,padding:20}}>No strike sites logged for this country.</div>}
          {sites.map(s=>{
            const sc=SITE_STATUS_COL[s.status]||C.t2
            return (
              <div key={s.id} onClick={()=>setSelSite(selSite?.id===s.id?null:s)}
                style={{padding:'10px 14px',borderBottom:`1px solid rgba(30,44,58,.4)`,cursor:'pointer',
                  background:selSite?.id===s.id?'rgba(80,160,232,.06)':'transparent',
                  borderLeft:`2px solid ${selSite?.id===s.id?C.b:'transparent'}`}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:16}}>{SITE_ICONS[s.site_type]||'💥'}</span>
                  <div style={{flex:1}}>
                    <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{s.name}</div>
                    <div style={{...Z,fontSize:9,color:C.t2}}>{s.site_type?.toUpperCase()} · {s.strike_date||'Date unknown'}</div>
                  </div>
                  <span style={{...Z,fontSize:9,padding:'1px 5px',borderRadius:1,color:sc,background:`${sc}22`}}>{s.status}</span>
                </div>
                <div style={{...Z,fontSize:9,color:C.t3}}>{s.source}</div>
              </div>
            )
          })}
        </TierGate>
      </div>
      <div style={{overflow:'auto',display:'flex',flexDirection:'column'}}>
        {selSite ? (
          <SiteDetail site={selSite} auth={auth} />
        ) : (
          <div style={{flex:1,display:'flex',flexDirection:'column'}}>
            <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,padding:'12px 16px',borderBottom:`1px solid ${C.br}`}}>STRIKE SITES MAP</div>
            <TierGate required="analyst" current={auth?.tier||'free'}>
              <div style={{flex:1,minHeight:400}}>
                <CountryMap sites={sites} assets={[]} code={code} />
              </div>
            </TierGate>
          </div>
        )}
      </div>
    </div>
  )
}

function SiteDetail({site,auth}) {
  const sc=SITE_STATUS_COL[site.status]||C.t2
  return (
    <div style={{padding:20,overflow:'auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
        <span style={{fontSize:24}}>{SITE_ICONS[site.site_type]||'💥'}</span>
        <div>
          <div style={{...R,fontSize:18,fontWeight:700,color:C.tb}}>{site.name}</div>
          <div style={{...Z,fontSize:10,color:C.t2}}>{site.site_type?.toUpperCase()}</div>
        </div>
        <div style={{marginLeft:'auto',...Z,fontSize:13,fontWeight:700,color:sc,padding:'4px 12px',background:`${sc}22`,border:`1px solid ${sc}44`,borderRadius:1}}>
          {site.status}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
        {[
          {l:'STRIKE DATE',v:site.strike_date||'Unknown'},
          {l:'SOURCE',v:site.source||'—'},
          {l:'TIER',v:site.tier_required?.toUpperCase()},
        ].map(({l,v})=>(
          <div key={l} style={{padding:'8px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
            <div style={{...Z,fontSize:8,color:C.t3,letterSpacing:1,marginBottom:3}}>{l}</div>
            <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>ASSESSMENT</div>
      <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9,marginBottom:16}}>{site.description}</div>
      <TierGate required="premium" current={auth?.tier||'free'}>
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>COORDINATES</div>
        <div style={{padding:'8px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,...Z,fontSize:11,color:C.y}}>
          {parseFloat(site.lat).toFixed(6)}°N, {parseFloat(site.lng).toFixed(6)}°E
        </div>
        {site.source_url&&(
          <div style={{marginTop:12,...Z,fontSize:9,color:C.b}}>
            <a href={site.source_url} target="_blank" rel="noopener noreferrer" style={{color:C.b}}>↗ Source link</a>
          </div>
        )}
      </TierGate>
    </div>
  )
}

function AssetsTab({assets,auth,navigate}) {
  const groups={
    carrier:assets.filter(a=>a.asset_type==='carrier'),
    destroyer:assets.filter(a=>a.asset_type==='destroyer'),
    submarine:assets.filter(a=>a.asset_type==='submarine'),
    airbase:assets.filter(a=>a.asset_type==='airbase'),
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
                <div style={{...Z,fontSize:9,color:C.t2}}>{a.designation}</div>
              </div>
              <div style={{...Z,fontSize:9,color:a.status==='SURGE'?C.r:a.status==='ELEVATED'?C.a:C.g}}>{a.status}</div>
              {a.asset_type==='airbase'&&<span style={{...Z,fontSize:9,color:C.t3}}>→ VIEW</span>}
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
          {flights.length} inbound flights tracked to this country
        </div>
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
      </TierGate>
    </div>
  )
}

function ImageryTab({assetId,assetType,auth}) {
  const [images,setImages]=useState([])
  const [sel,setSel]=useState(null)
  useEffect(()=>{
    supabase.from('imagery_meta').select('*').eq('asset_id',assetId).eq('asset_type',assetType)
      .order('created_at',{ascending:false})
      .then(({data})=>setImages(data||[]))
  },[assetId,assetType])
  return (
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <TierGate required="premium" current={auth?.tier||'free'}>
        {images.length===0?(
          <div style={{textAlign:'center',padding:40,...Z,fontSize:10,color:C.t3}}>
            <div style={{fontSize:24,marginBottom:12,opacity:.3}}>🛰</div>
            No imagery catalogued for this location yet.<br/>
            <span style={{fontSize:9,color:C.t3,marginTop:8,display:'block'}}>Imagery can be uploaded via the admin panel.</span>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {images.map(img=>(
              <div key={img.id} onClick={()=>setSel(sel?.id===img.id?null:img)}
                style={{background:C.bg3,border:`1px solid ${sel?.id===img.id?C.b:C.br}`,borderRadius:2,overflow:'hidden',cursor:'pointer'}}>
                <div style={{height:120,background:'#0c1018',display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:9,color:C.t3}}>
                  [SAT IMAGE]
                </div>
                <div style={{padding:'8px 10px'}}>
                  <div style={{...R,fontSize:12,fontWeight:600,color:C.tb}}>{img.label}</div>
                  <div style={{...Z,fontSize:9,color:C.t2}}>{img.captured_date||'Date unknown'} · {img.source}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TierGate>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────
function getCountryCode(country) {
  const map={US:'US',UK:'GB',GB:'GB',FR:'FR',DE:'DE',JO:'JO',IL:'IL',KW:'KW',SA:'SA',QA:'QA',AE:'AE',GR:'GR',IT:'IT'}
  return map[country]||country
}
function getCountryICAOs(code) {
  const map={
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
  }
  return map[code]||[]
}
function getCountryCenter(code) {
  const map={
    IR:[32.5,53.7],JO:[31.2,36.5],IL:[31.5,35.0],KW:[29.3,47.5],
    SA:[24.0,45.0],AE:[24.5,54.5],DE:[51.0,10.0],GB:[52.5,0.0],
    GR:[38.0,23.0],QA:[25.3,51.2],IT:[42.0,12.5],FR:[46.0,2.0],
  }
  return map[code]||[30,40]
}
