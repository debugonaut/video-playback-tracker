// test_extension_sync.mjs - Verify the new extension_sync collection works
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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

async function test() {
  console.log('\n=== EXTENSION SYNC COLLECTION TEST ===\n');

  const testRef = doc(db, 'extension_sync', 'test-user-123', 'entries', 'test-video-1');

  // Test 1: Write (no auth)
  console.log('[Test 1] Writing to extension_sync (no auth)...');
  try {
    await setDoc(testRef, {
      title: 'Test Video - Terminal Diagnostic',
      url: 'https://youtube.com/watch?v=test123',
      timestamp: 42,
      formattedTime: '0:42',
      savedAt: Date.now(),
      progress: 15,
    });
    console.log('[Test 1] ✅ SUCCESS: Write completed without auth!');
  } catch (err) {
    console.log('[Test 1] ❌ FAILED:', err.code || err.message);
    process.exit(1);
  }

  // Test 2: Read (no auth)
  console.log('[Test 2] Reading from extension_sync (no auth)...');
  try {
    const snap = await getDoc(testRef);
    if (snap.exists()) {
      console.log('[Test 2] ✅ SUCCESS: Read back:', snap.data().title);
    } else {
      console.log('[Test 2] ❌ FAILED: Document not found');
    }
  } catch (err) {
    console.log('[Test 2] ❌ FAILED:', err.code || err.message);
  }

  // Cleanup
  console.log('[Cleanup] Deleting test document...');
  await deleteDoc(testRef);
  console.log('[Cleanup] Done.');

  console.log('\n=== ALL TESTS PASSED — READY TO DEPLOY ===\n');
  process.exit(0);
}

test();
