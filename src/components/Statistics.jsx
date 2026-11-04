import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Statistics() {
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeBookings: 0,
    totalFaults: 0,
    openFaults: 0,
    resolvedFaults: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      const orgId = profile.organization_id

      const { count: totalBookings } = await supabase
        .from('laundry_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      const { count: activeBookings } = await supabase
        .from('laundry_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'booked')

      const { count: totalFaults } = await supabase
        .from('fault_reports')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      const { count: openFaults } = await supabase
        .from('fault_reports')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'open')

      const { count: resolvedFaults } = await supabase
        .from('fault_reports')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'resolved')

      setStats({
        totalBookings: totalBookings || 0,
        activeBookings: activeBookings || 0,
        totalFaults: totalFaults || 0,
        openFaults: openFaults || 0,
        resolvedFaults: resolvedFaults || 0
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="center">Laddar statistik...</p>

  return (
    <div className="center">
      <h2>Statistik</h2>
      <div className="container" style={{ textAlign: 'left' }}>
        <div className="card">
          <h3>Tvättbokningar</h3>
          <p>Totalt antal bokningar: <strong>{stats.totalBookings}</strong></p>
          <p>Aktiva bokningar: <strong>{stats.activeBookings}</strong></p>
        </div>
        <div className="card">
          <h3>Felanmälningar</h3>
          <p>Totalt antal: <strong>{stats.totalFaults}</strong></p>
          <p>Öppna: <strong>{stats.openFaults}</strong></p>
          <p>Lösta: <strong>{stats.resolvedFaults}</strong></p>
        </div>
      </div>
    </div>
  )
}