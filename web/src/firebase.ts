const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
export const isFirebaseAppCheckConfigured = Boolean(appCheckSiteKey)

let firebaseAppPromise: Promise<import('firebase/app').FirebaseApp> | undefined
let firebaseAppCheckPromise: Promise<import('firebase/app-check').AppCheck> | undefined

async function getFirebaseApp() {
  if (!isFirebaseConfigured) throw new Error('Firebase web configuration is missing')

  firebaseAppPromise ??= import('firebase/app').then(({ getApps, initializeApp }) => getApps()[0] ?? initializeApp(config))
  return firebaseAppPromise
}

async function initializeFirebaseAppCheck(app: import('firebase/app').FirebaseApp) {
  if (!appCheckSiteKey) return

  firebaseAppCheckPromise ??= import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  }))
  await firebaseAppCheckPromise
}

export async function getFirebaseAuth() {
  const app = await getFirebaseApp()
  await initializeFirebaseAppCheck(app)
  const authSdk = await import('firebase/auth')

  return {
    auth: authSdk.getAuth(app),
    onAuthStateChanged: authSdk.onAuthStateChanged,
    GoogleAuthProvider: authSdk.GoogleAuthProvider,
    signInWithPopup: authSdk.signInWithPopup,
    signInAnonymously: authSdk.signInAnonymously,
    signOut: authSdk.signOut,
  }
}

export async function getFirebaseFirestore() {
  const app = await getFirebaseApp()
  await initializeFirebaseAppCheck(app)
  const firestoreSdk = await import('firebase/firestore')
  const { addDoc, collection, doc, getDoc, getDocs, getFirestore, increment, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } = firestoreSdk
  return { firestore: getFirestore(app), addDoc, collection, doc, getDoc, getDocs, getFirestore, increment, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch }
}
