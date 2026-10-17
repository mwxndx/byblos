import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';

const mockAnalytics = vi.fn();
const mockSpeedInsights = vi.fn();

// Mock child components and hooks to isolate App telemetry integration
vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: unknown) => {
    mockAnalytics(props);
    return <div data-testid="vercel-analytics" />;
  }
}));

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: (props: unknown) => {
    mockSpeedInsights(props);
    return <div data-testid="vercel-speed-insights" />;
  }
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
  it('renders Analytics and SpeedInsights components with default endpoints on web platforms', () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);
    mockAnalytics.mockClear();
    mockSpeedInsights.mockClear();

    const { getByTestId } = render(<App />);
    expect(getByTestId('vercel-analytics')).toBeDefined();
    expect(getByTestId('vercel-speed-insights')).toBeDefined();

    expect(mockAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: undefined })
    );
    expect(mockSpeedInsights).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: undefined })
    );
  });

  it('renders Analytics and SpeedInsights components with production edge endpoint on native apps', () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);
    mockAnalytics.mockClear();
    mockSpeedInsights.mockClear();

    const { getByTestId } = render(<App />);
    expect(getByTestId('vercel-analytics')).toBeDefined();
    expect(getByTestId('vercel-speed-insights')).toBeDefined();

    expect(mockAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://byblosafrica.site/_vercel/insights' })
    );
    expect(mockSpeedInsights).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://byblosafrica.site/_vercel/speed-insights/vitals' })
    );
  });
});
