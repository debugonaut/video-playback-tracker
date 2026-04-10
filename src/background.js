// background.js - Rewind Central Sync Engine
import { auth, db } from './firebase-config';
import { onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot, getDoc, deleteDoc } from 'firebase/firestore';

let currentUser = null;
let lastCapturedToken = null;

const getStorage = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));
const setStorage = (data) => new Promise(resolve => chrome.storage.local.set(data, resolve));

onAuthStateChanged(auth, async (user) => {
   const status = user ? 'SYNC_ACTIVE' : 'OFFLINE';
   console.log(`[Background] Neural Auth State: ${status}`);
   
   // Check if we already have this user in memory to avoid redundant sync starts
   const isNewUser = !currentUser || (user && user.uid !== currentUser.uid);
   currentUser = user;
 
    // Persist session info to storage for popup to read instantly
    await setStorage({ 
      session_active: !!user,
      user_email: user?.email || null,
      user_id: user?.uid || null
    });

    // Notify the popup after storage is confirmed
    try {
      chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED', user: !!user });
    } catch (e) {}
 
   if (user) {
     if (isNewUser) startRealtimeHistoryUpdates(user.uid);
   } else {
     stopRealtimeHistoryUpdates();
   }
 });
 
 function startRealtimeHistoryUpdates(uid) {
   stopRealtimeHistoryUpdates();
   console.log('[Background] Initializing Real-time Cloud Link...');
   const q = query(collection(db, `users/${uid}/history`), orderBy('savedAt', 'desc'), limit(42));
   unsubscribeHistory = onSnapshot(q, (snapshot) => {
     const cloudEntries = [];
     snapshot.forEach(doc => cloudEntries.push(doc.data()));
     if (cloudEntries.length > 0) {
       console.log(`[Background] Synced ${cloudEntries.length} entries from cloud.`);
       chrome.storage.local.set({ history: cloudEntries });
     }
   }, (err) => {
       console.error('[Background] Cloud link error:', err);
   });
 }
 
 function stopRealtimeHistoryUpdates() {
   if (unsubscribeHistory) {
       console.log('[Background] Terminating Cloud Link...');
       unsubscribeHistory();
       unsubscribeHistory = null;
   }
 }

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
  } else if (msg.type === 'EXECUTE_PAIRING') {
    executePairing(msg.code)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message || 'INTERNAL_ERROR' }));
    return true; // Keep channel open for async
  }
});

async function executePairing(code) {
  try {
    // Brute Force Protection: Check local failure count
    const storage = await getStorage(['pairing_failures', 'lockout_until']);
    const now = Date.now();
    
    if (storage && storage.lockout_until && now < storage.lockout_until) {
      const remaining = Math.ceil((storage.lockout_until - now) / 60000);
      return { success: false, error: `TOO_MANY_ATTEMPTS:_LOCKED_FOR_${remaining}_MIN` };
    }

    console.log(`[Background] Attempting neural pairing with code: ${code}`);
    const pairRef = doc(db, 'sync_pairs', code);
    
    // 10-second timeout for database handshake
    const snap = await Promise.race([
      getDoc(pairRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('NETWORK_TIMEOUT:_PLEASE_TRY_AGAIN')), 10000))
    ]);

    if (!snap.exists()) {
      const newFailures = ((storage && storage.pairing_failures) || 0) + 1;
      if (newFailures >= 3) {
        await setStorage({ 
          pairing_failures: 0, 
          lockout_until: now + (15 * 60 * 1000) // 15 min lockout
        });
        return { success: false, error: 'SECURITY_LOCKOUT:_15_MINUTES' };
      }
      await setStorage({ pairing_failures: newFailures });
      return { success: false, error: `INVALID_CODE:_${3 - newFailures}_ATTEMPTS_REMAINING` };
    }

    const data = snap.data();
    if (Date.now() > data.expiresAt) {
      await deleteDoc(pairRef);
      return { success: false, error: 'CODE_EXPIRED' };
    }

    console.log('[Background] Pairing successful for:', data.email);
    
    // Mirror the session into local storage
    await setStorage({
      session_active: true,
      user_email: data.email,
      user_id: data.uid
    });

    // Cleanup the code
    await deleteDoc(pairRef);

    // Initial state update across extension
    try { chrome.runtime.sendMessage({ type: 'AUTH_STATE_UPDATED' }); } catch(e) {}
    
    // Reset failures on success
    await setStorage({ pairing_failures: 0, lockout_until: null });

    return { success: true };
  } catch (err) {
    console.error('[Background] Pairing error:', err);
    return { success: false, error: err.message };
  }
}

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
      
      // Use the token as a Google ID Token (first argument)
      const credential = GoogleAuthProvider.credential(token);
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
  const activeUser = auth.currentUser;
  if (!activeUser || !entry || !entry.url) {
    if (!activeUser) console.log('[Sync] Pause: No active user session');
    return;
  }

  try {
    // Generate a robust unique ID from the full URL
    const entryId = btoa(unescape(encodeURIComponent(entry.url))).replace(/[/+=]/g, '_').substring(0, 50);
    const historyRef = doc(db, `users/${activeUser.uid}/history`, entryId);

    console.log(`[Sync] Attempting cloud push: ${entry.title}`);
    
    await setDoc(historyRef, {
      ...entry,
      userId: activeUser.uid,
      syncedAt: serverTimestamp(),
      savedAt: entry.savedAt || Date.now() // Ensure number
    }, { merge: true });

    console.log(`[Sync] Cloud success: ${entry.title} -> users/${activeUser.uid}/history/${entryId}`);
  } catch (err) {
    console.error('[Sync] Firestore error:', err);
  }
}
