import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const buttonStyles = {
  primary: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500
  },
  dayActive: {
    margin: '0.2rem',
    padding: '0.4rem 0.6rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  dayInactive: {
    margin: '0.2rem',
    padding: '0.4rem 0.6rem',
    backgroundColor: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  }
}

const defaultSettings = {
  max_concurrent_bookings: 1,
  max_bookings_per_week: 3,
  max_bookings_per_month: 10,
  bookable_days: '1,2,3,4,5,6,7',
  bookable_start_hour: 7,
  bookable_end_hour: 21
}

export default function Settings() {
  const [organizations, setOrganizations] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [isSysAdmin, setIsSysAdmin] = useState(false)

  useEffect(() => {
    loadOrganizations()
  }, [])

  useEffect(() => {
    if (selectedOrgId) loadSettings(selectedOrgId)
  }, [selectedOrgId])

  const loadOrganizations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    const sysAdmin = profile?.role === 'sysadmin'
    setIsSysAdmin(sysAdmin)

    if (sysAdmin) {
      const { data } = await supabase.from('organizations').select('id, name').order('name')
      setOrganizations(data || [])
      if (data?.length) setSelectedOrgId(data[0].id)
    } else {
      const { data: adminOrgs } = await supabase
        .from('admin_organizations')
        .select('organizations(id, name)')
        .eq('profile_id', user.id)

      const orgs = (adminOrgs || [])
        .map(ao => ao.organizations)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))

      if (orgs.length === 0 && profile?.organization_id) {
        const { data: single } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', profile.organization_id)
          .single()
        setOrganizations(single ? [single] : [])
        if (single) setSelectedOrgId(single.id)
      } else {
        setOrganizations(orgs)
        if (orgs.length) setSelectedOrgId(orgs[0].id)
      }
    }
  }

  const loadSettings = async (orgId) => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (data) {
      setSettings({
        max_concurrent_bookings: data.max_concurrent_bookings ?? defaultSettings.max_concurrent_bookings,
        max_bookings_per_week: data.max_bookings_per_week ?? defaultSettings.max_bookings_per_week,
        max_bookings_per_month: data.max_bookings_per_month ?? defaultSettings.max_bookings_per_month,
        bookable_days: data.bookable_days || defaultSettings.bookable_days,
        bookable_start_hour: data.bookable_start_hour ?? defaultSettings.bookable_start_hour,
        bookable_end_hour: data.bookable_end_hour ?? defaultSettings.bookable_end_hour
      })
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!selectedOrgId) return
    setLoading(true)

    const { error } = await supabase
      .from('organizations')
      .update({
        max_concurrent_bookings: parseInt(settings.max_concurrent_bookings),
        max_bookings_per_week: parseInt(settings.max_bookings_per_week),
        max_bookings_per_month: parseInt(settings.max_bookings_per_month),
        bookable_days: settings.bookable_days,
        bookable_start_hour: parseInt(settings.bookable_start_hour),
        bookable_end_hour: parseInt(settings.bookable_end_hour)
      })
      .eq('id', selectedOrgId)

    if (error) alert('Fel: ' + error.message)
    else alert('Inställningar sparade!')
    setLoading(false)
  }

  const toggleDay = (day) => {
    const days = settings.bookable_days.split(',').filter(Boolean)
    const newDays = days.includes(day)
      ? days.filter(d => d !== day)
      : [...days, day].sort()
    setSettings({ ...settings, bookable_days: newDays.join(',') })
  }

  const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

  return (
    <div>
      <h2>Inställningar</h2>

      {organizations.length > 1 && (
        <label style={{ display: 'block', marginBottom: '1.5rem' }}>
          Välj fastighet:
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            style={{ display: 'block', width: '100%', maxWidth: '400px', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          >
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </label>
      )}

      {organizations.length === 1 && (
        <p style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
          Fastighet: <strong>{organizations[0]?.name}</strong>
        </p>
      )}

      <form onSubmit={save} style={{ maxWidth: '400px' }}>
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          Max samtidiga bokningar:
          <input
            type="number"
            min="1"
            value={settings.max_concurrent_bookings}
            onChange={e => setSettings({ ...settings, max_concurrent_bookings: e.target.value })}
            style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          Max bokningar per vecka:
          <input
            type="number"
            min="1"
            value={settings.max_bookings_per_week}
            onChange={e => setSettings({ ...settings, max_bookings_per_week: e.target.value })}
            style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          Max bokningar per månad:
          <input
            type="number"
            min="1"
            value={settings.max_bookings_per_month}
            onChange={e => setSettings({ ...settings, max_bookings_per_month: e.target.value })}
            style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
        </label>

        <div style={{ marginBottom: '1rem' }}>
          <strong>Bokningsbara dagar:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            {dayNames.map((name, i) => {
              const day = String(i + 1)
              const active = settings.bookable_days.split(',').includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={active ? buttonStyles.dayActive : buttonStyles.dayInactive}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          Tidigaste bokningstid (timme):
          <input
            type="number"
            min="0"
            max="23"
            value={settings.bookable_start_hour}
            onChange={e => setSettings({ ...settings, bookable_start_hour: e.target.value })}
            style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          Senaste bokningstid (timme):
          <input
            type="number"
            min="0"
            max="23"
            value={settings.bookable_end_hour}
            onChange={e => setSettings({ ...settings, bookable_end_hour: e.target.value })}
            style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
        </label>

        <button disabled={loading || !selectedOrgId} style={buttonStyles.primary}>
          {loading ? 'Sparar...' : 'Spara inställningar'}
        </button>
      </form>
    </div>
  )
}