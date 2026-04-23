import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap, GeoJSON, useMapEvents } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useFlights } from '../hooks/useFlights'
import { useAssets } from '../hooks/useAssets'
import { supabase } from '../lib/supabase'
import { mkIcon, mkTrackBlock, mkAirbaseIcon, mkSiteIcon, mkPulseIcon, mkClusterIcon, PULSE_COLS } from '../lib/mapIcons'
import { InlineIcon } from '../lib/iconLibrary'
import { StrikePulseSidebar } from '../components/StrikePulseSidebar'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{background:'#07090b',color:'#e85040',padding:40,fontFamily:'monospace',height:'100%',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:14,fontWeight:700,letterSpacing:2}}>RENDER ERROR — MAP VIEW</div>
        <div style={{fontSize:11,color:'#b8ccd8'}}>{this.state.error.message}</div>
        <div style={{fontSize:10,color:'#4a6070',marginTop:8}}>Open browser console (F12) for full stack trace.</div>
        <button onClick={()=>this.setState({error:null})} style={{marginTop:16,padding:'8px 24px',background:'transparent',border:'1px solid #39e0a0',color:'#39e0a0',cursor:'pointer',fontFamily:'monospace',fontSize:12}}>RETRY</button>
      </div>
    )
    return this.props.children
  }
}

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8', p:'#a060e8',
  y:'#e8d040', t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28', br:'#1e2c3a', br2:'#273a4c',
}

// ── Aircraft normalizer ───────────────────────────────────────
// Single function all aircraft data passes through regardless of source.
// Accepts: static array entry, Supabase DB row, or future API feed item.
// Returns: consistent shape the UI components always consume.
// This is the API-resilience layer — add field mappings here as new sources are wired in.
function normalizeAircraft(raw) {
  if (!raw) return null

  // Count extraction — handles "8x", "18x+", "41+", "4", integers, null
  const qtyStr = String(raw.qty ?? raw.count ?? '')
  const countMatch = qtyStr.match(/(\d+)(\+|~)?/)
  const count     = countMatch ? parseInt(countMatch[1]) : null
  const qualifier = countMatch ? (countMatch[2] || '') : ''

  // Status — infer from qty/role strings if no explicit field
  const haystack = (qtyStr + ' ' + (raw.role || '') + ' ' + (raw.status || '')).toLowerCase()
  let status = raw.status || 'DEPLOYED'
  if (!raw.status) {
    if (haystack.includes('departed'))       status = 'DEPARTED'
    else if (haystack.includes('surge'))     status = 'SURGE'
    else if (haystack.includes('assessed') || (!count && !raw.unit)) status = 'ASSESSED'
  }

  // Clean role — strip operation/context notes appended after ' — '
  const cleanRole = (raw.role || '').split('—')[0].split('/')[0].trim()

  // Classify as logistics transit vs stationed asset
  // Logistics = pure airlift types moving through, not operating from, a base
  const LOGISTICS_TYPES = ['C-17A','C-17','C-5M','C-5B','C-5','KC-135','KC-46A','KC-46']
  const isLogistics = LOGISTICS_TYPES.some(t => (raw.type||'').startsWith(t)) &&
    (haystack.includes('arrival') || haystack.includes('tracked') || haystack.includes('transit'))

  return {
    type:      raw.type || '—',
    unit:      raw.unit || '',
    count,
    qualifier,
    displayCount: count != null ? `${count}${qualifier}` : null,
    status,
    role:      cleanRole,
    tails:     raw.tails || [],
    confirmed: !haystack.includes('assessed'),
    isLogistics,
  }
}

// ── ESC_GEO — Option C: invisible, border glow on hover ──────
// ESC_GEO: used only for tooltip label colour, not map fill
// Hover uses white glow only — avoids colour distortion on dark tiles
const ESC_GEO = {
  CRITICAL:{ color:'#e85040' },
  SURGE:   { color:'#e85040' },
  HIGH:    { color:'#f0a040' },
  ELEVATED:{ color:'#e8d040' },
  ACTIVE:  { color:'#50a0e8' },
  MODERATE:{ color:'#50a0e8' },
  WATCH:   { color:'#4a6070' },
}

const VIEWS = {
  WORLD:{center:[28,22],zoom:3}, MED:{center:[37,22],zoom:5},
  GULF:{center:[26,52],zoom:5}, ATLANTIC:{center:[44,-30],zoom:4}, INDOPACOM:{center:[20,120],zoom:4},
}

const ICAO_COORDS = {
  KSVN:[32.015,-81.145],KPOB:[35.171,-79.014],KHOP:[36.669,-87.496],
  KGRF:[47.079,-122.580],KTCM:[47.138,-122.476],KNTU:[36.937,-76.036],
  KHRT:[30.428,-86.690],KMCF:[27.849,-82.521],KNKX:[32.868,-117.143],
  KDOV:[39.130,-75.466],KSUU:[38.263,-121.927],KWRI:[40.017,-74.593],
  KMDT:[40.193,-76.763],KGSB:[35.339,-77.961],KCHS:[32.899,-80.041],
  KBOI:[43.564,-116.222],KGRK:[31.067,-97.829],KSSC:[33.972,-80.471],
  KWRB:[32.640,-83.591],KSKA:[47.615,-117.656],KCVS:[34.668,-99.267],
  FJDG:[-7.313,72.411],KMTC:[42.611,-83.150],KLSF:[32.337,-84.991],
  LLOV:[29.940,34.935],LLNV:[31.208,35.012],LLBG:[31.994,34.888],
  OJKA:[32.356,36.259],OJMS:[31.827,36.789],OKAS:[29.346,47.519],
  OMDM:[25.027,55.366],OMAM:[24.249,54.548],OTBH:[25.117,51.314],
  OEPS:[24.062,47.580],ETAR:[49.437,7.600],ETAD:[49.972,6.693],
  LGEL:[38.065,23.556],LGSA:[35.531,24.147],EGVA:[51.682,-1.790],
  EGUL:[52.409,0.560],EGUN:[52.362,0.486],
  KBHM:[33.563,-86.756],KNXX:[40.199,-75.148],KCOS:[38.806,-104.701],
  KDOV:[39.130,-75.466],KSUU:[38.263,-121.927],
}

// ── STATIC_ASSETS ─────────────────────────────────────────────
// aircraftTypes contains STATIONED aircraft only.
// Logistics transits (C-17/C-5 arrivals) are NOT listed here —
// they appear in the flight log (arrCnt / amc_flights table).
// Each entry has: type, unit, qty (count+qualifier), role, tails[]
const STATIC_ASSETS = [
  // ── CARRIERS ────────────────────────────────────────────────
  {id:'cvn78',name:'USS Gerald R. Ford',sub:'CVN-78 // Ford-class',country:'US',type:'carrier',status:'DEPLOYED',lat:43.5,lng:16.5,csg:'CSG-12',
   squadrons:['VFA-37 (F/A-18E)','VFA-213 (F/A-18F)','VFA-31 (F/A-18E)','VFA-87 (F/A-18E)','VAQ-142 (EA-18G)','VAW-124 (E-2D)','HSC-9 (MH-60S)','HSM-70 (MH-60R)','VRC-40 (C-2A)'],
   escorts:[{name:'USS Mitscher',sub:'DDG-57',role:'Destroyer'},{name:'USS Mahan',sub:'DDG-72',role:'Destroyer'},{name:'USS Winston S. Churchill',sub:'DDG-81',role:'Destroyer'},{name:'USS Bainbridge',sub:'DDG-96',role:'Destroyer'},{name:'USNS Supply',sub:'T-AOE-6',role:'Combat Logistics'}],
   notes:'Adriatic/Split Croatia area 28 Mar. EUCOM/CENTCOM direction.',tags:['ADRIATIC','CENTCOM-BOUND']},
  {id:'cvn72',name:'USS Abraham Lincoln',sub:'CVN-72 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:16.0,lng:54.0,csg:'CSG-3',
   squadrons:['VFA-41 (F/A-18F)','VFA-14 (F/A-18E)','VMFA-314 (F/A-18E)','VFA-151 (F/A-18E)','VAQ-133 (EA-18G)','VAW-117 (E-2D)','HSC-14 (MH-60S)','HSM-71 (MH-60R)','VRM-30 Det.2 (CMV-22B)'],
   escorts:[{name:'USS Pinckney',sub:'DDG-91',role:'Destroyer'},{name:'USS Spruance',sub:'DDG-111',role:'Destroyer'},{name:'USS Michael Murphy',sub:'DDG-112',role:'Destroyer'},{name:'USS Frank E. Petersen Jr.',sub:'DDG-121',role:'Destroyer'}],
   notes:'5th Fleet / Arabian Sea. Houthi suppression. Tomahawk employment confirmed.',tags:['5TH-FLEET','ARABIAN-SEA']},
  {id:'cvn77',name:'USS George H.W. Bush',sub:'CVN-77 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:36.0,lng:-12.0,csg:'CSG-10',
   squadrons:['VFA-103 (F/A-18F)','VFA-83 (F/A-18E)','VFA-131 (F/A-18E)','VFA-105 (F/A-18E)','VAQ-140 (EA-18G)','VAW-121 (E-2D)','HSC-5 (MH-60S)','HSM-79 (MH-60R)','VRM-40 (CMV-22B)'],
   escorts:[{name:'USS Ross',sub:'DDG-71',role:'Destroyer'},{name:'USS Donald Cook',sub:'DDG-75',role:'Destroyer'},{name:'USS Mason',sub:'DDG-87',role:'Destroyer'},{name:'USNS Arctic',sub:'T-AOE-8',role:'Combat Logistics'}],
   notes:'DEPLOYED 31 Mar. Atlantic transit, EUCOM/CENTCOM direction.',tags:['ATLANTIC','EUCOM-BOUND']},
  {id:'r08',name:'HMS Queen Elizabeth',sub:'R08 // QE-class',country:'UK',type:'carrier',status:'REFIT',lat:56.0,lng:-3.4,csg:'CSG21',notes:'Refit Rosyth 482 days.',tags:['REFIT','ROSYTH']},
  {id:'r91',name:'Charles de Gaulle',sub:'R91 // CdG-class',country:'FR',type:'carrier',status:'DEPLOYED',lat:34.0,lng:28.0,csg:'TF-473',notes:'Eastern Med. TF-473. Active strike role.',tags:['EASTMED','TF-473']},

  // ── DESTROYERS / SUBMARINES ──────────────────────────────────
  {id:'ddg51',name:'USS Arleigh Burke',sub:'DDG-51 // Burke Flt I',country:'US',type:'destroyer',status:'DEPLOYED',lat:33.0,lng:32.0,tags:['EASTMED']},
  {id:'ddg125',name:'USS Jack H. Lucas',sub:'DDG-125 // Burke Flt III',country:'US',type:'destroyer',status:'DEPLOYED',lat:22.0,lng:58.0,tags:['5TH-FLEET']},
  {id:'d34',name:'HMS Diamond',sub:'D34 // Type 45',country:'UK',type:'destroyer',status:'DEPLOYED',lat:35.0,lng:33.0,tags:['MED']},
  {id:'ssn795',name:'USS H.G. Rickover',sub:'SSN-795 // Virginia Blk V',country:'US',type:'submarine',status:'DEPLOYED',lat:33.5,lng:26.0,tags:['ASSESSED','VPM']},
  {id:'anson',name:'HMS Anson',sub:'S123 // Astute-class',country:'UK',type:'submarine',status:'DEPLOYED',lat:-30.0,lng:78.0,tags:['AUKUS']},

  // ── AOR AIRBASES — stationed aircraft only ───────────────────
  // Note: C-17/C-5 arrival counts are in arrCnt + flight logs, not here.
  {id:'otbh',name:'Al Udeid AB',sub:'OTBH // Qatar',country:'US',type:'airbase',status:'SURGE',lat:25.117,lng:51.314,arrCnt:14,socomCnt:4,
   aircraftTypes:[
     {type:'B-52H Stratofortress', unit:'5 BW / 2 BW',        qty:'2',  role:'Strategic Bomber', tails:['60-0040','60-0047'], status:'SURGE'},
     {type:'F-35A Lightning II',   unit:'388th FW / Hill AFB', qty:'12', role:'Strike'},
     {type:'F-15E Strike Eagle',   unit:'494th FS / 48th FW',  qty:'8',  role:'Strike'},
     {type:'KC-46A Pegasus',       unit:'97th AMW / Altus',    qty:'4',  role:'Tanker'},
     {type:'E-3 AWACS',            unit:'552nd ACW / Tinker',  qty:'2',  role:'AEW&C'},
     {type:'RQ-4 Global Hawk',     unit:'9th RW / Beale',      qty:'1',  role:'ISR'},
   ],
   intel:'14 AMC arrivals/48h vs baseline ~6. Y-series SOCOM missions 4 of 14. Surge sustained.',tags:['SURGE','CENTCOM','OP-EPIC-FURY']},

  {id:'egva',name:'RAF Fairford',sub:'EGVA // UK — USAF BOMBER HUB',country:'US',type:'airbase',status:'SURGE',lat:51.682,lng:-1.790,arrCnt:0,socomCnt:0,
   aircraftTypes:[
     {type:'B-52H Stratofortress', unit:'5 BW / 2 BW',   qty:'8',  role:'Strategic Bomber',
      tails:['61-0001','61-0035','60-0012','60-0007','60-0060','60-0023']},
     {type:'B-1B Lancer',         unit:'7 BW / 28 BW',  qty:'18+', role:'Strategic Bomber',
      tails:['86-0129','86-0102','85-0072','86-0138','86-0107','85-0088','85-0064','86-0140','86-0139','86-0108','86-0121','85-0060','86-0134','85-0069']},
   ],
   intel:'CONFIRMED: 8x B-52H + 18+ B-1B as of 28 Mar 2026. Largest US forward bomber deployment since Gulf War.',tags:['SURGE','B-52H','B-1B','OP-EPIC-FURY']},

  {id:'egun',name:'RAF Mildenhall',sub:'EGUN // UK — SOCOM/AFSOC HUB',country:'US',type:'airbase',status:'SURGE',lat:52.362,lng:0.486,arrCnt:41,socomCnt:41,
   aircraftTypes:[
     {type:'MC-130J Commando II',  unit:'352nd SOG / 1st SOW', qty:'41+', role:'SOCOM Assault/Infiltration',
      tails:['14-5805']},
     {type:'AC-130J Ghostrider',   unit:'1st SOW / AFSOC',     qty:'3',   role:'Gunship',
      tails:['HEEL 51','HEEL 53','HEEL 55']},
     {type:'EA-37B Compass Call',  unit:'55th Wing / ACC',     qty:'2',   role:'EW', status:'DEPARTED',
      tails:['AE17CD 19-1587','AE142E 17-5579']},
   ],
   intel:'41+ MC-130J staged since 3 Mar. 11x Silent Knight mod confirmed.',tags:['SURGE','MC-130J','AFSOC','OP-EPIC-FURY']},

  {id:'egul',name:'RAF Lakenheath',sub:'EGUL // UK — USAFE HUB',country:'US',type:'airbase',status:'ELEVATED',lat:52.409,lng:0.560,arrCnt:0,socomCnt:0,
   aircraftTypes:[
     {type:'F-22A Raptor',         unit:'1st FW / Langley AFB',    qty:'6',  role:'Fighter',
      tails:['CORONET EAST 051']},
     {type:'A-10C Thunderbolt II', unit:'190th/107th FS / Boise',  qty:'12', role:'Strike'},
     {type:'F-15E Strike Eagle',   unit:'48th FW / Lakenheath',    qty:'0',  role:'Strike'},
   ],
   intel:'F-22A CORONET EAST 051 complete 28 Mar. A-10C CORONET EAST 062/032 complete 31 Mar.',tags:['SURGE','CORONET','USAFE']},

  {id:'lgsa',name:'Souda Bay / Chania',sub:'LGSA // Crete, Greece',country:'US',type:'airbase',status:'ACTIVE',lat:35.531,lng:24.147,arrCnt:4,socomCnt:0,
   aircraftTypes:[
     {type:'EA-37B Compass Call', unit:'55th Wing / ACC', qty:'2', role:'EW',
      tails:['19-1587','17-5579']},
   ],
   intel:'EA-37B AXIS 41/43 arrived from Mildenhall 2 Apr. EW forward hub Eastern Med.',tags:['CRETE','NATO','EW']},

  // Bases with tracked arrivals only — no stationed aircraft
  {id:'llov',name:'Ovda AB',sub:'LLOV // Israel',country:'US',type:'airbase',status:'ELEVATED',lat:29.94,lng:34.935,arrCnt:26,socomCnt:12,
   intel:'26 confirmed arrivals. KPOB/KSVN/KNTU dominant origins. All SOCOM-flagged. Strategic reserve pre-positioning assessed.',tags:['SURGE','IDF','CENTCOM']},
  {id:'ojka',name:'King Abdullah II AB',sub:'OJKA // Jordan',country:'US',type:'airbase',status:'ELEVATED',lat:32.356,lng:36.259,arrCnt:30,socomCnt:12,
   intel:'Highest single-destination volume. Onward movement to OJMS confirmed.',tags:['JORDAN','HIGHEST-VOLUME']},
  {id:'ojms',name:'Muwaffaq Salti AB',sub:'OJMS // Jordan (Azraq)',country:'US',type:'airbase',status:'ELEVATED',lat:31.827,lng:36.789,arrCnt:19,socomCnt:0,
   intel:'Low-visibility base. FJDG→HDAM→OJMS routing confirmed. 19+ C-17 arrivals tracked.',tags:['JORDAN','FINAL-DEST','LOW-VISIBILITY']},
  {id:'okas',name:'Ali Al Salem AB',sub:'OKAS // Kuwait',country:'US',type:'airbase',status:'ELEVATED',lat:29.346,lng:47.519,arrCnt:10,socomCnt:2,
   intel:'Army-Z mission series (A177/A179/A182) dominant. ETAD→OKAS routing confirmed.',tags:['KUWAIT','ARMY-Z']},
  {id:'oeps',name:'Prince Sultan AB',sub:'OEPS // Saudi Arabia',country:'US',type:'airbase',status:'ELEVATED',lat:24.062,lng:47.580,arrCnt:16,socomCnt:0,
   intel:'Major build-up. C-17 + C-5M arrivals via FJDG direct. Heavy equipment assessed.',tags:['KSA','BUILD-UP']},
  {id:'llnv',name:'Nevatim AB',sub:'LLNV // Israel',country:'US',type:'airbase',status:'ELEVATED',lat:31.208,lng:35.012,arrCnt:4,socomCnt:0,
   intel:'Second Israeli staging base. 4x C-17 arrivals confirmed.',tags:['ISRAEL','EMERGING']},
  {id:'llbg',name:'Ben Gurion Airport',sub:'LLBG // Israel',country:'US',type:'airbase',status:'ACTIVE',lat:31.994,lng:34.888,arrCnt:6,socomCnt:0,
   intel:'Civil dual-use airport receiving USAF C-17 traffic.',tags:['ISRAEL','DUAL-USE']},
  {id:'lgel',name:'Elefsis AB',sub:'LGEL // Greece',country:'US',type:'airbase',status:'ELEVATED',lat:38.065,lng:23.556,arrCnt:5,socomCnt:3,
   intel:'Emerged late March. KPOB/KMDT dominant. SAAM-flagged missions.',tags:['GREECE','NATO','SAAM']},
  {id:'etar',name:'Ramstein AB',sub:'ETAR // Germany',country:'US',type:'airbase',status:'ACTIVE',lat:49.437,lng:7.600,arrCnt:5,socomCnt:0,
   intel:'Universal CONUS→CENTCOM gateway. Every tracked mission transits ETAR.',tags:['EUCOM','GATEWAY']},
  {id:'etad',name:'Spangdahlem AB',sub:'ETAD // Germany',country:'US',type:'airbase',status:'ACTIVE',lat:49.972,lng:6.693,arrCnt:0,socomCnt:0,
   intel:'Army-Z mission staging node. A-series via ETAD confirmed.',tags:['EUCOM','ARMY-Z']},
  {id:'fjdg',name:'Diego Garcia NSF',sub:'FJDG // BIOT',country:'US',type:'airbase',status:'ACTIVE',lat:-7.3132,lng:72.4108,arrCnt:0,socomCnt:0,
   intel:'Major pre-positioning hub. FJDG→OJMS/OEPS direct routing.',tags:['CENTCOM','PRE-POSITION']},

  // ── EVENTS ────────────────────────────────────────────────────
  {id:'ev001',name:'Op EPIC FURY — Iran',sub:'CENTCOM // ONGOING',country:'US',type:'strike',status:'ONGOING',lat:32.0,lng:53.0,notes:'8000+ targets struck.',tags:['OP-EPIC-FURY','IRAN']},
  {id:'ev002',name:'Houthi Suppression',sub:'OIR // ONGOING',country:'US',type:'strike',status:'ONGOING',lat:15.5,lng:43.5,notes:'CVN-72 sustained ops. Tomahawk confirmed.',tags:['OIR','HOUTHI']},
]

const LMSR_DATA = [
  {id:'pil',name:'USNS Pililaau',hull:'T-AK-304',sub:'T-AK-304 // Div.3',cat:'forward',centcom:'CRITICAL',lat:-7.2,lng:72.5,loc:'Diego Garcia — departure IMMINENT',lastRpt:'01 Apr 2026'},
  {id:'sol',name:'USNS 1st Lt. Jack Lummus',hull:'T-AK-3011',sub:'T-AK-3011 // Div.3',cat:'forward',centcom:'CRITICAL',lat:14.0,lng:50.5,loc:'Red Sea / Gulf of Aden (assessed)',lastRpt:'31 Mar 2026'},
  {id:'sgt',name:'USNS SGT. Matej Kocak',hull:'T-AK-3005',sub:'T-AK-3005 // Div.2',cat:'forward',centcom:'HIGH',lat:25.5,lng:56.5,loc:'Gulf of Oman / Hormuz',lastRpt:'30 Mar 2026'},
  {id:'ssp',name:'SS Sgt William Button',hull:'T-AK-3012',sub:'T-AK-3012',cat:'forward',centcom:'HIGH',lat:12.5,lng:44.0,loc:'Red Sea transit',lastRpt:'31 Mar 2026'},
  {id:'cpb',name:'USNS Cape Bover',hull:'T-AKR-9',sub:'T-AKR-9 // APS-3',cat:'conus_e',centcom:'MODERATE',lat:38.0,lng:-75.5,loc:'US East Coast',lastRpt:'28 Mar 2026'},
]

const STATIC_CORONETS = [
  {id:'cor051',callsign:'CORONET EAST 051',status:'COMPLETE',acType:'F-22A',quantity:'6x',unit:'1st FW / Langley AFB',from:'KLFI',to:'EGUL',tanker:'2x KC-46 GOLD 51/52 / Pittsburgh ARB',notes:'F-22A to Lakenheath. Complete 28 Mar.',tags:['F-22A','LAKENHEATH']},
  {id:'cor062',callsign:'CORONET EAST 062/032',status:'COMPLETE',acType:'A-10C',quantity:'6+6x',unit:'190th/107th FS / Boise ANGB',from:'KBOI',to:'EGUL',tanker:'BORA 43/44, TABOR 91-96',notes:'A-10C to Lakenheath. Complete 31 Mar.',tags:['A-10C','LAKENHEATH','ANG']},
  {id:'cor042',callsign:'CORONET WEST 042',status:'IN TRANSIT',acType:'F-15E',quantity:'4x',unit:'4th FW / Seymour Johnson',from:'KGSB',to:'EGUL',tanker:'HOBO 22/23',notes:'In transit. HOBO tanker confirmed.',tags:['F-15E','IN-TRANSIT']},
]

const CONUS_META = {
  KSVN:{name:'Hunter AAF',unit:'3rd SF Group / USASOC',region:'Savannah, GA'},
  KPOB:{name:'Pope Field',unit:'82nd Airborne / JSOC',region:'Fort Bragg, NC'},
  KHOP:{name:'Campbell AAF',unit:'101st Airborne / 160th SOAR',region:'Fort Campbell, KY'},
  KGRF:{name:'Gray AAF (JBLM)',unit:'I Corps / 2nd SFOD',region:'Tacoma, WA'},
  KTCM:{name:'McChord AFB',unit:'62nd Airlift Wing (AMC)',region:'JBLM, WA'},
  KNTU:{name:'NAS Oceana',unit:'SEAL Team / NAVSOC',region:'Virginia Beach, VA'},
  KHRT:{name:'Hurlburt Field',unit:'1st SOW / AFSOC HQ',region:'Fort Walton Beach, FL'},
  KMCF:{name:'MacDill AFB',unit:'USSOCOM HQ / CENTCOM HQ',region:'Tampa, FL'},
  KNKX:{name:'MCAS Miramar',unit:'USMC Aviation',region:'San Diego, CA'},
  KMDT:{name:'Middletown PANG',unit:'193rd SOW (ANG)',region:'Harrisburg, PA'},
  KWRI:{name:'McGuire AFB',unit:'305th AMW (AMC)',region:'NJ'},
  KGSB:{name:'Seymour Johnson AFB',unit:'4th FW — F-15E',region:'Goldsboro, NC'},
  KLSF:{name:'Lawson AAF',unit:'Fort Moore / 1st Cavalry',region:'Fort Moore, GA'},
  KCHS:{name:'Charleston AFB',unit:'437th AW — C-17',region:'Charleston, SC'},
  KBHM:{name:'Birmingham ANGB',unit:'117th ARW — KC-135',region:'Birmingham, AL'},
  KBOI:{name:'Gowen Field ANGB',unit:'124th FW — A-10C',region:'Boise, ID'},
  KCVS:{name:'Altus AFB',unit:'97th AMW (AETC) — KC-46',region:'Altus, OK'},
  KDOV:{name:'Dover AFB',unit:'436th AW — C-17/C-5',region:'Dover, DE'},
  KSUU:{name:'Travis AFB',unit:'60th AMW — C-17/C-5',region:'Fairfield, CA'},
  KSKA:{name:'Fairchild AFB',unit:'92nd ARW — KC-135/KC-46',region:'Spokane, WA'},
  KGRK:{name:'Gray AAF / Fort Cavazos',unit:'III Corps / 1st Cavalry Division',region:'Killeen, TX'},
  KSSC:{name:'Shaw AFB',unit:'20th FW — F-16C',region:'Sumter, SC'},
  KWRB:{name:'Robins AFB',unit:'78th ABW / WR-ALC',region:'Warner Robins, GA'},
}

const FEED_ITEMS = [
  {t:'0904Z',h:'<b>Op EPIC FURY</b> <span style="color:#e85040">●</span> CENTCOM: 8000+ targets struck Iran. 120+ vessels sunk.'},
  {t:'0847Z',h:'<b>EGUN</b> EA-37B AXIS 41/43 departed Mildenhall → <b>LGSA (Souda Bay)</b>. EW forward deployment.'},
  {t:'0821Z',h:'<b>OJMS</b> <span style="color:#e85040">▲</span> Muwaffaq Salti AB 19+ confirmed C-17 arrivals. FJDG→HDAM→OJMS routing confirmed.'},
  {t:'0754Z',h:'<b>EGUN</b> 41+ MC-130J staged. 11x Silent Knight mod confirmed.'},
  {t:'0712Z',h:'<b>LMSR Pililaau</b> <span style="color:#e85040">●</span> Diego Garcia — departure IMMINENT.'},
  {t:'0633Z',h:'<b>LLNV</b> (Nevatim AB) NEW destination. 4x C-17 arrivals.'},
]

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => { if(target) map.flyTo(target.center, target.zoom, {duration:1.2}) }, [target])
  return null
}

// ── Disables Leaflet's rubber-band zoom box (Shift+drag) ──────
function DisableBoxZoom() {
  const map = useMap()
  useEffect(() => { map.boxZoom.disable() }, [map])
  return null
}

// ── Auto-closes any open popup when user zooms or pans ────────
// Prevents stale popup cards floating over wrong map area
function PopupAutoClose() {
  const map = useMap()
  useMapEvents({ zoom: () => map.closePopup(), dragstart: () => map.closePopup() })
  return null
}

function MapClickHandler({ onClear, onReposition, repositioning }) {
  useMapEvents({
    click: (e) => {
      if(repositioning) onReposition({lat:e.latlng.lat,lng:e.latlng.lng})
      else onClear()
    }
  })
  return null
}

// ══════════════════════════════════════════════════════════════
// AIRBASE CLUSTER LAYER
// CLUSTER_MODE: 'fanout' → animated radial fan on click
//               'zoom'   → auto-zoom into cluster bounding box
// Change CLUSTER_MODE to 'zoom' to revert to Option A behaviour
// ══════════════════════════════════════════════════════════════
const CLUSTER_MODE = 'fanout'
const CLUSTER_ZOOM_THRESHOLD = 6   // below this zoom, bases cluster
const CLUSTER_PX_RADIUS = 36       // px radius — bases within this group together
const FANOUT_SPREAD_PX = 56        // px radius of the fan spread

function computeClusters(assets, map) {
  const pts = assets.map(a => ({
    ...a,
    px: map.latLngToContainerPoint([a.lat, a.lng])
  }))
  const assigned = new Set()
  const clusters = []
  pts.forEach((a, i) => {
    if (assigned.has(i)) return
    const group = [a]
    assigned.add(i)
    pts.forEach((b, j) => {
      if (assigned.has(j)) return
      const dx = a.px.x - b.px.x, dy = a.px.y - b.px.y
      if (Math.sqrt(dx*dx + dy*dy) < CLUSTER_PX_RADIUS) { group.push(b); assigned.add(j) }
    })
    const cLat = group.reduce((s,x)=>s+x.lat,0)/group.length
    const cLng = group.reduce((s,x)=>s+x.lng,0)/group.length
    clusters.push({ id: `cl_${i}`, assets: group, lat: cLat, lng: cLng })
  })
  return clusters
}

function getFanPositions(centerLat, centerLng, count, map) {
  const center = map.latLngToContainerPoint([centerLat, centerLng])
  // Spread upward in a 160° arc centred on top
  const arc = Math.min(count * 32, 160)
  const startAngle = -90 - arc / 2
  return Array.from({ length: count }, (_, i) => {
    const angle = (startAngle + (count > 1 ? (i / (count - 1)) * arc : 0)) * (Math.PI / 180)
    const px = center.x + Math.cos(angle) * FANOUT_SPREAD_PX
    const py = center.y + Math.sin(angle) * FANOUT_SPREAD_PX
    return map.containerPointToLatLng([px, py])
  })
}

function AirbaseClusterLayer({ assets, flights, country, selectAsset, setAbmAsset }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const [expandedId, setExpandedId] = useState(null)
  const [fanPositions, setFanPositions] = useState([])

  useMapEvents({
    zoom:     () => { setZoom(map.getZoom()); setExpandedId(null) },
    dragstart:() => setExpandedId(null),
    click:    () => setExpandedId(null),
  })

  const filtered = assets.filter(a =>
    a.type === 'airbase' && a.lat != null && a.lng != null &&
    (country === 'ALL' || a.country?.trim() === country)
  )

  // Below threshold: cluster
  if (zoom < CLUSTER_ZOOM_THRESHOLD) {
    const clusters = computeClusters(filtered, map)
    return (
      <>
        {clusters.map(cl => {
          const isExpanded = expandedId === cl.id
          const maxStatus = cl.assets.find(a => a.status === 'SURGE') ? 'SURGE'
            : cl.assets.find(a => a.status === 'ELEVATED') ? 'ELEVATED' : 'ACTIVE'

          if (cl.assets.length === 1) {
            // Single base — render normally
            return <SingleAirbaseMarker key={cl.id} a={cl.assets[0]} flights={flights} selectAsset={selectAsset} setAbmAsset={setAbmAsset} />
          }

          if (isExpanded && CLUSTER_MODE === 'fanout') {
            // Fan-out: spread markers at computed positions
            const positions = fanPositions.length === cl.assets.length ? fanPositions
              : getFanPositions(cl.lat, cl.lng, cl.assets.length, map)
            return (
              <React.Fragment key={cl.id}>
                {/* Ghost centre marker */}
                <Marker position={[cl.lat, cl.lng]}
                  icon={mkClusterIcon(cl.assets.length, maxStatus)}
                  eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setExpandedId(null) } }} />
                {/* Spread markers */}
                {cl.assets.map((a, i) => {
                  const pos = positions[i] || { lat: cl.lat, lng: cl.lng }
                  const col = { SURGE: '#e85040', ELEVATED: '#f0a040', ACTIVE: '#39e0a0', MODERATE: '#50a0e8' }[a.status] || '#4a6070'
                  const arrivals7d = flights.filter(f =>
                    f.destination?.toUpperCase() === (a.icao || a.id || '').toUpperCase() &&
                    f.dep_date && new Date(f.dep_date) >= new Date(Date.now() - 7 * 864e5)
                  ).length
                  return (
                    <Marker key={a.id} position={[pos.lat, pos.lng]}
                      icon={mkAirbaseIcon(a.status, arrivals7d || a.arrCnt || 0)}
                      eventHandlers={{ click: (e) => {
                        L.DomEvent.stopPropagation(e)
                        selectAsset(a)
                        setExpandedId(null)
                      }}}>
                      <Tooltip direction="top" offset={[0,-14]} opacity={1} className="ow-tip">
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:col}}>
                          {(a.icao||a.id||'').toUpperCase()}
                        </span>
                        <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,color:'#dceaf0',marginLeft:6}}>
                          {a.name}
                        </span>
                      </Tooltip>
                    </Marker>
                  )
                })}
              </React.Fragment>
            )
          }

          // Collapsed cluster — single multi-base marker
          return (
            <Marker key={cl.id} position={[cl.lat, cl.lng]}
              icon={mkClusterIcon(cl.assets.length, maxStatus)}
              eventHandlers={{ click: (e) => {
                L.DomEvent.stopPropagation(e)
                if (CLUSTER_MODE === 'zoom') {
                  // Option A: zoom to fit cluster bounds
                  const bounds = L.latLngBounds(cl.assets.map(a => [a.lat, a.lng]))
                  map.fitBounds(bounds, { padding: [40, 40] })
                } else {
                  // Option B: fan out
                  const pos = getFanPositions(cl.lat, cl.lng, cl.assets.length, map)
                  setFanPositions(pos)
                  setExpandedId(cl.id)
                }
              }}}>
              <Tooltip direction="top" offset={[0,-14]} opacity={1} className="ow-tip">
                <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,color:'#dceaf0'}}>
                  {cl.assets.length} airbases
                </span>
              </Tooltip>
            </Marker>
          )
        })}
      </>
    )
  }

  // Above threshold: render all individual markers normally
  return (
    <>
      {filtered.map(a => (
        <SingleAirbaseMarker key={a.id} a={a} flights={flights} selectAsset={selectAsset} setAbmAsset={setAbmAsset} />
      ))}
    </>
  )
}

// ── Single airbase marker (used both in cluster layer and standalone) ──
function SingleAirbaseMarker({ a, flights, selectAsset, setAbmAsset }) {
  const col = { SURGE: C.r, ELEVATED: C.a, ACTIVE: C.g, MODERATE: C.b }[a.status] || C.t2
  const statusLabel = { SURGE: 'SURGE', ELEVATED: 'ELEVATED', ACTIVE: 'NOMINAL', MODERATE: 'NOMINAL' }[a.status] || 'DORMANT'
  const icao = (a.icao || a.id || '').toUpperCase()
  const region = a.sub?.split('//')[1]?.split('—')[0]?.trim() || ''
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5)
  const arrivals7d = flights.filter(f =>
    f.destination?.toUpperCase() === icao &&
    f.dep_date && new Date(f.dep_date) >= sevenDaysAgo
  ).length
  const depCount = flights.filter(f => f.base?.toUpperCase() === icao).length

  return (
    <Marker position={[a.lat, a.lng]}
      icon={mkAirbaseIcon(a.status, arrivals7d || a.arrCnt || 0)}
      zIndexOffset={1000}
      eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); selectAsset(a) } }}>
      <Tooltip direction="top" offset={[0,-14]} opacity={1} className="ow-tip" permanent={false}>
        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,letterSpacing:1,color:col}}>{icao}</span>
        <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,color:'#dceaf0',marginLeft:8}}>{a.name}</span>
      </Tooltip>
      <Popup closeButton={false} className="ow-ab-popup" maxWidth={240} minWidth={230}>
        <div style={{width:230,background:'#07090b',fontFamily:"'Share Tech Mono',monospace",borderLeft:`2px solid ${col}`}}>
          <div style={{padding:'8px 10px 5px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,fontWeight:700,color:col,letterSpacing:2}}>{icao}</span>
                {region&&<span style={{fontSize:9,color:'#4a6070',letterSpacing:1}}>{region.toUpperCase()}</span>}
              </div>
              <span style={{fontSize:8,color:col,border:`1px solid ${col}`,padding:'2px 6px',letterSpacing:2}}>{statusLabel}</span>
            </div>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,color:'#dceaf0',letterSpacing:0.5,lineHeight:1.2}}>
              {a.name}
            </div>
          </div>
          <div style={{padding:'5px 10px 6px',display:'flex',alignItems:'baseline',gap:8,borderTop:'1px solid #1e2c3a',borderBottom:'1px solid #1e2c3a'}}>
            <span style={{fontSize:8,color:'#4a6070',letterSpacing:1}}>ARR</span>
            <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,color:col,minWidth:16}}>{a.arrCnt||0}</span>
            <span style={{fontSize:8,color:'#4a6070',letterSpacing:1,marginLeft:6}}>DEP</span>
            <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,color:'#dceaf0',minWidth:16}}>{depCount}</span>
            <span style={{fontSize:8,color:'#4a6070',letterSpacing:1,marginLeft:6}}>7D</span>
            <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:16,fontWeight:700,color:'#f0a040',minWidth:18}}>{arrivals7d||a.arrCnt||0}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr'}}>
            <div onClick={()=>{ window.location.href=`/airbase/${icao}` }}
              style={{padding:'7px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,
                fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:col,
                borderRight:'1px solid #1e2c3a',userSelect:'none'}}>
              <span>→</span><span>AIRBASE VIEW</span>
            </div>
            <div onClick={()=>{selectAsset(a);setAbmAsset(a)}}
              style={{padding:'7px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,
                fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:'#f0a040',
                justifyContent:'center',userSelect:'none'}}>
              <span>▼</span><span>EXPAND</span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}


export function MapView({ auth }) {
  const navigate = useNavigate()
  const { flights, byBase, loading } = useFlights({ limit: 2000 })
  const { assets: dbAssets } = useAssets()
  const [countryGeo, setCountryGeo] = useState(null)
  const [countryIntel, setCountryIntel] = useState([])
  const geoKey = useRef(0)

  const dbByIcao = {}, dbByName = {}
  ;(dbAssets||[]).forEach(a => {
    if(a.icao_code) dbByIcao[a.icao_code.toLowerCase()] = a
    if(a.name) dbByName[a.name.toLowerCase()] = a
  })

  const allDbAssets = STATIC_ASSETS.map(s => {
    const db = dbByIcao[s.id] || dbByName[s.name?.toLowerCase()]
    if(!db) return s
    const dbNotes = db.notes && db.notes.length > 6 ? db.notes : null
    return { ...s,
      status: db.status || s.status,
      arrCnt: db.arr_count || s.arrCnt || 0,
      socomCnt: db.socom_count || s.socomCnt || 0,
      intel: db.intel_assessment || s.intel,
      lat: db.lat != null ? parseFloat(db.lat) : s.lat,
      lng: db.lng != null ? parseFloat(db.lng) : s.lng,
      notes: dbNotes || s.notes,
    }
  })

  const staticIds   = new Set(STATIC_ASSETS.map(s => s.id))
  const staticNames = new Set(STATIC_ASSETS.map(s => s.name?.toLowerCase()))
  const dbExtras = (dbAssets||[])
    .filter(a => !staticIds.has((a.icao_code||'').toLowerCase()) && !staticNames.has(a.name?.toLowerCase()))
    .map(a => ({
      id:(a.icao_code||a.id||'').toLowerCase(),name:a.name,sub:a.designation,country:a.country?.trim(),
      type:a.asset_type,status:a.status,
      lat:a.lat!=null?parseFloat(a.lat):null,lng:a.lng!=null?parseFloat(a.lng):null,
      arrCnt:a.arr_count||0,socomCnt:a.socom_count||0,
      hull:a.hull_number,csg:a.csg_designation,
      intel:a.intel_assessment,notes:a.notes,tags:a.tags||[],
      aircraftTypes:[],squadrons:[],escorts:[],
    }))

  const LAYER_DEFAULTS = {carriers:true,destroyers:false,subs:false,lmsr:false,airbases:true,conus:false,strikes:true,strategic:false,infrastructure:false,ports:false,strikePulse:false}
  const [layers, setLayers] = useState(()=>{ try{const s=localStorage.getItem('ow_layers');return s?{...LAYER_DEFAULTS,...JSON.parse(s)}:LAYER_DEFAULTS}catch{return LAYER_DEFAULTS} })
  const [country, setCountry]   = useState('ALL')
  const [selAsset, setSelAsset] = useState(null)
  const [selCor,   setSelCor]   = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [abmAsset, setAbmAsset]  = useState(null)
  const [liveFeeds, setLiveFeeds] = useState([])
  const [assetFilter, setAssetFilter] = useState('ALL')
  const [repositionAsset, setRepositionAsset] = useState(null)
  const [repositionPos,   setRepositionPos]   = useState(null)
  const [repositionSaving, setRepositionSaving] = useState(false)
  const [strikePulseData, setStrikePulseData] = useState([])
  const [strategicSites, setStrategicSites] = useState([])
  const [infraSites, setInfraSites] = useState([])
  const [portAssets, setPortAssets] = useState([])
  const [pulseWindow, setPulseWindow] = useState('48h')
  const [selPulse, setSelPulse] = useState(null)

  useEffect(()=>{ try{localStorage.setItem('ow_layers',JSON.stringify(layers))}catch{} },[layers])

  useEffect(()=>{
    supabase.from('strike_pulse').select('*').then(({data})=>setStrikePulseData(data||[]))
    supabase.from('strike_sites').select('id,name,lat,lng,status,site_type,description,country_code').eq('is_strategic',true).then(({data})=>setStrategicSites(data||[]))
    supabase.from('strike_sites').select('id,name,lat,lng,status,site_category,description,country_code').eq('is_infrastructure',true).then(({data})=>setInfraSites(data||[]))
    supabase.from('assets').select('id,name,designation,lat,lng,port_category,country').eq('asset_type','port').eq('key_port',true).then(({data})=>setPortAssets(data||[]))
  },[])

  async function confirmReposition() {
    if(!repositionAsset||!repositionPos) return
    setRepositionSaving(true)
    const {data:existing} = await supabase.from('assets').select('id').eq('name',repositionAsset.name).maybeSingle()
    if(existing) await supabase.from('assets').update({lat:repositionPos.lat,lng:repositionPos.lng}).eq('id',existing.id)
    else await supabase.from('assets').insert({name:repositionAsset.name,asset_type:repositionAsset.type,hull_number:repositionAsset.hull||repositionAsset.sub,lat:repositionPos.lat,lng:repositionPos.lng,status:repositionAsset.status,country:repositionAsset.country})
    setRepositionSaving(false); setRepositionAsset(null); setRepositionPos(null)
  }
  function startReposition(asset) {
    setRepositionAsset(asset); setRepositionPos({lat:asset.lat,lng:asset.lng})
    if(asset.lat&&asset.lng) setFlyTarget({center:[asset.lat,asset.lng],zoom:5})
  }

  useEffect(() => {
    supabase.from('sigact_feed').select('*').order('created_at',{ascending:false}).limit(15).then(({data})=>setLiveFeeds(data||[]))
    const ch = supabase.channel('feed_live').on('postgres_changes',{event:'INSERT',schema:'public',table:'sigact_feed'},p=>setLiveFeeds(prev=>[p.new,...prev].slice(0,15))).subscribe()
    return ()=>supabase.removeChannel(ch)
  },[])

  useEffect(()=>{
    fetch('/countries-tracked.geojson').then(r=>r.json()).then(data=>setCountryGeo(data)).catch(()=>{})
    supabase.from('country_intel').select('code,escalation,name').then(({data})=>{setCountryIntel(data||[]);geoKey.current++})
  },[])

  const allAssets = [...allDbAssets,...dbExtras]
  const filtered  = allAssets.filter(a=>country==='ALL'||a.country?.trim()===country||a.type==='lmsr')

  function selectAsset(a){ setSelAsset(a); setSelCor(null); if(a.lat&&a.lng) setFlyTarget({center:[a.lat,a.lng],zoom:6}) }
  function selectCoronet(c){ setSelCor(selCor?.id===c.id?null:c); setSelAsset(null) }

  const naval    = filtered.filter(a=>['carrier','destroyer','submarine'].includes(a.type)).length
  const bases    = filtered.filter(a=>a.type==='airbase').length
  const socomCnt = flights.filter(f=>f.mc_flag==='socom').length

  function geoStyle(feature) {
    const intel = countryIntel.find(c=>c.code===feature.properties.code)
    if(!intel) return {fillOpacity:0,opacity:0,weight:0,interactive:false}
    return {fillColor:'transparent',fillOpacity:0,color:'transparent',weight:0,opacity:0}
  }
function onEachFeature(feature,layer) {
    const intel = countryIntel.find(c=>c.code===feature.properties.code)
    if(!intel){layer.options.interactive=false;return}
    const e = ESC_GEO[intel.escalation]||ESC_GEO.WATCH
    layer.on({
      mouseover:ev=>{
        ev.target.setStyle({
          fillColor:'#ffffff',
          fillOpacity:0.12,
          color:'#ffffff',
          weight:1.5,
          opacity:0.7
        })
        if(ev.target._path) L.DomUtil.addClass(ev.target._path,'ow-country-hover')
        ev.target.bringToFront()
      },
      mouseout: ev=>{
        ev.target.setStyle({fillOpacity:0,opacity:0,weight:0,color:'transparent'})
        if(ev.target._path) L.DomUtil.removeClass(ev.target._path,'ow-country-hover')
      },
      click: ()=>navigate(`/country/${feature.properties.code}`)
    })
    layer.bindTooltip(
      `<div style="font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;color:#dceaf0;background:rgba(7,9,11,.95);border:1px solid ${e.color};padding:5px 12px;border-radius:2px;letter-spacing:1px;pointer-events:none">${intel.name||feature.properties.name} <span style="font-size:9px;color:${e.color};margin-left:8px;letter-spacing:2px">${intel.escalation}</span></div>`,
      {sticky:true,opacity:1,className:'ow-country-tip'}
    )
  }

  return (
    <ErrorBoundary>
    <div style={{flex:1,display:'grid',gridTemplateColumns:'260px 1fr 310px',overflow:'hidden'}}>

      {/* LEFT PANEL */}
      <div style={{background:C.bg2,borderRight:`1px solid ${C.br}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Active CORONETs" badge={STATIC_CORONETS.length} bc={C.a} bb="rgba(240,160,64,.12)" />
          <div style={{maxHeight:200,overflowY:'auto'}}>
            {STATIC_CORONETS.map(c=><CorItem key={c.id} cor={c} sel={selCor?.id===c.id} onClick={()=>selectCoronet(c)} />)}
          </div>
        </div>
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Layers" />
          <div style={{padding:'4px 8px 6px'}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,letterSpacing:2,color:C.t3,marginBottom:4,marginTop:4}}>NAVAL</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
              {[['carriers','Carriers'],['destroyers','Destroyers'],['subs','Submarines'],['lmsr','Sealift'],['ports','Ports']].map(([k,lbl])=>(
                <LyrBtn key={k} label={lbl} on={layers[k]} onClick={()=>setLayers(l=>({...l,[k]:!l[k]}))} />
              ))}
            </div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,letterSpacing:2,color:C.t3,marginBottom:4,marginTop:10}}>AVIATION</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
              {[['airbases','Air Bases'],['conus','CONUS Dep']].map(([k,lbl])=>(
                <LyrBtn key={k} label={lbl} on={layers[k]} onClick={()=>setLayers(l=>({...l,[k]:!l[k]}))} />
              ))}
            </div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,letterSpacing:2,color:C.t3,marginBottom:4,marginTop:10}}>FACILITIES & INTEL</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
              {[['strategic','Strategic'],['infrastructure','Infra'],['strikes','Events'],['strikePulse','Strike Pulse']].map(([k,lbl])=>(
                <LyrBtn key={k} label={lbl} on={layers[k]} onClick={()=>setLayers(l=>({...l,[k]:!l[k]}))} />
              ))}
            </div>
          </div>
          {layers.strikePulse&&(
            <div style={{padding:'4px 8px 8px',borderTop:`1px solid ${C.br}`}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:C.t3,letterSpacing:2,marginBottom:5}}>PULSE WINDOW</div>
              <div style={{display:'flex',gap:2,flexWrap:'wrap'}}>
                {['1h','12h','24h','48h','72h','7d'].map(w=>(
                  <button key={w} onClick={()=>setPulseWindow(w)}
                    style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,padding:'2px 6px',cursor:'pointer',borderRadius:1,
                      background:pulseWindow===w?'rgba(232,80,64,.22)':'transparent',
                      border:`1px solid ${pulseWindow===w?C.r:C.br}`,color:pulseWindow===w?C.r:C.t2}}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Country" />
          <div style={{display:'flex',gap:4,padding:'6px 10px',flexWrap:'wrap'}}>
            {[['ALL','ALL'],['US','US'],['UK','UK'],['FR','FR']].map(([k,lbl])=>(
              <button key={k} onClick={()=>setCountry(k)}
                style={{...R,fontSize:11,fontWeight:600,letterSpacing:1,padding:'3px 8px',border:`1px solid ${country===k?C.b:C.br}`,borderRadius:1,cursor:'pointer',background:country===k?'rgba(80,160,232,.08)':'transparent',color:country===k?C.b:C.t2}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <PH title="Assets" badge={filtered.length} bc={C.b} bb="rgba(80,160,232,.12)" />
        <div style={{display:'flex',gap:3,padding:'5px 8px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexWrap:'wrap',flexShrink:0}}>
          {[['ALL','ALL'],['naval','Naval'],['airbase','Bases'],['lmsr','Sealift'],['strike','Events'],['conus_base','CONUS']].map(([k,lbl])=>(
            <button key={k} onClick={()=>setAssetFilter(p=>p===k&&k!=='ALL'?'ALL':k)}
              style={{...R,fontSize:9,fontWeight:600,padding:'2px 7px',cursor:'pointer',
                background:assetFilter===k?'rgba(80,160,232,.15)':'transparent',
                border:`1px solid ${assetFilter===k?C.b:C.br}`,
                color:assetFilter===k?C.b:C.t2,borderRadius:1,whiteSpace:'nowrap'}}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.filter(a=>{
            if(assetFilter==='ALL') return true
            if(assetFilter==='naval') return ['carrier','destroyer','submarine'].includes(a.type)
            return a.type===assetFilter
          }).map(a=><AListItem key={a.id} asset={a} sel={selAsset?.id===a.id} onClick={()=>selectAsset(a)} />)}
        </div>
      </div>

      {/* MAP */}
      <div style={{position:'relative',overflow:'hidden'}}>
        <style>{`.ow-country-tip{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important}.leaflet-zoom-box{display:none!important}.ow-tip{background:rgba(7,9,11,.95)!important;border:1px solid #2e3f52!important;border-radius:2px!important;padding:4px 8px!important;box-shadow:0 6px 18px rgba(0,0,0,0.55)!important}.ow-tip::before{display:none!important}.ow-ab-popup .leaflet-popup-content-wrapper{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;border-radius:2px!important}.ow-ab-popup .leaflet-popup-content{margin:0!important;line-height:1!important}.ow-ab-popup .leaflet-popup-tip-container{display:none!important}`}</style>
        <MapContainer center={[28,22]} zoom={3} style={{width:'100%',height:'100%'}} zoomControl={false} attributionControl={false} boxZoom={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={18} />
          {countryGeo&&countryIntel.length>0&&<GeoJSON key={geoKey.current} data={countryGeo} style={geoStyle} onEachFeature={onEachFeature} />}
          <DisableBoxZoom />
          <PopupAutoClose />
          <FlyTo target={flyTarget} />
          <MapClickHandler repositioning={!!repositionAsset} onClear={()=>{setSelAsset(null);setSelCor(null);setAbmAsset(null)}} onReposition={(pos)=>setRepositionPos(pos)} />

          {repositionAsset&&repositionPos&&(
            <Marker position={[repositionPos.lat,repositionPos.lng]} draggable={true}
              icon={mkTrackBlock('REPOS',C.a)}
              eventHandlers={{dragend:(e)=>{const p=e.target.getLatLng();setRepositionPos({lat:p.lat,lng:p.lng})}}} />
          )}

          {selCor&&(()=>{const f=ICAO_COORDS[selCor.from],t=ICAO_COORDS[selCor.to];if(!f||!t)return null;return<Polyline positions={[f,t]} pathOptions={{color:C.a,weight:2.5,dashArray:'8 4',opacity:.85}} />})()}

           {layers.airbases&&(
            <AirbaseClusterLayer
              assets={allAssets}
              flights={flights}
              country={country}
              selectAsset={selectAsset}
              setAbmAsset={setAbmAsset}
            />
          )}
          {layers.conus&&Object.entries(byBase).map(([icao,data])=>{
            if(!CONUS_META[icao]) return null
            const meta=CONUS_META[icao], coords=ICAO_COORDS[icao]
            if(!coords) return null
            return (
              <Marker key={icao+'_c'} position={coords} icon={mkIcon('US',data.socom>0?C.p:C.b,18,data.total>5?String(data.total):null)}
                eventHandlers={{click:()=>selectAsset({id:icao,name:meta.name||icao,sub:`${icao} // ${meta.region||'CONUS'}`,type:'conus_base',lat:coords[0],lng:coords[1],...data,...meta})}}>
                <Popup closeButton={false}>
                  <div style={{...Z,fontSize:11}}>
                    <div style={{...R,fontSize:13,fontWeight:700,color:C.tb}}>{icao} — {meta.name||'CONUS'}</div>
                    <div style={{color:C.t2,marginTop:2,fontSize:10}}>{meta.unit}</div>
                    <div style={{color:C.b,marginTop:4}}>{data.total} flights · <span style={{color:C.p}}>{data.socom} SOCOM</span></div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {layers.carriers && allAssets.filter(a => a.type === 'carrier' && a.lat != null && a.lng != null && (country === 'ALL' || a.country?.trim() === country) && repositionAsset?.id !== a.id).map(a => {
            const col = a.status === 'REFIT' ? C.t3 : a.status === 'SURGE' ? C.r : C.b
            const label = (a.hull || a.sub?.split('//')[0]?.trim() || a.id).trim()
            return (
              <Marker key={a.id} position={[a.lat, a.lng]}
                icon={mkTrackBlock(label, col)}
                eventHandlers={{click: () => selectAsset(a)}}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} className="ow-tip">
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,color:'#dceaf0'}}>{a.name}</span>
                </Tooltip>
              </Marker>
            )
          })}
          {layers.destroyers && allAssets.filter(a => a.type === 'destroyer' && a.lat != null && a.lng != null && (country === 'ALL' || a.country?.trim() === country) && repositionAsset?.id !== a.id).map(a => {
            const label = (a.hull || a.sub?.split('//')[0]?.trim() || a.id).trim()
            return (
              <Marker key={a.id} position={[a.lat, a.lng]}
                icon={mkTrackBlock(label, C.b)}
                eventHandlers={{click: () => selectAsset(a)}}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} className="ow-tip">
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,color:'#dceaf0'}}>{a.name}</span>
                </Tooltip>
              </Marker>
            )
          })}
          {layers.subs && allAssets.filter(a => a.type === 'submarine' && a.lat != null && a.lng != null && (country === 'ALL' || a.country?.trim() === country) && repositionAsset?.id !== a.id).map(a => {
            const label = (a.hull || a.sub?.split('//')[0]?.trim() || a.id).trim()
            return (
              <Marker key={a.id} position={[a.lat, a.lng]}
                icon={mkTrackBlock(label, C.p)}
                eventHandlers={{click: () => selectAsset(a)}}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} className="ow-tip">
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,color:'#dceaf0'}}>{a.name}</span>
                </Tooltip>
              </Marker>
            )
          })}
          {layers.lmsr&&LMSR_DATA.filter(s=>s.lat!=null&&s.lng!=null&&repositionAsset?.id!==s.id).map(s=>{
            const col=s.cat==='forward'?C.y:s.cat==='conus_e'?C.b:C.t2
            return (
              <Marker key={s.id} position={[s.lat,s.lng]}
                icon={mkTrackBlock((s.hull||s.id||'').trim(), col)}
                eventHandlers={{click:()=>selectAsset({...s,type:'lmsr'})}}>
                <Tooltip direction="top" offset={[0,-14]} opacity={1} className="ow-tip">
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:700,color:'#dceaf0'}}>{s.name}</span>
                </Tooltip>
                <Popup closeButton={false}>
                  <div style={{...Z,fontSize:11}}>
                    <div style={{...R,fontSize:13,fontWeight:700,color:C.tb}}>{s.name}</div>
                    <div style={{color:s.centcom==='CRITICAL'?C.r:s.centcom==='HIGH'?C.a:C.t2,marginTop:3}}>{s.centcom}</div>
                    <div style={{color:C.t2,fontSize:10,marginTop:2}}>{s.loc}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
          {layers.strikes&&allAssets.filter(a=>a.type==='strike'&&a.lat!=null&&a.lng!=null&&(country==='ALL'||a.country?.trim()===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('EV',C.r,16)} eventHandlers={{click:()=>selectAsset(a)}} />
          ))}

          {layers.strategic&&strategicSites.filter(s=>s.lat&&s.lng).map(s=>(
            <Marker key={`strat-${s.id}`} position={[parseFloat(s.lat),parseFloat(s.lng)]} icon={mkSiteIcon(s.site_type, s.status)}>
              <Tooltip direction="top" offset={[0,-10]} opacity={1} className="ow-tip">
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:{DESTROYED:C.r,DAMAGED:C.a,ACTIVE:C.g}[s.status]||C.t2}}>{s.site_type?.toUpperCase()||'STR'}</span>
                <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,color:'#dceaf0',marginLeft:6}}>{s.name}</span>
              </Tooltip>
              <Popup closeButton={false}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,minWidth:180}}>
                  <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:700,color:'#dceaf0',marginBottom:3}}>{s.name}</div>
                  <div style={{fontSize:9,color:{DESTROYED:C.r,DAMAGED:C.a,ACTIVE:C.g}[s.status]||C.t2,letterSpacing:1}}>{s.status} · {s.site_type?.toUpperCase()}</div>
                  <div onClick={()=>navigate(`/country/${s.country_code}`)} style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:600,color:'#50a0e8',marginTop:6,cursor:'pointer'}}>→ COUNTRY VIEW</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {layers.infrastructure&&infraSites.filter(s=>s.lat&&s.lng).map(s=>(
            <Marker key={`infra-${s.id}`} position={[parseFloat(s.lat),parseFloat(s.lng)]} icon={mkSiteIcon(s.site_category, s.status)}>
              <Tooltip direction="top" offset={[0,-10]} opacity={1} className="ow-tip">
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:C.a}}>{s.site_category?.toUpperCase()||'INFRA'}</span>
                <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,color:'#dceaf0',marginLeft:6}}>{s.name}</span>
              </Tooltip>
            </Marker>
          ))}

          {layers.ports&&portAssets.filter(p=>p.lat&&p.lng).map(p=>(
            <Marker key={`port-${p.id}`} position={[parseFloat(p.lat),parseFloat(p.lng)]} icon={mkSiteIcon('port', p.status||'ACTIVE')}>
              <Tooltip direction="top" offset={[0,-10]} opacity={1} className="ow-tip">
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#20c0a0'}}>{p.port_category?.toUpperCase()||'PORT'}</span>
                <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,color:'#dceaf0',marginLeft:6}}>{p.name}</span>
              </Tooltip>
            </Marker>
          ))}

          {layers.strikePulse&&strikePulseData.filter(row=>(row[PULSE_COLS[pulseWindow]]||0)>0).map(row=>{
            const count=row[PULSE_COLS[pulseWindow]]||0
            const recency=(row.strikes_24h||0)>0?'hot':(row.strikes_72h||0)>0?'warm':'old'
            if(!row.centroid_lat||!row.centroid_lng) return null
            return (
              <Marker key={`pulse-${row.country_code}`} position={[parseFloat(row.centroid_lat),parseFloat(row.centroid_lng)]} icon={mkPulseIcon(count,recency)}
                eventHandlers={{click:()=>setSelPulse(row)}}>
                <Tooltip direction="top" offset={[0,-14]} opacity={1} className="ow-tip">
                  <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:recency==='hot'?C.r:recency==='warm'?C.a:C.t2}}>{row.country_code}</span>
                  <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600,color:'#dceaf0',marginLeft:6}}>{count} strikes / {pulseWindow}</span>
                </Tooltip>
              </Marker>
            )
          })}
        </MapContainer>

        {selPulse&&(
          <StrikePulseSidebar
            countryCode={selPulse.country_code}
            pulseRow={selPulse}
            onClose={()=>setSelPulse(null)}
          />
        )}

        {repositionAsset?(
          <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',zIndex:900,display:'flex',alignItems:'center',gap:10,background:'rgba(7,9,11,.96)',border:`2px solid ${C.a}`,padding:'8px 16px',backdropFilter:'blur(8px)',maxWidth:'90%'}}>
            <div style={{...R,fontSize:12,fontWeight:600,color:C.tb,flex:1}}>
              {repositionAsset.name}
              <span style={{...Z,fontSize:9,color:C.t2,marginLeft:8}}>{repositionPos?`${repositionPos.lat.toFixed(4)}°N, ${repositionPos.lng.toFixed(4)}°E`:''}</span>
            </div>
            <span style={{...Z,fontSize:9,color:C.a}}>Drag marker or click map</span>
            <button onClick={confirmReposition} disabled={repositionSaving} style={{...R,fontSize:11,fontWeight:700,letterSpacing:1,padding:'6px 18px',background:C.g,color:C.bg,border:'none',cursor:'pointer',borderRadius:1}}>{repositionSaving?'SAVING…':'✓ CONFIRM'}</button>
            <button onClick={()=>{setRepositionAsset(null);setRepositionPos(null)}} style={{...R,fontSize:11,fontWeight:600,padding:'6px 14px',background:'transparent',border:`1px solid ${C.br}`,color:C.t2,cursor:'pointer',borderRadius:1}}>✕ CANCEL</button>
          </div>
        ):(
          <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',zIndex:900,display:'flex',gap:3,background:'rgba(7,9,11,.92)',border:`1px solid ${C.br2}`,padding:5,backdropFilter:'blur(8px)'}}>
            {Object.keys(VIEWS).map(k=>(
              <button key={k} onClick={()=>setFlyTarget(VIEWS[k])} style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'5px 12px',border:`1px solid ${C.br}`,background:'transparent',color:C.t2,cursor:'pointer',textTransform:'uppercase'}}>{k}</button>
            ))}
          </div>
        )}

        <div style={{position:'absolute',top:0,left:0,right:0,zIndex:800,background:'rgba(7,9,11,.88)',borderBottom:`1px solid ${C.br}`,display:'flex',backdropFilter:'blur(6px)'}}>
          {[{l:'AMC FLIGHTS',v:loading?'…':flights.length,c:C.b},{l:'Air Base',v:bases,c:C.g},{l:'ACTIVE',v:flights.filter(f=>f.status==='ACTIVE').length,c:C.a}].map(({l,v,c})=>(
            <div key={l} style={{padding:'5px 14px',borderRight:`1px solid ${C.br}`}}>
              <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:1}}>{l}</div>
              <div style={{...R,fontSize:16,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
            </div>
          ))}
          {layers.strikePulse&&(
            <div style={{padding:'5px 14px',borderRight:`1px solid ${C.br}`}}>
              <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:1}}>PULSE/{pulseWindow.toUpperCase()}</div>
              <div style={{...R,fontSize:16,fontWeight:700,color:C.r,lineHeight:1}}>{strikePulseData.filter(r=>(r[PULSE_COLS[pulseWindow]]||0)>0).length}</div>
            </div>
          )}
          <div style={{padding:'5px 14px',marginLeft:'auto',...Z,fontSize:9,color:C.t3,display:'flex',alignItems:'center',gap:6}}>
            {countryIntel.length>0&&<span style={{color:C.g}}>● {countryIntel.length} countries tracked</span>}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{background:C.bg2,borderLeft:`1px solid ${C.br}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <PH title="Asset Detail" badge={selAsset?.name?.slice(0,18)||selCor?.callsign?.slice(0,14)||null} bc={C.t2} bb="transparent" />
        <div style={{flex:1,overflowY:'auto'}}>
          {selAsset ? <ADetail asset={selAsset} onExpand={()=>setAbmAsset(selAsset)} flights={flights} navigate={navigate} auth={auth} onReposition={auth?.isAdmin?startReposition:null} />
          : selCor   ? <CorDetail cor={selCor} />
          : <EmptyDetail />}
        </div>
        <SigactPanel feeds={liveFeeds} selAsset={selAsset} />
      </div>

      <div style={{gridColumn:'1/4',height:24,background:C.bg4,borderTop:`1px solid ${C.br}`,display:'flex',alignItems:'center',padding:'0 14px',gap:16,flexShrink:0}}>
        {[{l:'NAVAL',v:naval,c:C.b},{l:'BASES',v:bases,c:C.g},{l:'LMSR',v:LMSR_DATA.length,c:C.y},{l:'AMC',v:loading?'…':flights.length,c:C.b}].map(({l,v,c})=>(
          <span key={l} style={{...Z,fontSize:10,color:C.t2}}>{l} <b style={{color:c,fontWeight:400}}>{v}</b></span>
        ))}
        {layers.strategic&&<span style={{...Z,fontSize:10,color:C.t2}}>STRAT <b style={{color:C.r,fontWeight:400}}>{strategicSites.length}</b></span>}
        {layers.ports&&<span style={{...Z,fontSize:10,color:C.t2}}>PORTS <b style={{color:'#20c0a0',fontWeight:400}}>{portAssets.length}</b></span>}
        {auth?.isOwner&&<span style={{...Z,fontSize:9,color:C.g,marginLeft:'auto',letterSpacing:1}}>◈ OWNER MODE</span>}
        {auth?.isAdmin&&!auth?.isOwner&&<span style={{...Z,fontSize:9,color:C.a,marginLeft:'auto',letterSpacing:1}}>● ADMIN MODE</span>}
      </div>

      {abmAsset&&<AbmModal asset={abmAsset} flights={flights} onClose={()=>setAbmAsset(null)} navigate={navigate} />}
    </div>
    </ErrorBoundary>
  )
}

// ── Shared small components ───────────────────────────────────
function PH({title,badge,bc,bb}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
      <span style={{...R,fontSize:10,fontWeight:600,letterSpacing:3,color:C.t2,textTransform:'uppercase'}}>{title}</span>
      {badge!=null&&<span style={{...Z,fontSize:10,padding:'1px 6px',borderRadius:1,color:bc,background:bb}}>{badge}</span>}
    </div>
  )
}
function SBox({value,label,color}) {
  return (
    <div style={{padding:8,background:C.bg,border:`1px solid ${C.br}`,borderRadius:1}}>
      <div style={{...R,fontSize:15,fontWeight:700,marginBottom:1,color,lineHeight:1.1}}>{value}</div>
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
function LyrBtn({label,on,onClick}) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 8px',border:`1px solid ${on?'rgba(57,224,160,.2)':C.br}`,cursor:'pointer',background:on?'rgba(57,224,160,.04)':'transparent',borderRadius:1}}>
      <span style={{...R,fontSize:11,fontWeight:500,color:C.t1}}>{label}</span>
      <div style={{width:26,height:13,background:on?C.g:C.br,borderRadius:6,position:'relative',transition:'.2s',flexShrink:0}}>
        <div style={{position:'absolute',width:9,height:9,background:C.bg,borderRadius:'50%',top:2,left:on?15:2,transition:'.2s'}} />
      </div>
    </div>
  )
}

function CorItem({cor,sel,onClick}) {
  const sc=cor.status==='ACTIVE'?C.g:cor.status==='IN TRANSIT'?C.a:cor.status==='COMPLETE'?C.t3:C.b
  return (
    <div onClick={onClick} style={{padding:'8px 10px',border:`1px solid ${sel?'rgba(240,160,64,.5)':C.br}`,borderRadius:1,margin:'4px 6px',cursor:'pointer',background:sel?'rgba(240,160,64,.06)':C.bg3}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
        <span style={{...R,fontSize:12,fontWeight:700,color:C.tb}}>{cor.callsign}</span>
        <span style={{...Z,fontSize:9,padding:'1px 5px',borderRadius:1,color:sc}}>{cor.status}</span>
      </div>
      <div style={{...Z,fontSize:10,color:C.t2,marginBottom:3}}>{cor.from} → {cor.to}</div>
      <div style={{display:'flex',gap:4}}>
        <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',background:'rgba(80,160,232,.15)',border:'1px solid rgba(80,160,232,.3)',color:C.b}}>{cor.acType}</span>
        <span style={{...Z,fontSize:9,padding:'1px 5px',background:'rgba(57,224,160,.1)',border:'1px solid rgba(57,224,160,.25)',color:C.g}}>{cor.quantity}</span>
      </div>
    </div>
  )
}

function AListItem({asset,sel,onClick}) {
  const typeChar={carrier:'C',destroyer:'D',submarine:'S',airbase:'A',strike:'E',lmsr:'L',conus_base:'B'}
  const flagChar={US:'US',UK:'UK',FR:'FR'}
  let badge=null
  if(asset.arrCnt){const n=asset.arrCnt,c=n>=20?C.r:n>=10?C.a:C.g;badge=<span style={{...Z,fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:1,background:`${c}18`,color:c,border:`1px solid ${c}40`}}>▲{n}</span>}
  if(asset.type==='lmsr'){const cc=asset.centcom==='CRITICAL'?C.r:asset.centcom==='HIGH'?C.a:C.t3;badge=<span style={{...Z,fontSize:9,padding:'1px 4px',borderRadius:1,background:`${cc}18`,color:cc}}>{asset.centcom||'—'}</span>}
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',cursor:'pointer',borderBottom:`1px solid rgba(30,44,58,.4)`,background:sel?'rgba(80,160,232,.06)':'transparent',borderLeft:sel?`2px solid ${C.b}`:'2px solid transparent'}}>
      <div style={{...Z,fontSize:9,color:C.t3,flexShrink:0,width:28}}>{flagChar[asset.country]||''} <span style={{color:C.t2}}>{typeChar[asset.type]||'?'}</span></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{...R,fontSize:12,fontWeight:600,color:C.tb,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{asset.name}</div>
        <div style={{...Z,fontSize:9,color:C.t2}}>{asset.sub||asset.hull||''}</div>
      </div>
      {badge}
    </div>
  )
}

// ── AircraftOnStation ─────────────────────────────────────────
// Side panel view: type + unit only. No counts. Uniform across all bases.
// All data passes through normalizeAircraft() first.
// DEPARTED aircraft are filtered out — they are history, not current picture.
function AircraftOnStation({ types }) {
  const [openSet, setOpenSet] = useState(new Set())
  function toggleOpen(i) { setOpenSet(prev => { const s=new Set(prev); s.has(i)?s.delete(i):s.add(i); return s }) }
  if (!types?.length) return null

  const active = types.map(normalizeAircraft).filter(ac => ac && !ac.isLogistics && ac.status !== 'DEPARTED')
  if (!active.length) return null

  return (
    <div style={{padding:'10px 13px',borderBottom:`1px solid ${C.br}`}}>
      <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>AIRCRAFT ON STATION</div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        {active.map((ac,i) => {
          const isOpen = openSet.has(i)
          return (
            <div key={i}>
              <div onClick={()=>toggleOpen(i)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',
                  background:isOpen?'rgba(80,160,232,.06)':C.bg3,
                  border:`1px solid ${isOpen?C.b:C.br}`,borderRadius:1,
                  cursor:ac.tails?.length?'pointer':'default'}}>
                <span style={{...R,fontSize:12,fontWeight:700,color:C.tb,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ac.type}</span>
                <span style={{...Z,fontSize:10,color:C.t2,flexShrink:0,textAlign:'right'}}>{ac.unit||'—'}</span>
                {ac.tails?.length>0&&<span style={{...Z,fontSize:8,color:C.t3,flexShrink:0}}>{isOpen?'▲':'▼'}</span>}
              </div>
              {isOpen&&ac.tails?.length>0&&(
                <div style={{padding:'7px 10px',background:'rgba(0,0,0,.2)',border:`1px solid ${C.b}33`,borderTop:'none',borderRadius:'0 0 1px 1px'}}>
                  <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:5}}>TAIL NUMBERS / CALLSIGNS</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {ac.tails.map((t,j)=>(
                      <span key={j} style={{...Z,fontSize:8,padding:'2px 5px',background:'rgba(80,160,232,.1)',border:'1px solid rgba(80,160,232,.25)',color:C.b,borderRadius:1}}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ADetail: right panel asset detail ────────────────────────
function ADetail({asset,onExpand,flights,navigate,auth,onReposition}) {
  const stCol={DEPLOYED:C.g,ACTIVE:C.g,SURGE:C.r,ELEVATED:C.a,ONGOING:C.r,REFIT:C.t3}[asset.status]||C.t2

  if(asset.type==='conus_base') {
    const bf=flights.filter(f=>f.base===asset.id)
    const recent=bf.filter(f=>f.dep_date&&new Date(f.dep_date)>=new Date(Date.now()-7*864e5))
    const dests=Object.entries(bf.reduce((a,f)=>{a[f.destination]=(a[f.destination]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1])
    return (
      <div>
        <div style={{padding:'11px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:4}}>CONUS DEPARTURE BASE</div>
          <div style={{...R,fontSize:17,fontWeight:700,color:C.tb,marginBottom:2}}>{asset.name||asset.id}</div>
          <div style={{...Z,fontSize:10,color:C.t2}}>{asset.unit}</div>
          <div style={{...Z,fontSize:9,color:C.t3,marginTop:2}}>{asset.region}</div>
        </div>
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            <SBox value={bf.length} label="TOTAL" color={C.b} />
            <SBox value={recent.length} label="LAST 7D" color={C.g} />
            <SBox value={bf.filter(f=>f.mc_flag==='socom').length} label="SOCOM" color={C.p} />
          </div>
        </div>
        {dests.length>0&&(
          <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
            <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,marginBottom:8}}>TOP DESTINATIONS</div>
            {dests.slice(0,6).map(([d,n])=>(
              <div key={d} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                <span style={{...Z,fontSize:10,color:C.b,width:48}}>{d}</span>
                <div style={{flex:1,height:4,background:'#0c1018',borderRadius:2,overflow:'hidden'}}><div style={{width:`${(n/dests[0][1])*100}%`,height:'100%',background:C.b,borderRadius:2}} /></div>
                <span style={{...Z,fontSize:10,color:C.t2,width:14,textAlign:'right'}}>{n}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <button onClick={()=>onExpand&&onExpand()} style={{display:'block',width:'100%',padding:6,...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.a}`,background:'rgba(240,160,64,.08)',color:C.a,cursor:'pointer'}}>▼ EXPAND — FLIGHTS / DETAIL</button>
        </div>
        {bf.slice(0,5).map(f=>(
          <div key={f.id} style={{display:'flex',gap:6,padding:'5px 13px',borderBottom:`1px solid rgba(30,44,58,.3)`,...Z,fontSize:10}}>
            <span style={{color:C.t3,width:30}}>{f.dep_date?.slice(5)||'—'}</span>
            <span style={{color:C.tb,width:56,fontWeight:600}}>{normCallsign(f.callsign)}</span>
            <span style={{color:f.mc_flag==='socom'?C.p:C.t1,flex:1,fontSize:9}}>{f.mission_code||'—'}</span>
            <span style={{color:C.g,width:36}}>{f.destination}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{padding:'11px 13px',borderBottom:`1px solid ${C.br}`}}>
        <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:4}}>DESIGNATION</div>
        <div style={{...R,fontSize:17,fontWeight:700,color:C.tb,marginBottom:2}}>{asset.name}</div>
        <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub||asset.hull||''}</div>
      </div>
      <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
        {asset.type==='airbase'?(
          (() => {
            const icaoKey = (asset.icao||asset.id||'').toUpperCase()
            const outCnt = flights.filter(f=>f.base?.toUpperCase()===icaoKey).length
            const last7d = flights.filter(f=>f.destination?.toUpperCase()===icaoKey&&f.dep_date&&new Date(f.dep_date)>=new Date(Date.now()-7*864e5)).length
            return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                <SBox value={asset.arrCnt||0} label="ARRIVALS" color={C.a} />
                <SBox value={outCnt} label="DEPARTURES" color={C.b} />
                <SBox value={last7d||asset.arrCnt||0} label="LAST 7D" color={C.g} />
              </div>
            )
          })()
        ):(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            <SBox value={asset.status} label="STATUS" color={stCol} />
            {asset.type==='lmsr'
              ? <SBox value={asset.centcom||'—'} label="CENTCOM" color={asset.centcom==='CRITICAL'?C.r:asset.centcom==='HIGH'?C.a:C.t2} />
              : <SBox value={asset.csg||asset.hull||'—'} label={asset.csg?'CSG':'HULL'} color={C.b} />
            }
          </div>
        )}
      </div>
      {asset.notes&&<DBlk label="NOTES" value={asset.notes} />}
      {onReposition&&['carrier','destroyer','submarine','lmsr'].includes(asset.type)&&(
        <div style={{padding:'6px 13px',borderBottom:`1px solid ${C.br}`}}>
          <button onClick={()=>onReposition(asset)} style={{display:'block',width:'100%',padding:'7px',...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.a}44`,background:'rgba(240,160,64,.06)',color:C.a,cursor:'pointer',borderRadius:1}}>DRAG TO REPOSITION ON MAP</button>
        </div>
      )}
      {asset.type==='lmsr'&&asset.loc&&<DBlk label="POSITION" value={`${asset.loc}\nLast report: ${asset.lastRpt}`} />}

      {/* Aircraft on station — stationed only, no logistics, no departed */}
      {asset.aircraftTypes?.length>0&&asset.type!=='carrier'&&(
        <AircraftOnStation types={asset.aircraftTypes} />
      )}

      {asset.intel&&<DBlk label="INTEL ASSESSMENT" value={asset.intel} highlight />}

      {asset.escorts?.length>0&&<EscortList escorts={asset.escorts} />}

      {asset.type==='airbase'&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`,display:'flex',flexDirection:'column',gap:4}}>
          <button onClick={()=>navigate(`/airbase/${asset.id.toUpperCase()}`)} style={{display:'block',width:'100%',padding:6,...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.b}`,background:'rgba(80,160,232,.08)',color:C.b,cursor:'pointer'}}>→ FULL AIRBASE VIEW</button>
          <button onClick={onExpand} style={{display:'block',width:'100%',padding:6,...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.a}`,background:'rgba(240,160,64,.08)',color:C.a,cursor:'pointer'}}>▼ EXPAND DETAIL</button>
        </div>
      )}

      {/* Carrier AIR WING — squadrons */}
      {asset.squadrons?.length>0&&(
        <div style={{padding:'10px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>AIR WING — {asset.csg}</div>
          <div style={{display:'flex',flexDirection:'column',gap:3}}>
            {asset.squadrons.map((sq,i)=>{
              const parts=sq.match(/^(.+?)\s*\(([^)]+)\)$/)
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
                  <span style={{...R,fontSize:12,fontWeight:700,color:C.tb,flex:1}}>{parts?.[1]||sq}</span>
                  <span style={{...Z,fontSize:10,color:C.b}}>{parts?.[2]||''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {asset.type==='carrier'&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          {[{id:'cvn78',path:'cvn78'},{id:'cvn77',path:'cvn77'},{id:'cvn72',path:'cvn72'}].filter(c=>asset.id===c.id).map(c=>(
            <a key={c.id} href={`https://www.uscarriers.net/${c.path}history.htm`} target="_blank" rel="noopener noreferrer"
              style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1,textDecoration:'none'}}>
              <span style={{...Z,fontSize:9,color:C.b}}>↗</span>
              <span style={{...R,fontSize:11,fontWeight:600,color:C.tb}}>USCarriers.net — {asset.name}</span>
              <span style={{...Z,fontSize:8,color:C.t3,marginLeft:'auto'}}>DEPLOYMENT LOG</span>
            </a>
          ))}
        </div>
      )}

      {asset.tags?.length>0&&(
        <div style={{padding:'8px 13px',display:'flex',flexWrap:'wrap',gap:4}}>
          {asset.tags.map(t=><span key={t} style={{...Z,fontSize:9,padding:'2px 5px',borderRadius:1,background:'rgba(57,224,160,.08)',border:'1px solid rgba(57,224,160,.2)',color:C.g}}>{t}</span>)}
        </div>
      )}
    </div>
  )
}

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
      {cor.tags?.length>0&&<div style={{padding:'8px 13px',display:'flex',flexWrap:'wrap',gap:4}}>{cor.tags.map(t=><span key={t} style={{...Z,fontSize:9,padding:'2px 5px',borderRadius:1,background:'rgba(240,160,64,.1)',border:'1px solid rgba(240,160,64,.25)',color:C.a}}>{t}</span>)}</div>}
    </div>
  )
}

function EmptyDetail() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,color:C.t3,...Z,fontSize:11,letterSpacing:2,gap:10,textAlign:'center',padding:20}}>
      <div style={{fontSize:24,opacity:.2}}>◎</div>
      <div>SELECT ASSET</div>
      <div style={{fontSize:9,color:'#1a2a34'}}>HOVER COUNTRY TO NAVIGATE</div>
    </div>
  )
}

// ── AbmModal: expanded detail slide-up ───────────────────────
// AIRCRAFT tab shows: type + count + unit (from normalizeAircraft)
function AbmModal({asset,flights,onClose,navigate}) {
  const [tab,setTab] = useState('OVERVIEW')
  const icaoFromSub = asset.sub?.split('//')[0]?.trim().toUpperCase()
  const icaoFromId  = asset.id?.toUpperCase()
  const icaoCodes   = [...new Set([icaoFromSub,icaoFromId].filter(Boolean))]
  const inbound  = flights.filter(f=>icaoCodes.includes(f.destination?.toUpperCase()))
  const outbound = flights.filter(f=>icaoCodes.includes(f.base?.toUpperCase()))
  const socomIn  = inbound.filter(f=>f.mc_flag==='socom').length
  const tabs = ['OVERVIEW','ARRIVALS','DEPARTURES','AIRCRAFT','INTEL']

  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:4000,background:C.bg2,borderTop:`2px solid ${C.a}`,display:'flex',flexDirection:'column',maxHeight:'60vh',animation:'slideUp .28s ease'}}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div style={{display:'flex',alignItems:'stretch',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
        <div style={{padding:'9px 16px',flex:1}}>
          <div style={{...R,fontSize:19,fontWeight:700,color:C.tb}}>{asset.name}</div>
          <div style={{...Z,fontSize:10,color:C.t2}}>{asset.sub}</div>
        </div>
        {[{v:inbound.length,l:'INBOUND',c:C.a},{v:outbound.length,l:'OUTBOUND',c:C.b},{v:socomIn,l:'SOCOM',c:C.p}].map(({v,l,c})=>(
          <div key={l} style={{padding:'9px 16px',borderLeft:`1px solid ${C.br}`,textAlign:'center',minWidth:70}}>
            <div style={{...R,fontSize:20,fontWeight:700,color:c,marginBottom:1}}>{v}</div>
            <div style={{...Z,fontSize:9,color:C.t2,letterSpacing:1}}>{l}</div>
          </div>
        ))}
        <button onClick={()=>navigate(`/airbase/${asset.id.toUpperCase()}`)} style={{padding:'0 16px',borderLeft:`1px solid ${C.br}`,background:'rgba(80,160,232,.08)',color:C.b,cursor:'pointer',...R,fontSize:11,fontWeight:600,letterSpacing:1}}>→ FULL PAGE</button>
        <div onClick={onClose} style={{width:48,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:C.t2,cursor:'pointer',borderLeft:`1px solid ${C.br}`}}>✕</div>
      </div>
      <div style={{display:'flex',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0,overflowX:'auto'}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'8px 14px',cursor:'pointer',color:tab===t?C.a:C.t2,background:'none',border:'none',borderBottom:`2px solid ${tab===t?C.a:'transparent'}`,whiteSpace:'nowrap'}}>{t}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {tab==='OVERVIEW'&&(
          <div style={{padding:'14px 18px'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              <SBox value={inbound.length} label="INBOUND" color={C.a} />
              <SBox value={outbound.length} label="OUTBOUND" color={C.b} />
              <SBox value={socomIn} label="SOCOM" color={C.p} />
            </div>
            {asset.intel&&<DBlk label="INTEL ASSESSMENT" value={asset.intel} highlight />}
            {asset.notes&&<DBlk label="NOTES" value={asset.notes} />}
          </div>
        )}
        {(tab==='ARRIVALS'||tab==='DEPARTURES')&&(
          <FlightTable flights={tab==='ARRIVALS'?inbound:outbound} label={tab.toLowerCase()} />
        )}
        {tab==='AIRCRAFT'&&<ModalAircraftTab types={asset.aircraftTypes} squadrons={asset.squadrons} csg={asset.csg} />}
        {tab==='INTEL'&&<div style={{padding:'14px 18px',...Z,fontSize:10,color:C.t1,lineHeight:1.8}}>{asset.intel||'No intel assessment on file.'}</div>}
      </div>
    </div>
  )
}

// ── ModalAircraftTab ──────────────────────────────────────────
// Expanded modal AIRCRAFT tab: type + count + unit
// Same normalizeAircraft pipeline — API-feed ready
function ModalAircraftTab({ types, squadrons, csg }) {
  const [openSet, setOpenSet] = useState(new Set())
  function toggleOpen(i) { setOpenSet(prev => { const s=new Set(prev); s.has(i)?s.delete(i):s.add(i); return s }) }

  const hasAircraft = types?.length || squadrons?.length

  if (!hasAircraft) return (
    <div style={{padding:20,...Z,fontSize:10,color:C.t3}}>No aircraft data on file.</div>
  )

  // Carrier squadrons
  if (squadrons?.length) return (
    <div style={{padding:'14px 18px'}}>
      <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:10}}>AIR WING — {csg}</div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        {squadrons.map((sq,i)=>{
          const parts=sq.match(/^(.+?)\s*\(([^)]+)\)$/)
          return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:C.bg3,border:`1px solid ${C.br}`,borderRadius:1}}>
              <span style={{...R,fontSize:13,fontWeight:700,color:C.tb,minWidth:90}}>{parts?.[1]||sq}</span>
              <span style={{...Z,fontSize:10,color:C.b}}>{parts?.[2]||''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Airbase stationed aircraft
  const normalised = (types||[]).map(normalizeAircraft).filter(ac=>ac&&!ac.isLogistics)

  return (
    <div style={{padding:'14px 18px'}}>
      <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:10}}>AIRCRAFT ON STATION</div>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {normalised.map((ac,i)=>{
          const isOpen = openSet.has(i)
          const statusCol = ac.status==='DEPARTED'?C.t3:ac.status==='SURGE'?C.r:ac.status==='ASSESSED'?C.t2:C.tb
          return (
            <div key={i}>
              <div onClick={()=>toggleOpen(i)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                  background:isOpen?'rgba(80,160,232,.06)':C.bg3,
                  border:`1px solid ${isOpen?C.b:C.br}`,borderRadius:1,
                  cursor:ac.tails?.length?'pointer':'default'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{...R,fontSize:13,fontWeight:700,color:statusCol,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ac.type}</div>
                  <div style={{...Z,fontSize:9,color:C.t2,marginTop:1}}>{ac.unit}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  {ac.displayCount&&<div style={{...Z,fontSize:15,fontWeight:700,color:C.tb,lineHeight:1}}>{ac.displayCount}</div>}
                  {ac.status!=='DEPLOYED'&&<div style={{...Z,fontSize:8,color:statusCol,marginTop:1,letterSpacing:1}}>{ac.status}</div>}
                  {ac.tails?.length>0&&<div style={{...Z,fontSize:8,color:C.t3,marginTop:1}}>{isOpen?'▲ hide':'▼ tails'}</div>}
                </div>
              </div>
              {isOpen&&ac.tails?.length>0&&(
                <div style={{padding:'8px 12px',background:'rgba(0,0,0,.15)',border:`1px solid ${C.b}33`,borderTop:'none',borderRadius:'0 0 1px 1px'}}>
                  <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:6}}>TAIL NUMBERS / CALLSIGNS</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {ac.tails.map((t,j)=>(
                      <span key={j} style={{...Z,fontSize:8,padding:'2px 5px',background:'rgba(80,160,232,.1)',border:'1px solid rgba(80,160,232,.25)',color:C.b,borderRadius:1}}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EscortList({escorts}) {
  const [sel, setSel] = useState(null)
  return (
    <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
      <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>BATTLE GROUP</div>
      {escorts.map((e,i)=>{
        const isSel=sel===i
        return (
          <div key={i}>
            <div onClick={()=>setSel(isSel?null:i)}
              style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',marginBottom:2,
                background:isSel?'rgba(80,160,232,.08)':C.bg3,border:`1px solid ${isSel?C.b:C.br}`,borderRadius:1,cursor:'pointer'}}>
              <div style={{flex:1}}>
                <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{e.name}</div>
                <div style={{...Z,fontSize:9,color:C.t2}}>{e.sub}</div>
              </div>
              <span style={{...Z,fontSize:9,color:C.t3}}>{e.role}</span>
              <span style={{...Z,fontSize:9,color:isSel?C.b:C.t3}}>{isSel?'▲':'▼'}</span>
            </div>
            {isSel&&(
              <div style={{padding:'10px 12px',background:'rgba(80,160,232,.04)',border:`1px solid ${C.b}44`,borderTop:'none',borderRadius:'0 0 1px 1px',marginBottom:4}}>
                <div style={{display:'flex',gap:6}}>
                  <a href={`https://www.navsource.org/archives/05/${(e.sub||'').replace('DDG-','')}.htm`} target="_blank" rel="noopener noreferrer" style={{...Z,fontSize:9,color:C.b,padding:'3px 8px',border:`1px solid ${C.b}44`,borderRadius:1,textDecoration:'none'}}>↗ NavSource</a>
                  <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(e.name)}`} target="_blank" rel="noopener noreferrer" style={{...Z,fontSize:9,color:C.t2,padding:'3px 8px',border:`1px solid ${C.br}`,borderRadius:1,textDecoration:'none'}}>↗ Wikipedia</a>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SigactPanel({feeds,selAsset}) {
  const [open,setOpen] = useState(false)
  const items = feeds.length>0?feeds.map(f=>({t:'LIVE',h:f.content_html,id:f.id})):FEED_ITEMS
  const filtered = selAsset ? items.filter(f=>{
    const txt=(f.h||'').toLowerCase()
    return txt.includes((selAsset.name||'').toLowerCase().split(' ').pop()) || txt.includes((selAsset.sub||'').toLowerCase().split('//')[0].trim())
  }) : items
  const showItems = filtered.length>0?filtered:items.slice(0,3)
  return (
    <div style={{borderTop:`1px solid ${C.br}`,background:C.bg,flexShrink:0,display:'flex',flexDirection:'column',maxHeight:open?200:32,transition:'max-height .25s ease',overflow:'hidden'}}>
      <div onClick={()=>setOpen(v=>!v)} style={{padding:'5px 12px',background:C.bg4,borderBottom:open?`1px solid ${C.br}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,cursor:'pointer',userSelect:'none'}}>
        <span style={{...R,fontSize:10,fontWeight:600,letterSpacing:3,color:C.t2}}>
          SIGACT FEED {selAsset&&<span style={{color:C.a,fontSize:8,letterSpacing:1}}>· {selAsset.name.split(' ').slice(-1)[0].toUpperCase()}</span>}
        </span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{...Z,fontSize:9,color:C.g}}>● LIVE</span>
          <span style={{...Z,fontSize:9,color:C.t3}}>{open?'▼':'▲'}</span>
        </div>
      </div>
      {open&&(
        <div style={{overflowY:'auto',flex:1}}>
          {showItems.map((f,i)=>(
            <div key={f.id||i} style={{display:'flex',gap:8,padding:'5px 12px',borderBottom:`1px solid rgba(30,44,58,.4)`,fontSize:11}}>
              <span style={{...Z,fontSize:9,color:C.t3,width:36,flexShrink:0,paddingTop:1}}>{f.t}</span>
              <span style={{color:C.t2,flex:1,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:f.h}} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function normCallsign(cs) {
  if(!cs) return '—'
  return cs.replace(/^REACH\s*/i,'RCH').toUpperCase()
}

function FlightTable({flights,label}) {
  if(!flights.length) return <div style={{padding:20,...Z,fontSize:10,color:C.t3}}>No {label} flight records matched.</div>
  return (
    <div>
      <div style={{padding:'6px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2}}>{flights.length} {label} tracked</div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:700}}>
          <thead>
            <tr style={{background:C.bg4,position:'sticky',top:0}}>
              {['DATE','CALLSIGN','HEX','SERIAL','MISSION CODE','ORIGIN','TYPE','VIA','STATUS'].map(h=>(
                <th key={h} style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,padding:'6px 9px',borderBottom:`1px solid ${C.br}`,textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flights.map(f=>{
              const isSocom=f.mc_flag==='socom'
              const isArmy=f.mc_flag==='amc'&&f.notes?.toLowerCase().includes('army')
              return (
                <tr key={f.id} style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
                  <td style={{padding:'5px 9px',...Z,color:C.t3,fontSize:10,whiteSpace:'nowrap'}}>{f.dep_date?.slice(5)||'—'}</td>
                  <td style={{padding:'5px 9px',...R,fontWeight:700,color:C.tb,fontSize:12,whiteSpace:'nowrap'}}>{normCallsign(f.callsign)}</td>
                  <td style={{padding:'5px 9px',...Z,color:C.y,fontSize:10}}>{f.hex||'—'}</td>
                  <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.serial||'—'}</td>
                  <td style={{padding:'5px 9px',...Z,fontSize:10,color:C.t1,whiteSpace:'nowrap'}}>{f.mission_code||'—'}</td>
                  <td style={{padding:'5px 9px',...Z,color:C.b,fontSize:10}}>{f.base||'—'}</td>
                  <td style={{padding:'5px 9px'}}>
                    <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:1,
                      background:isSocom?'rgba(160,96,232,.15)':isArmy?'rgba(232,208,64,.1)':'rgba(80,160,232,.12)',
                      border:`1px solid ${isSocom?'rgba(160,96,232,.4)':isArmy?'rgba(232,208,64,.3)':'rgba(80,160,232,.3)'}`,
                      color:isSocom?C.p:isArmy?C.y:C.b}}>
                      {isSocom?'SOCOM':isArmy?'ARMY':'AMC'}
                    </span>
                  </td>
                  <td style={{padding:'5px 9px',...Z,color:C.t2,fontSize:10}}>{f.via||f.first_hop||'—'}</td>
                  <td style={{padding:'5px 9px',...R,fontSize:10,color:{ACTIVE:C.g,COMPLETE:C.t3,PENDING:C.a}[f.status]||C.t2,whiteSpace:'nowrap'}}>{f.status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
