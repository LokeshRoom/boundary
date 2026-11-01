const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)

export async function getFirebaseAuth() {
  if (!isFirebaseConfigured) throw new Error('Firebase web configuration is missing')

  const [{ getApps, initializeApp }, authSdk] = await Promise.all([import('firebase/app'), import('firebase/auth')])
  const app = getApps()[0] ?? initializeApp(config)

  return {
    auth: authSdk.getAuth(app),
    onAuthStateChanged: authSdk.onAuthStateChanged,
    GoogleAuthProvider: authSdk.GoogleAuthProvider,
    signInWithPopup: authSdk.signInWithPopup,
    signOut: authSdk.signOut,
  }
}
