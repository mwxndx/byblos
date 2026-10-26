import { useCallback, useEffect, useState } from 'react';

export type AppTheme = 'system' | 'light' | 'dark';
export type ThemeScope = 'buyer' | 'seller' | 'creator' | 'shop' | 'default';

const LEGACY_KEY = 'byblos-app-theme';
const keyFor = (scope: ThemeScope) => `byblos-theme-${scope}`;
const KNOWN_SCOPES: ThemeScope[] = ['default', 'buyer', 'seller', 'creator', 'shop'];

function getSystemIsDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: AppTheme): 'light' | 'dark' {
  if (pref === 'system') return getSystemIsDark() ? 'dark' : 'light';
  return pref;
}

/** Apply a resolved theme to <html> — the single place that touches the class/attr. */
export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('data-theme', resolved);
  el.classList.toggle('dark', resolved === 'dark');
  el.classList.toggle('light', resolved === 'light');

  const themeColor = resolved === 'light' ? '#ffffff' : '#000000';
  const metaThemeColor = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeColor);
  }

  // Update all theme-color meta tags so Android and mobile browsers render the matching status bar icon tint
  const allThemeMetas = document.querySelectorAll('meta[name="theme-color"]');
  allThemeMetas.forEach((meta) => {
    meta.setAttribute('content', themeColor);
  });

  // iOS status bar text style: 'default' = dark text (black time/battery for light backgrounds),
  // 'black-translucent' = light text (white time/battery for dark backgrounds)
  const statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusMeta) {
    statusMeta.setAttribute('content', resolved === 'light' ? 'default' : 'black-translucent');
  }

  // Keep the native (Android) keyboard accessory bar in step with the app theme,
  // rather than the static Keyboard.style in capacitor.config.ts. No-op on web.
  void syncNativeKeyboardStyle(resolved);
}

/**
 * Match the native keyboard's light/dark accessory bar to the resolved app
 * theme. Lazily loads the Capacitor plugin so web builds never pull it in, and
 * silently no-ops when not running in the native shell.
 */
async function syncNativeKeyboardStyle(resolved: 'light' | 'dark'): Promise<void> {
  try {
    const { isNativeApp } = await import('@/infrastructure/navigation/mobileApp');
    if (!isNativeApp()) return;
    const { Keyboard, KeyboardStyle } = await import('@capacitor/keyboard');
    await Keyboard.setStyle({ style: resolved === 'dark' ? KeyboardStyle.Dark : KeyboardStyle.Light });
  } catch {
    // Web build or plugin unavailable — nothing to sync.
  }
}

function isAppTheme(v: unknown): v is AppTheme {
  return v === 'system' || v === 'light' || v === 'dark';
}

/** Read a scope's preference, seeding from the legacy global key, defaulting to 'system'. */
export function readScopePref(scope: ThemeScope): AppTheme {
  try {
    const v = localStorage.getItem(keyFor(scope));
    if (isAppTheme(v)) return v;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (isAppTheme(legacy)) return legacy;
  } catch { /* localStorage unavailable */ }
  return 'system';
}

export function writeScopePref(scope: ThemeScope, pref: AppTheme): void {
  try {
    localStorage.setItem(LEGACY_KEY, pref);
    KNOWN_SCOPES.forEach((s) => {
      localStorage.setItem(keyFor(s), pref);
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('byblos-theme-change', { detail: { theme: pref, scope } }));
    }
  } catch { /* ignore */ }
}

/**
 * Read/write one scope's theme preference. Synchronizes with global app theme
 * across all scopes (buyer, seller, creator, shop, default).
 */
export function useThemeScope(scope: ThemeScope): { theme: AppTheme; setTheme: (t: AppTheme) => void } {
  const [theme, setThemeState] = useState<AppTheme>(() => readScopePref(scope));
  const [, setSystemTick] = useState(0);

  useEffect(() => {
    applyResolvedTheme(resolveTheme(theme));

    if (typeof window === 'undefined') return;

    // Cross-tab theme sync handler
    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === keyFor(scope) || e.key === LEGACY_KEY) && isAppTheme(e.newValue)) {
        setThemeState(e.newValue);
        applyResolvedTheme(resolveTheme(e.newValue));
      }
    };

    // In-window cross-scope theme sync handler
    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: AppTheme }>;
      if (custom.detail?.theme && isAppTheme(custom.detail.theme)) {
        setThemeState(custom.detail.theme);
        applyResolvedTheme(resolveTheme(custom.detail.theme));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('byblos-theme-change', handleThemeChange);

    if (theme !== 'system') {
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('byblos-theme-change', handleThemeChange);
      };
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyResolvedTheme(mq.matches ? 'dark' : 'light');
      setSystemTick((prev) => prev + 1);
    };

    mq.addEventListener('change', handler);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('byblos-theme-change', handleThemeChange);
      mq.removeEventListener('change', handler);
    };
  }, [theme, scope]);

  const setTheme = useCallback((next: AppTheme) => {
    writeScopePref(scope, next);
    setThemeState(next);
    applyResolvedTheme(resolveTheme(next));
  }, [scope]);

  return { theme, setTheme };
}

/** Back-compat: existing callers act on the default (non-dashboard) scope. */
export function useAppTheme() {
  return useThemeScope('default');
}
