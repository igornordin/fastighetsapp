import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PropertyDetail({ apartmentId, onBack }) {
  const [apartment, setApartment] = useState(null)
  const [users, setUsers] = useState([])
  const [news, setNews] = useState([])
  const [faults, setFaults] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (apartmentId) loadAll()
  }, [apartmentId])

  const loadAll = async () => {
    setLoading(true)
    try {
      // Fastighet
      const { data: apt } = await supabase
        .from('apartments')
        .select('*')
        .eq('id', apartmentId)
        .single()
      setApartment(apt)

      // Användare kopplade till fastigheten
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('apartment_id', apartmentId)
      setUsers(userData || [])

      // Nyheter
      const { data: newsData } = await supabase
        .from('news_posts')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('published_at', { ascending: false })
      setNews(newsData || [])

      // Felanmälningar
      const { data: faultData } = await supabase
        .from('fault_reports')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('created_at', { ascending: false })
      setFaults(faultData || [])

      // Tvättbokningar
      const { data: bookingData } = await supabase
        .from('laundry_bookings')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('start_time', { ascending: false })
      setBookings(bookingData || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (loading) return <p>Laddar...</p>
  if (!apartment) return <p>Fastighet hittades inte</p>

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: '1rem', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer' }}>
        ← Tillbaka
      </button>
      <h2>{apartment.name}</h2>

      <section style={sectionStyle}>
        <h3>Användare ({users.length})</h3>
        {users.length === 0 && <p style={{ color: '#94a3b8' }}>Inga användare</p>}
        {users.map(u => (
          <div key={u.id} style={itemStyle}>
            {u.full_name || u.email} <span style={{ color: '#94a3b8' }}>({u.role})</span>
          </div>
        ))}
      </section>

      <section style={sectionStyle}>
        <h3>Nyheter ({news.length})</h3>
        {news.length === 0 && <p style={{ color: '#94a3b8' }}>Inga nyheter</p>}
        {news.map(n => (
          <div key={n.id} style={itemStyle}>
            <strong>{n.title}</strong>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{n.content?.substring(0, 80)}...</div>
          </div>
        ))}
      </section>

      <section style={sectionStyle}>
        <h3>Felanmälningar ({faults.length})</h3>
        {faults.length === 0 && <p style={{ color: '#94a3b8' }}>Inga felanmälningar</p>}
        {faults.map(f => (
          <div key={f.id} style={itemStyle}>
            <strong>{f.title}</strong>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Status: {f.status}</div>
          </div>
        ))}
      </section>

      <section style={sectionStyle}>
        <h3>Tvättbokningar ({bookings.length})</h3>
        {bookings.length === 0 && <p style={{ color: '#94a3b8' }}>Inga bokningar</p>}
        {bookings.map(b => (
          <div key={b.id} style={itemStyle}>
            {new Date(b.start_time).toLocaleString('sv-SE')}
          </div>
        ))}
      </section>
    </div>
  )
}

const sectionStyle = { marginBottom: '1.5rem', backgroundColor: '#1e293b', padding: '1rem', borderRadius: '10px' }
const itemStyle = { padding: '0.6rem 0', borderBottom: '1px solid #334155' }