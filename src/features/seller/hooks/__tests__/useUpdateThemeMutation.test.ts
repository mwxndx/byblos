import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUpdateThemeMutation } from '../useSellerProfile';
import { sellerApi } from '@/features/seller/api';
import { sellerQueryKeys } from '@/features/seller/api/queryKeys';

vi.mock('@/features/seller/api', () => ({
  sellerApi: {
    updateTheme: vi.fn(),
  },
}));

describe('useUpdateThemeMutation - Query Cache Invalidation (TDD)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  it('invalidates live seller profile, auth seller profile, and public shop queries on success', async () => {
    vi.mocked(sellerApi.updateTheme).mockResolvedValueOnce({ theme: 'pink' } as unknown as { theme: import('@/features/seller/api').Theme });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateThemeMutation(), { wrapper });

    await result.current.mutateAsync('pink');

    await waitFor(() => {
      // 1. Live seller profile
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['seller-profile'] });
      // 2. Auth seller profile
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sellerQueryKeys.profile() });
      // 3. Public shop query cache
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['seller-shop'] });
      // 4. Public sellers list
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['public-sellers'] });
    });
  });
});
