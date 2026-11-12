import { StorageAdapter } from './types';
import { storage as capacitorStorage } from '../storage/storage';
import { isNativeApp } from '../navigation/mobileApp';

class NativeStorageAdapter implements StorageAdapter {
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

class WebLocalStorageAdapter implements StorageAdapter {
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
    } catch {
      /* ignore localStorage quota/availability errors */
    }
    return Promise.resolve();
  }
  removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  }
  clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
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
