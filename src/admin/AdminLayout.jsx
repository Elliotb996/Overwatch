import { Outlet, NavLink } from 'react-router-dom'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

export function AdminLayout({ auth }) {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 200, background: '#07090b', borderRight: '1px solid #1e2c3a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2c3a' }}>
          <div style={{ ...Z, fontSize: 9, letterSpacing: 3, color: '#f0a040', marginBottom: 2 }}>ADMIN PANEL</div>
          <div style={{ ...Z, fontSize: 10, color: '#2e4050' }}>{auth.session?.user?.email}</div>
        </div>
        <nav style={{ padding: '8px 0' }}>
          {[
            { to: '/admin/flights',   label: 'FLIGHT RECORDS' },
            { to: '/admin/units',     label: 'UNIT ASSIGNMENTS' },
            { to: '/admin/assets',    label: 'ASSETS' },
            { to: '/admin/coronets',  label: 'CORONETS' },
            { to: '/admin/countries', label: 'COUNTRIES' },
            { to: '/admin/users',     label: 'ACCOUNTS' },
            { to: '/admin/ingest',    label: 'OSINT INGEST' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({
                display: 'block', padding: '9px 16px', textDecoration: 'none',
                ...Z, fontSize: 9, letterSpacing: 2,
                color: isActive ? '#dceaf0' : '#4a6070',
                background: isActive ? 'rgba(255,255,255,.03)' : 'transparent',
                borderLeft: isActive ? '2px solid #f0a040' : '2px solid transparent',
              })}>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#07090b' }}>
        <Outlet />
      </div>
    </div>
  )
}
