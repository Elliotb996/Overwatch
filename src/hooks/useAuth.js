// src/hooks/useAuth.js
import { useEffect, useState } from 'react'
import { supabase, getTierFromJwt, canSee } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [tier, setTier]       = useState('free')
  const [loading, setLoading] = useState(true)

  // Read tier from user_profiles (live) with JWT as fallback
  // ALWAYS resolves - never hangs
  async function fetchTier(session) {
    if (!session?.user) return 'free'
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', session.user.id)
        .maybeSingle()
      if (error || !data) return getTierFromJwt(session) || 'free'
      return data.tier || 'free'
    } catch {
      return getTierFromJwt(session) || 'free'
    }
  }

  // Sync profile — updates email + last_sign_in ONLY, never touches tier
  // Tier is managed exclusively via admin panel / SQL, not overwritten on login
  function syncProfile(session) {
    if (!session?.user) return
    supabase.from('user_profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      last_sign_in: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })
    .then(({ error }) => {
      // If upsert created a new row (first login), set tier from JWT
      if (!error) {
        supabase.from('user_profiles')
          .select('tier').eq('id', session.user.id).maybeSingle()
          .then(({ data }) => {
            if (data?.tier === 'free') {
              const jwtTier = getTierFromJwt(session)
              if (jwtTier && jwtTier !== 'free') {
                supabase.from('user_profiles').update({ tier: jwtTier }).eq('id', session.user.id).catch(() => {})
              }
            }
          })
      }
    }).catch(() => {})
  }

  useEffect(() => {
    let mounted = true

    // Initialise from existing session
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      const s = data.session
      setSession(s)
      if (s) {
        // Fetch tier but ALWAYS call setLoading(false)
        fetchTier(s).then(t => {
          if (mounted) setTier(t)
        }).catch(() => {
          if (mounted) setTier(getTierFromJwt(s) || 'free')
        }).finally(() => {
          if (mounted) setLoading(false)
          syncProfile(s)
        })
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Auth state changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return
      setSession(s)
      if (s) {
        fetchTier(s).then(t => {
          if (mounted) setTier(t)
        }).catch(() => {
          if (mounted) setTier(getTierFromJwt(s) || 'free')
        })
        syncProfile(s)
      } else {
        setTier('free')
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    tier,
    loading,
    isOwner:   tier === 'owner',
    isAdmin:   tier === 'admin' || tier === 'owner',
    isAnalyst: canSee(tier, 'analyst'),
    isPremium: canSee(tier, 'premium'),
    can: (required) => canSee(tier, required),
    signIn:  (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
}
