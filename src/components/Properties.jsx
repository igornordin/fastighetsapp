import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Properties({ onSelectOrganization }) {
  const [organizations, setOrganizations] = useState([])
  const [apartments, setApartments] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [name, setName] = useState('')
  const [apartmentName, setApartmentName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [editingOrg, setEditingOrg] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadOrganizations()
  }, [])

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
      const { data } = await supabase.from('organizations').select('*').order('name')
      setOrganizations(data || [])
    } else {
      const { data: adminOrgs } = await supabase
        .from('admin_organizations')
        .select('organizations(*)')
        .eq('profile_id', user.id)

      const orgs = (adminOrgs || [])
        .map(ao => ao.organizations)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))

      if (orgs.length === 0 && profile?.organization_id) {
        const { data: single } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .single()
        setOrganizations(single ? [single] : [])
      } else {
        setOrganizations(orgs)
      }
    }
  }

  const loadApartments = async (orgId) => {
    const { data } = await supabase
      .from('apartments')
      .select('*')
      .eq('organization_id', orgId)
      .order('name')
    setApartments(data || [])
  }

  const addOrganization = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('organizations')
      .insert({ name })

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      setName('')
      loadOrganizations()
    }
    setLoading(false)
  }

  const updateOrganization = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('organizations')
      .update({ name: editName })
      .eq('id', editingOrg.id)

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      setEditingOrg(null)
      setEditName('')
      loadOrganizations()
    }
    setLoading(false)
  }

  const deleteOrganization = async (id) => {
    if (!confirm('Ta bort fastigheten? Alla lägenheter och data kopplade till den försvinner.')) return
    
    const { error } = await supabase.from('organizations').delete().eq('id', id)
    if (error) alert('Fel: ' + error.message)
    else loadOrganizations()
  }

  const addApartment = async (e) => {
    e.preventDefault()
    if (!selectedOrg) return
    setLoading(true)

    const { error } = await supabase
      .from('apartments')
      .insert({
        name: apartmentName,
        organization_id: selectedOrg.id
      })

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      setApartmentName('')
      loadApartments(selectedOrg.id)
    }
    setLoading(false)
  }

  const deleteApartment = async (id) => {
    if (!confirm('Ta bort lägenheten?')) return
    const { error } = await supabase.from('apartments').delete().eq('id', id)
    if (error) alert('Fel: ' + error.message)
    else loadApartments(selectedOrg.id)
  }

  const openOrganization = (org) => {
    setSelectedOrg(org)
    loadApartments(org.id)
  }

  const goBack = () => {
    setSelectedOrg(null)
    setApartments([])
  }

  if (selectedOrg) {
    return (
      <div>
        <button onClick={goBack} style={{ marginBottom: '1rem', padding: '0.4rem 0.8rem', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          ← Tillbaka
        </button>
        <h2>{selectedOrg.name}</h2>
        <p style={{ color: '#94a3b8' }}>Lägenheter i denna fastighet</p>

        <form onSubmit={addApartment} style={{ marginBottom: '2rem' }}>
          <h3>Ny lägenhet</h3>
          <input
            type="text"
            placeholder="Namn (t.ex. 1101)"
            value={apartmentName}
            onChange={(e) => setApartmentName(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', padding: '0.5rem', width: '200px', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
          <button disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            {loading ? 'Sparar...' : 'Lägg till lägenhet'}
          </button>
        </form>

        <div>
          {apartments.length === 0 && <p>Inga lägenheter ännu.</p>}
          {apartments.map(apt => (
            <div key={apt.id} style={{ border: '1px solid #334155', padding: '1rem', marginBottom: '0.5rem', borderRadius: '6px', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{apt.name}</strong>
              <button onClick={() => deleteApartment(apt.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>
                Ta bort
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>Fastigheter</h2>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Klicka på en fastighet för att se och hantera lägenheter.
      </p>

      {isSysAdmin && (
        <form onSubmit={addOrganization} style={{ marginBottom: '2rem' }}>
          <h3>Ny fastighet</h3>
          <input
            type="text"
            placeholder="Namn på fastighet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', padding: '0.5rem', width: '100%', maxWidth: '400px', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
          <button disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            {loading ? 'Sparar...' : 'Lägg till fastighet'}
          </button>
        </form>
      )}

      {editingOrg && (
        <form onSubmit={updateOrganization} style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#1e293b', borderRadius: '8px' }}>
          <h3>Redigera fastighet</h3>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', padding: '0.5rem', width: '100%', maxWidth: '400px', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          />
          <button disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginRight: '0.5rem' }}>
            {loading ? 'Sparar...' : 'Spara'}
          </button>
          <button type="button" onClick={() => setEditingOrg(null)} style={{ padding: '0.5rem 1rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Avbryt
          </button>
        </form>
      )}

      <div>
        {organizations.length === 0 && <p>Inga fastigheter ännu.</p>}
        {organizations.map(org => (
          <div 
            key={org.id} 
            style={{ border: '1px solid #334155', padding: '1rem', marginBottom: '0.5rem', borderRadius: '8px', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <strong>{org.name}</strong>
            <div>
              <button 
                onClick={() => openOrganization(org)}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.95rem', marginRight: '1rem' }}
              >
                Öppna →
              </button>
              {isSysAdmin && (
                <>
                  <button 
                    onClick={() => { setEditingOrg(org); setEditName(org.name) }}
                    style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '0.95rem', marginRight: '0.5rem' }}
                  >
                    Redigera
                  </button>
                  <button 
                    onClick={() => deleteOrganization(org.id)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem' }}
                  >
                    Ta bort
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}