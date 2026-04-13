// content.js – Video Playback Tracker v2
// Runs on every page + all iframes. Detects <video> elements and saves
// timestamp, title, thumbnail and progress on pause/unload.

(function () {
  'use strict';

  const MAX_ENTRIES = 20;

  // ─── Secure Global Context ────────────────────────────────────────────────
  let absoluteTopUrl = window.location.href;
  try {
      chrome.runtime.sendMessage({ type: 'GET_TAB_URL' }, (response) => {
          if (response && response.url) {
              absoluteTopUrl = response.url;
              console.log('[Rewind] Secured explicit top-level anchor:', absoluteTopUrl);
          }
      });
  } catch (e) {
      /* Connection may fail in generic non-extension sandbox frames */
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

    // 3. Twitch Specific
    if (window.location.hostname.includes('twitch.tv')) {
      // Twitch SPAs often have "Twitch" as the og:title. document.title is much more reliable.
      if (document.title && document.title.trim() !== "Twitch") {
         return document.title.trim().replace(/\s*[-–—]\s*Twitch$/i, '').trim();
      }
    }

    // 4. Generic Meta Tags
    const og    = getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
    if (og && og.toLowerCase() !== 'twitch') return og;
    
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

  function getVideoPermalink(video) {
    const defaultUrl = absoluteTopUrl || window.location.href;

    try {
      const host = window.location.hostname;
      const path = window.location.pathname;

      // Ensure we DO NOT override known dedicated player pages
      const dedicatedPlayers = ['netflix.com', 'hulu.com', 'primevideo.com', 'hbomax.com', 'disneyplus.com', 'crunchyroll.com'];
      if (dedicatedPlayers.some(d => host.includes(d))) return defaultUrl;

      // 1. Youtube
      if (host.includes('youtube.com')) {
        if (path.startsWith('/watch')) return defaultUrl;
        const container = video.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer');
        if (container) {
          const anchor = container.querySelector('a#thumbnail, a.yt-simple-endpoint');
          if (anchor && anchor.href && anchor.href.includes('/watch')) return anchor.href;
        }
      }

      // 2. Twitter / X
      if (host.includes('twitter.com') || host.includes('x.com')) {
        if (path.includes('/status/')) return defaultUrl;
        const article = video.closest('article');
        if (article) {
          const anchor = Array.from(article.querySelectorAll('a')).find(a => a.href.includes('/status/'));
          if (anchor) return anchor.href;
        }
      }

      // 3. Reddit
      if (host.includes('reddit.com')) {
        if (path.includes('/comments/')) return defaultUrl;
        const post = video.closest('shreddit-post, .Post, div[data-testid="post-container"]');
        if (post) {
          const permalink = post.getAttribute('permalink');
          if (permalink) return new URL(permalink, window.location.origin).href;
          const anchor = Array.from(post.querySelectorAll('a')).find(a => a.href.includes('/comments/'));
          if (anchor) return anchor.href;
        }
      }

      // 4. TikTok
      if (host.includes('tiktok.com')) {
        if (path.includes('/video/')) return defaultUrl;
        const container = video.closest('[data-e2e="recommend-list-item-container"], .video-feed-item');
        if (container) {
          const anchor = Array.from(container.querySelectorAll('a')).find(a => a.href.includes('/video/'));
          if (anchor) return anchor.href;
        }
      }

      // 5. Instagram
      if (host.includes('instagram.com')) {
        if (path.includes('/p/') || path.includes('/reel/')) return defaultUrl;
        const article = video.closest('article');
        if (article) {
          const anchor = Array.from(article.querySelectorAll('a')).find(a => a.href.includes('/p/') || a.href.includes('/reel/'));
          if (anchor) return anchor.href;
        }
      }

      // 6. LinkedIn
      if (host.includes('linkedin.com')) {
        if (path.includes('/posts/') || path.includes('/feed/update/')) return defaultUrl;
        const post = video.closest('.feed-shared-update-v2, [data-urn]');
        if (post) {
          const anchor = Array.from(post.querySelectorAll('a')).find(a => a.href.includes('/posts/') || a.href.includes('/urn:li:activity:'));
          if (anchor) return anchor.href;
        }
      }

      // 7. Universal Fallback for unknown architectures (Path Agnostic)
      const container = video.closest('article, [role="article"], .post, .feed-item, li, [class*="post"], [class*="item"]');
      if (container) {
          const signatures = ['/video/', '/post/', '/p/', '/status/', '/watch', '/reel/', '/v/', '/view/'];
          const anchor = Array.from(container.querySelectorAll('a')).find(a => 
              signatures.some(sig => a.href.includes(sig))
          );
          if (anchor) return anchor.href;
      }
      
      // Absolute direct wrapper fallback
      const parentAnchor = video.closest('a');
      if (parentAnchor && parentAnchor.href) return parentAnchor.href;

    } catch (e) {
      // Safely ignore traversal errors and fallback
    }

    return defaultUrl;
  }

  // ─── Storage ──────────────────────────────────────────────────────────────

  function saveEntry(video) {
    const timestamp = video.currentTime;
    if (!timestamp || timestamp < 5) return;

    let duration = video.duration && isFinite(video.duration) ? video.duration : null;
    
    // Safety cap: Twitch livestreams often bubble Infinity or Epoch timestamps as duration (e.g. 9 billion seconds).
    // If duration exceeds 24 hours (86400s), cap it to null so the UI treats it as an ongoing broadcast.
    if (duration > 86400) {
      duration = null;
    }

    const progress = duration ? Math.min(100, Math.round((timestamp / duration) * 100)) : null;

    // Extract contextual permalink (solves Infinite Feed Paradox)
    const topUrl = getVideoPermalink(video);

    const entry = {
      id: Date.now(),
      title:         getTitle(),
      url:           topUrl,
      timestamp,
      formattedTime: formatTime(timestamp),
      duration,
      progress,
      thumbnail:     getThumbnail(),
      favicon:       `https://www.google.com/s2/favicons?sz=32&domain=${new URL(topUrl).hostname}`,
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

      // ACTIVE PROBE: Signal background engine to sync immediately
      chrome.runtime.sendMessage({ type: 'FORCE_SYNC', entry });
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
        
        // Match by exact URL OR by secure absolute Top URL (for deep dynamic iframes)
        const currentUrl = window.location.href;
        const parentUrl = absoluteTopUrl !== window.location.href ? absoluteTopUrl : ((window !== window.top) ? document.referrer : null);
        
        const entry = history.find(e => {
          if (e.url === currentUrl) return true;
          if (parentUrl && e.url.includes(parentUrl.split('?')[0])) return true;
          if (e.url.includes(currentUrl.split('?')[0])) return true;
          
          // Omni-Match: Compare core URL components to defeat domain redirects (x.com vs twitter.com)
          try {
            const eUrl = new URL(e.url);
            const cUrl = new URL(currentUrl);
            const isMatch = eUrl.pathname === cUrl.pathname && eUrl.pathname.length > 5;
            
            // Special handler for YouTube (query params matter)
            if (eUrl.hostname.includes('youtube.com')) {
              return eUrl.searchParams.get('v') === cUrl.searchParams.get('v');
            }
            
            return isMatch;
          } catch(err) {}

          return false;
        });

        if (entry && entry.timestamp > 5) {
          console.log('[Rewind] Auto-resuming to:', entry.timestamp);
          
          // Forcefully override custom players that reset time on load
          video.currentTime = entry.timestamp;
          hasAutoSeeked = true;
          
          // Double tap to override aggressive custom players
          setTimeout(() => { 
            if (Math.abs(video.currentTime - entry.timestamp) > 5) {
              video.currentTime = entry.timestamp; 
            }
          }, 1500);
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
  // ─── Neural Bridge (Proxy Layer) ──────────────────────────────────────────
  // Listens for broadcast signals from the background script and relays them
  // to the web portal if we are on the rewind-player.vercel.app domain.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'REWIND_PROXY_BROADCAST' && msg.entry) {
      if (window.location.hostname.includes('rewind-player.vercel.app')) {
        console.log('[Neural Bridge] Relaying sync pulse to portal...');
        window.postMessage({ type: 'REWIND_PROXY_SYNC', entry: msg.entry }, '*');
      }
    }
  });

})();
