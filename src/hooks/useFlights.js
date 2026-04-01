// src/hooks/useFlights.js
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useFlights({ base, destination, status, limit = 500 } = {}) {
  const [flights,  setFlights]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('amc_flights')
      .select('*')
      .order('dep_date', { ascending: false })
      .limit(limit)

    if (base)        q = q.eq('base', base.toUpperCase())
    if (destination) q = q.eq('destination', destination.toUpperCase())
    if (status)      q = q.eq('status', status)

    const { data, error } = await q
    if (error) { setError(error); setLoading(false); return }
    setFlights(data)
    setLoading(false)
  }, [base, destination, status, limit])

  useEffect(() => {
    fetch()

    // Realtime: new flights appear on map within ~2s of ACARS bot ingest
    const channel = supabase
      .channel('amc_flights_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'amc_flights' },
        (payload) => {
          setFlights(prev => [payload.new, ...prev])
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'amc_flights' },
        (payload) => {
          setFlights(prev => prev.map(f => f.id === payload.new.id ? payload.new : f))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetch])

  // ─── Derived counts ───────────────────────────────────────
  const byBase = flights.reduce((acc, f) => {
    if (!acc[f.base]) acc[f.base] = { total: 0, active: 0, socom: 0, dests: {} }
    acc[f.base].total++
    if (f.status === 'ACTIVE') acc[f.base].active++
    if (f.mc_flag === 'socom')  acc[f.base].socom++
    acc[f.base].dests[f.destination] = (acc[f.base].dests[f.destination] || 0) + 1
    return acc
  }, {})

  const byDest = flights.reduce((acc, f) => {
    if (!acc[f.destination]) acc[f.destination] = { total: 0, socom: 0, origins: {} }
    acc[f.destination].total++
    if (f.mc_flag === 'socom') acc[f.destination].socom++
    acc[f.destination].origins[f.base] = (acc[f.destination].origins[f.base] || 0) + 1
    return acc
  }, {})

  return { flights, loading, error, byBase, byDest, refetch: fetch }
}

// ─── Admin flight mutation hooks ──────────────────────────────
export function useFlightMutations() {
  async function addFlight(data) {
    const { error } = await supabase.from('amc_flights').insert([{
      base:           data.base?.toUpperCase(),
      dep_date:       data.dep_date,
      callsign:       data.callsign,
      hex:            data.hex,
      serial:         data.serial,
      mission_code:   data.mission_code,
      first_hop:      data.first_hop?.toUpperCase(),
      via:            data.via?.toUpperCase(),
      destination:    data.destination?.toUpperCase(),
      return_mc:      data.return_mc,
      status:         data.status || 'ACTIVE',
      notes:          data.notes,
      source:         data.source || 'manual',
    }])
    if (error) throw error
  }

  async function updateFlight(id, updates) {
    const { error } = await supabase
      .from('amc_flights')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async function deleteFlight(id) {
    const { error } = await supabase.from('amc_flights').delete().eq('id', id)
    if (error) throw error
  }

  return { addFlight, updateFlight, deleteFlight }
}
