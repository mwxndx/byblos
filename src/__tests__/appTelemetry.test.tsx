import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';

// Mock child components and hooks to isolate App telemetry integration
vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />
}));

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => <div data-testid="vercel-speed-insights" />
}));

vi.mock('@/infrastructure/navigation/mobileApp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/navigation/mobileApp')>();
  return {
    ...actual,
    isNativeApp: vi.fn(() => false)
  };
});

vi.mock('@/shared/utils/modalBackHandler', () => ({
  useAndroidBackHandler: vi.fn(),
  registerNavigationDelegate: vi.fn()
}));

vi.mock('@/infrastructure/navigation/deepLinkHandler', () => ({
  useNativeDeepLinkHandler: vi.fn()
}));

vi.mock('@/features/pwa/InstallPrompt', () => ({
  InstallPrompt: () => <div data-testid="install-prompt" />
}));

describe('App Vercel Telemetry Integration', () => {
  it('renders Analytics and SpeedInsights components on web platforms', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('vercel-analytics')).toBeDefined();
    expect(getByTestId('vercel-speed-insights')).toBeDefined();
  });
});
