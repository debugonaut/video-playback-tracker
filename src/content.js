// content.js – Video Playback Tracker v2.2
// Universal video tracking engine with SPA navigation support,
// deferred ad tracking, multi-video disambiguation, and active tab seeking.

(function () {
  'use strict';

  const MAX_ENTRIES = 50;
  const MIN_TRACKABLE_DURATION = 60; // Ignore short clips < 60s by default

  // ─── Settings & Global State ──────────────────────────────────────────────
  let localHistoryCache = [];
  let userSettings = {
    autoSeek: false,
    trackShorts: false,
    showInPagePrompt: true
  };

  // Synchronous canonical snapshot of current tab
  let currentCanonicalUrl = window.location.href;
  let activeVideoSession = null;

  // Initialize history cache and settings
  chrome.storage.local.get({ history: [], autoSeek: false, trackShorts: false, showInPagePrompt: true }, (data) => {
    localHistoryCache = data.history || [];
    userSettings.autoSeek = !!data.autoSeek;
    userSettings.trackShorts = !!data.trackShorts;
    userSettings.showInPagePrompt = data.showInPagePrompt !== false;
    checkExplicitUrlResume();
  });

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
      // 1. YouTube Ads
      if (host.includes('youtube.com')) {
        if (document.querySelector('.ad-showing, .ad-interrupting, ytd-player.ad-showing, .ytp-ad-player-overlay')) {
          return true;
        }
        if (video && video.closest('.ad-showing, .ad-interrupting')) {
          return true;
        }
        const adModule = document.querySelector('.video-ads.ytp-ad-module');
        if (adModule && adModule.childElementCount > 0) {
          return true;
        }
      }

      // 2. Generic Video Ad Networks & Wrappers (IMA, VideoJS, custom overlays)
      if (document.querySelector('.ima-ad-container, .vjs-ad-playing, [id*="ad-container"]:not(:empty), .jw-flag-ads')) {
        return true;
      }
      if (video && video.closest('.ima-ad-container, .vjs-ad-playing, .jw-flag-ads')) {
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
        // Allow tracking only if video is actively playing and clicked
        if (video.paused) return true;
      }
    } catch (e) {}
    return false;
  }

  function isPrimaryVideo(video) {
    if (!video) return false;
    // Discard hidden or tiny ad/tracking pixels
    const width = video.clientWidth || video.videoWidth || 0;
    const height = video.clientHeight || video.videoHeight || 0;
    if (width > 0 && width < 220 && height > 0 && height < 140) {
      return false;
    }
    return true;
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

      // 4. Default: Current URL minus transient params / hashes
      const u = new URL(window.location.href);
      u.hash = '';
      u.searchParams.delete('rewind-resume');
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
    if (!video || !isPrimaryVideo(video)) return;
    if (isFeedPreview(video)) return;
    if (isAdActive(video)) return; // Never save ad playback

    const timestamp = Math.floor(video.currentTime || 0);
    let duration = video.duration && isFinite(video.duration) ? Math.floor(video.duration) : null;

    // Filter out short clips < 60s if setting disabled
    if (!userSettings.trackShorts && duration && duration < MIN_TRACKABLE_DURATION) {
      return;
    }

    // Require at least 5s of watch time unless completed
    if (timestamp < 5 && !isCompleted) return;

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

    try {
      let history = [...localHistoryCache];
      const existing = history.find(e => checkUrlsMatch(e.url, canonicalUrl));
      if (existing) {
        entry.pinned = existing.pinned || false;
        entry.note = existing.note || '';
      }

      history = history.filter(e => !checkUrlsMatch(e.url, canonicalUrl));
      history.unshift(entry);
      if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);

      localHistoryCache = history;
      chrome.storage.local.set({ history, lastEntry: entry });

      // Notify background to update active badge
      try {
        chrome.runtime.sendMessage({ type: 'FORCE_SYNC', entry }).catch(() => {});
      } catch (e) {}
    } catch (e) {}
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
      const videos = Array.from(document.querySelectorAll('video')).filter(isPrimaryVideo);
      if (videos.length > 0) {
        clearInterval(interval);
        callback(videos[0]);
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
    if (!video || !entry || entry.timestamp <= 5) return;
    if (userSettings.showInPagePrompt === false) return;
    if (video.currentTime >= entry.timestamp) return;

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

  // ─── Single Video Session Controller ──────────────────────────────────────

  function createVideoSession(video) {
    let periodicTimer = null;
    let hasResumedThisSession = false;
    let hasPromptedThisSession = false;

    function checkAndShowPrompt() {
      if (hasPromptedThisSession || hasResumedThisSession) return;
      if (userSettings.autoSeek) return;
      if (userSettings.showInPagePrompt === false) return;
      if (video.currentTime >= 5) return;
      if (isAdActive(video) || isFeedPreview(video)) return;

      const canonical = getCleanCanonicalUrl(video);
      const match = localHistoryCache.find(e => checkUrlsMatch(e.url, canonical));
      if (match && match.timestamp > 5) {
        hasPromptedThisSession = true;
        showInPageResumePrompt(video, match);
      }
    }

    const onPlay = () => {
      if (isAdActive(video)) return;
      if (isFeedPreview(video)) return;

      // Auto-seek check (only if enabled by user and not already resumed)
      if (userSettings.autoSeek && !hasResumedThisSession && video.currentTime < 5) {
        const canonical = getCleanCanonicalUrl(video);
        const match = localHistoryCache.find(e => checkUrlsMatch(e.url, canonical));
        if (match && match.timestamp > 5 && !match.completed) {
          hasResumedThisSession = true;
          performSeek(video, match.timestamp, true);
        }
      } else {
        checkAndShowPrompt();
      }

      if (!periodicTimer) {
        periodicTimer = setInterval(() => {
          if (!video.paused && !video.ended) {
            saveCurrentPlayback(video);
          }
        }, 30000);
      }
    };

    const onPause = () => {
      if (!video.ended) {
        saveCurrentPlayback(video);
      }
    };

    const onEnded = () => {
      if (periodicTimer) clearInterval(periodicTimer);

      // CRITICAL: If an ad ended, do NOT mark the real video completed!
      if (isAdActive(video)) {
        console.log('[Rewind] Ad finished — waiting for main content stream to start.');
        return;
      }

      // Mark the video as completed (100%) rather than deleting it
      saveCurrentPlayback(video, true);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadedmetadata', checkAndShowPrompt);
    video.addEventListener('canplay', checkAndShowPrompt);

    if (video.readyState >= 1) {
      setTimeout(checkAndShowPrompt, 500);
    }

    return {
      flush: () => {
        if (periodicTimer) clearInterval(periodicTimer);
        if (!video.paused && !video.ended && video.currentTime > 5) {
          saveCurrentPlayback(video);
        }
      },
      destroy: () => {
        removeInPagePrompt();
        if (periodicTimer) clearInterval(periodicTimer);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('loadedmetadata', checkAndShowPrompt);
        video.removeEventListener('canplay', checkAndShowPrompt);
      }
    };
  }

  // ─── SPA Navigation Lifecycle ─────────────────────────────────────────────

  function handleNavigationStart() {
    removeInPagePrompt();
    if (activeVideoSession) {
      activeVideoSession.flush();
    }
  }

  function handleNavigationEnd() {
    currentCanonicalUrl = getCleanCanonicalUrl();
    if (activeVideoSession) {
      activeVideoSession.destroy();
      activeVideoSession = null;
    }
    scanAndAttach();
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

  // ─── Scanner & Observer ───────────────────────────────────────────────────

  function scanAndAttach() {
    const allVideos = Array.from(document.querySelectorAll('video')).filter(isPrimaryVideo);
    if (allVideos.length === 0) return;

    // Prioritize unmuted and actively playing video, or largest on screen
    const primary = allVideos.find(v => !v.paused && !v.muted) ||
                    allVideos.find(v => !v.paused) ||
                    allVideos[0];

    if (primary && (!activeVideoSession || activeVideoSession.video !== primary)) {
      if (activeVideoSession) activeVideoSession.destroy();
      activeVideoSession = createVideoSession(primary);
      activeVideoSession.video = primary;
    }
  }

  const observer = new MutationObserver(() => {
    scanAndAttach();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('beforeunload', () => {
    if (activeVideoSession) activeVideoSession.flush();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && activeVideoSession) {
      activeVideoSession.flush();
    }
  });

  // Initial Scan
  scanAndAttach();
  setTimeout(scanAndAttach, 1500);
  setTimeout(scanAndAttach, 4000);

  // ─── Internal Messaging (Popup Communication) ─────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // 1. Get active video details for the current tab
    if (msg.type === 'GET_ACTIVE_VIDEO_INFO') {
      const allVideos = Array.from(document.querySelectorAll('video')).filter(isPrimaryVideo);
      const primary = allVideos.find(v => !v.paused) || allVideos[0];

      if (primary) {
        const canonical = getCleanCanonicalUrl(primary);
        sendResponse({
          hasVideo: true,
          title: getTitle(),
          url: canonical,
          currentTime: Math.floor(primary.currentTime || 0),
          duration: primary.duration && isFinite(primary.duration) ? Math.floor(primary.duration) : null,
          thumbnail: getThumbnail(canonical),
          isLive: !primary.duration || !isFinite(primary.duration),
          isAd: isAdActive(primary)
        });
      } else {
        sendResponse({ hasVideo: false, url: window.location.href });
      }
      return true;
    }

    // 2. Seek active video directly from popup
    if (msg.type === 'SEEK_CURRENT_VIDEO' && typeof msg.timestamp === 'number') {
      const allVideos = Array.from(document.querySelectorAll('video')).filter(isPrimaryVideo);
      const primary = allVideos.find(v => !v.paused) || allVideos[0];
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
      const allVideos = Array.from(document.querySelectorAll('video')).filter(isPrimaryVideo);
      const primary = allVideos.find(v => !v.paused) || allVideos[0];
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
