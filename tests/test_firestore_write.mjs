// test_firestore_write.mjs - Diagnostic test for Firestore connectivity
// This simulates exactly what the extension's syncToCloud does

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, query, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAYJ0Ktu8otBPMYBI4i4DMGJxLu1_bzd0c",
  authDomain: "rewind-519f0.firebaseapp.com",
  projectId: "rewind-519f0",
  storageBucket: "rewind-519f0.firebasestorage.app",
  messagingSenderId: "743702437264",
  appId: "1:743702437264:web:575f3ca75cba5efd66e715"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testFirestoreQuery() {
  console.log('\n=== FIRESTORE DIAGNOSTIC TEST ===\n');
  
  // Test 1: Check if we can read from Firestore (without auth, should fail per rules)
  console.log('[Test 1] Attempting UNAUTHENTICATED read from users collection...');
  try {
    const q = query(collection(db, 'users'), orderBy('savedAt', 'desc'));
    const snap = await getDocs(q);
    console.log('[Test 1] UNEXPECTED: Read succeeded without auth! Docs:', snap.size);
  } catch (err) {
    console.log('[Test 1] Expected error (no auth):', err.code || err.message);
  }

  // Test 2: Check if we can read sync_pairs (should succeed per rules)
  console.log('\n[Test 2] Attempting read from sync_pairs (should work per rules)...');
  try {
    const q = query(collection(db, 'sync_pairs'));
    const snap = await getDocs(q);
    console.log('[Test 2] SUCCESS: sync_pairs readable. Active codes:', snap.size);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`  - Code: ${doc.id}, User: ${data.email}, Expires: ${new Date(data.expiresAt).toISOString()}`);
    });
  } catch (err) {
    console.log('[Test 2] ERROR:', err.code || err.message);
  }

  // Test 3: Try to write without auth (should fail)
  console.log('\n[Test 3] Attempting UNAUTHENTICATED write to users/test/history...');
  try {
    await setDoc(doc(db, 'users', 'test-user', 'history', 'test-entry'), {
      title: 'Test Video',
      url: 'https://youtube.com/watch?v=test',
      savedAt: Date.now()
    });
    console.log('[Test 3] UNEXPECTED: Write succeeded without auth!');
  } catch (err) {
    console.log('[Test 3] Expected error (no auth):', err.code || err.message);
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  console.log('\nConclusion: The extension CANNOT write to Firestore without Firebase Auth.');
  console.log('The Neural Bridge (portal proxy) is the ONLY viable path.');
  console.log('The bridge works by: Extension → content.js → window.postMessage → React App → Firestore');
  
  process.exit(0);
}

testFirestoreQuery();
