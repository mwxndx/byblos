import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applyResolvedTheme,
  readScopePref,
  resolveTheme,
  writeScopePref,
} from '../useAppTheme';

describe('useAppTheme & Theme Synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.head.innerHTML = '<meta name="theme-color" content="#000000" id="theme-color-meta">';
  });

  it('resolves explicit light and dark themes accurately', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('applies light theme with pure white #ffffff status bar and html attributes', () => {
    applyResolvedTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#ffffff');
  });

  it('applies dark theme with pure black #000000 status bar and html attributes', () => {
    applyResolvedTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#000000');
  });

  it('synchronizes all scopes when writeScopePref is called and dispatches byblos-theme-change', () => {
    const listener = vi.fn();
    window.addEventListener('byblos-theme-change', listener);

    writeScopePref('seller', 'light');

    expect(localStorage.getItem('byblos-app-theme')).toBe('light');
    expect(localStorage.getItem('byblos-theme-seller')).toBe('light');
    expect(localStorage.getItem('byblos-theme-buyer')).toBe('light');
    expect(localStorage.getItem('byblos-theme-creator')).toBe('light');
    expect(localStorage.getItem('byblos-theme-shop')).toBe('light');
    expect(localStorage.getItem('byblos-theme-default')).toBe('light');

    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.theme).toBe('light');

    window.removeEventListener('byblos-theme-change', listener);
  });

  it('reads scope preference with fallback to legacy global key', () => {
    expect(readScopePref('buyer')).toBe('system');

    localStorage.setItem('byblos-app-theme', 'dark');
    expect(readScopePref('buyer')).toBe('dark');

    localStorage.setItem('byblos-theme-buyer', 'light');
    expect(readScopePref('buyer')).toBe('light');
  });
});
