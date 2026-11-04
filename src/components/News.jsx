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
    fontWeight: 500,
    marginRight: '0.5rem'
  },
  secondary: {
    padding: '0.5rem 1rem',
    backgroundColor: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  edit: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    marginRight: '0.5rem'
  },
  danger: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  }
}

export default function News() {
  const [news, setNews] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        setIsAdmin(data?.role === 'admin' || data?.role === 'sysadmin')
      }
    }
    checkAdmin()
    fetchNews()
  }, [])

  const fetchNews = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    const isSysAdmin = profile?.role === 'sysadmin'
    const myOrgId = profile?.organization_id

    let query = supabase
      .from('news_posts')
      .select('*')
      .order('published_at', { ascending: false })

    if (!isSysAdmin && myOrgId) {
      query = query.eq('organization_id', myOrgId)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      alert('Kunde inte hämta nyheter')
    } else {
      setNews(data || [])
    }
  }

  const addOrUpdateNews = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (editingId) {
      const { error } = await supabase
        .from('news_posts')
        .update({ title, content })
        .eq('id', editingId)

      if (error) {
        alert('Fel: ' + error.message)
      } else {
        setTitle('')
        setContent('')
        setEditingId(null)
        fetchNews()
      }
    } else {
      const { error } = await supabase
        .from('news_posts')
        .insert({
          title,
          content,
          author_id: user.id,
          organization_id: profile.organization_id
        })

      if (error) {
        alert('Fel: ' + error.message)
      } else {
        setTitle('')
        setContent('')
        fetchNews()
      }
    }
    setLoading(false)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setTitle(item.title)
    setContent(item.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setContent('')
  }

  const deleteNews = async (id) => {
    if (!confirm('Vill du verkligen ta bort denna nyhet?')) return

    const { error } = await supabase
      .from('news_posts')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      fetchNews()
    }
  }

  return (
    <div>
      <h2>Nyheter</h2>

      {isAdmin && (
        <form onSubmit={addOrUpdateNews} style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#1e293b', borderRadius: '8px' }}>
          <h3>{editingId ? 'Redigera nyhet' : 'Skapa ny nyhet'}</h3>
          <input
            type="text"
            placeholder="Rubrik"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
          <textarea
            placeholder="Innehåll"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', height: '100px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
          <button disabled={loading} style={buttonStyles.primary}>
            {loading ? 'Sparar...' : (editingId ? 'Spara ändringar' : 'Publicera')}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={buttonStyles.secondary}>
              Avbryt
            </button>
          )}
        </form>
      )}

      <div>
        {news.length === 0 && <p>Inga nyheter ännu.</p>}
        {news.map((item) => (
          <div key={item.id} style={{ border: '1px solid #334155', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', backgroundColor: '#1e293b' }}>
            <h3 style={{ marginTop: 0 }}>{item.title}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p>
            <small style={{ color: '#94a3b8' }}>{new Date(item.published_at).toLocaleString('sv-SE')}</small>
            
            {isAdmin && (
              <div style={{ marginTop: '0.8rem' }}>
                <button onClick={() => startEdit(item)} style={buttonStyles.edit}>
                  Redigera
                </button>
                <button onClick={() => deleteNews(item.id)} style={buttonStyles.danger}>
                  Ta bort
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}