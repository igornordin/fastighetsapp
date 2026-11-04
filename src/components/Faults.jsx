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
  secondary: {
    padding: '0.5rem 1rem',
    backgroundColor: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  success: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  warning: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
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

export default function Faults() {
  const [faults, setFaults] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetchFaults()
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    setIsAdmin(data?.role === 'admin' || data?.role === 'sysadmin')
  }

  const fetchFaults = async () => {
    const { data, error } = await supabase
      .from('fault_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      alert('Kunde inte hämta felanmälningar')
    } else {
      setFaults(data || [])
    }
  }

  const getImageUrl = (path) => {
    if (!path) return null
    const { data } = supabase.storage.from('fault-images').getPublicUrl(path)
    return data?.publicUrl
  }

  const addFault = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      let imagePath = null

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${profile.organization_id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('fault-images')
          .upload(filePath, imageFile)

        if (uploadError) throw uploadError
        imagePath = filePath
      }

      const { error } = await supabase
        .from('fault_reports')
        .insert({
          title,
          description,
          image_path: imagePath,
          organization_id: profile.organization_id,
          reporter_id: user.id,
          status: 'open'
        })

      if (error) throw error

      setTitle('')
      setDescription('')
      setImageFile(null)
      fetchFaults()
    } catch (err) {
      alert('Fel: ' + err.message)
    }
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('fault_reports')
      .update({ status })
      .eq('id', id)

    if (error) alert('Fel: ' + error.message)
    else fetchFaults()
  }

  return (
    <div>
      <h2>Felanmälan</h2>

      <form onSubmit={addFault} style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#1e293b', borderRadius: '8px' }}>
        <h3>Ny felanmälan</h3>
        <input
          type="text"
          placeholder="Rubrik"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
        />
        <textarea
          placeholder="Beskrivning"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', height: '100px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
        />
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          Bild (valfritt):
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
            style={{ display: 'block', marginTop: '0.3rem' }}
          />
        </label>
        <button disabled={loading} style={buttonStyles.primary}>
          {loading ? 'Sparar...' : 'Skicka felanmälan'}
        </button>
      </form>

      <div>
        {faults.length === 0 && <p>Inga felanmälningar ännu.</p>}
        {faults.map((fault) => (
          <div key={fault.id} style={{ border: '1px solid #334155', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', backgroundColor: '#1e293b' }}>
            <h3 style={{ marginTop: 0 }}>{fault.title}</h3>
            <p>{fault.description}</p>
            {fault.image_path && (
              <img 
                src={getImageUrl(fault.image_path)} 
                alt="Felanmälan" 
                style={{ maxWidth: '300px', margin: '0.5rem 0', borderRadius: '6px' }} 
              />
            )}
            <p><strong>Status:</strong> {fault.status === 'open' ? 'Öppen' : fault.status === 'in_progress' ? 'Pågående' : 'Löst'}</p>
            <small style={{ color: '#94a3b8' }}>{new Date(fault.created_at).toLocaleString('sv-SE')}</small>
            
            {isAdmin && (
              <div style={{ marginTop: '0.8rem' }}>
                <button onClick={() => updateStatus(fault.id, 'in_progress')} style={buttonStyles.warning}>
                  Pågående
                </button>
                <button onClick={() => updateStatus(fault.id, 'resolved')} style={{ ...buttonStyles.success, marginLeft: '0.5rem' }}>
                  Löst
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}