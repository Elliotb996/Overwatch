import { TIER_ORDER } from '../lib/constants'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

export function TierGate({ required = 'analyst', userTier = 'free', children, label }) {
  const hasAccess = (TIER_ORDER[userTier] ?? 0) >= (TIER_ORDER[required] ?? 0)
  if (hasAccess) return children

  return (
    <div style={{
      padding: '24px 20px', textAlign: 'center',
      border: '1px solid #1e2c3a', background: 'rgba(7,9,11,.6)',
    }}>
      <div style={{ ...Z, fontSize: 20, color: '#1e2c3a', marginBottom: 12 }}>⛒</div>
      <div style={{ ...Z, fontSize: 10, letterSpacing: 3, color: '#4a6070', marginBottom: 6 }}>
        {required.toUpperCase()} TIER REQUIRED
      </div>
      {label && <div style={{ fontSize: 11, color: '#2e3f52', marginTop: 4 }}>{label}</div>}
    </div>
  )
}
