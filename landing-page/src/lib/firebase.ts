import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYJ0Ktu8otBPMYBI4i4DMGJxLu1_bzd0c",
  authDomain: "rewind-519f0.firebaseapp.com",
  projectId: "rewind-519f0",
  storageBucket: "rewind-519f0.firebasestorage.app",
  messagingSenderId: "743702437264",
  appId: "1:743702437264:web:575f3ca75cba5efd66e715"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
