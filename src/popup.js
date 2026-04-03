// popup.js – Rewind Video Tracker (Kinetic Void Edition)
import { auth, db } from './firebase-config';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
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
  
  const statTotal = $('statTotal');
  const statSite = $('statSite');
  const statTime = $('statTime');

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
const realtimeToggle = $('realtimeToggle');

  // ─── Helpers ──────────────────────────────────────────────────────

  function fmt(s) {
    if (isNaN(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function ago(iso) {
    const d = Date.now() - new Date(iso).getTime();
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

  function esc(str) { 
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); 
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
    if (btn.dataset.tab === 'stats') renderStats();
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
      // 1. Hero Card (Most Recent)
      const top = allEntries[0];
      resumeBanner.classList.remove('hidden');
      resumeTitle.textContent = top.title;
      
      const currentTime = top.timestamp || 0;
      const duration = top.duration || 0;
      resumeTime.textContent = duration > 0 ? `${fmt(currentTime)} / ${fmt(duration)}` : fmt(currentTime);
      
      if (top.thumbnail) {
        resumeThumb.src = top.thumbnail;
        resumeThumb.classList.remove('hidden');
      } else {
        resumeThumb.src = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop';
      }

      const progress = top.progress || (duration > 0 ? Math.round((currentTime / duration) * 100) : 0);
      resumeProgressFill.style.width = `${progress}%`;

      resumeBtn.onclick = (e) => {
        e.stopPropagation();
        if (top.url) chrome.tabs.create({ url: top.url });
      };

      // 2. List Items
      allEntries.slice(1).forEach(entry => {
        const li = document.createElement('li');
        li.className = 'history-item';
        
        const thumbUrl = entry.thumbnail || 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=400&auto=format&fit=crop';
        const prog = entry.progress || 0;
        const siteLabel = entry.url ? host(entry.url) : 'MANUAL';

        // Thumbnail Wrap
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'hr-thumb-wrap';
        const img = document.createElement('img');
        img.className = 'hr-thumb';
        img.src = thumbUrl;
        img.alt = '';
        thumbWrap.appendChild(img);

        // Content Wrap
        const content = document.createElement('div');
        content.className = 'hr-content';

        const timeAgo = document.createElement('span');
        timeAgo.className = 'hr-ago';
        timeAgo.textContent = ago(entry.savedAt);

        const title = document.createElement('div');
        title.className = 'hr-title';
        title.textContent = entry.title;
        title.title = entry.title;

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

        li.appendChild(thumbWrap);
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

  // ─── Stats ────────────────────────────────────────────────────────

  function renderStats() {
    if (allEntries.length === 0) {
      statTotal.textContent = '0';
      statSite.textContent = 'NONE';
      statTime.textContent = '0.0 HRS TOTAL';
      return;
    }

    const totalSecs = allEntries.reduce((s, e) => s + (e.timestamp || 0), 0);
    const sites = {};
    allEntries.forEach(e => {
      const s = e.url ? host(e.url) : 'MANUAL';
      sites[s] = (sites[s] || 0) + (e.timestamp || 0);
    });

    const sortedSites = Object.entries(sites).sort((a, b) => b[1] - a[1]);
    const topSite = sortedSites[0];

    statTotal.textContent = allEntries.length.toLocaleString();
    statSite.textContent = topSite ? topSite[0].toUpperCase() : 'NONE';
    statTime.textContent = `${(totalSecs / 3600).toFixed(1)} HRS TOTAL`;
  }

  // ─── Manual Actions ───────────────────────────────────────────────

  saveManualBtn.addEventListener('click', () => {
    const title = manualTitle.value.trim();
    const url = manualUrl.value.trim();
    const ts = manualTime.value.trim();

    if (!title || !ts) return;

    const secs = parseTs(ts);
    if (secs === null) return;

    const entry = {
      id: Date.now(),
      title,
      url: url || null,
      timestamp: secs,
      savedAt: new Date().toISOString(),
      progress: 0,
      thumbnail: null,
      manual: true
    };

    allEntries = [entry, ...allEntries].slice(0, 42); 
    chrome.storage.local.set({ history: allEntries }, () => {
      manualTitle.value = manualUrl.value = manualTime.value = '';
      renderHistory();
      $q('[data-tab="history"]').click();

      // If logged in, sync to cloud
      if (currentUser) syncToCloud(entry);
    });
  });

  // ─── Firebase Auth Logic ─────────────────────────────────────────

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
    const email = emailInput.value;
    const password = passwordInput.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      cloudLog.textContent = `AUTH_ERROR: ${e.message}`;
    }
  };

  registerBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      cloudLog.textContent = `AUTH_ERROR: ${e.message}`;
    }
  };

  googleBtn.onclick = async () => {
    cloudLog.textContent = 'INITIALIZING_AUTH_FLOW...';
    
    const isFirefox = /Firefox/.test(navigator.userAgent);

    if (isFirefox) {
      // Firefox fallback: Use Firebase popup auth
      try {
        const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        cloudLog.textContent = 'GOOGLE_AUTH_SUCCESS: SYNC_READY';
      } catch (e) {
        cloudLog.textContent = `AUTH_ERROR: ${e.message}`;
        console.error(e);
      }
    } else {
      // Chrome: Use identity API
      try {
        chrome.identity.getAuthToken({ interactive: true }, async (token) => {
          if (chrome.runtime.lastError || !token) {
            cloudLog.textContent = `AUTH_ERROR: ${chrome.runtime.lastError?.message || 'No token received'}`;
            return;
          }
          try {
            const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
            const credential = GoogleAuthProvider.credential(null, token);
            await signInWithCredential(auth, credential);
            cloudLog.textContent = 'GOOGLE_AUTH_SUCCESS: SYNC_READY';
          } catch (e) {
            cloudLog.textContent = `AUTH_ERROR: ${e.message}`;
          }
        });
      } catch (e) {
        cloudLog.textContent = `AUTH_ERROR: ${e.message}`;
      }
    }
  };

  logoutBtn.onclick = () => signOut(auth);

  // ─── Cloud Sync Logic ─────────────────────────────────────────────

  function startRealtimeHistoryUpdates(uid) {
    stopRealtimeHistoryUpdates(); // Clear existing

    const q = query(
      collection(db, `users/${uid}/history`),
      orderBy('savedAt', 'desc'),
      limit(42)
    );

    unsubscribeHistory = onSnapshot(q, (snapshot) => {
      const cloudEntries = [];
      snapshot.forEach(doc => cloudEntries.push(doc.data()));
      
      if (cloudEntries.length > 0) {
        allEntries = cloudEntries;
        chrome.storage.local.set({ history: allEntries });
        renderHistory();
      }
    });
  }

  function stopRealtimeHistoryUpdates() {
    if (unsubscribeHistory) unsubscribeHistory();
  }

  async function syncToCloud(entry) {
    if (!currentUser || !entry.url) return;
    try {
      const entryId = btoa(entry.url).replace(/[/+=]/g, '_').substring(0, 50);
      const docRef = doc(db, `users/${currentUser.uid}/history`, entryId);
      await setDoc(docRef, {
        ...entry,
        userId: currentUser.uid,
        syncedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Cloud sync error:', e);
    }
  }

  // ─── Storage ──────────────────────────────────────────────────────

  function load() {
    chrome.storage.local.get({ history: [] }, data => {
      allEntries = data.history || [];
      renderHistory();
    });
  }

  // Close popup
  closeBtn.addEventListener('click', () => window.close());

  // ─── Init ─────────────────────────────────────────────────────────
  load();
