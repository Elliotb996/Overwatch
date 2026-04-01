import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }

export function SignactFeed({ auth }) {
  const [items, setItems] = useState([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    supabase.from('sigact_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setItems(data || []))

    const ch = supabase.channel('sigact_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sigact_feed' },
        p => setItems(prev => [p.new, ...prev].slice(0, 20)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  return (
    <div style={{
      position: 'absolute', bottom: 0, right: 0,
      width: 320, zIndex: 700,
      background: 'rgba(7,9,11,.92)',
      borderLeft: '1px solid #1e2c3a',
      borderTop: '1px solid #1e2c3a',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #1e2c3a', cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#39e0a0', marginRight: 8 }} className="pulse" />
        <span style={{ ...Z, fontSize: 9, letterSpacing: 3, color: '#4a6070' }}>SIGACT FEED</span>
        <span style={{ ...Z, fontSize: 9, color: '#2e4050', marginLeft: 6 }}>({items.length})</span>
        <span style={{ ...Z, fontSize: 9, color: '#2e4050', marginLeft: 'auto' }}>{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ padding: '16px 12px', ...Z, fontSize: 10, color: '#2e4050', letterSpacing: 1 }}>
              NO FEED ITEMS
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(30,44,58,.4)' }}>
              <div style={{ ...Z, fontSize: 9, color: '#2e4050', marginBottom: 3 }}>
                {new Date(item.created_at).toISOString().replace('T',' ').slice(0,19)}Z
                {item.source && <span style={{ color: '#1e3040', marginLeft: 8 }}>{item.source}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#b8ccd8', lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: item.content_html }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
