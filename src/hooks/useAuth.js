// src/hooks/useAuth.js
import { useEffect, useState } from 'react'
import { supabase, getTierFromJwt, canSee } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [tier, setTier]       = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setTier(getTierFromJwt(data.session))
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTier(getTierFromJwt(s))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return {
    session,
    tier,
    loading,
    isAdmin:   tier === 'admin',
    isAnalyst: canSee(tier, 'analyst'),
    isPremium: canSee(tier, 'premium'),
    can: (required) => canSee(tier, required),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
}
