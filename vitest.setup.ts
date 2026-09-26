// Global Vitest setup, loaded once before every test file (see the `test.setupFiles`
// entry in vite.config.ts). This file was referenced by that config but never
// actually existed, which meant `npm run test` / `npm run test:coverage`
// could never run a single test in this project — every run failed at
// startup with "Cannot find module .../vitest.setup.ts" before collecting
// any tests.
import '@testing-library/jest-dom/vitest';

// This project runs Vitest with `globals: false`, so @testing-library/react
// can't auto-register its between-test cleanup (that hooks the global
// afterEach). Without this, rendered components leak into the next test and
// queries fail with "Found multiple elements". Register cleanup explicitly.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
