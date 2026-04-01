// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } }
})

// ─── Tier helpers ──────────────────────────────────────────────
const TIER_ORDER = { free: 0, analyst: 1, premium: 2, admin: 3 }

export function getTierFromJwt(session) {
  try {
    return session?.user?.app_metadata?.tier || 'free'
  } catch { return 'free' }
}

export function canSee(userTier, requiredTier) {
  return (TIER_ORDER[userTier] ?? 0) >= (TIER_ORDER[requiredTier] ?? 0)
}

// ─── Storage helpers ───────────────────────────────────────────
export async function uploadImagery(file, assetId) {
  const ext   = file.name.split('.').pop()
  const path  = `${assetId}/${Date.now()}.${ext}`
  
  const { error } = await supabase.storage
    .from('imagery')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  
  if (error) throw error
  
  const { data } = supabase.storage.from('imagery').getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export function getImageryUrl(storagePath, tier) {
  // Premium+ gets full res; analyst gets thumbnail (if implemented server-side)
  return supabase.storage.from('imagery').getPublicUrl(storagePath).data.publicUrl
}
