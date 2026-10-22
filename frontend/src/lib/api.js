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
      } else if (status === 422) {
        const details = Array.isArray(data?.detail)
          ? data.detail.map((err) => `${err.loc?.slice(1).join('.') || err.loc?.join('.') || 'field'}: ${err.msg}`).join('; ')
          : (typeof data?.detail === 'string' ? data.detail : JSON.stringify(data?.detail || 'Validation error'))
        console.warn('API 422 Validation Error:', details)
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

export async function simulateCounterfactual(simulationData) {
  const response = await api.post('/api/v1/student/behaviour/counterfactual', simulationData)
  return response.data
}

// Performance Reports
export async function getStudentPerformance(params = {}) {
  const response = await api.get('/api/v1/student/performance', { params })
  return response.data
}

export async function createStudentPerformance(reportData) {
  const response = await api.post('/api/v1/student/performance', reportData)
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
  const response = await api.post(`/api/v1/student/recommendations/events/${eventId}/outcome`, outcomeData)
  return response.data
}

export async function generateStudentRecommendation(sessionId) {
  const response = await api.post('/api/v1/student/recommendations/generate', { session_id: sessionId })
  return response.data
}

export async function getStudentRecommendationHistory(params = {}) {
  const response = await api.get('/api/v1/student/recommendations/history', { params })
  return response.data
}

export async function getLatestStudentRecommendation() {
  const response = await api.get('/api/v1/student/recommendations/latest')
  return response.data
}

export async function getStudentRecommendationEffectiveness() {
  const response = await api.get('/api/v1/student/recommendations/effectiveness')
  return response.data
}

// Parent Portal & Student Consent Management
export async function getLinkedStudents() {
  const response = await api.get('/api/v1/parent/students')
  return response.data
}

export async function linkStudentToParent(studentId) {
  const response = await api.post('/api/v1/parent/students/link', { student_id: studentId })
  return response.data
}

export async function getParentStudentProgress(studentId) {
  const response = await api.get(`/api/v1/parent/students/${studentId}/progress`)
  return response.data
}

export async function unlinkStudentFromParent(studentId) {
  const response = await api.delete(`/api/v1/parent/students/${studentId}`)
  return response.data
}

export async function getStudentParentLinks() {
  const response = await api.get('/api/v1/student/parent-links')
  return response.data
}

export async function updateParentConsent(linkId, consentStatus) {
  const response = await api.patch(`/api/v1/student/parent-links/${linkId}/consent`, {
    consent_status: consentStatus,
  })
  return response.data
}

export async function removeParentLink(linkId) {
  const response = await api.delete(`/api/v1/student/parent-links/${linkId}`)
  return response.data
}



