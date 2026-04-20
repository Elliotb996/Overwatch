import { useState } from 'react'
import { useFlights } from '../hooks/useFlights'
import { MC_FLAG_COLORS, STATUS_COLORS, CONUS_BASES } from '../lib/constants'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

// ── Coming Soon Gate ──────────────────────────────────
function ComingSoonGate({ auth, children }) {
  if (auth?.isAdmin) return children
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:'#07090b', gap:20, padding:40 }}>
      <div style={{ fontSize:40, opacity:.15 }}>✈</div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, letterSpacing:4, color:'#4a6070' }}>
        CONUS DEPARTURE BASES
      </div>
      <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:28, fontWeight:700, color:'#dceaf0', letterSpacing:2 }}>
        COMING SOON
      </div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'#28404c', maxWidth:400, textAlign:'center', lineHeight:1.8 }}>
        Full CONUS departure base tracking with unit-level detail, SOF activity analysis, and integration with the tactical map is in development.
      </div>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        {['BASE PROFILES','SOF TRACKING','ORIGIN ANALYSIS'].map(f=>(
          <span key={f} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,padding:'4px 10px',
            border:'1px solid #1e2c3a',color:'#28404c',borderRadius:1}}>{f}</span>
        ))}
      </div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'#1e2c3a', marginTop:16 }}>
        Available to Analyst tier and above on launch
      </div>
    </div>
  )
}

export function ConusView({ auth }) {
  return (
    <ComingSoonGate auth={auth}>
      <ConusContent auth={auth} />
    </ComingSoonGate>
  )
}

function ConusContent({ auth }) {
  const { flights, byBase, loading } = useFlights({ limit: 1000 })
  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('socom')

  const baseSummaries = CONUS_BASES.map(b => {
    const data = byBase[b.icao] || { total: 0, active: 0, socom: 0, dests: {} }
    const baseFlights = flights.filter(f => f.base === b.icao)
    return { ...b, ...data, flights: baseFlights }
  }).filter(b => b.total > 0 || true)

  const sorted = [...baseSummaries].sort((a, b) => {
    if (sortBy === 'socom')  return b.socom - a.socom
    if (sortBy === 'total')  return b.total - a.total
    if (sortBy === 'active') return b.active - a.active
    return 0
  })

  const selectedData = selected ? sorted.find(b => b.icao === selected) : null

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 360, borderRight: '1px solid #1e2c3a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2c3a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...Z, fontSize: 11, letterSpacing: 3, color: '#dceaf0' }}>CONUS DEPARTURE BASES</span>
          <span style={{ ...Z, fontSize: 9, color: '#2e4050', marginLeft: 'auto' }}>{flights.length} flights</span>
        </div>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #1e2c3a', display: 'flex', gap: 4 }}>
          {['socom','total','active'].map(k => (
            <button key={k} onClick={() => setSortBy(k)}
              style={{ ...Z, fontSize: 8, letterSpacing: 2, padding: '3px 8px', cursor: 'pointer', border: '1px solid',
                borderColor: sortBy === k ? '#50a0e8' : '#1e2c3a',
                background: sortBy === k ? 'rgba(80,160,232,.1)' : 'transparent',
                color: sortBy === k ? '#50a0e8' : '#2e4050' }}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, ...Z, fontSize: 10, color: '#2e4050' }}>Loading...</div>
          ) : sorted.map(b => (
            <BaseRow key={b.icao} base={b} selected={selected === b.icao}
              onClick={() => setSelected(selected === b.icao ? null : b.icao)} />
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedData ? <BaseDetail base={selectedData} /> : <EmptyState count={flights.length} byBase={byBase} />}
      </div>
    </div>
  )
}

function BaseRow({ base, selected, onClick }) {
  const surge = base.socom > 3 || base.total > 8
  return (
    <div onClick={onClick}
      style={{ padding: '10px 16px', cursor: 'pointer',
        background: selected ? 'rgba(80,160,232,.06)' : 'transparent',
        borderBottom: '1px solid rgba(30,44,58,.4)',
        borderLeft: selected ? '2px solid #50a0e8' : '2px solid transparent',
        display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ ...Z, fontSize: 12, color: '#dceaf0', fontWeight: 600 }}>{base.icao}</span>
          {surge && <span style={{ ...Z, fontSize: 8, letterSpacing: 2, color: '#e8d040', padding: '1px 4px',
            border: '1px solid rgba(232,208,64,.3)', background: 'rgba(232,208,64,.06)' }}>SURGE</span>}
        </div>
        <div style={{ fontSize: 10, color: '#4a6070' }}>{base.name}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, ...Z, fontSize: 11 }}>
        {base.socom > 0 && <span style={{ color: '#a060e8' }}>{base.socom}×SOF</span>}
        <span style={{ color: base.active > 0 ? '#39e0a0' : '#2e4050' }}>{base.active} ACT</span>
        <span style={{ color: '#4a6070' }}>{base.total}</span>
      </div>
    </div>
  )
}

function BaseDetail({ base }) {
  const [tab, setTab] = useState('flights')
  const destBreakdown = Object.entries(base.dests || {}).sort((a, b) => b[1] - a[1])
  const flagBreakdown = base.flights.reduce((acc, f) => {
    acc[f.mc_flag] = (acc[f.mc_flag] || 0) + 1; return acc
  }, {})
  return (
    <div>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2c3a' }}>
        <div style={{ ...Z, fontSize: 22, color: '#dceaf0', fontWeight: 700, marginBottom: 4 }}>{base.icao}</div>
        <div style={{ fontSize: 13, color: '#4a6070', marginBottom: 4 }}>{base.name}</div>
        <div style={{ fontSize: 11, color: '#50a0e8' }}>{base.unit}</div>
        <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
          {[{label:'TOTAL',value:base.total,color:'#4a6070'},{label:'ACTIVE',value:base.active,color:'#39e0a0'},{label:'SOF',value:base.socom,color:'#a060e8'}].map(({label,value,color})=>(
            <div key={label} style={{ flex:1,padding:'8px 12px',borderRight:'1px solid #1e2c3a',textAlign:'center' }}>
              <div style={{ ...Z, fontSize:8, color:'#2e4050', letterSpacing:2, marginBottom:2 }}>{label}</div>
              <div style={{ ...Z, fontSize:20, color, fontWeight:700 }}>{value}</div>
            </div>
          ))}
          <div style={{ flex:1,padding:'8px 12px',textAlign:'center' }}>
            <div style={{ ...Z, fontSize:8, color:'#2e4050', letterSpacing:2, marginBottom:2 }}>DESTS</div>
            <div style={{ ...Z, fontSize:20, color:'#50a0e8', fontWeight:700 }}>{destBreakdown.length}</div>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', borderBottom:'1px solid #1e2c3a', padding:'0 16px' }}>
        {['flights','summary'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ ...Z, fontSize:9, letterSpacing:2, padding:'8px 12px', background:'none', border:'none', cursor:'pointer',
              color:tab===t?'#dceaf0':'#4a6070', borderBottom:tab===t?'2px solid #39e0a0':'2px solid transparent' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab==='summary'?(
        <div style={{padding:20}}>
          <Section title="DESTINATION BREAKDOWN">
            {destBreakdown.map(([dest,count])=><BarRow key={dest} label={dest} value={count} max={destBreakdown[0]?.[1]||1} color="#39e0a0" />)}
          </Section>
          <Section title="MC FLAG BREAKDOWN">
            {Object.entries(flagBreakdown).map(([flag,count])=>(
              <BarRow key={flag} label={flag.toUpperCase()} value={count} max={base.total||1} color={MC_FLAG_COLORS[flag]?.text||'#4a6070'} />
            ))}
          </Section>
        </div>
      ):(
        <FlightTable flights={base.flights} />
      )}
    </div>
  )
}

function Section({title,children}){return(<div style={{marginBottom:20}}><div style={{...Z,fontSize:9,letterSpacing:3,color:'#2e4050',marginBottom:10}}>{title}</div>{children}</div>)}
function BarRow({label,value,max,color}){return(<div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}><div style={{...Z,fontSize:10,color:'#b8ccd8',width:80}}>{label}</div><div style={{flex:1,height:4,background:'#0c1018',borderRadius:2,overflow:'hidden'}}><div style={{width:`${(value/max)*100}%`,height:'100%',background:color,borderRadius:2}}/></div><div style={{...Z,fontSize:10,color:'#4a6070',width:20,textAlign:'right'}}>{value}</div></div>)}

function FlightTable({flights}){
  if(!flights.length)return(<div style={{padding:20,...Z,fontSize:10,color:'#2e4050'}}>NO RECORDS</div>)
  return(
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead><tr style={{background:'#0a0e14'}}>
          {['DATE','CALLSIGN','MISSION CODE','DEST','VIA','FLAG','STATUS'].map(h=>(
            <th key={h} style={{padding:'7px 10px',...Z,fontSize:8,letterSpacing:2,color:'#2e4050',textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{flights.map(f=>{
          const col=MC_FLAG_COLORS[f.mc_flag]||MC_FLAG_COLORS.unknown
          return(
            <tr key={f.id} style={{borderBottom:'1px solid rgba(30,44,58,.4)'}}>
              <td style={{padding:'6px 10px',...Z,color:'#2e4050'}}>{f.dep_date?.slice(5)||'—'}</td>
              <td style={{padding:'6px 10px',...Z,color:'#dceaf0',fontWeight:600}}>{f.callsign}</td>
              <td style={{padding:'6px 10px',...Z,fontSize:10,color:'#b8ccd8'}}>{f.mission_code}</td>
              <td style={{padding:'6px 10px',...Z,color:'#39e0a0'}}>{f.destination}</td>
              <td style={{padding:'6px 10px',...Z,color:'#4a6070'}}>{f.via||'—'}</td>
              <td style={{padding:'6px 10px'}}><span style={{...col,padding:'1px 5px',fontSize:8}}>{(f.mc_flag||'amc').toUpperCase()}</span></td>
              <td style={{padding:'6px 10px',...Z,color:STATUS_COLORS[f.status]||'#4a6070',fontSize:10}}>{f.status}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

function EmptyState({count,byBase}){
  const topBases=Object.entries(byBase).sort((a,b)=>b[1].socom-a[1].socom).slice(0,5)
  return(
    <div style={{padding:32}}>
      <div style={{...Z,fontSize:10,letterSpacing:3,color:'#2e4050',marginBottom:24}}>SELECT A BASE TO VIEW DETAIL</div>
      <div style={{...Z,fontSize:9,letterSpacing:2,color:'#2e4050',marginBottom:12}}>TOP SOF ACTIVITY</div>
      {topBases.map(([icao,d])=>d.socom>0&&(
        <div key={icao} style={{display:'flex',gap:12,marginBottom:6,fontSize:11}}>
          <span style={{...Z,color:'#50a0e8',width:60}}>{icao}</span>
          <span style={{...Z,color:'#a060e8'}}>{d.socom} SOF</span>
          <span style={{...Z,color:'#4a6070'}}>{d.total} total</span>
        </div>
      ))}
    </div>
  )
}
