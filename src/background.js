// background.js - Rewind Central Sync Engine
import { auth, db } from './firebase-config';
import { onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

let currentUser = null;
let lastCapturedToken = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const status = user ? 'SYNC_ACTIVE' : 'OFFLINE';
  console.log(`[Background] Neural Auth State: ${status}`);
  
  // Persist session info to storage for popup to read instantly
  chrome.storage.local.set({ 
    session_active: !!user,
    user_email: user?.email || null,
    user_id: user?.uid || null
  });

  try {
    chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED', user: !!user });
  } catch (e) {
    // Popup is closed — normal.
  }
});

// ─── External Bridge (Direct Web Messaging) ───────────────────────
// This works in Chrome with manifest.json -> externally_connectable
if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    console.log('[Background] Received external message from:', sender.url);
    if (msg.type === 'REWIND_AUTH_SUCCESS' && msg.token) {
      processAuthToken(msg.token);
      sendResponse({ success: true, status: 'NEURAL_LINK_ESTABLISHED' });
    }
  });
}

// ─── Internal Bridge (Content Script & Tab Relay) ─────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHECK_AUTH_TAB') {
    chrome.tabs.query({}, (tabs) => {
      const authTab = tabs.find(t => t.url && t.url.includes('#token='));
      if (authTab) {
        processTokenUrl(authTab.url, authTab.id);
      }
    });
  } else if (msg.type === 'AUTH_TOKEN_UPDATE' && msg.token) {
    console.log('[Background] Received AUTH_TOKEN_UPDATE from content script');
    processAuthToken(msg.token);
  } else if (msg.type === 'LOGOUT_REQUEST') {
    import('firebase/auth').then(({ signOut }) => {
        signOut(auth).then(() => {
            console.log('[Background] Signed out successfully');
        });
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

function processTokenUrl(urlStr, tabId) {
  try {
    const url = new URL(urlStr);
    const params = new URLSearchParams(url.hash.substring(1));
    const token = params.get('token');
    
    if (token && token !== lastCapturedToken) {
      // Pass the token and provide the tabId for auto-closure
      processAuthToken(token, tabId);
    }
  } catch (e) {
    console.error('[Background] URL Parse failure:', e);
  }
}

async function processAuthToken(token, tabId = null) {
  try {
    if (token && token !== lastCapturedToken) {
      lastCapturedToken = token;
      console.log('[Background] Token captured. linking neural account...');
      
      const credential = GoogleAuthProvider.credential(null, token);
      await signInWithCredential(auth, credential);
      
      // Update UI across entire extension
      try {
        chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED' });
      } catch (e) {
        // Popup is closed — normal.
      }
      
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
