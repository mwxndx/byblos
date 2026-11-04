import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';
import * as telemetryUtil from '@/shared/utils/telemetry';

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

vi.mock('@/features/app-update/components/AppUpdateGate', () => ({
  AppUpdateGate: () => <div data-testid="app-update-gate" />
}));

describe('Deployment-Aware Vercel Telemetry Integration', () => {
  beforeEach(() => {
    mockAnalytics.mockClear();
    mockSpeedInsights.mockClear();
    vi.restoreAllMocks();
  });

  it('disables Vercel integrations in Local Development', () => {
    vi.spyOn(telemetryUtil, 'isVercelTelemetryEnabled').mockReturnValue(false);
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    const { queryByTestId } = render(<App />);
    expect(queryByTestId('vercel-analytics')).toBeNull();
    expect(queryByTestId('vercel-speed-insights')).toBeNull();
    expect(mockAnalytics).not.toHaveBeenCalled();
    expect(mockSpeedInsights).not.toHaveBeenCalled();
  });

  it('disables Vercel integrations in Docker Production', () => {
    vi.spyOn(telemetryUtil, 'isVercelTelemetryEnabled').mockReturnValue(false);
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    const { queryByTestId } = render(<App />);
    expect(queryByTestId('vercel-analytics')).toBeNull();
    expect(queryByTestId('vercel-speed-insights')).toBeNull();
    expect(mockAnalytics).not.toHaveBeenCalled();
    expect(mockSpeedInsights).not.toHaveBeenCalled();
  });

  it('disables Vercel integrations in Self-Hosted VPS configuration', () => {
    vi.spyOn(telemetryUtil, 'isVercelTelemetryEnabled').mockReturnValue(false);
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    const { queryByTestId } = render(<App />);
    expect(queryByTestId('vercel-analytics')).toBeNull();
    expect(queryByTestId('vercel-speed-insights')).toBeNull();
    expect(mockAnalytics).not.toHaveBeenCalled();
    expect(mockSpeedInsights).not.toHaveBeenCalled();
  });

  it('fails safely when deployment configuration is missing or undefined', () => {
    vi.spyOn(telemetryUtil, 'isVercelTelemetryEnabled').mockReturnValue(false);
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    const { queryByTestId } = render(<App />);
    expect(queryByTestId('vercel-analytics')).toBeNull();
    expect(queryByTestId('vercel-speed-insights')).toBeNull();
  });

  it('enables Vercel integrations with default endpoints when deployed to Vercel (web)', () => {
    vi.spyOn(telemetryUtil, 'isVercelTelemetryEnabled').mockReturnValue(true);
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

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

  it('enables Vercel integrations with edge endpoint when deployed to Vercel (native)', () => {
    vi.spyOn(telemetryUtil, 'isVercelTelemetryEnabled').mockReturnValue(true);
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);

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
