// background.js - Rewind Central Sync Engine
import { auth, db } from './firebase-config';
import { onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

let currentUser = null;
let lastCapturedToken = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  console.log(`[Background] Neural Auth State: ${user ? 'SYNC_ACTIVE' : 'OFFLINE'}`);
  // Broadcast to popup
  chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED', user: !!user });
});

// Proactive Token Capture: Check ALL tabs if requested
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHECK_AUTH_TAB') {
    // Search ALL windows and tabs for the token
    chrome.tabs.query({}, (tabs) => {
      const authTab = tabs.find(t => t.url && t.url.includes('#token='));
      if (authTab) {
        processTokenUrl(authTab.url, authTab.id);
      }
    });
  }
});

// ─── Firefox URL-Capture Alternative ───────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Catching both url change AND status loading to ensure we don't miss it
  const url = changeInfo.url || tab.url;
  if (url && url.includes('#token=')) {
    processTokenUrl(url, tabId);
  }
});

async function processTokenUrl(urlStr, tabId) {
  try {
    const url = new URL(urlStr);
    const params = new URLSearchParams(url.hash.substring(1));
    const token = params.get('token');
    
    if (token && token !== lastCapturedToken) {
      lastCapturedToken = token;
      console.log('[Background] Token captured. linking neural account...');
      
      const credential = GoogleAuthProvider.credential(null, token);
      await signInWithCredential(auth, credential);
      
      // Update UI across entire extension
      chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED' });
      
      // Close capture tab after a brief delay for success visibility
      if (tabId) setTimeout(() => chrome.tabs.remove(tabId), 3000);
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
