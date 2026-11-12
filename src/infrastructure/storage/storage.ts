import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from '../navigation/mobileApp';

export const BYBLOS_AUTH_KEYS = {
  ACTIVE_ROLE: 'byblos.auth.active_role',
  SESSION: 'byblos.auth.session',
  TOKEN: 'byblos.auth.token',
  REFRESH_TOKEN: 'byblos.auth.refresh_token',
  CSRF_TOKEN: 'byblos.auth.csrf_token',
} as const;

const LEGACY_AUTH_KEYS = [
  'buyer_token_legacy',
  'buyer_session_legacy',
  'seller_token_legacy',
  'seller_session_legacy',
  'creator_token_legacy',
  'creator_session_legacy',
  'admin_token_legacy',
  'admin_authenticated',
  'marketing_token_legacy',
  'marketing_session_legacy',
  'logistics_token_legacy',
  'mzigoLogisticsToken',
] as const;

async function getSecureStorage() {
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  return SecureStorage;
}

export const storage = {
  async get(key: string): Promise<string | null> {
    if (!isNativeApp()) {
      try {
        return sessionStorage.getItem(key) || localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    // 1. Try native Keystore-backed SecureStorage first
    try {
      const SecureStorage = await getSecureStorage();
      const val = await SecureStorage.getItem(key);
      if (val !== null && val !== undefined) {
        return String(val);
      }
    } catch {
      // Fall through to Preferences migration check
    }

    // 2. Migration fallback: Check Preferences for previously stored tokens
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null && value !== undefined) {
        try {
          const SecureStorage = await getSecureStorage();
          await SecureStorage.setItem(key, value);
          await Preferences.remove({ key });
        } catch {
          // ignore migration write failure
        }
        return value;
      }
    } catch {
      // Fall through to localStorage fallback
    }

    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (!isNativeApp()) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore localstorage error */
      }
      return;
    }

    // On native Android/iOS, write exclusively to Keystore-backed SecureStorage
    try {
      const SecureStorage = await getSecureStorage();
      await SecureStorage.setItem(key, value);
      await Preferences.remove({ key }).catch(() => {});
    } catch {
      await Preferences.set({ key, value }).catch(() => {});
    }
  },

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }

    if (!isNativeApp()) return;

    await Promise.all([
      getSecureStorage().then((s) => s.removeItem(key)).catch(() => {}),
      Preferences.remove({ key }).catch(() => {}),
    ]);
  },

  async clear(): Promise<void> {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }

    if (!isNativeApp()) return;

    await Promise.all([
      getSecureStorage().then((s) => s.clear()).catch(() => {}),
      Preferences.clear().catch(() => {}),
    ]);
  }
};

export const authStorage = {
  async purgeLegacyAndInactiveKeys(activeRole?: string): Promise<void> {
    const removalPromises: Promise<void>[] = [];

    for (const key of LEGACY_AUTH_KEYS) {
      removalPromises.push(storage.remove(key));
    }

    const allRoles = ['buyer', 'seller', 'creator', 'admin', 'marketing', 'logistics'];
    for (const r of allRoles) {
      if (r !== activeRole) {
        removalPromises.push(storage.remove(`${r}Token`));
        removalPromises.push(storage.remove(`${r}RefreshToken`));
        removalPromises.push(storage.remove(`${r}SessionActive`));
      }
    }

    await Promise.all(removalPromises);
  },

  async setActiveRole(role: string): Promise<void> {
    await storage.set(BYBLOS_AUTH_KEYS.ACTIVE_ROLE, role);
  },

  async getActiveRole(): Promise<string | null> {
    return storage.get(BYBLOS_AUTH_KEYS.ACTIVE_ROLE);
  },

  async setSessionData(session: unknown): Promise<void> {
    const serialized = JSON.stringify(session);
    await storage.set(BYBLOS_AUTH_KEYS.SESSION, serialized);
  },

  async getSessionData<T = unknown>(): Promise<T | null> {
    const raw = await storage.get(BYBLOS_AUTH_KEYS.SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async clearAuth(): Promise<void> {
    await Promise.all([
      storage.remove(BYBLOS_AUTH_KEYS.ACTIVE_ROLE),
      storage.remove(BYBLOS_AUTH_KEYS.SESSION),
      storage.remove(BYBLOS_AUTH_KEYS.TOKEN),
      storage.remove(BYBLOS_AUTH_KEYS.REFRESH_TOKEN),
      storage.remove(BYBLOS_AUTH_KEYS.CSRF_TOKEN),
      this.purgeLegacyAndInactiveKeys(),
    ]);
  }
};
