// content.js – Video Playback Tracker v2.2
// Universal video tracking engine with SPA navigation support,
// deferred ad tracking, multi-video disambiguation, and active tab seeking.

(function () {
  'use strict';

  const MAX_ENTRIES = 50;
  const MIN_TRACKABLE_DURATION = 5; // Minimum 5s duration

  console.log('%c[Rewind v2.2] 🚀 Content Script Active on ' + window.location.href, 'background: #00ff66; color: #000; font-weight: bold; padding: 2px 8px; border-radius: 4px;');

  // ─── Settings & Global State ──────────────────────────────────────────────
  let localHistoryCache = [];
  let userSettings = {
    autoSeek: false,
    trackShorts: true,
    showInPagePrompt: true
  };

  // Synchronous canonical snapshot of current tab
  let currentCanonicalUrl = window.location.href;

  // Initialize history cache and settings
  try {
    chrome.storage.local.get({ history: [], autoSeek: false, trackShorts: true, showInPagePrompt: true }, (data) => {
      localHistoryCache = data.history || [];
      userSettings.autoSeek = !!data.autoSeek;
      userSettings.trackShorts = data.trackShorts !== false;
      userSettings.showInPagePrompt = data.showInPagePrompt !== false;
      console.log('[Rewind v2.2] 📦 Storage loaded. Stored videos count:', localHistoryCache.length);
      checkExplicitUrlResume();
    });
  } catch (err) {
    console.error('[Rewind v2.2] Storage initialization error:', err);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.history) localHistoryCache = changes.history.newValue || [];
      if (changes.autoSeek !== undefined) userSettings.autoSeek = !!changes.autoSeek.newValue;
      if (changes.trackShorts !== undefined) userSettings.trackShorts = !!changes.trackShorts.newValue;
      if (changes.showInPagePrompt !== undefined) userSettings.showInPagePrompt = !!changes.showInPagePrompt.newValue;
    }
  });

  // ─── Ad & Preview Detection Heuristics ────────────────────────────────────

  function isAdActive(video) {
    try {
      const host = window.location.hostname;
      // 1. YouTube Ads (only when player has ad-showing or ad-interrupting class)
      if (host.includes('youtube.com')) {
        const player = video ? video.closest('.html5-video-player, #movie_player') : document.querySelector('.html5-video-player, #movie_player');
        if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
          return true;
        }
        return false;
      }

      // 2. Generic Video Ad Networks (check if video element itself is inside an active ad container)
      if (video && video.closest('.ad-showing, .vjs-ad-playing, .ima-ad-container, .jw-flag-ads')) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isFeedPreview(video) {
    try {
      const host = window.location.hostname;
      const path = window.location.pathname;

      if (host.includes('youtube.com')) {
        // Feed preview players and inline thumbnails
        if (video.closest('ytd-video-preview, ytd-inline-preview-player, ytd-thumbnail-overlay-inline-playback-renderer, #inline-preview-player, ytd-miniplayer')) {
          return true;
        }
        // If on home/feed page and not inside dedicated watch container
        if (['/', '/home', '/feed', '/explore', '/trending', '/subscriptions'].includes(path)) {
          if (!video.closest('ytd-watch-flexy, #movie_player')) {
            return true;
          }
        }
      }

      // Twitter / X previews in timeline
      if ((host.includes('twitter.com') || host.includes('x.com')) && !path.includes('/status/')) {
        if (video.paused) return true;
      }
    } catch (e) {}
    return false;
  }

  // ─── Universal Media Discovery & Candidate Scoring Engine ────────────────

  function findAllVideos(root = document) {
    const videos = [];
    try {
      if (!root) return videos;
      // 1. Direct video elements in this root
      if (root.querySelectorAll) {
        videos.push(...Array.from(root.querySelectorAll('video')));
      }

      // 2. Recursively inspect all child custom elements with open shadowRoot
      const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el.shadowRoot) {
          videos.push(...findAllVideos(el.shadowRoot));
        }
      }
    } catch (e) {}
    return videos;
  }

  function isPrimaryVideo(video) {
    if (!video) return false;

    // 1. Exclude Camera/Mic/WebRTC MediaStream previews (Case 17 & 18)
    if (video.srcObject) {
      return false;
    }

    // 2. Exclude decorative background loops (Case 31)
    if (video.hasAttribute('loop') && video.muted && video.autoplay && !video.controls) {
      if (!video.duration || video.duration < 20) {
        return false;
      }
    }

    // 3. Exclude microscopic tracking or audio pixels (<60px)
    const width = video.clientWidth || video.videoWidth || 0;
    const height = video.clientHeight || video.videoHeight || 0;
    if (width > 0 && width < 60 && height > 0 && height < 60) {
      return false;
    }

    return true;
  }

  function getBestVideoCandidate(videos = findAllVideos().filter(isPrimaryVideo)) {
    if (!videos || videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    // Score candidates based on browser playback signals (Case 28 Disambiguation)
    const scored = videos.map(video => {
      let score = 0;
      // Active playback is the strongest signal
      if (!video.paused && !video.ended) score += 100;
      // Unmuted audio
      if (!video.muted && video.volume > 0) score += 40;
      // Substantial duration
      if (video.duration && isFinite(video.duration) && video.duration > 30) score += 30;
      // Prominent screen footprint
      const width = video.clientWidth || video.videoWidth || 0;
      const height = video.clientHeight || video.videoHeight || 0;
      score += Math.min(50, Math.floor((width * height) / 10000));
      // Native or custom controls
      if (video.controls) score += 20;

      return { video, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].video;
  }

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
    // 0. Level 4 Media Session API (Highest fidelity for modern audio/video engines)
    try {
      if (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.title) {
        const msTitle = navigator.mediaSession.metadata.title.trim();
        if (msTitle && !msTitle.toLowerCase().includes('unknown')) return msTitle;
      }
    } catch (e) {}

    // 1. YouTube
    if (window.location.hostname.includes('youtube.com')) {
      const ytTitle = document.querySelector('#container > h1 > yt-formatted-string') ||
                      document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer') ||
                      document.querySelector('ytd-watch-metadata #title h1');
      if (ytTitle && ytTitle.textContent.trim()) return ytTitle.textContent.trim();
    }

    // 2. Twitch
    if (window.location.hostname.includes('twitch.tv')) {
      const twitchTitle = document.querySelector('[data-a-target="stream-title"]');
      if (twitchTitle && twitchTitle.textContent.trim()) return twitchTitle.textContent.trim();
      if (document.title && document.title.trim() !== "Twitch") {
        return document.title.trim().replace(/\s*[-–—]\s*Twitch$/i, '').trim();
      }
    }

    // 3. Generic Meta Tags
    const og = getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
    if (og && !og.toLowerCase().includes('twitch')) return og;

    // 4. Document Title Sanitization
    if (document.title && document.title.trim()) {
      return document.title.trim()
        .replace(/\s*[\|\-–—]\s*(YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i, '')
        .trim() || document.title.trim();
    }

    return window.location.hostname.replace(/^www\./, '');
  }

  function getThumbnail(canonicalUrl) {
    // 0. Level 4 Media Session Artwork (Highest quality poster)
    try {
      if (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artwork) {
        const artworks = navigator.mediaSession.metadata.artwork;
        if (Array.isArray(artworks) && artworks.length > 0) {
          const best = artworks[artworks.length - 1];
          if (best && best.src) return best.src;
        }
      }
    } catch (e) {}

    // 1. YouTube Direct Poster
    const urlStr = canonicalUrl || window.location.href;
    if (urlStr.includes('youtube.com') || urlStr.includes('youtu.be')) {
      const vidId = getYoutubeId(urlStr);
      if (vidId) return `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`;
    }

    // 2. Meta Tags
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

  function getYoutubeId(urlStr) {
    if (!urlStr) return null;
    try {
      const u = new URL(urlStr, window.location.href);
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/watch')) return u.searchParams.get('v');
        if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
        if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
      }
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.substring(1).split('/')[0];
      }
    } catch (e) {}
    return null;
  }

  function getCleanCanonicalUrl(video) {
    try {
      const host = window.location.hostname;
      const path = window.location.pathname;

      // 1. YouTube
      if (host.includes('youtube.com')) {
        const ytId = getYoutubeId(window.location.href);
        if (ytId) {
          return `https://www.youtube.com/watch?v=${ytId}`;
        }
      }

      // 2. If inside an iframe on a streaming/piracy player site, use the top page URL if permitted
      if (window !== window.top) {
        if (document.referrer && document.referrer.startsWith('http')) {
          try {
            const refUrl = new URL(document.referrer);
            // If top page is not an ad server
            if (!refUrl.hostname.includes('doubleclick') && !refUrl.hostname.includes('googleads')) {
              return refUrl.href.split('#')[0];
            }
          } catch (e) {}
        }
      }

      // 3. Twitter / X
      if (host.includes('twitter.com') || host.includes('x.com')) {
        if (path.includes('/status/')) return window.location.href.split('?')[0];
        const article = video && video.closest('article');
        if (article) {
          const anchor = Array.from(article.querySelectorAll('a')).find(a => a.href.includes('/status/'));
          if (anchor) return anchor.href.split('?')[0];
        }
      }

      // 4. Default: Current URL minus transient params, tracking tags, and ephemeral session tokens
      const u = new URL(window.location.href);
      u.hash = '';
      const ephemeralParams = [
        'rewind-resume', 'token', 'expires', 'auth', 'signature', 'sig',
        'session_id', 'sessionId', 'sid', 'utm_source', 'utm_medium',
        'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'
      ];
      ephemeralParams.forEach(param => {
        u.searchParams.delete(param);
      });
      if (!host.includes('youtube.com')) {
        u.searchParams.delete('t');
      }
      return u.href;
    } catch (e) {
      return window.location.href;
    }
  }

  function checkUrlsMatch(url1, url2) {
    if (!url1 || !url2) return false;
    if (url1 === url2) return true;
    try {
      const yt1 = getYoutubeId(url1);
      const yt2 = getYoutubeId(url2);
      if (yt1 && yt2) return yt1 === yt2;

      const u1 = new URL(url1);
      const u2 = new URL(url2);

      const normHost = h => h.replace('twitter.com', 'x.com').replace(/^www\./, '');
      if (normHost(u1.hostname) !== normHost(u2.hostname)) return false;

      return u1.pathname === u2.pathname && u1.pathname.length > 1;
    } catch (e) {
      return false;
    }
  }

  // ─── Storage Operations ───────────────────────────────────────────────────

  function saveCurrentPlayback(video, isCompleted = false) {
    if (!video) {
      console.warn('[Rewind v2.2] ⚠️ Save aborted: No video element provided');
      return;
    }
    if (!isPrimaryVideo(video)) {
      console.warn('[Rewind v2.2] ⚠️ Save aborted: Video element is not primary (dimensions < 60px)');
      return;
    }
    if (isFeedPreview(video)) {
      console.warn('[Rewind v2.2] ⚠️ Save aborted: Video identified as feed/hover preview');
      return;
    }
    if (isAdActive(video)) {
      console.warn('[Rewind v2.2] ⚠️ Save aborted: Commercial/Ad is active');
      return;
    }

    const timestamp = Math.floor(video.currentTime || 0);
    let duration = video.duration && isFinite(video.duration) ? Math.floor(video.duration) : null;

    if (!userSettings.trackShorts && duration && duration < MIN_TRACKABLE_DURATION) {
      console.warn(`[Rewind v2.2] ⚠️ Save aborted: duration ${duration}s < ${MIN_TRACKABLE_DURATION}s and trackShorts is disabled`);
      return;
    }

    if (timestamp < 1 && !isCompleted) {
      console.warn(`[Rewind v2.2] ⚠️ Save aborted: playhead at start (${timestamp}s < 1s)`);
      return;
    }

    if (duration > 86400) duration = null; // Cap live broadcasts > 24h
    const isLive = duration === null;
    const progress = isCompleted ? 100 : (duration ? Math.min(100, Math.round((timestamp / duration) * 100)) : null);

    const canonicalUrl = getCleanCanonicalUrl(video);
    currentCanonicalUrl = canonicalUrl;

    const entry = {
      id: Date.now(),
      title: getTitle(),
      url: canonicalUrl,
      timestamp: isCompleted && duration ? duration : timestamp,
      formattedTime: formatTime(timestamp),
      duration,
      progress,
      isLive,
      completed: !!isCompleted,
      thumbnail: getThumbnail(canonicalUrl),
      favicon: `https://www.google.com/s2/favicons?sz=32&domain=${new URL(canonicalUrl).hostname}`,
      savedAt: Date.now(),
      pinned: false,
      note: ''
    };

    console.log('[Rewind v2.2] 💾 Saving playback:', entry.title, `${entry.timestamp}s`, entry.url);

    try {
      chrome.storage.local.get({ history: [] }, (data) => {
        let history = data.history || [];
        const existing = history.find(e => checkUrlsMatch(e.url, canonicalUrl));
        if (existing) {
          entry.pinned = existing.pinned || false;
          entry.note = existing.note || '';
        }

        history = history.filter(e => !checkUrlsMatch(e.url, canonicalUrl));
        history.unshift(entry);
        if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);

        localHistoryCache = history;
        chrome.storage.local.set({ history, lastEntry: entry }, () => {
          console.log('[Rewind v2.2] ✅ Saved to storage! Count:', history.length);
        });

        // Notify background to update active badge
        try {
          chrome.runtime.sendMessage({ type: 'FORCE_SYNC', entry }).catch(() => {});
        } catch (e) {}
      });
    } catch (e) {
      console.error('[Rewind v2.2] Storage error:', e);
    }
  }

  // ─── In-Page Seeking & Verification Engine ────────────────────────────────

  function performSeek(video, targetSeconds, autoPlay = true) {
    if (!video) return;

    console.log(`[Rewind] Performing seek to ${targetSeconds}s (autoPlay: ${autoPlay})`);

    // If an ad is currently playing, wait for it to finish
    if (isAdActive(video)) {
      console.log('[Rewind] Ad is active — deferring seek until ad ends...');
      const adObserver = setInterval(() => {
        if (!isAdActive(video)) {
          clearInterval(adObserver);
          performSeek(video, targetSeconds, autoPlay);
        }
      }, 500);
      setTimeout(() => clearInterval(adObserver), 45000); // 45s safety timeout
      return;
    }

    const applyTime = () => {
      video.currentTime = targetSeconds;
      if (autoPlay && video.paused) {
        video.play().catch(() => {});
      }
    };

    if (video.readyState >= 1) {
      applyTime();
    } else {
      video.addEventListener('loadedmetadata', applyTime, { once: true });
    }

    // Verify on native seeked event
    const onSeeked = () => {
      if (Math.abs(video.currentTime - targetSeconds) <= 2) {
        console.log('[Rewind] ✅ Seek successfully verified at', video.currentTime);
        video.removeEventListener('seeked', onSeeked);
      }
    };
    video.addEventListener('seeked', onSeeked);
    setTimeout(() => video.removeEventListener('seeked', onSeeked), 8000);
  }

  function checkExplicitUrlResume() {
    try {
      // Check hash #rewind-resume=120
      const hash = window.location.hash;
      if (hash && hash.includes('rewind-resume=')) {
        const match = hash.match(/rewind-resume=([0-9]+)/);
        if (match && match[1]) {
          const targetSeconds = parseInt(match[1], 10);
          if (!isNaN(targetSeconds) && targetSeconds > 0) {
            waitForPrimaryVideo((video) => {
              performSeek(video, targetSeconds, true);
              // Clean up hash
              history.replaceState(null, '', window.location.pathname + window.location.search);
            });
          }
        }
      }
    } catch (e) {}
  }

  function waitForPrimaryVideo(callback, maxAttempts = 20) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const best = getBestVideoCandidate();
      if (best) {
        clearInterval(interval);
        callback(best);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 400);
  }

  // ─── In-Page Floating Resume Prompt (Google Flow Card) ────────────────────
  let activePromptHost = null;

  function removeInPagePrompt() {
    if (activePromptHost && activePromptHost.parentNode) {
      activePromptHost.parentNode.removeChild(activePromptHost);
    }
    activePromptHost = null;
  }

  function showInPageResumePrompt(video, entry) {
    if (!video || !entry || entry.timestamp < 2) return;
    if (userSettings.showInPagePrompt === false) return;
    if (video.currentTime >= entry.timestamp - 2) return;

    removeInPagePrompt();

    const host = document.createElement('div');
    host.id = 'rewind-in-page-prompt';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.right = '24px';
    host.style.zIndex = '2147483647';
    host.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
    host.style.transform = 'translateY(30px)';
    host.style.opacity = '0';

    const shadow = host.attachShadow({ mode: 'open' });
    const thumbUrl = entry.thumbnail || getThumbnail(entry.url) || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
    const durationStr = entry.duration ? ` / ${formatTime(entry.duration)}` : '';
    const timeStr = `${formatTime(entry.timestamp)}${durationStr}`;
    const safeTitle = (entry.title || 'Current Video').replace(/"/g, '&quot;');

    shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .flow-container {
          background: #070c08;
          border: 2px solid #00ff66;
          border-radius: 12px;
          box-shadow: 0 12px 36px rgba(0, 255, 102, 0.3), 0 4px 16px rgba(0, 0, 0, 0.9);
          padding: 12px 14px;
          width: 350px;
          color: #ffffff;
          position: relative;
          user-select: none;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .header-title-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00ff66;
          box-shadow: 0 0 8px #00ff66;
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .header-label {
          font-size: 13px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
        }
        .close-btn {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
          background: transparent;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 11px;
          font-weight: bold;
          line-height: 1;
          transition: all 0.15s;
        }
        .close-btn:hover {
          background: #e51152;
          border-color: #e51152;
        }
        .body-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .thumb-box {
          width: 120px;
          aspect-ratio: 16 / 9;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
          background: #111111;
          border: 1px solid #16241a;
        }
        .thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .badge-169 {
          position: absolute;
          top: 4px;
          left: 4px;
          background: rgba(0,0,0,0.85);
          color: #ffffff;
          font-size: 8px;
          font-weight: 800;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .info-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .video-title {
          font-size: 11px;
          font-weight: 700;
          color: #e0e0e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .saved-label {
          font-size: 9px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.05em;
        }
        .saved-time {
          font-size: 16px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .btn-resume {
          background: #00ff66;
          color: #000000;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          transition: transform 0.1s, background 0.15s;
        }
        .btn-resume:hover {
          background: #33ff88;
          transform: translateY(-1px);
        }
        .btn-startover {
          background: #101014;
          color: #ffffff;
          border: 1.5px solid #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          text-transform: uppercase;
          transition: all 0.15s;
        }
        .btn-startover:hover {
          background: #202028;
          border-color: #e51152;
          color: #e51152;
        }
        .timer-track {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: rgba(255,255,255,0.1);
          width: 100%;
          border-radius: 0 0 12px 12px;
          overflow: hidden;
        }
        .timer-fill {
          height: 100%;
          background: #00ff66;
          width: 100%;
          transform-origin: left;
          transition: transform 8s linear;
        }
      </style>
      <div class="flow-container" id="promptContainer">
        <div class="header-row">
          <div class="header-title-box">
            <span class="pulse-dot"></span>
            <span class="header-label">Active Tab Card</span>
          </div>
          <button class="close-btn" id="closeBtn" title="Dismiss">✕</button>
        </div>
        <div class="body-row">
          <div class="thumb-box">
            <img class="thumb-img" src="${thumbUrl}" alt="" />
            <span class="badge-169">16:9</span>
          </div>
          <div class="info-col">
            <div class="video-title" title="${safeTitle}">${safeTitle}</div>
            <div class="saved-label">SAVED:</div>
            <div class="saved-time">${timeStr}</div>
            <button class="btn-resume" id="resumeBtn">RESUME AT ${formatTime(entry.timestamp)}</button>
            <button class="btn-startover" id="startOverBtn">START OVER</button>
          </div>
        </div>
        <div class="timer-track">
          <div class="timer-fill" id="timerFill"></div>
        </div>
      </div>
    `;

    const mountPoint = document.fullscreenElement || document.body || document.documentElement;
    mountPoint.appendChild(host);
    activePromptHost = host;

    requestAnimationFrame(() => {
      host.style.transform = 'translateY(0)';
      host.style.opacity = '1';
    });

    const timerFill = shadow.getElementById('timerFill');
    requestAnimationFrame(() => {
      if (timerFill) {
        timerFill.style.transform = 'scaleX(0)';
      }
    });

    let dismissTimeout = setTimeout(() => {
      dismissPrompt();
    }, 8000);

    const container = shadow.getElementById('promptContainer');
    container.addEventListener('mouseenter', () => {
      clearTimeout(dismissTimeout);
      if (timerFill) timerFill.style.transition = 'none';
    });
    container.addEventListener('mouseleave', () => {
      dismissTimeout = setTimeout(() => dismissPrompt(), 4000);
      if (timerFill) {
        timerFill.style.transition = 'transform 4s linear';
        timerFill.style.transform = 'scaleX(0)';
      }
    });

    function dismissPrompt() {
      host.style.transform = 'translateY(30px)';
      host.style.opacity = '0';
      setTimeout(() => removeInPagePrompt(), 350);
    }

    shadow.getElementById('resumeBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const resumeBtn = shadow.getElementById('resumeBtn');
      resumeBtn.textContent = 'RESUMING... ✅';
      performSeek(video, entry.timestamp, true);
      setTimeout(() => dismissPrompt(), 600);
    });

    shadow.getElementById('startOverBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      performSeek(video, 0, true);
      entry.timestamp = 0;
      entry.progress = 0;
      entry.completed = false;
      chrome.storage.local.set({ history: localHistoryCache });
      dismissPrompt();
    });

    shadow.getElementById('closeBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      dismissPrompt();
    });
  }

  // ─── Direct Video Tracker Engine ──────────────────────────────────────────
  const trackedVideos = new WeakSet();

  function attachToVideo(video) {
    if (!video) return;
    if (trackedVideos.has(video)) return;

    if (!isPrimaryVideo(video)) {
      console.log('[Rewind v2.2] ⏭ Skipped video element: Dimensions < 60px');
      return;
    }
    if (isFeedPreview(video)) {
      console.log('[Rewind v2.2] ⏭ Skipped video element: Feed preview player');
      return;
    }

    trackedVideos.add(video);
    console.log('[Rewind v2.2] 🎥 Attached tracker to video element! Current time:', video.currentTime);

    let hasResumed = false;
    let throttleTimer = null;

    function tryPrompt() {
      if (video._rewindPrompted || video._rewindResumed) return;
      if (isAdActive(video) || isFeedPreview(video)) return;

      const canonical = getCleanCanonicalUrl(video);
      chrome.storage.local.get({ history: [], showInPagePrompt: true, autoSeek: false }, (data) => {
        if (video._rewindPrompted || video._rewindResumed) return;
        if (data.showInPagePrompt === false) return;

        const history = data.history || [];
        const match = history.find(e => checkUrlsMatch(e.url, canonical));
        if (!match || match.timestamp < 2) return;

        // Skip if video was fully watched or near end
        if (match.completed) return;
        if (match.duration && match.timestamp >= match.duration - 15) return;

        // If video is already near or past the saved timestamp, no need to prompt
        if (video.currentTime >= match.timestamp - 5) return;

        // Auto-seek if user explicitly turned on autoSeek
        if (data.autoSeek) {
          video._rewindResumed = true;
          performSeek(video, match.timestamp, true);
          return;
        }

        // Show Google Flow In-Page Prompt
        video._rewindPrompted = true;
        console.log('[Rewind v2.2] 🎯 Showing Google Flow Resume Card for:', match.title, 'at', match.timestamp);
        showInPageResumePrompt(video, match);
      });
    }

    video.addEventListener('play', () => {
      console.log('[Rewind v2.2] ▶ Video play event at', video.currentTime);
      if (isAdActive(video) || isFeedPreview(video)) return;
      tryPrompt();
    });

    video.addEventListener('pause', () => {
      console.log('[Rewind v2.2] ⏸ Video pause event fired at', video.currentTime);
      if (video.ended) return;
      saveCurrentPlayback(video);
    });

    video.addEventListener('ended', () => {
      console.log('[Rewind v2.2] ⏹ Video ended event');
      if (isAdActive(video)) return;
      saveCurrentPlayback(video, true);
    });

    video.addEventListener('timeupdate', () => {
      if (video.paused || video.ended || isAdActive(video)) return;
      // Periodic save every 15s during playback
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          if (!video.paused && !video.ended && video.currentTime > 1) {
            saveCurrentPlayback(video);
          }
        }, 15000);
      }
    });

    // Dynamic Source Change Detection (Cases 40, 41, 42)
    video.addEventListener('loadstart', () => {
      const currentSrc = video.currentSrc || video.src || '';
      if (video._lastKnownSrc && video._lastKnownSrc !== currentSrc) {
        console.log('[Rewind v2.2] 🔄 Video source dynamically replaced on existing element:', currentSrc);
        if (!video.paused && video.currentTime > 2) {
          saveCurrentPlayback(video);
        }
        video._rewindPrompted = false;
        video._rewindResumed = false;
      }
      video._lastKnownSrc = currentSrc;
      setTimeout(tryPrompt, 400);
    });

    video.addEventListener('emptied', () => {
      video._rewindPrompted = false;
      video._rewindResumed = false;
    });

    video.addEventListener('loadedmetadata', tryPrompt);
    video.addEventListener('canplay', tryPrompt);

    setTimeout(tryPrompt, 400);
    setTimeout(tryPrompt, 1200);
    setTimeout(tryPrompt, 2500);
  }

  function scanAndAttach() {
    const videos = findAllVideos();
    if (videos.length > 0) {
      console.log(`[Rewind v2.2] 🔍 Found ${videos.length} <video> element(s) (including Shadow DOM)`);
    }
    videos.forEach(attachToVideo);
  }

  // ─── SPA Navigation Lifecycle ─────────────────────────────────────────────

  function handleNavigationStart() {
    removeInPagePrompt();
    findAllVideos().forEach(v => {
      if (!v.paused && v.currentTime > 2) {
        saveCurrentPlayback(v);
      }
    });
  }

  function handleNavigationEnd() {
    currentCanonicalUrl = getCleanCanonicalUrl();
    removeInPagePrompt();
    findAllVideos().forEach(v => {
      v._rewindPrompted = false;
      v._rewindResumed = false;
    });
    scanAndAttach();
    setTimeout(scanAndAttach, 500);
    setTimeout(scanAndAttach, 1500);
  }

  // 1. YouTube SPA Events
  window.addEventListener('yt-navigate-start', handleNavigationStart);
  window.addEventListener('yt-navigate-finish', handleNavigationEnd);
  window.addEventListener('yt-page-data-updated', handleNavigationEnd);

  // 2. Universal Browser History & SPA Events
  window.addEventListener('popstate', handleNavigationEnd);
  window.addEventListener('hashchange', handleNavigationEnd);

  // Monkey-patch pushState and replaceState to detect SPA URL transitions
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    handleNavigationStart();
    const result = originalPushState.apply(this, args);
    setTimeout(handleNavigationEnd, 50);
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(() => { currentCanonicalUrl = getCleanCanonicalUrl(); }, 50);
    return result;
  };

  // 3. SPA Polling Heartbeat (Catches silent router navigation)
  let lastObservedHref = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastObservedHref) {
      lastObservedHref = window.location.href;
      handleNavigationEnd();
    }
  }, 1000);

  const observer = new MutationObserver(() => {
    scanAndAttach();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('beforeunload', () => {
    findAllVideos().forEach(v => {
      if (v.currentTime > 2) saveCurrentPlayback(v);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      findAllVideos().forEach(v => {
        if (v.currentTime > 2) saveCurrentPlayback(v);
      });
    }
  });

  // Initial Scan
  scanAndAttach();
  setTimeout(scanAndAttach, 1000);
  setTimeout(scanAndAttach, 3000);

  // ─── Internal Messaging (Popup Communication) ─────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // 1. Get active video details for the current tab
    if (msg.type === 'GET_ACTIVE_VIDEO_INFO') {
      const primary = getBestVideoCandidate();

      if (primary) {
        const canonical = getCleanCanonicalUrl(primary);
        sendResponse({
          hasVideo: true,
          title: getTitle(),
          url: canonical,
          currentTime: Math.floor(primary.currentTime || 0),
          duration: primary.duration && isFinite(primary.duration) ? Math.floor(primary.duration) : null,
          thumbnail: getThumbnail(canonical),
          isLive: !primary.duration || !isFinite(primary.duration) || primary.duration > 86400,
          isAd: isAdActive(primary)
        });
      } else {
        sendResponse({ hasVideo: false, url: window.location.href });
      }
      return true;
    }

    // 2. Seek active video directly from popup
    if (msg.type === 'SEEK_CURRENT_VIDEO' && typeof msg.timestamp === 'number') {
      const primary = getBestVideoCandidate();
      if (primary) {
        performSeek(primary, msg.timestamp, true);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'NO_VIDEO_FOUND' });
      }
      return true;
    }

    // 3. Reset/Start Over active video
    if (msg.type === 'RESET_CURRENT_VIDEO') {
      const primary = getBestVideoCandidate();
      if (primary) {
        performSeek(primary, 0, true);
        sendResponse({ success: true });
      }
      return true;
    }
  });

  // ─── Neural Mirror & Bridge for Web Dashboard ─────────────────────────────
  if (window.location.hostname.includes('rewind-player.vercel.app')) {
    const checkPulse = () => {
      const pulse = document.getElementById('neural-sync-pulse');
      if (pulse && pulse.dataset.token) {
        chrome.runtime.sendMessage({
          type: 'AUTH_TOKEN_UPDATE',
          token: pulse.dataset.token
        }).catch(() => {});
        return true;
      }
      return false;
    };

    if (!checkPulse()) {
      const pulseInterval = setInterval(() => {
        if (checkPulse()) clearInterval(pulseInterval);
      }, 2000);
      setTimeout(() => clearInterval(pulseInterval), 10000);
    }

    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://rewind-player.vercel.app') return;
      if (event.data?.type === 'REWIND_AUTH_SUCCESS' && event.data?.token) {
        chrome.runtime.sendMessage({
          type: 'AUTH_TOKEN_UPDATE',
          token: event.data.token
        }).catch(() => {});
      }
    });

    window.postMessage({ type: 'REWIND_EXTENSION_READY' }, '*');
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'REWIND_PROXY_BROADCAST' && msg.entry) {
      if (window.location.hostname.includes('rewind-player.vercel.app')) {
        window.postMessage({ type: 'REWIND_PROXY_SYNC', entry: msg.entry }, '*');
      }
    }
  });

})();
