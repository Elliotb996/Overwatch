const Z = { fontFamily: "'Share Tech Mono', monospace" }

export function LayerToggles({ layers, setLayers }) {
  function toggle(key) {
    setLayers(l => ({ ...l, [key]: !l[key] }))
  }

  const items = [
    { key: 'bases',  label: 'ORIGINS',   color: '#50a0e8' },
    { key: 'dests',  label: 'DEST',      color: '#39e0a0' },
    { key: 'routes', label: 'ROUTES',    color: '#4a6070' },
  ]

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 800, display: 'flex', gap: 4,
      background: 'rgba(7,9,11,.88)', border: '1px solid #1e2c3a', padding: '6px 10px',
      backdropFilter: 'blur(8px)',
    }}>
      {items.map(({ key, label, color }) => (
        <button key={key} onClick={() => toggle(key)}
          style={{
            ...Z, fontSize: 9, letterSpacing: 2, padding: '4px 10px',
            background: layers[key] ? `${color}18` : 'transparent',
            border: `1px solid ${layers[key] ? color + '60' : '#1e2c3a'}`,
            color: layers[key] ? color : '#2e3f52',
            cursor: 'pointer', transition: 'all .15s',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}
