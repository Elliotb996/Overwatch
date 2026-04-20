import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
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
const AC_CAT={
  'Strategic Bomber':{icon:'💣',color:'#e85040',order:1},
  'Fighter':{icon:'⚡',color:'#e85040',order:2},
  'Strike':{icon:'🎯',color:'#f0a040',order:3},
  'EW':{icon:'📡',color:'#a060e8',order:4},
  'AEW&C':{icon:'👁',color:'#50a0e8',order:5},
  'ISR':{icon:'🔭',color:'#50a0e8',order:6},
  'Tanker':{icon:'⛽',color:'#39e0a0',order:7},
  'SOCOM Assault/Infiltration':{icon:'🔒',color:'#a060e8',order:8},
  'Gunship':{icon:'💥',color:'#e85040',order:9},
  'Strategic Airlift':{icon:'✈',color:'#4a6070',order:10},
}

const STATIC_ASSETS=[
  {id:'otbh',icao:'OTBH',name:'Al Udeid AB',sub:'OTBH // Qatar',status:'SURGE',lat:25.117,lng:51.314,arrCnt:14,socomCnt:4,intel:'14 AMC arrivals/48h. SOCOM=4. Surge sustained. B-52H surged. F-35A, F-15E, KC-46A, E-3 AWACS forward deployed.',aircraftTypes:[{type:'B-52H Stratofortress',qty:'2x (surged)',role:'Strategic Bomber',tails:['60-0040','60-0047']},{type:'F-35A Lightning II',qty:'12x',role:'Strike'},{type:'F-15E Strike Eagle',qty:'8x',role:'Strike'},{type:'KC-46A Pegasus',qty:'4x',role:'Tanker'},{type:'E-3 AWACS',qty:'2x',role:'AEW&C'},{type:'RQ-4 Global Hawk',qty:'1x',role:'ISR'}],tags:['SURGE','CENTCOM','OP-EPIC-FURY']},
  {id:'llov',icao:'LLOV',name:'Ovda AB',sub:'LLOV // Israel',status:'ELEVATED',lat:29.94,lng:34.935,arrCnt:26,socomCnt:12,intel:'26 confirmed arrivals. All SOCOM flagged. Strategic reserve pre-positioning.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'26+ arrivals',role:'Strategic Airlift',tails:['00-0181','07-7178','02-1110','99-0059']}],tags:['SURGE','IDF']},
  {id:'ojka',icao:'OJKA',name:'King Abdullah II AB',sub:'OJKA // Jordan',status:'ELEVATED',lat:32.356,lng:36.259,arrCnt:30,socomCnt:12,intel:'Highest single-destination volume. Onward movement to OJMS confirmed.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'30+ arrivals',role:'Strategic Airlift',tails:['07-7182','06-6163','03-3126']}],tags:['JORDAN','HIGHEST-VOLUME']},
  {id:'ojms',icao:'OJMS',name:'Muwaffaq Salti AB',sub:'OJMS // Jordan (Azraq)',status:'ELEVATED',lat:31.827,lng:36.789,arrCnt:19,socomCnt:0,intel:'Low-visibility. FJDG→HDAM→OJMS routing confirmed.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'19+ tracked',role:'Strategic Airlift',tails:['04-4131','92-3294','94-0067']}],tags:['JORDAN','LOW-VISIBILITY']},
  {id:'okas',icao:'OKAS',name:'Ali Al Salem AB',sub:'OKAS // Kuwait',status:'ELEVATED',lat:29.346,lng:47.519,arrCnt:10,socomCnt:2,intel:'Army-Z mission series dominant.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'10+',role:'Strategic Airlift',tails:['02-1098','98-0051']},{type:'C-130J',qty:'assessed',role:'SOCOM Airlift'}],tags:['KUWAIT','ARMY-Z']},
  {id:'oeps',icao:'OEPS',name:'Prince Sultan AB',sub:'OEPS // Saudi Arabia',status:'ELEVATED',lat:24.062,lng:47.580,arrCnt:16,socomCnt:0,intel:'Major build-up. C-5M = heavy equipment.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'14x',role:'Strategic Airlift'},{type:'C-5M Super Galaxy',qty:'4x',role:'Strategic Airlift'}],tags:['KSA']},
  {id:'llnv',icao:'LLNV',name:'Nevatim AB',sub:'LLNV // Israel',status:'ELEVATED',lat:31.208,lng:35.012,arrCnt:4,socomCnt:0,intel:'Second Israeli staging base.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'4',role:'Strategic Airlift',tails:['05-5141','97-0042']}],tags:['ISRAEL']},
  {id:'lgel',icao:'LGEL',name:'Elefsis AB',sub:'LGEL // Greece',status:'ELEVATED',lat:38.065,lng:23.556,arrCnt:5,socomCnt:3,intel:'Emerged late March. SAAM dominant.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'5',role:'Strategic Airlift'}],tags:['GREECE','NATO']},
  {id:'lgsa',icao:'LGSA',name:'Souda Bay / Chania',sub:'LGSA // Crete',status:'ACTIVE',lat:35.531,lng:24.147,arrCnt:4,socomCnt:0,intel:'EA-37B AXIS 41/43 arrived from Mildenhall. EW forward hub.',aircraftTypes:[{type:'EA-37B Compass Call',qty:'2x (AXIS 41/43)',role:'EW'}],tags:['CRETE','EW']},
  {id:'etar',icao:'ETAR',name:'Ramstein AB',sub:'ETAR // Germany',status:'ACTIVE',lat:49.437,lng:7.600,arrCnt:5,socomCnt:0,intel:'Universal CONUS→CENTCOM gateway. Every tracked mission transits.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'rotational',role:'Strategic Airlift'},{type:'KC-135R',qty:'2x det',role:'Tanker'}],tags:['EUCOM','GATEWAY']},
  {id:'egva',icao:'EGVA',name:'RAF Fairford',sub:'EGVA // UK — USAF BOMBER HUB',status:'SURGE',lat:51.682,lng:-1.790,arrCnt:0,socomCnt:0,intel:'8x B-52H + 18+ B-1B. Largest US forward bomber deployment since Gulf War.',aircraftTypes:[{type:'B-52H Stratofortress',qty:'8x',role:'Strategic Bomber',tails:['61-0001(FLIP 61)','61-0035(FLIP 62)','60-0012(FLIP 63)','60-0007(HOOKY 23)','60-0060(HOOKY 22)','60-0023(HOOKY 21)']},{type:'B-1B Lancer',qty:'18x+',role:'Strategic Bomber',tails:['86-0102(TWIN 43)','86-0129(TWIN 44)','85-0072(TWIN 42)','86-0138(TWIN 41)','86-0107(MOLT 13)','85-0064(MOLT 11)','86-0140(MOLT 14)']}],tags:['SURGE','B-52H','B-1B','OP-EPIC-FURY']},
  {id:'egun',icao:'EGUN',name:'RAF Mildenhall',sub:'EGUN // UK — SOCOM HUB',status:'SURGE',lat:52.362,lng:0.486,arrCnt:41,socomCnt:41,intel:'41+ MC-130J staged since 3 Mar. 11x Silent Knight. AC-130 Gunship det.',aircraftTypes:[{type:'MC-130J Commando II',qty:'41+ (11x Silent Knight)',role:'SOCOM Assault/Infiltration',tails:['14-5805(UNLIT 77)','BLATE 83-99 x9']},{type:'AC-130 Gunship',qty:'3x',role:'Gunship',tails:['HEEL 51','HEEL 53','HEEL 55']},{type:'EA-37B Compass Call',qty:'2x (departed)',role:'EW'}],tags:['SURGE','MC-130J','AFSOC']},
  {id:'egul',icao:'EGUL',name:'RAF Lakenheath',sub:'EGUL // UK — USAFE HUB',status:'ELEVATED',lat:52.409,lng:0.560,arrCnt:0,socomCnt:0,intel:'F-22A CORONET EAST 051, A-10C CORONET EAST 062/032 complete. AC-130 det.',aircraftTypes:[{type:'F-22A Raptor',qty:'6x (CORONET 051)',role:'Fighter',tails:['CORONET EAST 051 — 1st FW Langley']},{type:'A-10C Thunderbolt II',qty:'12x (CORONET 062/032)',role:'Strike',tails:['190th/107th FS Boise ANGB']},{type:'AC-130',qty:'3x',role:'Gunship',tails:['HEEL 51','HEEL 53','HEEL 55']},{type:'F-15E Strike Eagle',qty:'48th FW organic',role:'Strike'}],tags:['SURGE','CORONET','USAFE']},
  {id:'fjdg',icao:'FJDG',name:'Diego Garcia NSF',sub:'FJDG // BIOT',status:'ACTIVE',lat:-7.3132,lng:72.4108,arrCnt:0,socomCnt:0,intel:'Major pre-positioning hub. FJDG→OJMS/OEPS direct routing.',aircraftTypes:[{type:'B-52H / B-1B',qty:'surge capable',role:'Strategic Bomber'},{type:'P-8A Poseidon',qty:'rotational',role:'ISR'}],tags:['CENTCOM','PRE-POSITION']},
  {id:'etad',icao:'ETAD',name:'Spangdahlem AB',sub:'ETAD // Germany',status:'ACTIVE',lat:49.972,lng:6.693,arrCnt:0,socomCnt:0,intel:'Army-Z staging. PMZ/JMZ/AMZ series route via ETAD.',aircraftTypes:[{type:'C-17A Globemaster III',qty:'transit',role:'Strategic Airlift'},{type:'F-16C',qty:'52nd FW',role:'Fighter'}],tags:['EUCOM','ARMY-Z']},
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

function roleToCategory(role='') {
  if(role.includes('Bomber')) return 'Strategic Bomber'
  if(role.includes('Fighter')) return 'Fighter'
  if(role.includes('Strike')) return 'Strike'
  if(role.includes('EW')) return 'EW'
  if(role.includes('AEW')||role.includes('AWACS')) return 'AEW&C'
  if(role.includes('Tanker')) return 'Tanker'
  if(role.includes('Gunship')) return 'Gunship'
  if(role.includes('SOCOM')&&role.includes('Assault')) return 'SOCOM Assault/Infiltration'
  if(role.includes('ISR')||role.includes('MPA')) return 'ISR'
  if(role.includes('Airlift')) return 'Strategic Airlift'
  return 'Other'
}

export function AirbaseView({auth}) {
  const {icao}=useParams()
  const navigate=useNavigate()
  const code=icao.toUpperCase()
  const [flights,setFlights]=useState([])
  const [images,setImages]=useState([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('OVERVIEW')
  const staticA=STATIC_ASSETS.find(a=>a.icao===code||a.id===code.toLowerCase())
  const [asset,setAsset]=useState(staticA||null)

  useEffect(()=>{
    async function load(){
      const [{data:dbAsset},{data:fl},{data:imgs}]=await Promise.all([
        supabase.from('assets').select('*').or(`icao_code.eq.${code},id.eq.${code.toLowerCase()}`).maybeSingle(),
        supabase.from('amc_flights').select('*').or(`destination.eq.${code},base.eq.${code}`).order('dep_date',{ascending:false}),
        supabase.from('imagery_meta').select('*').eq('asset_id',code).eq('asset_type','airbase').order('created_at',{ascending:false}),
      ])
      if(dbAsset&&!staticA) setAsset({
        id:dbAsset.icao_code?.toLowerCase()||dbAsset.id,icao:dbAsset.icao_code||code,
        name:dbAsset.name,sub:dbAsset.designation,status:dbAsset.status,
        lat:parseFloat(dbAsset.lat),lng:parseFloat(dbAsset.lng),
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

  if(loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,...Z,color:C.t2,fontSize:11,letterSpacing:3}}>LOADING...</div>
  if(!asset) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,...Z,color:C.r,fontSize:11}}>AIRBASE {code} NOT FOUND</div>

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
          <button onClick={()=>navigate(-1)} style={{...Z,fontSize:10,color:C.t2,background:'transparent',border:`1px solid ${C.br}`,padding:'4px 12px',cursor:'pointer',letterSpacing:2}}>← BACK</button>
          <span style={{fontSize:18}}>✈</span>
          <div style={{...R,fontSize:20,fontWeight:700,color:C.tb}}>{asset.name}</div>
          <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub}</div>
          <div style={{...Z,fontSize:11,fontWeight:700,padding:'3px 12px',borderRadius:1,color:stCol,background:`${stCol}22`,border:`1px solid ${stCol}44`,letterSpacing:2}}>{asset.status}</div>
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
        {tab==='OVERVIEW'&&<AirbaseOverview asset={asset} inbound={inbound} outbound={outbound} socom={socom} auth={auth} />}
        {tab==='ARRIVALS'&&<FlightTab flights={inbound} label="inbound" auth={auth} />}
        {tab==='DEPARTURES'&&<FlightTab flights={outbound} label="outbound" auth={auth} />}
        {tab==='AIRCRAFT'&&<AircraftTab aircraft={asset.aircraftTypes} auth={auth} />}
        {tab==='AIRFIELD MAP'&&<AirfieldMapTab asset={asset} auth={auth} />}
        {tab==='IMAGERY'&&<ImageryTab images={images} code={code} auth={auth} />}
        {tab==='INTEL'&&<IntelTab asset={asset} auth={auth} />}
      </div>
    </div>
  )
}

function AirbaseOverview({asset,inbound,outbound,socom,auth}) {
  const stCol={SURGE:C.r,ELEVATED:C.a,ACTIVE:C.g}[asset.status]||C.g
  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'auto'}}>
      <div style={{borderRight:`1px solid ${C.br}`,overflow:'auto',padding:24}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20}}>
          {[
            {v:inbound.length,l:'INBOUND',c:C.a},
            {v:outbound.length,l:'OUTBOUND',c:C.b},
            {v:socom,l:'SOCOM',c:C.p},
            {v:inbound.filter(f=>new Date(f.dep_date)>=new Date(Date.now()-7*864e5)).length,l:'LAST 7D',c:C.g},
            {v:asset.aircraftTypes?.length||0,l:'AC TYPES',c:C.y},
            {v:inbound.length+outbound.length,l:'TOTAL OPS',c:C.b},
          ].map(({v,l,c})=>(
            <div key={l} style={{padding:'10px 12px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <div style={{...R,fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{...Z,fontSize:8,color:C.t3,marginTop:3,letterSpacing:1}}>{l}</div>
            </div>
          ))}
        </div>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>INTEL</div>
          <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9,marginBottom:16}}>{asset.intel||'No assessment on file.'}</div>
        </TierGate>
        {asset.tags?.length>0&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:12}}>
            {asset.tags.map(t=><span key={t} style={{...Z,fontSize:9,padding:'2px 5px',borderRadius:1,background:'rgba(57,224,160,.08)',border:'1px solid rgba(57,224,160,.2)',color:C.g}}>{t}</span>)}
          </div>
        )}
        {inbound.length>0&&(
          <div style={{marginTop:20}}>
            <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:10}}>TOP ORIGINS</div>
            {Object.entries(inbound.reduce((a,f)=>{a[f.base]=(a[f.base]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([base,n])=>(
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

// ── Aircraft Tab — expanded by default, click to collapse ────
function AircraftTab({aircraft,auth}) {
  // Group first so we can initialise all as expanded
  const grouped = {}
  ;(aircraft||[]).forEach(ac=>{
    const cat = roleToCategory(ac.role)
    if(!grouped[cat]) grouped[cat]=[]
    grouped[cat].push(ac)
  })
  const sortedCats = Object.entries(grouped).sort((a,b)=>(AC_CAT[a[0]]?.order||99)-(AC_CAT[b[0]]?.order||99))
  // Default: ALL categories expanded
  const [expanded,setExpanded] = useState(()=>new Set(sortedCats.map(([cat])=>cat)))
  const [showTails,setShowTails] = useState(null)

  if(!aircraft?.length) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:10,color:C.t3}}>No deployed aircraft data on file.</div>

  function toggleCat(cat) {
    setExpanded(prev=>{
      const next=new Set(prev)
      next.has(cat)?next.delete(cat):next.add(cat)
      return next
    })
  }

  return (
    <div style={{flex:1,overflow:'auto',padding:20}}>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:12}}>
        DEPLOYED AIRCRAFT — Click category to collapse/expand · Click type for tail numbers
      </div>
      {sortedCats.map(([cat,acs])=>{
        const meta=AC_CAT[cat]||{icon:'✈',color:C.t2}
        const isOpen=expanded.has(cat)
        return (
          <div key={cat} style={{marginBottom:8}}>
            {/* Category header — click to toggle */}
            <div onClick={()=>toggleCat(cat)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                background:isOpen?`${meta.color}18`:C.bg3,
                border:`1px solid ${isOpen?meta.color+'60':C.br}`,
                borderRadius:isOpen?'2px 2px 0 0':2,cursor:'pointer',transition:'all .15s'}}>
              <span style={{fontSize:18}}>{meta.icon}</span>
              <span style={{...R,fontSize:14,fontWeight:700,color:C.tb,flex:1}}>{cat}</span>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span style={{...Z,fontSize:11,color:meta.color,fontWeight:700}}>{acs.length} type{acs.length>1?'s':''}</span>
                <span style={{...Z,fontSize:10,color:C.t2,transition:'transform .2s',transform:isOpen?'rotate(180deg)':'rotate(0)'}}>▼</span>
              </div>
            </div>
            {/* Expanded content */}
            {isOpen&&(
              <div style={{border:`1px solid ${meta.color}40`,borderTop:'none',background:'rgba(0,0,0,.12)',borderRadius:'0 0 2px 2px'}}>
                {acs.map((ac,j)=>{
                  const tailKey=`${cat}-${j}`
                  const tailsOpen=showTails===tailKey
                  return (
                    <div key={j} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                      <div onClick={()=>ac.tails?.length&&setShowTails(tailsOpen?null:tailKey)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                          cursor:ac.tails?.length?'pointer':'default',
                          background:tailsOpen?'rgba(80,160,232,.06)':'transparent',transition:'background .1s'}}>
                        <div style={{flex:1}}>
                          <div style={{...R,fontSize:14,fontWeight:600,color:C.tb}}>{ac.type}</div>
                          <div style={{...R,fontSize:10,color:C.t2,marginTop:2}}>{ac.role}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{...Z,fontSize:20,fontWeight:700,color:meta.color,lineHeight:1}}>{ac.qty}</div>
                          {ac.tails?.length>0&&(
                            <div style={{...Z,fontSize:8,color:C.b,marginTop:3}}>
                              {tailsOpen?'▲ HIDE':'▼ '+ac.tails.length+' AIRFRAMES'}
                            </div>
                          )}
                        </div>
                      </div>
                      {tailsOpen&&ac.tails?.length>0&&(
                        <div style={{padding:'10px 16px 14px',background:'rgba(80,160,232,.04)'}}>
                          <div style={{...R,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:8}}>CONFIRMED TAIL NUMBERS / CALLSIGNS</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                            {ac.tails.map((t,k)=>(
                              <span key={k} style={{...Z,fontSize:10,padding:'3px 8px',background:'rgba(80,160,232,.1)',border:'1px solid rgba(80,160,232,.2)',color:C.b,borderRadius:1}}>{t}</span>
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

// ── Airfield Map — satellite or street toggle ────────
function AirfieldMapTab({asset,auth}) {
  const [mapMode,setMapMode] = useState('satellite') // 'satellite' | 'street'
  if(!asset.lat||!asset.lng) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:10,color:C.t3}}>No coordinates available.</div>
  
  // Esri WorldImagery satellite tiles (free)
  const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  // Dark street tiles
  const DARK_STREET = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,padding:'10px 16px',borderBottom:`1px solid ${C.br}`,flexShrink:0,display:'flex',alignItems:'center',gap:16}}>
        <span>AIRFIELD MAP</span>
        {/* Tile toggle */}
        <div style={{display:'flex',gap:0,marginLeft:8}}>
          {[['satellite','🛰 SAT'],['street','🗺 STREET']].map(([mode,label])=>(
            <button key={mode} onClick={()=>setMapMode(mode)}
              style={{...Z,fontSize:9,padding:'3px 10px',background:mapMode===mode?C.b:'transparent',
                border:`1px solid ${mapMode===mode?C.b:C.br}`,color:mapMode===mode?C.bg:C.t2,cursor:'pointer',letterSpacing:1}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
          <a href={`https://www.google.com/maps?q=${asset.lat},${asset.lng}&z=15&t=k`} target="_blank" rel="noopener noreferrer" style={{...Z,fontSize:9,color:C.b,textDecoration:'none'}}>↗ Google Sat</a>
          <a href={`https://zoom.earth/#${asset.lat},${asset.lng},15z`} target="_blank" rel="noopener noreferrer" style={{...Z,fontSize:9,color:C.b,textDecoration:'none'}}>↗ Zoom.Earth</a>
          <a href={`https://www.openstreetmap.org/?mlat=${asset.lat}&mlon=${asset.lng}&zoom=14`} target="_blank" rel="noopener noreferrer" style={{...Z,fontSize:9,color:C.b,textDecoration:'none'}}>↗ OSM</a>
        </div>
      </div>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <div style={{flex:1}}>
          <MapContainer center={[asset.lat,asset.lng]} zoom={14} style={{width:'100%',height:'100%'}} zoomControl={true} attributionControl={false}>
            {mapMode==='satellite'?(
              <TileLayer url={ESRI_SAT} maxZoom={19} />
            ):(
              <TileLayer url={DARK_STREET} subdomains="abcd" maxZoom={18} />
            )}
            <Marker position={[asset.lat,asset.lng]}
              icon={L.divIcon({
                html:`<div style="width:20px;height:20px;background:rgba(232,80,64,.9);border:2px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(232,80,64,.8)"></div>`,
                className:'',iconSize:[20,20],iconAnchor:[10,10]
              })} />
          </MapContainer>
        </div>
      </TierGate>
    </div>
  )
}

// ── DetailPanel: view + edit imagery metadata ────────
function DetailPanel({img, auth, onDelete, onSaved}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)

  function startEdit() {
    setForm({
      label: img.label||'',
      description: img.description||'',
      source: img.source||'Satellite',
      captured_date: img.captured_date||'',
      tier_required: img.tier_required||'premium',
      geo_confirmed: !!img.geo_confirmed,
    })
    setEditing(true)
  }

  async function save() {
    if(!form.label) return
    setSaving(true)
    const {error} = await supabase.from('imagery_meta').update({
      label: form.label,
      description: form.description,
      source: form.source,
      captured_date: form.captured_date||null,
      tier_required: form.tier_required,
      geo_confirmed: form.geo_confirmed,
    }).eq('id', img.id)
    setSaving(false)
    if(error){ alert('Save failed: '+error.message); return }
    setEditing(false)
    onSaved()
  }

  const inp = {
    width:'100%', padding:'7px 10px', background:C.bg,
    border:`1px solid ${C.br}`, color:C.t1,
    fontFamily:"'Share Tech Mono',monospace", fontSize:11,
    borderRadius:1, outline:'none', boxSizing:'border-box'
  }

  if(editing && form) return (
    <div style={{flex:1,overflow:'auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
        <span style={{...R,fontSize:13,fontWeight:700,color:C.a,letterSpacing:1}}>EDITING IMAGE METADATA</span>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={save} disabled={saving}
            style={{...R,fontSize:11,fontWeight:700,letterSpacing:1,padding:'5px 18px',
              background:saving?C.br:C.g,color:C.bg,border:'none',cursor:'pointer',borderRadius:1}}>
            {saving?'SAVING…':'✓ SAVE'}
          </button>
          <button onClick={()=>setEditing(false)}
            style={{...Z,fontSize:10,padding:'5px 12px',background:'transparent',
              border:`1px solid ${C.br}`,color:C.t2,cursor:'pointer',borderRadius:1}}>
            CANCEL
          </button>
        </div>
      </div>

      {/* Image preview (non-editable) */}
      {img.image_url&&(
        <a href={img.image_url} target="_blank" rel="noopener noreferrer">
          <img src={img.image_url} alt={img.label}
            style={{width:'100%',maxHeight:220,objectFit:'contain',background:'#000',display:'block'}} />
        </a>
      )}

      {/* Edit fields */}
      <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
        <div>
          <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>LABEL / TITLE *</div>
          <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} style={inp} />
        </div>

        <div>
          <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>ASSESSMENT / INTEL WRITE-UP</div>
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            rows={5} placeholder="Describe what the image shows — activity, aircraft, damage, construction..."
            style={{...inp,resize:'vertical',lineHeight:1.7}} />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>SOURCE</div>
            <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={inp}>
              {['Satellite','Planet Labs','Maxar','Sentinel-2','OSINT','ArmchairAdml','Social Media','Other'].map(s=>(
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>CAPTURED DATE</div>
            <input type="date" value={form.captured_date} onChange={e=>setForm(f=>({...f,captured_date:e.target.value}))} style={inp} />
          </div>
        </div>

        <div>
          <div style={{...Z,fontSize:8,color:C.t3,marginBottom:6,letterSpacing:2}}>ACCESS TIER — who can view this image</div>
          <div style={{display:'flex',gap:6}}>
            {[['analyst','ANALYST','Anyone with access'],['premium','PREMIUM','Paid tier only'],['admin','ADMIN ONLY','Restricted']].map(([val,label,hint])=>(
              <div key={val} onClick={()=>setForm(f=>({...f,tier_required:val}))}
                style={{flex:1,padding:'8px 10px',cursor:'pointer',borderRadius:1,textAlign:'center',
                  background:form.tier_required===val?'rgba(80,160,232,.15)':'transparent',
                  border:`1px solid ${form.tier_required===val?C.b:C.br}`}}>
                <div style={{...R,fontSize:12,fontWeight:700,color:form.tier_required===val?C.b:C.t2}}>{label}</div>
                <div style={{...Z,fontSize:8,color:C.t3,marginTop:2}}>{hint}</div>
              </div>
            ))}
          </div>
        </div>

        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',
          padding:'8px 12px',background:C.bg3,border:`1px solid ${form.geo_confirmed?C.g:C.br}`,borderRadius:1}}>
          <input type="checkbox" checked={form.geo_confirmed}
            onChange={e=>setForm(f=>({...f,geo_confirmed:e.target.checked}))}
            style={{accentColor:C.g,width:14,height:14}} />
          <div>
            <div style={{...R,fontSize:12,fontWeight:600,color:form.geo_confirmed?C.g:C.t2}}>GEO-CONFIRMED LOCATION</div>
            <div style={{...Z,fontSize:8,color:C.t3}}>Location has been verified against satellite reference</div>
          </div>
        </label>
      </div>
    </div>
  )

  // ── View mode ──────────────────────────────────────
  return (
    <div style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
        <div style={{flex:1}}>
          <div style={{...R,fontSize:15,fontWeight:700,color:C.tb}}>{img.label}</div>
          <div style={{...Z,fontSize:9,color:C.t2}}>{img.source} · {img.captured_date||'Date unknown'}</div>
        </div>
        {img.geo_confirmed&&(
          <span style={{...Z,fontSize:9,color:C.g,border:`1px solid ${C.g}44`,padding:'2px 6px',borderRadius:1}}>✓ GEO</span>
        )}
        <a href={img.image_url} target="_blank" rel="noopener noreferrer"
          style={{...Z,fontSize:9,color:C.b,padding:'4px 10px',border:`1px solid ${C.b}44`,borderRadius:1,textDecoration:'none'}}>
          ↗ FULL RES
        </a>
        {auth?.isAdmin&&(
          <>
            <button onClick={startEdit}
              style={{...Z,fontSize:9,color:C.a,background:'transparent',border:`1px solid ${C.a}44`,padding:'4px 10px',cursor:'pointer',borderRadius:1}}>
              ✎ EDIT
            </button>
            <button onClick={()=>onDelete(img)}
              style={{...Z,fontSize:9,color:C.r,background:'transparent',border:`1px solid ${C.r}44`,padding:'4px 8px',cursor:'pointer',borderRadius:1}}>
              🗑 DELETE
            </button>
          </>
        )}
      </div>

      {/* Image */}
      {img.image_url&&(
        <a href={img.image_url} target="_blank" rel="noopener noreferrer">
          <img src={img.image_url} alt={img.label}
            style={{width:'100%',maxHeight:380,objectFit:'contain',background:'#000',display:'block',cursor:'zoom-in'}} />
        </a>
      )}

      {/* Description */}
      {img.description ? (
        <div style={{padding:'16px 20px',borderTop:`1px solid ${C.br}`}}>
          <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:8}}>ASSESSMENT / NOTES</div>
          <div style={{...Z,fontSize:11,color:C.t1,lineHeight:1.9}}>{img.description}</div>
        </div>
      ) : auth?.isAdmin ? (
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.br}`}}>
          <div style={{...Z,fontSize:9,color:C.t3}}>No write-up yet. <span onClick={startEdit} style={{color:C.a,cursor:'pointer',textDecoration:'underline'}}>Add one →</span></div>
        </div>
      ) : null}

      {/* Metadata boxes */}
      <div style={{padding:'12px 20px',borderTop:`1px solid ${C.br}`,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:'auto'}}>
        {[
          {l:'SOURCE',v:img.source||'—'},
          {l:'CAPTURED',v:img.captured_date||'Unknown'},
          {l:'ACCESS',v:(img.tier_required||'analyst').toUpperCase()},
        ].map(({l,v})=>(
          <div key={l} style={{padding:'8px 10px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:3}}>{l}</div>
            <div style={{...R,fontSize:12,fontWeight:600,color:C.tb}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


function ImageryTab({images:initImages,code,auth}) {
  const [images, setImages] = useState(initImages||[])
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selImg, setSelImg] = useState(null)
  const [form, setForm] = useState({
    label:'', description:'', source:'Satellite', captured_date:'',
    tier_required:'premium', geo_confirmed:false, file:null, preview:null
  })
  const [msg, setMsg] = useState(null)

  function flash(m, err=false) { setMsg({text:m,err}); setTimeout(()=>setMsg(null),4000) }

  async function reload() {
    const {data} = await supabase.from('imagery_meta').select('*')
      .eq('asset_id',code).eq('asset_type','airbase').order('created_at',{ascending:false})
    setImages(data||[])
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if(!file) return
    const preview = URL.createObjectURL(file)
    setForm(f=>({...f,file,preview}))
  }

  async function upload() {
    if(!form.file||!form.label) { flash('Label and image are required',true); return }
    setUploading(true)
    const ext = form.file.name.split('.').pop()
    const path = `airbases/${code}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('imagery').upload(path, form.file, {upsert:true})
    if(upErr) { flash('Upload failed: '+upErr.message,true); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('imagery').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('imagery_meta').insert({
      asset_id: code, asset_type:'airbase',
      label: form.label, description: form.description,
      source: form.source, captured_date: form.captured_date||null,
      storage_path: path, image_url: urlData.publicUrl,
      geo_confirmed: form.geo_confirmed,
      tier_required: form.tier_required,
    })
    setUploading(false)
    if(dbErr) { flash('Metadata save failed: '+dbErr.message,true); return }
    flash('Image uploaded successfully')
    setShowForm(false)
    setForm({label:'',description:'',source:'Satellite',captured_date:'',tier_required:'premium',geo_confirmed:false,file:null,preview:null})
    reload()
  }

  async function deleteImg(img) {
    if(!confirm('Delete this image?')) return
    if(img.storage_path) await supabase.storage.from('imagery').remove([img.storage_path])
    await supabase.from('imagery_meta').delete().eq('id',img.id)
    setSelImg(null)
    reload()
  }

  const inp={width:'100%',padding:'8px 10px',background:C.bg2,border:`1px solid ${C.br}`,color:C.t1,fontFamily:"'Share Tech Mono',monospace",fontSize:11,borderRadius:1,outline:'none',boxSizing:'border-box'}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Toolbar */}
      <div style={{padding:'8px 16px',background:C.bg4,borderBottom:`1px solid ${C.br}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <span style={{...Z,fontSize:9,color:C.t2}}>{images.length} image{images.length!==1?'s':''} catalogued for {code}</span>
        {msg&&<span style={{...Z,fontSize:9,color:msg.err?C.r:C.g,marginLeft:8}}>{msg.text}</span>}
        {auth?.isAdmin&&!showForm&&(
          <button onClick={()=>setShowForm(true)}
            style={{...R,fontSize:11,fontWeight:700,letterSpacing:2,padding:'4px 16px',
              background:'rgba(57,224,160,.12)',border:`1px solid ${C.g}`,color:C.g,
              cursor:'pointer',marginLeft:'auto',borderRadius:1}}>
            + UPLOAD IMAGERY
          </button>
        )}
        {auth?.isAdmin&&showForm&&(
          <button onClick={()=>setShowForm(false)}
            style={{...Z,fontSize:10,padding:'4px 12px',background:'transparent',border:`1px solid ${C.br}`,color:C.t2,cursor:'pointer',marginLeft:'auto'}}>
            ✕ CANCEL
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm&&auth?.isAdmin&&(
        <div style={{flexShrink:0,borderBottom:`1px solid ${C.br}`,background:C.bg2,padding:20,display:'grid',gridTemplateColumns:'200px 1fr',gap:16}}>
          {/* Image preview / file picker */}
          <div>
            <div style={{...Z,fontSize:8,color:C.t3,marginBottom:6,letterSpacing:2}}>SELECT IMAGE</div>
            <label style={{display:'block',cursor:'pointer'}}>
              <input type="file" accept="image/*" onChange={onFile} style={{display:'none'}} />
              <div style={{width:'100%',paddingBottom:'75%',position:'relative',background:C.bg3,border:`2px dashed ${form.preview?C.g:C.br}`,borderRadius:2,overflow:'hidden'}}>
                {form.preview ? (
                  <img src={form.preview} alt="preview" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
                ) : (
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6}}>
                    <span style={{fontSize:24,opacity:.3}}>🛰</span>
                    <span style={{...Z,fontSize:8,color:C.t3}}>Click to select</span>
                  </div>
                )}
              </div>
            </label>
            {form.file&&<div style={{...Z,fontSize:8,color:C.t2,marginTop:4,wordBreak:'break-all'}}>{form.file.name}</div>}
          </div>

          {/* Metadata fields */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>LABEL / TITLE *</div>
                <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="Ovda AB — Ramp West 14 Apr 2026" style={inp} />
              </div>
              <div>
                <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>CAPTURED DATE</div>
                <input type="date" value={form.captured_date} onChange={e=>setForm(f=>({...f,captured_date:e.target.value}))} style={inp} />
              </div>
              <div>
                <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>SOURCE</div>
                <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={inp}>
                  {['Satellite','Planet Labs','Maxar','Sentinel-2','OSINT','ArmchairAdml','Social Media','Other'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>TIER ACCESS</div>
                <select value={form.tier_required} onChange={e=>setForm(f=>({...f,tier_required:e.target.value}))} style={inp}>
                  <option value="analyst">Analyst</option>
                  <option value="premium">Premium</option>
                  <option value="admin">Admin Only</option>
                </select>
              </div>
            </div>
            <div>
              <div style={{...Z,fontSize:8,color:C.t3,marginBottom:4,letterSpacing:2}}>DESCRIPTION / WRITE-UP</div>
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                rows={3} placeholder="What does this image show? Any notable activity, aircraft, construction, damage assessment..."
                style={{...inp,resize:'vertical',lineHeight:1.7}} />
            </div>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={form.geo_confirmed} onChange={e=>setForm(f=>({...f,geo_confirmed:e.target.checked}))} />
                <span style={{...Z,fontSize:9,color:form.geo_confirmed?C.g:C.t2}}>GEO-CONFIRMED</span>
              </label>
              <button onClick={upload} disabled={uploading||!form.file||!form.label}
                style={{...R,fontSize:12,fontWeight:700,letterSpacing:2,padding:'8px 24px',
                  background:uploading||!form.file||!form.label?C.br:C.g,
                  color:C.bg,border:'none',cursor:'pointer',borderRadius:1,marginLeft:'auto'}}>
                {uploading?'UPLOADING...':'UPLOAD IMAGE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery / Detail split */}
      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        <TierGate required="analyst" current={auth?.tier||'free'}>
          {images.length===0&&!showForm?(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
              <span style={{fontSize:32,opacity:.2}}>🛰</span>
              <div style={{...Z,fontSize:10,color:C.t3}}>No imagery catalogued for {code}</div>
              {auth?.isAdmin&&<button onClick={()=>setShowForm(true)} style={{...Z,fontSize:9,color:C.g,background:'transparent',border:`1px solid ${C.g}44`,padding:'5px 14px',cursor:'pointer',borderRadius:1}}>+ UPLOAD FIRST IMAGE</button>}
            </div>
          ):(
            <>
              {/* Thumbnail grid */}
              <div style={{width:selImg?280:undefined,flex:selImg?undefined:1,borderRight:selImg?`1px solid ${C.br}`:undefined,overflow:'auto',padding:12,display:'flex',flexWrap:'wrap',alignContent:'flex-start',gap:8}}>
                {images.map(img=>(
                  <div key={img.id} onClick={()=>setSelImg(selImg?.id===img.id?null:img)}
                    style={{width:selImg?112:200,cursor:'pointer',borderRadius:2,overflow:'hidden',
                      border:`2px solid ${selImg?.id===img.id?C.a:C.br}`,
                      background:C.bg3,transition:'border-color .15s'}}>
                    {img.image_url?(
                      <img src={img.image_url} alt={img.label} style={{width:'100%',height:selImg?84:130,objectFit:'cover',display:'block'}} />
                    ):(
                      <div style={{width:'100%',height:selImg?84:130,display:'flex',alignItems:'center',justifyContent:'center',...Z,fontSize:9,color:C.t3}}>NO URL</div>
                    )}
                    <div style={{padding:'6px 8px'}}>
                      <div style={{...R,fontSize:selImg?10:12,fontWeight:600,color:C.tb,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{img.label}</div>
                      <div style={{...Z,fontSize:8,color:C.t2}}>{img.captured_date||'Date unknown'}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detail panel */}
              {selImg&&(
                <div style={{flex:1,overflow:'auto',display:'flex',flexDirection:'column'}}>
                  <DetailPanel img={selImg} auth={auth} onDelete={deleteImg} onSaved={reload} />
                </div>
              )}
            </>
          )}
        </TierGate>
      </div>
    </div>
  )
}

function IntelTab({asset,auth}) {
  return (
    <div style={{flex:1,overflow:'auto',padding:24}}>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:12}}>INTEL ASSESSMENT</div>
        <div style={{...Z,fontSize:12,color:C.t1,lineHeight:2,marginBottom:20}}>{asset.intel||'No assessment on file.'}</div>
        {asset.notes&&(<><div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:8}}>NOTES</div><div style={{...Z,fontSize:11,color:C.t2,lineHeight:1.8}}>{asset.notes}</div></>)}
      </TierGate>
    </div>
  )
}

function FlightTab({flights,label,auth}) {
  return (
    <div style={{flex:1,overflow:'auto'}}>
      <TierGate required="analyst" current={auth?.tier||'free'}>
        <div style={{padding:'6px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2}}>{flights.length} {label} flights tracked</div>
        {flights.length===0?(
          <div style={{...Z,fontSize:10,color:C.t3,padding:20}}>No {label} flights recorded.</div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:650}}>
              <thead><tr style={{background:C.bg4,position:'sticky',top:0}}>
                {['DATE','CALLSIGN','HEX','SERIAL','MISSION CODE',label==='inbound'?'ORIGIN':'DESTINATION','TYPE','VIA','STATUS'].map(h=>(
                  <th key={h} style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,padding:'6px 9px',borderBottom:`1px solid ${C.br}`,textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{flights.map(f=>{
                const isSocom=f.mc_flag==='socom',isArmy=f.notes?.toLowerCase().includes('army')
                const fc=isSocom?C.p:isArmy?C.y:C.b,fb=isSocom?'rgba(160,96,232,.15)':isArmy?'rgba(232,208,64,.1)':'rgba(80,160,232,.12)',fl=isSocom?'SOCOM':isArmy?'ARMY':'AMC'
                return (
                  <tr key={f.id} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                    <td style={{padding:'5px 9px',...Z,color:C.t3,fontSize:10}}>{f.dep_date?.slice(5)||'—'}</td>
                    <td style={{padding:'5px 9px',...R,fontWeight:700,color:C.tb,fontSize:12}}>{normCallsign(f.callsign)}</td>
                    <td style={{padding:'5px 9px',...Z,color:C.y,fontSize:10}}>{f.hex||'—'}</td>
                    <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.serial||'—'}</td>
                    <td style={{padding:'5px 9px',...Z,fontSize:10,color:C.t1}}>{f.mission_code||'—'}</td>
                    <td style={{padding:'5px 9px',...Z,color:C.b,fontSize:10}}>{label==='inbound'?(f.base||'—'):(f.destination||'—')}</td>
                    <td style={{padding:'5px 9px'}}><span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:1,background:fb,border:`1px solid ${fc}66`,color:fc}}>{fl}</span></td>
                    <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.via||f.first_hop||'—'}</td>
                    <td style={{padding:'5px 9px',...R,fontSize:10,color:{ACTIVE:C.g,COMPLETE:C.t3,PENDING:C.a}[f.status]||C.t2}}>{f.status}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </TierGate>
    </div>
  )
}
