// ── Shared static asset definitions ──────────────────
// Single source of truth used by MapView, SealiftView, ConusView
// DB data enriches these entries at runtime — never duplicated

export const STATIC_CARRIERS = [
  {
    id:'cvn78', name:'USS Gerald R. Ford', sub:'CVN-78 // Ford-class',
    hull:'CVN-78', country:'US', type:'carrier', status:'DEPLOYED',
    lat:43.5, lng:16.5, csg:'CSG-12',
    aircraftTypes:[
      {type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},
      {type:'EA-18G Growler',qty:'5x',role:'EW'},
      {type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'},
      {type:'MH-60R Seahawk',qty:'8x',role:'ASW/SAR'},
    ],
    squadrons:['VFA-37 (F/A-18E)','VFA-213 (F/A-18F)','VFA-31 (F/A-18E)','VFA-87 (F/A-18E)','VAQ-142 (EA-18G)','VAW-124 (E-2D)','HSC-9 (MH-60S)','HSM-70 (MH-60R)','VRC-40 (C-2A)'],
    escorts:[
      {name:'USS Mitscher',sub:'DDG-57',role:'Destroyer'},
      {name:'USS Mahan',sub:'DDG-72',role:'Destroyer'},
      {name:'USS Winston S. Churchill',sub:'DDG-81',role:'Destroyer'},
      {name:'USS Bainbridge',sub:'DDG-96',role:'Destroyer'},
      {name:'USNS Supply',sub:'T-AOE-6',role:'Combat Logistics'},
    ],
    notes:'Adriatic/Split Croatia area 28 Mar. EUCOM/CENTCOM direction.',
    tags:['ADRIATIC','CENTCOM-BOUND'],
  },
  {
    id:'cvn72', name:'USS Abraham Lincoln', sub:'CVN-72 // Nimitz-class',
    hull:'CVN-72', country:'US', type:'carrier', status:'DEPLOYED',
    lat:16.0, lng:54.0, csg:'CSG-3',
    aircraftTypes:[
      {type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},
      {type:'EA-18G Growler',qty:'5x',role:'EW'},
      {type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'},
    ],
    squadrons:['VFA-41 (F/A-18F)','VFA-14 (F/A-18E)','VMFA-314 (F/A-18E)','VFA-151 (F/A-18E)','VAQ-133 (EA-18G)','VAW-117 (E-2D)','HSC-14 (MH-60S)','HSM-71 (MH-60R)','VRM-30 Det.2 (CMV-22B)'],
    escorts:[
      {name:'USS Pinckney',sub:'DDG-91',role:'Destroyer'},
      {name:'USS Spruance',sub:'DDG-111',role:'Destroyer'},
      {name:'USS Michael Murphy',sub:'DDG-112',role:'Destroyer'},
      {name:'USS Frank E. Petersen Jr.',sub:'DDG-121',role:'Destroyer'},
    ],
    notes:'5th Fleet / Arabian Sea. Houthi suppression. Tomahawk employment confirmed.',
    tags:['5TH-FLEET','ARABIAN-SEA'],
  },
  {
    id:'cvn77', name:'USS George H.W. Bush', sub:'CVN-77 // Nimitz-class',
    hull:'CVN-77', country:'US', type:'carrier', status:'DEPLOYED',
    lat:36.0, lng:-12.0, csg:'CSG-10',
    aircraftTypes:[
      {type:'F/A-18E/F Super Hornet',qty:'24x',role:'Strike'},
      {type:'EA-18G Growler',qty:'5x',role:'EW'},
      {type:'E-2D Hawkeye',qty:'4x',role:'AEW&C'},
    ],
    squadrons:['VFA-103 (F/A-18F)','VFA-83 (F/A-18E)','VFA-131 (F/A-18E)','VFA-105 (F/A-18E)','VAQ-140 (EA-18G)','VAW-121 (E-2D)','HSC-5 (MH-60S)','HSM-79 (MH-60R)','VRM-40 (CMV-22B)'],
    escorts:[
      {name:'USS Ross',sub:'DDG-71',role:'Destroyer'},
      {name:'USS Donald Cook',sub:'DDG-75',role:'Destroyer'},
      {name:'USS Mason',sub:'DDG-87',role:'Destroyer'},
      {name:'USNS Arctic',sub:'T-AOE-8',role:'Combat Logistics'},
    ],
    notes:'DEPLOYED 31 Mar. Atlantic transit, EUCOM/CENTCOM direction.',
    tags:['ATLANTIC','EUCOM-BOUND'],
  },
  {
    id:'r08', name:'HMS Queen Elizabeth', sub:'R08 // QE-class',
    hull:'R08', country:'UK', type:'carrier', status:'REFIT',
    lat:56.0, lng:-3.4, csg:'CSG21',
    notes:'Refit Rosyth 482 days. POW also maintenance Portsmouth.',
    tags:['REFIT','ROSYTH'],
  },
  {
    id:'r91', name:'Charles de Gaulle', sub:'R91 // CdG-class',
    hull:'R91', country:'FR', type:'carrier', status:'DEPLOYED',
    lat:34.0, lng:28.0, csg:'TF-473',
    notes:'Eastern Med. TF-473. Active strike role.',
    tags:['EASTMED','TF-473'],
  },
]

export const STATIC_LMSR = [
  {id:'pil',name:'USNS Pililaau',hull:'T-AK-304',sub:'T-AK-304 // Div.3',type:'lmsr',cat:'forward',centcom:'CRITICAL',lat:-7.2,lng:72.5,loc:'Diego Garcia — departure IMMINENT',lastRpt:'01 Apr 2026'},
  {id:'sol',name:'USNS 1st Lt. Jack Lummus',hull:'T-AK-3011',sub:'T-AK-3011 // Div.3',type:'lmsr',cat:'forward',centcom:'CRITICAL',lat:14.0,lng:50.5,loc:'Red Sea / Gulf of Aden (assessed)',lastRpt:'31 Mar 2026'},
  {id:'sgt',name:'USNS SGT. Matej Kocak',hull:'T-AK-3005',sub:'T-AK-3005 // Div.2',type:'lmsr',cat:'forward',centcom:'HIGH',lat:25.5,lng:56.5,loc:'Gulf of Oman / Hormuz',lastRpt:'30 Mar 2026'},
  {id:'ssp',name:'SS Sgt William Button',hull:'T-AK-3012',sub:'T-AK-3012',type:'lmsr',cat:'forward',centcom:'HIGH',lat:12.5,lng:44.0,loc:'Red Sea transit',lastRpt:'31 Mar 2026'},
  {id:'cpb',name:'USNS Cape Bover',hull:'T-AKR-9',sub:'T-AKR-9 // APS-3',type:'lmsr',cat:'conus_e',centcom:'MODERATE',lat:38.0,lng:-75.5,loc:'US East Coast',lastRpt:'28 Mar 2026'},
]

export const USCARRIERS_LINKS = {
  cvn78:'https://www.uscarriers.net/cvn78history.htm',
  cvn77:'https://www.uscarriers.net/cvn77history.htm',
  cvn72:'https://www.uscarriers.net/cvn72history.htm',
}
