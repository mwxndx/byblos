import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useShopPage } from '../useShopPage';

const mutateSpy = vi.fn();
const stableSeller = {
  id: 1,
  shopName: 'Eris',
  isCreatorMarketplaceEnabled: true,
  products: [],
};
const stableProducts: unknown[] = [];

vi.mock('@/features/shop/hooks/useShopQueries', () => ({
  useSellerByShopNameQuery: () => ({
    data: stableSeller,
    isLoading: false,
    error: null,
  }),
  usePublicSellerProductsQuery: () => ({
    data: stableProducts,
    isLoading: false,
  }),
}));

vi.mock('@/features/auth/contexts', () => ({
  useGlobalAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('@/features/creator/hooks/mutations/useTrackCreatorLinkMutation', () => ({
  useTrackCreatorLinkMutation: () => {
    const [tick, setTick] = useState(0);
    return {
      tick,
      mutate: (code: string, opts?: { onSuccess?: (d: unknown) => void }) => {
        mutateSpy(code);
        if (tick < 5) {
          setTick((t) => t + 1);
        }
        opts?.onSuccess?.({ data: { sellerCreatorModeOff: false } });
      },
    };
  },
}));

function TestHarness() {
  useShopPage();
  return null;
}

describe('useShopPage creator link tracking', () => {
  beforeEach(() => {
    mutateSpy.mockClear();
    sessionStorage.clear();
  });

  it('tracks creator link click only once even when useMutation returns new object references', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/eris?creator=C11E55E8F64']}>
          <Routes>
            <Route path="/:shopName" element={<TestHarness />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith({ code: 'C11E55E8F64', shopSlug: 'eris' });
  });

  it('extracts creator username from /:shopName/:creatorUsername path route', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/eris/roynthiga']}>
          <Routes>
            <Route path="/:shopName/:creatorUsername" element={<TestHarness />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith({ code: 'roynthiga', shopSlug: 'eris' });
    expect(sessionStorage.getItem('byblos_creator_eris')).toBe('roynthiga');
  });
});

