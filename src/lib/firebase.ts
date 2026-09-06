import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Handle dynamic config for AI Studio vs GitHub/Vercel Deployments
// When deployed elsewhere, use standard Vite environment variables.

const firebaseConfig = {
  apiKey: "AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE",
  authDomain: "gen-lang-client-0616065043.firebaseapp.com",
  projectId: "gen-lang-client-0616065043",
  storageBucket: "gen-lang-client-0616065043.firebasestorage.app",
  messagingSenderId: "450686107760",
  appId: "1:450686107760:web:ee4b53ae0ccd18c90734b5",
  firestoreDatabaseId: "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
// Basic profile scopes are included by default
// Removed Gmail scope as it's not needed for authentication and requires additional OAuth verification

// Cache the access token in memory.
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const signInWithGoogle = async () => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return result;
  } catch (error: any) {
    console.error('Sign in error:', error);
    // Provide more helpful error messages
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed before completing.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized for Google Sign-In. Please contact support.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = () => cachedAccessToken;

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
};
