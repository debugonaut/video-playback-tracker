// popup.js - Pure UI View Layer
// All neural synchronization is handled in the background service worker.

// ─── State ────────────────────────────────────────────────────────
let allEntries = [];
let currentUser = null;
let activeTabVideoInfo = null;

// ─── DOM ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $q = q => document.querySelector(q);

// Active Tab Section
const activeTabSection = $('activeTabSection');
const activeTabTitle = $('activeTabTitle');
const activeTabThumb = $('activeTabThumb');
const activeTabTime = $('activeTabTime');
const activeResumeBtn = $('activeResumeBtn');
const activeResetBtn = $('activeResetBtn');

// Hero Resume Banner
const resumeBanner = $('resumeBanner');
const resumeTitle = $('resumeTitle');
const resumeTime = $('resumeTime');
const resumeProgressFill = $('resumeProgressFill');
const resumeThumb = $('resumeThumb');
const resumeBtn = $('resumeBtn');

// History List DOM
const emptyState = $('emptyState');
const historyList = $('historyList');
const entryCount = $('entryCount');
const gridToggle = $('gridToggle');
const clearAllBtn = $('clearAllBtn');
const viewAllBtn = $('viewAllBtn');
let viewMode = 'grid';

// Manual Add DOM
const manualTitle = $('manualTitle');
const manualUrl = $('manualUrl');
const manualTime = $('manualTime');
const saveManualBtn = $('saveManualBtn');

const closeBtn = $('closeBtn');

// Auth & Settings DOM
const authContent = $('authContent');
const loginForm = $('loginForm');
const profileView = $('profileView');
const syncStatus = $('syncStatus');
const userEmail = $('userEmail');
const cloudLog = $('cloudLog');
const pairingStatusLog = $('pairingStatusLog');

const logoutBtn = $('logoutBtn');
const searchInput = $('searchInput');
const viewProfileBtn = $('viewProfileBtn');
let searchQuery = '';
const syncPairBtn = $('syncPairBtn');
const pairingCodeInput = $('pairingCode');

// Settings Toggles
const autoSeekToggle = $('autoSeekToggle');
const trackShortsToggle = $('trackShortsToggle');
const inPagePromptToggle = $('inPagePromptToggle');

// ─── Helpers ──────────────────────────────────────────────────────

function fmt(s) {
  if (isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

function ago(iso) {
  if (!iso) return 'NEVER';
  const timestamp = typeof iso === 'string' ? new Date(iso).getTime() : iso;
  const d = Date.now() - timestamp;
  const m = Math.floor(d / 60000), h = Math.floor(d / 3600000), dy = Math.floor(d / 86400000);
  if (m < 1)  return 'JUST NOW';
  if (m < 60) return `${m}M AGO`;
  if (h < 24) return `${h}H AGO`;
  return `${dy}D AGO`;
}

function parseTs(str) {
  str = str.trim().replace(/s$/i, '');
  const p = str.split(':').map(Number);
  if (p.some(isNaN)) return null;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 1) return p[0];
  return null;
}

function getYoutubeId(urlStr) {
  if (!urlStr) return null;
  try {
    const u = new URL(urlStr);
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

function getResumeUrl(entry) {
  if (!entry || !entry.url) return '';
  try {
    const seconds = Math.floor(entry.timestamp || 0);

    // 1. YouTube & Shorts
    const ytId = getYoutubeId(entry.url);
    if (ytId) {
      return `https://www.youtube.com/watch?v=${ytId}&t=${seconds}s#rewind-resume=${seconds}`;
    }

    // 2. Generic Streaming & Web Players: append hash flag for content.js
    const u = new URL(entry.url);
    u.hash = `rewind-resume=${seconds}`;
    return u.toString();
  } catch (e) {}
  return entry.url;
}

// ─── Tabs ─────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    btn.classList.add('active');
    const targetTab = document.getElementById(`tab-${btn.dataset.tab}`);
    if (targetTab) {
      targetTab.classList.remove('hidden');
      targetTab.classList.add('active');
    }
    if (btn.dataset.tab === 'sync') updateAuthState();
    if (btn.dataset.tab === 'stats') updateStats();
  });
});

// ─── Active Tab Detection ─────────────────────────────────────────

function detectActiveTabVideo() {
  if (!chrome.tabs || !chrome.tabs.query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const activeTab = tabs[0];
    if (!activeTab.id || !activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
      if (activeTabSection) activeTabSection.classList.add('hidden');
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, { type: 'GET_ACTIVE_VIDEO_INFO' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.hasVideo) {
        if (activeTabSection) activeTabSection.classList.add('hidden');
        return;
      }

      activeTabVideoInfo = response;
      const matchedEntry = allEntries.find(e => checkUrlsMatch(e.url, response.url));

      if (matchedEntry && matchedEntry.timestamp > 5) {
        if (activeTabSection) activeTabSection.classList.remove('hidden');
        if (activeTabTitle) activeTabTitle.textContent = matchedEntry.title || response.title || 'Current Video';
        if (activeTabThumb) {
          activeTabThumb.src = matchedEntry.thumbnail || response.thumbnail || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
          activeTabThumb.onerror = () => {
            activeTabThumb.src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
          };
        }

        const durationStr = matchedEntry.duration ? ` / ${fmt(matchedEntry.duration)}` : '';
        if (activeTabTime) {
          activeTabTime.textContent = `${fmt(matchedEntry.timestamp)}${durationStr}`;
        }

        // Action: Resume at saved timestamp
        if (activeResumeBtn) {
          activeResumeBtn.textContent = `RESUME AT ${fmt(matchedEntry.timestamp)}`;
          activeResumeBtn.onclick = (e) => {
            e.stopPropagation();
            chrome.tabs.sendMessage(activeTab.id, {
              type: 'SEEK_CURRENT_VIDEO',
              timestamp: matchedEntry.timestamp
            }, () => {
              activeResumeBtn.textContent = 'SEEKED! ✅';
              setTimeout(() => {
                activeResumeBtn.textContent = `RESUME AT ${fmt(matchedEntry.timestamp)}`;
              }, 2000);
            });
          };
        }

        // Action: Start over from 0:00
        if (activeResetBtn) {
          activeResetBtn.onclick = (e) => {
            e.stopPropagation();
            chrome.tabs.sendMessage(activeTab.id, { type: 'RESET_CURRENT_VIDEO' }, () => {
              matchedEntry.timestamp = 0;
              matchedEntry.progress = 0;
              matchedEntry.completed = false;
              chrome.storage.local.set({ history: allEntries }, () => {
                detectActiveTabVideo();
                renderHistory();
              });
            });
          };
        }
      } else {
        if (activeTabSection) activeTabSection.classList.add('hidden');
      }
    });
  });
}

// ─── Render History ───────────────────────────────────────────────

function renderHistory() {
  while (historyList.firstChild) historyList.removeChild(historyList.firstChild);

  // Filter based on search query
  const filteredEntries = allEntries.filter(entry => {
    if (!searchQuery) return true;
    const titleMatch = entry.title && entry.title.toLowerCase().includes(searchQuery);
    const urlMatch = entry.url && entry.url.toLowerCase().includes(searchQuery);
    return titleMatch || urlMatch;
  });

  const hasEntries = filteredEntries.length > 0;
  emptyState.classList.toggle('hidden', hasEntries);
  entryCount.textContent = filteredEntries.length;

  if (hasEntries) {
    const top = filteredEntries[0];
    resumeBanner.classList.remove('hidden');
    resumeTitle.textContent = top.title;

    const currentTime = top.timestamp || 0;
    const duration = top.duration || 0;

    const isLive = top.isLive || !top.duration;
    if (isLive) {
      resumeTime.innerHTML = '<span class="live-badge">LIVE</span>';
      resumeProgressFill.style.width = '100%';
      resumeProgressFill.classList.add('live-progress');
      resumeBtn.textContent = 'JOIN LIVE';
      resumeBtn.classList.add('live-btn');
    } else if (top.completed) {
      resumeTime.textContent = 'COMPLETED (100%)';
      resumeProgressFill.style.width = '100%';
      resumeProgressFill.classList.remove('live-progress');
      resumeBtn.textContent = 'REWATCH';
      resumeBtn.classList.remove('live-btn');
    } else {
      resumeTime.textContent = duration > 0 ? `${fmt(currentTime)} / ${fmt(duration)}` : fmt(currentTime);
      const progress = top.progress || (duration > 0 ? Math.round((currentTime / duration) * 100) : 0);
      resumeProgressFill.style.width = `${progress}%`;
      resumeProgressFill.classList.remove('live-progress');
      resumeBtn.textContent = 'RESUME';
      resumeBtn.classList.remove('live-btn');
    }

    resumeThumb.src = top.thumbnail || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
    resumeThumb.onerror = () => {
      resumeThumb.src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
    };

    resumeBtn.onclick = (e) => {
      e.stopPropagation();
      if (top.url) chrome.tabs.create({ url: getResumeUrl(top) });
    };

    const heroTrash = document.getElementById('heroTrash');
    if (heroTrash) {
      heroTrash.onclick = (e) => {
        e.stopPropagation();
        deleteEntry(top.id);
      };
    }

    // List Items
    filteredEntries.slice(1).forEach(entry => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const thumbUrl = entry.thumbnail || 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=400&auto=format&fit=crop';
      const prog = entry.progress || 0;

      const trashBtn = document.createElement('button');
      trashBtn.className = 'hr-trash material-symbols-outlined';
      trashBtn.textContent = 'delete';
      trashBtn.onclick = (e) => {
        e.stopPropagation();
        deleteEntry(entry.id);
      };

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'hr-thumb-wrap';
      const img = document.createElement('img');
      img.className = 'hr-thumb';
      img.src = thumbUrl;
      thumbWrap.appendChild(img);
      thumbWrap.appendChild(trashBtn);
      li.appendChild(thumbWrap);

      const content = document.createElement('div');
      content.className = 'hr-content';

      const timeAgo = document.createElement('span');
      timeAgo.className = 'hr-ago';
      timeAgo.textContent = ago(entry.savedAt);

      const title = document.createElement('div');
      title.className = 'hr-title';
      title.textContent = entry.title;

      const timeRow = document.createElement('div');
      timeRow.className = 'hr-time-row';

      const timestampStr = document.createElement('span');
      timestampStr.className = 'hr-timestamp';

      const progressContainer = document.createElement('div');
      progressContainer.className = 'hr-progress-mini';
      const progressFill = document.createElement('div');
      progressFill.className = 'hr-progress-fill';

      const isItemLive = entry.isLive || !entry.duration;
      if (isItemLive) {
        timestampStr.innerHTML = '<span class="live-badge">LIVE</span>';
        progressFill.style.width = '100%';
        progressFill.classList.add('live-progress');
      } else if (entry.completed) {
        timestampStr.textContent = 'COMPLETED';
        progressFill.style.width = '100%';
        progressFill.classList.remove('live-progress');
      } else {
        timestampStr.textContent = `${fmt(entry.timestamp)}${entry.duration ? ' / ' + fmt(entry.duration) : ''}`;
        progressFill.style.width = `${prog}%`;
        progressFill.classList.remove('live-progress');
      }

      progressContainer.appendChild(progressFill);
      timeRow.appendChild(timestampStr);
      timeRow.appendChild(progressContainer);

      content.appendChild(timeAgo);
      content.appendChild(title);
      content.appendChild(timeRow);
      li.appendChild(content);

      li.addEventListener('click', () => {
        if (entry.url) chrome.tabs.create({ url: getResumeUrl(entry) });
      });

      historyList.appendChild(li);
    });
  } else {
    resumeBanner.classList.add('hidden');
  }
  updateStats();
}

function updateStats() {
  const totalEntries = allEntries.length;
  let totalSeconds = 0;

  allEntries.forEach(entry => {
    totalSeconds += (entry.timestamp || 0);
  });

  const statsEntries = document.getElementById('totalEntries');
  const statsTime = document.getElementById('totalTime');

  if (statsEntries) statsEntries.textContent = totalEntries;
  if (statsTime) statsTime.textContent = fmt(totalSeconds);
}

// ─── Actions ──────────────────────────────────────────────────────

saveManualBtn.addEventListener('click', async () => {
  const title = manualTitle.value.trim();
  const url = manualUrl.value.trim();
  const ts = manualTime.value.trim();

  if (!title || !ts) return;
  const secs = parseTs(ts);
  if (secs === null) return;

  const entry = {
    id: Date.now().toString(),
    title,
    url: url || null,
    timestamp: secs,
    savedAt: Date.now(),
    progress: 0,
    thumbnail: null,
    manual: true
  };

  allEntries = [entry, ...allEntries].slice(0, 50);

  chrome.storage.local.set({
    history: allEntries,
    lastEntry: entry
  }, () => {
    manualTitle.value = manualUrl.value = manualTime.value = '';
    renderHistory();
    $q('[data-tab="history"]').click();
  });
});

function deleteEntry(id) {
  const entryToDelete = allEntries.find(e => e.id === id);
  if (entryToDelete && entryToDelete.url) {
    chrome.runtime.sendMessage({ type: 'DELETE_ENTRY', url: entryToDelete.url }).catch(() => {});
  }
  allEntries = allEntries.filter(e => e.id !== id);
  chrome.storage.local.set({ history: allEntries }, () => {
    renderHistory();
    detectActiveTabVideo();
  });
}

clearAllBtn.onclick = () => {
  if (confirm('Are you sure you want to clear your entire history? This cannot be undone.')) {
    allEntries = [];
    chrome.storage.local.set({ history: [] }, () => {
      renderHistory();
      detectActiveTabVideo();
    });
    chrome.runtime.sendMessage({ type: 'CLEAR_ALL_HISTORY' }).catch(() => {});
  }
};

gridToggle.onclick = () => {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  applyViewMode();
  chrome.storage.local.set({ viewMode });
};

function applyViewMode() {
  historyList.classList.remove('grid', 'list');
  historyList.classList.add(viewMode);
  gridToggle.textContent = viewMode === 'grid' ? 'grid_view' : 'view_list';
}

viewAllBtn.onclick = () => {
  chrome.tabs.create({ url: 'https://rewind-player.vercel.app' });
};

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderHistory();
});

// ─── Settings Toggles ───────────────────────────────────────────

if (autoSeekToggle) {
  autoSeekToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoSeek: autoSeekToggle.checked });
  });
}

if (trackShortsToggle) {
  trackShortsToggle.addEventListener('change', () => {
    chrome.storage.local.set({ trackShorts: trackShortsToggle.checked });
  });
}

if (inPagePromptToggle) {
  inPagePromptToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showInPagePrompt: inPagePromptToggle.checked });
  });
}

// ─── Sync Status Management ─────────────────────────────────────

function checkSession() {
  chrome.storage.local.get(['session_active', 'user_email', 'user_id', 'history', 'autoSeek', 'trackShorts', 'showInPagePrompt'], (data) => {
    if (autoSeekToggle) autoSeekToggle.checked = !!data.autoSeek;
    if (trackShortsToggle) trackShortsToggle.checked = !!data.trackShorts;
    if (inPagePromptToggle) inPagePromptToggle.checked = data.showInPagePrompt !== false;

    if (data.session_active) {
      currentUser = { uid: data.user_id, email: data.user_email };
      if (data.history && data.history.length > 0) {
        allEntries = data.history;
        renderHistory();
      }
      updateAuthState();
      if (cloudLog) cloudLog.textContent = 'CONNECTED:_SYNC_IS_ACTIVE';
    } else {
      currentUser = null;
      updateAuthState();
      if (cloudLog) cloudLog.textContent = 'ENTER_A_PAIRING_CODE_TO_CONNECT';
    }
  });
}

function updateAuthState() {
  if (currentUser) {
    loginForm.classList.add('hidden');
    profileView.classList.remove('hidden');
    userEmail.textContent = currentUser.email;
    syncStatus.textContent = 'ONLINE';
    syncStatus.className = 'stat-badge online';
  } else {
    loginForm.classList.remove('hidden');
    profileView.classList.add('hidden');
    syncStatus.textContent = 'OFFLINE';
    syncStatus.className = 'stat-badge offline';
  }
}

// ─── Neural Pairing Flow ─────────────────────────────────────────

if (syncPairBtn) {
  syncPairBtn.onclick = () => {
    const code = pairingCodeInput.value.trim();
    if (code.length !== 10) {
      const err = 'ERROR:_INVALID_CODE_LENGTH_(10_CHARS_REQUIRED)';
      if (pairingStatusLog) pairingStatusLog.textContent = err;
      if (cloudLog) cloudLog.textContent = err;
      return;
    }

    const connectingMsg = 'CONNECTING...';
    if (pairingStatusLog) pairingStatusLog.textContent = connectingMsg;
    if (cloudLog) cloudLog.textContent = connectingMsg;

    chrome.runtime.sendMessage({ type: 'EXECUTE_PAIRING', code }, (response) => {
      if (response && !response.success) {
        const errMsg = `ERROR: ${response.error || 'PAIRING_FAILED'}`;
        if (pairingStatusLog) pairingStatusLog.textContent = errMsg;
        if (cloudLog) cloudLog.textContent = errMsg;
      } else if (response && response.success) {
        const okMsg = 'CONNECTED_SUCCESSFULLY';
        if (pairingStatusLog) pairingStatusLog.textContent = okMsg;
        if (cloudLog) cloudLog.textContent = okMsg;
      }
    });
  };
}

if (viewProfileBtn) {
  viewProfileBtn.onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://rewind-player.vercel.app/profile' });
  };
}

if (logoutBtn) {
  logoutBtn.onclick = () => {
    if (!confirm('LOG_OUT?_YOU_WILL_NEED_TO_RE-PAIR_TO_SYNC_AGAIN.')) return;

    chrome.storage.local.set({
      session_active: false,
      user_email: null,
      user_id: null
    }, () => {
      chrome.runtime.sendMessage({ type: 'LOGOUT_REQUEST' }).catch(() => {});
      currentUser = null;
      updateAuthState();
      if (pairingCodeInput) pairingCodeInput.value = '';
      if (cloudLog) cloudLog.textContent = 'LOGGED_OUT._ENTER_A_NEW_CODE_TO_RECONNECT.';
    });
  };
}

// ─── Init ─────────────────────────────────────────────────────────
function load() {
  const actionApi = chrome.action || chrome.browserAction;
  if (actionApi && actionApi.setBadgeText) {
    actionApi.setBadgeText({ text: '' });
  }

  checkSession();

  chrome.storage.local.get({ history: [], viewMode: 'grid', autoSeek: false, trackShorts: false, showInPagePrompt: true }, data => {
    allEntries = data.history || [];
    viewMode = data.viewMode || 'grid';
    if (autoSeekToggle) autoSeekToggle.checked = !!data.autoSeek;
    if (trackShortsToggle) trackShortsToggle.checked = !!data.trackShorts;
    if (inPagePromptToggle) inPagePromptToggle.checked = data.showInPagePrompt !== false;
    applyViewMode();
    renderHistory();
    detectActiveTabVideo();
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AUTH_STATE_UPDATED') checkSession();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.history) {
    allEntries = changes.history.newValue || [];
    renderHistory();
    detectActiveTabVideo();
  }
});

closeBtn.addEventListener('click', () => window.close());
load();
