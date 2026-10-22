import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import apiClient from '@/infrastructure/http/apiClient';
import { useGlobalAuth } from '@/features/auth/contexts';
import { useNotifications } from '../useNotifications';
import { unregisterNativePushNotifications } from '../../utils/mobileNotifications';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('@/infrastructure/http/apiClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: vi.fn(),
}));

vi.mock('@/infrastructure/navigation/mobileApp', () => ({
  isNativeApp: vi.fn(),
}));

describe('Notification Role Scoping & Teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test('scopes queryKey and feed URL to explicit role parameter when provided', async () => {
    vi.mocked(useGlobalAuth).mockReturnValue({
      user: { id: 101, email: 'user@example.com' },
      role: 'creator', // authRole is creator, but caller passes 'buyer'
      isAuthenticated: true,
    } as any);

    let capturedQueryOptions: any;
    mockUseQuery.mockImplementation((opts) => {
      capturedQueryOptions = opts;
      return {
        data: [{ id: 1, title: 'Buyer Order Update' }],
        isLoading: false,
      };
    });

    mockUseMutation.mockImplementation((opts) => {
      return {
        mutate: opts.mutationFn,
        isPending: false,
      };
    });

    const { result } = renderHook(() => useNotifications('default', true, 'buyer'));

    expect(capturedQueryOptions.queryKey).toEqual(['notifications', 'default', 'buyer']);
    expect(capturedQueryOptions.enabled).toBe(true);

    // Verify queryFn uses the role parameter
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: [{ id: 1 }] } } as any);
    await capturedQueryOptions.queryFn();
    expect(apiClient.get).toHaveBeenCalledWith('/notifications?limit=30&role=buyer');
  });

  test('falls back to authRole when explicit role parameter is omitted', async () => {
    vi.mocked(useGlobalAuth).mockReturnValue({
      user: { id: 101, email: 'user@example.com' },
      role: 'seller',
      isAuthenticated: true,
    } as any);

    let capturedQueryOptions: any;
    mockUseQuery.mockImplementation((opts) => {
      capturedQueryOptions = opts;
      return { data: [], isLoading: false };
    });

    mockUseMutation.mockImplementation(() => ({ mutate: vi.fn(), isPending: false }));

    renderHook(() => useNotifications('default', true));

    expect(capturedQueryOptions.queryKey).toEqual(['notifications', 'default', 'seller']);
    expect(capturedQueryOptions.enabled).toBe(true);
  });

  test('disables query polling when user is not authenticated', () => {
    vi.mocked(useGlobalAuth).mockReturnValue({
      user: null,
      role: null,
      isAuthenticated: false,
    } as any);

    let capturedQueryOptions: any;
    mockUseQuery.mockImplementation((opts) => {
      capturedQueryOptions = opts;
      return { data: [], isLoading: false };
    });

    mockUseMutation.mockImplementation(() => ({ mutate: vi.fn(), isPending: false }));

    renderHook(() => useNotifications('default', true, 'buyer'));

    expect(capturedQueryOptions.enabled).toBe(false);
  });

  test('scopes markAllRead request to the active role', async () => {
    vi.mocked(useGlobalAuth).mockReturnValue({
      user: { id: 101, email: 'user@example.com' },
      role: 'buyer',
      isAuthenticated: true,
    } as any);

    let capturedMutationOptions: any;
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    mockUseMutation.mockImplementation((opts) => {
      capturedMutationOptions = opts;
      return {
        mutate: opts.mutationFn,
        isPending: false,
      };
    });

    const { result } = renderHook(() => useNotifications('default', true, 'buyer'));

    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { success: true } } as any);
    await result.current.markAllRead();

    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/read-all?role=buyer');
  });

  test('unregisterNativePushNotifications sends DELETE request and clears localStorage on web/PWA logout', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    localStorage.setItem('byblosNativePushToken', 'fcm-mock-token-xyz');
    localStorage.setItem('byblosNativePushRegistration', JSON.stringify({ role: 'buyer', deviceName: 'Web Browser' }));

    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { success: true } } as any);

    await unregisterNativePushNotifications('buyer');

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/notifications/devices',
      expect.objectContaining({
        data: { token: 'fcm-mock-token-xyz' },
      })
    );

    expect(localStorage.getItem('byblosNativePushToken')).toBeNull();
    expect(localStorage.getItem('byblosNativePushRegistration')).toBeNull();
  });
});
