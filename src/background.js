// background.js - Rewind Central Sync Engine
import { auth, db } from './firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  console.log(`[Background] Neural Auth State: ${user ? 'SYNC_ACTIVE' : 'OFFLINE'}`);
  // Broadcast to popup
  chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED', user: !!user });
});

// Proactive Token Capture: Check if the current tab has a token when requested
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHECK_AUTH_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('#token=')) {
        processTokenUrl(tabs[0].url, tabs[0].id);
      }
    });
  }
});

// ─── Firefox URL-Capture Auth Alternative ────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes('#token=')) {
    processTokenUrl(changeInfo.url, tabId);
  }
});

async function processTokenUrl(urlStr, tabId) {
  try {
    const url = new URL(urlStr);
    const params = new URLSearchParams(url.hash.substring(1));
    const token = params.get('token');
    
    if (token) {
      console.log('[Background] Token captured. Linking neural account...');
      const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
      const credential = GoogleAuthProvider.credential(null, token);
      await signInWithCredential(auth, credential);
      
      chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED' });
      if (tabId) setTimeout(() => chrome.tabs.remove(tabId), 1500);
    }
  } catch (e) {
    console.error('[Background] Capture failure:', e);
  }
}

// ─── Sync Logic ──────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.history || changes.lastEntry)) {
    if (changes.lastEntry?.newValue) {
      syncToCloud(changes.lastEntry.newValue);
    }
  }
});

async function syncToCloud(entry) {
  if (!currentUser || !entry || !entry.url) return;

  try {
    const safeUrl = encodeURIComponent(entry.url);
    const entryId = btoa(unescape(safeUrl)).replace(/[/+=]/g, '_').substring(0, 50);
    const historyRef = doc(db, `users/${currentUser.uid}/history`, entryId);

    await setDoc(historyRef, {
      ...entry,
      userId: currentUser.uid,
      syncedAt: serverTimestamp(),
      savedAt: entry.savedAt || Date.now()
    }, { merge: true });

    console.log(`[Sync] Cloud success: ${entry.title}`);
  } catch (err) {
    console.error('[Sync] Firestore error:', err);
  }
}
