import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
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

function formatApiError(err, fallbackMessage) {
  if (err?.response?.data?.detail) {
    return typeof err.response.data.detail === 'string'
      ? err.response.data.detail
      : fallbackMessage
  }
  if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
    return 'Cannot reach the FocusSense AI backend API (http://127.0.0.1:8000). Please ensure the FastAPI backend server is running and configured.'
  }
  return err?.message || fallbackMessage
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isProvisioningRef = useRef(false)

  const provisionStudentWithFallback = useCallback(async (payload) => {
    try {
      return await provisionStudentProfile(payload)
    } catch (err) {
      if (err?.response?.status === 409) {
        return await fetchCurrentUserProfile()
      }
      throw err
    }
  }, [])

  const provisionParentWithFallback = useCallback(async (payload) => {
    try {
      return await provisionParentProfile(payload)
    } catch (err) {
      if (err?.response?.status === 409) {
        return await fetchCurrentUserProfile()
      }
      throw err
    }
  }, [])

  // Load application profile using the backend API, auto-provisioning from user_metadata if needed
  const loadProfile = useCallback(
    async (authUser = null) => {
      try {
        const data = await fetchCurrentUserProfile()
        setProfile(data)
        setProfileError(null)
        return data
      } catch (err) {
        const statusCode = err?.response?.status
        const metadata = authUser?.user_metadata || {}
        const metaRole = typeof metadata.role === 'string' ? metadata.role.toLowerCase() : null
        const metaName =
          typeof metadata.name === 'string' && metadata.name.trim()
            ? metadata.name.trim()
            : null

        // If backend reports 401 (profile not yet created in DB), attempt auto-provisioning from signup metadata
        if (statusCode === 401 && metaRole && metaName) {
          try {
            let provisioned = null
            if (metaRole === 'student') {
              provisioned = await provisionStudentWithFallback({
                name: metaName,
                department: metadata.department || null,
                semester: metadata.semester ? parseInt(metadata.semester, 10) : null,
                academic_year: metadata.academic_year ? parseInt(metadata.academic_year, 10) : null,
              })
            } else if (metaRole === 'parent') {
              provisioned = await provisionParentWithFallback({ name: metaName })
            }
            if (provisioned) {
              setProfile(provisioned)
              setProfileError(null)
              return provisioned
            }
          } catch (provisionErr) {
            if (provisionErr?.response?.status && provisionErr.response.status !== 401) {
              setProfileError(
                formatApiError(provisionErr, 'Failed to automatically provision application profile.')
              )
            }
          }
        }

        if (statusCode === 401) {
          setProfileError(null)
        } else {
          setProfileError(
            formatApiError(
              err,
              'Unable to verify application profile with the backend server.'
            )
          )
        }

        setProfile(null)
        return null
      }
    },
    [provisionParentWithFallback, provisionStudentWithFallback]
  )

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
          await loadProfile(initialSession.user)
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
        if (currentSession?.user && !isProvisioningRef.current) {
          await loadProfile(currentSession.user)
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setProfile(null)
          setProfileError(null)
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
  }, [loadProfile])

  const login = async (email, password) => {
    setError(null)
    setLoading(true)
    try {
      const data = await signIn(email, password)
      setSession(data.session)
      setUser(data.user)
      if (data.session) {
        const profileData = await loadProfile(data.user)
        return { success: true, user: data.user, profile: profileData }
      }
      return { success: true, user: data.user }
    } catch (err) {
      const message = formatApiError(err, 'Login failed')
      setError(message)
      throw new Error(message, { cause: err })
    } finally {
      setLoading(false)
    }
  }

  const completeProfileRegistration = async ({
    role,
    name,
    department,
    semester,
    academic_year,
  }) => {
    setError(null)
    setLoading(true)
    isProvisioningRef.current = true
    try {
      const activeSession = session || (await getCurrentSession())
      if (!activeSession?.user) {
        throw new Error('Your authentication session has expired. Please sign in again.')
      }
      setSession(activeSession)
      setUser(activeSession.user)

      let createdProfile
      if (role === 'parent') {
        createdProfile = await provisionParentWithFallback({ name: name.trim() })
      } else {
        createdProfile = await provisionStudentWithFallback({
          name: name.trim(),
          department: department || null,
          semester: semester ? parseInt(semester, 10) : null,
          academic_year: academic_year ? parseInt(academic_year, 10) : null,
        })
      }

      setProfile(createdProfile)
      setProfileError(null)
      return { success: true, confirmationRequired: false, profile: createdProfile }
    } catch (err) {
      const message = formatApiError(err, 'Failed to complete profile registration')
      setError(message)
      throw new Error(message, { cause: err })
    } finally {
      isProvisioningRef.current = false
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
    isProvisioningRef.current = true
    try {
      const parsedSemester = semester ? parseInt(semester, 10) : null
      const parsedYear = academic_year ? parseInt(academic_year, 10) : null
      const normalizedEmail = email?.trim().toLowerCase()

      // If the user is already authenticated with this email, provision the profile directly
      const currentSession = session || (await getCurrentSession())
      if (
        currentSession?.user &&
        (!normalizedEmail || currentSession.user.email?.toLowerCase() === normalizedEmail)
      ) {
        setUser(currentSession.user)
        setSession(currentSession)
        const studentProfile = await provisionStudentWithFallback({
          name,
          department: department || null,
          semester: parsedSemester,
          academic_year: parsedYear,
        })
        setProfile(studentProfile)
        setProfileError(null)
        return { success: true, confirmationRequired: false, profile: studentProfile }
      }

      let authData = null
      try {
        authData = await signUp(email, password, {
          role: 'student',
          name,
          department: department || null,
          semester: parsedSemester,
          academic_year: parsedYear,
        })
      } catch (signUpErr) {
        // If user already exists in Supabase Auth, sign in with provided credentials and provision profile
        if (
          signUpErr?.message &&
          signUpErr.message.toLowerCase().includes('already registered')
        ) {
          authData = await signIn(email, password)
        } else {
          throw signUpErr
        }
      }

      // Supabase returns an obfuscated user with empty identities[] when email already exists and confirm-email is enabled
      const isExistingUnconfirmedOrDuplicate =
        !authData?.session &&
        Array.isArray(authData?.user?.identities) &&
        authData.user.identities.length === 0

      if (isExistingUnconfirmedOrDuplicate) {
        try {
          authData = await signIn(email, password)
        } catch {
          throw new Error(
            'An account with this email already exists. Please sign in (or verify your email first) to complete profile setup.'
          )
        }
      }

      setUser(authData.user)
      setSession(authData.session)

      // If email confirmation is required for a genuinely new signup, session will be null
      if (!authData.session) {
        return {
          success: true,
          confirmationRequired: true,
          message:
            'Registration successful. Please verify your email before logging in; your student profile will be activated automatically upon first sign-in.',
        }
      }

      // Provision student application profile
      const studentProfile = await provisionStudentWithFallback({
        name,
        department: department || null,
        semester: parsedSemester,
        academic_year: parsedYear,
      })
      setProfile(studentProfile)
      setProfileError(null)

      return { success: true, confirmationRequired: false, profile: studentProfile }
    } catch (err) {
      const message = formatApiError(err, 'Student registration failed')
      setError(message)
      throw new Error(message, { cause: err })
    } finally {
      isProvisioningRef.current = false
      setLoading(false)
    }
  }

  const registerParent = async ({ email, password, name }) => {
    setError(null)
    setLoading(true)
    isProvisioningRef.current = true
    try {
      const normalizedEmail = email?.trim().toLowerCase()

      // If the user is already authenticated with this email, provision the profile directly
      const currentSession = session || (await getCurrentSession())
      if (
        currentSession?.user &&
        (!normalizedEmail || currentSession.user.email?.toLowerCase() === normalizedEmail)
      ) {
        setUser(currentSession.user)
        setSession(currentSession)
        const parentProfile = await provisionParentWithFallback({ name })
        setProfile(parentProfile)
        setProfileError(null)
        return { success: true, confirmationRequired: false, profile: parentProfile }
      }

      let authData = null
      try {
        authData = await signUp(email, password, { role: 'parent', name })
      } catch (signUpErr) {
        if (
          signUpErr?.message &&
          signUpErr.message.toLowerCase().includes('already registered')
        ) {
          authData = await signIn(email, password)
        } else {
          throw signUpErr
        }
      }

      const isExistingUnconfirmedOrDuplicate =
        !authData?.session &&
        Array.isArray(authData?.user?.identities) &&
        authData.user.identities.length === 0

      if (isExistingUnconfirmedOrDuplicate) {
        try {
          authData = await signIn(email, password)
        } catch {
          throw new Error(
            'An account with this email already exists. Please sign in (or verify your email first) to complete profile setup.'
          )
        }
      }

      setUser(authData.user)
      setSession(authData.session)

      // If email confirmation is required for a genuinely new signup, session will be null
      if (!authData.session) {
        return {
          success: true,
          confirmationRequired: true,
          message:
            'Registration successful. Please verify your email before logging in; your parent profile will be activated automatically upon first sign-in.',
        }
      }

      // Provision parent application profile
      const parentProfile = await provisionParentWithFallback({ name })
      setProfile(parentProfile)
      setProfileError(null)

      return { success: true, confirmationRequired: false, profile: parentProfile }
    } catch (err) {
      const message = formatApiError(err, 'Parent registration failed')
      setError(message)
      throw new Error(message, { cause: err })
    } finally {
      isProvisioningRef.current = false
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
      setProfileError(null)
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
    profileError,
    role: profile?.role || null,
    loading,
    error,
    login,
    registerStudent,
    registerParent,
    completeProfileRegistration,
    logout,
    refreshProfile: () => loadProfile(user),
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

