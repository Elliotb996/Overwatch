import { useState } from 'react'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }

export function LoginPage({ signIn }) {
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!email || !pass) return
    setLoading(true)
    setErr('')
    const { error } = await signIn(email, pass)
    if (error) {
      setErr('Invalid credentials')
      setLoading(false)
    }
    // On success, App.jsx re-renders automatically via auth state change
  }

  function onKey(e) {
    if (e.key === 'Enter') handle()
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: '#07090b',
    border: '1px solid #1e2c3a',
    color: '#dceaf0',
    padding: '11px 14px',
    ...Z, fontSize: 13,
    outline: 'none',
    transition: 'border-color .2s',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#07090b',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(57,224,160,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(57,224,160,.02) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: 360, padding: '44px 40px',
        background: 'rgba(12,16,24,.97)',
        border: '1px solid #1e2c3a',
        boxShadow: '0 0 80px rgba(57,224,160,.05)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 6, color: '#39e0a0', marginBottom: 10 }}>
            ⊞ OVERWATCH
          </div>
          <div style={{ width: 40, height: 1, background: '#1e2c3a', margin: '0 auto 10px' }} />
          <div style={{ ...Z, fontSize: 8, letterSpacing: 3, color: '#28404c' }}>
            OSINT TACTICAL PLATFORM
          </div>
        </div>

        {/* Status bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 28, padding: '8px 12px',
          background: 'rgba(22,30,40,.6)', border: '1px solid #1e2c3a',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#39e0a0', flexShrink: 0,
            animation: 'owpulse 2s infinite' }} />
          <span style={{ ...Z, fontSize: 9, color: '#4a6070', letterSpacing: 1 }}>
            SYSTEM ONLINE — AUTHENTICATION REQUIRED
          </span>
        </div>

        <style>{`
          @keyframes owpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        `}</style>

        {/* Email */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#4a6070', marginBottom: 6 }}>EMAIL</div>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            placeholder="user@domain.com"
            style={{ ...inp, borderColor: err ? '#e85040' : '#1e2c3a' }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: err ? 8 : 20 }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: '#4a6070', marginBottom: 6 }}>PASSWORD</div>
          <input
            type="password" value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={onKey}
            placeholder="••••••••"
            style={{ ...inp, borderColor: err ? '#e85040' : '#1e2c3a' }}
          />
        </div>

        {/* Error */}
        {err && (
          <div style={{ ...Z, fontSize: 9, color: '#e85040', letterSpacing: 2, marginBottom: 16 }}>
            ✕ {err}
          </div>
        )}

        {/* Button */}
        <button
          onClick={handle}
          disabled={loading}
          style={{
            display: 'block', width: '100%', padding: '13px',
            cursor: loading ? 'default' : 'pointer',
            background: loading ? 'rgba(57,224,160,.04)' : 'rgba(57,224,160,.08)',
            border: '1px solid #39e0a0',
            color: '#39e0a0',
            ...R, fontSize: 14, fontWeight: 700, letterSpacing: 4,
            transition: 'background .2s',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={e => { if(!loading) e.target.style.background = 'rgba(57,224,160,.16)' }}
          onMouseLeave={e => { if(!loading) e.target.style.background = 'rgba(57,224,160,.08)' }}
        >
          {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
        </button>

        <div style={{ ...Z, fontSize: 8, color: '#1a2530', textAlign: 'center', marginTop: 24, letterSpacing: 2 }}>
          CLASSIFIED // OSINT // AUTHORIZED ACCESS ONLY
        </div>
      </div>
    </div>
  )
}
