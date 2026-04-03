// popup.js – Rewind Video Tracker (Kinetic Void Edition)
import { auth, db } from './firebase-config';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// ─── State ────────────────────────────────────────────────────────
let allEntries = [];
let currentUser = null;
let unsubscribeHistory = null;

// ─── DOM ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $q = q => document.querySelector(q);

const resumeBanner = $('resumeBanner');
const resumeTitle = $('resumeTitle');
const resumeTime = $('resumeTime');
const resumeProgressFill = $('resumeProgressFill');
const resumeThumb = $('resumeThumb');
const resumeBtn = $('resumeBtn');

const emptyState = $('emptyState');
const historyList = $('historyList');
const entryCount = $('entryCount');
const gridToggle = $('gridToggle');
const clearAllBtn = $('clearAllBtn');
const viewAllBtn = $('viewAllBtn');
let viewMode = 'grid'; // Default to grid for Image 3

const manualTitle = $('manualTitle');
const manualUrl = $('manualUrl');
const manualTime = $('manualTime');
const saveManualBtn = $('saveManualBtn');

const closeBtn = $('closeBtn');

// Auth DOM
const authContent = $('authContent');
const loginForm = $('loginForm');
const profileView = $('profileView');
const syncStatus = $('syncStatus');
const userEmail = $('userEmail');
const cloudLog = $('cloudLog');

const emailInput = $('emailInput');
const passwordInput = $('passwordInput');
const loginBtn = $('loginBtn');
const registerBtn = $('registerBtn');
const googleBtn = $('googleBtn');
const logoutBtn = $('logoutBtn');
const settingsBtn = $('settingsBtn');

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

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url || 'UNKNOWN'; }
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
  });
});

// ─── Render History ───────────────────────────────────────────────

function renderHistory() {
  while (historyList.firstChild) historyList.removeChild(historyList.firstChild);

  const hasEntries = allEntries.length > 0;
  emptyState.classList.toggle('hidden', hasEntries);
  entryCount.textContent = allEntries.length;

  if (hasEntries) {
    const top = allEntries[0];
    resumeBanner.classList.remove('hidden');
    resumeTitle.textContent = top.title;
    
    const currentTime = top.timestamp || 0;
    const duration = top.duration || 0;
    resumeTime.textContent = duration > 0 ? `${fmt(currentTime)} / ${fmt(duration)}` : fmt(currentTime);
    
    resumeThumb.src = top.thumbnail || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
    resumeThumb.onerror = () => {
      resumeThumb.src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
    };

    const progress = top.progress || (duration > 0 ? Math.round((currentTime / duration) * 100) : 0);
    resumeProgressFill.style.width = `${progress}%`;

    resumeBtn.onclick = (e) => {
      e.stopPropagation();
      if (top.url) chrome.tabs.create({ url: top.url });
    };

    const heroTrash = document.getElementById('heroTrash');
    if (heroTrash) {
      heroTrash.onclick = (e) => {
        e.stopPropagation();
        deleteEntry(top.id);
      };
    }

    // List Items
    allEntries.slice(1).forEach(entry => {
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
      timestampStr.textContent = `${fmt(entry.timestamp)}${entry.duration ? ' / ' + fmt(entry.duration) : ''}`;

      const progressContainer = document.createElement('div');
      progressContainer.className = 'hr-progress-mini';
      const progressFill = document.createElement('div');
      progressFill.className = 'hr-progress-fill';
      progressFill.style.width = `${prog}%`;
      progressContainer.appendChild(progressFill);

      timeRow.appendChild(timestampStr);
      timeRow.appendChild(progressContainer);

      content.appendChild(timeAgo);
      content.appendChild(title);
      content.appendChild(timeRow);
      li.appendChild(content);

      li.addEventListener('click', () => {
        if (entry.url) chrome.tabs.create({ url: entry.url });
      });

      historyList.appendChild(li);
    });
  } else {
    resumeBanner.classList.add('hidden');
  }
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

  if (currentUser) {
    const historyRef = doc(db, `users/${currentUser.uid}/history/${entry.id}`);
    await setDoc(historyRef, {
      ...entry,
      userId: currentUser.uid,
      syncedAt: serverTimestamp(),
      savedAt: entry.savedAt // Ensure website can order it
    }, { merge: true });
  }

  allEntries = [entry, ...allEntries].slice(0, 42); 
  chrome.storage.local.set({ history: allEntries }, () => {
    manualTitle.value = manualUrl.value = manualTime.value = '';
    renderHistory();
    $q('[data-tab="history"]').click();
  });
});

function deleteEntry(id) {
  allEntries = allEntries.filter(e => e.id !== id);
  chrome.storage.local.set({ history: allEntries }, renderHistory);
}

clearAllBtn.onclick = () => {
  if (confirm('CLEAR_ALL_NEURAL_HISTORY?')) {
    allEntries = [];
    chrome.storage.local.set({ history: [] }, renderHistory);
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

settingsBtn.onclick = () => {
  chrome.tabs.create({ url: 'https://rewind-player.vercel.app' });
};

// ─── Firebase Auth ────────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthState();
  if (user) {
    startRealtimeHistoryUpdates(user.uid);
    cloudLog.textContent = 'NEURAL_LINK_ESTABLISHED: SYNC_READY';
  } else {
    stopRealtimeHistoryUpdates();
    cloudLog.textContent = 'NEURAL_LINK_DROPPED: OFFLINE_MODE';
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AUTH_STATE_UPDATED') updateAuthState();
});

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

loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;

  cloudLog.textContent = 'AUTHENTICATING_USER...';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    cloudLog.textContent = 'AUTH_SUCCESS: NEURAL_LINK_ESTABLISHED';
  } catch (e) {
    cloudLog.textContent = `AUTH_ERROR: ${e.code.replace('auth/', '').toUpperCase()}`;
  }
};

registerBtn.onclick = () => {
  chrome.tabs.create({ url: 'https://rewind-player.vercel.app/sync?reason=signup' });
  cloudLog.textContent = 'OPENING_REGISTRATION_PORTAL...';
};

googleBtn.onclick = async () => {
  cloudLog.textContent = 'INITIALIZING_NEURAL_AUTH...';
  const isFirefox = /Firefox/.test(navigator.userAgent);

  if (isFirefox) {
    // Firefox Bridge Alternative
    const authUrl = `https://rewind-player.vercel.app/sync?reason=extension_auth&handler=firefox`;
    chrome.windows.create({ url: authUrl, type: 'popup', width: 500, height: 650 });
    cloudLog.textContent = 'NEURAL_LINK_ESTABLISHED: SYNC_READY';
  } else {
    // Chrome Identity API
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        cloudLog.textContent = 'AUTH_ERROR: CANNOT_RETRIEVE_TOKEN';
        return;
      }
      try {
        const credential = GoogleAuthProvider.credential(null, token);
        await signInWithCredential(auth, credential);
        cloudLog.textContent = 'NEURAL_LINK_ESTABLISHED: SYNC_READY';
        updateAuthState();
        chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED' });
      } catch (e) {
        cloudLog.textContent = `AUTH_ERROR: ${e.message}`;
      }
    });
  }
};

logoutBtn.onclick = () => signOut(auth);

// ─── sync ─────────────────────────────────────────────────────────

function startRealtimeHistoryUpdates(uid) {
  stopRealtimeHistoryUpdates();
  const q = query(collection(db, `users/${uid}/history`), orderBy('savedAt', 'desc'), limit(42));
  unsubscribeHistory = onSnapshot(q, (snapshot) => {
    const cloudEntries = [];
    snapshot.forEach(doc => cloudEntries.push(doc.data()));
    if (cloudEntries.length > 0) {
      allEntries = cloudEntries;
      chrome.storage.local.set({ history: allEntries }, renderHistory);
    }
  });
}

function stopRealtimeHistoryUpdates() {
  if (unsubscribeHistory) unsubscribeHistory();
}

// ─── Init ─────────────────────────────────────────────────────────
function load() {
  if (chrome.action) chrome.action.setBadgeText({ text: '' });
  chrome.storage.local.get({ history: [], viewMode: 'grid' }, data => {
    allEntries = data.history || [];
    viewMode = data.viewMode || 'grid';
    applyViewMode();
    renderHistory();
  });
}

closeBtn.addEventListener('click', () => window.close());
load();
