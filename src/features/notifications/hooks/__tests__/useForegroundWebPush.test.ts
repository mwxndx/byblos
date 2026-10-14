import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';
import * as webPush from '@/features/notifications/webPush';
import * as toastModule from '@/shared/hooks/use-toast';
import { useForegroundWebPush } from '../useForegroundWebPush';

const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('@/infrastructure/navigation/mobileApp');
vi.mock('@/features/notifications/webPush');
vi.mock('@/shared/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useForegroundWebPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('does not subscribe when running in native app', () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(true);

    renderHook(() => useForegroundWebPush());

    expect(webPush.subscribeForegroundMessages).not.toHaveBeenCalled();
  });

  test('subscribes to foreground push messages on web/PWA and triggers toast + cache invalidation', () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    let messageHandler: ((payload: unknown) => void) | undefined;
    const unsubscribeFn = vi.fn();

    vi.mocked(webPush.subscribeForegroundMessages).mockImplementation((handler) => {
      messageHandler = handler;
      return unsubscribeFn;
    });

    const { unmount } = renderHook(() => useForegroundWebPush());

    expect(webPush.subscribeForegroundMessages).toHaveBeenCalledTimes(1);
    expect(messageHandler).toBeDefined();

    // Simulate incoming foreground message
    messageHandler!({
      notification: {
        title: 'Order Shipped',
        body: 'Your package is on its way with Mzigo Courier.',
      },
      data: {
        path: '/orders/order-123',
      },
    });

    expect(toastModule.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Order Shipped',
        description: 'Your package is on its way with Mzigo Courier.',
        duration: 7000,
        action: expect.objectContaining({
          label: 'View',
        }),
      })
    );

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications'],
    });

    unmount();
    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
  });
});
