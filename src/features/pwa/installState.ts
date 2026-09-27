// Pure logic for the "install this app" UI. Kept separate from the component so
// the show/hide decision is unit-testable without a DOM.

export type InstallUIKind = 'ios-instructions' | 'android-button' | 'none';

export const INSTALL_SNOOZE_DAYS = 7;
const SNOOZE_KEY = 'byblosInstallPromptSnoozeUntil';

// Decide what (if anything) to show. Mobile-only for now: desktop returns
// 'none' even though desktop Chrome/Edge support beforeinstallprompt.
export function resolveInstallUI(params: {
  platform: 'android' | 'ios' | 'desktop';
  installed: boolean;
  snoozedUntil: number | null;
  now?: number;
}): InstallUIKind {
  const { platform, installed, snoozedUntil, now = Date.now() } = params;
  if (installed) return 'none';
  if (platform === 'desktop') return 'none';
  if (snoozedUntil !== null && now < snoozedUntil) return 'none';
  return platform === 'ios' ? 'ios-instructions' : 'android-button';
}

export function getInstallSnoozeUntil(): number | null {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function snoozeInstallPrompt(days: number = INSTALL_SNOOZE_DAYS): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  } catch {
    /* ignore storage errors (private mode, blocked) */
  }
}
