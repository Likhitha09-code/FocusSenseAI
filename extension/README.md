# FocusSense AI — Browser Activity Monitor Extension (Manifest V3)

A privacy-conscious Chrome and Edge browser extension that provides active browser tab and domain monitoring during focused study sessions in FocusSense AI.

---

## 🔒 Privacy Guarantees

1. **Explicit Session Activation:** Only monitors tab changes while a student has explicitly started a study session in FocusSense AI. When the session concludes or pauses, monitoring stops immediately.
2. **Minimal Data Surface:**
   - **Captured:** Active website domain (e.g., `github.com`, `youtube.com`, `stackoverflow.com`), active interval duration, and tab-switch counts.
   - **NEVER Collected:** Page text/content, keystrokes, form entries, credentials, passwords, query parameters, search terms, or unrelated browsing history.
3. **Transparent Categorization:** Domains are classified as `study`, `distraction`, or `unknown` using configurable rules in `rules.json`. Unclassified domains are treated as unknown rather than forced into distraction.

---

## 📦 Required Permissions & Justifications

- **`tabs`**: Required by Chrome Extensions API to query the active tab's hostname (`tab.url`) when tab switches occur.
- **`storage`**: Used to persist session state (`sessionId`, active domain, switch counts) across ephemeral service worker lifecycles (`chrome.storage.local`).
- **Host Permissions (`http://localhost:5173/*`, `http://127.0.0.1:5173/*`, `http://127.0.0.1:8000/*`)**: Permits the content script to bridge events to the local FocusSense AI web application and backend API.

---

## 🚀 Installation Instructions (Chrome / Edge / Brave)

1. Open your browser and navigate to the Extensions management page:
   - **Chrome:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
   - **Brave:** `brave://extensions/`
2. In the top-right corner, turn **ON** the **Developer mode** toggle.
3. Click the **Load unpacked** button.
4. Select the extension directory:
   ```text
   C:\Users\likhi\FocusSenseAI\extension
   ```
5. Confirm that **FocusSense AI — Study Activity Monitor** appears in your installed extensions list.
6. (Optional) Click the puzzle icon in your browser toolbar and pin **FocusSense AI Monitor** for quick access.
7. **Important Note on Reloading:** If you reload the extension in `brave://extensions` while FocusSense is open, refresh the FocusSense browser tab (`F5`) so the tab attaches to the fresh extension execution context. FocusSense automatically detects reloads and falls back to web-level focus tracking if the extension context is reloaded.

---

## 🧪 Verification Walkthrough

1. Open `http://localhost:5173` in your browser and log into FocusSense AI.
2. Navigate to **Study Sessions** (`/app/student/sessions`).
3. Note the indicator badge on the study tracker:
   - When the extension is loaded, it shows:
     `🟢 Browser Extension Connected: Live Tab & Domain Monitoring Active`
4. Start a study session (e.g. on "Operating Systems").
5. Open a new tab and visit a study site (e.g. `https://github.com` or `https://docs.python.org`). Stay for 10 seconds.
6. Open a new tab and visit a distraction site (e.g. `https://youtube.com` or `https://reddit.com`). Stay for 10 seconds.
7. Return to the FocusSense tab:
   - In the live telemetry card, observe that the tab switches, productive study domain, and distraction interruptions have been logged.
8. Click **End Session**:
   - The session telemetry will now show realistic breakdown (e.g., 60% productive, 40% distraction, 2 switches) rather than duration-only 100% productive.
   - The Behaviour Analysis page will accurately reflect the observed interruptions.

