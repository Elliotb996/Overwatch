import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useFlights } from '../hooks/useFlights'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }

// ── Colours ──────────────────────────────────────────────
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8', p:'#a060e8',
  y:'#e8d040', t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28',
  br:'#1e2c3a', br2:'#273a4c',
}

// ── Div icon factory ──────────────────────────────────────
function mkIcon(emoji, color, size = 26, pulse = false, badge = null) {
  const rip = pulse
    ? `<div style="position:absolute;inset:-5px;border:1.5px solid ${color};border-radius:2px;opacity:.4;animation:rp 2.2s infinite"></div>` : ''
  const bdg = badge
    ? `<div style="position:absolute;top:-7px;right:-9px;background:#e85040;color:#07090b;font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;min-width:14px;text-align:center;line-height:13px">${badge}</div>` : ''
  const s = size + 14
  return L.divIcon({
    html: `<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center">
      ${rip}
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(7,9,11,.88);border:1.5px solid ${color};border-radius:2px;font-size:${Math.round(size*.5)}px;box-shadow:0 0 8px ${color}44;z-index:1">${emoji}</div>
      ${bdg}
    </div>
    <style>@keyframes rp{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}</style>`,
    className: '', iconSize: [s, s], iconAnchor: [s/2, s/2],
  })
}

// ── Hardcoded view presets ──────────────────────────────
const VIEWS = {
  WORLD: { center: [25, 22], zoom: 3 },
  MED:   { center: [37, 22], zoom: 5 },
  GULF:  { center: [26, 52], zoom: 5 },
  ATLANTIC: { center: [44,-30], zoom: 4 },
  INDOPACOM:{ center: [20,120], zoom: 4 },
}

// ── Static asset data (matches HTML v4) ─────────────────
const STATIC_ASSETS = [
  // Carriers
  {id:'cvn78',name:'USS Gerald R. Ford',sub:'CVN-78 // Ford-class',country:'US',type:'carrier',status:'DEPLOYED',lat:43.5,lng:16.5,csg:'CSG-12',aircraft:'F/A-18E/F, E-2D, EA-18G, F-35C',notes:'Adriatic/Split Croatia area 28 Mar. EUCOM/CENTCOM direction.',escorts:[{name:'USS Normandy',sub:'CG-60 Ticonderoga',role:'BMD/AAW'},{name:'USS Ramage',sub:'DDG-61 Burke Flt I',role:'ASW'},{name:'USS McFaul',sub:'DDG-74 Burke Flt II',role:'AAW'},{name:'USS Laboon',sub:'DDG-58 Burke Flt I',role:'ASW'}],tags:['ADRIATIC','CENTCOM-BOUND','DEPLOYED']},
  {id:'cvn72',name:'USS Abraham Lincoln',sub:'CVN-72 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:16.0,lng:54.0,csg:'CSG-3',aircraft:'F/A-18E/F, E-2D, EA-18G',notes:'5th Fleet / Arabian Sea. Houthi suppression. Tomahawk employment confirmed.',escorts:[{name:'USS Mobile Bay',sub:'CG-53 Ticonderoga',role:'BMD'},{name:'USS Fitzgerald',sub:'DDG-62 Burke Flt I',role:'ASW'},{name:'USS Sampson',sub:'DDG-102 Burke Flt IIA',role:'AAW/BMD'}],tags:['5TH-FLEET','ARABIAN-SEA','ACTIVE']},
  {id:'cvn77',name:'USS George H.W. Bush',sub:'CVN-77 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:36.0,lng:-12.0,csg:'CSG-10',aircraft:'F/A-18E/F, E-2D',notes:'DEPLOYED as of 31 Mar. Atlantic transit — EUCOM/CENTCOM direction.',escorts:[],tags:['ATLANTIC','EUCOM-BOUND','DEPLOYED']},
  {id:'r08',name:'HMS Queen Elizabeth',sub:'R08 // QE-class',country:'UK',type:'carrier',status:'REFIT',lat:56.0,lng:-3.4,csg:'CSG21',aircraft:'F-35B (617 Sqn)',notes:'Refit 482 days. Rosyth. HMS Prince of Wales also in maintenance.',escorts:[],tags:['REFIT','ROSYTH']},
  {id:'r91',name:'Charles de Gaulle',sub:'R91 // CdG-class',country:'FR',type:'carrier',status:'DEPLOYED',lat:34.0,lng:28.0,csg:'TF-473',aircraft:'Rafale M, E-2C',notes:'Eastern Med. TF-473. Active strike role EPIC FURY context.',escorts:[{name:'FNS Provence',sub:'D652 Horizon',role:'AAW'},{name:'FNS Alsace',sub:'D656 FDI',role:'ASW'}],tags:['EASTMED','TF-473']},
  // Destroyers
  {id:'ddg51',name:'USS Arleigh Burke',sub:'DDG-51 // Burke Flt I',country:'US',type:'destroyer',status:'DEPLOYED',lat:33.0,lng:32.0,notes:'Eastern Med. BMD watch.',tags:['EASTMED']},
  {id:'ddg125',name:'USS Jack H. Lucas',sub:'DDG-125 // Burke Flt III',country:'US',type:'destroyer',status:'DEPLOYED',lat:22.0,lng:58.0,notes:'5th Fleet / Arabian Sea. AMDR.',tags:['5TH-FLEET']},
  {id:'d34',name:'HMS Diamond',sub:'D34 // Type 45',country:'UK',type:'destroyer',status:'DEPLOYED',lat:35.0,lng:33.0,notes:'Deployed Mediterranean E / Akrotiri area.',tags:['MED']},
  // Submarines
  {id:'ssn795',name:'USS H.G. Rickover',sub:'SSN-795 // Virginia Blk V',country:'US',type:'submarine',status:'DEPLOYED',lat:33.5,lng:26.0,notes:'CentMed assessed. VPM — 40× TLAM capability.',tags:['ASSESSED','VPM']},
  {id:'anson',name:'HMS Anson',sub:'S123 // Astute-class',country:'UK',type:'submarine',status:'DEPLOYED',lat:-30.0,lng:78.0,notes:'Deployed — Indian Ocean / AUKUS area.',tags:['AUKUS','INDIAN-OCEAN']},
  // Airbases
  {id:'otbh',name:'Al Udeid AB',sub:'OTBH // Qatar',country:'US',type:'airbase',status:'SURGE',lat:25.117,lng:51.314,arrCnt:14,socomCnt:4,notes:'CENTCOM FWD HQ. 379th AEW. Elevated ops tempo sustained.',aircraft:['B-52H (surged)','F-35A','F-15E','KC-46','E-3 AWACS','RQ-4'],intel:'14 AMC arrivals / 48h vs baseline ~6. Y-series SOCOM missions = 4 of 14. Surge status sustained.',tags:['SURGE','CENTCOM','OP-EPIC-FURY']},
  {id:'llov',name:'Ovda AB',sub:'LLOV // Israel',country:'US',type:'airbase',status:'ELEVATED',lat:29.94,lng:34.935,arrCnt:26,socomCnt:12,notes:'26 confirmed AMC arrivals. Primary CENTCOM staging hub Israel.',aircraft:['C-17 (SOCOM/AMC)','F-15I (IDF)'],intel:'KPOB and KSVN dominant origins. Strategic reserve positioning = lead assessment.',tags:['SURGE','IDF','CENTCOM']},
  {id:'ojka',name:'King Abdullah II AB',sub:'OJKA // Jordan',country:'US',type:'airbase',status:'ELEVATED',lat:32.36,lng:36.25,arrCnt:30,socomCnt:12,notes:'30 confirmed arrivals — highest single destination. Extensive onward movement OJAQ/OJMS.',aircraft:['C-17 (AMC/SOCOM)'],intel:'Onward movements to OJAQ and OJMS — Muwaffaq Salti AB (Azraq) appearing as final destination.',tags:['JORDAN','HIGHEST-VOLUME']},
  {id:'okas',name:'Ali Al Salem AB',sub:'OKAS // Kuwait',country:'US',type:'airbase',status:'ELEVATED',lat:29.346,lng:47.52,arrCnt:6,socomCnt:2,notes:'C-17 and Army-Z series arrivals. PMZ/JMZ missions confirmed.',aircraft:['C-17','C-130J','MC-130J'],intel:'Army-Z mission series (A177/A179/A182) arriving via ETAD. OKAS→LTAG and OKAS→OEPS onward tracked.',tags:['KUWAIT','ARMY-Z']},
  {id:'lgel',name:'Elefsis AB',sub:'LGEL // Greece',country:'US',type:'airbase',status:'ELEVATED',lat:38.06,lng:23.55,arrCnt:3,socomCnt:1,notes:'New destination appearing in latest data. KHRT/KMDT missions.',aircraft:['C-17 (AMC)'],intel:'3 confirmed arrivals 24-26 Mar. KHRT origin dominant. Staging for eastern Med/CENTCOM axis.',tags:['GREECE','NATO','NEW-DEST']},
  {id:'etar',name:'Ramstein AB',sub:'ETAR // Germany',country:'US',type:'airbase',status:'ACTIVE',lat:49.437,lng:7.6,arrCnt:5,socomCnt:0,notes:'Universal staging node — appears in Via on virtually all tracked flights.',aircraft:['C-17','KC-135','C-130'],intel:'ETAR is the gateway. Every CONUS→CENTCOM flight transits here.',tags:['EUCOM','STAGING']},
  {id:'egva',name:'RAF Fairford',sub:'EGVA // UK — USAF BOMBER HUB',country:'US',type:'airbase',status:'SURGE',lat:51.68,lng:-1.79,arrCnt:0,socomCnt:0,notes:'CONFIRMED: 8x B-52H + 18+ B-1B Lancer deployed as of 28 Mar 2026. Op EPIC FURY forward bomber posture.',aircraft:['B-52H (8x — Minot + Barksdale)','B-1B Lancer (18x — Dyess + Ellsworth + Whiteman)'],intel:'Largest US forward bomber deployment since Gulf War assessed. B-52H: 5BW (Minot) + 2BW (Barksdale). B-1B: 7BW (Dyess) + 28BW (Ellsworth) + 34BS (Whiteman).',tags:['SURGE','B-52H','B-1B','OP-EPIC-FURY']},
  // Bombers
  {id:'egva-b52',name:'B-52H — 8x at Fairford',sub:'5BW (Minot) + 2BW (Barksdale)',country:'US',type:'bomber',status:'DEPLOYED',lat:51.72,lng:-1.82,notes:'HOOKY/FLIP/BAZOO callsigns confirmed. Op EPIC FURY.',tags:['B-52H','FAIRFORD']},
  {id:'egva-b1b',name:'B-1B Lancer — 18x at Fairford',sub:'7BW (Dyess) + 28BW + 34BS',country:'US',type:'bomber',status:'DEPLOYED',lat:51.64,lng:-1.76,notes:'PIKE/MOLT/TWIN/PURSE callsigns. Multiple squadrons forward deployed.',tags:['B-1B','FAIRFORD']},
  // Events
  {id:'ev001',name:'Op EPIC FURY — Iran Strikes',sub:'CENTCOM / US+ISRAEL // ONGOING',country:'US',type:'strike',status:'ONGOING',lat:32.0,lng:53.0,notes:'8000+ targets struck. 120+ Iranian vessels sunk/damaged. B-52H, B-1B, F/A-18, Tomahawk, JDAM.',tags:['OP-EPIC-FURY','IRAN','CENTCOM']},
  {id:'ev002',name:'Houthi Suppression — Red Sea',sub:'OIR // ONGOING',country:'US',type:'strike',status:'ONGOING',lat:15.5,lng:43.5,notes:'Sustained ops. CVN-72 strike packages. Tomahawk employment confirmed.',tags:['OIR','HOUTHI','REDSEA']},
]

const LMSR_DATA = [
  {id:'pil',name:'USNS Pililaau',hull:'T-AK-304',sub:'T-AK-304 // Div. 3',cat:'forward',centcom:'CRITICAL',lat:-7.2,lng:72.5,loc:'Diego Garcia — departure IMMINENT',lastRpt:'01 Apr 2026'},
  {id:'sol',name:'USNS 1st Lt. Jack Lummus',hull:'T-AK-3011',sub:'T-AK-3011 // Div.3',cat:'forward',centcom:'CRITICAL',lat:14.0,lng:50.5,loc:'Assessed — Red Sea / Gulf of Aden',lastRpt:'31 Mar 2026'},
  {id:'sgt',name:'USNS SGT. Matej Kocak',hull:'T-AK-3005',sub:'T-AK-3005 // Div.2',cat:'forward',centcom:'HIGH',lat:25.5,lng:56.5,loc:'Gulf of Oman / Strait of Hormuz assessed',lastRpt:'30 Mar 2026'},
  {id:'ssp',name:'SS Sgt William Button',hull:'T-AK-3012',sub:'T-AK-3012',cat:'forward',centcom:'HIGH',lat:12.5,lng:44.0,loc:'Red Sea transit',lastRpt:'31 Mar 2026'},
  {id:'cpb',name:'USNS Cape Bover',hull:'T-AKR-9',sub:'T-AKR-9 // APS-3',cat:'conus_e',centcom:'MODERATE',lat:38.0,lng:-75.5,loc:'US East Coast — CONUS',lastRpt:'28 Mar 2026'},
  {id:'cpd',name:'USNS Cape Decision',hull:'T-AKR-5054',sub:'T-AKR-5054 // APS-3',cat:'conus_e',centcom:'LOW',lat:37.8,lng:-75.3,loc:'CONUS East',lastRpt:'28 Mar 2026'},
]

const STATIC_CORONETS = [
  {id:'cor051',callsign:'CORONET EAST 051',status:'COMPLETE',acType:'F-22A',quantity:'6x',unit:'1st Fighter Wing, Langley AFB',from:'KLFI',to:'EGUL',tanker:'2× KC-46 GOLD 51/52 from Pittsburgh ARB',notes:'F-22A deployment Lakenheath. Completed 28 Mar.',tags:['F-22A','LAKENHEATH']},
  {id:'cor062',callsign:'CORONET EAST 062/032',status:'COMPLETE',acType:'A-10C',quantity:'6x+6x',unit:'190th FS / 107th FS — Boise ANGB',from:'KBOI',to:'EGUL',tanker:'BORA 43/44 tankers. TABOR 91-96 receivers.',notes:'A-10C deployment to Lakenheath. Completed 31 Mar. KPSM Cell 1 Leg 1 terminus.',tags:['A-10C','LAKENHEATH','ANG']},
  {id:'cor042',callsign:'CORONET WEST 042',status:'IN TRANSIT',acType:'F-15E',quantity:'4x',unit:'Strike Eagle det. — Seymour Johnson',from:'KGSB',to:'EGUL',tanker:'HOBO 22/23 tankers confirmed 37N/15E.',notes:'In transit. HOBO tanker 37N/15E confirmed 31 Mar.',tags:['F-15E','IN-TRANSIT']},
]

const FEED_ITEMS = [
  {t:'0904Z',h:'<b>Op EPIC FURY</b> <span style="color:#e85040">●</span> CENTCOM confirms 8000+ targets struck Iran. 120+ vessels sunk.'},
  {t:'0847Z',h:'<b>EGVA</b> B-52H BAZOO52/BAZOO51 updated arrivals. Buccaneers + Barksdale.'},
  {t:'0821Z',h:'<b>KPOB</b> ▲ RCH868 <b>AMZ A182 7C 090</b> KBGR→ETAR→OKAS. Army-Z series.'},
  {t:'0754Z',h:'<b>CORONET EAST 055</b> <span style="color:#f0a040">→</span> HOBO tanker 37N/15E confirmed.'},
  {t:'0712Z',h:'<b>LMSR Pililaau</b> <span style="color:#e85040">●</span> Outside Diego Garcia lagoon — departure IMMINENT.'},
  {t:'0633Z',h:'<b>CORONET EAST 062</b> <span style="color:#39e0a0">✓</span> BORA 43/44 + TABOR 91-96 A-10s EGUL 31 Mar.'},
  {t:'0541Z',h:'<b>CVN-77</b> USS George HW Bush DEPLOYED as of 31 Mar — Atlantic transit.'},
  {t:'0502Z',h:'<b>OJKA</b> Onward movement: OJKA→OJMS (Muwaffaq Salti AB) multiple missions.'},
]

// ── Map view controller ──────────────────────────────────
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target.center, target.zoom, { duration: 1.2 })
  }, [target])
  return null
}

// ── Flight route lines ───────────────────────────────────
const ICAO_COORDS = {
  KSVN:[32.015,-81.145],KPOB:[35.171,-79.014],KHOP:[36.669,-87.496],KGRF:[47.079,-122.580],
  KTCM:[47.138,-122.476],KNTU:[36.937,-76.036],KHRT:[30.428,-86.690],KMCF:[27.849,-82.521],
  KNKX:[32.868,-117.143],KDOV:[39.130,-75.466],KSUU:[38.263,-121.927],
  LLOV:[29.940,34.935],OJKA:[32.356,36.259],OJMS:[31.827,36.789],
  OKAS:[29.346,47.519],OMDM:[25.027,55.366],OTBH:[25.117,51.314],
  OMAM:[24.249,54.548],ETAR:[49.437,7.600],LGEL:[38.065,23.556],
  LIPA:[46.031,12.596],LTAG:[37.002,35.426],FJDG:[-7.313,72.411],
  EGVA:[51.682,-1.790],EGUL:[52.409,0.560],
}

export function MapView({ auth }) {
  const { flights, byBase, byDest, loading } = useFlights({ limit: 500 })
  const [layers, setLayers] = useState({
    carriers:true, destroyers:true, subs:true, lmsr:true,
    airbases:true, conus:true, strikes:true, bombers:true
  })
  const [country, setCountry] = useState('ALL')
  const [selAsset, setSelAsset] = useState(null)
  const [selCor, setSelCor] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [abmAsset, setAbmAsset] = useState(null)
  const [liveFeeds, setLiveFeeds] = useState([])

  // Load live sigact feed
  useEffect(() => {
    supabase.from('sigact_feed').select('*').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setLiveFeeds(data || []))
    const ch = supabase.channel('feed_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sigact_feed' },
        p => setLiveFeeds(prev => [p.new, ...prev].slice(0, 10)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const allAssets = [...STATIC_ASSETS, ...LMSR_DATA.map(s => ({ ...s, type: 'lmsr' }))]
  const filteredAssets = allAssets.filter(a => country === 'ALL' || a.country === country || a.type === 'lmsr')

  function selectAsset(a) {
    setSelAsset(a)
    setSelCor(null)
    if (a.lat && a.lng) setFlyTarget({ center: [a.lat, a.lng], zoom: 6 })
  }

  function selectCoronet(c) {
    setSelCor(selCor?.id === c.id ? null : c)
    setSelAsset(null)
  }

  // Status bar counts
  const naval = filteredAssets.filter(a => ['carrier','destroyer','submarine'].includes(a.type)).length
  const bases = filteredAssets.filter(a => a.type === 'airbase').length
  const lmsrCount = LMSR_DATA.length
  const amcCount = flights.length

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 310px', overflow: 'hidden' }}>

      {/* ── LEFT PANEL ─────────────────────── */}
      <div style={{ background: C.bg2, borderRight: `1px solid ${C.br}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* CORONETs */}
        <div style={{ borderBottom: `1px solid ${C.br}` }}>
          <PanelHeader title="Active CORONETs" badge={STATIC_CORONETS.length} badgeColor={C.a} badgeBg="rgba(240,160,64,.12)" />
          <div style={{ maxHeight: 210, overflowY: 'auto' }}>
            {STATIC_CORONETS.map(c => (
              <CoronetItem key={c.id} cor={c} selected={selCor?.id === c.id} onClick={() => selectCoronet(c)} />
            ))}
          </div>
        </div>

        {/* Layers */}
        <div style={{ borderBottom: `1px solid ${C.br}` }}>
          <PanelHeader title="Layers" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 8 }}>
            {[
              ['carriers','🚢','Carriers'],['destroyers','⚓','Destroyers'],
              ['subs','🔵','Submarines'],['lmsr','🚛','Sealift'],
              ['airbases','✈','AOR Bases'],['conus','◄','CONUS Dep'],
              ['strikes','⚡','Events'],['bombers','💣','Bombers'],
            ].map(([k, ico, lbl]) => (
              <LayerToggle key={k} icon={ico} label={lbl} on={layers[k]}
                onClick={() => setLayers(l => ({ ...l, [k]: !l[k] }))} />
            ))}
          </div>
        </div>

        {/* Country filter */}
        <div style={{ borderBottom: `1px solid ${C.br}` }}>
          <PanelHeader title="Country" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 10px' }}>
            {[['ALL','ALL'],['US','🇺🇸 US'],['UK','🇬🇧 UK'],['FR','🇫🇷 FR']].map(([k,lbl]) => (
              <button key={k} onClick={() => setCountry(k)}
                style={{ ...R, fontSize: 11, fontWeight: 600, letterSpacing: 1, padding: '3px 8px',
                  border: `1px solid ${country===k ? C.b : C.br}`, borderRadius: 1, cursor: 'pointer',
                  background: country===k ? 'rgba(80,160,232,.08)' : 'transparent',
                  color: country===k ? C.b : C.t2 }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Asset list */}
        <PanelHeader title="Assets" badge={filteredAssets.length} badgeColor={C.b} badgeBg="rgba(80,160,232,.12)" />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredAssets.map(a => (
            <AssetListItem key={a.id} asset={a} selected={selAsset?.id === a.id} onClick={() => selectAsset(a)} />
          ))}
        </div>
      </div>

      {/* ── MAP ────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <MapContainer center={[25,22]} zoom={3}
          style={{ width:'100%', height:'100%', background: C.bg }}
          zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={18} />
          <FlyTo target={flyTarget} />

          {/* CORONET route line */}
          {selCor && (() => {
            const from = ICAO_COORDS[selCor.from]
            const to   = ICAO_COORDS[selCor.to]
            if (!from || !to) return null
            return <Polyline positions={[from, to]} pathOptions={{ color: C.a, weight: 2, dashArray: '6 4', opacity: .7 }} />
          })()}

          {/* Flight route lines */}
          {flights.map(f => {
            const o = ICAO_COORDS[f.base], d = ICAO_COORDS[f.destination]
            if (!o || !d) return null
            const col = f.mc_flag === 'socom' ? C.p : C.b
            return <Polyline key={f.id + '_l'} positions={[o,d]} pathOptions={{ color: col, weight: 1, opacity: .22, dashArray: '4 4' }} />
          })}

          {/* Airbase markers */}
          {layers.airbases && STATIC_ASSETS.filter(a => a.type === 'airbase' && (country==='ALL'||a.country===country)).map(a => {
            const col = a.status==='SURGE' ? C.r : a.status==='ELEVATED' ? C.a : C.g
            return (
              <Marker key={a.id} position={[a.lat, a.lng]}
                icon={mkIcon('✈', col, 26, a.status==='SURGE', a.arrCnt ? '▲'+a.arrCnt : null)}
                eventHandlers={{ click: () => selectAsset(a) }}>
                <Popup closeButton={false}>
                  <div style={{ ...Z, fontSize: 11, minWidth: 180 }}>
                    <div style={{ ...R, fontSize: 14, fontWeight: 700, color: C.tb, marginBottom: 4 }}>{a.name}</div>
                    <div style={{ color: col }}>▲{a.arrCnt || 0} ARRIVALS</div>
                    {a.socomCnt > 0 && <div style={{ color: C.p }}>Y-series: {a.socomCnt}</div>}
                    <button onClick={() => { selectAsset(a); setAbmAsset(a) }}
                      style={{ display:'block', width:'100%', marginTop:8, padding:'5px', ...R, fontSize:11, fontWeight:600, letterSpacing:2, border:`1px solid ${C.a}`, background:'rgba(240,160,64,.08)', color:C.a, cursor:'pointer' }}>
                      ▼ EXPAND DETAIL
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* CONUS departure markers */}
          {layers.conus && Object.entries(byBase).map(([icao, data]) => {
            const coords = ICAO_COORDS[icao]
            if (!coords) return null
            return (
              <Marker key={icao + '_conus'} position={coords}
                icon={mkIcon('◄', data.socom > 0 ? C.p : C.b, 22, false, data.total > 5 ? String(data.total) : null)}
                eventHandlers={{ click: () => setSelAsset({ id: icao, name: icao, type: 'conus', lat: coords[0], lng: coords[1], ...data }) }}>
                <Popup closeButton={false}>
                  <div style={{ ...Z, fontSize: 11 }}>
                    <div style={{ ...R, fontSize: 13, fontWeight: 700, color: C.tb }}>{icao}</div>
                    <div style={{ color: C.t2, marginTop: 4 }}>{data.total} flights · {data.socom} SOF</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Carrier markers */}
          {layers.carriers && STATIC_ASSETS.filter(a => a.type==='carrier' && (country==='ALL'||a.country===country)).map(a => (
            <Marker key={a.id} position={[a.lat, a.lng]}
              icon={mkIcon('🚢', a.status==='REFIT' ? C.t3 : C.b, 28, a.status==='DEPLOYED')}
              eventHandlers={{ click: () => selectAsset(a) }} />
          ))}

          {/* Destroyer markers */}
          {layers.destroyers && STATIC_ASSETS.filter(a => a.type==='destroyer' && (country==='ALL'||a.country===country)).map(a => (
            <Marker key={a.id} position={[a.lat, a.lng]}
              icon={mkIcon('⚓', C.b, 22)}
              eventHandlers={{ click: () => selectAsset(a) }} />
          ))}

          {/* Submarine markers */}
          {layers.subs && STATIC_ASSETS.filter(a => a.type==='submarine' && (country==='ALL'||a.country===country)).map(a => (
            <Marker key={a.id} position={[a.lat, a.lng]}
              icon={mkIcon('🔵', C.p, 22)}
              eventHandlers={{ click: () => selectAsset(a) }} />
          ))}

          {/* LMSR markers */}
          {layers.lmsr && LMSR_DATA.map(s => {
            const col = s.cat==='forward' ? C.y : s.cat==='conus_e' ? C.b : C.t2
            return (
              <Marker key={s.id} position={[s.lat, s.lng]}
                icon={mkIcon('🚛', col, 22, s.cat==='forward')}
                eventHandlers={{ click: () => selectAsset({ ...s, type: 'lmsr' }) }}>
                <Popup closeButton={false}>
                  <div style={{ ...Z, fontSize: 11 }}>
                    <div style={{ ...R, fontSize: 13, fontWeight: 700, color: C.tb }}>{s.name}</div>
                    <div style={{ color: s.centcom==='CRITICAL'?C.r:s.centcom==='HIGH'?C.a:C.t2 }}>{s.centcom}</div>
                    <div style={{ color: C.t2, marginTop: 3 }}>{s.loc}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Bomber markers */}
          {layers.bombers && STATIC_ASSETS.filter(a => a.type==='bomber' && (country==='ALL'||a.country===country)).map(a => (
            <Marker key={a.id} position={[a.lat, a.lng]}
              icon={mkIcon('💣', C.r, 24, true)}
              eventHandlers={{ click: () => selectAsset(a) }} />
          ))}

          {/* Strike / event markers */}
          {layers.strikes && STATIC_ASSETS.filter(a => a.type==='strike' && (country==='ALL'||a.country===country)).map(a => (
            <Marker key={a.id} position={[a.lat, a.lng]}
              icon={mkIcon('⚡', C.r, 24, true)}
              eventHandlers={{ click: () => selectAsset(a) }} />
          ))}
        </MapContainer>

        {/* View presets */}
        <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', zIndex:900, display:'flex', gap:3, background:'rgba(7,9,11,.92)', border:`1px solid ${C.br2}`, padding:5, backdropFilter:'blur(8px)' }}>
          {Object.keys(VIEWS).map(k => (
            <button key={k} onClick={() => setFlyTarget(VIEWS[k])}
              style={{ ...R, fontSize:11, fontWeight:600, letterSpacing:2, padding:'5px 12px', border:`1px solid ${C.br}`, background:'transparent', color:C.t2, cursor:'pointer', textTransform:'uppercase', transition:'.15s' }}>
              {k}
            </button>
          ))}
        </div>

        {/* AMC stats bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:800, background:'rgba(7,9,11,.85)', borderBottom:`1px solid ${C.br}`, display:'flex', backdropFilter:'blur(6px)' }}>
          {[
            { label:'AMC', value: loading ? '…' : flights.length, color: C.b },
            { label:'SOF', value: loading ? '…' : flights.filter(f=>f.mc_flag==='socom').length, color: C.p },
            { label:'ACTIVE', value: loading ? '…' : flights.filter(f=>f.status==='ACTIVE').length, color: C.g },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding:'5px 14px', borderRight:`1px solid ${C.br}` }}>
              <div style={{ ...Z, fontSize:8, letterSpacing:2, color:C.t3, marginBottom:1 }}>{label}</div>
              <div style={{ ...R, fontSize:16, fontWeight:700, color, lineHeight:1 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────── */}
      <div style={{ background: C.bg2, borderLeft: `1px solid ${C.br}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <PanelHeader title="Asset Detail" badge={selAsset ? selAsset.name.slice(0,16) : null} badgeColor={C.t2} badgeBg="transparent" />

        {/* Detail content */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {selAsset ? <AssetDetail asset={selAsset} onExpand={() => setAbmAsset(selAsset)} />
          : selCor   ? <CoronetDetail cor={selCor} />
          : <EmptyDetail />}
        </div>

        {/* SIGACT / Feed */}
        <div style={{ height:160, borderTop:`1px solid ${C.br}`, background:C.bg, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'5px 12px', background:C.bg4, borderBottom:`1px solid ${C.br}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <span style={{ ...R, fontSize:10, fontWeight:600, letterSpacing:3, color:C.t2 }}>SIGACT FEED</span>
            <span style={{ ...Z, fontSize:9, color:C.g }}>● LIVE</span>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {liveFeeds.length > 0
              ? liveFeeds.map(f => (
                <div key={f.id} style={{ display:'flex', gap:8, padding:'5px 12px', borderBottom:`1px solid rgba(30,44,58,.4)`, fontSize:11 }}>
                  <span style={{ ...Z, fontSize:9, color:C.t3, width:40, flexShrink:0, paddingTop:1 }}>LIVE</span>
                  <span style={{ color:C.t2, flex:1, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: f.content_html }} />
                </div>
              ))
              : FEED_ITEMS.map((f,i) => (
                <div key={i} style={{ display:'flex', gap:8, padding:'5px 12px', borderBottom:`1px solid rgba(30,44,58,.4)`, fontSize:11 }}>
                  <span style={{ ...Z, fontSize:9, color:C.t3, width:40, flexShrink:0, paddingTop:1 }}>{f.t}</span>
                  <span style={{ color:C.t2, flex:1, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: f.h }} />
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ gridColumn:'1/4', height:24, background:C.bg4, borderTop:`1px solid ${C.br}`, display:'flex', alignItems:'center', padding:'0 14px', gap:16 }}>
        {[
          {label:'NAVAL', value:naval, color:C.b},
          {label:'BASES', value:bases, color:C.g},
          {label:'LMSR', value:lmsrCount, color:C.y},
          {label:'AMC', value:loading?'…':flights.length, color:C.b},
        ].map(({label,value,color}) => (
          <span key={label} style={{ ...Z, fontSize:10, color:C.t2 }}>
            {label} <b style={{ color, fontWeight:400 }}>{value}</b>
          </span>
        ))}
        {auth.isAdmin && (
          <span style={{ ...Z, fontSize:9, color:C.r, marginLeft:'auto', letterSpacing:1 }}>
            ● ADMIN MODE
          </span>
        )}
      </div>

      {/* Airbase slide-up modal */}
      {abmAsset && (
        <AirbaseModal asset={abmAsset} flights={flights} onClose={() => setAbmAsset(null)} />
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────

function PanelHeader({ title, badge, badgeColor, badgeBg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', background:C.bg4, borderBottom:`1px solid ${C.br}`, flexShrink:0 }}>
      <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:10, fontWeight:600, letterSpacing:3, color:C.t2 }}>{title}</span>
      {badge != null && (
        <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, padding:'1px 6px', borderRadius:1, color:badgeColor, background:badgeBg }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function LayerToggle({ icon, label, on, onClick }) {
  return (
    <div onClick={onClick}
      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px',
        border:`1px solid ${on ? 'rgba(57,224,160,.2)' : C.br}`, cursor:'pointer',
        background: on ? 'rgba(57,224,160,.04)' : 'transparent', borderRadius:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontFamily:"'Rajdhani', sans-serif", fontSize:11, fontWeight:500, color:C.t1 }}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{ width:26, height:13, background: on ? C.g : C.br, borderRadius:6, position:'relative', transition:'.2s', flexShrink:0 }}>
        <div style={{ position:'absolute', width:9, height:9, background:C.bg, borderRadius:'50%', top:2, left: on ? 15 : 2, transition:'.2s' }} />
      </div>
    </div>
  )
}

function CoronetItem({ cor, selected, onClick }) {
  const stCol = cor.status==='ACTIVE'?C.g:cor.status==='IN TRANSIT'?C.a:cor.status==='COMPLETE'?C.t3:C.b
  const stBg  = cor.status==='ACTIVE'?'rgba(57,224,160,.1)':cor.status==='IN TRANSIT'?'rgba(240,160,64,.12)':'rgba(22,30,40,.6)'
  return (
    <div onClick={onClick}
      style={{ padding:'8px 10px', border:`1px solid ${selected ? 'rgba(240,160,64,.5)' : C.br}`, borderRadius:1, margin:'4px 6px', cursor:'pointer',
        background: selected ? 'rgba(240,160,64,.06)' : C.bg3 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:12, fontWeight:700, color:C.tb }}>{cor.callsign}</span>
        <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'1px 5px', borderRadius:1, color:stCol, background:stBg }}>{cor.status}</span>
      </div>
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:C.t2, marginBottom:2 }}>{cor.from} → {cor.to}</div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:1, background:'rgba(80,160,232,.15)', border:'1px solid rgba(80,160,232,.3)', color:C.b }}>{cor.acType}</span>
        <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:1, background:'rgba(57,224,160,.1)', border:'1px solid rgba(57,224,160,.25)', color:C.g }}>{cor.quantity}</span>
      </div>
    </div>
  )
}

function AssetListItem({ asset, selected, onClick }) {
  const imap = { carrier:'🚢', destroyer:'⚓', submarine:'🔵', airbase:'✈', bomber:'💣', strike:'⚡', lmsr:'🚛', conus:'◄', manual:'◉' }
  const fmap = { US:'🇺🇸 ', UK:'🇬🇧 ', FR:'🇫🇷 ' }
  let badge = null
  if (asset.arrCnt) {
    const n = asset.arrCnt
    const col = n>=20?C.r:n>=10?C.a:C.g
    const bg  = n>=20?'rgba(232,80,64,.12)':n>=10?'rgba(240,160,64,.12)':'rgba(57,224,160,.1)'
    badge = <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:1, background:bg, color:col, border:`1px solid ${col}40` }}>▲{n}</span>
  }
  if (asset.type === 'lmsr') {
    const cc = asset.centcom==='CRITICAL'?C.r:asset.centcom==='HIGH'?C.a:C.t3
    const bg = asset.centcom==='CRITICAL'?'rgba(232,80,64,.12)':asset.centcom==='HIGH'?'rgba(240,160,64,.12)':'rgba(22,30,40,.5)'
    badge = <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'1px 4px', borderRadius:1, background:bg, color:cc }}>{asset.centcom||'—'}</span>
  }
  return (
    <div onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', cursor:'pointer',
        borderBottom:`1px solid rgba(30,44,58,.4)`,
        background: selected ? 'rgba(80,160,232,.06)' : 'transparent',
        borderLeft: selected ? `2px solid ${C.b}` : '2px solid transparent' }}>
      <div style={{ fontSize:12, flexShrink:0 }}>{fmap[asset.country] || ''}{imap[asset.type] || '◉'}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:12, fontWeight:600, color:C.tb, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{asset.name}</div>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:C.t2 }}>{asset.sub || asset.hull || ''}</div>
      </div>
      {badge}
    </div>
  )
}

function AssetDetail({ asset, onExpand }) {
  const stCol = { DEPLOYED:C.g, ACTIVE:C.g, SURGE:C.r, ELEVATED:C.a, ONGOING:C.r, REFIT:C.t3, 'IN PORT':C.t2, NMC:C.r }[asset.status] || C.t2
  return (
    <div>
      <div style={{ padding:'11px 13px', borderBottom:`1px solid ${C.br}` }}>
        <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:600, letterSpacing:3, color:C.t2, marginBottom:4 }}>DESIGNATION</div>
        <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:17, fontWeight:700, color:C.tb, marginBottom:2 }}>{asset.name}</div>
        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:C.t2 }}>{asset.sub || asset.hull || ''}</div>
      </div>
      <div style={{ padding:'8px 13px', borderBottom:`1px solid ${C.br}` }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
          <StatBox value={asset.status} label="STATUS" color={stCol} />
          <StatBox value={asset.lat ? `${asset.lat?.toFixed(1)}N` : '—'} label={asset.lng ? `${asset.lng?.toFixed(1)}E` : '—'} color={C.b} />
        </div>
      </div>
      {asset.notes && <DetailBlock label="NOTES" value={asset.notes} />}
      {asset.aircraft && (
        <DetailBlock label="AIRCRAFT" value={Array.isArray(asset.aircraft) ? asset.aircraft.join(' · ') : asset.aircraft} />
      )}
      {asset.intel && <DetailBlock label="INTEL ASSESSMENT" value={asset.intel} highlight />}
      {asset.type==='lmsr' && asset.loc && <DetailBlock label="POSITION" value={`${asset.loc} · ${asset.lastRpt}`} />}
      {asset.type==='airbase' && (
        <div style={{ padding:'8px 13px', borderBottom:`1px solid ${C.br}` }}>
          <button onClick={onExpand}
            style={{ display:'block', width:'100%', padding:6, fontFamily:"'Rajdhani', sans-serif", fontSize:11, fontWeight:600, letterSpacing:2, border:`1px solid ${C.a}`, background:'rgba(240,160,64,.08)', color:C.a, cursor:'pointer' }}>
            ▼ EXPAND — FLIGHTS / IMAGERY / INTEL
          </button>
        </div>
      )}
      {asset.escorts?.length > 0 && (
        <div style={{ padding:'8px 13px', borderBottom:`1px solid ${C.br}` }}>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:600, letterSpacing:3, color:C.t2, marginBottom:8 }}>BATTLE GROUP</div>
          {asset.escorts.map((e,i) => (
            <div key={i} style={{ display:'flex', gap:10, marginBottom:5, fontSize:11 }}>
              <span style={{ fontFamily:"'Rajdhani', sans-serif", color:C.b, width:140, fontWeight:600 }}>{e.name}</span>
              <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:C.t2 }}>{e.sub}</span>
              <span style={{ fontFamily:"'Rajdhani', sans-serif", color:C.t2, marginLeft:'auto' }}>{e.role}</span>
            </div>
          ))}
        </div>
      )}
      {asset.tags?.length > 0 && (
        <div style={{ padding:'8px 13px', display:'flex', flexWrap:'wrap', gap:4 }}>
          {asset.tags.map(t => (
            <span key={t} style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 5px', borderRadius:1, background:'rgba(57,224,160,.08)', border:'1px solid rgba(57,224,160,.2)', color:C.g }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function CoronetDetail({ cor }) {
  const stCol = cor.status==='ACTIVE'?C.g:cor.status==='IN TRANSIT'?C.a:C.t3
  return (
    <div>
      <DetailBlock label="CALLSIGN" value={cor.callsign} large />
      <div style={{ padding:'8px 13px', borderBottom:`1px solid ${C.br}` }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
          <StatBox value={cor.status} label="STATUS" color={stCol} />
          <StatBox value={cor.acType} label="AIRCRAFT" color={C.b} />
        </div>
      </div>
      <DetailBlock label="ROUTE" value={`${cor.from} → ${cor.to}`} />
      <DetailBlock label="UNIT" value={cor.unit || '—'} />
      <DetailBlock label="TANKER SUPPORT" value={cor.tanker} />
      <DetailBlock label="NOTES" value={cor.notes} />
      {cor.tags?.length > 0 && (
        <div style={{ padding:'8px 13px', display:'flex', flexWrap:'wrap', gap:4 }}>
          {cor.tags.map(t => (
            <span key={t} style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, padding:'2px 5px', borderRadius:1, background:'rgba(240,160,64,.1)', border:'1px solid rgba(240,160,64,.25)', color:C.a }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyDetail() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, color:C.t3, fontFamily:"'Share Tech Mono', monospace", fontSize:11, letterSpacing:2, gap:10, textAlign:'center', padding:20 }}>
      <div style={{ fontSize:24, opacity:.2 }}>◎</div>
      <div>SELECT ASSET</div>
      <div style={{ fontSize:9, color:'#1a2a34' }}>OR CORONET MISSION</div>
    </div>
  )
}

function StatBox({ value, label, color }) {
  return (
    <div style={{ padding:8, background:C.bg, border:`1px solid ${C.br}`, borderRadius:1 }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:18, fontWeight:700, marginBottom:1, color }}>{value}</div>
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:C.t2, letterSpacing:1 }}>{label}</div>
    </div>
  )
}

function DetailBlock({ label, value, large, highlight }) {
  return (
    <div style={{ padding:'10px 13px', borderBottom:`1px solid ${C.br}` }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:600, letterSpacing:3, color:C.t2, marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize: large ? 14 : 10, color: highlight ? C.a : C.t1, lineHeight:1.7, letterSpacing:'.3px' }}>{value}</div>
    </div>
  )
}

function AirbaseModal({ asset, flights, onClose }) {
  const [tab, setTab] = useState('FLIGHTS')
  const baseFlights = flights.filter(f => f.destination === asset.id?.toUpperCase() || f.destination === (asset.sub?.split('//')[0]?.trim()))

  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:4000, background:C.bg2,
      borderTop:`2px solid ${C.a}`, display:'flex', flexDirection:'column', maxHeight:'55vh',
      animation:'slideUp .28s ease' }}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'stretch', background:C.bg4, borderBottom:`1px solid ${C.br}`, flexShrink:0 }}>
        <div style={{ padding:'9px 16px', flex:1 }}>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:19, fontWeight:700, color:C.tb, letterSpacing:1 }}>{asset.name}</div>
          <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:C.t2 }}>{asset.sub}</div>
        </div>
        {[
          {v:asset.arrCnt||0, l:'ARRIVALS', c:C.a},
          {v:asset.socomCnt||0, l:'SOF', c:C.p},
        ].map(({v,l,c}) => (
          <div key={l} style={{ padding:'9px 16px', borderLeft:`1px solid ${C.br}`, textAlign:'center' }}>
            <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:20, fontWeight:700, color:c, marginBottom:1 }}>{v}</div>
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:C.t2, letterSpacing:1 }}>{l}</div>
          </div>
        ))}
        <div onClick={onClose} style={{ width:48, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:C.t2, cursor:'pointer', borderLeft:`1px solid ${C.br}` }}>✕</div>
      </div>

      {/* Tab nav */}
      <div style={{ display:'flex', background:C.bg4, borderBottom:`1px solid ${C.br}`, flexShrink:0 }}>
        {['FLIGHTS','AIRCRAFT','INTEL'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:11, fontWeight:600, letterSpacing:2, padding:'8px 16px', cursor:'pointer', color:tab===t?C.a:C.t2, background:'none', border:'none', borderBottom:`2px solid ${tab===t?C.a:'transparent'}` }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
        {tab === 'FLIGHTS' && (
          baseFlights.length > 0 ? (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background:C.bg4 }}>
                  {['DATE','CALLSIGN','MISSION CODE','ORIGIN','FLAG'].map(h => (
                    <th key={h} style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:600, letterSpacing:2, color:C.t2, padding:'6px 9px', borderBottom:`1px solid ${C.br}`, textAlign:'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baseFlights.map(f => (
                  <tr key={f.id} style={{ borderBottom:`1px solid rgba(30,44,58,.4)` }}>
                    <td style={{ padding:'5px 9px', fontFamily:"'Share Tech Mono', monospace", color:C.t2 }}>{f.dep_date?.slice(5)||'—'}</td>
                    <td style={{ padding:'5px 9px', fontFamily:"'Rajdhani', sans-serif", fontWeight:700, color:C.tb }}>{f.callsign}</td>
                    <td style={{ padding:'5px 9px', fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:C.t1 }}>{f.mission_code}</td>
                    <td style={{ padding:'5px 9px', fontFamily:"'Share Tech Mono', monospace", color:C.b }}>{f.base}</td>
                    <td style={{ padding:'5px 9px' }}>
                      <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:1, background:f.mc_flag==='socom'?'rgba(160,96,232,.15)':'rgba(80,160,232,.12)', color:f.mc_flag==='socom'?C.p:C.b }}>{(f.mc_flag||'amc').toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:C.t3 }}>
              {asset.intel || 'No flight records matched in current dataset.'}
            </div>
          )
        )}
        {tab === 'AIRCRAFT' && (
          <div>
            {(asset.aircraft || []).map((ac, i) => (
              <div key={i} style={{ padding:'6px 10px', marginBottom:4, background:C.bg, border:`1px solid ${C.br}`, fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:C.t1 }}>{ac}</div>
            ))}
          </div>
        )}
        {tab === 'INTEL' && (
          <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color:C.t1, lineHeight:1.8 }}>
            {asset.intel || 'No intel assessment on file.'}
          </div>
        )}
      </div>
    </div>
  )
}
