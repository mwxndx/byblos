import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { isNativeApp } from './infrastructure/navigation/mobileApp';
import { registerFirebaseServiceWorker } from './features/notifications/webPush';
import { getSafeSessionItem, setSafeSessionItem } from './shared/utils/safeLazy';
import './styles/fonts.css';
import './app.css';

// Listen for Vite chunk preload errors across web sessions (e.g. after deployments or network stutters on iOS Safari).
if (!isNativeApp() && typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    // If supported, prevent uncaught error bubbling
    event.preventDefault?.();
    const lastReload = getSafeSessionItem('last_chunk_reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      setSafeSessionItem('last_chunk_reload', now.toString());
      console.warn('[Vite] Preload error detected. Refreshing page for latest deployment chunks...');
      window.location.reload();
    }
  });
}

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);

root.render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// Register the FCM service worker for web (non-native) sessions. This enables
// background web push and satisfies one of Chrome's PWA install criteria.
// Native apps use Capacitor push, not a service worker.
if (!isNativeApp()) {
  void registerFirebaseServiceWorker();
}
