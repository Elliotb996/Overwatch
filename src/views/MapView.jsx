import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useFlights } from '../hooks/useFlights'
import { useAssets } from '../hooks/useAssets'
import { supabase } from '../lib/supabase'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{background:'#07090b',color:'#e85040',padding:40,fontFamily:'monospace',height:'100%',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:14,fontWeight:700,letterSpacing:2}}>⚠ RENDER ERROR — MAP VIEW</div>
        <div style={{fontSize:11,color:'#b8ccd8'}}>{this.state.error.message}</div>
        <div style={{fontSize:10,color:'#4a6070',marginTop:8}}>Open browser console (F12) for full stack trace.</div>
        <button onClick={()=>this.setState({error:null})} 
          style={{marginTop:16,padding:'8px 24px',background:'transparent',border:'1px solid #39e0a0',color:'#39e0a0',cursor:'pointer',fontFamily:'monospace',fontSize:12}}>
          RETRY
        </button>
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

function mkIcon(emoji, color, size=26, pulse=false, badge=null) {
  const rip = pulse ? `<div style="position:absolute;inset:-5px;border:1.5px solid ${color};border-radius:2px;opacity:.35;animation:rp 2.2s infinite"></div>` : ''
  const bdg = badge ? `<div style="position:absolute;top:-7px;right:-9px;background:#e85040;color:#07090b;font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;min-width:14px;text-align:center;line-height:13px">${badge}</div>` : ''
  const s = size + 14
  return L.divIcon({
    html:`<div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center">${rip}<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(7,9,11,.88);border:1.5px solid ${color};border-radius:2px;font-size:${Math.round(size*.5)}px;box-shadow:0 0 10px ${color}44;z-index:1">${emoji}</div>${bdg}</div><style>@keyframes rp{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.4);opacity:0}100%{opacity:0}}</style>`,
    className:'', iconSize:[s,s], iconAnchor:[s/2,s/2],
  })
}

const VIEWS = {
  WORLD:{center:[28,22],zoom:3}, MED:{center:[37,22],zoom:5},
  GULF:{center:[26,52],zoom:5}, ATLANTIC:{center:[44,-30],zoom:4}, INDOPACOM:{center:[20,120],zoom:4},
}

const ICAO_COORDS = {
  KSVN:[32.015,-81.145], KPOB:[35.171,-79.014], KHOP:[36.669,-87.496],
  KGRF:[47.079,-122.580], KTCM:[47.138,-122.476], KNTU:[36.937,-76.036],
  KHRT:[30.428,-86.690], KMCF:[27.849,-82.521], KNKX:[32.868,-117.143],
  KDOV:[39.130,-75.466], KSUU:[38.263,-121.927], KWRI:[40.017,-74.593],
  KMDT:[40.193,-76.763], KGSB:[35.339,-77.961], KCHS:[32.899,-80.041],
  KBOI:[43.564,-116.222], KGRK:[31.067,-97.829], KSSC:[33.972,-80.471],
  KWRB:[32.640,-83.591], KSKA:[47.615,-117.656], KCVS:[34.668,-99.267],
  FJDG:[-7.313,72.411], KMTC:[42.611,-83.150], KLSF:[32.337,-84.991],
  LLOV:[29.940,34.935], LLNV:[31.208,35.012], LLBG:[31.994,34.888],
  OJKA:[32.356,36.259], OJMS:[31.827,36.789], OKAS:[29.346,47.519],
  OMDM:[25.027,55.366], OMAM:[24.249,54.548], OTBH:[25.117,51.314],
  OEPS:[24.062,47.580], ETAR:[49.437,7.600], ETAD:[49.972,6.693],
  LGEL:[38.065,23.556], LGSA:[35.531,24.147], LCRT:[46.125,23.886],
  LIPA:[46.031,12.596], LTAG:[37.002,35.426], EGVA:[51.682,-1.790],
  EGUL:[52.409,0.560], EGUN:[52.362,0.486],
  KBHM:[33.563,-86.756], KNXX:[40.199,-75.148], KCOS:[38.806,-104.701],
  RJTY:[35.748,139.348], RJSM:[40.703,141.368],
  CYQX:[48.936,-54.568], CYYR:[53.303,-60.426], KPSM:[43.078,-70.823],
}

const STATIC_ASSETS = [
  {id:'cvn78',name:'USS Gerald R. Ford',sub:'CVN-78 // Ford-class',country:'US',type:'carrier',status:'DEPLOYED',lat:43.5,lng:16.5,csg:'CSG-12',
   aircraftTypes:[{type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},{type:'EA-18G Growler',qty:'5x',role:'EW'},{type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'},{type:'MH-60R Seahawk',qty:'8x',role:'ASW/SAR'}],
   notes:'Adriatic/Split Croatia area 28 Mar. EUCOM/CENTCOM direction.',tags:['ADRIATIC','CENTCOM-BOUND']},
  {id:'cvn72',name:'USS Abraham Lincoln',sub:'CVN-72 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:16.0,lng:54.0,csg:'CSG-3',
   aircraftTypes:[{type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},{type:'EA-18G Growler',qty:'5x',role:'EW'},{type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'}],
   notes:'5th Fleet / Arabian Sea. Houthi suppression. Tomahawk employment confirmed.',tags:['5TH-FLEET','ARABIAN-SEA']},
  {id:'cvn77',name:'USS George H.W. Bush',sub:'CVN-77 // Nimitz-class',country:'US',type:'carrier',status:'DEPLOYED',lat:36.0,lng:-12.0,csg:'CSG-10',
   notes:'DEPLOYED 31 Mar. Atlantic transit, EUCOM/CENTCOM direction.',tags:['ATLANTIC','EUCOM-BOUND']},
  {id:'r08',name:'HMS Queen Elizabeth',sub:'R08 // QE-class',country:'UK',type:'carrier',status:'REFIT',lat:56.0,lng:-3.4,csg:'CSG21',
   notes:'Refit Rosyth 482 days. POW also maintenance Portsmouth.',tags:['REFIT','ROSYTH']},
  {id:'r91',name:'Charles de Gaulle',sub:'R91 // CdG-class',country:'FR',type:'carrier',status:'DEPLOYED',lat:34.0,lng:28.0,csg:'TF-473',
   notes:'Eastern Med. TF-473. Active strike role.',tags:['EASTMED','TF-473']},
  {id:'ddg51',name:'USS Arleigh Burke',sub:'DDG-51 // Burke Flt I',country:'US',type:'destroyer',status:'DEPLOYED',lat:33.0,lng:32.0,tags:['EASTMED']},
  {id:'ddg125',name:'USS Jack H. Lucas',sub:'DDG-125 // Burke Flt III',country:'US',type:'destroyer',status:'DEPLOYED',lat:22.0,lng:58.0,tags:['5TH-FLEET']},
  {id:'d34',name:'HMS Diamond',sub:'D34 // Type 45',country:'UK',type:'destroyer',status:'DEPLOYED',lat:35.0,lng:33.0,tags:['MED']},
  {id:'ssn795',name:'USS H.G. Rickover',sub:'SSN-795 // Virginia Blk V',country:'US',type:'submarine',status:'DEPLOYED',lat:33.5,lng:26.0,tags:['ASSESSED','VPM']},
  {id:'anson',name:'HMS Anson',sub:'S123 // Astute-class',country:'UK',type:'submarine',status:'DEPLOYED',lat:-30.0,lng:78.0,tags:['AUKUS']},
  {id:'otbh',name:'Al Udeid AB',sub:'OTBH // Qatar',country:'US',type:'airbase',status:'SURGE',lat:25.117,lng:51.314,arrCnt:14,socomCnt:4,
   aircraftTypes:[{type:'B-52H Stratofortress',qty:'2x (surged)',role:'Strategic Bomber',tails:['60-0040','60-0047']},{type:'F-35A Lightning II',qty:'12x',role:'Strike'},{type:'F-15E Strike Eagle',qty:'8x',role:'Strike'},{type:'KC-46A Pegasus',qty:'4x',role:'Tanker'},{type:'E-3 AWACS',qty:'2x',role:'AEW&C'},{type:'RQ-4 Global Hawk',qty:'1x',role:'ISR'}],
   intel:'14 AMC arrivals / 48h vs baseline ~6. Y-series SOCOM missions = 4 of 14. Surge status sustained.',tags:['SURGE','CENTCOM','OP-EPIC-FURY']},
  {id:'llov',name:'Ovda AB',sub:'LLOV // Israel',country:'US',type:'airbase',status:'ELEVATED',lat:29.94,lng:34.935,arrCnt:26,socomCnt:12,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'26+ arrivals tracked',role:'Strategic Airlift',tails:['00-0181','07-7178','02-1110','99-0059','05-5140','08-8195','07-7174','00-0177','06-6159','08-8190']}],
   intel:'26 confirmed arrivals. KPOB/KSVN/KNTU dominant origins. All SOCOM flagged. Strategic reserve pre-positioning assessed.',tags:['SURGE','IDF','CENTCOM']},
  {id:'ojka',name:'King Abdullah II AB',sub:'OJKA // Jordan',country:'US',type:'airbase',status:'ELEVATED',lat:32.356,lng:36.259,arrCnt:30,socomCnt:12,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'30+ arrivals',role:'SAAM/SOCOM/Army',tails:['07-7182','06-6163','03-3126','04-4130','01-0189','08-8198','05-5142','01-0186','09-9210','92-3292','00-0183','04-4133','04-4130']}],
   intel:'Highest single-destination volume. Extensive onward movement to OJAQ and OJMS.',tags:['JORDAN','HIGHEST-VOLUME']},
  {id:'ojms',name:'Muwaffaq Salti AB',sub:'OJMS // Jordan (Azraq)',country:'US',type:'airbase',status:'ELEVATED',lat:31.827,lng:36.789,arrCnt:19,socomCnt:0,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'19+ tracked arrivals',role:'Strategic Airlift',tails:['04-4131','92-3294','94-0067','98-0056','08-8200','98-0053','93-0604','07-7182','03-3126','00-0181','98-0052','89-1191']}],
   intel:'Low-visibility base. Arrivals from FJDG (Diego Garcia), KMTC (Selfridge), KWRI, KCHS.',tags:['JORDAN','FINAL-DEST','LOW-VISIBILITY']},
  {id:'okas',name:'Ali Al Salem AB',sub:'OKAS // Kuwait',country:'US',type:'airbase',status:'ELEVATED',lat:29.346,lng:47.519,arrCnt:10,socomCnt:2,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'10+ tracked',role:'Army/SOCOM Airlift',tails:['02-1098','98-0051','04-4133','96-0006','10-0218','07-7186','93-0601','02-1111','06-6166','95-0104']},{type:'C-130J / MC-130J',qty:'assessed',role:'Tactical/SOCOM'}],
   intel:'Army-Z mission series (A177/A179/A182) via Spangdahlem (ETAD).',tags:['KUWAIT','ARMY-Z']},
  {id:'oeps',name:'Prince Sultan AB',sub:'OEPS // Saudi Arabia',country:'US',type:'airbase',status:'ELEVATED',lat:24.062,lng:47.580,arrCnt:16,socomCnt:0,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'14x C-17 tracked',role:'Strategic Airlift'},{type:'C-5M Super Galaxy',qty:'4x',role:'Strategic Airlift'}],
   intel:'Major build-up via Diego Garcia (FJDG->OEPS direct).',tags:['KSA','BUILD-UP']},
  {id:'llnv',name:'Nevatim AB',sub:'LLNV // Israel',country:'US',type:'airbase',status:'ELEVATED',lat:31.208,lng:35.012,arrCnt:4,socomCnt:0,
   aircraftTypes:[{type:'C-17A Globemaster III',qty:'4 confirmed arrivals',role:'Strategic Airlift',tails:['05-5141','97-0042','08-8201','05-5149']}],
   intel:'Second Israeli staging base identified.',tags:['ISRAEL','NEW-DEST','EMERGING']},
  {id:'llbg',name:'Ben Gurion Airport',sub:'LLBG // Israel (Civil/Dual-use)',country:'US',type:'airbase',status:'ACTIVE',lat:31.994,lng:34.888,arrCnt:6,socomCnt:0,
   intel:'Civil dual-use airport receiving USAF C-17 traffic.',tags:['ISRAEL','DUAL-USE']},
  {id:'lgel',name:'Elefsis AB',sub:'LGEL // Greece',country:'US',type:'airbase',status:'ELEVATED',lat:38.065,lng:23.556,arrCnt:5,socomCnt:3,
   intel:'Emerged late March. KPOB (Pope) and KMDT (Harrisburg ANG) dominant.',tags:['GREECE','NATO','SAAM']},
  {id:'lgsa',name:'Souda Bay / Chania',sub:'LGSA // Crete, Greece',country:'US',type:'airbase',status:'ACTIVE',lat:35.531,lng:24.147,arrCnt:4,socomCnt:0,
   aircraftTypes:[{type:'EA-37B Compass Call',qty:'2x (AXIS 41/43)',role:'EW — departed to Souda 2 Apr'}],
   intel:'Staging for Eastern Med Navy operations.',tags:['CRETE','NATO','EW']},
  {id:'etar',name:'Ramstein AB',sub:'ETAR // Germany',country:'US',type:'airbase',status:'ACTIVE',lat:49.437,lng:7.600,arrCnt:5,socomCnt:0,
   intel:'Universal CONUS→CENTCOM gateway. Every tracked mission transits ETAR.',tags:['EUCOM','STAGING','GATEWAY']},
  {id:'egva',name:'RAF Fairford',sub:'EGVA // UK — USAF BOMBER HUB',country:'US',type:'airbase',status:'SURGE',lat:51.682,lng:-1.790,arrCnt:0,socomCnt:0,
   aircraftTypes:[
     {type:'B-52H Stratofortress',qty:'8x',role:'Strategic Bomber — Op EPIC FURY',tails:['61-0001 (FLIP 61 "Freedom Bird")','61-0035 (FLIP 62 "Witch\'s Brew")','60-0012 (FLIP 63 "Heavy Hauler")','60-0007 (HOOKY 23 "Guardians")','60-0060 (HOOKY 22 "Iron Butterfly")','60-0023 (HOOKY 21 "Bomber Barons")']},
     {type:'B-1B Lancer',qty:'18x+',role:'Strategic Bomber — Op EPIC FURY',tails:['86-0129 (TWIN 44 "Black Widow")','86-0102 (TWIN 43 "Bad Moon Rising")','85-0072 (TWIN 42 "Polarized")','86-0138 (TWIN 41 "Seek & Destroy")','86-0107 (MOLT 13 "Dragon Slayer")','85-0088 (MOLT 12)','85-0064 (MOLT 11 "Valkyrie")','86-0140 (MOLT 14 "Last Lance")','86-0139 (PIKE 74 "Drifter")','86-0108 (PIKE 73 "Alien")','86-0121 (PIKE 72)','85-0060 (PURSE 33)','86-0134 (PURSE 34 "Thunderbird")','85-0069 (PURSE 35 "Avenger")']},
   ],
   intel:'CONFIRMED: 8x B-52H + 18+ B-1B as of 28 Mar 2026. Largest US forward bomber deployment since Gulf War.',tags:['SURGE','B-52H','B-1B','OP-EPIC-FURY']},
  {id:'egun',name:'RAF Mildenhall',sub:'EGUN // UK — SOCOM/AFSOC HUB',country:'US',type:'airbase',status:'SURGE',lat:52.362,lng:0.486,arrCnt:41,socomCnt:41,
   aircraftTypes:[
     {type:'MC-130J Commando II',qty:'41+ staged (11x Silent Knight)',role:'SOCOM Assault/Infiltration',tails:['14-5805 (UNLIT 77/BZAIN 31)','BLATE 83-99 series (9x)','AGREE 08/33/35/41/43/45 series','PILUM 41-55 series','SWASH 03-09 series','DACHA 11-13','LAPEL 23-27']},
     {type:'AC-130 Spectre/Spooky',qty:'3x',role:'Gunship — RAF Lakenheath',tails:['HEEL 51','HEEL 53','HEEL 55']},
     {type:'EA-37B Compass Call',qty:'2x (departed)',role:'EW — departed to Souda Bay 2 Apr',tails:['AE17CD 19-1587 (AXIS 41)','AE142E 17-5579 (AXIS 43)']},
   ],
   intel:'41+ MC-130J staged through since 3 Mar.',tags:['SURGE','MC-130J','SILENT-KNIGHT','AFSOC','OP-EPIC-FURY']},
  {id:'fjdg',name:'Diego Garcia NSF',sub:'FJDG // British Indian Ocean Territory',country:'US',type:'airbase',status:'ACTIVE',lat:-7.3132,lng:72.4108,arrCnt:0,socomCnt:0,
   intel:'Major pre-positioning hub.',tags:['CENTCOM','PRE-POSITION','DIEGO-GARCIA']},
  {id:'etad',name:'Spangdahlem AB',sub:'ETAD // Germany',country:'US',type:'airbase',status:'ACTIVE',lat:49.972,lng:6.693,arrCnt:0,socomCnt:0,
   intel:'Army-Z mission staging node.',tags:['EUCOM','ARMY-Z','STAGING']},
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
  {id:'cor051',callsign:'CORONET EAST 051',status:'COMPLETE',acType:'F-22A',quantity:'6x',unit:'1st FW, Langley AFB',from:'KLFI',to:'EGUL',tanker:'2× KC-46 GOLD 51/52, Pittsburgh ARB',notes:'F-22A to Lakenheath. Complete 28 Mar.',tags:['F-22A','LAKENHEATH']},
  {id:'cor062',callsign:'CORONET EAST 062/032',status:'COMPLETE',acType:'A-10C',quantity:'6x+6x',unit:'190th/107th FS — Boise ANGB',from:'KBOI',to:'EGUL',tanker:'BORA 43/44, TABOR 91-96',notes:'A-10C to Lakenheath. Complete 31 Mar.',tags:['A-10C','LAKENHEATH','ANG']},
  {id:'cor042',callsign:'CORONET WEST 042',status:'IN TRANSIT',acType:'F-15E',quantity:'4x',unit:'Strike Eagle det — Seymour Johnson',from:'KGSB',to:'EGUL',tanker:'HOBO 22/23 tankers 37N/15E',notes:'In transit. HOBO tanker confirmed.',tags:['F-15E','IN-TRANSIT']},
]

const CONUS_META = {
  KSVN:{name:'Hunter AAF',unit:'3rd SF Group / USASOC',region:'Savannah, GA'},
  KPOB:{name:'Pope Field',unit:'82nd Airborne / JSOC',region:'Fort Bragg, NC'},
  KHOP:{name:'Campbell AAF',unit:'101st Airborne / 160th SOAR',region:'Fort Campbell, KY'},
  KGRF:{name:'Gray AAF (JBLM)',unit:'I Corps / 2nd SFOD',region:'Tacoma, WA'},
  KTCM:{name:'McChord AFB',unit:'62nd Airlift Wing (AMC)',region:'JBLM, WA'},
  KNTU:{name:'NAS Oceana',unit:'SEAL Team area / NAVSOC',region:'Virginia Beach, VA'},
  KHRT:{name:'Hurlburt Field',unit:'1st SOW / AFSOC HQ',region:'Fort Walton Beach, FL'},
  KMCF:{name:'MacDill AFB',unit:'USSOCOM HQ / CENTCOM HQ',region:'Tampa, FL'},
  KNKX:{name:'MCAS Miramar',unit:'USMC Aviation',region:'San Diego, CA'},
  KMDT:{name:'Middletown PANG',unit:'193rd SOW (ANG)',region:'Harrisburg, PA'},
  KWRI:{name:'McGuire AFB',unit:'305th AMW (AMC)',region:'NJ'},
  KGSB:{name:'Seymour Johnson AFB',unit:'4th FW — F-15E',region:'Goldsboro, NC'},
  KLSF:{name:'Lawson AAF',unit:'Fort Moore / 1st Cavalry area',region:'Fort Moore, GA'},
  KCHS:{name:'Charleston AFB',unit:'437th AW — C-17',region:'Charleston, SC'},
  KBHM:{name:'Birmingham ANGB',unit:'117th ARW — KC-135',region:'Birmingham, AL'},
  KBOI:{name:'Gowen Field ANGB',unit:'124th FW — A-10C',region:'Boise, ID'},
  KCVS:{name:'Altus AFB',unit:'97th AMW (AETC) — KC-46',region:'Altus, OK'},
  KNXX:{name:'NAS Willow Grove (NASJRB)',unit:'Naval Reserve / P-8 det',region:'Willow Grove, PA'},
  KCOS:{name:'Peterson SFB',unit:'Space Command / 21st SW',region:'Colorado Springs, CO'},
  KSSC:{name:'Shaw AFB',unit:'20th FW — F-16C',region:'Sumter, SC'},
  KWRB:{name:'Robins AFB',unit:'78th ABW / WR-ALC',region:'Warner Robins, GA'},
  KSKA:{name:'Fairchild AFB',unit:'92nd ARW — KC-135/KC-46',region:'Spokane, WA'},
  KGRK:{name:'Gray AAF / Fort Cavazos',unit:'III Corps / 1st Cavalry Division',region:'Killeen, TX'},
  KDOV:{name:'Dover AFB',unit:'436th AW — C-17/C-5',region:'Dover, DE'},
  KSUU:{name:'Travis AFB',unit:'60th AMW — C-17/C-5',region:'Fairfield, CA'},
}

const FEED_ITEMS = [
  {t:'0904Z',h:'<b>Op EPIC FURY</b> <span style="color:#e85040">●</span> CENTCOM: 8000+ targets struck Iran. 120+ vessels sunk.'},
  {t:'0847Z',h:'<b>EGUN</b> EA-37B AXIS 41/43 departed Mildenhall → <b>LGSA (Souda Bay)</b>. EW forward deployment.'},
  {t:'0821Z',h:'<b>OJMS</b> <span style="color:#e85040">▲</span> Muwaffaq Salti AB now 19+ confirmed C-17 arrivals. FJDG->HDAM->OJMS routing confirmed.'},
  {t:'0754Z',h:'<b>EGUN</b> 41+ MC-130J staged through. 11x Silent Knight mod.'},
  {t:'0712Z',h:'<b>LMSR Pililaau</b> <span style="color:#e85040">●</span> Diego Garcia — departure IMMINENT.'},
  {t:'0633Z',h:'<b>LLNV</b> (Nevatim AB) NEW destination. 4x C-17 arrivals.'},
]

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => { if(target) map.flyTo(target.center, target.zoom, {duration:1.2}) }, [target])
  return null
}

export function MapView({ auth }) {
  const { flights, byBase, byDest, loading } = useFlights({ limit: 2000 })
  const { assets: dbAssets, loading: assetsLoading } = useAssets()

  // MAPPING LOGIC: Fixes the missing aircraft bug!
  const allDbAssets = dbAssets.length > 0 ? dbAssets.map(a => {
    // 1. Try to find a match in our static library to pull the rich aircraft data
    const staticMatch = STATIC_ASSETS.find(s => 
      (a.icao_code && s.id.toLowerCase() === a.icao_code.toLowerCase()) || 
      (a.name && s.name.toLowerCase() === a.name?.toLowerCase()) ||
      (a.designation && s.sub === a.designation)
    )

    // 2. Fallback to any custom strings you type into the Admin Panel
    let dbAc = []
    if (Array.isArray(a.aircraft_types) && a.aircraft_types.length > 0) {
      if (typeof a.aircraft_types[0] === 'object') {
        dbAc = a.aircraft_types
      } else {
        dbAc = a.aircraft_types.map(t => ({ type: t, qty: 'Present', role: 'Logged Asset' }))
      }
    }

    return {
      id: a.icao_code?.toLowerCase() || a.id,
      name: a.name,
      sub: a.designation,
      country: a.country?.trim(),
      type: a.asset_type,
      status: a.status,
      lat: a.lat != null ? parseFloat(a.lat) : null,
      lng: a.lng != null ? parseFloat(a.lng) : null,
      arrCnt: a.arr_count || 0,
      socomCnt: a.socom_count || 0,
      hull: a.hull_number,
      csg: a.csg_designation,
      intel: a.intel_assessment,
      notes: a.notes,
      loc: a.last_location,
      lastRpt: a.last_report_date,
      centcom: a.centcom_relevance,
      cat: a.lmsr_category || (a.asset_type === 'lmsr' ? 'forward' : null),
      tags: a.tags || [],
      // Use the rich static data if matched, otherwise use the admin panel strings!
      aircraftTypes: staticMatch?.aircraftTypes?.length > 0 ? staticMatch.aircraftTypes : dbAc,
    }
  }) : STATIC_ASSETS

  const [layers, setLayers] = useState({ carriers:true, destroyers:true, subs:true, lmsr:true, airbases:true, conus:true, strikes:true })
  const [country, setCountry]   = useState('ALL')
  const [selAsset, setSelAsset] = useState(null)
  const [selCor, setSelCor]     = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [abmAsset, setAbmAsset] = useState(null)
  const [liveFeeds, setLiveFeeds] = useState([])
  const [showRoutes, setShowRoutes] = useState(false)

  useEffect(() => {
    supabase.from('sigact_feed').select('*').order('created_at',{ascending:false}).limit(15)
      .then(({data}) => setLiveFeeds(data||[]))
    const ch = supabase.channel('feed_live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'sigact_feed'},
        p => setLiveFeeds(prev => [p.new,...prev].slice(0,15)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const allAssets = allDbAssets
  const filtered  = allAssets.filter(a => country==='ALL' || a.country?.trim()===country || a.type==='lmsr')

  function selectAsset(a) { setSelAsset(a); setSelCor(null); if(a.lat&&a.lng) setFlyTarget({center:[a.lat,a.lng],zoom:6}) }
  function selectCoronet(c) { setSelCor(selCor?.id===c.id?null:c); setSelAsset(null) }

  const naval    = filtered.filter(a=>['carrier','destroyer','submarine'].includes(a.type)).length
  const bases    = filtered.filter(a=>a.type==='airbase').length
  const socomCnt = flights.filter(f=>f.mc_flag==='socom').length
  const routeLines = showRoutes ? flights.filter(f=>ICAO_COORDS[f.base]&&ICAO_COORDS[f.destination]) : []

  return (
    <ErrorBoundary>
    <div style={{flex:1,display:'grid',gridTemplateColumns:'260px 1fr 310px',overflow:'hidden'}}>

      {/* ── LEFT PANEL ── */}
      <div style={{background:C.bg2,borderRight:`1px solid ${C.br}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Active CORONETs" badge={STATIC_CORONETS.length} bc={C.a} bb="rgba(240,160,64,.12)" />
          <div style={{maxHeight:200,overflowY:'auto'}}>
            {STATIC_CORONETS.map(c => <CorItem key={c.id} cor={c} sel={selCor?.id===c.id} onClick={()=>selectCoronet(c)} />)}
          </div>
        </div>
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Layers" />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,padding:8}}>
            {[['carriers','🚢','Carriers'],['destroyers','⚓','Destroyers'],['subs','🔵','Submarines'],['lmsr','🚛','Sealift'],['airbases','✈','AOR Bases'],['conus','◄','CONUS Dep'],['strikes','⚡','Events']].map(([k,ico,lbl])=>(
              <LyrBtn key={k} icon={ico} label={lbl} on={layers[k]} onClick={()=>setLayers(l=>({...l,[k]:!l[k]}))} />
            ))}
            <LyrBtn icon="—" label="Routes" on={showRoutes} onClick={()=>setShowRoutes(v=>!v)} />
          </div>
        </div>
        <div style={{borderBottom:`1px solid ${C.br}`}}>
          <PH title="Country" />
          <div style={{display:'flex',gap:4,padding:'6px 10px',flexWrap:'wrap'}}>
            {[['ALL','ALL'],['US','🇺🇸 US'],['UK','🇬🇧 UK'],['FR','🇫🇷 FR']].map(([k,lbl])=>(
              <button key={k} onClick={()=>setCountry(k)}
                style={{...R,fontSize:11,fontWeight:600,letterSpacing:1,padding:'3px 8px',border:`1px solid ${country===k?C.b:C.br}`,borderRadius:1,cursor:'pointer',background:country===k?'rgba(80,160,232,.08)':'transparent',color:country===k?C.b:C.t2}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <PH title="Assets" badge={filtered.length} bc={C.b} bb="rgba(80,160,232,.12)" />
        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.map(a => <AListItem key={a.id} asset={a} sel={selAsset?.id===a.id} onClick={()=>selectAsset(a)} />)}
        </div>
      </div>

      {/* ── MAP ── */}
      <div style={{position:'relative',overflow:'hidden'}}>
        <MapContainer center={[28,22]} zoom={3} style={{width:'100%',height:'100%'}} zoomControl={false} attributionControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd" maxZoom={18}
          />
          <FlyTo target={flyTarget} />

          {selCor && (() => {
            const f=ICAO_COORDS[selCor.from], t=ICAO_COORDS[selCor.to]
            if(!f||!t) return null
            return <Polyline positions={[f,t]} pathOptions={{color:C.a,weight:2.5,dashArray:'8 4',opacity:.85}} />
          })()}

          {routeLines.map(f => (
            <Polyline key={f.id+'_l'} positions={[ICAO_COORDS[f.base],ICAO_COORDS[f.destination]]}
              pathOptions={{color:f.mc_flag==='socom'?C.p:C.b,weight:1,opacity:.25,dashArray:'4 4'}} />
          ))}

          {/* Airbases */}
          {layers.airbases && allAssets.filter(a=>a.type==='airbase' && a.lat != null && a.lng != null && (country==='ALL'||a.country?.trim()===country)).map(a=>{
            const col=a.status==='SURGE'?C.r:a.status==='ELEVATED'?C.a:C.g
            return (
              <Marker key={a.id} position={[a.lat,a.lng]}
                icon={mkIcon('✈',col,26,a.status==='SURGE',a.arrCnt?'▲'+a.arrCnt:null)}
                eventHandlers={{click:()=>selectAsset(a)}}>
                <Popup closeButton={false}>
                  <div style={{...Z,fontSize:11,minWidth:190}}>
                    <div style={{...R,fontSize:14,fontWeight:700,color:C.tb,marginBottom:4}}>{a.name}</div>
                    <div style={{color:col,marginBottom:2}}>▲{a.arrCnt||0} arrivals tracked</div>
                    {a.socomCnt>0&&<div style={{color:C.p,marginBottom:4}}>SOCOM: {a.socomCnt}</div>}
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
            if(!CONUS_META[icao]) return null
            const meta=CONUS_META[icao]||{}
            const coords = ICAO_COORDS[icao]
            if(!coords) return null
            return (
              <Marker key={icao+'_c'} position={coords}
                icon={mkIcon('◄',data.socom>0?C.p:C.b,22,false,data.total>5?String(data.total):null)}
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

          {layers.carriers && allAssets.filter(a=>a.type==='carrier' && a.lat != null && a.lng != null &&(country==='ALL'||a.country?.trim()===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('🚢',a.status==='REFIT'?C.t3:C.b,28,a.status==='DEPLOYED')} eventHandlers={{click:()=>selectAsset(a)}} />
          ))}
          {layers.destroyers && allAssets.filter(a=>a.type==='destroyer' && a.lat != null && a.lng != null &&(country==='ALL'||a.country?.trim()===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('⚓',C.b,22)} eventHandlers={{click:()=>selectAsset(a)}} />
          ))}
          {layers.subs && allAssets.filter(a=>a.type==='submarine' && a.lat != null && a.lng != null &&(country==='ALL'||a.country?.trim()===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('🔵',C.p,22)} eventHandlers={{click:()=>selectAsset(a)}} />
          ))}
          {layers.lmsr && allAssets.filter(a=>a.type==='lmsr' && a.lat != null && a.lng != null ).map(s=>{
            const col=s.cat==='forward'?C.y:s.cat==='conus_e'?C.b:C.t2
            return (
              <Marker key={s.id} position={[s.lat,s.lng]} icon={mkIcon('🚛',col,22,s.cat==='forward')}
                eventHandlers={{click:()=>selectAsset({...s,type:'lmsr'})}}>
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
          {layers.strikes && allAssets.filter(a=>a.type==='strike' && a.lat != null && a.lng != null &&(country==='ALL'||a.country?.trim()===country)).map(a=>(
            <Marker key={a.id} position={[a.lat,a.lng]} icon={mkIcon('⚡',C.r,24,true)} eventHandlers={{click:()=>selectAsset(a)}} />
          ))}
        </MapContainer>

        <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',zIndex:900,display:'flex',gap:3,background:'rgba(7,9,11,.92)',border:`1px solid ${C.br2}`,padding:5,backdropFilter:'blur(8px)'}}>
          {Object.keys(VIEWS).map(k=>(
            <button key={k} onClick={()=>setFlyTarget(VIEWS[k])}
              style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'5px 12px',border:`1px solid ${C.br}`,background:'transparent',color:C.t2,cursor:'pointer',textTransform:'uppercase'}}>
              {k}
            </button>
          ))}
        </div>

        <div style={{position:'absolute',top:0,left:0,right:0,zIndex:800,background:'rgba(7,9,11,.88)',borderBottom:`1px solid ${C.br}`,display:'flex',backdropFilter:'blur(6px)'}}>
          {[{l:'AMC FLIGHTS',v:loading?'…':flights.length,c:C.b},{l:'SOCOM',v:socomCnt,c:C.p},{l:'ACTIVE',v:flights.filter(f=>f.status==='ACTIVE').length,c:C.g}].map(({l,v,c})=>(
            <div key={l} style={{padding:'5px 14px',borderRight:`1px solid ${C.br}`}}>
              <div style={{...Z,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:1}}>{l}</div>
              <div style={{...R,fontSize:16,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{background:C.bg2,borderLeft:`1px solid ${C.br}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <PH title="Asset Detail" badge={selAsset?.name?.slice(0,18)||selCor?.callsign?.slice(0,14)||null} bc={C.t2} bb="transparent" />
        <div style={{flex:1,overflowY:'auto'}}>
          {selAsset ? <ADetail asset={selAsset} onExpand={()=>setAbmAsset(selAsset)} flights={flights} />
          : selCor   ? <CorDetail cor={selCor} />
          : <EmptyDetail />}
        </div>
        <div style={{height:165,borderTop:`1px solid ${C.br}`,background:C.bg,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'5px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
            <span style={{...R,fontSize:10,fontWeight:600,letterSpacing:3,color:C.t2}}>SIGACT FEED</span>
            <span style={{...Z,fontSize:9,color:C.g}}>● LIVE</span>
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            {(liveFeeds.length>0 ? liveFeeds.map(f=>({t:'LIVE',h:f.content_html,id:f.id})) : FEED_ITEMS).map((f,i)=>(
              <div key={f.id||i} style={{display:'flex',gap:8,padding:'5px 12px',borderBottom:`1px solid rgba(30,44,58,.4)`,fontSize:11}}>
                <span style={{...Z,fontSize:9,color:C.t3,width:36,flexShrink:0,paddingTop:1}}>{f.t}</span>
                <span style={{color:C.t2,flex:1,lineHeight:1.5}} dangerouslySetInnerHTML={{__html:f.h}} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{gridColumn:'1/4',height:24,background:C.bg4,borderTop:`1px solid ${C.br}`,display:'flex',alignItems:'center',padding:'0 14px',gap:16,flexShrink:0}}>
        {[{l:'NAVAL',v:naval,c:C.b},{l:'BASES',v:bases,c:C.g},{l:'LMSR',v:LMSR_DATA.length,c:C.y},{l:'AMC',v:loading?'…':flights.length,c:C.b}].map(({l,v,c})=>(
          <span key={l} style={{...Z,fontSize:10,color:C.t2}}>{l} <b style={{color:c,fontWeight:400}}>{v}</b></span>
        ))}
        {auth?.isAdmin&&<span style={{...Z,fontSize:9,color:C.r,marginLeft:'auto',letterSpacing:1}}>● ADMIN MODE</span>}
      </div>

      {abmAsset && <AbmModal asset={abmAsset} flights={flights} onClose={()=>setAbmAsset(null)} />}
    </div>
    </ErrorBoundary>
  )
}

function PH({title,badge,bc,bb}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0}}>
      <span style={{...R,fontSize:10,fontWeight:600,letterSpacing:3,color:C.t2,textTransform:'uppercase'}}>{title}</span>
      {badge!=null&&<span style={{...Z,fontSize:10,padding:'1px 6px',borderRadius:1,color:bc,background:bb}}>{badge}</span>}
    </div>
  )
}

function LyrBtn({icon,label,on,onClick}) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 8px',border:`1px solid ${on?'rgba(57,224,160,.2)':C.br}`,cursor:'pointer',background:on?'rgba(57,224,160,.04)':'transparent',borderRadius:1}}>
      <div style={{display:'flex',alignItems:'center',gap:6,...R,fontSize:11,fontWeight:500,color:C.t1}}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{width:26,height:13,background:on?C.g:C.br,borderRadius:6,position:'relative',transition:'.2s',flexShrink:0}}>
        <div style={{position:'absolute',width:9,height:9,background:C.bg,borderRadius:'50%',top:2,left:on?15:2,transition:'.2s'}} />
      </div>
    </div>
  )
}

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
        <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',background:'rgba(80,160,232,.15)',border:'1px solid rgba(80,160,232,.3)',color:C.b}}>{cor.acType}</span>
        <span style={{...R,fontSize:9,fontWeight:700,padding:'1px 5px',background:'rgba(57,224,160,.1)',border:'1px solid rgba(57,224,160,.25)',color:C.g}}>{cor.quantity}</span>
      </div>
    </div>
  )
}

function AListItem({asset,sel,onClick}) {
  const imap={carrier:'🚢',destroyer:'⚓',submarine:'🔵',airbase:'✈',strike:'⚡',lmsr:'🚛',conus_base:'◄'}
  const fmap={US:'🇺🇸',UK:'🇬🇧',FR:'🇫🇷'}
  let badge=null
  if(asset.arrCnt){const n=asset.arrCnt,c=n>=20?C.r:n>=10?C.a:C.g,b=n>=20?'rgba(232,80,64,.12)':n>=10?'rgba(240,160,64,.12)':'rgba(57,224,160,.1)';badge=<span style={{...Z,fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:1,background:b,color:c,border:`1px solid ${c}40`}}>▲{n}</span>}
  if(asset.type==='lmsr'){const cc=asset.centcom==='CRITICAL'?C.r:asset.centcom==='HIGH'?C.a:C.t3,bg=asset.centcom==='CRITICAL'?'rgba(232,80,64,.12)':asset.centcom==='HIGH'?'rgba(240,160,64,.12)':'rgba(22,30,40,.5)';badge=<span style={{...Z,fontSize:9,padding:'1px 4px',borderRadius:1,background:bg,color:cc}}>{asset.centcom||'—'}</span>}
  if(asset.type==='conus_base'&&asset.total>0){badge=<span style={{...Z,fontSize:10,padding:'1px 5px',borderRadius:1,background:'rgba(80,160,232,.12)',color:asset.socom>0?C.p:C.b}}>×{asset.total}{asset.socom>0?` (${asset.socom}S)`:''}</span>}
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

function ADetail({asset,onExpand,flights}) {
  const stCol={DEPLOYED:C.g,ACTIVE:C.g,SURGE:C.r,ELEVATED:C.a,ONGOING:C.r,REFIT:C.t3}[asset.status]||C.t2
  const [selAc, setSelAc] = useState(null)

  if(asset.type==='conus_base') {
    const bf = flights.filter(f=>f.base===asset.id)
    const recent = bf.filter(f=>f.dep_date&&new Date(f.dep_date)>=new Date(Date.now()-7*864e5))
    const dests = Object.entries(bf.reduce((a,f)=>{a[f.destination]=(a[f.destination]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1])
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
                <div style={{flex:1,height:4,background:'#0c1018',borderRadius:2,overflow:'hidden'}}>
                  <div style={{width:`${(n/dests[0][1])*100}%`,height:'100%',background:C.b,borderRadius:2}} />
                </div>
                <span style={{...Z,fontSize:10,color:C.t2,width:14,textAlign:'right'}}>{n}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <button onClick={()=>onExpand&&onExpand()}
            style={{display:'block',width:'100%',padding:6,...R,fontSize:11,fontWeight:600,letterSpacing:2,border:`1px solid ${C.a}`,background:'rgba(240,160,64,.08)',color:C.a,cursor:'pointer'}}>
            ▼ EXPAND — FLIGHTS / DEPARTURES / DETAIL
          </button>
        </div>
        {bf.slice(0,6).length>0&&(
          <div style={{padding:'8px 13px'}}>
            <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:2,color:C.t2,marginBottom:8}}>RECENT DEPARTURES</div>
            {bf.slice(0,6).map(f=>(
              <div key={f.id} style={{display:'flex',gap:6,marginBottom:5,...Z,fontSize:10}}>
                <span style={{color:C.t3,width:30}}>{f.dep_date?.slice(5)||'—'}</span>
                <span style={{color:C.tb,width:56,fontWeight:600}}>{normCallsign(f.callsign)}</span>
                <span style={{color:f.mc_flag==='socom'?C.p:C.t1,flex:1,fontSize:9}}>{f.mission_code||'—'}</span>
                <span style={{color:C.g,width:36}}>{f.destination}</span>
              </div>
            ))}
          </div>
        )}
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
        {asset.type==='airbase' ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            <SBox value={asset.arrCnt||0} label="ARRIVALS" color={C.a} />
            <SBox value={asset.type==='airbase'?'tracked':'—'} label="DEPARTURES" color={C.b} />
            <SBox value={asset.socomCnt||0} label="SOCOM" color={C.p} />
          </div>
        ) : (
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
      {asset.type==='lmsr'&&asset.loc&&<DBlk label="POSITION" value={`${asset.loc}\nLast report: ${asset.lastRpt}`} />}

      {asset.aircraftTypes?.length>0&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>AIRCRAFT ON STATION</div>
          {asset.aircraftTypes.map((ac,i)=>(
            <div key={i} style={{marginBottom:6}}>
              <div onClick={()=>setSelAc(selAc===i?null:i)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:selAc===i?'rgba(80,160,232,.08)':C.bg,border:`1px solid ${selAc===i?C.b:C.br}`,borderRadius:1,cursor:ac.tails?.length>0?'pointer':'default'}}>
                <div style={{flex:1}}>
                  <div style={{...R,fontSize:13,fontWeight:700,color:C.tb}}>{ac.type}</div>
                  <div style={{...R,fontSize:9,color:C.t2,marginTop:1}}>{ac.role}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{...Z,fontSize:16,fontWeight:700,color:C.y,lineHeight:1}}>{ac.qty}</div>
                  {ac.tails?.length>0&&<div style={{...Z,fontSize:8,color:C.b,marginTop:2}}>{selAc===i?'▲ HIDE':'▼ AIRFRAMES'}</div>}
                </div>
              </div>
              {selAc===i&&ac.tails?.length>0&&(
                <div style={{padding:'8px 10px',background:'rgba(80,160,232,.04)',border:`1px solid rgba(80,160,232,.15)`,borderTop:'none'}}>
                  <div style={{...R,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:6}}>CONFIRMED TAIL NUMBERS / CALLSIGNS</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {ac.tails.map((t,j)=>(
                      <span key={j} style={{...Z,fontSize:9,padding:'2px 6px',background:'rgba(80,160,232,.1)',border:`1px solid rgba(80,160,232,.2)`,color:C.b,borderRadius:1}}>{t}</span>
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
            ▼ EXPAND — FLIGHTS / AIRCRAFT / INTEL
          </button>
        </div>
      )}
      {asset.escorts?.length>0&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>BATTLE GROUP</div>
          {asset.escorts.map((e,i)=>(
            <div key={i} style={{display:'flex',gap:10,marginBottom:5}}>
              <span style={{...R,color:C.b,width:130,fontWeight:600,fontSize:12}}>{e.name}</span>
              <span style={{...Z,fontSize:9,color:C.t2}}>{e.sub}</span>
              <span style={{...R,color:C.t2,marginLeft:'auto',fontSize:10}}>{e.role}</span>
            </div>
          ))}
        </div>
      )}
      {asset.sightings?.length>0&&(
        <div style={{padding:'8px 13px',borderBottom:`1px solid ${C.br}`}}>
          <div style={{...R,fontSize:9,fontWeight:600,letterSpacing:3,color:C.t2,marginBottom:8}}>SIGHTINGS</div>
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
      <div style={{fontSize:24,opacity:.2}}>◎</div><div>SELECT ASSET</div>
      <div style={{fontSize:9,color:'#1a2a34'}}>OR CORONET MISSION</div>
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

function AbmModal({asset,flights,onClose}) {
  const [tab,setTab] = useState('OVERVIEW')
  const icaoFromSub = asset.sub?.split('//')[0]?.trim().toUpperCase()
  const icaoFromId  = asset.id?.toUpperCase()
  const icaoCodes   = [...new Set([icaoFromSub, icaoFromId].filter(Boolean))]
  const inbound  = flights.filter(f => icaoCodes.includes(f.destination?.toUpperCase()))
  const outbound = flights.filter(f => icaoCodes.includes(f.base?.toUpperCase()))
  const socomIn  = inbound.filter(f=>f.mc_flag==='socom').length
  const tabs = ['OVERVIEW','ARRIVALS (INBOUND)','DEPARTURES (OUTBOUND)','AIRCRAFT','INTEL']

  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:4000,background:C.bg2,borderTop:`2px solid ${C.a}`,display:'flex',flexDirection:'column',maxHeight:'60vh',animation:'slideUp .28s ease'}}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
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
      <div style={{display:'flex',background:C.bg4,borderBottom:`1px solid ${C.br}`,flexShrink:0,overflowX:'auto'}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{...R,fontSize:11,fontWeight:600,letterSpacing:2,padding:'8px 14px',cursor:'pointer',color:tab===t?C.a:C.t2,background:'none',border:'none',borderBottom:`2px solid ${tab===t?C.a:'transparent'}`,whiteSpace:'nowrap'}}>
            {t}
          </button>
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
        {(tab==='ARRIVALS (INBOUND)'||tab==='DEPARTURES (OUTBOUND)')&&(
          <FlightTable flights={tab.includes('INBOUND')?inbound:outbound} label={tab.includes('INBOUND')?'inbound':'outbound'} intel={asset.intel} />
        )}
        {tab==='AIRCRAFT'&&(
          <AircraftTab aircraftTypes={asset.aircraftTypes} />
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

const AC_CATEGORIES = {
  'Strategic Bomber': { icon:'💣', color:'#e85040', order:1 },
  'Fighter':          { icon:'⚡', color:'#e85040', order:2 },
  'Strike':           { icon:'🎯', color:'#f0a040', order:3 },
  'EW':               { icon:'📡', color:'#a060e8', order:4 },
  'AEW&C':            { icon:'👁', color:'#50a0e8', order:5 },
  'ISR':              { icon:'🔭', color:'#50a0e8', order:6 },
  'Tanker':           { icon:'⛽', color:'#39e0a0', order:7 },
  'SOCOM Airlift':    { icon:'🔒', color:'#a060e8', order:8 },
  'SOCOM Assault/Infiltration':{ icon:'🔒', color:'#a060e8', order:8 },
  'Gunship':          { icon:'💥', color:'#e85040', order:9 },
  'Strategic Airlift':{ icon:'✈', color:'#4a6070', order:10 },
}

function AircraftTab({ aircraftTypes }) {
  const [expanded, setExpanded] = useState(null)

  if (!aircraftTypes?.length) return (
    <div style={{padding:20,...Z,fontSize:10,color:C.t3}}>No deployed aircraft data on file for this base.</div>
  )

  const grouped = {}
  aircraftTypes.forEach((ac, i) => {
    const role = ac.role || 'Other'
    let cat = 'Other'
    if (role.includes('Bomber')) cat = 'Strategic Bomber'
    else if (role.includes('Fighter')) cat = 'Fighter'
    else if (role.includes('Strike')) cat = 'Strike'
    else if (role.includes('EW')) cat = 'EW'
    else if (role.includes('AEW') || role.includes('AWACS')) cat = 'AEW&C'
    else if (role.includes('ISR') || role.includes('Recon')) cat = 'ISR'
    else if (role.includes('Tanker')) cat = 'Tanker'
    else if (role.includes('Gunship')) cat = 'Gunship'
    else if (role.includes('SOCOM') && role.includes('Assault')) cat = 'SOCOM Assault/Infiltration'
    else if (role.includes('SOCOM')) cat = 'SOCOM Airlift'
    else if (role.includes('Airlift')) cat = 'Strategic Airlift'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ ...ac, _idx: i })
  })

  const sortedCats = Object.entries(grouped).sort((a,b) =>
    (AC_CATEGORIES[a[0]]?.order||99) - (AC_CATEGORIES[b[0]]?.order||99)
  )

  return (
    <div style={{padding:'14px 18px'}}>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:C.t3,marginBottom:12}}>
        DEPLOYED AIRCRAFT — click category or type for individual airframes
      </div>
      {sortedCats.map(([cat, acs]) => {
        const meta = AC_CATEGORIES[cat] || { icon:'✈', color:C.t2 }
        const isOpen = expanded === cat
        return (
          <div key={cat} style={{marginBottom:8}}>
            <div onClick={() => setExpanded(isOpen ? null : cat)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                background:isOpen?`${meta.color}18`:C.bg3,
                border:`1px solid ${isOpen?meta.color+'60':C.br}`,
                borderRadius:1,cursor:'pointer'}}>
              <span style={{fontSize:16}}>{meta.icon}</span>
              <span style={{...R,fontSize:13,fontWeight:700,color:C.tb,flex:1}}>{cat}</span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{...Z,fontSize:11,color:meta.color,fontWeight:700}}>
                  {acs.length} type{acs.length>1?'s':''}
                </span>
                <span style={{...Z,fontSize:9,color:C.t2}}>{isOpen?'▲':'▼'}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{border:`1px solid ${meta.color}40`,borderTop:'none',background:'rgba(0,0,0,.2)'}}>
                {acs.map((ac, j) => (
                  <AircraftTypeRow key={j} ac={ac} color={meta.color} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AircraftTypeRow({ ac, color }) {
  const [showTails, setShowTails] = useState(false)
  return (
    <div style={{borderBottom:`1px solid rgba(30,44,58,.4)`}}>
      <div onClick={() => ac.tails?.length && setShowTails(v=>!v)}
        style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',
          cursor:ac.tails?.length?'pointer':'default',
          background:showTails?'rgba(80,160,232,.06)':'transparent'}}>
        <div style={{flex:1}}>
          <div style={{...R,fontSize:13,fontWeight:600,color:C.tb}}>{ac.type}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{...Z,fontSize:16,fontWeight:700,color:color,lineHeight:1}}>{ac.qty}</div>
          {ac.tails?.length>0&&(
            <div style={{...Z,fontSize:8,color:C.b,marginTop:2}}>
              {showTails?'▲ hide':'▼ '+ ac.tails.length +' airframes'}
            </div>
          )}
        </div>
      </div>
      {showTails && ac.tails?.length>0&&(
        <div style={{padding:'8px 16px 12px',background:'rgba(80,160,232,.04)'}}>
          <div style={{...R,fontSize:8,letterSpacing:2,color:C.t3,marginBottom:6}}>CONFIRMED TAIL NUMBERS / CALLSIGNS</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {ac.tails.map((t,k)=>(
              <span key={k} style={{...Z,fontSize:9,padding:'2px 6px',background:'rgba(80,160,232,.1)',border:`1px solid rgba(80,160,232,.2)`,color:C.b,borderRadius:1}}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function normCallsign(cs) {
  if (!cs) return '—'
  return cs.replace(/^REACH\s*/i, 'RCH').toUpperCase()
}

function FlightTable({flights,label,intel}) {
  if(!flights.length) return (
    <div style={{padding:20,...Z,fontSize:10,color:C.t3,whiteSpace:'pre-line'}}>
      No {label} flight records currently matched.{intel?`\n\n${intel}`:''}
    </div>
  )
  return (
    <div>
      <div style={{padding:'6px 12px',background:C.bg4,borderBottom:`1px solid ${C.br}`,...Z,fontSize:9,color:C.t2}}>
        ← {flights.length} {label} tracked · ORIGIN codes = ICAO departure base · HEX = ICAO Mode-S transponder
      </div>
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
              const isArmy=(f.mc_flag==='amc'&&f.notes?.toLowerCase().includes('army'))
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
