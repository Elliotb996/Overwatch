// Tier order for comparisons
export const TIER_ORDER = { free: 0, analyst: 1, premium: 2, admin: 3 }

// MC Flag colors
export const MC_FLAG_COLORS = {
  socom:   { bg: 'rgba(160,96,232,.15)', border: 'rgba(160,96,232,.35)', text: '#a060e8' },
  marine:  { bg: 'rgba(232,208,64,.10)', border: 'rgba(232,208,64,.3)',  text: '#e8d040' },
  ang:     { bg: 'rgba(80,200,120,.10)', border: 'rgba(80,200,120,.3)',  text: '#50c878' },
  afrc:    { bg: 'rgba(240,160,64,.10)', border: 'rgba(240,160,64,.3)',  text: '#f0a040' },
  amc:     { bg: 'rgba(80,160,232,.12)', border: 'rgba(80,160,232,.25)', text: '#50a0e8' },
  unknown: { bg: 'rgba(74,96,112,.15)',  border: 'rgba(74,96,112,.3)',   text: '#4a6070' },
}

// Status colors
export const STATUS_COLORS = {
  ACTIVE:    '#39e0a0',
  COMPLETE:  '#324050',
  PENDING:   '#f0a040',
  CANCELLED: '#e85040',
}

// Key CONUS departure bases
export const CONUS_BASES = [
  { icao: 'KSVN',  name: 'Hunter AAF',       unit: '3rd SF Group / 1st SFOD-D area' },
  { icao: 'KPOB',  name: 'Pope Field',        unit: '82nd Airborne / JSOC area' },
  { icao: 'KHOP',  name: 'Campbell AAF',      unit: '101st Airborne / 160th SOAR' },
  { icao: 'KGRF',  name: 'Gray AAF (JBLM)',   unit: 'I Corps / 2nd SFOD area' },
  { icao: 'KTCM',  name: 'McChord AFB',       unit: '62nd AW — AMC primary hub' },
  { icao: 'KNTU',  name: 'NAS Oceana',        unit: 'SEAL Team area / NAVSOC' },
  { icao: 'KHRT',  name: 'Hurlburt Field',    unit: '1 SOW / AFSOC HQ' },
  { icao: 'KMCF',  name: 'MacDill AFB',       unit: 'USSOCOM HQ / CENTCOM HQ' },
  { icao: 'KCHS',  name: 'Charleston AFB',    unit: '437th AW — C-17 hub' },
  { icao: 'KDOV',  name: 'Dover AFB',         unit: '436th AW — C-17/C-5 hub' },
  { icao: 'KSUU',  name: 'Travis AFB',        unit: '60th AMW — AMC Pacific hub' },
  { icao: 'KNKX',  name: 'MCAS Miramar',      unit: 'USMC aviation' },
]

// Key CENTCOM/EUCOM destinations
export const KEY_DESTINATIONS = [
  { icao: 'LLOV',  name: 'Ovda AB',         country: 'IL', region: 'EUCOM/CENTCOM' },
  { icao: 'OJKA',  name: 'King Abdullah II AB', country: 'JO', region: 'CENTCOM' },
  { icao: 'OJMS',  name: 'Muwaffaq Salti AB', country: 'JO', region: 'CENTCOM' },
  { icao: 'OKAS',  name: 'Ali Al Salem AB',  country: 'KW', region: 'CENTCOM' },
  { icao: 'OMDM',  name: 'Al Minhad AB',    country: 'AE', region: 'CENTCOM' },
  { icao: 'OMAM',  name: 'Al Dhafra AB',    country: 'AE', region: 'CENTCOM' },
  { icao: 'OTBH',  name: 'Al Udeid AB',     country: 'QA', region: 'CENTCOM' },
  { icao: 'ORAA',  name: 'Al Asad AB',      country: 'IQ', region: 'CENTCOM' },
  { icao: 'OEPS',  name: 'Prince Sultan AB', country: 'SA', region: 'CENTCOM' },
  { icao: 'LGEL',  name: 'Elefsis AB',      country: 'GR', region: 'EUCOM' },
  { icao: 'ETAR',  name: 'Ramstein AB',     country: 'DE', region: 'EUCOM' },
  { icao: 'LIPA',  name: 'Aviano AB',       country: 'IT', region: 'EUCOM' },
  { icao: 'LTAG',  name: 'Incirlik AB',     country: 'TR', region: 'EUCOM' },
  { icao: 'FJDG',  name: 'Diego Garcia',    country: 'IO', region: 'CENTCOM' },
]

// Approximate coordinates for map markers
export const ICAO_COORDS = {
  // CONUS
  KSVN:  [32.0158, -81.1457],
  KPOB:  [35.1709, -79.0145],
  KHOP:  [36.6688, -87.4963],
  KGRF:  [47.0788, -122.5801],
  KTCM:  [47.1377, -122.4757],
  KNTU:  [36.9372, -76.0357],
  KHRT:  [30.4278, -86.6895],
  KMCF:  [27.8493, -82.5213],
  KCHS:  [32.8987, -80.0408],
  KDOV:  [39.1295, -75.4660],
  KSUU:  [38.2627, -121.9274],
  KNKX:  [32.8681, -117.1428],
  // UK
  EGVN:  [51.7502, -1.5822],
  EGUL:  [52.4093, 0.5601],
  EGUN:  [52.3619, 0.4864],
  EGVA:  [51.6823, -1.7903],
  // Germany
  ETAR:  [49.4369, 7.6003],
  ETAD:  [49.9726, 6.6927],
  // Middle East
  LLOV:  [30.7754, 34.9367],
  OJKA:  [32.3567, 36.2592],
  OJMS:  [31.8267, 36.7892],
  OKAS:  [29.3467, 47.5189],
  OMDM:  [25.0268, 55.3664],
  OMAM:  [24.2486, 54.5476],
  OTBH:  [25.1173, 51.3150],
  ORAA:  [33.7856, 42.4412],
  OEPS:  [24.0627, 47.5805],
  // Europe
  LGEL:  [38.0647, 23.5560],
  LIPA:  [46.0315, 12.5960],
  LTAG:  [37.0021, 35.4259],
  // Indian Ocean
  FJDG:  [-7.3132, 72.4108],
}
