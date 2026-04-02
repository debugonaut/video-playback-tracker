import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// REPLACE THESE WITH YOUR OWN FIREBASE CONFIGURATION
// You can get these from your project settings in the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAYJ0Ktu8otBPMYBI4i4DMGJxLu1_bzd0c",
  authDomain: "rewind-519f0.firebaseapp.com",
  projectId: "rewind-519f0",
  storageBucket: "rewind-519f0.firebasestorage.app",
  messagingSenderId: "743702437264",
  appId: "1:743702437264:web:575f3ca75cba5efd66e715"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
