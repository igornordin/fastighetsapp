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

export default function Users() {
  const [users, setUsers] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [myOrganizations, setMyOrganizations] = useState([])
  const [apartments, setApartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [myOrganizationId, setMyOrganizationId] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('tenant')
  const [organizationId, setOrganizationId] = useState('')
  const [selectedOrgIds, setSelectedOrgIds] = useState([])
  const [apartmentId, setApartmentId] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (showForm && role === 'tenant') {
      const orgId = organizationId || myOrganizationId
      if (orgId) fetchApartments(orgId)
    }
  }, [showForm, role, organizationId, myOrganizationId])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    const sysAdmin = profile?.role === 'sysadmin'
    setIsSysAdmin(sysAdmin)
    setMyOrganizationId(profile?.organization_id || '')

    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .order('name')
    setOrganizations(orgs || [])

    if (!sysAdmin) {
      const { data: adminOrgs } = await supabase
        .from('admin_organizations')
        .select('organization_id, organizations(name)')
        .eq('profile_id', user.id)

      const myOrgs = (adminOrgs || []).map(ao => ({
        id: ao.organization_id,
        name: ao.organizations?.name
      }))
      setMyOrganizations(myOrgs.length > 0 ? myOrgs : orgs?.filter(o => o.id === profile?.organization_id) || [])
    } else {
      setMyOrganizations(orgs || [])
    }

    const { data: userData, error } = await supabase
      .from('profiles')
      .select(`
        *,
        apartments(name),
        organizations(name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fel vid hämtning:', error)
      setUsers([])
      return
    }

    const { data: allAdminOrgs } = await supabase
      .from('admin_organizations')
      .select('profile_id, organizations(name)')

    const adminOrgMap = {}
    ;(allAdminOrgs || []).forEach(ao => {
      if (!adminOrgMap[ao.profile_id]) adminOrgMap[ao.profile_id] = []
      if (ao.organizations?.name) adminOrgMap[ao.profile_id].push(ao.organizations.name)
    })

    const enriched = (userData || []).map(u => ({
      ...u,
      allOrganizations: adminOrgMap[u.id] || (u.organizations?.name ? [u.organizations.name] : [])
    }))

    if (sysAdmin) {
      setUsers(enriched)
    } else {
      const allowedOrgIds = (await supabase
        .from('admin_organizations')
        .select('organization_id')
        .eq('profile_id', user.id)
      ).data?.map(o => o.organization_id) || [profile?.organization_id]

      const filtered = enriched.filter(u => allowedOrgIds.includes(u.organization_id))
      setUsers(filtered)
    }
  }

  const fetchApartments = async (orgId) => {
    if (!orgId) {
      setApartments([])
      return
    }
    const { data } = await supabase
      .from('apartments')
      .select('*')
      .eq('organization_id', orgId)
      .order('name')
    setApartments(data || [])
  }

  const handleOrgChange = (e) => {
    const orgId = e.target.value
    setOrganizationId(orgId)
    setApartmentId('')
    fetchApartments(orgId)
  }

  const toggleOrg = (orgId) => {
    setSelectedOrgIds(prev =>
      prev.includes(orgId)
        ? prev.filter(id => id !== orgId)
        : [...prev, orgId]
    )
  }

  const startEdit = async (user) => {
    setEditingUser(user)
    setEmail(user.email || '')
    setFullName(user.full_name || '')
    setRole(user.role || 'tenant')
    setOrganizationId(user.organization_id || '')
    setApartmentId(user.apartment_id || '')
    setPassword('')
    
    const { data: adminOrgs } = await supabase
      .from('admin_organizations')
      .select('organization_id')
      .eq('profile_id', user.id)
    
    setSelectedOrgIds(adminOrgs?.map(ao => ao.organization_id) || [])
    
    setShowForm(true)
    if (user.organization_id) fetchApartments(user.organization_id)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingUser(null)
    setEmail('')
    setPassword('')
    setFullName('')
    setRole('tenant')
    setOrganizationId('')
    setSelectedOrgIds([])
    setApartmentId('')
    setApartments([])
  }

  const saveUser = async (e) => {
    e.preventDefault()
    setLoading(true)

    const finalOrgId = organizationId || myOrganizationId

    const orgIds = (role === 'admin' || role === 'sysadmin')
      ? selectedOrgIds
      : (finalOrgId ? [finalOrgId] : [])

    const body = {
      email,
      password: password.trim() || undefined,
      full_name: fullName,
      role,
      organization_ids: orgIds,
      apartment_id: (role === 'tenant' && apartmentId) ? apartmentId : null
    }

    if (editingUser) body.user_id = editingUser.id
    else body.action = 'create'

    const { data, error } = await supabase.functions.invoke('admin-update-user', { body })

    if (error || data?.error) {
      alert('Fel: ' + (error?.message || data?.error))
    } else {
      alert(editingUser ? 'Användare uppdaterad!' : 'Användare skapad!')
      cancelForm()
      loadData()
    }
    setLoading(false)
  }

  const deleteUser = async (userId) => {
    if (!confirm('Ta bort användaren permanent?')) return
    
    const { data, error } = await supabase.functions.invoke('admin-update-user', {
      body: { user_id: userId, action: 'delete' }
    })

    if (error || data?.error) {
      alert('Fel: ' + (error?.message || data?.error))
    } else {
      alert('Användare borttagen!')
      loadData()
    }
  }

  const canDelete = (user) => {
    if (user.role === 'sysadmin') return false
    if (isSysAdmin) return true
    return myOrganizations.some(o => o.id === user.organization_id)
  }

  return (
    <div>
      <h2>Användare</h2>
      <button 
        onClick={() => editingUser ? cancelForm() : setShowForm(!showForm)} 
        style={{ ...buttonStyles.primary, marginBottom: '1rem' }}
      >
        {showForm ? 'Avbryt' : 'Skapa ny användare'}
      </button>

      {showForm && (
        <form onSubmit={saveUser} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#1e293b' }}>
          <h3>{editingUser ? 'Redigera användare' : 'Ny användare'}</h3>
          
          <input 
            type="email" 
            placeholder="E-post" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }} 
          />
          
          <input 
            type="password" 
            placeholder={editingUser ? "Nytt lösenord (lämna tomt för att behålla)" : "Lösenord (lämna tomt för inbjudan)"}
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }} 
          />
          
          <input 
            type="text" 
            placeholder="Namn" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)}
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }} 
          />

          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
          >
            <option value="tenant">Hyresgäst</option>
            <option value="admin">Admin</option>
            {isSysAdmin && <option value="sysadmin">Systemadmin</option>}
          </select>

          {role === 'tenant' && (
            <>
              {myOrganizations.length > 1 ? (
                <select 
                  value={organizationId} 
                  onChange={handleOrgChange} 
                  required
                  style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
                >
                  <option value="">Välj fastighet</option>
                  {myOrganizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              ) : (
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Fastighet:</strong> {myOrganizations[0]?.name || 'Min fastighet'}
                </div>
              )}

              <select 
                value={apartmentId} 
                onChange={(e) => setApartmentId(e.target.value)} 
                required
                disabled={!(organizationId || myOrganizationId)}
                style={{ display: 'block', marginBottom: '0.5rem', width: '100%', maxWidth: '400px', padding: '0.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px' }}
              >
                <option value="">Välj lägenhet</option>
                {apartments.map(apt => (
                  <option key={apt.id} value={apt.id}>{apt.name}</option>
                ))}
              </select>
            </>
          )}

          {(role === 'admin' || role === 'sysadmin') && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Välj fastigheter denna admin får hantera:</strong>
              <div style={{ marginTop: '0.5rem' }}>
                {(isSysAdmin ? organizations : myOrganizations).map(org => (
                  <label key={org.id} style={{ display: 'block', marginBottom: '0.3rem' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedOrgIds.includes(org.id)} 
                      onChange={() => toggleOrg(org.id)} 
                      style={{ marginRight: '0.5rem' }} 
                    />
                    {org.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button disabled={loading} style={{ ...buttonStyles.primary, marginRight: '0.5rem' }}>
            {loading ? 'Sparar...' : (editingUser ? 'Spara ändringar' : 'Skapa användare')}
          </button>
          {editingUser && (
            <button type="button" onClick={cancelForm} style={buttonStyles.secondary}>
              Avbryt
            </button>
          )}
        </form>
      )}

      <div>
        {users.length === 0 && <p>Inga användare ännu.</p>}
        {users.map(user => (
          <div key={user.id} style={{ border: '1px solid #334155', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', backgroundColor: '#1e293b' }}>
            <strong>{user.full_name || 'Inget namn'}</strong> ({user.email})<br />
            Roll: {user.role}<br />
            Fastighet{user.allOrganizations?.length > 1 ? 'er' : ''}: {user.allOrganizations?.join(', ') || 'Ingen'}<br />
            Lägenhet: {user.apartments?.name || 'Ingen'}
            <div style={{ marginTop: '0.8rem' }}>
              <button onClick={() => startEdit(user)} style={buttonStyles.edit}>
                Redigera
              </button>
              {canDelete(user) && (
                <button onClick={() => deleteUser(user.id)} style={buttonStyles.danger}>
                  Ta bort
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}