import { describe, it, expect } from 'vitest';
import React from 'react';
import { safeLazy } from './safeLazy';

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
});
