import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const Z = { fontFamily: "'Share Tech Mono', monospace" }
const R = { fontFamily: "'Rajdhani', sans-serif" }
const C = {
  g:'#39e0a0', a:'#f0a040', r:'#e85040', b:'#50a0e8', p:'#a060e8',
  y:'#e8d040', t1:'#b8ccd8', t2:'#4a6070', t3:'#28404c', tb:'#dceaf0',
  bg:'#07090b', bg2:'#0c1018', bg3:'#101620', bg4:'#161e28', br:'#1e2c3a',
}

const TIERS = ['free','analyst','premium','admin','owner']
const TIER_COL = { free:C.t2, analyst:C.b, premium:C.p, admin:C.a, owner:C.g }
const TIER_DESC = {
  free:    'Public access — map view only, no intel data',
  analyst: 'Standard access — intel summaries, flights, imagery gallery',
  premium: 'Full access — coordinates, satellite imagery, all layers',
  admin:   'Content admin — edit, upload, manage analyst/premium accounts',
  owner:   'Platform owner — full system control, manage all tiers',
}

export function UserManager({ auth }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [editNotes, setEditNotes] = useState(null)
  const [filterTier, setFilterTier] = useState('ALL')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { flash('Load failed: ' + error.message, true) }
    else setUsers(data || [])
    setLoading(false)
  }

  function flash(text, err = false) {
    setMsg({ text, err })
    setTimeout(() => setMsg(null), 4000)
  }

  async function setTier(userId, newTier) {
    setSaving(userId)
    // Update user_profiles table — useAuth reads tier from here, not cached JWT
    const { error } = await supabase
      .from('user_profiles')
      .update({ tier: newTier })
      .eq('id', userId)
    setSaving(null)
    if (error) { flash('Failed: ' + error.message, true); return }
    // Also sync auth metadata (best effort - won't affect active session until re-login)
    await supabase.rpc('admin_set_user_tier', { user_id: userId, new_tier: newTier }).catch(()=>{})
    flash(`Tier updated → ${newTier.toUpperCase()}`)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: newTier } : u))
  }

  async function saveNotes(userId, notes) {
    const { error } = await supabase
      .from('user_profiles')
      .update({ notes })
      .eq('id', userId)
    if (error) { flash('Notes save failed', true); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, notes } : u))
    setEditNotes(null)
    flash('Notes saved')
  }

  async function deleteUser(user) {
    if (!confirm(`Delete account for ${user.email}? This cannot be undone.`)) return
    const { error } = await supabase.from('user_profiles').delete().eq('id', user.id)
    if (error) { flash('Delete failed: ' + error.message, true); return }
    setUsers(prev => prev.filter(u => u.id !== user.id))
    flash('Account removed from profile table. Auth record still exists in Supabase dashboard.')
  }

  const filtered = users.filter(u => {
    const matchSearch = u.email?.toLowerCase().includes(search.toLowerCase()) ||
                        u.display_name?.toLowerCase().includes(search.toLowerCase())
    const matchTier = filterTier === 'ALL' || u.tier === filterTier
    return matchSearch && matchTier
  })

  const tierCounts = TIERS.reduce((acc, t) => {
    acc[t] = users.filter(u => u.tier === t).length
    return acc
  }, {})

  const inp = {
    background: C.bg2, border: `1px solid ${C.br}`, color: C.t1,
    fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
    padding: '7px 10px', outline: 'none', borderRadius: 1,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.bg4, borderBottom: `1px solid ${C.br}`, padding: '12px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ ...R, fontSize: 18, fontWeight: 700, color: C.tb }}>Account Manager</span>
          <span style={{ ...Z, fontSize: 9, color: C.t3 }}>{users.length} accounts</span>
          {msg && (
            <span style={{ ...Z, fontSize: 10, color: msg.err ? C.r : C.g, marginLeft: 8 }}>
              {msg.err ? '✗' : '✓'} {msg.text}
            </span>
          )}
          <button onClick={load} style={{ ...Z, fontSize: 9, padding: '3px 10px', background: 'transparent', border: `1px solid ${C.br}`, color: C.t2, cursor: 'pointer', marginLeft: 'auto', borderRadius: 1 }}>
            ↺ REFRESH
          </button>
        </div>

        {/* Tier summary pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['ALL', ...TIERS].map(t => (
            <button key={t} onClick={() => setFilterTier(t)}
              style={{ ...R, fontSize: 11, fontWeight: 600, padding: '3px 12px', cursor: 'pointer', borderRadius: 1,
                background: filterTier === t ? (TIER_COL[t] || C.t2) + '22' : 'transparent',
                border: `1px solid ${filterTier === t ? (TIER_COL[t] || C.t2) : C.br}`,
                color: filterTier === t ? (TIER_COL[t] || C.t2) : C.t2 }}>
              {t.toUpperCase()} {t !== 'ALL' ? `(${tierCounts[t] || 0})` : `(${users.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
      </div>

      {/* Tier reference */}
      <div style={{ display: 'flex', gap: 0, background: C.bg3, borderBottom: `1px solid ${C.br}`, flexShrink: 0, overflowX: 'auto' }}>
        {TIERS.map(t => (
          <div key={t} style={{ flex: 1, padding: '8px 14px', borderRight: `1px solid ${C.br}`, minWidth: 140 }}>
            <div style={{ ...R, fontSize: 11, fontWeight: 700, color: TIER_COL[t], marginBottom: 2 }}>{t.toUpperCase()}</div>
            <div style={{ ...Z, fontSize: 8, color: C.t3, lineHeight: 1.4 }}>{TIER_DESC[t]}</div>
          </div>
        ))}
      </div>

      {/* User list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, ...Z, fontSize: 10, color: C.t3 }}>LOADING ACCOUNTS...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, ...Z, fontSize: 10, color: C.t3 }}>No accounts found.</div>
        ) : filtered.map(user => (
          <UserRow
            key={user.id}
            user={user}
            saving={saving === user.id}
            editingNotes={editNotes === user.id}
            isOwner={auth?.isOwner}
            currentUserId={auth?.session?.user?.id}
            onSetTier={newTier => setTier(user.id, newTier)}
            onEditNotes={() => setEditNotes(user.id)}
            onSaveNotes={notes => saveNotes(user.id, notes)}
            onCancelNotes={() => setEditNotes(null)}
            onDelete={() => deleteUser(user)}
          />
        ))}
      </div>
    </div>
  )
}

function UserRow({ user, saving, editingNotes, isOwner, currentUserId, onSetTier, onEditNotes, onSaveNotes, onCancelNotes, onDelete }) {
  const [notesVal, setNotesVal] = useState(user.notes || '')
  const tierCol = TIER_COL[user.tier] || C.t2
  const isAdmin = user.tier === 'admin'
  const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const lastSeen = user.last_sign_in ? new Date(user.last_sign_in).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Never'

  return (
    <div style={{ borderBottom: `1px solid rgba(30,44,58,.5)`, padding: '12px 20px',
      background: isAdmin ? 'rgba(240,160,64,.03)' : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>

        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${tierCol}22`,
          border: `1px solid ${tierCol}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, ...R, fontSize: 14, fontWeight: 700, color: tierCol }}>
          {(user.email || '?')[0].toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ ...R, fontSize: 14, fontWeight: 600, color: C.tb }}>{user.email}</span>
            {user.display_name && <span style={{ ...Z, fontSize: 9, color: C.t3 }}>({user.display_name})</span>}
            {isAdmin && <span style={{ ...Z, fontSize: 8, color: C.a, border: `1px solid ${C.a}44`, padding: '1px 5px', borderRadius: 1 }}>ADMIN</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, ...Z, fontSize: 9, color: C.t3 }}>
            <span>Joined {joinDate}</span>
            <span>Last seen {lastSeen}</span>
            <span style={{ ...Z, fontSize: 8, color: C.t3, fontFamily: 'monospace' }}>{user.id?.slice(0, 8)}...</span>
          </div>
          {user.notes && !editingNotes && (
            <div style={{ ...Z, fontSize: 9, color: C.t2, marginTop: 4, fontStyle: 'italic' }}>📝 {user.notes}</div>
          )}
          {editingNotes && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input value={notesVal} onChange={e => setNotesVal(e.target.value)}
                placeholder="Internal notes about this account..."
                style={{ flex: 1, padding: '5px 8px', background: C.bg2, border: `1px solid ${C.br}`,
                  color: C.t1, fontFamily: "'Share Tech Mono',monospace", fontSize: 10, outline: 'none', borderRadius: 1 }} />
              <button onClick={() => onSaveNotes(notesVal)}
                style={{ ...R, fontSize: 10, fontWeight: 700, padding: '4px 10px', background: C.g, color: C.bg, border: 'none', cursor: 'pointer', borderRadius: 1 }}>
                SAVE
              </button>
              <button onClick={onCancelNotes}
                style={{ ...Z, fontSize: 9, padding: '4px 8px', background: 'transparent', border: `1px solid ${C.br}`, color: C.t2, cursor: 'pointer', borderRadius: 1 }}>
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Tier selector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {saving ? (
              <span style={{ ...Z, fontSize: 9, color: C.t3, padding: '4px 10px' }}>SAVING...</span>
            ) : TIERS.map(t => {
              // Only owners can set admin/owner tier — admins can only set free/analyst/premium
              const restricted = (t === 'admin' || t === 'owner') && !isOwner
              // Can't edit yourself or restricted tiers
              const disabled = t === user.tier || restricted || user.id === currentUserId
              if (restricted && t !== user.tier) return null // hide restricted options
              return (
                <button key={t} onClick={() => !disabled && onSetTier(t)}
                  disabled={disabled}
                  title={restricted ? 'Owner-only' : t === user.tier ? 'Current tier' : `Set to ${t}`}
                  style={{ ...R, fontSize: 10, fontWeight: 700, padding: '4px 10px',
                    cursor: disabled ? 'default' : 'pointer', opacity: disabled && t !== user.tier ? 0.4 : 1,
                    background: t === user.tier ? `${TIER_COL[t]}22` : 'transparent',
                    border: `1px solid ${t === user.tier ? TIER_COL[t] : C.br}`,
                    color: t === user.tier ? TIER_COL[t] : C.t3,
                    borderRadius: 1, letterSpacing: 0.5 }}>
                  {t.toUpperCase()}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onEditNotes}
              style={{ ...Z, fontSize: 8, padding: '2px 8px', background: 'transparent', border: `1px solid ${C.br}`, color: C.t3, cursor: 'pointer', borderRadius: 1 }}>
              📝 NOTES
            </button>
            {user.tier !== 'owner' && user.id !== currentUserId && (
              <button onClick={onDelete}
                style={{ ...Z, fontSize: 8, padding: '2px 8px', background: 'transparent', border: `1px solid rgba(232,80,64,.3)`, color: C.r, cursor: 'pointer', borderRadius: 1 }}>
                REMOVE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
