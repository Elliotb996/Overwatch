import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

const Z={fontFamily:"'Share Tech Mono',monospace"}
const R={fontFamily:"'Rajdhani',sans-serif"}
const C={
  g:'#39e0a0',a:'#f0a040',r:'#e85040',b:'#50a0e8',p:'#a060e8',
  y:'#e8d040',t1:'#b8ccd8',t2:'#4a6070',t3:'#28404c',tb:'#dceaf0',
  bg:'#07090b',bg2:'#0c1018',bg3:'#101620',bg4:'#161e28',br:'#1e2c3a',
}
const STATIC_ASSETS=[
  {id:'otbh',icao:'OTBH',name:'Al Udeid AB',sub:'OTBH // Qatar',country:'US',status:'SURGE',lat:25.117,lng:51.314,arrCnt:14,socomCnt:4,intel:'14 AMC arrivals/48h. Y-series SOCOM=4. Surge sustained.',aircraftTypes:[{type:'B-52H Stratofortress',qty:'2x (surged)',role:'Strategic Bomber',tails:['60-0040','60-0047']},{type:'F-35A Lightning II',qty:'12x',role:'Strike'},{type:'F-15E Strike Eagle',qty:'8x',role:'Strike'},{type:'KC-46A Pegasus',qty:'4x',role:'Tanker'},{type:'E-3 AWACS',qty:'2x',role:'AEW&C'}],tags:['SURGE','CENTCOM','OP-EPIC-FURY']},
  {id:'llov',icao:'LLOV',name:'Ovda AB',sub:'LLOV // Israel',country:'US',status:'ELEVATED',lat:29.94,lng:34.935,arrCnt:26,socomCnt:12,intel:'26 confirmed arrivals. All SOCOM flagged.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'26+ arrivals',role:'Strategic Airlift',tails:['00-0181','07-7178','02-1110']}],tags:['SURGE','IDF']},
  {id:'ojka',icao:'OJKA',name:'King Abdullah II AB',sub:'OJKA // Jordan',country:'US',status:'ELEVATED',lat:32.356,lng:36.259,arrCnt:30,socomCnt:12,intel:'Highest single-destination volume. Onward to OJMS.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'30+ arrivals',role:'SAAM/SOCOM/Army'}],tags:['JORDAN','HIGHEST-VOLUME']},
  {id:'ojms',icao:'OJMS',name:'Muwaffaq Salti AB',sub:'OJMS // Jordan (Azraq)',country:'US',status:'ELEVATED',lat:31.827,lng:36.789,arrCnt:19,socomCnt:0,intel:'Low-visibility base. FJDG→HDAM→OJMS routing confirmed.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'19+ tracked',role:'Strategic Airlift'}],tags:['JORDAN','LOW-VISIBILITY']},
  {id:'okas',icao:'OKAS',name:'Ali Al Salem AB',sub:'OKAS // Kuwait',country:'US',status:'ELEVATED',lat:29.346,lng:47.519,arrCnt:10,socomCnt:2,intel:'Army-Z mission series dominant.',aircraftTypes:[{type:'C-17A',qty:'10+',role:'Army/SOCOM Airlift'}],tags:['KUWAIT','ARMY-Z']},
  {id:'oeps',icao:'OEPS',name:'Prince Sultan AB',sub:'OEPS // Saudi Arabia',country:'US',status:'ELEVATED',lat:24.062,lng:47.580,arrCnt:16,socomCnt:0,intel:'Major build-up. C-5M = heavy equipment.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'14x',role:'Strategic Airlift'},{type:'C-5M Super Galaxy',qty:'4x',role:'Strategic Airlift'}],tags:['KSA']},
  {id:'egva',icao:'EGVA',name:'RAF Fairford',sub:'EGVA // UK — USAF BOMBER HUB',country:'US',status:'SURGE',lat:51.682,lng:-1.790,arrCnt:0,socomCnt:0,intel:'8x B-52H + 18+ B-1B. Largest US forward bomber deployment since Gulf War.',aircraftTypes:[{type:'B-52H Stratofortress',qty:'8x',role:'Strategic Bomber — Op EPIC FURY',tails:['61-0001(FLIP 61)','60-0060(HOOKY 22)','60-0007(HOOKY 23)']},{type:'B-1B Lancer',qty:'18x+',role:'Strategic Bomber — Op EPIC FURY',tails:['86-0102(TWIN 43)','86-0129(TWIN 44)','85-0072(TWIN 42)']}],tags:['SURGE','B-52H','B-1B']},
  {id:'egun',icao:'EGUN',name:'RAF Mildenhall',sub:'EGUN // UK — SOCOM/AFSOC HUB',country:'US',status:'SURGE',lat:52.362,lng:0.486,arrCnt:41,socomCnt:41,intel:'41+ MC-130J staged. 11x Silent Knight. Mass departure 25-26 Mar.',aircraftTypes:[{type:'MC-130J Commando II',qty:'41+ (11x Silent Knight)',role:'SOCOM Assault/Infiltration'},{type:'AC-130',qty:'3x',role:'Gunship'}],tags:['SURGE','MC-130J']},
]

function TierGate({required,current,children}) {
  const TO={free:0,analyst:1,premium:2,admin:3}
  if((TO[current]||0)>=(TO[required]||0)) return children
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,gap:10,textAlign:'center'}}>
      <div style={{fontSize:28,opacity:.3}}>🔒</div>
      <div style={{...R,fontSize:13,fontWeight:700,color:C.t2,letterSpacing:2}}>{required.toUpperCase()} TIER</div>
      <div style={{...Z,fontSize:9,color:C.t3}}>Upgrade to access this intelligence layer</div>
    </div>
  )
}

function normCallsign(cs){return cs?cs.replace(/^REACH\s*/i,'RCH').toUpperCase():'—'}

export function AirbaseView({auth}) {
  const {icao}=useParams()
  const navigate=useNavigate()
  const code=icao.toUpperCase()
  const [flights,setFlights]=useState([])
  const [images,setImages]=useState([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('OVERVIEW')

  // Find static asset or load from DB
  const staticA=STATIC_ASSETS.find(a=>a.icao===code||a.id===code.toLowerCase())
  const [asset,setAsset]=useState(staticA||null)

  useEffect(()=>{
    async function load(){
      const [{data:dbAsset},{data:fl},{data:imgs}]=await Promise.all([
        supabase.from('assets').select('*').or(`icao_code.eq.${code},id.eq.${code.toLowerCase()}`).single(),
        supabase.from('amc_flights').select('*').or(`destination.eq.${code},base.eq.${code}`).order('dep_date',{ascending:false}),
        supabase.from('imagery_meta').select('*').eq('asset_id',code).eq('asset_type','airbase').order('created_at',{ascending:false}),
      ])
      // Merge DB with static
      if(dbAsset&&!staticA) setAsset({
        id:dbAsset.icao_code?.toLowerCase()||dbAsset.id,
        icao:dbAsset.icao_code||code,
        name:dbAsset.name,sub:dbAsset.designation,
        status:dbAsset.status,lat:parseFloat(dbAsset.lat),lng:parseFloat(dbAsset.lng),
        arrCnt:dbAsset.arr_count||0,socomCnt:dbAsset.socom_count||0,
        intel:dbAsset.intel_assessment,notes:dbAsset.notes,
        tags:dbAsset.tags||[],aircraftTypes:[],
      })
      setFlights(fl||[])
      setImages(imgs||[])
      setLoading(false)
    }
    load()
  },[code])

  if(loading||!asset) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,...Z,color:C.t2,fontSize:11,letterSpacing:3}}>
      {loading?'LOADING...':'AIRBASE NOT FOUND'}
    </div>
  )

  const inbound=flights.filter(f=>f.destination===code)
  const outbound=flights.filter(f=>f.base===code)
  const socom=inbound.filter(f=>f.mc_flag==='socom').length
  const stCol={SURGE:C.r,ELEVATED:C.a,ACTIVE:C.g,MODERATE:C.b}[asset.status]||C.g
  const tabs=['OVERVIEW','ARRIVALS','DEPARTURES','AIRCRAFT','AIRFIELD MAP','IMAGERY','INTEL']

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      {/* Header */}
      <div style={{background:C.bg4,borderBottom:`1px solid ${C.br}`,padding:'0 20px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16,height:52}}>
          <button onClick={()=>navigate(-1)}
            style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 12px',cursor:'pointer',letterSpacing:2}}>
            ← BACK
          </button>
          <span style={{fontSize:18}}>✈</span>
          <div style={{...R,fontSize:20,fontWeight:700,color:C.tb}}>{asset.name}</div>
          <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub}</div>
          <div style={{...Z,fontSize:11,fontWeight:700,padding:'3px 12px',borderRadius:1,color:stCol,background:`${stCol}22`,border:`1px solid ${stCol}44`,letterSpacing:2}}>
            {asset.status}
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:16}}>
            {[{v:inbound.length,l:'INBOUND',c:C.a},{v:outbound.length,l:'OUTBOUND',c:C.b},{v:socom,l:'SOCOM',c:C.p}].map(({v,l,c})=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{...R,fontSize:18,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                <div style={{...Z,fontSize:8,color:C.t3,letterSpacing:1}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:0,borderTop:`1px solid ${C.br}`}}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'8px 14px',cursor:'pointer',
                color:tab===t?C.a:C.t2,background:'transparent',border:'none',
                borderBottom:`2px solid ${tab===t?C.a:'transparent'}`,whiteSpace:'nowrap'}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        {tab==='OVERVIEW'&&<AirbaseOverview asset={asset} inbound={inbound} outbound={outbound} socom={socom} auth={auth} navigate={navigate} />}
        {tab==='ARRIVALS'&&<FlightTab flights={inbound} label="inbound" auth={auth} />}
        {tab==='DEPARTURES'&&<FlightTab flights={outbound} label="outbound" auth={auth} />}
        {tab==='AIRCRAFT'&&<AircraftTab aircraft={asset.aircraftTypes} auth={auth} />}
        {tab==='AIRFIELD MAP'&&<AirfieldMapTab asset={asset} auth={auth} />}
        {tab==='IMAGERY'&&<AirbaseImageryTab images={images} auth={auth} code={code} />}
        {tab==='INTEL'&&<IntelTab asset={asset} auth={auth} />}
      </div>
    </div>
  )
}

function AirbaseOverview({asset,inbound,outbound,socom,auth,navigate}) {
  const stCol={SURGE:C.r,ELEVATED:C.a,ACTIVE:C.g}[asset.status]||C.g
  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'auto',gap:0}}>
      <div style={{borderRight:`1px solid ${C.br}`,overflow:'auto',padding:24}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20}}>
          {[{v:inbound.length,l:'INBOUND',c:C.a},{v:outbound.length,l:'OUTBOUND',c:C.b},{v:socom,l:'SOCOM',c:C.p},{v:asset.arrCnt||inbound.length,l:'TOTAL ARRIVALS',c:C.g},{v:inbound.filter(f=>new Date(f.dep_date)>=new Date(Date.now()-7*864e5)).length,l:'LAST 7D',c:C.b},{v:asset.aircraftTypes?.length||0,l:'AC TYPES',c:C.y}].map(({v,l,c})=>(
            <div key={l} style={{padding:'10px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <div style={{...R,fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{...Z,fontSize:8,color:C.t3,marginTop:3,letterSpacing:1}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>INTEL ASSESSMENT</div>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9,marginBottom:16}}>{asset.intel||'No assessment on file.'}</div>
        </TierGate>
        {asset.tags?.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:12}}>
            {asset.tags.map(t=><span key={t} style={{...Z,fontSize:9,padding:'2px 5px',borderRadius:1,background:'rgba(57,224,160,.08)',border:'1px solid rgba(57,224,160,.2)',color:C.g}}>{t}</span>)}
          </div>
        )}
        {/* Top destinations */}
        {inbound.length>0&&(
          <div style={{marginTop:20}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:10}}>TOP ORIGINS (INBOUND)</div>
            {Object.entries(inbound.reduce((a,f)=>{a[f.base]=(a[f.base]||0)+1;return a},{}))
              .sort((a,b)=>b[1]-a[1]).slice(0,6).map(([base,n])=>(
              <div key={base} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                <span style={{...Z,fontSize:10,color:C.b,width:48}}>{base}</span>
                <div style={{flex:1,height:4,background:'#0c1018',borderRadius:2,overflow:'hidden'}}>
                  <div style={{width:`${(n/inbound.length)*100}%`,height:'100%',background:C.b,borderRadius:2}} />
                </div>
                <span style={{...Z,fontSize:10,color:C.t2,width:14,textAlign:'right'}}>{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Mini map */}
      <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{...Z,fontSize:9,letterSpacing:3,color:C.t3,padding:'12px 16px',borderBottom:`1px solid ${C.br}`,flexShrink:0}}>LOCATION</div>
        {asset.lat&&asset.lng&&(
          <div style={{flex:1,minHeight:300}}>
            <MapContainer center={[asset.lat,asset.lng]} zoom={10} style={{width:'100%',height:'100%'}} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={18} />
              <Marker position={[asset.lat,asset.lng]}
                icon={L.divIcon({html:`<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(7,9,11,.9);border:2px solid ${stCol};border-radius:2px;font-size:14px;box-shadow:0 0 16px ${stCol}88">✈</div>`,className:'',iconSize:[28,28],iconAnchor:[14,14]})} />
            </MapContainer>
          </div>
        )}
        {/* Recent arrivals preview */}
        <div style={{flexShrink:0,borderTop:`1px solid ${C.br}`,maxHeight:200,overflow:'auto'}}>
          <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,padding:'8px 12px',borderBottom:`1px solid ${C.br}`}}>RECENT ARRIVALS</div>
          <TierGate required="analyst" current={auth?.tier||'free'}>
            {inbound.slice(0,5).map(f=>(
              <div key={f.id} style={{display:'flex',gap:8,padding:'6px 12px',borderBottom:`1px solid rgba(30,44,58,.3)`,...Z,fontSize:10}}>
                <span style={{color:C.t3,width:30}}>{f.dep_date?.slice(5)||'—'}</span>
                <span style={{color:C.tb,fontWeight:600,width:64}}>{normCallsign(f.callsign)}</span>
                <span style={{color:C.b,flex:1}}>{f.base||'—'}</span>
                <span style={{color:f.mc_flag==='socom'?C.p:C.t2,fontSize:9}}>{f.mc_flag==='socom'?'SOCOM':'AMC'}</span>
              </div>
            ))}
          </TierGate>
        </div>
      </div>
    </div>
  )
}

function AirfieldMapTab({asset,auth}) {
  const osmUrl=`https://www.openstreetmap.org/export/embed.html?bbox=${asset.lng-0.05},${asset.lat-0.05},${asset.lng+0.05},${asset.lat+0.05}&layer=mapnik&marker=${asset.lat},${asset.lng}`
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,padding:'10px 16px',borderBottom:`1px solid ${C.br}`,flexShrink:0,display:'flex',gap:16}}>
        <span>AIRFIELD MAP — OpenStreetMap</span>
        <a href={`https://www.openstreetmap.org/?mlat=${asset.lat}&mlon=${asset.lng}&zoom=14`} target="_blank" rel="noopener noreferrer"
          style={{color:C.b,fontSize:9}}>↗ Full map</a>
        <a href={`https://www.google.com/maps?q=${asset.lat},${asset.lng}&z=14&t=k`} target="_blank" rel="noopener noreferrer"
          style={{color:C.b,fontSize:9}}>↗ Google Satellite</a>
      </div>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <iframe
          src={osmUrl}
          style={{flex:1,border:'none',width:'100%'}}
          title="Airfield Map"
        />
      </TierGate>
    </div>
  )
}

function AirbaseImageryTab({images,auth,code}) {
  const [sel,setSel]=useState(null)
  return (
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <TierGate required="premium" current={auth?.tier||'free'}>
        {images.length===0?(
          <div style={{textAlign:'center',padding:40,...Z,fontSize:10,color:C.t3}}>
            <div style={{fontSize:28,marginBottom:12,opacity:.3}}>🛰</div>
            No imagery catalogued for {code}.<br/>
            <span style={{fontSize:9,color:C.t3,marginTop:8,display:'block'}}>Upload via admin panel → Assets → Imagery.</span>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {images.map(img=>(
              <div key={img.id} onClick={()=>setSel(sel?.id===img.id?null:img)}
                style={{background:C.bg3,border:`1px solid ${sel?.id===img.id?C.b:C.br}`,borderRadius:2,overflow:'hidden',cursor:'pointer'}}>
                <div style={{height:130,background:'#0c1018',display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:9,color:C.t3}}>
                  [IMAGERY]
                </div>
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

function AircraftTab({aircraft,auth}) {
  const AC_CAT={
    'Strategic Bomber':{icon:'💣',color:'#e85040',order:1},
    'Fighter':{icon:'⚡',color:'#e85040',order:2},
    'Strike':{icon:'🎯',color:'#f0a040',order:3},
    'EW':{icon:'📡',color:'#a060e8',order:4},
    'AEW&C':{icon:'👁',color:'#50a0e8',order:5},
    'Tanker':{icon:'⛽',color:'#39e0a0',order:6},
    'SOCOM Assault/Infiltration':{icon:'🔒',color:'#a060e8',order:7},
    'Gunship':{icon:'💥',color:'#e85040',order:8},
    'Strategic Airlift':{icon:'✈',color:'#4a6070',order:9},
    'ISR':{icon:'🔭',color:'#50a0e8',order:10},
  }
  const [expanded,setExpanded]=useState(null)
  const [showTails,setShowTails]=useState(null)

  if(!aircraft?.length) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:10,color:C.t3}}>No deployed aircraft data on file.</div>
  )

  const grouped={}
  aircraft.forEach(ac=>{
    const role=ac.role||'Other'
    let cat='Other'
    if(role.includes('Bomber')) cat='Strategic Bomber'
    else if(role.includes('Fighter')) cat='Fighter'
    else if(role.includes('Strike')) cat='Strike'
    else if(role.includes('EW')) cat='EW'
    else if(role.includes('AEW')||role.includes('AWACS')) cat='AEW&C'
    else if(role.includes('Tanker')) cat='Tanker'
    else if(role.includes('Gunship')) cat='Gunship'
    else if(role.includes('SOCOM')&&role.includes('Assault')) cat='SOCOM Assault/Infiltration'
    else if(role.includes('Airlift')) cat='Strategic Airlift'
    else if(role.includes('ISR')) cat='ISR'
    if(!grouped[cat]) grouped[cat]=[]
    grouped[cat].push(ac)
  })

  return (
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:12}}>
        DEPLOYED AIRCRAFT — OVERWATCH confirmed or assessed. Click category to expand.
      </div>
      {Object.entries(grouped)
        .sort((a,b)=>(AC_CAT[a[0]]?.order||99)-(AC_CAT[b[0]]?.order||99))
        .map(([cat,acs])=>{
        const meta=AC_CAT[cat]||{icon:'✈',color:C.t2}
        const isOpen=expanded===cat
        return (
          <div key={cat} style={{marginBottom:8}}>
            <div onClick={()=>setExpanded(isOpen?null:cat)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                background:isOpen?`${meta.color}18`:C.bg3,
                border:`1px solid ${isOpen?meta.color+'60':C.br}`,
                borderRadius:1,cursor:'pointer'}}>
              <span style={{fontSize:18}}>{meta.icon}</span>
              <span style={{...R,fontSize:14,fontWeight:700,color:C.tb,flex:1}}>{cat}</span>
              <span style={{...Z,fontSize:12,color:meta.color,fontWeight:700}}>{acs.length} type{acs.length>1?'s':''}</span>
              <span style={{...Z,fontSize:9,color:C.t2}}>{isOpen?'▲':'▼'}</span>
            </div>
            {isOpen&&(
              <div style={{border:`1px solid ${meta.color}40`,borderTop:'none',background:'rgba(0,0,0,.15)'}}>
                {acs.map((ac,j)=>{
                  const tailsOpen=showTails===`${cat}-${j}`
                  return (
                    <div key={j} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                      <div onClick={()=>ac.tails?.length&&setShowTails(tailsOpen?null:`${cat}-${j}`)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',cursor:ac.tails?.length?'pointer':'default'}}>
                        <div style={{flex:1}}>
                          <div style={{...R,fontSize:14,fontWeight:600,color:C.tb}}>{ac.type}</div>
                          <div style={{...R,fontSize:10,color:C.t2}}>{ac.role}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{...Z,fontSize:18,fontWeight:700,color:meta.color,lineHeight:1}}>{ac.qty}</div>
                          {ac.tails?.length>0&&<div style={{...Z,fontSize:8,color:C.b,marginTop:2}}>{tailsOpen?'▲ hide':'▼ '+ac.tails.length+' airframes'}</div>}
                        </div>
                      </div>
                      {tailsOpen&&ac.tails?.length>0&&(
                        <div style={{padding:'10px 16px 14px',background:'rgba(80,160,232,.04)'}}>
                          <div style={{...R,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:8}}>CONFIRMED TAIL NUMBERS / CALLSIGNS</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                            {ac.tails.map((t,k)=>(
                              <span key={k} style={{...Z,fontSize:10,padding:'3px 8px',background:'rgba(80,160,232,.1)',border:`1px solid rgba(80,160,232,.2)`,color:C.b,borderRadius:1}}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function IntelTab({asset,auth}) {
  return (
    <div style={{flex:1,overflow:'auto',padding:24}}>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:12}}>INTEL ASSESSMENT</div>
        <div style={{...Z,fontSize:12,color:C.t1,lineHeight:2,marginBottom:20}}>{asset.intel||'No assessment on file.'}</div>
        {asset.notes&&(
          <>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>NOTES</div>
            <div style={{...Z,fontSize:11,color:C.t2,lineHeight:1.8}}>{asset.notes}</div>
          </>
        )}
      </TierGate>
    </div>
  )
}

function FlightTab({flights,label,auth}) {
  const AC_FLAG_COL={socom:C.p,army:C.y,amc:C.b}
  return (
    <div style={{flex:1,overflow:'auto'}}>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <div style={{padding:'6px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2}}>
          {flights.length} {label} flights tracked
        </div>
        {flights.length===0?(
          <div style={{...Z,fontSize:10,color:C.t3,padding:20}}>No {label} flights recorded.</div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:650}}>
              <thead>
                <tr style={{background:C.bg4}}>
                  {['DATE','CALLSIGN','HEX','SERIAL','MISSION CODE',label==='inbound'?'ORIGIN':'DESTINATION','TYPE','VIA','STATUS'].map(h=>(
                    <th key={h} style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,padding:'6px 9px',borderBottom:`1px solid ${C.br}`,textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flights.map(f=>{
                  const isSocom=f.mc_flag==='socom'
                  const isArmy=f.mc_flag==='amc'&&f.notes?.toLowerCase().includes('army')
                  const flagColor=isSocom?C.p:isArmy?C.y:C.b
                  const flagBg=isSocom?'rgba(160,96,232,.15)':isArmy?'rgba(232,208,64,.1)':'rgba(80,160,232,.12)'
                  const flagLabel=isSocom?'SOCOM':isArmy?'ARMY':'AMC'
                  return (
                    <tr key={f.id} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                      <td style={{padding:'5px 9px',...Z,color:C.t3,fontSize:10}}>{f.dep_date?.slice(5)||'—'}</td>
                      <td style={{padding:'5px 9px',...R,fontWeight:700,color:C.tb,fontSize:12}}>{normCallsign(f.callsign)}</td>
                      <td style={{padding:'5px 9px',...Z,color:C.y,fontSize:10}}>{f.hex||'—'}</td>
                      <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.serial||'—'}</td>
                      <td style={{padding:'5px 9px',...Z,fontSize:10,color:C.t1}}>{f.mission_code||'—'}</td>
                      <td style={{padding:'5px 9px',...Z,color:C.b,fontSize:10}}>{label==='inbound'?(f.base||'—'):(f.destination||'—')}</td>
                      <td style={{padding:'5px 9px'}}>
                        <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:1,background:flagBg,border:`1px solid ${flagColor}66`,color:flagColor}}>{flagLabel}</span>
                      </td>
                      <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.via||f.first_hop||'—'}</td>
                      <td style={{padding:'5px 9px',...R,fontSize:10,color:{ACTIVE:C.g,COMPLETE:C.t3,PENDING:C.a}[f.status]||C.t2}}>{f.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </TierGate>
    </div>
  )
}
