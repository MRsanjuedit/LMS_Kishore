import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '');
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : '');
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

function getApp(): FirebaseApp {
  if (!apiKey || !projectId || !appId) {
    console.error(
      'Missing Firebase env vars. Required: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID'
    );
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

const app = getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export default app;
