import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListPlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'

import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { useStudySessionMonitor } from '../../hooks/useStudySessionMonitor'
import {
  createSessionActivity,
  createStudentSubject,
  createStudySession,
  getSessionActivities,
  getSessionActivitySummary,
  getStudentSubjects,
  getStudySessions,
  updateStudySession,
} from '../../lib/api'

export function StudySessions() {
  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Start Session Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [sessionMode, setSessionMode] = useState('focused')
  const [isStarting, setIsStarting] = useState(false)
  const [startSessionError, setStartSessionError] = useState('')

  // Add Subject Modal State
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [isCreatingSubject, setIsCreatingSubject] = useState(false)
  const [addSubjectError, setAddSubjectError] = useState('')

  // End Session Confirmation State
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [endSessionError, setEndSessionError] = useState('')

  // Active Session Telemetry & Log Activity State
  const [activeActivities, setActiveActivities] = useState([])
  const [activeSummary, setActiveSummary] = useState(null)
  const [activityType, setActivityType] = useState('productive')
  const [appName, setAppName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('15')
  const [isLoggingActivity, setIsLoggingActivity] = useState(false)
  const [activitySuccess, setActivitySuccess] = useState('')
  const [activityError, setActivityError] = useState('')

  // Historical Session Activity Inspector
  const [inspectedSessionId, setInspectedSessionId] = useState(null)
  const [inspectedActivities, setInspectedActivities] = useState([])
  const [inspectedSummary, setInspectedSummary] = useState(null)
  const [inspectedLoading, setInspectedLoading] = useState(false)

  // Timer state for active session UI
  const [isPaused, setIsPaused] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)

  const loadSessionActivities = useCallback(async (sessionId) => {
    try {
      const [acts, summary] = await Promise.all([
        getSessionActivities(sessionId),
        getSessionActivitySummary(sessionId),
      ])
      setActiveActivities(Array.isArray(acts) ? acts : [])
      setActiveSummary(summary)
    } catch (err) {
      console.warn('Failed to load session activities:', err)
    }
  }, [])

  const getSubjectName = useCallback(
    (subjId) => {
      const match = subjects.find((s) => s.id === subjId)
      return match ? match.name : 'General Study'
    },
    [subjects]
  )

  const handleActivityLogged = useCallback(() => {
    if (activeSession) {
      loadSessionActivities(activeSession.id)
    }
  }, [activeSession, loadSessionActivities])

  // Real-time Web & Extension Activity Telemetry Monitor
  const {
    isMonitoringEnabled,
    setIsMonitoringEnabled,
    currentFocusState,
    interruptionCount,
    interruptionSeconds,
    extensionConnected,
    extensionEventsReceived,
    extensionContextError,
    activeExternalDomain,
    flushCurrentInterval,
  } = useStudySessionMonitor({
    activeSession,
    sessionMode,
    isPaused,
    subjectName: activeSession ? getSubjectName(activeSession.subject_id) : 'General Study',
    onActivityLogged: handleActivityLogged,
  })

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const [subjRes, sessRes] = await Promise.all([
        getStudentSubjects(),
        getStudySessions({ limit: 50 }),
      ])
      const fetchedSubjects = Array.isArray(subjRes) ? subjRes : []
      setSubjects(fetchedSubjects)
      if (fetchedSubjects.length > 0) {
        setSelectedSubjectId((prev) => prev || fetchedSubjects[0].id)
      }

      const fetchedItems = sessRes?.items || (Array.isArray(sessRes) ? sessRes : [])
      setSessions(fetchedItems)

      // Look for an active session
      const foundActive = fetchedItems.find((s) => s.status === 'active')
      if (foundActive) {
        setActiveSession(foundActive)
        await loadSessionActivities(foundActive.id)
      } else {
        setActiveSession(null)
      }
    } catch (err) {
      console.error('Failed to load study sessions data:', err)
      setError('Unable to load study sessions. Please check network connection.')
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Unable to load study sessions. Please check network connection.'
      )
    } finally {
      setLoading(false)
    }
  }, [loadSessionActivities])

  useEffect(() => {
    let ignore = false
    async function initialFetch() {
      try {
        const [subjRes, sessRes] = await Promise.all([
          getStudentSubjects(),
          getStudySessions({ limit: 50 }),
        ])
        if (!ignore) {
          const fetchedSubjects = Array.isArray(subjRes) ? subjRes : []
          setSubjects(fetchedSubjects)
          if (fetchedSubjects.length > 0) {
            setSelectedSubjectId(fetchedSubjects[0].id)
          }

          const fetchedItems = sessRes?.items || (Array.isArray(sessRes) ? sessRes : [])
          setSessions(fetchedItems)

          const foundActive = fetchedItems.find((s) => s.status === 'active')
          if (foundActive) {
            setActiveSession(foundActive)
            const [acts, summary] = await Promise.all([
              getSessionActivities(foundActive.id).catch(() => []),
              getSessionActivitySummary(foundActive.id).catch(() => null),
            ])
            if (!ignore) {
              setActiveActivities(Array.isArray(acts) ? acts : [])
              setActiveSummary(summary)
            }
          }
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load study sessions data:', err)
          setError('Unable to load study sessions. Please check network connection.')
          const detail = err.response?.data?.detail
          setError(
            typeof detail === 'string'
              ? detail
              : 'Unable to load study sessions. Please check network connection.'
          )
          setLoading(false)
        }
      }
    }
    initialFetch()
    return () => {
      ignore = true
    }
  }, [])

  // Timer calculation loop
  useEffect(() => {
    if (!activeSession || isPaused) return
    const startedAt = activeSession.started_at
      ? new Date(activeSession.started_at).getTime()
      : Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      setTimerSeconds(elapsed)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeSession, isPaused])

  const handleStartSession = async (e) => {
    e.preventDefault()
    if (isStarting || activeSession) return
    setIsStarting(true)
    setStartSessionError('')
    try {
      const newSession = await createStudySession({
        subject_id: selectedSubjectId || null,
        started_at: new Date().toISOString(),
        status: 'active',
      })
      setActiveSession(newSession)
      setIsPaused(false)
      setActiveActivities([])
      setActiveSummary(null)
      setShowEndConfirm(false)
      await fetchData()
    } catch (err) {
      console.error('Failed to start session:', err)
      alert(err.response?.data?.detail || 'Unable to start session.')
      const detail = err.response?.data?.detail
      setStartSessionError(
        typeof detail === 'string'
          ? detail
          : 'Unable to start study session. Please verify backend service and database.'
      )
    } finally {
      setIsStarting(false)
    }
  }

  const getElapsedSeconds = useCallback(() => {
    if (!activeSession) return 0
    if (timerSeconds > 0) return timerSeconds
    if (activeSession.started_at) {
      return Math.max(0, Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000))
    }
    return 0
  }, [activeSession, timerSeconds])

  const handleConfirmEndSession = async () => {
    if (!activeSession || isEnding) return
    setIsEnding(true)
    setEndSessionError('')
    try {
      const endedAt = new Date().toISOString()

      // 1. Flush currently active interval from real-time monitor
      if (flushCurrentInterval) {
        await flushCurrentInterval()
      }

      // 2. Fetch fresh activity count to verify if any telemetry was recorded
      const freshActs = await getSessionActivities(activeSession.id).catch(() => [])
      const elapsed = getElapsedSeconds()

      // 3. Fallback: only if truly 0 activities and duration > 0, record focused study interval
      if (freshActs.length === 0 && elapsed > 0) {
        try {
          await createSessionActivity(activeSession.id, {
            activity_type: 'productive',
            application_name: getSubjectName(activeSession.subject_id),
            duration_seconds: Math.max(0.0, Math.round(elapsed * 10) / 10),
          })
        } catch (actErr) {
          console.warn('Direct activity recording failed, backend auto_record_activity fallback will apply:', actErr)
        }
      }

      await updateStudySession(activeSession.id, {
        ended_at: endedAt,
        status: 'completed',
        auto_record_activity: freshActs.length === 0 && elapsed > 0,
      })
      setActiveSession(null)
      setShowEndConfirm(false)
      setActiveActivities([])
      setActiveSummary(null)
      await fetchData()
    } catch (err) {
      console.error('Failed to end session:', err)
      alert(err.response?.data?.detail || 'Unable to end session.')
      const detail = err.response?.data?.detail
      setEndSessionError(
        typeof detail === 'string' ? detail : 'Unable to end session. Please try again.'
      )
    } finally {
      setIsEnding(false)
    }
  }

  const handleCreateSubject = async (e) => {
    e.preventDefault()
    if (!newSubjectName.trim() || isCreatingSubject) return
    const trimmed = newSubjectName.trim()
    if (!trimmed) {
      setAddSubjectError('Please enter a subject name.')
      return
    }
    if (trimmed.length > 200) {
      setAddSubjectError('Subject name cannot exceed 200 characters.')
      return
    }
    if (subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddSubjectError('A subject with this name already exists in your list.')
      return
    }
    if (isCreatingSubject) return

    setIsCreatingSubject(true)
    setAddSubjectError('')
    try {
      const created = await createStudentSubject({ name: trimmed })
      setSubjects((prev) => {
        const exists = prev.some((s) => s.id === created.id)
        return exists ? prev : [...prev, created]
      })
      setSelectedSubjectId(created.id)
      setNewSubjectName('')
      setShowAddSubject(false)
      await fetchData()
    } catch (err) {
      console.error('Failed to create subject:', err)
      alert(err.response?.data?.detail || 'Unable to create subject.')
      const detail = err.response?.data?.detail
      setAddSubjectError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(', ')
          : 'Unable to create subject. Please check connection and database.'
      )
    } finally {
      setIsCreatingSubject(false)
    }
  }

  const handleLogActivity = async (e) => {
    e.preventDefault()
    if (!activeSession || isLoggingActivity) return
    const durMins = parseFloat(durationMinutes) || 0
    if (durMins <= 0) return

    setIsLoggingActivity(true)
    setActivitySuccess('')
    setActivityError('')
    try {
      await createSessionActivity(activeSession.id, {
        activity_type: activityType,
        application_name: appName.trim() || getSubjectName(activeSession.subject_id),
        duration_seconds: durMins * 60,
      })
      setAppName('')
      setActivitySuccess('Activity recorded successfully.')
      await loadSessionActivities(activeSession.id)
      setTimeout(() => setActivitySuccess(''), 3500)
    } catch (err) {
      console.error('Failed to log activity:', err)
      alert(err.response?.data?.detail || 'Unable to log activity.')
      const detail = err.response?.data?.detail
      setActivityError(
        typeof detail === 'string' ? detail : 'Unable to log activity. Please try again.'
      )
    } finally {
      setIsLoggingActivity(false)
    }
  }

  const handleInspectSession = async (sessionId) => {
    if (inspectedSessionId === sessionId) {
      setInspectedSessionId(null)
      return
    }
    setInspectedSessionId(sessionId)
    setInspectedLoading(true)
    try {
      const [acts, summary] = await Promise.all([
        getSessionActivities(sessionId),
        getSessionActivitySummary(sessionId),
      ])
      setInspectedActivities(Array.isArray(acts) ? acts : [])
      setInspectedSummary(summary)
    } catch (err) {
      console.error('Failed to inspect session activities:', err)
    } finally {
      setInspectedLoading(false)
    }
  }

  const formatTimer = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getActivityBadgeStyle = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'productive':
      case 'study':
      case 'coding':
      case 'app_focus':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      case 'distraction':
      case 'interruption':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      case 'break':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 'focus_loss':
      case 'tab_switch':
      case 'unknown':
      case 'other':
        return 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
      default:
        return 'border-gray-500/30 bg-gray-500/10 text-gray-500'
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
              Study Session System
            </span>
            {activeSession && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Session Active
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Study Sessions & Behaviour Telemetry
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Record focused study intervals, log transparent session activities, and aggregate
            behavioural metrics for AI attention and performance evaluation.
          </p>
        </div>
      </section>

      {/* Loading Skeletons */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10">
          <RefreshCw className="mr-2.5 size-5 animate-spin text-[var(--accent-primary)]" />
          <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
            Loading study sessions...
          </span>
        </div>
      )}

      {/* Error Feedback */}
      {error && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-4 text-[var(--text-primary)]">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle size={16} className="text-[var(--status-danger)] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 font-mono text-xs font-bold hover:border-[var(--border-strong)]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && (
        <>
          {/* Active Session OR Start Session Section */}
          <SectionCard
            title={activeSession ? 'Active Study Session' : 'Start Study Session'}
            subtitle={
              activeSession
                ? 'Telemetry logging & interval control'
                : 'Select subject and start session timer'
            }
            icon={Play}
          >
            {activeSession ? (
              <div className="space-y-6">
                {/* Active Timer Display */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-center shadow-xs">
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                        isPaused
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                        }`}
                      />
                      {isPaused ? 'Paused' : 'Active'}
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">
                      Subject: {getSubjectName(activeSession.subject_id)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                        currentFocusState === 'focused'
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          currentFocusState === 'focused' ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                        }`}
                      />
                      {currentFocusState === 'focused'
                        ? 'Study Tab In Focus'
                        : `Interruption / Tab Switch ${activeExternalDomain ? `(${activeExternalDomain})` : ''}`}
                    </span>
                  </div>

                  {/* Real-time Telemetry Monitor Indicators */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px]">
                      <span
                        className={`size-2 rounded-full ${
                          extensionContextError
                            ? 'bg-amber-500'
                            : extensionConnected
                            ? extensionEventsReceived > 0
                              ? 'bg-emerald-500'
                              : 'bg-amber-400 animate-pulse'
                            : 'bg-blue-400'
                        }`}
                      />
                      {extensionContextError ? (
                        <span className="flex items-center gap-1.5">
                          <span>Extension Reloaded (Web Fallback Active)</span>
                          <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="underline text-[var(--accent-primary)] hover:opacity-80"
                          >
                            Refresh Tab
                          </button>
                        </span>
                      ) : extensionConnected ? (
                        extensionEventsReceived > 0 ? (
                          `Extension Active (${extensionEventsReceived} Tab Events Received)`
                        ) : (
                          'Extension Connected (Awaiting Tab Events)'
                        )
                      ) : (
                        'Web Monitor Active (Tab/Window Blur)'
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px]">
                      Interruptions: <strong className="text-[var(--text-primary)]">{interruptionCount}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px]">
                      Interruption Time: <strong className="text-[var(--text-primary)]">{interruptionSeconds}s</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMonitoringEnabled(!isMonitoringEnabled)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                        isMonitoringEnabled
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-gray-500/30 bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      Telemetry: {isMonitoringEnabled ? 'Enabled' : 'Paused'}
                    </button>
                  </div>

                  <div className="mt-4 font-mono text-5xl font-extrabold text-[var(--text-primary)] tracking-tight">
                    {formatTimer(timerSeconds)}
                  </div>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPaused(!isPaused)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 font-mono text-xs font-bold text-[var(--text-primary)] uppercase transition hover:border-[var(--border-strong)]"
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      <span>{isPaused ? 'Resume Timer' : 'Pause Timer'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowEndConfirm(true)
                        setEndSessionError('')
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--status-danger)] px-4 py-2 font-mono text-xs font-bold text-white uppercase transition hover:opacity-90 shadow-xs"
                    >
                      <CheckCircle2 size={14} />
                      <span>End Session</span>
                    </button>
                  </div>

                  {/* End Session Error Banner */}
                  {endSessionError && (
                    <div className="mt-4 rounded-lg border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-3 text-xs text-[var(--text-primary)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="text-[var(--status-danger)] shrink-0" />
                        <span>{endSessionError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEndSessionError('')}
                        className="font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* End Session Confirmation Prompt */}
                  {showEndConfirm && (
                    <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="size-5 text-[var(--status-danger)] shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <h4 className="font-bold text-sm text-[var(--text-primary)]">
                            Confirm Ending Study Session?
                          </h4>
                          {activeActivities.length > 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                              Ending this session will finalize your{' '}
                              <strong>{activeActivities.length}</strong> logged activity record
                              {activeActivities.length > 1 ? 's' : ''} (
                              {Math.round(
                                (activeSummary?.total_duration_seconds || 0) / 60
                              )}{' '}
                              mins total) for AI behavioural and focus analysis.
                            </p>
                          ) : getElapsedSeconds() > 0 ? (
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                              This focused session recorded{' '}
                              <strong>{formatTimer(getElapsedSeconds())}</strong> of study for{' '}
                              <strong>{getSubjectName(activeSession.subject_id)}</strong>. Ending
                              this session will record this study activity and finalize it for AI
                              behavioural analysis.
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed font-medium">
                              Notice: No activity telemetry was recorded (duration is 0s).
                              Completing this session now will mark it completed without activity
                              data, and no AI behavioural analysis will be generated.
                            </p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={handleConfirmEndSession}
                              disabled={isEnding}
                              className="rounded-lg bg-[var(--status-danger)] px-3.5 py-1.5 font-mono text-xs font-bold text-white uppercase transition hover:opacity-90 disabled:opacity-50"
                            >
                              {isEnding ? 'Ending...' : 'Yes, End Session'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowEndConfirm(false)
                                setEndSessionError('')
                              }}
                              disabled={isEnding}
                              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Log Activity Form (Telemetry Input) */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <div className="flex items-center gap-2">
                      <ListPlus size={16} className="text-[var(--accent-primary)]" />
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        Log Session Activity
                      </h4>
                    </div>
                    {activitySuccess && (
                      <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {activitySuccess}
                      </span>
                    )}
                  </div>

                  {activityError && (
                    <div className="mt-3 rounded-lg border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-3 text-xs text-[var(--text-primary)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="text-[var(--status-danger)] shrink-0" />
                        <span>{activityError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivityError('')}
                        className="font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={handleLogActivity}
                    className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end"
                  >
                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                        Activity Type
                      </label>
                      <select
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      >
                        <option value="productive">Productive</option>
                        <option value="study">Study</option>
                        <option value="distraction">Distraction</option>
                        <option value="break">Break</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                        Application / Task
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VS Code, Reading (defaults to subject)"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={isLoggingActivity}
                        className="w-full rounded-lg bg-[var(--accent-primary)] px-4 py-2 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase transition hover:bg-[var(--accent-hover)] disabled:opacity-50 shadow-xs"
                      >
                        {isLoggingActivity ? 'Logging...' : 'Log Activity'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Active Session Activity Summary & Breakdown */}
                {activeSummary && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-center">
                        <span className="block font-mono text-[10px] text-[var(--text-secondary)] uppercase font-bold">
                          Total Logged
                        </span>
                        <span className="block text-lg font-bold text-[var(--text-primary)]">
                          {Math.round(activeSummary.total_duration_seconds / 60)} mins
                        </span>
                      </div>
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                        <span className="block font-mono text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                          Productive
                        </span>
                        <span className="block text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {activeSummary.productive_percentage}%
                        </span>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                        <span className="block font-mono text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">
                          Distraction
                        </span>
                        <span className="block text-lg font-bold text-amber-600 dark:text-amber-400">
                          {activeSummary.distraction_percentage}%
                        </span>
                      </div>
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                        <span className="block font-mono text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">
                          Context Switches
                        </span>
                        <span className="block text-lg font-bold text-blue-600 dark:text-blue-400">
                          {activeSummary.activity_switch_count}
                        </span>
                      </div>
                    </div>

                    {/* Activity Log Table */}
                    {activeActivities.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">Type</th>
                              <th className="px-4 py-2.5 font-bold">Application / Task</th>
                              <th className="px-4 py-2.5 font-bold">Duration</th>
                              <th className="px-4 py-2.5 font-bold">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]">
                            {activeActivities.map((act) => (
                              <tr
                                key={act.id}
                                className="hover:bg-[var(--bg-elevated)]/60 transition"
                              >
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getActivityBadgeStyle(
                                      act.activity_type
                                    )}`}
                                  >
                                    {act.activity_type}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                                  {act.metadata_json?.application_name ||
                                    act.metadata_json?.app ||
                                    'General'}
                                </td>
                                <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                                  {(act.numeric_value || 0) < 60
                                    ? `${Math.round(act.numeric_value || 0)}s`
                                    : `${Math.round((act.numeric_value || 0) / 60)} mins`}
                                </td>
                                <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                                  {new Date(act.occurred_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeActivities.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center font-mono text-xs text-[var(--text-secondary)]">
                        No activity events recorded yet. Switch browser tabs or allow focus heartbeats to log telemetry.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Form to Start a Session */
              <div className="space-y-4">
                {/* Real-time Extension Readiness Banner */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 font-mono text-xs text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        extensionContextError
                          ? 'bg-amber-500'
                          : extensionConnected
                          ? 'bg-emerald-500'
                          : 'bg-blue-400'
                      }`}
                    />
                    <span>
                      {extensionContextError
                        ? 'Extension Reloaded (Web Fallback Ready)'
                        : extensionConnected
                        ? 'Browser Extension Connected & Ready'
                        : 'Web Telemetry Active (Tab & Window Blur Monitoring)'}
                    </span>
                  </span>
                  {extensionContextError ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="font-mono text-[11px] underline text-[var(--accent-primary)] hover:opacity-80"
                    >
                      Refresh Tab
                    </button>
                  ) : (
                    <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">
                      {extensionConnected ? 'Cross-Tab Domains Active' : 'Native Browser Sandbox'}
                    </span>
                  )}
                </div>

                <form onSubmit={handleStartSession} className="space-y-4">
                {startSessionError && (
                  <div className="rounded-lg border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-3 text-xs text-[var(--text-primary)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-[var(--status-danger)] shrink-0" />
                      <span>{startSessionError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStartSessionError('')}
                      className="font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-mono text-xs font-bold text-[var(--text-secondary)] uppercase">
                        Subject
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddSubject(true)
                          setAddSubjectError('')
                        }}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--accent-primary)] hover:underline"
                      >
                        <Plus size={13} />
                        <span>Add Subject</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      >
                        <option value="">General Study (No Subject)</option>
                        {subjects.map((subj) => (
                          <option key={subj.id} value={subj.id}>
                            {subj.name}
                          </option>
                        ))}
                        {subjects.length === 0 && <option value="">No subjects available</option>}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddSubject(true)
                          setAddSubjectError('')
                        }}
                        className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-xs font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
                        title="Add New Subject"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {subjects.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                        No custom subjects added yet. You can start a <strong>General Study</strong> session or click &ldquo;+&rdquo; to add a subject.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">
                      Session Mode
                    </label>
                    <select
                      value={sessionMode}
                      onChange={(e) => setSessionMode(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                    >
                      <option value="focused">Focused Study (Telemetry Enabled)</option>
                      <option value="revision">Revision & Review</option>
                      <option value="practice">Practice & Problem Solving</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isStarting || activeSession !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-5 py-2.5 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase tracking-wider transition hover:bg-[var(--accent-hover)] disabled:opacity-50 shadow-xs"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>{isStarting ? 'Starting...' : 'Start Study Session'}</span>
                  </button>
                </div>
              </form>
              </div>
            )}
          </SectionCard>

          {/* Quick Add Subject Modal / Inline Form */}
          {showAddSubject && (
            <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-[var(--accent-primary)]" />
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Add New Curriculum Subject
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSubject(false)
                    setAddSubjectError('')
                  }}
                  disabled={isCreatingSubject}
                  className="rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>

              {addSubjectError && (
                <div className="rounded-lg border border-[var(--status-danger)]/40 bg-[var(--status-danger)]/10 p-2.5 text-xs text-[var(--text-primary)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="text-[var(--status-danger)] shrink-0" />
                    <span>{addSubjectError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddSubjectError('')}
                    className="font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleCreateSubject} className="space-y-3">
                <div>
                  <label className="block font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="e.g. Operating Systems, Discrete Mathematics, Data Structures"
                    value={newSubjectName}
                    onChange={(e) => {
                      setNewSubjectName(e.target.value)
                      if (addSubjectError) setAddSubjectError('')
                    }}
                    disabled={isCreatingSubject}
                    required
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                    <span>
                      Adding custom subjects enables curriculum-specific mastery and quiz performance tracking.
                    </span>
                    <span>{newSubjectName.length} / 200</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSubject(false)
                      setAddSubjectError('')
                    }}
                    disabled={isCreatingSubject}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-1.5 font-mono text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSubject || !newSubjectName.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-1.5 font-mono text-xs font-bold text-[var(--accent-contrast)] uppercase hover:bg-[var(--accent-hover)] transition disabled:opacity-50 shadow-xs"
                  >
                    {isCreatingSubject ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        <span>Save Subject</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Historical Sessions List & Activity Inspector */}
          <SectionCard
            title="Session History"
            subtitle="Recorded study intervals and telemetry breakdown"
            icon={Clock}
          >
            {sessions.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No study sessions recorded yet"
                description="Once you start and complete study sessions, they will be listed here with subject associations, duration, and telemetry breakdowns."
              />
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-bold">Subject</th>
                        <th className="px-4 py-3 font-bold">Date</th>
                        <th className="px-4 py-3 font-bold">Start / End</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {sessions.map((sess) => {
                        const startDate = new Date(sess.started_at)
                        const endDate = sess.ended_at ? new Date(sess.ended_at) : null
                        const isInspected = inspectedSessionId === sess.id

                        return (
                          <tr
                            key={sess.id}
                            className={
                              isInspected
                                ? 'bg-[var(--accent-soft)]/50'
                                : 'hover:bg-[var(--bg-elevated)]/60 transition'
                            }
                          >
                            <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                              {getSubjectName(sess.subject_id)}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {startDate.toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {startDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {endDate
                                ? ` - ${endDate.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                                : ''}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  sess.status === 'completed'
                                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : sess.status === 'active'
                                    ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'border border-gray-500/30 bg-gray-500/10 text-gray-500'
                                }`}
                              >
                                {sess.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleInspectSession(sess.id)}
                                className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[var(--accent-primary)] hover:underline"
                              >
                                <Activity size={13} />
                                <span>{isInspected ? 'Hide Telemetry' : 'Telemetry'}</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Inspected Session Telemetry Detail */}
                {inspectedSessionId && (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-[var(--accent-primary)]" />
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          Historical Session Activity Telemetry
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectedSessionId(null)}
                        className="font-mono text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Close
                      </button>
                    </div>

                    {inspectedLoading ? (
                      <div className="py-6 text-center font-mono text-xs text-[var(--text-secondary)]">
                        Loading session telemetry...
                      </div>
                    ) : inspectedSummary && inspectedSummary.activity_count > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                          <div className="rounded-lg bg-[var(--bg-elevated)] p-3 text-center border border-[var(--border-subtle)]">
                            <span className="block text-[10px] text-[var(--text-secondary)] uppercase font-bold">
                              Total Duration
                            </span>
                            <span className="block text-base font-bold text-[var(--text-primary)]">
                              {Math.round(inspectedSummary.total_duration_seconds / 60)} mins
                            </span>
                          </div>
                          <div className="rounded-lg bg-emerald-500/5 p-3 text-center border border-emerald-500/20">
                            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                              Productive %
                            </span>
                            <span className="block text-base font-bold text-emerald-600 dark:text-emerald-400">
                              {inspectedSummary.productive_percentage}%
                            </span>
                          </div>
                          <div className="rounded-lg bg-amber-500/5 p-3 text-center border border-amber-500/20">
                            <span className="block text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">
                              Distraction %
                            </span>
                            <span className="block text-base font-bold text-amber-600 dark:text-amber-400">
                              {inspectedSummary.distraction_percentage}%
                            </span>
                          </div>
                          <div className="rounded-lg bg-blue-500/5 p-3 text-center border border-blue-500/20">
                            <span className="block text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">
                              Switches
                            </span>
                            <span className="block text-base font-bold text-blue-600 dark:text-blue-400">
                              {inspectedSummary.activity_switch_count}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                          <table className="w-full text-left font-mono text-xs">
                            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase border-b border-[var(--border-subtle)]">
                              <tr>
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2">Application / Task</th>
                                <th className="px-3 py-2">Duration</th>
                                <th className="px-3 py-2">Time</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                              {inspectedActivities.map((act) => (
                                <tr key={act.id}>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getActivityBadgeStyle(
                                        act.activity_type
                                      )}`}
                                    >
                                      {act.activity_type}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                                    {act.metadata_json?.application_name ||
                                      act.metadata_json?.app ||
                                      'General'}
                                  </td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                                    {(act.numeric_value || 0) < 60
                                      ? `${Math.round(act.numeric_value || 0)}s`
                                      : `${Math.round((act.numeric_value || 0) / 60)} mins`}
                                  </td>
                                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                                    {new Date(act.occurred_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={Activity}
                        title="No activity records for this session"
                        description="No transparent activity events were logged during this specific study interval."
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}