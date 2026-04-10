(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/content.js
  var require_content = __commonJS({
    "src/content.js"() {
      (function() {
        "use strict";
        const MAX_ENTRIES = 20;
        function getMeta(selectors) {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            const val = el && (el.getAttribute("content") || el.content);
            if (val && val.trim()) return val.trim();
          }
          return null;
        }
        function getTitle() {
          if (window.location.hostname.includes("youtube.com")) {
            const ytTitle = document.querySelector("#container > h1 > yt-formatted-string");
            if (ytTitle && ytTitle.textContent.trim()) return ytTitle.textContent.trim();
          }
          if (window.location.hostname.includes("netflix.com")) {
            const nfTitle = document.querySelector(".video-title h4") || document.querySelector(".video-title span");
            if (nfTitle && nfTitle.textContent.trim()) return nfTitle.textContent.trim();
          }
          const og = getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
          if (og) return og;
          if (document.title && document.title.trim()) {
            return document.title.trim().replace(/\s*[\|\-–—]\s*(Netflix|YouTube|Amazon|Prime Video|Hotstar|Disney\+?|Hulu|HBO|Crunchyroll|Twitch|Funimation|Aniwatch|Anikai).*$/i, "").trim() || document.title.trim();
          }
          return window.location.hostname.replace(/^www\./, "");
        }
        function getThumbnail() {
          if (window.location.hostname.includes("youtube.com")) {
            const vidId = new URLSearchParams(window.location.search).get("v");
            if (vidId) return `https://img.youtube.com/vi/${vidId}/maxresdefault.jpg`;
          }
          if (window.location.hostname.includes("netflix.com")) {
            const nfArt = document.querySelector(".evidence-item img") || document.querySelector(".boxart-image");
            if (nfArt && nfArt.src) return nfArt.src;
          }
          const raw = getMeta([
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'meta[name="twitter:image:src"]'
          ]);
          if (!raw) return null;
          try {
            return new URL(raw, window.location.href).href;
          } catch {
            return null;
          }
        }
        function formatTime(seconds) {
          if (isNaN(seconds) || seconds < 0) return "0:00";
          const h = Math.floor(seconds / 3600);
          const m = Math.floor(seconds % 3600 / 60);
          const s = Math.floor(seconds % 60);
          return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
        }
        function saveEntry(video) {
          const timestamp = video.currentTime;
          if (!timestamp || timestamp < 5) return;
          const duration = video.duration && isFinite(video.duration) ? video.duration : null;
          const progress = duration ? Math.min(100, Math.round(timestamp / duration * 100)) : null;
          const entry = {
            id: Date.now(),
            title: getTitle(),
            url: window.location.href,
            timestamp,
            formattedTime: formatTime(timestamp),
            duration,
            progress,
            thumbnail: getThumbnail(),
            favicon: `https://www.google.com/s2/favicons?sz=32&domain=${window.location.hostname}`,
            savedAt: (/* @__PURE__ */ new Date()).toISOString(),
            pinned: false,
            note: ""
          };
          chrome.storage.local.get({ history: [] }, (data) => {
            let history = data.history || [];
            const existing = history.find((e) => e.url === entry.url);
            if (existing) {
              entry.pinned = existing.pinned || false;
              entry.note = existing.note || "";
            }
            history = history.filter((e) => e.url !== entry.url);
            history.unshift(entry);
            if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);
            chrome.storage.local.set({ history, lastEntry: entry });
          });
        }
        const attached = /* @__PURE__ */ new WeakSet();
        function attach(video) {
          if (attached.has(video)) return;
          attached.add(video);
          video.addEventListener("pause", () => {
            if (!video.ended) saveEntry(video);
          });
          let hasAutoSeeked = false;
          const autoResume = () => {
            if (hasAutoSeeked) return;
            chrome.storage.local.get({ history: [] }, (data) => {
              const history = data.history || [];
              const entry = history.find((e) => e.url === window.location.href);
              if (entry && entry.timestamp > 5) {
                console.log("[Rewind] Auto-resuming to:", entry.timestamp);
                video.currentTime = entry.timestamp;
                hasAutoSeeked = true;
              }
            });
          };
          video.addEventListener("loadedmetadata", autoResume);
          video.addEventListener("play", autoResume, { once: true });
          if (video.readyState >= 1) autoResume();
          let periodicTimer = null;
          video.addEventListener("play", () => {
            periodicTimer = setInterval(() => {
              if (!video.paused) saveEntry(video);
            }, 3e4);
          });
          video.addEventListener("pause", () => clearInterval(periodicTimer));
          video.addEventListener("ended", () => {
            clearInterval(periodicTimer);
            chrome.storage.local.get({ history: [] }, (data) => {
              const history = (data.history || []).filter((e) => e.url !== window.location.href);
              const lastEntry = history[0] || null;
              chrome.storage.local.set({ history, lastEntry });
            });
          });
        }
        function scan() {
          document.querySelectorAll("video").forEach(attach);
        }
        new MutationObserver(scan).observe(document.documentElement, {
          childList: true,
          subtree: true
        });
        window.addEventListener("beforeunload", () => {
          document.querySelectorAll("video").forEach((video) => {
            if (!video.paused && !video.ended && video.currentTime > 5) saveEntry(video);
          });
        });
        scan();
        setTimeout(scan, 2e3);
        setTimeout(scan, 5e3);
        if (window.location.hostname.includes("rewind-player.vercel.app")) {
          window.addEventListener("message", (event) => {
            if (event.data?.type === "REWIND_AUTH_SUCCESS" && event.data?.token) {
              console.log("[Rewind] Auth token detected, relaying to extension...");
              chrome.runtime.sendMessage({
                type: "AUTH_TOKEN_UPDATE",
                token: event.data.token
              });
            }
          });
        }
      })();
    }
  });
  require_content();
})();
//# sourceMappingURL=content.js.map
