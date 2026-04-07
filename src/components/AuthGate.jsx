import { useState, useEffect } from 'react'

const PASSWORD = 'Overwatch!123E'
const STORAGE_KEY = 'ow_auth'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }

export function AuthGate({ children }) {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === 'ok') setAuthed(true)
  }, [])

  function attempt() {
    if (pw === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'ok')
      setAuthed(true)
    } else {
      setErr(true)
      setShake(true)
      setPw('')
      setTimeout(() => setShake(false), 600)
      setTimeout(() => setErr(false), 2500)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') attempt()
  }

  if (authed) return children

  return (
    <div style={{
      position:'fixed', inset:0, background:'#07090b',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:0,
    }}>
      {/* Grid overlay */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(57,224,160,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(57,224,160,.03) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}} />

      <div style={{
        position:'relative', zIndex:1,
        width:340, padding:'40px 36px',
        background:'rgba(12,16,24,.95)',
        border:'1px solid #1e2c3a',
        boxShadow:'0 0 60px rgba(57,224,160,.06)',
        animation: shake ? 'shake .4s ease' : 'none',
      }}>
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-8px)}
            40%{transform:translateX(8px)}
            60%{transform:translateX(-6px)}
            80%{transform:translateX(6px)}
          }
          @keyframes pulse {
            0%,100%{opacity:1} 50%{opacity:.4}
          }
        `}</style>

        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:32}}>
          <div style={{...Z, fontSize:9, letterSpacing:6, color:'#39e0a0', marginBottom:8}}>⊞ OVERWATCH</div>
          <div style={{width:40, height:1, background:'#1e2c3a', margin:'0 auto 8px'}} />
          <div style={{...Z, fontSize:8, letterSpacing:3, color:'#28404c'}}>OSINT TACTICAL PLATFORM</div>
        </div>

        {/* Status indicator */}
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:24, padding:'8px 12px', background:'rgba(22,30,40,.6)', border:'1px solid #1e2c3a'}}>
          <div style={{width:6, height:6, borderRadius:'50%', background:'#39e0a0', animation:'pulse 2s infinite'}} />
          <span style={{...Z, fontSize:9, color:'#4a6070', letterSpacing:2}}>SYSTEM ONLINE — AUTHENTICATION REQUIRED</span>
        </div>

        {/* Input */}
        <div style={{marginBottom:8}}>
          <div style={{...Z, fontSize:9, letterSpacing:2, color:'#4a6070', marginBottom:8}}>ACCESS CODE</div>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            placeholder="Enter access code"
            style={{
              width:'100%', boxSizing:'border-box',
              background:'#07090b', border:`1px solid ${err?'#e85040':'#1e2c3a'}`,
              color:'#dceaf0', padding:'10px 14px',
              ...Z, fontSize:13, outline:'none',
              transition:'border-color .2s',
            }}
          />
        </div>

        {err && (
          <div style={{...Z, fontSize:9, color:'#e85040', letterSpacing:2, marginBottom:12}}>
            ✕ ACCESS DENIED — INVALID CODE
          </div>
        )}

        <button
          onClick={attempt}
          style={{
            display:'block', width:'100%', marginTop:16,
            padding:'12px', cursor:'pointer',
            background:'rgba(57,224,160,.08)',
            border:'1px solid #39e0a0',
            color:'#39e0a0', ...R, fontSize:13,
            fontWeight:600, letterSpacing:4,
            transition:'background .2s',
          }}
          onMouseEnter={e => e.target.style.background='rgba(57,224,160,.16)'}
          onMouseLeave={e => e.target.style.background='rgba(57,224,160,.08)'}
        >
          AUTHENTICATE
        </button>

        <div style={{...Z, fontSize:8, color:'#1e2c3a', textAlign:'center', marginTop:20, letterSpacing:2}}>
          CLASSIFIED // OSINT // FOR AUTHORIZED USE ONLY
        </div>
      </div>
    </div>
  )
}
