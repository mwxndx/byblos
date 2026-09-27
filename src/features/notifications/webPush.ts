import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';

// Firebase's public web config — client-safe by design (ships in the bundle),
// distinct from the server-side FIREBASE_SERVICE_ACCOUNT secret. Same Firebase
// project as native push. Sourced from env, never hardcoded.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

export function isWebPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.projectId
    && firebaseConfig.messagingSenderId
    && firebaseConfig.appId
    && vapidKey
  );
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

let appInstance: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = getApps()[0] ?? initializeApp(firebaseConfig as Record<string, string>);
  }
  return appInstance;
}

// Register the generated FCM service worker. Also satisfies one of Chrome's
// PWA install-eligibility criteria. Safe to call repeatedly (register is
// idempotent per scope). Called on app boot for web sessions.
export async function registerFirebaseServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (err) {
    console.warn('[WebPush] Service worker registration failed', err);
    return null;
  }
}

// Request notification permission and return an FCM web token, or null if
// unsupported, unconfigured, or the user denied permission.
export async function getWebPushToken(): Promise<string | null> {
  if (!isWebPushSupported() || !isWebPushConfigured()) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await registerFirebaseServiceWorker();
    if (!registration) return null;

    const messaging: Messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    return token || null;
  } catch (err) {
    console.warn('[WebPush] Failed to obtain web push token', err);
    return null;
  }
}
