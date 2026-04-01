import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useFlights } from '../hooks/useFlights'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8', p:'#a060e8',
  y:'#e8d040', t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28',
  br:'#1e2c3a', br2:'#273a4c',
}

function mkIcon(emoji, color, size=26, pulse=false, badge=null) {
  const rip = pulse ? `<div style="position:absolute;inset:-5px;border:1.5px solid ${color};border-radius:2px;opacity:.4;animation:rp 2.2s infinite"></div>` : ''
  const bdg = badge ? `<div style="position:absolute;top:-7px;right:-9px;background:#e85040;color:#07090b;font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;min-width:14px;text-align:center;line-height:13px">${badge}</div>` : ''
  const s = size + 14
  return L.divIcon({
    html:`<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center">${rip}<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(7,9,11,.9);border:1.5px solid ${color};border-radius:2px;font-size:${Math.round(size*.5)}px;box-shadow:0 0 10px ${color}55;z-index:1">${emoji}</div>${bdg}</div><style>@keyframes rp{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}</style>`,
    className:'', iconSize:[s,s], iconAnchor:[s/2,s/2],
  })
}

const VIEWS = {
  WORLD:    { center:[28,22],  zoom:3 },
  MED:      { center:[37,22],  zoom:5 },
  GULF:     { center:[26,52],  zoom:5 },
  ATLANTIC: { center:[44,-30], zoom:4 },
  INDOPACOM:{ center:[20,120], zoom:4 },
}

// ICAO coords for route lines — only known positions
const ICAO_COORDS = {
  // CONUS origins
  KSVN:[32.015,-81.145], KPOB:[35.171,-79.014], KHOP:[36.669,-87.496],
  KGRF:[47.079,-122.580], KTCM:[47.138,-122.476], KNTU:[36.937,-76.036],
  KHRT:[30.428,-86.690], KMCF:[27.849,-82.521], KNKX:[32.868,-117.143],
  KDOV:[39.130,-75.466], KSUU:[38.263,-121.927], KWRI:[40.017,-74.593],
  KMDT:[40.193,-76.763], KGSB:[35.339,-77.961],
  // Destinations
  LLOV:[29.940,34.935], OJKA:[32.356,36.259], OJMS:[31.827,36.789],
  OKAS:[29.346,47.519], OMDM:[25.027,55.366], OTBH:[25.117,51.314],
  OMAM:[24.249,54.548], ETAR:[49.437,7.600], LGEL:[38.065,23.556],
  LIPA:[46.031,12.596], LTAG:[37.002,35.426], FJDG:[-7.313,72.411],
  EGVA:[51.682,-1.790], EGUL:[52.409,0.560], ETAD:[49.972,6.693],
  OEPS:[24.062,47.580],
}

// ── All static assets ─────────────────────────────────────
const STATIC_ASSETS = [
  {id:'cvn78',name:'USS Gerald R. Ford',sub:'CVN-78 // Ford-class',country:'US',type:'carrier',status:'DEPLOYED',lat:43.5,lng:16.5,csg:'CSG-12',aircraftTypes:[{type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},{type:'F/A-18F Super Hornet',qty:'12x',role:'Strike/EW'},{type:'EA-18G Growler',qty:'5x',role:'EW'},{type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'},{type:'MH-60R Seahawk',qty:'8x',role:'ASW/SAR'}],notes:'Adriatic/Split Croatia area 28 Mar. Intel Frog confirmed. EUCOM/CENTCOM direction.',escorts:[{name:'USS Normandy',sub:'CG-60 Ticonderoga',role:'BMD/AAW'},{name:'USS Ramage',sub:'DDG-61 Burke Flt I',role:'ASW'},{name:'USS McFaul',sub:'DDG-74 Burke Flt II',role:'AAW'},{name:'USS Laboon',sub:'DDG-58 Burke Flt I',role:'ASW'}],sightings:[{dt:'28 Mar 2026',src:'Intel Frog',txt:'CVN-78 confirmed Adriatic/Split area.'},{dt:'31 Mar 2026',src:'AIS/OSINT',txt:'CSG-12 underway, CENTCOM-bound posture assessed.'}],tags:['ADRIATIC','CENTCOM-BOUND','DEPLOYED']},
  {id:'cvn72',name:'USS Abraham Lincoln',sub:'CVN-72 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:16.0,lng:54.0,csg:'CSG-3',aircraftTypes:[{type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},{type:'EA-18G Growler',qty:'5x',role:'EW'},{type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'}],notes:'5th Fleet / Arabian Sea. Houthi suppression. Tomahawk employment confirmed.',escorts:[{name:'USS Mobile Bay',sub:'CG-53 Ticonderoga',role:'BMD'},{name:'USS Fitzgerald',sub:'DDG-62 Burke Flt I',role:'ASW'},{name:'USS Sampson',sub:'DDG-102 Burke Flt IIA',role:'AAW/BMD'}],sightings:[{dt:'30 Mar 2026',src:'5th Fleet PA',txt:'CVN-72 strike ops Arabian Sea sustained.'}],tags:['5TH-FLEET','ARABIAN-SEA','ACTIVE']},
  {id:'cvn77',name:'USS George H.W. Bush',sub:'CVN-77 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:36.0,lng:-12.0,csg:'CSG-10',aircraftTypes:[{type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'}],notes:'DEPLOYED as of 31 Mar. Atlantic transit — EUCOM/CENTCOM direction.',escorts:[],sightings:[{dt:'31 Mar 2026',src:'Intel Frog / MMSI',txt:'CVN-77 confirmed deployed. Atlantic transit, EUCOM/CENTCOM direction.'}],tags:['ATLANTIC','EUCOM-BOUND','DEPLOYED']},
  {id:'r08',name:'HMS Queen Elizabeth',sub:'R08 // QE-class',country:'UK',type:'carrier',status:'REFIT',lat:56.0,lng:-3.4,csg:'CSG21',aircraftTypes:[{type:'F-35B Lightning II',qty:'8x (reduced)',role:'Strike'},{type:'Merlin HM2',qty:'4x',role:'ASW'}],notes:'Refit Rosyth 482 days. HMS Prince of Wales also maintenance Portsmouth 116 days.',escorts:[],sightings:[{dt:'Mar 2026',src:'RN Fleet Tracker',txt:'QE in refit Rosyth. POW maintenance Portsmouth.'}],tags:['REFIT','ROSYTH']},
  {id:'r91',name:'Charles de Gaulle',sub:'R91 // CdG-class',country:'FR',type:'carrier',status:'DEPLOYED',lat:34.0,lng:28.0,csg:'TF-473',aircraftTypes:[{type:'Rafale M',qty:'24x',role:'Strike'},{type:'E-2C Hawkeye',qty:'3x',role:'AEW&C'}],notes:'Eastern Med. TF-473. Active strike role EPIC FURY context.',escorts:[{name:'FNS Provence',sub:'D652 Horizon',role:'AAW'},{name:'FNS Alsace',sub:'D656 FDI',role:'ASW'}],sightings:[{dt:'30 Mar 2026',src:'TF-473 PA',txt:'CdG sustained Rafale M ops East Med.'}],tags:['EASTMED','TF-473']},
  // Destroyers
  {id:'ddg51',name:'USS Arleigh Burke',sub:'DDG-51 // Burke Flt I',country:'US',type:'destroyer',status:'DEPLOYED',lat:33.0,lng:32.0,aircraftTypes:[{type:'MH-60R Seahawk',qty:'1x',role:'ASW'}],notes:'Eastern Med. BMD watch.',tags:['EASTMED']},
  {id:'ddg125',name:'USS Jack H. Lucas',sub:'DDG-125 // Burke Flt III',country:'US',type:'destroyer',status:'DEPLOYED',lat:22.0,lng:58.0,aircraftTypes:[{type:'MH-60R Seahawk',qty:'1x',role:'ASW'}],notes:'5th Fleet / Arabian Sea. AMDR.',tags:['5TH-FLEET']},
  {id:'d34',name:'HMS Diamond',sub:'D34 // Type 45',country:'UK',type:'destroyer',status:'DEPLOYED',lat:35.0,lng:33.0,aircraftTypes:[{type:'Wildcat HMA2',qty:'1x',role:'ASW'}],notes:'Mediterranean E / Akrotiri area.',tags:['MED']},
  // Submarines
  {id:'ssn795',name:'USS H.G. Rickover',sub:'SSN-795 // Virginia Blk V',country:'US',type:'submarine',status:'DEPLOYED',lat:33.5,lng:26.0,notes:'CentMed assessed. VPM — 40× TLAM capability.',tags:['ASSESSED','VPM']},
  {id:'anson',name:'HMS Anson',sub:'S123 // Astute-class',country:'UK',type:'submarine',status:'DEPLOYED',lat:-30.0,lng:78.0,notes:'Indian Ocean / AUKUS area.',tags:['AUKUS','INDIAN-OCEAN']},
  // Airbases — with detailed aircraft types
  {id:'otbh',name:'Al Udeid AB',sub:'OTBH // Qatar',country:'US',type:'airbase',status:'SURGE',lat:25.117,lng:51.314,arrCnt:14,socomCnt:4,
   aircraftTypes:[{type:'B-52H Stratofortress',qty:'2x (surged)',role:'Strategic Bomber',tails:['60-0040','60-0047']},{type:'F-35A Lightning II',qty:'12x',role:'Strike',tails:[]},{type:'F-15E Strike Eagle',qty:'8x',role:'Strike',tails:[]},{type:'KC-46A Pegasus',qty:'4x',role:'Tanker',tails:[]},{type:'E-3 AWACS',qty:'2x',role:'AEW&C',tails:[]},{type:'RQ-4 Global Hawk',qty:'1x',role:'ISR',tails:[]}],
   intel:'14 AMC arrivals / 48h vs baseline ~6. Y-series (SOCOM) missions = 4 of 14. Surge status sustained.',tags:['SURGE','CENTCOM','OP-EPIC-FURY']},
  {id:'llov',name:'Ovda AB',sub:'LLOV // Israel',country:'US',type:'airbase',status:'ELEVATED',lat:29.94,lng:34.935,arrCnt:26,socomCnt:12,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'surged',role:'Strategic Airlift (SOCOM/AMC)',tails:['00-0181','07-7178','02-1110','99-0059','05-5140','08-8195','07-7174']},{type:'F-15I Ra\'am',qty:'IDF organic',role:'Strike/Escort',tails:[]}],
   intel:'26 confirmed AMC arrivals. KPOB and KSVN dominant origins. All Y-series (SOCOM) flagged. Strategic reserve positioning = lead assessment.',tags:['SURGE','IDF','CENTCOM']},
  {id:'ojka',name:'King Abdullah II AB',sub:'OJKA // Jordan',country:'US',type:'airbase',status:'ELEVATED',lat:32.356,lng:36.259,arrCnt:30,socomCnt:12,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'30 tracked arrivals',role:'Strategic Airlift (AMC/SOCOM)',tails:['AE0817','AE1470','AE0804','AE2FA7','AE07E8','AE117C','AE2FAA','AE1237','AE080C','AE08E3','AE1464','AE123E','AE07D6','AE2FAA','AE123B']}],
   intel:'30 confirmed arrivals — highest single destination. Onward movements to OJAQ and OJMS (Muwaffaq Salti AB, Azraq). OJMS appearing as final destination on several missions — low visibility base.',tags:['JORDAN','HIGHEST-VOLUME']},
  {id:'okas',name:'Ali Al Salem AB',sub:'OKAS // Kuwait',country:'US',type:'airbase',status:'ELEVATED',lat:29.346,lng:47.519,arrCnt:6,socomCnt:2,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'tracked',role:'Strategic Airlift',tails:[]},{type:'MC-130J Commando II',qty:'assessed',role:'SOCOM Airlift',tails:[]},{type:'C-130J Super Hercules',qty:'assessed',role:'Tactical Airlift',tails:[]}],
   intel:'Army-Z mission series (A177/A179/A182) arriving via Spangdahlem (ETAD). OKAS→LTAG (Incirlik) and OKAS→OEPS (Prince Sultan AB) onward movements tracked.',tags:['KUWAIT','ARMY-Z']},
  {id:'lgel',name:'Elefsis AB',sub:'LGEL // Greece',country:'US',type:'airbase',status:'ELEVATED',lat:38.065,lng:23.556,arrCnt:3,socomCnt:1,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'3 confirmed',role:'Strategic Airlift',tails:[]}],
   intel:'New destination appearing late March. KHRT (Hurlburt Field) origin dominant. Staging point for eastern Med / CENTCOM axis.',tags:['GREECE','NATO','NEW-DEST']},
  {id:'etar',name:'Ramstein AB',sub:'ETAR // Germany',country:'US',type:'airbase',status:'ACTIVE',lat:49.437,lng:7.600,arrCnt:5,socomCnt:0,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'rotational',role:'Strategic Airlift'},{type:'KC-135R Stratotanker',qty:'2x det',role:'Tanker'},{type:'C-130J',qty:'assessed',role:'Tactical Airlift'}],
   intel:'Universal staging node — appears as VIA on virtually all CONUS→CENTCOM flights. Every tracked mission passes through ETAR.',tags:['EUCOM','STAGING']},
  {id:'egva',name:'RAF Fairford',sub:'EGVA // UK',country:'US',type:'airbase',status:'SURGE',lat:51.682,lng:-1.790,arrCnt:0,socomCnt:0,
   aircraftTypes:[{type:'B-52H Stratofortress',qty:'8x',role:'Strategic Bomber — Op EPIC FURY',tails:['MT BARONS','KNIGHTHAWKS','LA BUCCANEERS — BAZOO callsigns']},{type:'B-1B Lancer',qty:'18x+',role:'Strategic Bomber — Op EPIC FURY',tails:['Dyess BATS','Ellsworth THUNDERBIRDS','Whiteman EL TIGERS — PIKE/MOLT/TWIN/PURSE callsigns']}],
   intel:'CONFIRMED 8x B-52H + 18+ B-1B deployed as of 28 Mar 2026. Largest US forward bomber deployment since Gulf War. B-52H: 5BW (Minot) + 2BW (Barksdale). B-1B: 7BW (Dyess) + 28BW (Ellsworth) + 34BS (Whiteman). Op EPIC FURY strike platform.',tags:['SURGE','B-52H','B-1B','OP-EPIC-FURY']},
  // Events
  {id:'ev001',name:'Op EPIC FURY — Iran',sub:'CENTCOM / US+ISRAEL // ONGOING',country:'US',type:'strike',status:'ONGOING',lat:32.0,lng:53.0,notes:'8000+ targets struck. 120+ Iranian vessels sunk/damaged. B-52H, B-1B, F/A-18, Tomahawk, JDAM.',tags:['OP-EPIC-FURY','IRAN','CENTCOM']},
  {id:'ev002',name:'Houthi Suppression',sub:'OIR // ONGOING',country:'US',type:'strike',status:'ONGOING',lat:15.5,lng:43.5,notes:'Sustained ops. CVN-72 strike packages. Tomahawk employment confirmed.',tags:['OIR','HOUTHI','REDSEA']},
]

const LMSR_DATA = [
  {id:'pil',name:'USNS Pililaau',hull:'T-AK-304',sub:'T-AK-304 // Div.3',cat:'forward',centcom:'CRITICAL',lat:-7.2,lng:72.5,loc:'Diego Garcia — departure IMMINENT',lastRpt:'01 Apr 2026'},
  {id:'sol',name:'USNS 1st Lt. Jack Lummus',hull:'T-AK-3011',sub:'T-AK-3011 // Div.3',cat:'forward',centcom:'CRITICAL',lat:14.0,lng:50.5,loc:'Red Sea / Gulf of Aden (assessed)',lastRpt:'31 Mar 2026'},
  {id:'sgt',name:'USNS SGT. Matej Kocak',hull:'T-AK-3005',sub:'T-AK-3005 // Div.2',cat:'forward',centcom:'HIGH',lat:25.5,lng:56.5,loc:'Gulf of Oman / Strait of Hormuz',lastRpt:'30 Mar 2026'},
  {id:'ssp',name:'SS Sgt William Button',hull:'T-AK-3012',sub:'T-AK-3012',cat:'forward',centcom:'HIGH',lat:12.5,lng:44.0,loc:'Red Sea transit',lastRpt:'31 Mar 2026'},
  {id:'cpb',name:'USNS Cape Bover',hull:'T-AKR-9',sub:'T-AKR-9 // APS-3',cat:'conus_e',centcom:'MODERATE',lat:38.0,lng:-75.5,loc:'US East Coast',lastRpt:'28 Mar 2026'},
  {id:'cpd',name:'USNS Cape Decision',hull:'T-AKR-5054',sub:'T-AKR-5054 // APS-3',cat:'conus_e',centcom:'LOW',lat:37.8,lng:-75.3,loc:'CONUS East',lastRpt:'28 Mar 2026'},
]

const STATIC_CORONETS = [
  {id:'cor051',callsign:'CORONET EAST 051',status:'COMPLETE',acType:'F-22A',quantity:'6x',unit:'1st Fighter Wing, Langley AFB',from:'KLFI',to:'EGUL',tanker:'2× KC-46 GOLD 51/52 from Pittsburgh ARB',notes:'F-22A deployment Lakenheath. Completed 28 Mar.',tags:['F-22A','LAKENHEATH']},
  {id:'cor062',callsign:'CORONET EAST 062/032',status:'COMPLETE',acType:'A-10C',quantity:'6x+6x',unit:'190th FS / 107th FS — Boise ANGB',from:'KBOI',to:'EGUL',tanker:'BORA 43/44 tankers. TABOR 91-96 receivers.',notes:'A-10C deployment to Lakenheath. Completed 31 Mar.',tags:['A-10C','LAKENHEATH','ANG']},
  {id:'cor042',callsign:'CORONET WEST 042',status:'IN TRANSIT',acType:'F-15E',quantity:'4x',unit:'Strike Eagle det — Seymour Johnson',from:'KGSB',to:'EGUL',tanker:'HOBO 22/23 tankers confirmed 37N/15E.',notes:'In transit. HOBO tanker 37N/15E confirmed 31 Mar.',tags:['F-15E','IN-TRANSIT']},
]

const FEED_ITEMS = [
  {t:'0904Z',h:'<b>Op EPIC FURY</b> <span style="color:#e85040">●</span> CENTCOM confirms 8000+ targets struck Iran. 120+ vessels sunk.'},
  {t:'0847Z',h:'<b>EGVA</b> B-52H BAZOO52/BAZOO51 updated arrivals. Buccaneers + Barksdale.'},
  {t:'0821Z',h:'<b>KPOB</b> ▲ RCH868 <b>AMZ A182 7C 090</b> KBGR→ETAR→OKAS. Army-Z.'},
  {t:'0754Z',h:'<b>CORONET EAST 055</b> <span style="color:#f0a040">→</span> HOBO tanker 37N/15E confirmed.'},
  {t:'0712Z',h:'<b>LMSR Pililaau</b> <span style="color:#e85040">●</span> Diego Garcia — departure IMMINENT.'},
  {t:'0633Z',h:'<b>CORONET EAST 062</b> <span style="color:#39e0a0">✓</span> BORA 43/44 + TABOR 91-96 A-10s EGUL 31 Mar.'},
  {t:'0541Z',h:'<b>CVN-77</b> USS George HW Bush DEPLOYED 31 Mar — Atlantic transit.'},
  {t:'0502Z',h:'<b>OJKA</b> Onward: OJKA→OJMS (Muwaffaq Salti AB) multiple missions.'},
]

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo(target.center, target.zoom, { duration: 1.2 }) }, [target])
  return null
}

// ── CONUS base meta ───────────────────────────────────────
const CONUS_META = {
  KSVN:{name:'Hunter AAF',unit:'3rd Special Forces Group / USASOC',region:'Savannah, GA'},
  KPOB:{name:'Pope Field',unit:'82nd Airborne / JSOC (XVIII ABN Corps)',region:'Fort Bragg, NC'},
  KHOP:{name:'Campbell AAF',unit:'101st Airborne / 160th SOAR',region:'Fort Campbell, KY'},
  KGRF:{name:'Gray AAF (JBLM)',unit:'I Corps / 2nd SFOD area',region:'Tacoma, WA'},
  KTCM:{name:'McChord AFB',unit:'62nd Airlift Wing (AMC)',region:'JBLM, WA'},
  KNTU:{name:'NAS Oceana',unit:'SEAL Team area / NAVSOC',region:'Virginia Beach, VA'},
  KHRT:{name:'Hurlburt Field',unit:'1st SOW / AFSOC HQ',region:'Fort Walton Beach, FL'},
  KMCF:{name:'MacDill AFB',unit:'USSOCOM HQ / CENTCOM HQ',region:'Tampa, FL'},
  KNKX:{name:'MCAS Miramar',unit:'USMC Aviation',region:'San Diego, CA'},
  KMDT:{name:'Middletown PANG',unit:'193rd SOW (ANG)',region:'Harrisburg, PA'},
  KWRI:{name:'McGuire AFB',unit:'305th AMW (AMC)',region:'NJ'},
  KGSB:{name:'Seymour Johnson AFB',unit:'4th FW — F-15E',region:'Goldsboro, NC'},
}

export function MapView({ auth }) {
  const { flights, byBase, byDest, loading } = useFlights({ limit: 1000 })
  const [layers, setLayers] = useState({
    carriers:true, destroyers:true, subs:true, lmsr:true,
    airbases:true, conus:true, strikes:true,
  })
  const [country, setCountry]   = useState('ALL')
  const [selAsset, setSelAsset] = useState(null)
  const [selCor, setSelCor]     = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [abmAsset, setAbmAsset] = useState(null)
  const [liveFeeds, setLiveFeeds] = useState([])
  const [showRoutes, setShowRoutes] = useState(false)

  useEffect(() => {
    supabase.from('sigact_feed').select('*').order('created_at',{ascending:false}).limit(10)
      .then(({data}) => setLiveFeeds(data||[]))
    const ch = supabase.channel('feed_live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'sigact_feed'},
        p => setLiveFeeds(prev => [p.new,...prev].slice(0,10)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const allAssets = [...STATIC_ASSETS, ...LMSR_DATA.map(s=>({...s,type:'lmsr'}))]
  const filtered  = allAssets.filter(a => country==='ALL' || a.country===country || a.type==='lmsr')

  function selectAsset(a) { setSelAsset(a); setSelCor(null); if(a.lat&&a.lng) setFlyTarget({center:[a.lat,a.lng],zoom:6}) }
  function selectCoronet(c) { setSelCor(selCor?.id===c.id?null:c); setSelAsset(null) }

  // Stats
  const naval    = filtered.filter(a=>['carrier','destroyer','submarine'].includes(a.type)).length
  const bases    = filtered.filter(a=>a.type==='airbase').length
  const socomCnt = flights.filter(f=>f.mc_flag==='socom').length
  const activeCnt= flights.filter(f=>f.status==='ACTIVE').length

  // Route lines — only when both endpoints are known
  const routeLines = showRoutes ? flights.filter(f => ICAO_COORDS[f.base] && ICAO_COORDS[f.destination]) : []

  return (
    <div style={{flex:1,display:'grid',gridTemplateColumns:'260px 1fr 310px',overflow:'hidden'}}>

      {/* ── LEFT PANEL ── */}
      <div style={{background:C.bg2,borderRight:`1px solid ${C.br}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* CORONETs */}
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Active CORONETs" badge={STATIC_CORONETS.length} bc={C.a} bb="rgba(240,160,64,.12)" />
          <div style={{maxHeight:210,overflowY:'auto'}}>
            {STATIC_CORONETS.map(c => <CorItem key={c.id} cor={c} sel={selCor?.id===c.id} onClick={()=>selectCoronet(c)} />)}
          </div>
        </div>

        {/* Layers */}
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Layers" />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,padding:8}}>
            {[
              ['carriers','🚢','Carriers'],['destroyers','⚓','Destroyers'],
              ['subs','🔵','Submarines'],['lmsr','🚛','Sealift'],
              ['airbases','✈','AOR Bases'],['conus','◄','CONUS Dep'],
              ['strikes','⚡','Events'],
            ].map(([k,ico,lbl])=>(
              <LyrBtn key={k} icon={ico} label={lbl} on={layers[k]} onClick={()=>setLayers(l=>({...l,[k]:!l[k]}))} />
            ))}
            <LyrBtn icon="—" label="Routes" on={showRoutes} onClick={()=>setShowRoutes(v=>!v)} />
          </div>
        </div>

        {/* Country */}
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Country" />
          <div style={{display:'flex',flexWrap:'wrap',gap:4,padding:'6px 10px'}}>
            {[['ALL','ALL'],['US','🇺🇸 US'],['UK','🇬🇧 UK'],['FR','🇫🇷 FR']].map(([k,lbl])=>(
              <button key={k} onClick={()=>setCountry(k)}
                style={{...R,fontSize:11,fontWeight:600,letterSpacing:1,padding:'3px 8px',
                  border:`1px solid ${country===k?C.b:C.br}`,borderRadius:1,cursor:'pointer',
                  background:country===k?'rgba(80,160,232,.08)':'transparent',
                  color:country===k?C.b:C.t2}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Asset list */}
        <PH title="Assets" badge={filtered.length} bc={C.b} bb="rgba(80,160,232,.12)" />
        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.map(a=><AListItem key={a.id} asset={a} sel={selAsset?.id===a.id} onClick={()=>selectAsset(a)} />)}
        </div>
      </div>

      {/* ── MAP ── */}
      <div style={{position:'relative',overflow:'hidden'}}>
        <MapContainer center={[28,22]} zoom={3}
          style={{width:'100%',height:'100%',background:C.bg}}
          zoomControl={false} attributionControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_matter_no_labels/{z}/{x}/{y}{r}.png"
            subdomains="abcd" maxZoom={18}
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            subdomains="abcd" maxZoom={18} opacity={0.6}
          />
          <FlyTo target={flyTarget} />

          {/* CORONET route */}
          {selCor && (() => {
            const f=ICAO_COORDS[selCor.from], t=ICAO_COORDS[selCor.to]
            if(!f||!t) return null
            return <Polyline positions={[f,t]} pathOptions={{color:C.a,weight:2.5,dashArray:'8 4',opacity:.8}} />
          })()}

          {/* AMC route lines — only shown if enabled and both coords known */}
          {routeLines.map(f => {
            const col = f.mc_flag==='socom' ? C.p : C.b
            return <Polyline key={f.id+'_l'} positions={[ICAO_COORDS[f.base],ICAO_COORDS[f.destination]]}
              pathOptions={{color:col,weight:1,opacity:.3,dashArray:'4 4'}} />
          })}

          {/* Airbases */}
          {layers.airbases && STATIC_ASSETS.filter(a=>a.type==='airbase'&&(country==='ALL'||a.country===country)).map(a=>{
            const col=a.status==='SURGE'?C.r:a.status==='ELEVATED'?C.a:C.g
            return (
              <Marker key={a.id} position={[a.lat,a.lng]}
                icon={mkIcon('✈',col,26,a.status==='SURGE',a.arrCnt?'▲'+a.arrCnt:null)}
                eventHandlers={{click:()=>selectAsset(a)}}>
                <Popup closeButton={false}>
                  <div style={{...Z,fontSize:11,minWidth:180}}>
                    <div style={{...R,fontSize:14,fontWeight:700,color:C.tb,marginBottom:4}}>{a.name}</div>
                    <div style={{color:col,marginBottom:2}}>▲{a.arrCnt||0} arrivals tracked</div>
                    {a.socomCnt>0&&<div style={{color:C.p,marginBottom:6}}>🔒 {a.socomCnt} SOCOM-flagged missions</div>}
                    <button onClick={()=>{selectAsset(a);setAbmAsset(a)}}
                      style={{display:'block',width:'100%',marginTop:6,padding:'5px',...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.a}`,background:'rgba(240,160,64,.08)',color:C.a,cursor:'pointer'}}>
                      ▼ EXPAND DETAIL
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* CONUS departures */}
          {layers.conus && Object.entries(byBase).map(([icao,data])=>{
            const coords=ICAO_COORDS[icao]
            if(!coords) return null
            const meta=CONUS_META[icao]||{}
            return (
              <Marker key={icao+'_c'} position={coords}
                icon={mkIcon('◄',data.socom>0?C.p:C.b,22,false,data.total>5?String(data.total):null)}
                eventHandlers={{click:()=>selectAsset({id:icao,name:meta.name||icao,sub:`${icao} // ${meta.region||'CONUS'}`,type:'conus_base',lat:coords[0],lng:coords[1],...data,...meta})}}>
                <Popup closeButton={false}>
                  <div style={{...Z,fontSize:11}}>
                    <div style={{...R,fontSize:13,fontWeight:700,color:C.tb}}>{icao} — {meta.name||'CONUS Base'}</div>
                    <div style={{color:C.t2,marginTop:3,fontSize:10}}>{meta.unit}</div>
                    <div style={{color:C.b,marginTop:4}}>{data.total} flights tracked</div>
                    {data.socom>0&&<div style={{color:C.p}}>🔒 {data.socom} SOCOM missions</div>}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Carriers */}
          {layers.carriers && STATIC_ASSETS.filter(a=>a.type==='carrier'&&(country==='ALL'||a.country===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]}
              icon={mkIcon('🚢',a.status==='REFIT'?C.t3:C.b,28,a.status==='DEPLOYED')}
              eventHandlers={{click:()=>selectAsset(a)}} />
          ))}

          {/* Destroyers */}
          {layers.destroyers && STATIC_ASSETS.filter(a=>a.type==='destroyer'&&(country==='ALL'||a.country===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('⚓',C.b,22)}
              eventHandlers={{click:()=>selectAsset(a)}} />
          ))}

          {/* Submarines */}
          {layers.subs && STATIC_ASSETS.filter(a=>a.type==='submarine'&&(country==='ALL'||a.country===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('🔵',C.p,22)}
              eventHandlers={{click:()=>selectAsset(a)}} />
          ))}

          {/* LMSR */}
          {layers.lmsr && LMSR_DATA.map(s=>{
            const col=s.cat==='forward'?C.y:s.cat==='conus_e'?C.b:C.t2
            return (
              <Marker key={s.id} position={[s.lat,s.lng]}
                icon={mkIcon('🚛',col,22,s.cat==='forward')}
                eventHandlers={{click:()=>selectAsset({...s,type:'lmsr'})}}>
                <Popup closeButton={false}>
                  <div style={{...Z,fontSize:11}}>
                    <div style={{...R,fontSize:13,fontWeight:700,color:C.tb}}>{s.name}</div>
                    <div style={{color:s.centcom==='CRITICAL'?C.r:s.centcom==='HIGH'?C.a:C.t2,marginTop:3}}>{s.centcom}</div>
                    <div style={{color:C.t2,marginTop:2,fontSize:10}}>{s.loc}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Strikes */}
          {layers.strikes && STATIC_ASSETS.filter(a=>a.type==='strike'&&(country==='ALL'||a.country===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('⚡',C.r,24,true)}
              eventHandlers={{click:()=>selectAsset(a)}} />
          ))}
        </MapContainer>

        {/* View presets */}
        <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',zIndex:900,display:'flex',gap:3,background:'rgba(7,9,11,.92)',border:`1px solid ${C.br2}`,padding:5,backdropFilter:'blur(8px)'}}>
          {Object.keys(VIEWS).map(k=>(
            <button key={k} onClick={()=>setFlyTarget(VIEWS[k])}
              style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'5px 12px',border:`1px solid ${C.br}`,background:'transparent',color:C.t2,cursor:'pointer',textTransform:'uppercase'}}>
              {k}
            </button>
          ))}
        </div>

        {/* Top stat strip */}
        <div style={{position:'absolute',top:0,left:0,right:0,zIndex:800,background:'rgba(7,9,11,.88)',borderBottom:`1px solid ${C.br}`,display:'flex',backdropFilter:'blur(6px)'}}>
          {[{l:'AMC FLIGHTS',v:loading?'…':flights.length,c:C.b},{l:'SOCOM MISSIONS',v:socomCnt,c:C.p},{l:'ACTIVE',v:activeCnt,c:C.g}].map(({l,v,c})=>(
            <div key={l} style={{padding:'5px 14px',borderRight:`1px solid ${C.br}`}}>
              <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:1}}>{l}</div>
              <div style={{...R,fontSize:16,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{background:C.bg2,borderLeft:`1px solid ${C.br}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <PH title="Asset Detail" badge={selAsset?.name?.slice(0,18)||selCor?.callsign?.slice(0,18)||null} bc={C.t2} bb="transparent" />
        <div style={{flex:1,overflowY:'auto'}}>
          {selAsset ? <ADetail asset={selAsset} onExpand={()=>setAbmAsset(selAsset)} flights={flights} />
          : selCor   ? <CorDetail cor={selCor} />
          : <EmptyDetail />}
        </div>

        {/* Feed */}
        <div style={{height:165,borderTop:`1px solid ${C.br}`,background:C.bg,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'5px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
            <span style={{...R,fontSize:10,fontWeight:600,letterSpacing:3,color:C.t2}}>SIGACT FEED</span>
            <span style={{...Z,fontSize:9,color:C.g}}>● LIVE</span>
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            {(liveFeeds.length>0?liveFeeds.map(f=>({t:'LIVE',h:f.content_html,id:f.id})):FEED_ITEMS).map((f,i)=>(
              <div key={f.id||i} style={{display:'flex',gap:8,padding:'5px 12px',borderBottom:`1px solid rgba(30,44,58,.4)`,fontSize:11}}>
                <span style={{...Z,fontSize:9,color:C.t3,width:40,flexShrink:0,paddingTop:1}}>{f.t}</span>
                <span style={{color:C.t2,flex:1,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:f.h}} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{gridColumn:'1/4',height:24,background:C.bg4,borderTop:`1px solid ${C.br}`,display:'flex',alignItems:'center',padding:'0 14px',gap:16,flexShrink:0}}>
        {[{l:'NAVAL',v:naval,c:C.b},{l:'BASES',v:bases,c:C.g},{l:'LMSR',v:LMSR_DATA.length,c:C.y},{l:'AMC',v:loading?'…':flights.length,c:C.b}].map(({l,v,c})=>(
          <span key={l} style={{...Z,fontSize:10,color:C.t2}}>{l} <b style={{color:c,fontWeight:400}}>{v}</b></span>
        ))}
        {auth.isAdmin&&<span style={{...Z,fontSize:9,color:C.r,marginLeft:'auto',letterSpacing:1}}>● ADMIN MODE</span>}
      </div>

      {/* Airbase modal */}
      {abmAsset&&<AbmModal asset={abmAsset} flights={flights} onClose={()=>setAbmAsset(null)} />}
    </div>
  )
}

// ── Panel header ─────────────────────────────────────────
function PH({title,badge,bc,bb}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
      <span style={{...R,fontSize:10,fontWeight:600,letterSpacing:3,color:C.t2,textTransform:'uppercase'}}>{title}</span>
      {badge!=null&&<span style={{...Z,fontSize:10,padding:'1px 6px',borderRadius:1,color:bc,background:bb}}>{badge}</span>}
    </div>
  )
}

// ── Layer toggle button ───────────────────────────────────
function LyrBtn({icon,label,on,onClick}) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 8px',
      border:`1px solid ${on?'rgba(57,224,160,.2)':C.br}`,cursor:'pointer',
      background:on?'rgba(57,224,160,.04)':'transparent',borderRadius:1}}>
      <div style={{display:'flex',alignItems:'center',gap:6,...R,fontSize:11,fontWeight:500,color:C.t1}}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{width:26,height:13,background:on?C.g:C.br,borderRadius:6,position:'relative',transition:'.2s',flexShrink:0}}>
        <div style={{position:'absolute',width:9,height:9,background:C.bg,borderRadius:'50%',top:2,left:on?15:2,transition:'.2s'}} />
      </div>
    </div>
  )
}

// ── CORONET list item ─────────────────────────────────────
function CorItem({cor,sel,onClick}) {
  const sc=cor.status==='ACTIVE'?C.g:cor.status==='IN TRANSIT'?C.a:cor.status==='COMPLETE'?C.t3:C.b
  const sb=cor.status==='ACTIVE'?'rgba(57,224,160,.1)':cor.status==='IN TRANSIT'?'rgba(240,160,64,.12)':'rgba(22,30,40,.6)'
  return (
    <div onClick={onClick} style={{padding:'8px 10px',border:`1px solid ${sel?'rgba(240,160,64,.5)':C.br}`,borderRadius:1,margin:'4px 6px',cursor:'pointer',background:sel?'rgba(240,160,64,.06)':C.bg3}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
        <span style={{...R,fontSize:12,fontWeight:700,color:C.tb}}>{cor.callsign}</span>
        <span style={{...Z,fontSize:9,padding:'1px 5px',borderRadius:1,color:sc,background:sb}}>{cor.status}</span>
      </div>
      <div style={{...Z,fontSize:10,color:C.t2,marginBottom:3}}>{cor.from} → {cor.to}</div>
      <div style={{display:'flex',gap:4}}>
        <Tag label={cor.acType} color={C.b} />
        <Tag label={cor.quantity} color={C.g} />
      </div>
    </div>
  )
}

// ── Asset list item ───────────────────────────────────────
function AListItem({asset,sel,onClick}) {
  const imap={carrier:'🚢',destroyer:'⚓',submarine:'🔵',airbase:'✈',strike:'⚡',lmsr:'🚛',conus_base:'◄',manual:'◉'}
  const fmap={US:'🇺🇸',UK:'🇬🇧',FR:'🇫🇷'}
  let badge=null
  if(asset.arrCnt){const n=asset.arrCnt,c=n>=20?C.r:n>=10?C.a:C.g,b=n>=20?'rgba(232,80,64,.12)':n>=10?'rgba(240,160,64,.12)':'rgba(57,224,160,.1)';badge=<span style={{...Z,fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:1,background:b,color:c,border:`1px solid ${c}40`}}>▲{n}</span>}
  if(asset.type==='lmsr'){const cc=asset.centcom==='CRITICAL'?C.r:asset.centcom==='HIGH'?C.a:C.t3,bg=asset.centcom==='CRITICAL'?'rgba(232,80,64,.12)':asset.centcom==='HIGH'?'rgba(240,160,64,.12)':'rgba(22,30,40,.5)';badge=<span style={{...Z,fontSize:9,padding:'1px 4px',borderRadius:1,background:bg,color:cc}}>{asset.centcom||'—'}</span>}
  if(asset.type==='conus_base'&&asset.total>0){badge=<span style={{...Z,fontSize:10,padding:'1px 5px',borderRadius:1,background:'rgba(80,160,232,.12)',color:C.b}}>×{asset.total}</span>}
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',cursor:'pointer',borderBottom:`1px solid rgba(30,44,58,.4)`,background:sel?'rgba(80,160,232,.06)':'transparent',borderLeft:sel?`2px solid ${C.b}`:'2px solid transparent'}}>
      <div style={{fontSize:12,flexShrink:0}}>{fmap[asset.country]||''}{imap[asset.type]||'◉'}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{...R,fontSize:12,fontWeight:600,color:C.tb,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{asset.name}</div>
        <div style={{...Z,fontSize:9,color:C.t2}}>{asset.sub||asset.hull||''}</div>
      </div>
      {badge}
    </div>
  )
}

// ── Asset detail (right panel) ────────────────────────────
function ADetail({asset,onExpand,flights}) {
  const stCol={DEPLOYED:C.g,ACTIVE:C.g,SURGE:C.r,ELEVATED:C.a,ONGOING:C.r,REFIT:C.t3,'IN PORT':C.t2,NMC:C.r}[asset.status]||C.t2
  const [acExpanded, setAcExpanded] = useState(false)
  const [selAcType, setSelAcType]   = useState(null)

  // For CONUS bases, derive stats from flights
  const isConus = asset.type === 'conus_base'
  const baseFlights = isConus ? flights.filter(f=>f.base===asset.id) : []
  const now = new Date()
  const sevenDaysAgo = new Date(now - 7*24*60*60*1000)
  const recentFlights = baseFlights.filter(f => f.dep_date && new Date(f.dep_date) >= sevenDaysAgo)
  const destCounts = baseFlights.reduce((acc,f)=>{acc[f.destination]=(acc[f.destination]||0)+1;return acc},{})
  const topDests = Object.entries(destCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)

  if (isConus) {
    return (
      <div>
        <DBlk label="BASE" value={asset.name} large />
        <DBlk label="UNIT" value={asset.unit||'—'} />
        <DBlk label="REGION" value={asset.region||'—'} />
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>FLIGHT ACTIVITY</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
            <SBox value={baseFlights.length} label="TOTAL" color={C.b} />
            <SBox value={recentFlights.length} label="LAST 7D" color={C.g} />
            <SBox value={baseFlights.filter(f=>f.mc_flag==='socom').length} label="SOCOM" color={C.p} />
          </div>
          {topDests.length>0&&(
            <>
              <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t3,marginBottom:6}}>TOP DESTINATIONS</div>
              {topDests.map(([dest,cnt])=>(
                <div key={dest} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{...Z,fontSize:10,color:C.b,width:50}}>{dest}</span>
                  <div style={{flex:1,height:4,background:'#0c1018',borderRadius:2,overflow:'hidden'}}>
                    <div style={{width:`${(cnt/topDests[0][1])*100}%`,height:'100%',background:C.b,borderRadius:2}} />
                  </div>
                  <span style={{...Z,fontSize:10,color:C.t2,width:16,textAlign:'right'}}>{cnt}</span>
                </div>
              ))}
            </>
          )}
        </div>
        {baseFlights.length>0&&(
          <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
            <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>RECENT FLIGHTS</div>
            {baseFlights.slice(0,8).map(f=>(
              <div key={f.id} style={{display:'flex',gap:6,marginBottom:5,fontSize:10,...Z}}>
                <span style={{color:C.t3,width:32}}>{f.dep_date?.slice(5)||'—'}</span>
                <span style={{color:C.tb,width:60,fontWeight:600}}>{f.callsign}</span>
                <span style={{color:f.mc_flag==='socom'?C.p:C.t1,flex:1,fontSize:9}}>{f.mission_code}</span>
                <span style={{color:C.g,width:36}}>{f.destination}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // For all other assets:
  const inbound7d  = asset.arrCnt || 0
  const outbound7d = asset.type==='airbase' ? Math.round(inbound7d * 0.7) : null // estimated until we have departure data

  return (
    <div>
      <div style={{padding:'11px 13px',borderBottom:`1px solid ${C.br}`}}>
        <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:4}}>DESIGNATION</div>
        <div style={{...R,fontSize:17,fontWeight:700,color:C.tb,marginBottom:2}}>{asset.name}</div>
        <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub||asset.hull||''}</div>
      </div>

      {/* Stats — arrivals/departures for airbases, status+position for others */}
      <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
        {asset.type==='airbase' ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            <SBox value={inbound7d} label="ARRIVALS" color={C.a} />
            <SBox value={outbound7d||'—'} label="DEPARTURES" color={C.b} />
            <SBox value={asset.socomCnt||0} label="SOCOM" color={C.p} />
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            <SBox value={asset.status} label="STATUS" color={stCol} />
            {asset.type==='lmsr'
              ? <SBox value={asset.centcom||'—'} label="CENTCOM" color={asset.centcom==='CRITICAL'?C.r:asset.centcom==='HIGH'?C.a:C.t2} />
              : <SBox value={asset.csg||'—'} label="CSG/GROUP" color={C.b} />
            }
          </div>
        )}
      </div>

      {asset.notes&&<DBlk label="NOTES" value={asset.notes} />}
      {asset.type==='lmsr'&&asset.loc&&<DBlk label="POSITION" value={`${asset.loc}\nLast report: ${asset.lastRpt}`} />}

      {/* Aircraft types — expandable with tail numbers */}
      {asset.aircraftTypes?.length>0&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2}}>AIRCRAFT ON STATION</div>
            <button onClick={()=>setAcExpanded(v=>!v)}
              style={{...Z,fontSize:9,color:C.b,background:'none',border:'none',cursor:'pointer',letterSpacing:1}}>
              {acExpanded?'▲ COLLAPSE':'▼ EXPAND'}
            </button>
          </div>
          {asset.aircraftTypes.map((ac,i)=>(
            <div key={i} style={{marginBottom:acExpanded?8:4}}>
              <div onClick={()=>setSelAcType(selAcType===i?null:i)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',
                  background:selAcType===i?'rgba(80,160,232,.08)':C.bg,
                  border:`1px solid ${selAcType===i?C.b:C.br}`,borderRadius:1,cursor:'pointer',marginBottom:2}}>
                <span style={{...R,fontSize:13,fontWeight:700,color:C.tb,flex:1}}>{ac.type}</span>
                <span style={{...Z,fontSize:10,color:C.y,fontWeight:700}}>{ac.qty}</span>
                <span style={{...R,fontSize:9,color:C.t2,letterSpacing:1}}>{ac.role}</span>
              </div>
              {selAcType===i&&ac.tails?.length>0&&(
                <div style={{padding:'6px 8px',background:'rgba(80,160,232,.05)',border:`1px solid rgba(80,160,232,.15)`,marginBottom:4}}>
                  <div style={{...R,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:4}}>CONFIRMED TAIL NUMBERS / CALLSIGNS</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {ac.tails.map((t,j)=>(
                      <span key={j} style={{...Z,fontSize:9,padding:'2px 5px',background:'rgba(80,160,232,.1)',border:`1px solid rgba(80,160,232,.2)`,color:C.b,borderRadius:1}}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {asset.intel&&<DBlk label="INTEL ASSESSMENT" value={asset.intel} highlight />}

      {asset.type==='airbase'&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <button onClick={onExpand}
            style={{display:'block',width:'100%',padding:6,...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.a}`,background:'rgba(240,160,64,.08)',color:C.a,cursor:'pointer'}}>
            ▼ EXPAND — FLIGHTS / IMAGERY / INTEL
          </button>
        </div>
      )}

      {asset.escorts?.length>0&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>BATTLE GROUP</div>
          {asset.escorts.map((e,i)=>(
            <div key={i} style={{display:'flex',gap:10,marginBottom:5,fontSize:11}}>
              <span style={{...R,color:C.b,width:130,fontWeight:600,fontSize:12}}>{e.name}</span>
              <span style={{...Z,fontSize:9,color:C.t2}}>{e.sub}</span>
              <span style={{...R,color:C.t2,marginLeft:'auto',fontSize:10}}>{e.role}</span>
            </div>
          ))}
        </div>
      )}

      {asset.sightings?.length>0&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>RECENT SIGHTINGS</div>
          {asset.sightings.map((s,i)=>(
            <div key={i} style={{marginBottom:8,padding:'7px 10px',background:C.bg,borderLeft:`2px solid ${C.b}`}}>
              <div style={{...Z,fontSize:9,color:C.t3,marginBottom:3}}>{s.dt} // {s.src}</div>
              <div style={{fontSize:11,color:C.t1,lineHeight:1.5}}>{s.txt}</div>
            </div>
          ))}
        </div>
      )}

      {asset.tags?.length>0&&(
        <div style={{padding:'8px 13px',display:'flex',flexWrap:'wrap',gap:4}}>
          {asset.tags.map(t=>(
            <span key={t} style={{...Z,fontSize:9,padding:'2px 5px',borderRadius:1,background:'rgba(57,224,160,.08)',border:'1px solid rgba(57,224,160,.2)',color:C.g}}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CORONET detail ────────────────────────────────────────
function CorDetail({cor}) {
  const sc=cor.status==='ACTIVE'?C.g:cor.status==='IN TRANSIT'?C.a:C.t3
  return (
    <div>
      <DBlk label="CALLSIGN" value={cor.callsign} large />
      <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          <SBox value={cor.status} label="STATUS" color={sc} />
          <SBox value={cor.acType} label="AIRCRAFT" color={C.b} />
        </div>
      </div>
      <DBlk label="ROUTE" value={`${cor.from} → ${cor.to}`} />
      <DBlk label="UNIT" value={cor.unit||'—'} />
      <DBlk label="TANKER SUPPORT" value={cor.tanker} />
      <DBlk label="NOTES" value={cor.notes} />
      {cor.tags?.length>0&&(
        <div style={{padding:'8px 13px',display:'flex',flexWrap:'wrap',gap:4}}>
          {cor.tags.map(t=><Tag key={t} label={t} color={C.a} />)}
        </div>
      )}
    </div>
  )
}

function EmptyDetail() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,color:C.t3,...Z,fontSize:11,letterSpacing:2,gap:10,textAlign:'center',padding:20}}>
      <div style={{fontSize:24,opacity:.2}}>◎</div>
      <div>SELECT ASSET</div>
      <div style={{fontSize:9,color:'#1a2a34'}}>OR CORONET MISSION</div>
    </div>
  )
}

function SBox({value,label,color}) {
  return (
    <div style={{padding:8,background:C.bg,border:`1px solid ${C.br}`,borderRadius:1}}>
      <div style={{...R,fontSize:16,fontWeight:700,marginBottom:1,color,lineHeight:1.1}}>{value}</div>
      <div style={{...Z,fontSize:9,color:C.t2,letterSpacing:1}}>{label}</div>
    </div>
  )
}

function DBlk({label,value,large,highlight}) {
  return (
    <div style={{padding:'9px 13px',borderBottom:`1px solid ${C.br}`}}>
      <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:4}}>{label}</div>
      <div style={{...Z,fontSize:large?13:10,color:highlight?C.a:C.t1,lineHeight:1.7,whiteSpace:'pre-line'}}>{value}</div>
    </div>
  )
}

function Tag({label,color}) {
  const bg = color==='#50a0e8'?'rgba(80,160,232,.15)':color==='#39e0a0'?'rgba(57,224,160,.1)':'rgba(240,160,64,.1)'
  const br2 = color==='#50a0e8'?'rgba(80,160,232,.3)':color==='#39e0a0'?'rgba(57,224,160,.25)':'rgba(240,160,64,.25)'
  return <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:1,background:bg,border:`1px solid ${br2}`,color}}>{label}</span>
}

// ── Airbase expand modal ──────────────────────────────────
function AbmModal({asset,flights,onClose}) {
  const [tab,setTab] = useState('ARRIVALS (INBOUND)')
  const tabs = ['OVERVIEW','ARRIVALS (INBOUND)','DEPARTURES (OUTBOUND)','AIRCRAFT','INTEL']

  // Match flights to this airbase by ICAO
  const icao = asset.sub?.split('//')[0]?.trim() || asset.id?.toUpperCase()
  const inbound  = flights.filter(f=>f.destination===icao||f.destination===asset.id?.toUpperCase())
  const outbound = flights.filter(f=>f.base===icao||f.base===asset.id?.toUpperCase())
  const socomIn  = inbound.filter(f=>f.mc_flag==='socom').length

  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:4000,background:C.bg2,
      borderTop:`2px solid ${C.a}`,display:'flex',flexDirection:'column',maxHeight:'60vh',
      animation:'slideUp .28s ease'}}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{display:'flex',alignItems:'stretch',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
        <div style={{padding:'9px 16px',flex:1}}>
          <div style={{...R,fontSize:19,fontWeight:700,color:C.tb,letterSpacing:1}}>{asset.name}</div>
          <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub}</div>
        </div>
        {[{v:inbound.length,l:'INBOUND',c:C.a},{v:outbound.length,l:'OUTBOUND',c:C.b},{v:socomIn,l:'SOCOM',c:C.p}].map(({v,l,c})=>(
          <div key={l} style={{padding:'9px 16px',borderLeft:`1px solid ${C.br}`,textAlign:'center',minWidth:70}}>
            <div style={{...R,fontSize:20,fontWeight:700,color:c,marginBottom:1}}>{v}</div>
            <div style={{...Z,fontSize:9,color:C.t2,letterSpacing:1}}>{l}</div>
          </div>
        ))}
        <div onClick={onClose} style={{width:48,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:C.t2,cursor:'pointer',borderLeft:`1px solid ${C.br}`}}>✕</div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0,overflowX:'auto'}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'8px 14px',cursor:'pointer',
              color:tab===t?C.a:C.t2,background:'none',border:'none',
              borderBottom:`2px solid ${tab===t?C.a:'transparent'}`,whiteSpace:'nowrap'}}>
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:'auto'}}>
        {tab==='OVERVIEW'&&(
          <div style={{padding:'14px 18px'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              <SBox value={inbound.length} label="INBOUND TRACKED" color={C.a} />
              <SBox value={outbound.length} label="OUTBOUND" color={C.b} />
              <SBox value={socomIn} label="SOCOM MISSIONS" color={C.p} />
            </div>
            <DBlk label="STATUS" value={asset.status} />
            {asset.intel&&<DBlk label="INTEL ASSESSMENT" value={asset.intel} highlight />}
          </div>
        )}
        {(tab==='ARRIVALS (INBOUND)'||tab==='DEPARTURES (OUTBOUND)')&&(
          <div>
            {inbound.length===0&&outbound.length===0 ? (
              <div style={{padding:20,...Z,fontSize:10,color:C.t3}}>
                {asset.intel||'No ACARS flight data currently matched to this base. Flight data populates automatically from your ACARS bot feed.'}
              </div>
            ) : (
              <FlightTable flights={tab.includes('INBOUND')?inbound:outbound} />
            )}
          </div>
        )}
        {tab==='AIRCRAFT'&&(
          <div style={{padding:'14px 18px'}}>
            {(asset.aircraftTypes||[]).map((ac,i)=>(
              <div key={i} style={{marginBottom:10,padding:'8px 12px',background:C.bg,border:`1px solid ${C.br}`,borderRadius:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:ac.tails?.length>0?6:0}}>
                  <span style={{...R,fontSize:14,fontWeight:700,color:C.tb,flex:1}}>{ac.type}</span>
                  <span style={{...Z,fontSize:11,color:C.y,fontWeight:700}}>{ac.qty}</span>
                  <span style={{...R,fontSize:10,color:C.t2}}>{ac.role}</span>
                </div>
                {ac.tails?.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                    {ac.tails.map((t,j)=>(
                      <span key={j} style={{...Z,fontSize:9,padding:'2px 6px',background:'rgba(80,160,232,.1)',border:`1px solid rgba(80,160,232,.2)`,color:C.b,borderRadius:1}}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {tab==='INTEL'&&(
          <div style={{padding:'14px 18px',...Z,fontSize:10,color:C.t1,lineHeight:1.8}}>
            {asset.intel||'No intel assessment on file.'}
          </div>
        )}
      </div>
    </div>
  )
}

function FlightTable({flights}) {
  if(!flights.length) return <div style={{padding:20,...Z,fontSize:10,color:C.t3}}>No records matched.</div>
  return (
    <div>
      <div style={{padding:'6px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2,letterSpacing:1}}>
        ← {flights.length} flights tracked. Origin codes clickable → CONUS base detail.
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead>
          <tr style={{background:C.bg4,position:'sticky',top:0}}>
            {['DATE','CALLSIGN','MISSION CODE','ORIGIN','MC TYPE','VIA','STATUS'].map(h=>(
              <th key={h} style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,padding:'6px 9px',borderBottom:`1px solid ${C.br}`,textAlign:'left'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flights.map(f=>{
            const isSOCOM = f.mc_flag==='socom'
            return (
              <tr key={f.id} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                <td style={{padding:'5px 9px',...Z,color:C.t3,fontSize:10}}>{f.dep_date?.slice(5)||'—'}</td>
                <td style={{padding:'5px 9px',...R,fontWeight:700,color:C.tb,fontSize:12}}>{f.callsign}</td>
                <td style={{padding:'5px 9px',...Z,fontSize:10,color:C.t1,letterSpacing:'.5px'}}>{f.mission_code}</td>
                <td style={{padding:'5px 9px',...Z,color:C.b,fontSize:10}}>{f.base||f.destination}</td>
                <td style={{padding:'5px 9px'}}>
                  <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:1,
                    background:isSOCOM?'rgba(160,96,232,.15)':'rgba(80,160,232,.12)',
                    border:`1px solid ${isSOCOM?'rgba(160,96,232,.4)':'rgba(80,160,232,.3)'}`,
                    color:isSOCOM?C.p:C.b}}>
                    {isSOCOM?'SOCOM':(f.mc_flag||'AMC').toUpperCase()}
                  </span>
                </td>
                <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.via||'—'}</td>
                <td style={{padding:'5px 9px',...R,fontSize:10,color:{ACTIVE:C.g,COMPLETE:C.t3,PENDING:C.a,CANCELLED:C.r}[f.status]||C.t2}}>{f.status}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
