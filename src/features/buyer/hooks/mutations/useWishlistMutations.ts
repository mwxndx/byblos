import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import type { WishlistItem } from '@/features/buyer/api/wishlist';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';

export function useAddWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => buyerApi.addToWishlist({ id: productId }),
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: buyerQueryKeys.wishlist() });
      const previousWishlist = queryClient.getQueryData<WishlistItem[]>(buyerQueryKeys.wishlist());
      if (previousWishlist) {
        const exists = previousWishlist.some((item) => String(item.id) === String(productId));
        if (!exists) {
          queryClient.setQueryData<WishlistItem[]>(buyerQueryKeys.wishlist(), [
            ...previousWishlist,
            {
              id: productId,
              name: 'Saved item',
              description: '',
              price: 0,
              image_url: '',
              sellerId: '',
              isSold: false,
              status: 'available',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              aesthetic: '',
            } as WishlistItem,
          ]);
        }
      }
      return { previousWishlist };
    },
    onError: (_err, _productId, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(buyerQueryKeys.wishlist(), context.previousWishlist);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: buyerQueryKeys.wishlist() });
    },
  });
}

export function useRemoveWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => buyerApi.removeFromWishlist(productId),
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: buyerQueryKeys.wishlist() });
      const previousWishlist = queryClient.getQueryData<WishlistItem[]>(buyerQueryKeys.wishlist());
      if (previousWishlist) {
        queryClient.setQueryData<WishlistItem[]>(
          buyerQueryKeys.wishlist(),
          previousWishlist.filter((item) => String(item.id) !== String(productId))
        );
      }
      return { previousWishlist };
    },
    onError: (_err, _productId, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(buyerQueryKeys.wishlist(), context.previousWishlist);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: buyerQueryKeys.wishlist() });
    },
  });
}
