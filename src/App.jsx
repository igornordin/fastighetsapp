import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import News from './components/News'
import Faults from './components/Faults'
import Laundry from './components/Laundry'
import Users from './components/Users'
import Settings from './components/Settings'
import Properties from './components/Properties'

function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('news')
  const [isAdmin, setIsAdmin] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [userApartment, setUserApartment] = useState(null)
  const [activeApartment, setActiveApartment] = useState(null)
  const [menuOpen, setMenuOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [userName, setUserName] = useState('')

  const checkUser = async (userId) => {
    if (!userId) {
      setIsAdmin(false)
      setUserApartment(null)
      setActiveApartment(null)
      setUserName('')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, apartment_id, apartments(name)')
      .eq('id', userId)
      .single()

    if (profile) {
      const admin = profile.role === 'admin' || profile.role === 'sysadmin'
      setIsAdmin(admin)
      setUserName(profile.full_name || '')
      setUserApartment(profile.apartments)
      setActiveApartment(profile.apartment_id)
      if (!admin) setPage('news')
    }
  }

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMenuOpen(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkUser(session.user.id)
        if (!session.user.user_metadata?.password_set) {
          setNeedsPassword(true)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkUser(session.user.id)
        if (!session.user.user_metadata?.password_set) {
          setNeedsPassword(true)
        }
      } else {
        setIsAdmin(false)
        setUserApartment(null)
        setActiveApartment(null)
        setUserName('')
        setNeedsPassword(false)
        setPage('news')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { password_set: true }
    })

    if (error) {
      alert('Fel: ' + error.message)
    } else {
      alert('Lösenord sparat!')
      setNeedsPassword(false)
      setNewPassword('')
    }
    setLoading(false)
  }

  const goToPage = (pageName) => {
    setPage(pageName)
    if (isMobile) setMenuOpen(false)
  }

  const renderPage = () => {
    if (page === 'dashboard' && isAdmin) return <Dashboard onNavigate={goToPage} />
    if (page === 'news') return <News />
    if (page === 'faults') return <Faults />
    if (page === 'laundry') return <Laundry apartmentId={activeApartment} />
    if (page === 'users' && isAdmin) return <Users />
    if (page === 'settings' && isAdmin) return <Settings />
    if (page === 'properties' && isAdmin) return (
      <Properties onSelectOrganization={(org) => {
        localStorage.setItem('activeOrganizationId', org.id)
        localStorage.setItem('activeOrganizationName', org.name)
        goToPage('dashboard')
      }} />
    )
    return <News />
  }

  if (session && needsPassword) {
    return (
      <div style={{ 
        fontFamily: 'sans-serif', 
        minHeight: '100vh', 
        backgroundColor: '#0f172a', 
        color: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '400px', padding: '2rem', backgroundColor: '#1e293b', borderRadius: '8px' }}>
          <h2>Välj ditt lösenord</h2>
          <p>Du har blivit inbjuden. Välj ett lösenord för att fortsätta.</p>
          <form onSubmit={handleSetPassword}>
            <input
              type="password"
              placeholder="Nytt lösenord (minst 6 tecken)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              style={{ 
                display: 'block', 
                marginBottom: '1rem', 
                width: '100%', 
                padding: '0.5rem',
                backgroundColor: '#334155',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px'
              }}
            />
            <button 
              disabled={loading}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '0.5rem'
              }}
            >
              {loading ? 'Sparar...' : 'Spara lösenord'}
            </button>
            <button 
              type="button"
              onClick={async () => {
                await supabase.auth.updateUser({ data: { password_set: true } })
                setNeedsPassword(false)
              }}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#64748b', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Hoppa över (jag har redan lösenord)
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0' }}>
      {!session ? (
        <div style={{ padding: '2rem' }}>
          <Auth />
        </div>
      ) : (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {isMobile && (
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                position: 'fixed',
                top: '1rem',
                left: '1rem',
                zIndex: 1000,
                width: '48px',
                height: '48px',
                padding: 0,
                backgroundColor: '#1e293b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ☰
            </button>
          )}

          <nav style={{
            width: menuOpen ? '220px' : '0',
            overflow: 'hidden',
            backgroundColor: '#1e293b',
            padding: menuOpen ? (isMobile ? '4rem 1rem 1.5rem 1rem' : '1.5rem 1rem') : '0',
            transition: 'width 0.3s',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: isMobile ? 'fixed' : 'relative',
            height: isMobile ? '100vh' : 'auto',
            zIndex: 999
          }}>
            <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>Fastighet</h2>

            {isAdmin && (
              <button
                onClick={() => goToPage('dashboard')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.6rem',
                  fontWeight: page === 'dashboard' ? 'bold' : 'normal',
                  backgroundColor: page === 'dashboard' ? '#334155' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                Översikt
              </button>
            )}

            <button
              onClick={() => goToPage('news')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginTop: '0.5rem',
                padding: '0.6rem',
                fontWeight: page === 'news' ? 'bold' : 'normal',
                backgroundColor: page === 'news' ? '#334155' : 'transparent',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Nyheter
            </button>

            <button
              onClick={() => goToPage('faults')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginTop: '0.5rem',
                padding: '0.6rem',
                fontWeight: page === 'faults' ? 'bold' : 'normal',
                backgroundColor: page === 'faults' ? '#334155' : 'transparent',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Felanmälan
            </button>

            <button
              onClick={() => goToPage('laundry')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginTop: '0.5rem',
                padding: '0.6rem',
                fontWeight: page === 'laundry' ? 'bold' : 'normal',
                backgroundColor: page === 'laundry' ? '#334155' : 'transparent',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Tvättbokning
            </button>

            {isAdmin && (
              <button
                onClick={() => goToPage('properties')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginTop: '0.5rem',
                  padding: '0.6rem',
                  fontWeight: page === 'properties' ? 'bold' : 'normal',
                  backgroundColor: page === 'properties' ? '#334155' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                Fastigheter
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => goToPage('users')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginTop: '0.5rem',
                  padding: '0.6rem',
                  fontWeight: page === 'users' ? 'bold' : 'normal',
                  backgroundColor: page === 'users' ? '#334155' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                Användare
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => goToPage('settings')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginTop: '0.5rem',
                  padding: '0.6rem',
                  fontWeight: page === 'settings' ? 'bold' : 'normal',
                  backgroundColor: page === 'settings' ? '#334155' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                Inställningar
              </button>
            )}

            {/* Användarinfo direkt under menyvalen */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155', fontSize: '0.9rem' }}>
              {userName && <p style={{ color: '#e2e8f0', margin: '0 0 0.2rem 0' }}>{userName}</p>}
              <p style={{ color: '#cbd5e1', margin: '0 0 0.3rem 0' }}>{session.user.email}</p>
              {userApartment && (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.8rem 0' }}>
                  {userApartment.name}
                </p>
              )}
              <button 
                onClick={() => supabase.auth.signOut()}
                style={{ 
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.4rem 0.8rem', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Logga ut
              </button>
            </div>
          </nav>

          <main style={{ 
            flex: 1, 
            padding: isMobile ? '4rem 1rem 1rem 1rem' : '2rem', 
            backgroundColor: '#0f172a', 
            color: '#e2e8f0',
            marginLeft: isMobile && menuOpen ? '220px' : '0',
            transition: 'margin-left 0.3s'
          }}>
            {renderPage()}
          </main>
        </div>
      )}
    </div>
  )
}

export default App