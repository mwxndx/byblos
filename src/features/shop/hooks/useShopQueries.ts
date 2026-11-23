import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/features/seller/api';
import { publicApiService } from '@/features/shop/api';
import { getProducts } from '@/features/shop/api/products';
import { commonQueryKeys } from '@/shared/types/queryKeys';

export function useSellerByShopNameQuery(shopName: string, enabled = true) {
  return useQuery({
    queryKey: commonQueryKeys.public.shop(shopName),
    queryFn: () => sellerApi.getSellerByShopName(shopName),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: enabled && !!shopName
  });
}

export function usePublicSellerProductsQuery(sellerId: string | number, enabled = true) {
  return useQuery({
    queryKey: commonQueryKeys.public.products(sellerId),
    queryFn: () => sellerApi.getSellerProducts(sellerId),
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    enabled: enabled && !!sellerId
  });
}

export function usePublicSellersQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: commonQueryKeys.public.sellers(params),
    queryFn: () => publicApiService.getSellersPage(params),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useKnockSellerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sellerId: string | number) => publicApiService.knockSeller(sellerId),
    onMutate: async (sellerId: string | number) => {
      await queryClient.cancelQueries({ queryKey: ['public-sellers'] });
      const queries = queryClient.getQueriesData<{ sellers?: Array<{ id: string | number; knockCount?: number; knock_count?: number }> }>({ queryKey: ['public-sellers'] });
      for (const [key, data] of queries) {
        if (data && Array.isArray(data.sellers)) {
          queryClient.setQueryData(key, {
            ...data,
            sellers: data.sellers.map((s) => {
              if (String(s.id) === String(sellerId)) {
                const current = Number(s.knockCount ?? s.knock_count ?? 0);
                return { ...s, knockCount: current + 1, knock_count: current + 1 };
              }
              return s;
            }),
          });
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-sellers'] });
    },
  });
}

export function usePublicCatalogProductsQuery(enabled = true) {
  return useQuery({
    queryKey: ['public-products-catalog'],
    queryFn: () => getProducts({ limit: 100 }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

