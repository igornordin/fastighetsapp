import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    properties: 0,
    activeFaults: 0,
    overdue: 0
  })
  const [loading, setLoading] = useState(true)
  const [isSysAdmin, setIsSysAdmin] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      const sysAdmin = profile?.role === 'sysadmin'
      setIsSysAdmin(sysAdmin)

      let orgIds = []
      if (sysAdmin) {
        orgIds = null // alla
      } else {
        const { data: adminOrgs } = await supabase
          .from('admin_organizations')
          .select('organization_id')
          .eq('profile_id', user.id)
        orgIds = adminOrgs?.map(ao => ao.organization_id) || [profile?.organization_id].filter(Boolean)
      }

      // Räkna fastigheter
      let propertyQuery = supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })

      if (orgIds && orgIds.length > 0) {
        propertyQuery = propertyQuery.in('id', orgIds)
      }

      const { count: propertyCount } = await propertyQuery

      // Räkna aktiva felanmälningar
      let faultQuery = supabase
        .from('fault_reports')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'resolved')

      if (orgIds && orgIds.length > 0) {
        faultQuery = faultQuery.in('organization_id', orgIds)
      }

      const { count: activeCount } = await faultQuery

      // Räkna förfallna
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      let overdueQuery = supabase
        .from('fault_reports')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'resolved')
        .lt('created_at', weekAgo.toISOString())

      if (orgIds && orgIds.length > 0) {
        overdueQuery = overdueQuery.in('organization_id', orgIds)
      }

      const { count: overdueCount } = await overdueQuery

      setStats({
        properties: propertyCount || 0,
        activeFaults: activeCount || 0,
        overdue: overdueCount || 0
      })
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (loading) return <p>Laddar översikt...</p>

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Översikt</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        marginTop: '1rem'
      }}>
        <div style={cardStyle} onClick={() => onNavigate?.('properties')}>
          <div style={{ fontSize: '2rem' }}>🏢</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 600 }}>{stats.properties}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            {isSysAdmin ? 'Fastigheter' : 'Mina fastigheter'}
          </div>
        </div>
        <div style={cardStyle} onClick={() => onNavigate?.('faults')}>
          <div style={{ fontSize: '2rem' }}>🔧</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 600 }}>{stats.activeFaults}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aktiva ärenden</div>
        </div>
        <div style={cardStyle} onClick={() => onNavigate?.('faults')}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 600 }}>{stats.overdue}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Förfallna</div>
        </div>
      </div>
    </div>
  )
}

const cardStyle = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  padding: '1.2rem',
  textAlign: 'center',
  cursor: 'pointer'
}