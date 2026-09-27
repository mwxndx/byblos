import { useEffect, useState } from 'react';
import { Download, Plus, Share2, X } from '@/shared/ui/icons';
import { getDevicePlatform, isAppInstalled } from '@/infrastructure/navigation/mobileApp';
import {
  getInstallSnoozeUntil,
  resolveInstallUI,
  snoozeInstallPrompt,
  type InstallUIKind,
} from './installState';

// Chrome's beforeinstallprompt event isn't in the TS DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Suppress re-showing within a single app session after a dismiss, matching
// MembershipGate's module-scoped pattern. The 7-day localStorage snooze
// (installState) handles persistence across sessions.
let dismissedThisSession = false;

export function InstallPrompt() {
  const [kind, setKind] = useState<InstallUIKind>('none');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (dismissedThisSession) return;

    const evaluate = () => setKind(resolveInstallUI({
      platform: getDevicePlatform(),
      installed: isAppInstalled(),
      snoozedUntil: getInstallSnoozeUntil(),
    }));
    evaluate();

    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's default mini-infobar; we render our own button instead.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setKind('none');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    dismissedThisSession = true;
    snoozeInstallPrompt();
    setKind('none');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      /* user dismissed the native dialog */
    } finally {
      setDeferredPrompt(null);
      setKind('none');
    }
  };

  if (kind === 'none') return null;
  // Android: only offer the button once Chrome has actually given us a
  // promptable event; otherwise there's nothing to install.
  if (kind === 'android-button' && !deferredPrompt) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-separator bg-surface-1 px-4 pt-3 text-label shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      style={{ paddingBottom: 'calc(0.75rem + var(--sab, 12px))' }}
      role="dialog"
      aria-label="Install Byblos"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400/15 text-yellow-500">
          <Download size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-label">Install Byblos</p>
          {kind === 'ios-instructions' ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-label-2">
              Tap <Share2 size={13} className="inline text-label" /> Share, then
              <span className="inline-flex items-center gap-0.5 font-medium text-label">
                <Plus size={13} /> Add to Home Screen
              </span>
              to install and get notifications.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-label-2">Add Byblos to your home screen for a faster app and push notifications.</p>
          )}

          {kind === 'android-button' && (
            <button
              type="button"
              onClick={handleInstall}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-300"
            >
              <Download size={15} />
              Install
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1.5 text-label-2 transition hover:bg-white/10 hover:text-label"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
