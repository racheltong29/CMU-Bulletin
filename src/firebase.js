// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;

if (!firebaseApiKey) {
  throw new Error("VITE_FIREBASE_API_KEY is not defined. Please check your .env.local file.");
}

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: "cmu-bulletin.firebaseapp.com",
  databaseURL: "https://cmu-bulletin-default-rtdb.firebaseio.com",
  projectId: "cmu-bulletin",
  storageBucket: "cmu-bulletin.firebasestorage.app",
  messagingSenderId: "905377187225",
  appId: "1:905377187225:web:75a2a9e62922a948c93f08",
  measurementId: "G-5ZD2QBFJZJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export { app, auth, db, storage };
