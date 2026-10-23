import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';
import * as appVersionService from '../../services/appVersionService';
import * as modalBackHandler from '@/shared/utils/modalBackHandler';
import { AppUpdateGate } from '../AppUpdateGate';

vi.mock('@/infrastructure/navigation/mobileApp', () => ({
  isNativeApp: vi.fn(),
}));

vi.mock('../../services/appVersionService', () => ({
  checkAppVersion: vi.fn(),
  openPlayStore: vi.fn(),
}));

vi.mock('@/shared/utils/modalBackHandler', () => ({
  registerModalDismiss: vi.fn(() => vi.fn()),
}));

describe('AppUpdateGate Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders nothing on web platforms', () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    const { container } = render(<AppUpdateGate />);

    expect(container.firstChild).toBeNull();
    expect(appVersionService.checkAppVersion).not.toHaveBeenCalled();
  });

  test('renders nothing when update is not required', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);
    vi.mocked(appVersionService.checkAppVersion).mockResolvedValue({
      isSupported: true,
      updateRequired: false,
      installedVersionCode: 67,
      installedVersionName: '1.0.67',
      policy: null,
    });

    const { container } = render(<AppUpdateGate />);

    await waitFor(() => {
      expect(appVersionService.checkAppVersion).toHaveBeenCalled();
    });

    expect(container.firstChild).toBeNull();
    expect(modalBackHandler.registerModalDismiss).not.toHaveBeenCalled();
  });

  test('renders full-screen blocking modal when update is required and intercepts back button', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);
    vi.mocked(appVersionService.checkAppVersion).mockResolvedValue({
      isSupported: false,
      updateRequired: true,
      installedVersionCode: 66,
      installedVersionName: '1.0.66',
      policy: {
        platform: 'android',
        minAndroidVersionCode: 67,
        latestAndroidVersionCode: 67,
        latestVersionName: '1.0.67',
        forceUpdate: true,
        storeUrl: 'market://details?id=space.bybloshq.app',
        webStoreUrl: 'https://play.google.com/store/apps/details?id=space.bybloshq.app',
        releaseNotes: ['Important security updates', 'Faster Mzigo tracking'],
      },
    });

    render(<AppUpdateGate />);

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('New Version Available')).toBeInTheDocument();
    expect(screen.getByText('1.0.67')).toBeInTheDocument();
    expect(screen.getByText('Important security updates')).toBeInTheDocument();
    expect(screen.getByText('Faster Mzigo tracking')).toBeInTheDocument();

    // Verify back button interceptor was registered to prevent bypass
    expect(modalBackHandler.registerModalDismiss).toHaveBeenCalled();

    // Verify clicking "Update on Google Play" triggers store redirect
    const updateButton = screen.getByRole('button', { name: /update on google play/i });
    fireEvent.click(updateButton);

    expect(appVersionService.openPlayStore).toHaveBeenCalledWith('market://details?id=space.bybloshq.app');
  });
});
