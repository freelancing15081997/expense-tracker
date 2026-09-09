import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE',
  authDomain: 'gen-lang-client-0616065043.firebaseapp.com',
  projectId: 'gen-lang-client-0616065043',
  storageBucket: 'gen-lang-client-0616065043.firebasestorage.app',
  messagingSenderId: '450686107760',
  appId: '1:450686107760:web:ee4b53ae0ccd18c90734b5',
};

const DATABASE_ID = 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, DATABASE_ID);

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed before completing.');
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized for Google Sign-In.');
    }
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
}

export async function getAccessToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
};
