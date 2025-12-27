import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration uses environment variables if available, otherwise falls back to placeholders.
// To make the app fully functional with real Firebase Auth, provide these values in your environment.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDOCAbC123dEfG456hIj789-DUMMY-KEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "your-app.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "your-app",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "your-app.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app); // We keep this exported just in case, but will use MongoDB for data.
console.log("Firebase API Key Present:", !!process.env.FIREBASE_API_KEY);
export const isFirebaseConfigured = !!process.env.FIREBASE_API_KEY && process.env.FIREBASE_API_KEY !== "AIzaSyDOCAbC123dEfG456hIj789-DUMMY-KEY";