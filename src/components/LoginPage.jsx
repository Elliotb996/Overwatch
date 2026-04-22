// src/components/LoginPage.jsx
// Refreshed OVERWATCH login — split-pane with ambient globe + telemetry.
// Drop-in replacement for the previous LoginPage; uses the same `signIn` prop
// signature as before, so App.jsx needs no changes.

import { useState } from 'react'
import { GlobeLoader } from './GlobeLoader'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }

// Tokens — keep in sync with index.css / constants
const INK          = '#07090b'
const BORDER       = '#1e2c3a'
const BORDER_LIGHT = '#2e3f52'
const TEXT         = '#b8ccd8'
const TEXT_BRIGHT  = '#dceaf0'
const TEXT_DIM     = '#4a6070'
const TEXT_DEEP    = '#2e4050'
const ACCENT       = '#39e0a0'
const AMBER        = '#f0a040'
const BLUE         = '#50a0e8'
const RED          = '#e85040'

export function LoginPage({ signIn }) {
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!email || !pass) return
    setLoading(true); setErr('')
    const { error } = await signIn(email, pass)
    if (error) { setErr('Invalid credentials'); setLoading(false) }
  }
  const onKey = e => { if (e.key === 'Enter') handle() }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: INK, color: TEXT,
      display: 'flex', alignItems: 'stretch', overflow: 'hidden',
    }}>
      {/* Grid backdrop */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'linear-gradient(rgba(57,224,160,.02) 1px,transparent 1px),' +
          'linear-gradient(90deg,rgba(57,224,160,.02) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <style>{`
        @keyframes owpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .ow-pulse { animation: owpulse 2s infinite; }
        .ow-input { transition: border-color .2s; }
        .ow-input:focus { border-color: ${ACCENT} !important; outline: none; }
        .ow-btn:hover:not(:disabled) { background: rgba(57,224,160,.16) !important; }
      `}</style>

      {/* Left: ambient brand pane */}
      <div style={{
        flex: 1.15, position: 'relative', minWidth: 0,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column', padding: '36px 44px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ow-pulse" style={{ width: 7, height: 7, background: ACCENT, borderRadius: '50%' }} />
          <span style={{ ...Z, fontSize: 13, fontWeight: 700, letterSpacing: 4, color: TEXT_BRIGHT }}>OVERWATCH</span>
          <span style={{ ...Z, fontSize: 9, color: TEXT_DEEP, letterSpacing: 2 }}>OSINT</span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <GlobeLoader size={380} bg={INK} />

          <Telemetry style={{ position: 'absolute', top: '14%', left: '4%' }}
            label="Airbase" value="KSVN / 32.01°N" color={ACCENT} />
          <Telemetry style={{ position: 'absolute', top: '8%', right: '2%' }}
            label="Flight" value="RCH335 → ETAR" color={BLUE} />
          <Telemetry style={{ position: 'absolute', bottom: '18%', left: '0%' }}
            label="ACARS" value="2 min ago" color={AMBER} />
          <Telemetry style={{ position: 'absolute', bottom: '10%', right: '4%' }}
            label="CORONET" value="3 ACTIVE" color={ACCENT} />
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          ...Z, fontSize: 9, letterSpacing: 3, color: TEXT_DEEP,
        }}>
          <span>⊞ v2.4 · BUILD 2604.1</span>
          <span>CLASSIFIED // OSINT // AUTHORIZED USE ONLY</span>
        </div>
      </div>

      {/* Right: auth panel */}
      <div style={{
        width: 480, padding: '48px 56px', position: 'relative',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        background: 'linear-gradient(180deg, #0b0e14 0%, #07090b 100%)',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
          background: `linear-gradient(180deg, transparent, ${ACCENT}22 50%, transparent)`,
        }} />

        <div style={{ ...Z, fontSize: 9, letterSpacing: 4, color: TEXT_DIM, marginBottom: 8 }}>// AUTHENTICATE</div>
        <div style={{ ...R, fontSize: 32, fontWeight: 600, letterSpacing: 2, color: TEXT_BRIGHT, marginBottom: 4 }}>
          ACCESS SYSTEM
        </div>
        <div style={{ ...Z, fontSize: 10, letterSpacing: 2, color: TEXT_DIM, marginBottom: 36 }}>
          Credentialed analysts only. All sessions logged.
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28,
          padding: '10px 14px', background: 'rgba(22,30,40,.6)', border: `1px solid ${BORDER}`,
        }}>
          <div className="ow-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
          <span style={{ ...Z, fontSize: 9, color: TEXT_DIM, letterSpacing: 1.5 }}>
            SYSTEM ONLINE — AUTHENTICATION REQUIRED
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ ...Z, fontSize: 9, color: ACCENT, letterSpacing: 2 }}>0.03ms</span>
        </div>

        <Field label="EMAIL">
          <input className="ow-input" type="email" value={email} autoFocus
            onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
            placeholder="user@domain.com"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px', background: INK,
              border: `1px solid ${err ? RED : BORDER}`,
              color: TEXT_BRIGHT, ...Z, fontSize: 12, outline: 'none',
            }} />
        </Field>

        <Field label="PASSWORD">
          <input className="ow-input" type="password" value={pass}
            onChange={e => setPass(e.target.value)} onKeyDown={onKey}
            placeholder="••••••••"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px', background: INK,
              border: `1px solid ${err ? RED : BORDER}`,
              color: TEXT_BRIGHT, ...Z, fontSize: 12, outline: 'none',
            }} />
        </Field>

        {err && (
          <div style={{ ...Z, fontSize: 10, color: RED, letterSpacing: 2, marginBottom: 12 }}>
            ✕ {err}
          </div>
        )}

        <button className="ow-btn" onClick={handle} disabled={loading}
          style={{
            display: 'block', width: '100%', padding: '14px',
            background: 'rgba(57,224,160,.10)',
            border: `1px solid ${ACCENT}`, color: ACCENT,
            ...R, fontSize: 15, fontWeight: 700, letterSpacing: 6,
            cursor: loading ? 'default' : 'pointer', marginTop: 8,
            opacity: loading ? 0.6 : 1, transition: 'background .2s',
          }}>
          {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM  →'}
        </button>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          ...Z, fontSize: 9, letterSpacing: 2, color: TEXT_DIM, marginTop: 24,
        }}>
          <span style={{ cursor: 'pointer' }}>◈ REQUEST ACCESS</span>
          <span>⎘ PGP KEY</span>
        </div>

        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <GlobeLoader size={56} bg={INK} />
          <div>
            <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: TEXT_DIM }}>LINKED TO</div>
            <div style={{ ...Z, fontSize: 11, letterSpacing: 2, color: TEXT }}>Beta Phase One</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Telemetry({ label, value, color, style }) {
  return (
    <div style={{
      ...style, background: 'rgba(12,16,24,.82)',
      border: `1px solid ${BORDER}`, padding: '8px 12px',
      backdropFilter: 'blur(4px)', minWidth: 140,
    }}>
      <div style={{ ...Z, fontSize: 8, letterSpacing: 2, color: TEXT_DIM, marginBottom: 3 }}>{label}</div>
      <div style={{ ...Z, fontSize: 11, letterSpacing: 1, color }}>{value}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...Z, fontSize: 9, letterSpacing: 2, color: TEXT_DIM, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
