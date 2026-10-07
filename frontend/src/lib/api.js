import axios from 'axios'
import { supabase } from './supabase'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach verified Supabase JWT access token
api.interceptors.request.use(async (config) => {
  if (!supabase) {
    return config
  }

  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
  } catch {
    // If session lookup fails, allow request to proceed unauthenticated
  }

  return config
})

// Response interceptor: centralized error logging and notification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      if (status === 401) {
        console.warn('API 401: Authentication required or session expired:', data?.detail || 'Unauthorized')
      } else if (status === 403) {
        console.warn('API 403: Forbidden or insufficient role:', data?.detail || 'Forbidden')
      }
    }
    return Promise.reject(error)
  }
)

export async function fetchCurrentUserProfile() {
  const response = await api.get('/api/v1/auth/me')
  return response.data
}

export async function provisionStudentProfile(profileData) {
  const response = await api.post('/api/v1/auth/provision/student', profileData)
  return response.data
}

export async function provisionParentProfile(profileData) {
  const response = await api.post('/api/v1/auth/provision/parent', profileData)
  return response.data
}

// Student Dashboard & Analytics
export async function getStudentDashboard() {
  const response = await api.get('/api/v1/student/dashboard')
  return response.data
}

// Study Sessions
export async function getStudySessions(params = {}) {
  const response = await api.get('/api/v1/student/sessions', { params })
  return response.data
}

export async function createStudySession(sessionData) {
  const response = await api.post('/api/v1/student/sessions', sessionData)
  return response.data
}

export async function getStudySession(sessionId) {
  const response = await api.get(`/api/v1/student/sessions/${sessionId}`)
  return response.data
}

export async function updateStudySession(sessionId, sessionData) {
  const response = await api.patch(`/api/v1/student/sessions/${sessionId}`, sessionData)
  return response.data
}

// Study Activities
export async function getSessionActivities(sessionId) {
  const response = await api.get(`/api/v1/student/sessions/${sessionId}/activities`)
  return response.data
}

export async function getSessionActivitySummary(sessionId) {
  const response = await api.get(`/api/v1/student/sessions/${sessionId}/activities/summary`)
  return response.data
}

export async function createSessionActivity(sessionId, activityData) {
  const response = await api.post(`/api/v1/student/sessions/${sessionId}/activities`, activityData)
  return response.data
}


// Behavioural Analysis
export async function getStudentBehaviour(params = {}) {
  const response = await api.get('/api/v1/student/behaviour', { params })
  return response.data
}

export async function getStudentBehaviourAnalysis(params = {}) {
  const response = await api.get('/api/v1/student/behaviour/analysis', { params })
  return response.data
}

// Performance Reports
export async function getStudentPerformance(params = {}) {
  const response = await api.get('/api/v1/student/performance', { params })
  return response.data
}

// Subjects & Quizzes
export async function getStudentSubjects() {
  const response = await api.get('/api/v1/student/subjects')
  return response.data
}

export async function createStudentSubject(subjectData) {
  const response = await api.post('/api/v1/student/subjects', subjectData)
  return response.data
}


export async function getStudentQuizzes(params = {}) {
  const response = await api.get('/api/v1/student/quizzes', { params })
  return response.data
}

export async function createStudentQuiz(quizData) {
  const response = await api.post('/api/v1/student/quizzes', quizData)
  return response.data
}

// Causal / Intervention Layer: Recommendations, Events & Outcomes
export async function getStudentRecommendations(params = {}) {
  const response = await api.get('/api/v1/student/recommendations', { params })
  return response.data
}

export async function createRecommendationEvent(eventData) {
  const response = await api.post('/api/v1/student/recommendations/events', eventData)
  return response.data
}

export async function recordRecommendationOutcome(eventId, outcomeData) {
  const response = await api.post(`/api/v1/student/recommendations/events/${eventId}/outcomes`, outcomeData)
  return response.data
}
