// background.js – Video Playback Tracker v2 Service Worker
import { db, auth } from './firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
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

// Helper: Push an entry to Firestore
async function syncToCloud(entry) {
  if (!currentUser || !entry || !entry.url) return;

  try {
    // We use a hashed version of the URL or a clean ID to identify the video entry in Firestore
    const entryId = btoa(entry.url).replace(/[/+=]/g, '_').substring(0, 50);
    const historyRef = doc(db, `users/${currentUser.uid}/history`, entryId);

    await setDoc(historyRef, {
      ...entry,
      userId: currentUser.uid,
      syncedAt: serverTimestamp(),
      lastModified: Date.now()
    }, { merge: true });

    console.log(`Cloud sync success: ${entry.title}`);
  } catch (error) {
    console.error('Cloud sync error:', error);
  }
}

// Helper: Sync any pending data from local to cloud
async function syncPendingToCloud() {
  chrome.storage.local.get({ history: [] }, ({ history }) => {
    if (history && history.length > 0) {
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

// Clear badge when popup opens
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

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
