import { describe, it, expect } from 'vitest';
import React from 'react';
import { safeLazy, isDynamicImportError, getSafeSessionItem, setSafeSessionItem } from './safeLazy';

describe('safeLazy', () => {
  const DummyComponent: React.FC = () => React.createElement('div', null, 'Dummy');

  it('correctly handles ES module default exports', async () => {
    const lazyComponent = safeLazy(() => Promise.resolve({ default: DummyComponent }));
    
    // React.lazy components store their initializer in _payload._result or call the loader function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (lazyComponent as any)._payload;
    const loader = typeof payload === 'function' ? payload : payload?._result;
    
    expect(loader).toBeDefined();
    const result = await loader();
    expect(result).toHaveProperty('default');
    expect(result.default).toBe(DummyComponent);
  });

  it('correctly handles named export mapped directly to component function (e.g. .then(m => m.AdminLoginPage))', async () => {
    // This is the pattern used in admin.routes.tsx, buyer.routes.tsx, and seller.routes.tsx
    const lazyComponent = safeLazy(() => Promise.resolve(DummyComponent));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (lazyComponent as any)._payload;
    const loader = typeof payload === 'function' ? payload : payload?._result;

    expect(loader).toBeDefined();
    const result = await loader();
    expect(result).toBeDefined();
    expect(result).toHaveProperty('default');
    expect(result.default).toBe(DummyComponent);
  });

  it('correctly handles named export wrapped in default object (e.g. .then(m => ({ default: m.Component })))', async () => {
    const lazyComponent = safeLazy(() => Promise.resolve({ default: DummyComponent }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (lazyComponent as any)._payload;
    const loader = typeof payload === 'function' ? payload : payload?._result;

    expect(loader).toBeDefined();
    const result = await loader();
    expect(result).toBeDefined();
    expect(result).toHaveProperty('default');
    expect(result.default).toBe(DummyComponent);
  });

  it('retries transient dynamic import errors before succeeding', async () => {
    let attempts = 0;
    const lazyComponent = safeLazy(
      () => {
        attempts += 1;
        if (attempts < 3) {
          return Promise.reject(new Error('Unable to preload CSS for /assets/ShopPage-abc.css'));
        }
        return Promise.resolve({ default: DummyComponent });
      },
      { retries: 2, retryDelayMs: 0 }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (lazyComponent as any)._payload;
    const loader = typeof payload === 'function' ? payload : payload?._result;

    const result = await loader();
    expect(attempts).toBe(3);
    expect(result.default).toBe(DummyComponent);
  });

  it('does not retry non-chunk errors', async () => {
    let attempts = 0;
    const lazyComponent = safeLazy(
      () => {
        attempts += 1;
        return Promise.reject(new SyntaxError('Unexpected token <'));
      },
      { retries: 2, retryDelayMs: 0 }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (lazyComponent as any)._payload;
    const loader = typeof payload === 'function' ? payload : payload?._result;

    await expect(loader()).rejects.toThrow('Unexpected token <');
    expect(attempts).toBe(1);
  });
});

describe('isDynamicImportError', () => {
  it('detects WebKit iOS Safari "Load failed" TypeError', () => {
    const error = new TypeError('Load failed');
    expect(isDynamicImportError(error)).toBe(true);
  });

  it('detects WebKit "Importing a module script failed"', () => {
    const error = new TypeError('Importing a module script failed.');
    expect(isDynamicImportError(error)).toBe(true);
  });

  it('detects Chromium "Failed to fetch dynamically imported module"', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/Page.js');
    expect(isDynamicImportError(error)).toBe(true);
  });

  it('detects Vite CSS preload errors', () => {
    const error = new Error('Unable to preload CSS for /assets/ShopPage-1234.css');
    expect(isDynamicImportError(error)).toBe(true);
  });

  it('detects NetworkError and generic Failed to fetch errors', () => {
    expect(isDynamicImportError(new Error('Failed to fetch'))).toBe(true);
    expect(isDynamicImportError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
  });

  it('detects generic ChunkLoadError', () => {
    const error = new Error('Loading chunk 42 failed');
    error.name = 'ChunkLoadError';
    expect(isDynamicImportError(error)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isDynamicImportError(null)).toBe(false);
    expect(isDynamicImportError(undefined)).toBe(false);
    expect(isDynamicImportError(new Error('Network response was not ok'))).toBe(false);
    expect(isDynamicImportError(new TypeError('Cannot read properties of undefined'))).toBe(false);
  });
});

describe('getSafeSessionItem and setSafeSessionItem', () => {
  it('reads and writes session storage normally', () => {
    setSafeSessionItem('test_key', 'test_val');
    expect(getSafeSessionItem('test_key')).toBe('test_val');
  });

  it('handles QuotaExceededError / storage exceptions without throwing', () => {
    const originalSetItem = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    };

    expect(() => setSafeSessionItem('test_key', 'val')).not.toThrow();
    window.sessionStorage.setItem = originalSetItem;
  });
});
