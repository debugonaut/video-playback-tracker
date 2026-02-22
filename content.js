// content.js – Video Playback Tracker v2
// Runs on every page + all iframes. Detects <video> elements and saves
// timestamp, title, thumbnail and progress on pause/unload.

(function () {
  'use strict';

  const MAX_ENTRIES = 20;

  // ─── Extractors ───────────────────────────────────────────────────────────

  function getMeta(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const val = el && (el.getAttribute('content') || el.content);
      if (val && val.trim()) return val.trim();
    }
    return null;
  }

  function getTitle() {
    const og    = getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
    if (og) return og;
    if (document.title && document.title.trim()) {
      return document.title.trim()
        .replace(/\s*[\|\-–—]\s*(Netflix|YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i, '')
        .trim() || document.title.trim();
    }
    return window.location.hostname.replace(/^www\./, '');
  }

  function getThumbnail() {
    const raw = getMeta([
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ]);
    if (!raw) return null;
    try { return new URL(raw, window.location.href).href; }
    catch { return null; }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  // ─── Storage ──────────────────────────────────────────────────────────────

  function saveEntry(video) {
    const timestamp = video.currentTime;
    if (!timestamp || timestamp < 5) return;

    const duration = video.duration && isFinite(video.duration) ? video.duration : null;
    const progress = duration ? Math.min(100, Math.round((timestamp / duration) * 100)) : null;

    const entry = {
      id: Date.now(),
      title:         getTitle(),
      url:           window.location.href,
      timestamp,
      formattedTime: formatTime(timestamp),
      duration,
      progress,
      thumbnail:     getThumbnail(),
      favicon:       `https://www.google.com/s2/favicons?sz=32&domain=${window.location.hostname}`,
      savedAt:       new Date().toISOString(),
      pinned:        false,
      note:          '',
    };

    chrome.storage.local.get({ entries: [] }, (data) => {
      let entries = data.entries || [];
      // Preserve pinned state and note from existing entry for same URL
      const existing = entries.find(e => e.url === entry.url);
      if (existing) {
        entry.pinned = existing.pinned || false;
        entry.note   = existing.note   || '';
      }
      entries = entries.filter(e => e.url !== entry.url);
      entries.unshift(entry);
      if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);
      chrome.storage.local.set({ entries, lastEntry: entry });
    });
  }

  // ─── Video Tracking ───────────────────────────────────────────────────────

  const attached = new WeakSet();

  function attach(video) {
    if (attached.has(video)) return;
    attached.add(video);

    video.addEventListener('pause', () => {
      if (!video.ended) saveEntry(video);
    });

    // Periodic save every 30s while playing (backup for tab-close without pause)
    let periodicTimer = null;
    video.addEventListener('play', () => {
      periodicTimer = setInterval(() => {
        if (!video.paused) saveEntry(video);
      }, 30000);
    });
    video.addEventListener('pause', () => clearInterval(periodicTimer));
    video.addEventListener('ended', () => {
      clearInterval(periodicTimer);
      // Remove entry when video finishes — user has seen it all
      chrome.storage.local.get({ entries: [] }, (data) => {
        const entries = (data.entries || []).filter(e => e.url !== window.location.href);
        const lastEntry = entries[0] || null;
        chrome.storage.local.set({ entries, lastEntry });
      });
    });
  }

  function scan() {
    document.querySelectorAll('video').forEach(attach);
  }

  // MutationObserver for SPAs / dynamically injected players
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true, subtree: true,
  });

  window.addEventListener('beforeunload', () => {
    document.querySelectorAll('video').forEach(video => {
      if (!video.paused && !video.ended && video.currentTime > 5) saveEntry(video);
    });
  });

  scan();
  setTimeout(scan, 2000);
  setTimeout(scan, 5000);
})();
