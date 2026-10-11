import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';
import * as webPush from '@/features/notifications/webPush';
import * as mobileNotifications from '@/features/notifications/utils/mobileNotifications';
import { useIosNotificationPermission } from '../useIosNotificationPermission';

vi.mock('@/infrastructure/navigation/mobileApp');
vi.mock('@/features/notifications/webPush');
vi.mock('@/features/notifications/utils/mobileNotifications');
vi.mock('@/features/auth/services/authSession', () => ({
  getActiveRole: vi.fn().mockResolvedValue('buyer'),
}));

describe('useIosNotificationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Default mocks: iOS web platform, push supported and configured
    vi.mocked(mobileApp.getDevicePlatform).mockReturnValue('ios');
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);
    vi.mocked(webPush.isWebPushSupported).mockReturnValue(true);
    vi.mocked(webPush.isWebPushConfigured).mockReturnValue(true);

    // Mock window.Notification
    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    });
  });

  test('shouldShowPrompt is true on iOS web when permission is default', () => {
    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.isIos).toBe(true);
    expect(result.current.isSupported).toBe(true);
    expect(result.current.shouldShowPrompt).toBe(true);
    expect(result.current.permission).toBe('default');
  });

  test('shouldShowPrompt is false when platform is Android or Desktop', () => {
    vi.mocked(mobileApp.getDevicePlatform).mockReturnValue('android');
    const { result: androidResult } = renderHook(() => useIosNotificationPermission());
    expect(androidResult.current.shouldShowPrompt).toBe(false);

    vi.mocked(mobileApp.getDevicePlatform).mockReturnValue('desktop');
    const { result: desktopResult } = renderHook(() => useIosNotificationPermission());
    expect(desktopResult.current.shouldShowPrompt).toBe(false);
  });

  test('shouldShowPrompt is false when running in native Capacitor app', () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);
    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.shouldShowPrompt).toBe(false);
  });

  test('shouldShowPrompt is false when permission is already granted', () => {
    window.Notification.permission = 'granted';
    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.shouldShowPrompt).toBe(false);
    expect(result.current.isGranted).toBe(true);
  });

  test('shouldShowPrompt is false when permission is denied', () => {
    window.Notification.permission = 'denied';
    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.shouldShowPrompt).toBe(false);
    expect(result.current.isDenied).toBe(true);
  });

  test('dismissPrompt hides the banner for the active session', () => {
    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.shouldShowPrompt).toBe(true);

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.shouldShowPrompt).toBe(false);
  });

  test('requestPermission requests notification permission and registers push token on grant', async () => {
    const { result } = renderHook(() => useIosNotificationPermission());

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(true);
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(mobileNotifications.registerNativePushNotifications).toHaveBeenCalledWith('buyer');
    expect(result.current.permission).toBe('granted');
  });

  test('shouldShowPrompt is true on Desktop/Android when allowAllWeb is true', () => {
    vi.mocked(mobileApp.getDevicePlatform).mockReturnValue('desktop');
    const { result } = renderHook(() => useIosNotificationPermission(undefined, { allowAllWeb: true }));
    expect(result.current.shouldShowPrompt).toBe(true);
  });

  test('isSafariWithoutNotification is true on iOS when Notification is not in window and not installed', () => {
    // Delete Notification from window to simulate iOS Safari tab
    // @ts-expect-error simulating missing Notification API
    delete window.Notification;
    vi.mocked(mobileApp.isAppInstalled).mockReturnValue(false);

    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.isIos).toBe(true);
    expect(result.current.isSafariWithoutNotification).toBe(true);
    expect(result.current.shouldShowPrompt).toBe(true);
  });

  test('isSafariWithoutNotification is false when running as installed PWA on iOS', () => {
    // Delete Notification from window to simulate PWA before API injection
    // @ts-expect-error simulating missing Notification API
    delete window.Notification;
    vi.mocked(mobileApp.isAppInstalled).mockReturnValue(true);

    const { result } = renderHook(() => useIosNotificationPermission());
    expect(result.current.isIos).toBe(true);
    expect(result.current.isSafariWithoutNotification).toBe(false);
    expect(result.current.shouldShowPrompt).toBe(true);
  });
});
