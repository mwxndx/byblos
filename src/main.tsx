import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { isNativeApp } from './infrastructure/navigation/mobileApp';
import { registerFirebaseServiceWorker } from './features/notifications/webPush';
import './styles/fonts.css';
import './app.css';

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
