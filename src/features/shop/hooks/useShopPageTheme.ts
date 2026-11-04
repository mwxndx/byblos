import { useCallback, useEffect, useState } from 'react';

export type ShopPageTheme = 'system' | 'light' | 'dark';

export const STORAGE_KEY = 'byblos-shop-page-theme';

export function getSystemIsDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveShopTheme(pref: ShopPageTheme): 'light' | 'dark' {
  if (pref === 'system') return getSystemIsDark() ? 'dark' : 'light';
  return pref;
}

export function useShopPageTheme() {
  const [theme, setThemeState] = useState<ShopPageTheme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ShopPageTheme) || 'system';
  });

  const setTheme = useCallback((next: ShopPageTheme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const resolved = resolveShopTheme(theme);

  // Listen to OS changes when on "system"
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('system'); // re-render to recompute
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme, resolved };
}

