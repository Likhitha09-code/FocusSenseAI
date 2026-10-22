/**
 * FocusSense AI - Popup Script
 */
document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge')
  const statusText = document.getElementById('statusText')
  const sessionIdEl = document.getElementById('sessionId')
  const subjectNameEl = document.getElementById('subjectName')
  const activeDomainEl = document.getElementById('activeDomain')
  const activeCategoryEl = document.getElementById('activeCategory')
  const switchCountEl = document.getElementById('switchCount')

  try {
    const status = await chrome.runtime.sendMessage({ action: 'GET_STATUS' })
    if (status && status.isMonitoring) {
      statusBadge.className = 'status-badge status-active'
      statusText.textContent = 'Active'

      const shortId = status.sessionId ? status.sessionId.substring(0, 8) + '...' : 'Active'
      sessionIdEl.textContent = shortId
      subjectNameEl.textContent = status.subjectName || 'General Study'
      activeDomainEl.textContent = status.activeHostname || 'localhost'
      switchCountEl.textContent = status.switchCount || 0

      const cat = status.activeCategory || 'study'
      activeCategoryEl.textContent = cat
      if (cat === 'study') activeCategoryEl.className = 'category-tag tag-study'
      else if (cat === 'distraction') activeCategoryEl.className = 'category-tag tag-distraction'
      else activeCategoryEl.className = 'category-tag tag-unknown'
    } else {
      statusBadge.className = 'status-badge status-idle'
      statusText.textContent = 'Idle'
      sessionIdEl.textContent = 'No Active Session'
      subjectNameEl.textContent = '—'
      activeDomainEl.textContent = '—'
      activeCategoryEl.textContent = 'Idle'
      activeCategoryEl.className = 'category-tag tag-unknown'
      switchCountEl.textContent = '0'
    }
  } catch (err) {
    console.warn('Failed to get extension status:', err)
  }
})

