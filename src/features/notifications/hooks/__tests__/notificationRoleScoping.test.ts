import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import axios, { type AxiosResponse } from 'axios';
import apiClient from '@/infrastructure/http/apiClient';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { GlobalAuthContextType, GlobalUser, UserRole } from '@/features/auth/types/authTypes';
import { useNotifications } from '../useNotifications';
import { unregisterNativePushNotifications } from '../../utils/mobileNotifications';
import * as mobileApp from '@/infrastructure/navigation/mobileApp';

interface CapturedQueryOptions {
  queryKey?: readonly unknown[];
  queryFn?: () => Promise<unknown>;
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
}

interface CapturedMutationOptions<TData = unknown, TVariables = void> {
  mutationFn?: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
}

const createMockApiResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: new axios.AxiosHeaders(),
  config: { headers: new axios.AxiosHeaders() },
});

const createMockUser = (role: UserRole): GlobalUser => ({
  role,
  isAuthenticated: true,
  profile: {
    id: 101,
    email: 'user@example.com',
    is_verified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    fullName: 'Test User',
    phone: '1234567890',
    whatsappNumber: '1234567890',
    mobilePayment: '1234567890',
  },
});

const createMockAuthContext = (
  overrides: Partial<GlobalAuthContextType> = {}
): GlobalAuthContextType => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  role: null,
  login: vi.fn(),
  loginWithToken: vi.fn(),
  loginAdmin: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  switchAccount: vi.fn(),
  refreshRole: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides,
});

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: CapturedQueryOptions) => mockUseQuery(options),
  useMutation: (options: CapturedMutationOptions) => mockUseMutation(options),
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
    vi.mocked(useGlobalAuth).mockReturnValue(
      createMockAuthContext({
        user: createMockUser('creator'),
        role: 'creator', // authRole is creator, but caller passes 'buyer'
        isAuthenticated: true,
      })
    );

    let capturedQueryOptions: CapturedQueryOptions | undefined;
    mockUseQuery.mockImplementation((opts: CapturedQueryOptions) => {
      capturedQueryOptions = opts;
      return {
        data: [{ id: 1, title: 'Buyer Order Update' }],
        isLoading: false,
      };
    });

    mockUseMutation.mockImplementation((opts: CapturedMutationOptions) => {
      return {
        mutate: opts.mutationFn,
        isPending: false,
      };
    });

    renderHook(() => useNotifications('default', true, 'buyer'));

    expect(capturedQueryOptions).toBeDefined();
    expect(capturedQueryOptions?.queryKey).toEqual(['notifications', 'default', 'buyer']);
    expect(capturedQueryOptions?.enabled).toBe(true);

    // Verify queryFn uses the role parameter
    vi.mocked(apiClient.get).mockResolvedValueOnce(
      createMockApiResponse({ data: [{ id: 1 }] })
    );
    await capturedQueryOptions?.queryFn?.();
    expect(apiClient.get).toHaveBeenCalledWith('/notifications?limit=30&role=buyer');
  });

  test('falls back to authRole when explicit role parameter is omitted', async () => {
    vi.mocked(useGlobalAuth).mockReturnValue(
      createMockAuthContext({
        user: createMockUser('seller'),
        role: 'seller',
        isAuthenticated: true,
      })
    );

    let capturedQueryOptions: CapturedQueryOptions | undefined;
    mockUseQuery.mockImplementation((opts: CapturedQueryOptions) => {
      capturedQueryOptions = opts;
      return { data: [], isLoading: false };
    });

    mockUseMutation.mockImplementation(() => ({ mutate: vi.fn(), isPending: false }));

    renderHook(() => useNotifications('default', true));

    expect(capturedQueryOptions).toBeDefined();
    expect(capturedQueryOptions?.queryKey).toEqual(['notifications', 'default', 'seller']);
    expect(capturedQueryOptions?.enabled).toBe(true);
  });

  test('disables query polling when user is not authenticated', () => {
    vi.mocked(useGlobalAuth).mockReturnValue(
      createMockAuthContext({
        user: null,
        role: null,
        isAuthenticated: false,
      })
    );

    let capturedQueryOptions: CapturedQueryOptions | undefined;
    mockUseQuery.mockImplementation((opts: CapturedQueryOptions) => {
      capturedQueryOptions = opts;
      return { data: [], isLoading: false };
    });

    mockUseMutation.mockImplementation(() => ({ mutate: vi.fn(), isPending: false }));

    renderHook(() => useNotifications('default', true, 'buyer'));

    expect(capturedQueryOptions).toBeDefined();
    expect(capturedQueryOptions?.enabled).toBe(false);
  });

  test('scopes markAllRead request to the active role', async () => {
    vi.mocked(useGlobalAuth).mockReturnValue(
      createMockAuthContext({
        user: createMockUser('buyer'),
        role: 'buyer',
        isAuthenticated: true,
      })
    );

    let capturedMutationOptions: CapturedMutationOptions | undefined;
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    mockUseMutation.mockImplementation((opts: CapturedMutationOptions) => {
      capturedMutationOptions = opts;
      return {
        mutate: opts.mutationFn,
        isPending: false,
      };
    });

    const { result } = renderHook(() => useNotifications('default', true, 'buyer'));

    vi.mocked(apiClient.patch).mockResolvedValueOnce(
      createMockApiResponse({ success: true })
    );
    await result.current.markAllRead();

    expect(capturedMutationOptions).toBeDefined();
    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/read-all?role=buyer');
  });

  test('unregisterNativePushNotifications sends DELETE request and clears localStorage on web/PWA logout', async () => {
    vi.mocked(mobileApp.isNativeApp).mockReturnValue(false);

    localStorage.setItem('byblosNativePushToken', 'fcm-mock-token-xyz');
    localStorage.setItem('byblosNativePushRegistration', JSON.stringify({ role: 'buyer', deviceName: 'Web Browser' }));

    vi.mocked(apiClient.delete).mockResolvedValueOnce(
      createMockApiResponse({ success: true })
    );

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
