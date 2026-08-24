import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, updateDoc, onSnapshot, writeBatch, serverTimestamp, limit } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase with trolycvp project configuration
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics when supported in the browser
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    console.debug("Firebase Analytics is not supported in this environment:", err);
  });
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Target Connected App & Database Memory Bridge
export const CONNECTED_APP_ID = "000a18f3-b782-4432-ad25-82245f95e3a3";
export const CONNECTED_APP_URL = "https://ai.studio/apps/000a18f3-b782-4432-ad25-82245f95e3a3";
export const CONNECTED_APP_NAME = "Hệ thống Trợ lý Tham mưu & Cơ sở Dữ liệu Trung tâm";

// Target Google Drive Folder configuration
export const TARGET_DRIVE_FOLDER_ID = "1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY";
export const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY";

// Token management with session persistence
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem('gdrive_access_token') : null;
let isSigningIn = false;

export const loginWithGoogle = async (): Promise<{ user: FirebaseUser; accessToken: string | null }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gdrive_access_token', credential.accessToken);
      }
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const requestDriveAccess = async (): Promise<string | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gdrive_access_token', credential.accessToken);
      }
      return cachedAccessToken;
    }
  } catch (err) {
    console.error("Google Drive access request error:", err);
  }
  return null;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('gdrive_access_token');
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('gdrive_access_token', token);
    } else {
      sessionStorage.removeItem('gdrive_access_token');
    }
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.debug("Sign out error:", err);
  }
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('gdrive_access_token');
    sessionStorage.removeItem('trolycvp_user');
    localStorage.removeItem('trolycvp_user');
  }
};

export { app, analytics, auth, db, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, updateDoc, onSnapshot, writeBatch, serverTimestamp, limit };
