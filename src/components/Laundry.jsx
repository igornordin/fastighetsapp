import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Laundry({ apartmentId }) {
  const [bookings, setBookings] = useState([])
  const [date, setDate] = useState('')
  const [startHour, setStartHour] = useState('07')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    bookable_start_hour: 7,
    bookable_end_hour: 21,
    max_bookings_per_month: 10,
    bookable_days: '1,2,3,4,5,6,7'
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [bookedIntervals, setBookedIntervals] = useState([])
  const [filterName, setFilterName] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = data?.role
    setIsAdmin(role === 'admin' || role === 'sysadmin')
    setIsSysAdmin(role === 'sysadmin')
    return role
  }

  const loadOrganizations = async (role) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (role === 'sysadmin') {
      const { data } = await supabase.from('organizations').select('id, name').order('name')
      setOrganizations(data || [])
      if (data?.length) setSelectedOrgId(data[0].id)
    } else if (role === 'admin') {
      const { data: adminOrgs } = await supabase
        .from('admin_organizations')
        .select('organizations(id, name)')
        .eq('profile_id', user.id)
      const orgs = (adminOrgs || []).map(ao => ao.organizations).filter(Boolean)
      setOrganizations(orgs)
      if (orgs.length) setSelectedOrgId(orgs[0].id)
    }
  }

  const getDateFilter = () => {
    const now = new Date()
    if (isAdmin) {
      const oneYearAgo = new Date(now)
      oneYearAgo.setFullYear(now.getFullYear() - 1)
      return oneYearAgo.toISOString()
    } else {
      const oneWeekAgo = new Date(now)
      oneWeekAgo.setDate(now.getDate() - 7)
      return oneWeekAgo.toISOString()
    }
  }

  const fetchBookings = async (orgId) => {
    let query = supabase
      .from('laundry_bookings')
      .select('*, profiles(full_name, email)')
      .gte('start_time', getDateFilter())
      .order('start_time', { ascending: false })

    if (isAdmin && orgId) query = query.eq('organization_id', orgId)
    else if (apartmentId) query = query.eq('apartment_id', apartmentId)

    const { data } = await query
    setBookings(data || [])
  }

  const fetchSettings = async (orgId) => {
    if (!orgId) return
    const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single()
    if (data) setSettings(data)
  }

  const fetchBookedIntervals = async (selectedDate, orgId) => {
    if (!selectedDate || !orgId) {
      setBookedIntervals([])
      return
    }

    const startOfDay = `${selectedDate}T00:00:00`
    const endOfDay = `${selectedDate}T23:59:59`

    const { data, error } = await supabase
      .from('laundry_bookings')
      .select('start_hour, duration_hours')
      .eq('organization_id', orgId)
      .neq('status', 'cancelled')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)

    if (error) {
      console.error('Kunde inte hämta bokade tider:', error)
      setBookedIntervals([])
      return
    }

    const intervals = (data || []).map(b => ({
      startHour: b.start_hour,
      endHour: b.start_hour + (b.duration_hours || 4)
    }))
    setBookedIntervals(intervals)
  }

  const isBlockedByExisting = (hour) => {
    const h = parseInt(hour)
    return bookedIntervals.some(i => h >= i.startHour && h < i.endHour)
  }

  const isPastTime = (hour) => {
    if (!date) return false
    const today = new Date().toISOString().slice(0, 10)
    if (date !== today) return false

    const now = new Date()
    const currentHour = now.getHours()
    return parseInt(hour) <= currentHour
  }

  const getDisplayStatus = (booking) => {
    if (booking.status === 'cancelled') return 'Avbokad'
    if (booking.status === 'completed') return 'Genomförd'
    const endTime = new Date(booking.start_time)
    endTime.setHours(endTime.getHours() + (booking.duration_hours || 4))
    if (endTime < new Date()) return 'Genomförd'
    return 'Kommande'
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Kommande':
        return { backgroundColor: '#16a34a', color: 'white' }
      case 'Genomförd':
        return { backgroundColor: '#64748b', color: 'white' }
      case 'Avbokad':
        return { backgroundColor: '#dc2626', color: 'white' }
      default:
        return { backgroundColor: '#334155', color: 'white' }
    }
  }

  useEffect(() => {
    const init = async () => {
      const role = await checkAdmin()
      if (role === 'admin' || role === 'sysadmin') {
        await loadOrganizations(role)
      } else {
        fetchBookings()
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
        if (profile?.organization_id) {
          fetchSettings(profile.organization_id)
          setSelectedOrgId(profile.organization_id)
        }
      }
    }
    init()
  }, [apartmentId])

  useEffect(() => {
    if (selectedOrgId && isAdmin) {
      fetchBookings(selectedOrgId)
      fetchSettings(selectedOrgId)
    }
  }, [selectedOrgId, isAdmin])

  useEffect(() => {
    if (date && selectedOrgId) fetchBookedIntervals(date, selectedOrgId)
    else setBookedIntervals([])
  }, [date, selectedOrgId])

  useEffect(() => {
    const availableHours = []
    for (let h = settings.bookable_start_hour; h <= settings.bookable_end_hour - 4; h++) {
      const hourStr = String(h).padStart(2, '0')
      if (!isBlockedByExisting(hourStr) && !isPastTime(hourStr)) availableHours.push(hourStr)
    }
    if (availableHours.length > 0 && !availableHours.includes(startHour)) {
      setStartHour(availableHours[0])
    }
  }, [bookedIntervals, settings, date])

  const addBooking = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = isAdmin ? selectedOrgId : profile?.organization_id

    if (!orgId) {
      alert('Ingen fastighet vald')
      setLoading(false)
      return
    }

    const startHourNum = parseInt(startHour)
    const startTime = `${date}T${startHour.padStart(2, '0')}:00:00`

    const { error } = await supabase.from('laundry_bookings').insert({
      user_id: user.id,
      organization_id: orgId,
      apartment_id: isAdmin ? null : apartmentId,
      start_time: startTime,
      end_time: startTime,
      start_hour: startHourNum,
      duration_hours: 4,
      status: 'booked'
    })

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      setDate('')
      setStartHour('07')
      if (isAdmin) fetchBookings(selectedOrgId)
      else fetchBookings()
      fetchBookedIntervals(date, orgId)
    }
    setLoading(false)
  }

  const cancelBooking = async (id) => {
    if (!confirm('Avboka?')) return

    const { error } = await supabase.from('laundry_bookings').update({ status: 'cancelled' }).eq('id', id)

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      if (isAdmin) fetchBookings(selectedOrgId)
      else fetchBookings()
      if (date && selectedOrgId) fetchBookedIntervals(date, selectedOrgId)
    }
  }

  const permanentlyDeleteBooking = async (id) => {
    if (!confirm('Är du säker på att du vill radera denna bokning permanent?')) return

    const { error } = await supabase.from('laundry_bookings').delete().eq('id', id)

    if (error) {
      alert('Fel vid radering: ' + error.message)
    } else {
      if (isAdmin) fetchBookings(selectedOrgId)
      else fetchBookings()
      if (date && selectedOrgId) fetchBookedIntervals(date, selectedOrgId)
    }
  }

  const availableHours = []
  for (let h = settings.bookable_start_hour; h <= settings.bookable_end_hour - 4; h++) {
    const hourStr = String(h).padStart(2, '0')
    if (!isBlockedByExisting(hourStr) && !isPastTime(hourStr)) availableHours.push(hourStr)
  }

  const uniqueNames = [...new Set(bookings.map(b => b.profiles?.full_name || b.profiles?.email || 'Okänd'))].sort()

  const filteredBookings = bookings.filter(b => {
    const name = b.profiles?.full_name || b.profiles?.email || 'Okänd'
    const status = getDisplayStatus(b)
    const nameMatch = !filterName || name === filterName
    const statusMatch = !filterStatus || status === filterStatus
    return nameMatch && statusMatch
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <h2>Tvättbokning</h2>

      {isAdmin && organizations.length > 0 && (
        <label style={{ display: 'block', marginBottom: '1.5rem' }}>
          Välj fastighet:
          <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}
            style={{ display: 'block', width: '100%', maxWidth: '400px', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}>
            {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
      )}

      <form onSubmit={addBooking} style={{ marginBottom: '2rem' }}>
        <h3>Ny bokning (4 timmar)</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required min={today}
          style={{ display: 'block', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }} />
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Starttid:
          <select value={startHour} onChange={(e) => setStartHour(e.target.value)}
            style={{ display: 'block', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }}>
            {availableHours.map(hour => (
              <option key={hour} value={hour}>{hour}:00</option>
            ))}
          </select>
        </label>
        <button disabled={loading || availableHours.length === 0}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? 'Bokar...' : 'Boka 4 timmar'}
        </button>
      </form>

      {isAdmin && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label>
            Filtrera på namn:
            <select value={filterName} onChange={(e) => setFilterName(e.target.value)}
              style={{ display: 'block', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }}>
              <option value="">Alla</option>
              {uniqueNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Filtrera på status:
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              style={{ display: 'block', marginTop: '0.3rem', padding: '0.5rem', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '6px' }}>
              <option value="">Alla</option>
              <option value="Kommande">Kommande</option>
              <option value="Genomförd">Genomförd</option>
              <option value="Avbokad">Avbokad</option>
            </select>
          </label>
        </div>
      )}

      <div>
        {filteredBookings.length === 0 && <p style={{ color: '#94a3b8' }}>Inga bokningar.</p>}
        {filteredBookings.map(b => {
          const status = getDisplayStatus(b)
          return (
            <div key={b.id} style={{ border: '1px solid #334155', padding: '1rem', marginBottom: '0.5rem', borderRadius: '8px', backgroundColor: '#1e293b' }}>
              <div>{b.start_time?.slice(0, 10)} {String(b.start_hour).padStart(2, '0')}:00 – {String(b.start_hour + 4).padStart(2, '0')}:00</div>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>Status:</strong>{' '}
                <span style={{
                  ...getStatusStyle(status),
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}>
                  {status}
                </span>
              </p>
              {isAdmin && <p><strong>Bokad av:</strong> {b.profiles?.full_name || b.profiles?.email || 'Okänd'}</p>}
              
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                {status !== 'Genomförd' && status !== 'Avbokad' && (
                  <button onClick={() => cancelBooking(b.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Avboka
                  </button>
                )}
                {isSysAdmin && (
                  <button onClick={() => permanentlyDeleteBooking(b.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#7f1d1d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Radera
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}