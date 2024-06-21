import { FirebaseApp, initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  UserCredential,
} from "firebase/auth";

const buildKey = () => {
  return [
    process.env.REACT_APP_FIREBASE_A,
    process.env.REACT_APP_FIREBASE_P,
    process.env.REACT_APP_FIREBASE_I,
  ].join("");
};

const firebaseConfig = {
  apiKey: buildKey(),
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_API_ID,
};

const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);

export const analytics = getAnalytics(firebaseApp);
export const auth: Auth = getAuth(firebaseApp);
export const firestore: Firestore = getFirestore(firebaseApp);

export default firebaseApp;

/**
 * Sign up user via email through firebase auth
 * @param email - the email of the user to sign up
 * @param password - the password of the user to sign up
 * @returns - the user credential
 */
export function signUp(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in user via email through firebase auth
 * @param email - the email of the user to sign in
 * @param password - the password of the user to sign in
 * @returns - the user credential
 */
export function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out current user
 * @returns - a promise that resolves when the user is signed out
 */
export async function signOut(callback?: Function): Promise<void> {
  return auth.signOut().then(() => callback?.());
}
