// background.js – Video Playback Tracker v2 Service Worker
import { db, auth } from './firebase-config';
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

let currentUser = null;

// Track Auth State changes
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    console.log('Firebase synced: User is signed in');
    syncPendingToCloud();
  } else {
    console.log('Firebase: No user signed in');
  }
});

// Listener for auth relay from landing page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AUTH_TOKEN_UPDATE' && message.token) {
    console.log('[Rewind] Background received token, updating auth state...');
    const credential = GoogleAuthProvider.credential(null, message.token);
    signInWithCredential(auth, credential).then(() => {
      chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED' });
    }).catch(err => {
      console.error('[Rewind] Cross-origin auth failed:', err);
    });
  }
});

// Helper: Push an entry to Firestore
async function syncToCloud(entry) {
  if (!currentUser || !entry || !entry.url) return;

  try {
    // Unified, safe URL-to-ID hashing (Shared Logic)
    // Note: syncToCloud is now handled centrally by background.js 
    // listening for changes to chrome.storage.local
    const safeUrl = encodeURIComponent(entry.url);
    const entryId = btoa(unescape(safeUrl)).replace(/[/+=]/g, '_').substring(0, 50);
    const historyRef = doc(db, `users/${currentUser.uid}/history`, entryId);

    await setDoc(historyRef, {
      ...entry,
      userId: currentUser.uid,
      syncedAt: serverTimestamp(),
      lastModified: Date.now()
    }, { merge: true });

    console.log(`[Sync] Cloud success: ${entry.title}`);
  } catch (error) {
    console.error('[Sync] Cloud error:', error);
  }
}

// Helper: Sync any pending data from local to cloud
async function syncPendingToCloud() {
  if (!currentUser) return;
  chrome.storage.local.get({ history: [] }, ({ history }) => {
    if (history && history.length > 0) {
      console.log(`[Sync] Found ${history.length} items to sync...`);
      history.forEach(entry => syncToCloud(entry));
    }
  });
}

// ── Startup badge ──────────────────────────────────────────────────────────
const initBadge = () => {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.action) return;
  chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
    if (lastEntry) {
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#e51152' });
      chrome.action.setTitle({ title: `Resume: ${lastEntry.title} at ${lastEntry.formattedTime}` });
    }
  });
};

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onStartup.addListener(initBadge);
  chrome.runtime.onInstalled.addListener(() => {
    if (chrome.action) chrome.action.setBadgeBackgroundColor({ color: '#e51152' });
  });
}

// Clear badge when popup opens - we can do this in popup.js instead or remove it
// chrome.action.onClicked.addListener is incompatible with a default_popup

// ── Resume Reminder (Alarms + Notifications) ───────────────────────────────

// When a new entry is saved, set/reset the reminder alarm
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.lastEntry?.newValue) return;

  chrome.storage.local.get({ notifyEnabled: false, notifyAfterHours: 3 }, (settings) => {
    if (settings.notifyEnabled) {
      chrome.alarms.clear('resumeReminder', () => {
        chrome.alarms.create('resumeReminder', {
          delayInMinutes: Number(settings.notifyAfterHours) * 60,
        });
      });
    }
  });

  // REAL-TIME CLOUD SYNC: If lastEntry changed, push it to cloud
  if (changes.lastEntry?.newValue) {
    syncToCloud(changes.lastEntry.newValue);
  }
});

// Fire notification when alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'resumeReminder') return;
  chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
    if (!lastEntry) return;
    chrome.notifications.create('resumeReminder', {
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   'Continue Watching?',
      message: `${lastEntry.title} — you left off at ${lastEntry.formattedTime}`,
      buttons: [{ title: 'Open & Resume' }],
      requireInteraction: true,
    });
  });
});

// Click notification → open the page
chrome.notifications.onClicked.addListener(() => {
  chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
    if (lastEntry?.url) chrome.tabs.create({ url: lastEntry.url });
  });
  chrome.notifications.clear('resumeReminder');
});

chrome.notifications.onButtonClicked.addListener((_, btnIdx) => {
  if (btnIdx === 0) {
    chrome.storage.local.get({ lastEntry: null }, ({ lastEntry }) => {
      if (lastEntry?.url) chrome.tabs.create({ url: lastEntry.url });
    });
    chrome.notifications.clear('resumeReminder');
  }
});
