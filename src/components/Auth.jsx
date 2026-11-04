import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [session, setSession] = useState(null)

  useEffect(() => {
    const checkSession = async (session) => {
      setSession(session)
      
      // Visa bara lösenordsformulär om det är en inbjudan/recovery och lösenord inte är satt
      const isRecovery = window.location.hash.includes('type=recovery') || 
                         window.location.hash.includes('type=invite')
      
      if (session?.user && 
          !session.user.user_metadata?.password_set && 
          isRecovery) {
        setNeedsPassword(true)
      } else {
        setNeedsPassword(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      await checkSession(session)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    setLoading(false)
  }

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
      // Rensa hash från URL
      window.history.replaceState(null, '', window.location.pathname)
      window.location.reload()
    }
    setLoading(false)
  }

  const skipPassword = () => {
    setNeedsPassword(false)
    window.history.replaceState(null, '', window.location.pathname)
  }

  if (needsPassword && session) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem' }}>
        <h2>Välj ditt lösenord</h2>
        <p>Du har blivit inbjuden till appen. Välj ett lösenord för att fortsätta.</p>
        <form onSubmit={handleSetPassword}>
          <input
            type="password"
            placeholder="Nytt lösenord (minst 6 tecken)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
          />
          <button disabled={loading} style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}>
            {loading ? 'Sparar...' : 'Spara lösenord'}
          </button>
          <button type="button" onClick={skipPassword} style={{ padding: '0.5rem 1rem' }}>
            Hoppa över (jag har redan lösenord)
          </button>
        </form>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem' }}>
        <h2>Logga in</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%', padding: '0.5rem' }}
          />
          <input
            type="password"
            placeholder="Lösenord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '1rem', width: '100%', padding: '0.5rem' }}
          />
          <button disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    )
  }

  return null
}