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
    // 1. YouTube Specific (most accurate for SPAs)
    if (window.location.hostname.includes('youtube.com')) {
      const ytTitle = document.querySelector('#container > h1 > yt-formatted-string');
      if (ytTitle && ytTitle.textContent.trim()) return ytTitle.textContent.trim();
    }
    
    // 2. Netflix Specific
    if (window.location.hostname.includes('netflix.com')) {
      const nfTitle = document.querySelector('.video-title h4') || document.querySelector('.video-title span');
      if (nfTitle && nfTitle.textContent.trim()) return nfTitle.textContent.trim();
    }

    // 3. Generic Meta Tags
    const og    = getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
    if (og) return og;
    
    // 4. Document Title Sanitization
    if (document.title && document.title.trim()) {
      return document.title.trim()
        .replace(/\s*[\|\-–—]\s*(Netflix|YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i, '')
        .trim() || document.title.trim();
    }
    return window.location.hostname.replace(/^www\./, '');
  }

  function getThumbnail() {
    // 1. YouTube Reliable Link
    if (window.location.hostname.includes('youtube.com')) {
      const vidId = new URLSearchParams(window.location.search).get('v');
      if (vidId) return `https://img.youtube.com/vi/${vidId}/maxresdefault.jpg`;
    }

    // 2. Netflix Poster (if possible)
    if (window.location.hostname.includes('netflix.com')) {
      const nfArt = document.querySelector('.evidence-item img') || document.querySelector('.boxart-image');
      if (nfArt && nfArt.src) return nfArt.src;
    }

    // 3. Meta Tags
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
      savedAt:       Date.now(),
      pinned:        false,
      note:          '',
    };

    chrome.storage.local.get({ history: [] }, (data) => {
      let history = data.history || [];
      // Preserve pinned state and note from existing entry for same URL
      const existing = history.find(e => e.url === entry.url);
      if (existing) {
        entry.pinned = existing.pinned || false;
        entry.note   = existing.note   || '';
      }
      history = history.filter(e => e.url !== entry.url);
      history.unshift(entry);
      if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);
      chrome.storage.local.set({ history, lastEntry: entry });
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

    // Universal Auto-Resume logic (FIRST TIME ONLY)
    let hasAutoSeeked = false;
    const autoResume = () => {
      if (hasAutoSeeked) return;
      chrome.storage.local.get({ history: [] }, (data) => {
        const history = data.history || [];
        const entry = history.find(e => e.url === window.location.href);
        if (entry && entry.timestamp > 5) {
          console.log('[Rewind] Auto-resuming to:', entry.timestamp);
          video.currentTime = entry.timestamp;
          hasAutoSeeked = true;
        }
      });
    };

    video.addEventListener('loadedmetadata', autoResume);
    video.addEventListener('play', autoResume, { once: true });
    // Fallback if metadata already loaded
    if (video.readyState >= 1) autoResume();

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
      chrome.storage.local.get({ history: [] }, (data) => {
        const history = (data.history || []).filter(e => e.url !== window.location.href);
        const lastEntry = history[0] || null;
        chrome.storage.local.set({ history, lastEntry });
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

  // ─── Secure Neural Mirror (Relay & Active Probe) ──────────────────────────
  // This section handles the secure relay and active probing of auth sessions
  if (window.location.hostname.includes('rewind-player.vercel.app')) {
    
    // 1. ACTIVE PROBE: Check for existing session on page load
    const checkPulse = () => {
      const pulse = document.getElementById('neural-sync-pulse');
      if (pulse && pulse.dataset.token) {
        console.log('[Rewind] Neural pulse detected. Mirroring session...');
        chrome.runtime.sendMessage({ 
          type: 'AUTH_TOKEN_UPDATE', 
          token: pulse.dataset.token 
        });
        return true;
      }
      return false;
    };

    // Initial check and periodic scans (for SPA transitions)
    if (!checkPulse()) {
      const pulseInterval = setInterval(() => {
        if (checkPulse()) clearInterval(pulseInterval);
      }, 2000);
      setTimeout(() => clearInterval(pulseInterval), 10000);
    }

    // 2. PASSIVE RELAY: Listen for real-time auth events
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://rewind-player.vercel.app') return;

      if (event.data?.type === 'REWIND_AUTH_SUCCESS' && event.data?.token) {
        console.log('[Rewind] Neural handshake detected. Synchronizing...');
        chrome.runtime.sendMessage({ 
          type: 'AUTH_TOKEN_UPDATE', 
          token: event.data.token 
        });
      }
    });

    // 3. HANDSHAKE: Notify portal that extension is injected and ready
    // This allows the portal to wait for us before releasing the token.
    window.postMessage({ type: 'REWIND_EXTENSION_READY' }, '*');
  }
})();
