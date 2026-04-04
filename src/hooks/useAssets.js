import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAssets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetch() {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .order('asset_type', { ascending: true })
    if (data) setAssets(data)
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const ch = supabase.channel('assets_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  return { assets, loading, refetch: fetch }
}
