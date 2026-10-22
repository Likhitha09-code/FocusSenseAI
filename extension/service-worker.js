/**
 * FocusSense AI - Extension Background Service Worker (Manifest V3)
 *
 * Monitors active tab changes and categorizes domain metadata ONLY when
 * a FocusSense study session is actively running.
 */

// Default domain classification lists (fallback if rules.json not in storage)
const DEFAULT_STUDY_DOMAINS = [
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'stackexchange.com',
  'developer.mozilla.org',
  'w3schools.com',
  'python.org',
  'docs.python.org',
  'wikipedia.org',
  'arxiv.org',
  'scholar.google.com',
  'researchgate.net',
  'coursera.org',
  'edx.org',
  'khanacademy.org',
  'udemy.com',
  'leetcode.com',
  'geeksforgeeks.org',
  'canvas.net',
  'instructure.com',
  'blackboard.com',
  'moodle.org',
  'localhost',
  '127.0.0.1',
]

const DEFAULT_DISTRACTION_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'netflix.com',
  'twitch.tv',
  'hulu.com',
  'disneyplus.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'pinterest.com',
  'tumblr.com',
  'discord.com',
  'web.whatsapp.com',
  '9gag.com',
  'buzzfeed.com',
]

function categorizeDomain(hostname, rules) {
  if (!hostname) return 'unknown'
  const host = hostname.toLowerCase()

  const studyList = rules?.study_domains || DEFAULT_STUDY_DOMAINS
  const distractionList = rules?.distraction_domains || DEFAULT_DISTRACTION_DOMAINS

  for (const s of studyList) {
    if (host === s || host.endsWith('.' + s)) {
      return 'study'
    }
  }

  for (const d of distractionList) {
    if (host === d || host.endsWith('.' + d)) {
      return 'distraction'
    }
  }

  return 'unknown'
}

function extractHostname(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  try {
    const url = new URL(rawUrl)
    if (['http:', 'https:'].includes(url.protocol)) {
      return url.hostname
    }
    if (['brave:', 'chrome:', 'edge:', 'about:'].includes(url.protocol)) {
      return 'browser_tab'
    }
  } catch {
    // Non-URL scheme
  }
  return null
}

// Log an observed domain interval to the FocusSense backend API
async function logActivityToBackend(sessionData, activity) {
  const { sessionId, token } = sessionData
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!sessionId || !UUID_REGEX.test(String(sessionId))) {
    console.warn('[FocusSense Service Worker] Cannot log activity: missing or non-UUID sessionId:', sessionId)
    return { success: false, error: 'invalid_sessionId' }
  }

  const endpoint = `http://127.0.0.1:8000/api/v1/student/sessions/${sessionId}/activities`
  const headers = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Ensure safe payload bounds
  const safePayload = {
    ...activity,
    application_name: String(activity.application_name || 'browser_tab').trim().slice(0, 200),
    duration_seconds: Math.max(0.0, Math.round((activity.duration_seconds || 1.0) * 10) / 10),
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(safePayload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[FocusSense Service Worker] Direct API log failed (status ${res.status}):`, errText)
      return { success: false, status: res.status, error: errText }
    }

    const savedData = await res.json()
    console.info(`[FocusSense Service Worker] Activity logged to API: ${activity.activity_type} (${activity.application_name}, ${activity.duration_seconds}s)`)
    return { success: true, data: savedData }
  } catch (err) {
    console.warn('[FocusSense Service Worker] Direct API network error (web client will reconcile):', err?.message || err)
    return { success: false, error: err?.message || 'network_error' }
  }
}

// Handle recording the completed domain interval when a user switches tabs
async function recordActiveDomainTransition(newHostname) {
  const data = await chrome.storage.local.get([
    'isMonitoring',
    'sessionId',
    'subjectName',
    'token',
    'activeHostname',
    'activeCategory',
    'domainStartTime',
    'switchCount',
    'rules',
    'focusSenseTabId',
  ])

  if (!data.isMonitoring || !data.sessionId) {
    return
  }

  const now = Date.now()
  const prevHostname = data.activeHostname
  const prevCategory = data.activeCategory
  const startTime = data.domainStartTime || now
  const elapsedSec = (now - startTime) / 1000

  let logResult = { success: false }

  // 1. Commit previous domain activity if it was active for >= 1.0 second
  if (prevHostname && elapsedSec >= 1.0) {
    let actType = 'productive'
    if (prevCategory === 'distraction') actType = 'distraction'
    else if (prevCategory === 'unknown') actType = 'unknown'

    const clientEventId = `ext-${data.sessionId}-${startTime}-${prevHostname}`
    const activityPayload = {
      activity_type: actType,
      application_name: prevHostname,
      duration_seconds: Math.round(elapsedSec * 10) / 10,
      occurred_at: new Date(startTime).toISOString(),
      metadata_json: {
        domain: prevHostname,
        category: prevCategory,
        source: 'browser_extension',
        event_type: 'tab_switch',
        client_event_id: clientEventId,
      },
    }

    logResult = await logActivityToBackend(data, activityPayload)

    // Notify web app via content script
    const tabEventPayload = {
      domain: prevHostname,
      category: prevCategory,
      durationSeconds: Math.round(elapsedSec * 10) / 10,
      startTime: startTime,
      clientEventId: clientEventId,
      directLogSuccess: logResult.success,
    }

    try {
      // First attempt sending to the known FocusSense tab ID
      let messageSent = false
      if (data.focusSenseTabId) {
        try {
          await chrome.tabs.sendMessage(data.focusSenseTabId, {
            type: 'TAB_EVENT',
            payload: tabEventPayload,
          })
          messageSent = true
        } catch {
          // Tab may have changed ID or reloaded, fall back to query
        }
      }

      if (!messageSent) {
        const tabs = await chrome.tabs.query({
          url: [
            'http://localhost:5173/*',
            'http://127.0.0.1:5173/*',
            'http://localhost:5174/*',
            'http://127.0.0.1:5174/*',
            'http://localhost:5175/*',
            'http://127.0.0.1:5175/*',
            'http://localhost:3000/*',
            'http://127.0.0.1:3000/*',
          ],
        })
        for (const t of tabs) {
          if (t.id) {
            await chrome.tabs.sendMessage(t.id, {
              type: 'TAB_EVENT',
              payload: tabEventPayload,
            }).catch(() => {})
          }
        }
      }
    } catch {
      // Ignore if web tab cannot receive
    }
  }

  // 2. Set new active domain state
  const newCat = categorizeDomain(newHostname, data.rules)
  const isDifferentDomain = prevHostname && newHostname && prevHostname !== newHostname
  const newSwitchCount = (data.switchCount || 0) + (isDifferentDomain ? 1 : 0)

  await chrome.storage.local.set({
    activeHostname: newHostname,
    activeCategory: newCat,
    domainStartTime: now,
    switchCount: newSwitchCount,
  })

  // Update extension badge
  try {
    if (newCat === 'distraction') {
      await chrome.action.setBadgeText({ text: 'DIST' })
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    } else if (newCat === 'study') {
      await chrome.action.setBadgeText({ text: 'STUDY' })
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
    } else {
      await chrome.action.setBadgeText({ text: 'ON' })
      await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' })
    }
  } catch {
    // Ignore badge errors
  }
}

// Lifecycle event handler (clean reload logging, no duplicate content script injections)
chrome.runtime.onInstalled.addListener((details) => {
  console.info('[FocusSense Service Worker] Extension lifecycle event:', details.reason)
})

// Tab activation listener (user clicks a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { isMonitoring } = await chrome.storage.local.get('isMonitoring')
  if (!isMonitoring) return

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    const hostname = extractHostname(tab.url || tab.pendingUrl)
    await recordActiveDomainTransition(hostname)
  } catch (err) {
    console.warn('[FocusSense Service Worker] onActivated error:', err)
  }
})

// Tab URL update listener (user navigates to a new URL inside the active tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.active) return
  const { isMonitoring } = await chrome.storage.local.get('isMonitoring')
  if (!isMonitoring) return

  const hostname = extractHostname(tab.url || tab.pendingUrl)
  if (hostname) {
    await recordActiveDomainTransition(hostname)
  }
})

// Message handler from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.action === 'PING') {
      const state = await chrome.storage.local.get('isMonitoring')
      sendResponse({
        status: 'pong',
        version: '1.0.0',
        isMonitoring: Boolean(state?.isMonitoring),
      })
    } else if (message.action === 'START_SESSION') {
      const existingState = await chrome.storage.local.get(['isMonitoring', 'sessionId'])
      if (existingState.isMonitoring && existingState.sessionId === message.sessionId) {
        console.info('[FocusSense Service Worker] Session monitoring already active for sessionId:', message.sessionId?.substring(0, 8))
        sendResponse({ status: 'monitoring_started', sessionId: message.sessionId, already_running: true })
        return
      }

      const now = Date.now()
      let initialHost = 'localhost'
      try {
        if (sender?.tab?.url) {
          initialHost = extractHostname(sender.tab.url) || 'localhost'
        } else {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.url) {
            initialHost = extractHostname(activeTab.url) || 'localhost'
          }
        }
      } catch {
        // Fallback
      }

      const focusTabId = sender?.tab?.id || null

      await chrome.storage.local.set({
        isMonitoring: true,
        sessionId: message.sessionId,
        subjectName: message.subjectName || 'General Study',
        token: message.token || null,
        activeHostname: initialHost,
        activeCategory: 'study',
        domainStartTime: now,
        switchCount: 0,
        focusSenseTabId: focusTabId,
      })

      console.info('[FocusSense Service Worker] Session monitoring active for sessionId:', message.sessionId?.substring(0, 8), 'tabId:', focusTabId)

      try {
        await chrome.action.setBadgeText({ text: 'ON' })
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
      } catch {
        // Ignore
      }

      sendResponse({ status: 'monitoring_started', sessionId: message.sessionId })
    } else if (message.action === 'STOP_SESSION') {
      // Flush final domain interval
      await recordActiveDomainTransition(null)

      await chrome.storage.local.set({
        isMonitoring: false,
        sessionId: null,
        activeHostname: null,
        activeCategory: null,
        focusSenseTabId: null,
      })

      console.info('[FocusSense Service Worker] Session monitoring stopped')

      try {
        await chrome.action.setBadgeText({ text: '' })
      } catch {
        // Ignore
      }
      sendResponse({ status: 'monitoring_stopped' })
    } else if (message.action === 'GET_STATUS') {
      const state = await chrome.storage.local.get([
        'isMonitoring',
        'sessionId',
        'subjectName',
        'activeHostname',
        'activeCategory',
        'switchCount',
      ])
      sendResponse(state)
    }
  })()
  return true // Keep sendResponse open
})
