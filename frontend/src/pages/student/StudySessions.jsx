import { useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListPlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react'

import { SectionCard } from '../../components/dashboard/SectionCard'
import { EmptyState } from '../../components/dashboard/EmptyState'
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
  const [isStarting, setIsStarting] = useState(false)

  // Add Subject Modal State
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [isCreatingSubject, setIsCreatingSubject] = useState(false)

  // Active Session Telemetry & Log Activity State
  const [activeActivities, setActiveActivities] = useState([])
  const [activeSummary, setActiveSummary] = useState(null)
  const [activityType, setActivityType] = useState('productive')
  const [appName, setAppName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('15')
  const [isLoggingActivity, setIsLoggingActivity] = useState(false)
  const [activitySuccess, setActivitySuccess] = useState('')

  // Historical Session Activity Inspector
  const [inspectedSessionId, setInspectedSessionId] = useState(null)
  const [inspectedActivities, setInspectedActivities] = useState([])
  const [inspectedSummary, setInspectedSummary] = useState(null)
  const [inspectedLoading, setInspectedLoading] = useState(false)

  // Timer state for active session UI
  const [isPaused, setIsPaused] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [subjRes, sessRes] = await Promise.all([
        getStudentSubjects(),
        getStudySessions({ limit: 50 }),
      ])
      const fetchedSubjects = Array.isArray(subjRes) ? subjRes : []
      setSubjects(fetchedSubjects)
      if (fetchedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(fetchedSubjects[0].id)
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Timer calculation loop
  useEffect(() => {
    if (!activeSession || isPaused) return
    const startedAt = activeSession.started_at ? new Date(activeSession.started_at).getTime() : Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      setTimerSeconds(elapsed)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeSession, isPaused])

  const loadSessionActivities = async (sessionId) => {
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
  }

  const handleStartSession = async (e) => {
    e.preventDefault()
    if (isStarting) return
    setIsStarting(true)
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
      await fetchData()
    } catch (err) {
      console.error('Failed to start session:', err)
      alert(err.response?.data?.detail || 'Unable to start session.')
    } finally {
      setIsStarting(false)
    }
  }

  const handleEndSession = async () => {
    if (!activeSession) return
    try {
      await updateStudySession(activeSession.id, {
        ended_at: new Date().toISOString(),
        status: 'completed',
      })
      setActiveSession(null)
      setActiveActivities([])
      setActiveSummary(null)
      await fetchData()
    } catch (err) {
      console.error('Failed to end session:', err)
      alert(err.response?.data?.detail || 'Unable to end session.')
    }
  }

  const handleCreateSubject = async (e) => {
    e.preventDefault()
    if (!newSubjectName.trim() || isCreatingSubject) return
    setIsCreatingSubject(true)
    try {
      const created = await createStudentSubject({ name: newSubjectName.trim() })
      setSubjects((prev) => [...prev, created])
      setSelectedSubjectId(created.id)
      setNewSubjectName('')
      setShowAddSubject(false)
    } catch (err) {
      console.error('Failed to create subject:', err)
      alert(err.response?.data?.detail || 'Unable to create subject.')
    } finally {
      setIsCreatingSubject(false)
    }
  }

  const handleLogActivity = async (e) => {
    e.preventDefault()
    if (!activeSession || isLoggingActivity) return
    const durMins = parseFloat(durationMinutes) || 0
    if (durMins < 0) return

    setIsLoggingActivity(true)
    setActivitySuccess('')
    try {
      await createSessionActivity(activeSession.id, {
        activity_type: activityType,
        application_name: appName.trim() || 'General Study',
        duration_seconds: durMins * 60,
      })
      setAppName('')
      setActivitySuccess('Activity logged successfully.')
      await loadSessionActivities(activeSession.id)
      setTimeout(() => setActivitySuccess(''), 3000)
    } catch (err) {
      console.error('Failed to log activity:', err)
      alert(err.response?.data?.detail || 'Unable to log activity.')
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

  const getSubjectName = (subjId) => {
    const match = subjects.find((s) => s.id === subjId)
    return match ? match.name : 'General Study'
  }

  const getActivityBadgeStyle = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'productive':
      case 'study':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'distraction':
        return 'bg-amber-100 text-amber-800 border-amber-300'
      case 'break':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header Banner */}
      <section className="rounded-2xl border border-[#17221c]/15 bg-white p-6 sm:p-8 shadow-xs">
        <span className="font-mono text-xs font-bold tracking-widest text-[#4e6656] uppercase">
          Study Session System
        </span>
        <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#17221c]">
          Study Sessions & Behaviour Telemetry
        </h2>
        <p className="mt-2 text-sm text-[#405047] max-w-2xl leading-relaxed">
          Record focused study intervals, log transparent session activities, and aggregate
          behavioural metrics for future ML model evaluation.
        </p>
      </section>

      {/* Loading & Error Indicators */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-[#17221c]/15 bg-white p-8">
          <RefreshCw className="mr-2 size-5 animate-spin text-[#4e6656]" />
          <span className="font-mono text-xs font-semibold text-[#4e6656]">Loading study sessions...</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="rounded-md bg-red-100 px-3 py-1 font-mono text-xs font-bold hover:bg-red-200"
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
            subtitle={activeSession ? 'Telemetry logging & interval control' : 'Select subject and start session timer'}
            icon={Play}
          >
            {activeSession ? (
              <div className="space-y-6">
                {/* Active Timer Display */}
                <div className="rounded-xl border border-[#17221c]/15 bg-[#fbf9f4] p-6 text-center shadow-xs">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800 uppercase">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      {isPaused ? 'Paused' : 'Active'}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#4e6656]">
                      Subject: {getSubjectName(activeSession.subject_id)}
                    </span>
                  </div>

                  <div className="mt-3 font-mono text-5xl font-extrabold text-[#17221c] tracking-tight">
                    {formatTimer(timerSeconds)}
                  </div>

                  <div className="mt-5 flex justify-center gap-3">
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#17221c]/20 bg-white px-4 py-2 font-mono text-xs font-bold text-[#17221c] uppercase transition hover:bg-[#f5f1e8]"
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      onClick={handleEndSession}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 font-mono text-xs font-bold text-white uppercase transition hover:bg-red-800"
                    >
                      <CheckCircle2 size={14} />
                      <span>End Session</span>
                    </button>
                  </div>
                </div>

                {/* Log Activity Form (Explicit Task 10 Telemetry Input) */}
                <div className="rounded-xl border border-[#17221c]/15 bg-white p-5">
                  <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <ListPlus size={16} className="text-[#4e6656]" />
                      <h4 className="font-serif text-sm font-bold text-[#17221c]">Log Session Activity</h4>
                    </div>
                    {activitySuccess && (
                      <span className="font-mono text-xs text-emerald-700 font-semibold">{activitySuccess}</span>
                    )}
                  </div>

                  <form onSubmit={handleLogActivity} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[#4e6656] uppercase mb-1">
                        Activity Type
                      </label>
                      <select
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value)}
                        className="w-full rounded-lg border border-[#17221c]/20 bg-white px-3 py-2 text-xs font-medium text-[#17221c] focus:outline-none focus:ring-1 focus:ring-[#17221c]"
                      >
                        <option value="productive">Productive</option>
                        <option value="study">Study</option>
                        <option value="distraction">Distraction</option>
                        <option value="break">Break</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[#4e6656] uppercase mb-1">
                        Application / Task Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VS Code, Docs, Research"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[#17221c]/20 bg-white px-3 py-2 text-xs text-[#17221c] focus:outline-none focus:ring-1 focus:ring-[#17221c]"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[#4e6656] uppercase mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[#17221c]/20 bg-white px-3 py-2 text-xs text-[#17221c] focus:outline-none focus:ring-1 focus:ring-[#17221c]"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={isLoggingActivity}
                        className="w-full rounded-lg bg-[#17221c] px-4 py-2 font-mono text-xs font-bold text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32] disabled:opacity-50"
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
                      <div className="rounded-lg border border-[#17221c]/10 bg-[#fbf9f4] p-3 text-center">
                        <span className="block font-mono text-[10px] text-[#4e6656] uppercase font-bold">Total Logged</span>
                        <span className="block font-serif text-lg font-bold text-[#17221c]">
                          {Math.round(activeSummary.total_duration_seconds / 60)} mins
                        </span>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                        <span className="block font-mono text-[10px] text-emerald-800 uppercase font-bold">Productive</span>
                        <span className="block font-serif text-lg font-bold text-emerald-900">
                          {activeSummary.productive_percentage}%
                        </span>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                        <span className="block font-mono text-[10px] text-amber-800 uppercase font-bold">Distraction</span>
                        <span className="block font-serif text-lg font-bold text-amber-900">
                          {activeSummary.distraction_percentage}%
                        </span>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
                        <span className="block font-mono text-[10px] text-blue-800 uppercase font-bold">Context Switches</span>
                        <span className="block font-serif text-lg font-bold text-blue-900">
                          {activeSummary.activity_switch_count}
                        </span>
                      </div>
                    </div>

                    {/* Activity Log Table */}
                    {activeActivities.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-[#17221c]/15 bg-white">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="border-b border-[#17221c]/10 bg-[#fbf9f4] text-[#4e6656] uppercase">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">Type</th>
                              <th className="px-4 py-2.5 font-bold">Application / Task</th>
                              <th className="px-4 py-2.5 font-bold">Duration</th>
                              <th className="px-4 py-2.5 font-bold">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#17221c]/10">
                            {activeActivities.map((act) => (
                              <tr key={act.id} className="hover:bg-[#fbf9f4]/50">
                                <td className="px-4 py-2.5">
                                  <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getActivityBadgeStyle(act.activity_type)}`}>
                                    {act.activity_type}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 font-medium text-[#17221c]">
                                  {act.metadata_json?.application_name || act.metadata_json?.app || 'General'}
                                </td>
                                <td className="px-4 py-2.5 text-[#405047]">
                                  {Math.round((act.numeric_value || 0) / 60)} mins
                                </td>
                                <td className="px-4 py-2.5 text-[#405047]">
                                  {new Date(act.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Form to Start a Session */
              <form onSubmit={handleStartSession} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-xs font-bold text-[#4e6656] uppercase mb-1">
                      Subject
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        className="w-full rounded-lg border border-[#17221c]/20 bg-white px-3 py-2 text-xs font-medium text-[#17221c] focus:outline-none focus:ring-1 focus:ring-[#17221c]"
                      >
                        {subjects.map((subj) => (
                          <option key={subj.id} value={subj.id}>
                            {subj.name}
                          </option>
                        ))}
                        {subjects.length === 0 && <option value="">No subjects available</option>}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddSubject(true)}
                        className="flex items-center gap-1 rounded-lg border border-[#17221c]/20 bg-[#f5f1e8] px-3 py-2 font-mono text-xs font-bold text-[#17221c] hover:bg-[#17221c] hover:text-[#f5f1e8]"
                        title="Add New Subject"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-xs font-bold text-[#4e6656] uppercase mb-1">
                      Session Type
                    </label>
                    <select className="w-full rounded-lg border border-[#17221c]/20 bg-white px-3 py-2 text-xs font-medium text-[#17221c]">
                      <option value="focused">Focused Study</option>
                      <option value="revision">Revision</option>
                      <option value="practice">Practice / Quiz</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isStarting || subjects.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#17221c] px-5 py-2.5 font-mono text-xs font-bold text-[#f5f1e8] uppercase transition hover:bg-[#2b3a32] disabled:opacity-50"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>{isStarting ? 'Starting...' : 'Start Study Session'}</span>
                  </button>
                </div>
              </form>
            )}
          </SectionCard>

          {/* Quick Add Subject Modal / Inline Form */}
          {showAddSubject && (
            <div className="rounded-xl border border-[#17221c]/20 bg-[#fbf9f4] p-4 shadow-xs">
              <h4 className="font-serif text-sm font-bold text-[#17221c] mb-2">Add New Subject</h4>
              <form onSubmit={handleCreateSubject} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Operating Systems, Mathematics"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#17221c]/20 bg-white px-3 py-1.5 text-xs text-[#17221c] focus:outline-none focus:ring-1 focus:ring-[#17221c]"
                />
                <button
                  type="submit"
                  disabled={isCreatingSubject}
                  className="rounded-lg bg-[#17221c] px-4 py-1.5 font-mono text-xs font-bold text-[#f5f1e8] uppercase hover:bg-[#2b3a32]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
                  className="rounded-lg border border-[#17221c]/20 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-[#405047]"
                >
                  Cancel
                </button>
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
                <div className="overflow-x-auto rounded-lg border border-[#17221c]/15 bg-white">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-b border-[#17221c]/10 bg-[#fbf9f4] text-[#4e6656] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-bold">Subject</th>
                        <th className="px-4 py-3 font-bold">Date</th>
                        <th className="px-4 py-3 font-bold">Start / End</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold">Focus Score</th>
                        <th className="px-4 py-3 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#17221c]/10">
                      {sessions.map((sess) => {
                        const startDate = new Date(sess.started_at)
                        const endDate = sess.ended_at ? new Date(sess.ended_at) : null
                        const isInspected = inspectedSessionId === sess.id

                        return (
                          <tr key={sess.id} className={isInspected ? 'bg-[#fbf9f4]' : 'hover:bg-[#fbf9f4]/50'}>
                            <td className="px-4 py-3 font-semibold text-[#17221c]">
                              {getSubjectName(sess.subject_id)}
                            </td>
                            <td className="px-4 py-3 text-[#405047]">
                              {startDate.toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-[#405047]">
                              {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {endDate ? ` - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                sess.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sess.status === 'active'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {sess.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#17221c]/40 font-bold">—</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleInspectSession(sess.id)}
                                className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#17221c] hover:underline"
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
                  <div className="rounded-xl border border-[#17221c]/15 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#17221c]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-[#4e6656]" />
                        <h4 className="font-serif text-sm font-bold text-[#17221c]">
                          Historical Session Activity Telemetry
                        </h4>
                      </div>
                      <button
                        onClick={() => setInspectedSessionId(null)}
                        className="font-mono text-xs font-bold text-[#405047] hover:text-[#17221c]"
                      >
                        Close
                      </button>
                    </div>

                    {inspectedLoading ? (
                      <div className="py-6 text-center font-mono text-xs text-[#4e6656]">
                        Loading session telemetry...
                      </div>
                    ) : inspectedSummary && inspectedSummary.activity_count > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                          <div className="rounded-lg bg-[#fbf9f4] p-3 text-center border border-[#17221c]/10">
                            <span className="block text-[10px] text-[#4e6656] uppercase font-bold">Total Duration</span>
                            <span className="block font-serif text-base font-bold text-[#17221c]">
                              {Math.round(inspectedSummary.total_duration_seconds / 60)} mins
                            </span>
                          </div>
                          <div className="rounded-lg bg-emerald-50 p-3 text-center border border-emerald-200">
                            <span className="block text-[10px] text-emerald-800 uppercase font-bold">Productive %</span>
                            <span className="block font-serif text-base font-bold text-emerald-900">
                              {inspectedSummary.productive_percentage}%
                            </span>
                          </div>
                          <div className="rounded-lg bg-amber-50 p-3 text-center border border-amber-200">
                            <span className="block text-[10px] text-amber-800 uppercase font-bold">Distraction %</span>
                            <span className="block font-serif text-base font-bold text-amber-900">
                              {inspectedSummary.distraction_percentage}%
                            </span>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-3 text-center border border-blue-200">
                            <span className="block text-[10px] text-blue-800 uppercase font-bold">Switches</span>
                            <span className="block font-serif text-base font-bold text-blue-900">
                              {inspectedSummary.activity_switch_count}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-[#17221c]/10">
                          <table className="w-full text-left font-mono text-xs">
                            <thead className="bg-[#fbf9f4] text-[#4e6656] uppercase border-b border-[#17221c]/10">
                              <tr>
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2">Application / Task</th>
                                <th className="px-3 py-2">Duration</th>
                                <th className="px-3 py-2">Time</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#17221c]/10">
                              {inspectedActivities.map((act) => (
                                <tr key={act.id}>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getActivityBadgeStyle(act.activity_type)}`}>
                                      {act.activity_type}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-medium text-[#17221c]">
                                    {act.metadata_json?.application_name || act.metadata_json?.app || 'General'}
                                  </td>
                                  <td className="px-3 py-2 text-[#405047]">
                                    {Math.round((act.numeric_value || 0) / 60)} mins
                                  </td>
                                  <td className="px-3 py-2 text-[#405047]">
                                    {new Date(act.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
