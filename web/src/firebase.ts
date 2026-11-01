const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)

let firebaseAppPromise: Promise<import('firebase/app').FirebaseApp> | undefined

async function getFirebaseApp() {
  if (!isFirebaseConfigured) throw new Error('Firebase web configuration is missing')

  firebaseAppPromise ??= import('firebase/app').then(({ getApps, initializeApp }) => getApps()[0] ?? initializeApp(config))
  return firebaseAppPromise
}

export async function getFirebaseAuth() {
  const [app, authSdk] = await Promise.all([getFirebaseApp(), import('firebase/auth')])

  return {
    auth: authSdk.getAuth(app),
    onAuthStateChanged: authSdk.onAuthStateChanged,
    GoogleAuthProvider: authSdk.GoogleAuthProvider,
    signInWithPopup: authSdk.signInWithPopup,
    signOut: authSdk.signOut,
  }
}

export async function getFirebaseFirestore() {
  const [app, firestoreSdk] = await Promise.all([getFirebaseApp(), import('firebase/firestore')])
  const { addDoc, collection, getDocs, getFirestore, query, serverTimestamp, where } = firestoreSdk
  return { firestore: getFirestore(app), addDoc, collection, getDocs, query, serverTimestamp, where }
}
