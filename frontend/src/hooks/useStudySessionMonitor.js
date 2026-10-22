import { useCallback, useEffect, useRef, useState } from 'react'
import { createSessionActivity } from '../lib/api'
import { getCurrentSession } from '../lib/supabase'

/**
 * useStudySessionMonitor
 *
 * Privacy-conscious real-time browser telemetry hook for FocusSense AI study sessions.
 * Monitors:
 *  - Page visibility changes (document.visibilitychange)
 *  - Window focus / blur events
 *  - Active interruption count and durations
 *  - Heartbeat telemetry
 *  - FocusSense Browser Extension bridge (via window.postMessage)
 */
export function useStudySessionMonitor({
  activeSession,
  sessionMode: _sessionMode = 'focused',
  isPaused = false,
  subjectName = 'General Study',
  onActivityLogged = () => {},
}) {
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(true)
  const [currentFocusState, setCurrentFocusState] = useState('focused') // 'focused' | 'interrupted'
  const [interruptionCount, setInterruptionCount] = useState(0)
  const [interruptionSeconds, setInterruptionSeconds] = useState(0)
  const [extensionConnected, setExtensionConnected] = useState(false)
  const [extensionEventsReceived, setExtensionEventsReceived] = useState(0)
  const [extensionContextError, setExtensionContextError] = useState(null)
  const [activeExternalDomain, setActiveExternalDomain] = useState(null)

  // Internal tracking refs to prevent stale closures and effect dependency thrashing
  const focusStateRef = useRef('focused')
  const stateStartTimeRef = useRef(0)
  const activeSessionRef = useRef(activeSession)
  const subjectNameRef = useRef(subjectName)
  const isPausedRef = useRef(isPaused)
  const isMonitoringRef = useRef(isMonitoringEnabled)
  const extensionConnectedRef = useRef(false)
  const lastExtensionEventTimeRef = useRef(0)
  const onActivityLoggedRef = useRef(onActivityLogged)
  const startedSessionIdRef = useRef(null)

  useEffect(() => {
    activeSessionRef.current = activeSession
    subjectNameRef.current = subjectName
    isPausedRef.current = isPaused
    isMonitoringRef.current = isMonitoringEnabled
    extensionConnectedRef.current = extensionConnected
    onActivityLoggedRef.current = onActivityLogged
  })

  // Stable activity committer: depends on no volatile states (all in refs)
  const commitIntervalActivity = useCallback(
    async (type, appName, durationSec, startTs, eventType = 'state_transition', customClientEventId = null) => {
      const sess = activeSessionRef.current
      if (!sess || !sess.id) return null

      // Strict UUID validation on session ID to prevent 422 errors
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_REGEX.test(String(sess.id))) {
        console.warn('[FocusSense Web Monitor] Session ID is not a valid UUID:', sess.id)
        return null
      }

      const safeDur = Number.isFinite(durationSec) && durationSec >= 1.0 ? Math.round(durationSec * 10) / 10 : null
      if (safeDur === null) return null

      const safeStart = Number.isFinite(startTs) && startTs > 0 ? startTs : Date.now() - Math.round(safeDur * 1000)
      const safeAppName = String(appName || subjectNameRef.current || 'General Study').trim().slice(0, 200)
      const clientEventId = customClientEventId || `evt-${sess.id}-${safeStart}-${type}`

      const payload = {
        activity_type: type,
        application_name: safeAppName,
        duration_seconds: safeDur,
        occurred_at: new Date(safeStart).toISOString(),
        metadata_json: {
          client_event_id: clientEventId,
          source: customClientEventId?.startsWith('ext-')
            ? 'browser_extension'
            : extensionConnectedRef.current
            ? 'browser_extension'
            : 'web_focus_monitor',
          event_type: eventType,
        },
      }

      try {
        const result = await createSessionActivity(sess.id, payload)
        console.info(`[FocusSense Web Monitor] Telemetry activity committed: ${type} (${payload.application_name}, ${safeDur}s)`)
        if (onActivityLoggedRef.current) onActivityLoggedRef.current(result)
        return result
      } catch (err) {
        console.warn('[FocusSense Web Monitor] Failed to commit activity:', err?.message || err)
        return null
      }
    },
    []
  )

  // Stable state transition handler
  const transitionTo = useCallback(
    async (newState, _reason = '') => {
      if (!isMonitoringRef.current || isPausedRef.current || !activeSessionRef.current) {
        return
      }

      const prevState = focusStateRef.current
      if (prevState === newState) return

      const now = Date.now()
      const elapsedSec = (now - stateStartTimeRef.current) / 1000

      // 1. Commit the ending interval if it had measurable duration
      if (prevState === 'focused') {
        if (elapsedSec >= 2.0) {
          await commitIntervalActivity(
            'productive',
            subjectNameRef.current,
            elapsedSec,
            stateStartTimeRef.current,
            'page_blur'
          )
        }
      } else if (prevState === 'interrupted') {
        if (elapsedSec >= 1.0) {
          // If extension recently recorded a domain event, don't duplicate with generic interruption
          const timeSinceExtEvent = Date.now() - lastExtensionEventTimeRef.current
          if (timeSinceExtEvent > 4000) {
            await commitIntervalActivity(
              'interruption',
              'Browser Tab Switch / Window Blur',
              elapsedSec,
              stateStartTimeRef.current,
              'page_focus'
            )
          }
          setInterruptionSeconds((prev) => prev + Math.round(elapsedSec))
        }
      }

      // 2. Set new state
      focusStateRef.current = newState
      stateStartTimeRef.current = now
      setCurrentFocusState(newState)

      if (newState === 'interrupted') {
        setInterruptionCount((prev) => prev + 1)
      } else {
        setActiveExternalDomain(null)
      }
    },
    [commitIntervalActivity]
  )

  // Stable extension start notification
  const notifyExtensionSessionStart = useCallback(async () => {
    const sess = activeSessionRef.current
    if (!sess || !sess.id) return

    try {
      const authSess = await getCurrentSession()
      const token = authSess?.access_token || null
      console.log(`[FocusSense Web App] Starting extension monitoring for session ${sess.id.substring(0, 8)}... (hasToken: ${Boolean(token)})`)
      window.postMessage(
        {
          type: 'FOCUSSENSE_SESSION_START',
          sessionId: sess.id,
          subjectName: subjectNameRef.current,
          token,
        },
        window.location.origin
      )
    } catch {
      window.postMessage(
        {
          type: 'FOCUSSENSE_SESSION_START',
          sessionId: sess.id,
          subjectName: subjectNameRef.current,
          token: null,
        },
        window.location.origin
      )
    }
  }, [])

  // Flush open interval at session completion
  const flushCurrentInterval = useCallback(async () => {
    const sess = activeSessionRef.current
    if (!sess || !sess.id) return

    const now = Date.now()
    const elapsedSec = (now - stateStartTimeRef.current) / 1000
    if (elapsedSec >= 1.0) {
      const currentState = focusStateRef.current
      if (currentState === 'focused') {
        await commitIntervalActivity(
          'productive',
          subjectNameRef.current,
          elapsedSec,
          stateStartTimeRef.current,
          'session_end_flush'
        )
      } else if (currentState === 'interrupted') {
        const timeSinceExtEvent = Date.now() - lastExtensionEventTimeRef.current
        if (timeSinceExtEvent > 4000) {
          await commitIntervalActivity(
            'interruption',
            'Browser Tab Switch / Window Blur',
            elapsedSec,
            stateStartTimeRef.current,
            'session_end_flush'
          )
        }
        setInterruptionSeconds((prev) => prev + Math.round(elapsedSec))
      }
    }

    // Stop extension monitoring on session completion flush
    if (startedSessionIdRef.current) {
      const endingId = startedSessionIdRef.current
      startedSessionIdRef.current = null
      console.log(`[FocusSense Web App] Session ended via flush. Stopping extension monitoring for: ${endingId}`)
      try {
        window.postMessage(
          {
            type: 'FOCUSSENSE_SESSION_STOP',
            sessionId: endingId,
          },
          window.location.origin
        )
      } catch {
        // Ignore
      }
    }
  }, [commitIntervalActivity])

  // EFFECT 1: Browser Extension Bridge Listener (Always mounted on page load)
  useEffect(() => {
    console.log('[FocusSense Web App] Telemetry monitor mounted. Discovering FocusSense browser extension...')

    const handleExtensionMessage = async (event) => {
      if (
        event.origin !== window.location.origin ||
        !event.data ||
        typeof event.data !== 'object'
      ) {
        return
      }
      const { type, payload } = event.data

      if (type === 'FOCUSSENSE_EXTENSION_PONG') {
        console.log(`[FocusSense Web App] Extension handshake confirmed: FocusSense AI Extension v${event.data.version || '1.0.0'} is ready.`)
        setExtensionContextError(null)

        // Resync active session if one is running and not yet started in extension
        if (
          activeSessionRef.current?.id &&
          startedSessionIdRef.current !== activeSessionRef.current.id
        ) {
          startedSessionIdRef.current = activeSessionRef.current.id
          notifyExtensionSessionStart()
        }
      } else if (type === 'FOCUSSENSE_EXTENSION_SESSION_STARTED') {
        console.log(`[FocusSense Web App] Extension monitoring confirmed active by background service worker for session: ${payload?.sessionId || event.data.sessionId}`)
        setExtensionConnected(true)
        extensionConnectedRef.current = true
        setExtensionContextError(null)
      } else if (type === 'FOCUSSENSE_EXTENSION_CONTEXT_INVALIDATED') {
        console.warn('[FocusSense Web App] Extension context was invalidated (extension reloaded). Web fallback active.')
        setExtensionConnected(false)
        extensionConnectedRef.current = false
        setExtensionContextError('Extension was reloaded. Refresh this tab to reconnect.')
      } else if (type === 'FOCUSSENSE_EXTENSION_TAB_EVENT') {
        setExtensionConnected(true)
        extensionConnectedRef.current = true
        if (payload?.domain) {
          console.log(`[FocusSense Web App] Tab transition event received from extension: ${payload.domain} (${payload.category || 'unknown'}, ${payload.durationSeconds}s)`)
          lastExtensionEventTimeRef.current = Date.now()
          setActiveExternalDomain(payload.domain)
          setExtensionEventsReceived((prev) => prev + 1)

          if (payload.category === 'distraction') {
            transitionTo('interrupted', `extension_distraction:${payload.domain}`)
          }

          // If the extension direct API log failed or was skipped, web client commits it
          if (!payload.directLogSuccess && activeSessionRef.current?.id) {
            let actType = 'productive'
            if (payload.category === 'distraction') actType = 'distraction'
            else if (payload.category === 'unknown') actType = 'unknown'

            await commitIntervalActivity(
              actType,
              payload.domain,
              payload.durationSeconds || 1.0,
              payload.startTime || (Date.now() - (payload.durationSeconds || 1) * 1000),
              'tab_switch',
              payload.clientEventId
            )
          } else {
            if (onActivityLoggedRef.current) onActivityLoggedRef.current()
          }
        }
      } else if (type === 'FOCUSSENSE_EXTENSION_ACTIVITY_LOGGED') {
        setExtensionEventsReceived((prev) => prev + 1)
        if (onActivityLoggedRef.current) onActivityLoggedRef.current(payload)
      }
    }

    const handleDomPong = (e) => {
      console.log('[FocusSense Web App] DOM custom event PONG received from extension:', e.detail)
      setExtensionContextError(null)
      if (
        activeSessionRef.current?.id &&
        startedSessionIdRef.current !== activeSessionRef.current.id
      ) {
        startedSessionIdRef.current = activeSessionRef.current.id
        notifyExtensionSessionStart()
      }
    }

    const handleDomTabEvent = (e) => {
      if (e.detail?.domain) {
        handleExtensionMessage({
          origin: window.location.origin,
          data: { type: 'FOCUSSENSE_EXTENSION_TAB_EVENT', payload: e.detail },
        })
      }
    }

    window.addEventListener('message', handleExtensionMessage)
    document.addEventListener('FocusSenseExtensionPong', handleDomPong)
    document.addEventListener('FocusSenseExtensionTabEvent', handleDomTabEvent)

    // Immediate ping on mount
    window.postMessage({ type: 'FOCUSSENSE_PING' }, window.location.origin)

    // Periodic ping until extension responds
    const pingTimer = setInterval(() => {
      if (!extensionConnectedRef.current) {
        window.postMessage({ type: 'FOCUSSENSE_PING' }, window.location.origin)
      }
    }, 2000)

    return () => {
      window.removeEventListener('message', handleExtensionMessage)
      document.removeEventListener('FocusSenseExtensionPong', handleDomPong)
      document.removeEventListener('FocusSenseExtensionTabEvent', handleDomTabEvent)
      clearInterval(pingTimer)
    }
  }, [notifyExtensionSessionStart, transitionTo, commitIntervalActivity])

  // EFFECT 2: Active Session Lifecycle (Only active while a study session is running)
  useEffect(() => {
    const sessId = activeSession?.id
    if (!sessId || isPaused || !isMonitoringEnabled) {
      return
    }

    console.log(`[FocusSense Web App] Active study session started: ${sessId}`)

    // Reset tracking state on session start
    focusStateRef.current = 'focused'
    stateStartTimeRef.current = Date.now()
    setCurrentFocusState('focused')
    setInterruptionCount(0)
    setInterruptionSeconds(0)

    // Signal start to extension if not already started for this session
    if (startedSessionIdRef.current !== sessId) {
      startedSessionIdRef.current = sessId
      notifyExtensionSessionStart()
    }

    // In-tab focus & visibility handlers
    const handleVisibilityChange = () => {
      if (document.hidden) {
        transitionTo('interrupted', 'visibility_hidden')
      } else {
        transitionTo('focused', 'visibility_visible')
      }
    }

    const handleWindowBlur = () => {
      transitionTo('interrupted', 'window_blur')
    }

    const handleWindowFocus = () => {
      if (!document.hidden) {
        transitionTo('focused', 'window_focus')
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    // Heartbeat every 10 seconds to verify telemetry integrity
    const heartbeatTimer = setInterval(() => {
      if (focusStateRef.current === 'focused' && !document.hidden) {
        const now = Date.now()
        const activeSeconds = (now - stateStartTimeRef.current) / 1000
        if (activeSeconds >= 30.0) {
          commitIntervalActivity(
            'productive',
            subjectNameRef.current,
            activeSeconds,
            stateStartTimeRef.current,
            'periodic_heartbeat'
          )
          stateStartTimeRef.current = now
        }
      }
    }, 10000)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
      clearInterval(heartbeatTimer)
    }
  }, [
    activeSession?.id,
    isPaused,
    isMonitoringEnabled,
    notifyExtensionSessionStart,
    transitionTo,
    commitIntervalActivity,
  ])

  // EFFECT 3: Stop notification when session completes or activeSession becomes null
  useEffect(() => {
    if (!activeSession && startedSessionIdRef.current) {
      const endedId = startedSessionIdRef.current
      startedSessionIdRef.current = null
      console.log(`[FocusSense Web App] Stopping extension monitoring for ended session: ${endedId}`)
      try {
        window.postMessage(
          {
            type: 'FOCUSSENSE_SESSION_STOP',
            sessionId: endedId,
          },
          window.location.origin
        )
      } catch {
        // Ignore
      }
    }
  }, [activeSession])

  // EFFECT 4: Component Unmount Cleanup
  useEffect(() => {
    return () => {
      if (startedSessionIdRef.current) {
        const endingId = startedSessionIdRef.current
        startedSessionIdRef.current = null
        try {
          window.postMessage(
            {
              type: 'FOCUSSENSE_SESSION_STOP',
              sessionId: endingId,
            },
            window.location.origin
          )
        } catch {
          // Ignore
        }
      }
    }
  }, [])

  return {
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
  }
}
