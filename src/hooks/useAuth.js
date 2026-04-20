// src/hooks/useAuth.js
import { useEffect, useState } from 'react'
import { supabase, getTierFromJwt, canSee } from '../lib/supabase'

export function useAuth() {
  const [session, setSession]   = useState(null)
  const [tier, setTier]         = useState('free')
  const [loading, setLoading]   = useState(true)

  // ── Read tier from user_profiles table (always live, not cached JWT) ──
  async function fetchTier(session) {
    if (!session?.user) return 'free'
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', session.user.id)
        .maybeSingle()
      // Profile table is authoritative; JWT is fallback for first login
      return data?.tier || getTierFromJwt(session) || 'free'
    } catch {
      return getTierFromJwt(session) || 'free'
    }
  }

  async function syncProfile(session) {
    if (!session?.user) return
    const jwtTier = getTierFromJwt(session)
    await supabase.from('user_profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      // Only set tier from JWT if profile doesn't exist yet
      // (upsert with ignoreDuplicates=false, so existing tier is preserved via DB function)
      last_sign_in: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })
  }

  async function initSession(s) {
    setSession(s)
    if (s) {
      const t = await fetchTier(s)
      setTier(t)
      syncProfile(s)
    } else {
      setTier('free')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await initSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_e, s) => {
      await initSession(s)
    })

    return () => listener.subscription.unsubscribe()
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
