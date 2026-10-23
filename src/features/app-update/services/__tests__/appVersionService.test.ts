import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';
import { checkAppVersion, type AppVersionPolicy } from '../appVersionService';

vi.mock('@/infrastructure/navigation/mobileApp', () => ({
  isNativeApp: vi.fn(),
}));

describe('appVersionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns updateRequired: false when running on web / non-native environment', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    const mockFetch = vi.fn();
    const mockGetInfo = vi.fn();

    const status = await checkAppVersion(mockFetch, mockGetInfo);

    expect(status.updateRequired).toBe(false);
    expect(status.isSupported).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGetInfo).not.toHaveBeenCalled();
  });

  test('detects outdated native Android build and sets updateRequired: true', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);

    const mockPolicy: AppVersionPolicy = {
      platform: 'android',
      minAndroidVersionCode: 67,
      latestAndroidVersionCode: 67,
      latestVersionName: '1.0.67',
      forceUpdate: true,
      storeUrl: 'market://details?id=space.bybloshq.app',
      webStoreUrl: 'https://play.google.com/store/apps/details?id=space.bybloshq.app',
      releaseNotes: ['Critical update'],
    };

    const mockFetch = vi.fn().mockResolvedValue(mockPolicy);
    const mockGetInfo = vi.fn().mockResolvedValue({
      name: 'Byblos',
      id: 'space.bybloshq.app',
      build: '66', // Installed version is 66, but required is 67
      version: '1.0.66',
    });

    const status = await checkAppVersion(mockFetch, mockGetInfo);

    expect(status.updateRequired).toBe(true);
    expect(status.isSupported).toBe(false);
    expect(status.installedVersionCode).toBe(66);
    expect(status.policy).toEqual(mockPolicy);
  });

  test('allows supported native Android build to pass without update requirement', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);

    const mockPolicy: AppVersionPolicy = {
      platform: 'android',
      minAndroidVersionCode: 67,
      latestAndroidVersionCode: 67,
      latestVersionName: '1.0.67',
      forceUpdate: true,
      storeUrl: 'market://details?id=space.bybloshq.app',
      webStoreUrl: 'https://play.google.com/store/apps/details?id=space.bybloshq.app',
    };

    const mockFetch = vi.fn().mockResolvedValue(mockPolicy);
    const mockGetInfo = vi.fn().mockResolvedValue({
      name: 'Byblos',
      id: 'space.bybloshq.app',
      build: '67', // Exactly matches required version
      version: '1.0.67',
    });

    const status = await checkAppVersion(mockFetch, mockGetInfo);

    expect(status.updateRequired).toBe(false);
    expect(status.isSupported).toBe(true);
    expect(status.installedVersionCode).toBe(67);
  });

  test('respects forceUpdate: false from policy even if installed build is lower', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);

    const mockPolicy: AppVersionPolicy = {
      platform: 'android',
      minAndroidVersionCode: 67,
      latestAndroidVersionCode: 67,
      latestVersionName: '1.0.67',
      forceUpdate: false, // Update not enforced
      storeUrl: 'market://details?id=space.bybloshq.app',
      webStoreUrl: 'https://play.google.com/store/apps/details?id=space.bybloshq.app',
    };

    const mockFetch = vi.fn().mockResolvedValue(mockPolicy);
    const mockGetInfo = vi.fn().mockResolvedValue({
      name: 'Byblos',
      id: 'space.bybloshq.app',
      build: '66',
      version: '1.0.66',
    });

    const status = await checkAppVersion(mockFetch, mockGetInfo);

    expect(status.updateRequired).toBe(false);
    expect(status.isSupported).toBe(true);
  });

  test('fails open (does not block user) if remote version check throws an error / offline', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockGetInfo = vi.fn().mockResolvedValue({ build: '66', version: '1.0.66' });

    const status = await checkAppVersion(mockFetch, mockGetInfo);

    expect(status.updateRequired).toBe(false);
    expect(status.isSupported).toBe(true);
  });
});
