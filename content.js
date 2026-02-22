// content.js – Video Playback Tracker
// Runs on every page. Detects <video> elements and saves timestamp + title on pause/unload.

(function () {
  'use strict';

  const MAX_ENTRIES = 20;
  const SAVE_DEBOUNCE_MS = 2000;

  let saveTimer = null;

  // ─── Title Extraction ────────────────────────────────────────────────────────

  function getTitle() {
    // 1. Try Open Graph title
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content && og.content.trim()) return og.content.trim();

    // 2. Try Twitter title
    const tw = document.querySelector('meta[name="twitter:title"]');
    if (tw && tw.content && tw.content.trim()) return tw.content.trim();

    // 3. Try document.title (clean it up a bit)
    if (document.title && document.title.trim()) {
      let title = document.title.trim();
      // Remove common suffixes like "| Netflix", "- YouTube", "| Amazon Prime Video"
      title = title.replace(/\s*[\|\-–—]\s*(Netflix|YouTube|Amazon|Prime Video|Hotstar|Disney|Hulu|HBO|Crunchyroll|Twitch).*$/i, '');
      return title.trim() || document.title.trim();
    }

    // 4. Fallback to hostname
    return window.location.hostname.replace(/^www\./, '');
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ─── Storage ─────────────────────────────────────────────────────────────────

  function saveEntry(video) {
    const timestamp = video.currentTime;
    if (!timestamp || timestamp < 5) return; // Don't save if barely started

    const entry = {
      id: Date.now(),
      title: getTitle(),
      url: window.location.href,
      timestamp: timestamp,
      formattedTime: formatTime(timestamp),
      duration: video.duration || null,
      favicon: `https://www.google.com/s2/favicons?sz=32&domain=${window.location.hostname}`,
      savedAt: new Date().toISOString(),
    };

    chrome.storage.local.get({ entries: [] }, (data) => {
      let entries = data.entries || [];

      // Remove existing entry for same URL (update it)
      entries = entries.filter(e => e.url !== entry.url);

      // Add new entry at the front
      entries.unshift(entry);

      // Trim to max
      if (entries.length > MAX_ENTRIES) {
        entries = entries.slice(0, MAX_ENTRIES);
      }

      chrome.storage.local.set({ entries, lastEntry: entry });
    });
  }

  function debouncedSave(video) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveEntry(video), SAVE_DEBOUNCE_MS);
  }

  // ─── Video Tracking ───────────────────────────────────────────────────────────

  const attachedVideos = new WeakSet();

  function attachToVideo(video) {
    if (attachedVideos.has(video)) return;
    attachedVideos.add(video);

    // Save on pause
    video.addEventListener('pause', () => {
      if (!video.ended) saveEntry(video);
    });

    // Save periodically while playing (every 30s)
    video.addEventListener('timeupdate', () => {
      debouncedSave(video);
    });

    // Save on video end
    video.addEventListener('ended', () => {
      // Mark as completed
      chrome.storage.local.get({ entries: [] }, (data) => {
        const entries = (data.entries || []).filter(e => e.url !== window.location.href);
        chrome.storage.local.set({ entries });
      });
    });
  }

  function scanForVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(attachToVideo);
  }

  // ─── MutationObserver – Watch for dynamically added videos ───────────────────

  const observer = new MutationObserver(() => {
    scanForVideos();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // ─── Save before page unloads ─────────────────────────────────────────────────

  window.addEventListener('beforeunload', () => {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (!video.paused && !video.ended && video.currentTime > 5) {
        saveEntry(video);
      }
    });
  });

  // Initial scan
  scanForVideos();

  // Also scan after a short delay (for SPAs that load content after DOM ready)
  setTimeout(scanForVideos, 2000);
  setTimeout(scanForVideos, 5000);
})();
