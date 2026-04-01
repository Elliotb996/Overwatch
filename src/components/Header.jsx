import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

function UTC() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const pad = x => String(x).padStart(2,'0')
      setT(`${n.getUTCFullYear()}-${pad(n.getUTCMonth()+1)}-${pad(n.getUTCDate())} ${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())}Z`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ ...Z, fontSize: 11, color: '#39e0a0', letterSpacing: 1 }}>{t}</span>
}

export function Header({ auth }) {
  const loc = useLocation()
  const nav = [
    { to: '/',        label: 'TACTICAL MAP' },
    { to: '/conus',   label: 'CONUS BASES' },
    { to: '/sealift', label: 'SEALIFT' },
  ]

  return (
    <header style={{
      height: 44,
      background: '#07090b',
      borderBottom: '1px solid #1e2c3a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 0,
      flexShrink: 0,
      zIndex: 1000,
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
        <div style={{ width: 6, height: 6, background: '#39e0a0', borderRadius: '50%' }} className="pulse" />
        <span style={{ ...Z, fontSize: 13, fontWeight: 700, letterSpacing: 4, color: '#dceaf0' }}>OVERWATCH</span>
        <span style={{ ...Z, fontSize: 9, color: '#2e4050', letterSpacing: 2, marginLeft: 2 }}>OSINT</span>
      </div>

      {/* Nav */}
      {nav.map(({ to, label }) => (
        <Link key={to} to={to} style={{
          padding: '0 14px',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          ...Z,
          fontSize: 10,
          letterSpacing: 2,
          color: loc.pathname === to ? '#dceaf0' : '#4a6070',
          borderBottom: loc.pathname === to ? '2px solid #39e0a0' : '2px solid transparent',
          transition: 'color .15s',
        }}>{label}</Link>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Clock */}
      <UTC />

      {/* Auth */}
      <div style={{ marginLeft: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        {auth.session ? (
          <>
            <TierBadge tier={auth.tier} />
            {auth.isAdmin && (
              <Link to="/admin" style={{ ...Z, fontSize: 10, letterSpacing: 2, color: '#f0a040', textDecoration: 'none', padding: '3px 8px', border: '1px solid rgba(240,160,64,.3)', background: 'rgba(240,160,64,.05)' }}>
                ADMIN
              </Link>
            )}
            <button onClick={auth.signOut}
              style={{ ...Z, fontSize: 10, letterSpacing: 1, color: '#4a6070', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>
              SIGN OUT
            </button>
          </>
        ) : (
          <LoginModal signIn={auth.signIn} />
        )}
      </div>
    </header>
  )
}

function TierBadge({ tier }) {
  const colors = { free: '#4a6070', analyst: '#50a0e8', premium: '#a060e8', admin: '#f0a040' }
  return (
    <span style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 9,
      letterSpacing: 2,
      padding: '2px 8px',
      border: `1px solid ${colors[tier] || '#4a6070'}40`,
      background: `${colors[tier] || '#4a6070'}12`,
      color: colors[tier] || '#4a6070',
    }}>{(tier || 'free').toUpperCase()}</span>
  )
}

function LoginModal({ signIn }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true); setErr('')
    const { error } = await signIn(email, pass)
    if (error) { setErr(error.message); setLoading(false) }
    else setOpen(false)
  }

  const inp = { background: '#07090b', border: '1px solid #1e2c3a', color: '#b8ccd8', padding: '7px 10px', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, outline: 'none', width: '100%' }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: 2, color: '#39e0a0', background: 'rgba(57,224,160,.06)', border: '1px solid rgba(57,224,160,.25)', padding: '4px 12px', cursor: 'pointer' }}>
        SIGN IN
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div style={{ background: '#0c1018', border: '1px solid #2e3f52', padding: 28, width: 320 }} className="fade-in">
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#4a6070', marginBottom: 20 }}>// AUTHENTICATE</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: 2, color: '#4a6070', marginBottom: 4 }}>EMAIL</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, letterSpacing: 2, color: '#4a6070', marginBottom: 4 }}>PASSWORD</div>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} style={inp} onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            {err && <div style={{ fontSize: 11, color: '#e85040', fontFamily: "'Share Tech Mono', monospace", marginBottom: 12 }}>{err}</div>}
            <button onClick={handle} disabled={loading}
              style={{ width: '100%', padding: '9px', background: 'rgba(57,224,160,.1)', border: '1px solid #39e0a0', color: '#39e0a0', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 2, cursor: 'pointer' }}>
              {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
