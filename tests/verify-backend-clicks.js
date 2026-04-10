
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, deleteDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAs-K4-678-FakeKey", // This would be the real key in the actual run
    authDomain: "rewind-player.firebaseapp.com",
    projectId: "rewind-player",
    storageBucket: "rewind-player.appspot.com",
    messagingSenderId: "331885060877",
    appId: "1:331885060877:web:86f68c56cc18e95079a49b"
};

// Use the ENV variables if available
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testBackendClickFlows() {
    console.log("--- SIMULATING BACKEND BUTTON CLICKS ---");
    try {
        await signInWithEmailAndPassword(auth, "test@example.com", "testpassword123");
        const uid = auth.currentUser.uid;
        console.log(`[✓] Auth Click (Login): Success for ${uid}`);

        const testId = "terminal_verify_" + Date.now();
        const docRef = doc(db, `users/${uid}/history`, testId);

        // 1. Simulate "SAVE_OBJECT" Click
        await setDoc(docRef, { 
            title: "Terminal Verification Trace", 
            timestamp: 123, 
            savedAt: Date.now() 
        });
        console.log(`[✓] Sync Click (Save Object): Permitted`);

        // 2. Simulate "DELETE_TRACE" Click
        await deleteDoc(docRef);
        console.log(`[✓] Delete Click (Trash Icon): Permitted`);

        // 3. Verify cleanup
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            console.log(`\x1b[32m[✓] FULL BACKEND LOOP VERIFIED: ALL BUTTON TYPES (CREATE/READ/DELETE) ARE OPERATIONAL.\x1b[0m`);
        }
    } catch (e) {
        console.error(`\x1b[31m[❌] BACKEND FAILURE: ${e.message}\x1b[0m`);
    }
}

testBackendClickFlows();
