import { StorageAdapter } from './types';
import { storage as capacitorStorage } from '../storage/storage';
import { isNativeApp } from '../navigation/mobileApp';

export class NativeStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return await capacitorStorage.get(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    await capacitorStorage.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    await capacitorStorage.remove(key);
  }
  async clear(): Promise<void> {
    await capacitorStorage.clear();
  }
}

export class WebLocalStorageAdapter implements StorageAdapter {
  getItem(key: string): Promise<string | null> {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  }
  setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[WebLocalStorageAdapter] Failed to set item:', e);
    }
    return Promise.resolve();
  }
  removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[WebLocalStorageAdapter] Failed to remove item:', e);
    }
    return Promise.resolve();
  }
  clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[WebLocalStorageAdapter] Failed to clear:', e);
    }
    return Promise.resolve();
  }
}

export class WebSessionStorageAdapter implements StorageAdapter {
  getItem(key: string): Promise<string | null> {
    try {
      return Promise.resolve(sessionStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  }
  setItem(key: string, value: string): Promise<void> {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn('[WebSessionStorageAdapter] Failed to set item:', e);
    }
    return Promise.resolve();
  }
  removeItem(key: string): Promise<void> {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('[WebSessionStorageAdapter] Failed to remove item:', e);
    }
    return Promise.resolve();
  }
  clear(): Promise<void> {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('[WebSessionStorageAdapter] Failed to clear:', e);
    }
    return Promise.resolve();
  }
}

export const createDefaultStorageAdapter = (): StorageAdapter => {
  if (isNativeApp()) {
    return new NativeStorageAdapter();
  }
  return new WebLocalStorageAdapter();
};
