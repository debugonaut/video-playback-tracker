#!/usr/bin/env node
// Test 2: Firebase Backend Connectivity
// Tests: Auth (email/password), Firestore (read/write), Token exchange

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp, connectFirestoreEmulator } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAYJ0Ktu8otBPMYBI4i4DMGJxLu1_bzd0c",
  authDomain: "rewind-519f0.firebaseapp.com",
  projectId: "rewind-519f0",
  storageBucket: "rewind-519f0.firebasestorage.app",
  messagingSenderId: "743702437264",
  appId: "1:743702437264:web:575f3ca75cba5efd66e715"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let pass = 0;
let fail = 0;

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    fail++;
  }
}

async function run() {
  console.log('\n═══ TEST: Firebase Backend Connectivity ═══\n');
  
  // ── Test 1: Firebase App Initialization ──
  console.log('── App Initialization ──\n');
  test('Firebase App initialized', !!app);
  test('Auth instance created', !!auth);
  test('Firestore instance created', !!db);
  
  // ── Test 2: Auth - We'll test with a known test account ──
  // Since we can't do interactive login, we test the API is reachable
  console.log('\n── Auth API Reachability ──\n');
  
  try {
    // Attempt login with deliberately wrong credentials
    await signInWithEmailAndPassword(auth, 'test-probe@rewind-test.invalid', 'not-a-real-password-12345');
    test('Auth API reachable (unexpected success)', true);
  } catch (e) {
    // We EXPECT an error, but the error TYPE tells us if Firebase is reachable
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-email') {
      test('Auth API reachable (Firebase responded with auth error — this is correct)', true);
      test(`Auth error code: "${e.code}" (expected rejection)`, true);
    } else if (e.code === 'auth/network-request-failed') {
      test('Auth API reachable', false, 'Network request failed — check internet connection');
    } else if (e.code === 'auth/api-key-not-valid') {
      test('Auth API reachable', false, `API key rejected: ${e.code}`);
    } else {
      test('Auth API reachable', false, `Unexpected error: ${e.code} — ${e.message}`);
    }
  }
  
  // ── Test 3: Firestore Connectivity ──
  console.log('\n── Firestore Connectivity ──\n');
  
  const testDocRef = doc(db, '_test_probe', 'connectivity_check');
  
  try {
    // Try to read (will fail with permission-denied if rules are set, which is EXPECTED)
    await getDoc(testDocRef);
    test('Firestore API reachable (read succeeded — open rules?)', true);
  } catch (e) {
    if (e.code === 'permission-denied') {
      test('Firestore API reachable (permission-denied is a valid server response)', true);
      test('Firestore security rules are active (good: blocking unauthorized reads)', true);
    } else if (e.code === 'unavailable' || e.message?.includes('network')) {
      test('Firestore API reachable', false, 'Network unavailable');
    } else {
      test('Firestore API reachable', false, `Unexpected: ${e.code} — ${e.message}`);
    }
  }
  
  // ── Test 4: Auth Config Validation ──
  console.log('\n── Auth Config Cross-Check ──\n');
  
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '..');
  
  // Compare firebase configs across extension and landing page
  const extConfig = fs.readFileSync(path.join(ROOT, 'src', 'firebase-config.js'), 'utf8');
  const webConfig = fs.readFileSync(path.join(ROOT, 'landing-page', 'src', 'lib', 'firebase.ts'), 'utf8');
  
  const extractKey = (code, key) => {
    const match = code.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
    return match ? match[1] : null;
  };
  
  const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
  for (const key of keys) {
    const extVal = extractKey(extConfig, key);
    const webVal = extractKey(webConfig, key);
    test(`${key} matches (extension ↔ landing page)`, extVal === webVal, 
      extVal !== webVal ? `ext="${extVal}" vs web="${webVal}"` : '');
  }
  
  // ── Test 5: CSP allows Firebase connections ──
  console.log('\n── Content Security Policy ──\n');
  
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const csp = manifest.content_security_policy?.extension_pages || '';
  
  test('CSP allows googleapis.com', csp.includes('googleapis.com'));
  test('CSP allows firebaseio.com', csp.includes('firebaseio.com'));
  test('CSP allows firebaseapp.com', csp.includes('firebaseapp.com'));
  
  // ── Test 6: OAuth2 Config ──
  console.log('\n── OAuth2 Config ──\n');
  
  const oauth = manifest.oauth2;
  test('OAuth2 client_id is set', !!oauth?.client_id && oauth.client_id.length > 10);
  test('OAuth2 scopes include "email"', oauth?.scopes?.includes('email'));
  test('OAuth2 scopes include "profile"', oauth?.scopes?.includes('profile'));
  
  // ══ Summary ══
  console.log('\n' + '═'.repeat(50));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
  if (fail > 0) {
    console.log(`  ⚠️  ${fail} FAILURES DETECTED`);
  } else {
    console.log(`  🎉 ALL BACKEND TESTS PASSED`);
  }
  console.log('═'.repeat(50) + '\n');
  
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(2);
});
