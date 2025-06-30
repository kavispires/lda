import { type FirebaseApp, initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getFirestore,
  type Firestore,
  setDoc,
  collection,
  updateDoc,
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  type Auth,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth';

const buildKey = () => {
  return [
    import.meta.env.VITE_FIREBASE_A,
    import.meta.env.VITE_FIREBASE_P,
    import.meta.env.VITE_FIREBASE_I,
  ].join('');
};

const firebaseConfig = {
  apiKey: buildKey(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_API_ID,
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
export async function signOut(callback?: () => void): Promise<void> {
  return auth.signOut().then(() => callback?.());
}

/**
 * Creates a new document in the specified collection with the provided data.
 * @param collectionPath - The path of the collection where the document will be created.
 * @param data - The data to be stored in the document.
 * @returns A promise that resolves to the created document with an additional `id` field.
 */
export async function createDoc<TData = Record<string, any>>(
  collectionPath: string,
  data: TData,
): Promise<TData & { id: string }> {
  const docRef = doc(collection(firestore, collectionPath));
  console.log(`%cCreating a document on ${collectionPath} on firestore`, 'color: #f0f');
  const dataWithId = { ...data, id: docRef.id };
  await setDoc(docRef, dataWithId);
  return dataWithId;
}

export async function createDocWithId<TData = Record<string, any>>(
  collectionPath: string,
  docId: string,
  data: TData,
): Promise<TData & { id: string }> {
  const docRef = doc(collection(firestore, collectionPath), docId);
  console.log(`%cCreating a document on ${collectionPath} on firestore`, 'color: #f0f');
  const dataWithId = { ...data, id: docRef.id };
  await setDoc(docRef, dataWithId);
  return dataWithId;
}

/**
 * Retrieves a document from Firestore using the specified path and document ID.
 * @param path - The path to the collection containing the document.
 * @param docId - The ID of the document to retrieve.
 * @returns A promise that resolves to the data of the retrieved document.
 */
export async function getDocQueryFunction<TQueryFnData>(path: string, docId: string) {
  console.log(`%cQuerying ${path}/${docId} from firestore`, 'color: #f0f');
  const docRef = doc(firestore, path, docId);
  const querySnapshot = await getDoc(docRef);
  return (querySnapshot.data() ?? {}) as TQueryFnData;
}

/**
 * Updates a document in Firestore using the provided path, document ID, and data.
 * @param path - The path to the collection containing the document.
 * @param docId - The ID of the document to update.
 * @param data - The data to update the document with.
 * @returns A Promise that resolves when the document is successfully updated.
 */
export async function updateDocQueryFunction<TData>(path: string, docId: string, data: TData) {
  console.log(`%cUpdating ${path}/${docId} on firestore`, 'color: #f0f');
  const docRef = doc(firestore, path, docId);
  return updateDoc(docRef, data as any); // TODO: Fix this any
}

/**
 * Deletes a document from Firestore at the specified path and document ID.
 * @param path - The path to the collection containing the document.
 * @param docId - The ID of the document to delete.
 * @returns A promise that resolves when the document is successfully deleted.
 */
export async function deleteDocQueryFunction(path: string, docId: string) {
  console.log(`%cDeleting doc ${path}/${docId} on firestore`, 'color: #f00');
  const docRef = doc(firestore, path, docId);
  return deleteDoc(docRef);
}
