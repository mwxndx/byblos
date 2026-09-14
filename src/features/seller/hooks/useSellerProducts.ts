import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/features/seller/api';
import { sellerQueryKeys } from '@/features/seller/api/queryKeys';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';
import type { ApiSellerProduct } from '@/shared/types';

// Products Queries
import { useQuery } from '@tanstack/react-query';

export function useSellerProductsQuery() {
  return useQuery({
    queryKey: sellerQueryKeys.products(),
    queryFn: sellerApi.getProducts,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export const sellerProductQuery = (id: string) => ({
  queryKey: sellerQueryKeys.product(id),
  queryFn: () => sellerApi.getProduct(id),
  staleTime: 60_000,
});

export function useSellerProductQuery(id: string, enabled = true) {
  return useQuery({
    ...sellerProductQuery(id),
    enabled: enabled && !!id
  });
}

// Product Mutations
export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Omit<ApiSellerProduct, 'id' | 'createdAt' | 'updatedAt' | 'sellerId' | 'seller'> & { digital_file?: File }) =>
      sellerApi.createProduct(product as unknown as Parameters<typeof sellerApi.createProduct>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Product created successfully');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to create product').message);
    }
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; updates: Partial<ApiSellerProduct> }) =>
      sellerApi.updateProduct(args.id, args.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Product updated successfully');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to update product').message);
    }
  });
}

export function useUpdateInventoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // Previously sent { stockCount } -- a field the backend's
    // PATCH /sellers/products/:id/inventory has never read (it destructures
    // track_inventory/quantity/low_stock_threshold, see
    // product.controller.js updateInventory), forced through an
    // `as unknown as Parameters<...>` cast that hid the mismatch from
    // TypeScript. The request "succeeded" (200, toast shown) while silently
    // writing none of the three real fields, so a seller toggling Track
    // Inventory or editing the low-stock threshold saw a success toast but
    // the setting never persisted.
    mutationFn: (args: { id: string; trackInventory: boolean; quantity: number | null; lowStockThreshold: number | null }) =>
      sellerApi.updateInventory(args.id, {
        track_inventory: args.trackInventory,
        quantity: args.quantity,
        low_stock_threshold: args.lowStockThreshold
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Inventory updated successfully');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to update inventory').message);
    }
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sellerApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.products() });
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.analytics() });
      toast.success('Product deleted successfully');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to delete product').message);
    }
  });
}

export function useUploadDigitalProductMutation() {
  return useMutation({
    mutationFn: (args: { file: File; onProgress?: (progress: number) => void }) =>
      sellerApi.uploadDigitalProduct(args.file, args.onProgress),
  });
}


