# 🎬 Video Playback Tracker

A cross-browser extension for **Chrome** and **Firefox** that automatically tracks your video playback timestamps on any streaming website — so you never lose your place again.

![Extension Icon](icons/icon128.png)

---

## 😤 The Problem

You're watching a movie on some streaming site that doesn't have a built-in "resume" feature. You close your laptop, come back later, and now you have to:
1. Find the movie again
2. Scrub through to find where you left off
3. Inevitably overshoot and re-watch parts you've already seen

**This extension solves that.**

---

## ✨ Features

- 🤖 **Auto-tracking** — Detects `<video>` elements on any page and saves your timestamp automatically when you pause or close the tab
- 🖼️ **Works everywhere** — Runs on both the main page and inside iframes (for sites that embed video players from a CDN)
- 🔔 **Startup reminder** — Shows a badge on the extension icon when you reopen the browser, reminding you to resume
- ✍️ **Manual entry** — Add entries yourself with a movie name, URL, and timestamp
- 🗂️ **Watch history** — View the last 20 tracked videos, each with title, timestamp, favicon, and relative time
- 🔗 **One-click resume** — Click any entry to open the page directly in a new tab
- 🗑️ **Delete entries** — Remove individual entries or clear all history

---

## 🌐 Compatibility

| Site Type | Works? | Notes |
|---|---|---|
| YouTube | ✅ | Full auto-tracking |
| Netflix | ✅ | Full auto-tracking |
| Any HTML5 video site | ✅ | Full auto-tracking |
| Sites with iframe video players (e.g. anikai.to) | ✅ | `all_frames: true` ensures the script runs inside iframes |
| Flash-based players | ❌ | Flash is dead — not supported |

---

## 🚀 Installation

### Chrome

1. Download or clone this repository
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer Mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `Video PlayBack Tracker` folder
6. The extension icon appears in your toolbar ✅

### Firefox

1. Download or clone this repository
2. Open Firefox → go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file from the folder ✅

> **Note:** Firefox temporary add-ons are removed when the browser closes. For permanent installation, the extension would need to be published to the Firefox Add-ons store.

---

## 🛠️ How It Works

```
┌─────────────────────────────────────────────────────────┐
│                     Any Web Page                        │
│                                                         │
│  content.js  →  detects <video>  →  listens for pause  │
│                                          │              │
│                                    chrome.storage       │
│                                          │              │
│  popup.js    ←  loads entries    ←───────┘              │
│                                                         │
│  background.js  →  sets badge on browser startup        │
└─────────────────────────────────────────────────────────┘
```

**content.js** (runs on every page + all iframes):
- Scans for `<video>` elements, including dynamically added ones via `MutationObserver`
- Extracts the video title from `og:title`, `twitter:title`, or `document.title`
- Saves `{ title, url, timestamp, formattedTime, favicon, savedAt }` to `chrome.storage.local` on pause or tab close

**background.js** (service worker):
- On browser startup, reads the last entry and lights up the extension badge with `▶`

**popup.html/js/css**:
- Shows the last watched entry as a **Resume banner**
- Lists full watch history (last 20 entries)
- Provides a **manual entry form** for adding entries yourself

---

## 📁 File Structure

```
Video PlayBack Tracker/
├── manifest.json       # Extension config (Manifest V3)
├── content.js          # Video detection & timestamp saving
├── background.js       # Startup badge reminder
├── popup.html          # Extension popup UI
├── popup.css           # Dark-mode glassmorphism styles
├── popup.js            # Popup logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔒 Permissions

| Permission | Why It's Needed |
|---|---|
| `storage` | Save and retrieve tracked video entries |
| `tabs` | Open saved URLs in a new tab from the popup |
| `host_permissions: <all_urls>` | Inject the content script on any streaming site |

---

## 🤝 Contributing

Pull requests are welcome! Some ideas for future improvements:

- [ ] Sync entries across devices using `chrome.storage.sync`
- [ ] Show a progress bar based on video duration
- [ ] Export/import history as JSON
- [ ] Detect episode/season info for TV shows
- [ ] Dark/light theme toggle

---

## 🛠️ Build from Source (for Reviewers)

To build the extension from this source code, follow these steps:

1.  **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) and `npm` installed.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Build**:
    ```bash
    npm run build
    ```
    This will use `esbuild` to bundle and minify the source files (`src/background.js`, `src/content.js`, `src/popup.js`) into the root directory.
4.  **Verification**: The generated files (`background.js`, `content.js`, `popup.js`) in the root will match the files in the distributed version.

---

## 📄 License

MIT License — free to use, modify, and distribute.
