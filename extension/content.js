/**
 * FocusSense AI - Content Script Bridge
 *
 * Facilitates robust, two-way communication between the FocusSense AI web application
 * and the extension background service worker.
 */

// Unique ID for this specific script injection to gracefully retire superseded instances
const INJECTION_ID = Math.random().toString(36).slice(2)
window.__FOCUSSENSE_ACTIVE_INJECTION_ID__ = INJECTION_ID

// Helper to verify if the Chrome extension execution context is alive and valid
function isRuntimeAvailable() {
  try {
    return Boolean(
      typeof chrome !== 'undefined' &&
      chrome?.runtime &&
      chrome.runtime.id
    )
  } catch {
    return false
  }
}

// Disconnect orphaned bridge and notify the FocusSense web page
function handleInvalidatedContext(errorDetails) {
  console.warn('[FocusSense Extension] Context invalidated. Detaching orphaned bridge:', errorDetails)

  // Remove listener so orphaned script stops intercepting messages
  try {
    window.removeEventListener('message', handleWindowMessage)
  } catch {
    // Ignore
  }

  // Notify web app window so it updates UI and falls back gracefully
  try {
    window.postMessage(
      {
        type: 'FOCUSSENSE_EXTENSION_CONTEXT_INVALIDATED',
        error: 'Extension was reloaded. Please refresh the page to reconnect.',
      },
      window.location.origin
    )
  } catch {
    // Ignore postMessage errors
  }
}

// Window message handler for messages from the FocusSense web app
function handleWindowMessage(event) {
  // Strict origin check
  if (
    event.origin !== window.location.origin ||
    !event.data ||
    typeof event.data !== 'object'
  ) {
    return
  }

  // If a newer injection exists, retire this listener
  if (window.__FOCUSSENSE_ACTIVE_INJECTION_ID__ !== INJECTION_ID) {
    window.removeEventListener('message', handleWindowMessage)
    return
  }

  // Pre-flight check before touching chrome.runtime
  if (!isRuntimeAvailable()) {
    handleInvalidatedContext('Runtime unavailable in window message listener')
    return
  }

  const { type, sessionId, subjectName, token } = event.data

  if (type === 'FOCUSSENSE_PING') {
    try {
      chrome.runtime.sendMessage({ action: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message
          if (errMsg.includes('context invalidated') || errMsg.includes('Receiving end does not exist')) {
            handleInvalidatedContext(errMsg)
          }
          return
        }
        if (response && response.status === 'pong') {
          window.postMessage(
            {
              type: 'FOCUSSENSE_EXTENSION_PONG',
              version: response.version || '1.0.0',
              status: 'ready',
              isMonitoring: Boolean(response.isMonitoring),
            },
            window.location.origin
          )
          document.dispatchEvent(
            new CustomEvent('FocusSenseExtensionPong', {
              detail: { version: response.version || '1.0.0', status: 'ready' },
            })
          )
        }
      })
    } catch (err) {
      handleInvalidatedContext(err?.message || err)
    }
  } else if (type === 'FOCUSSENSE_SESSION_START') {
    if (!sessionId) return
    console.log(`[FocusSense Extension] Forwarding session start for: ${sessionId.substring(0, 8)}... (hasToken: ${Boolean(token)})`)
    try {
      chrome.runtime.sendMessage(
        {
          action: 'START_SESSION',
          sessionId,
          subjectName,
          token: token || null,
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message
            if (errMsg.includes('context invalidated') || errMsg.includes('Receiving end does not exist')) {
              handleInvalidatedContext(errMsg)
            } else {
              console.warn('[FocusSense Extension] Failed to forward session start:', errMsg)
            }
            return
          }
          console.log('[FocusSense Extension] Background worker acknowledged session start:', resp?.status || 'ok')
          window.postMessage(
            {
              type: 'FOCUSSENSE_EXTENSION_SESSION_STARTED',
              sessionId,
              version: resp?.version || '1.0.0',
            },
            window.location.origin
          )
        }
      )
    } catch (err) {
      handleInvalidatedContext(err?.message || err)
    }
  } else if (type === 'FOCUSSENSE_SESSION_STOP') {
    console.log('[FocusSense Extension] Forwarding session stop signal to background worker')
    try {
      chrome.runtime.sendMessage(
        {
          action: 'STOP_SESSION',
          sessionId,
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message
            if (errMsg.includes('context invalidated') || errMsg.includes('Receiving end does not exist')) {
              handleInvalidatedContext(errMsg)
            } else {
              console.warn('[FocusSense Extension] Failed to forward session stop:', errMsg)
            }
            return
          }
          console.log('[FocusSense Extension] Background worker acknowledged session stop:', resp?.status || 'ok')
        }
      )
    } catch (err) {
      handleInvalidatedContext(err?.message || err)
    }
  }
}

// Bind window message listener
window.addEventListener('message', handleWindowMessage)

// Listen for messages forwarded from the background service worker
if (isRuntimeAvailable() && chrome?.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.type === 'TAB_EVENT') {
        console.log('[FocusSense Extension] Relaying tab event to web app:', {
          domain: message.payload?.domain,
          category: message.payload?.category,
          duration: message.payload?.durationSeconds,
          directLogSuccess: message.payload?.directLogSuccess,
        })
        window.postMessage(
          {
            type: 'FOCUSSENSE_EXTENSION_TAB_EVENT',
            payload: message.payload,
          },
          window.location.origin
        )
        document.dispatchEvent(
          new CustomEvent('FocusSenseExtensionTabEvent', {
            detail: message.payload,
          })
        )
        sendResponse({ received: true })
      }
      return true
    })
  } catch (err) {
    console.warn('[FocusSense Extension] onMessage listener registration failed:', err)
  }
}

// Initial announcement if runtime is currently healthy
console.log('[FocusSense Extension] Content bridge initialized for origin:', window.location.origin)
if (isRuntimeAvailable()) {
  try {
    chrome.runtime.sendMessage({ action: 'PING' }, (response) => {
      if (!chrome.runtime.lastError && response?.status === 'pong') {
        window.postMessage(
          {
            type: 'FOCUSSENSE_EXTENSION_PONG',
            version: response.version || '1.0.0',
            status: 'ready',
            isMonitoring: Boolean(response.isMonitoring),
          },
          window.location.origin
        )
        document.dispatchEvent(
          new CustomEvent('FocusSenseExtensionPong', {
            detail: { version: response.version || '1.0.0', status: 'ready' },
          })
        )
      }
    })
  } catch {
    // Suppress initial ping errors
  }
}
