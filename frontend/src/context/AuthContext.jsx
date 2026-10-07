import { createContext, useContext, useEffect, useState } from 'react'
import {
  getCurrentSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
  supabase,
} from '../lib/supabase'
import {
  fetchCurrentUserProfile,
  provisionParentProfile,
  provisionStudentProfile,
} from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load application profile using the backend API
  const loadProfile = async () => {
    try {
      const data = await fetchCurrentUserProfile()
      setProfile(data)
      return data
    } catch {
      // User might be authenticated in Supabase but not yet provisioned in application DB
      setProfile(null)
      return null
    }
  }

  // Initial session restoration and auth listener
  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      if (!supabase) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const initialSession = await getCurrentSession()
        if (isMounted) {
          setSession(initialSession)
          setUser(initialSession?.user || null)
        }
        if (initialSession?.user) {
          try {
            const profileData = await fetchCurrentUserProfile()
            if (isMounted) setProfile(profileData)
          } catch {
            if (isMounted) setProfile(null)
          }
        }
      } catch (err) {
        console.warn('Failed to restore authentication session:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeAuth()

    const { data: authListener } = onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return

      setSession(currentSession)
      setUser(currentSession?.user || null)

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession?.user) {
          try {
            const profileData = await fetchCurrentUserProfile()
            if (isMounted) setProfile(profileData)
          } catch {
            if (isMounted) setProfile(null)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setProfile(null)
          setUser(null)
          setSession(null)
        }
      }
    })

    return () => {
      isMounted = false
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  const login = async (email, password) => {
    setError(null)
    setLoading(true)
    try {
      const data = await signIn(email, password)
      setSession(data.session)
      setUser(data.user)
      if (data.session) {
        const profileData = await loadProfile()
        return { success: true, user: data.user, profile: profileData }
      }
      return { success: true, user: data.user }
    } catch (err) {
      const message = err.message || 'Login failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const registerStudent = async ({
    email,
    password,
    name,
    department,
    semester,
    academic_year,
  }) => {
    setError(null)
    setLoading(true)
    try {
      const data = await signUp(email, password, { role: 'student', name })
      setUser(data.user)
      setSession(data.session)

      // If email confirmation is required, session will be null
      if (!data.session) {
        return {
          success: true,
          confirmationRequired: true,
          message: 'Registration successful. Please verify your email before logging in.',
        }
      }

      // Provision student application profile
      const studentProfile = await provisionStudentProfile({
        name,
        department: department || null,
        semester: semester ? parseInt(semester, 10) : null,
        academic_year: academic_year ? parseInt(academic_year, 10) : null,
      })
      setProfile(studentProfile)

      return { success: true, confirmationRequired: false, profile: studentProfile }
    } catch (err) {
      const message = err.message || 'Student registration failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const registerParent = async ({ email, password, name }) => {
    setError(null)
    setLoading(true)
    try {
      const data = await signUp(email, password, { role: 'parent', name })
      setUser(data.user)
      setSession(data.session)

      // If email confirmation is required, session will be null
      if (!data.session) {
        return {
          success: true,
          confirmationRequired: true,
          message: 'Registration successful. Please verify your email before logging in.',
        }
      }

      // Provision parent application profile
      const parentProfile = await provisionParentProfile({ name })
      setProfile(parentProfile)

      return { success: true, confirmationRequired: false, profile: parentProfile }
    } catch (err) {
      const message = err.message || 'Parent registration failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    setError(null)
    try {
      await signOut()
      setUser(null)
      setSession(null)
      setProfile(null)
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    profile,
    role: profile?.role || null,
    loading,
    error,
    login,
    registerStudent,
    registerParent,
    logout,
    refreshProfile: loadProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
