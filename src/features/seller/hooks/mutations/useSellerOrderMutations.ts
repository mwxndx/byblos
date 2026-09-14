import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/features/seller/api';
import { sellerQueryKeys } from '@/features/seller/api/queryKeys';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';
import type { OrderStatus } from '@/shared/types';

export function useQuotePickupMutation() {
  return useMutation({
    mutationFn: (args: { orderId: string; phone: string; address: string; lat: number | null; lng: number | null }) =>
      sellerApi.quotePickup({
        address: args.address,
        latitude: args.lat ?? 0,
        longitude: args.lng ?? 0
      }),
  });
}

export function useRequestPickupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // `quote` carries the idempotency key the caller generates per submit
    // attempt (see useSellerOrderActions.ts's handleRequestPickup) --
    // previously typed `unknown` and never read here, silently discarded
    // before reaching sellerApi.requestPickup, which DOES accept
    // idempotencyKey and sends it as the Idempotency-Key header. Without
    // it, a network-level retry of the same request (or a request that
    // times out client-side after actually succeeding server-side) had no
    // server-side dedup key at all on a mutation that books a real courier
    // pickup and incurs a real fee -- a gap distinct from the client-side
    // runWithLock guard, which only prevents a same-session double-click.
    mutationFn: (args: { orderId: string; phone: string; address: string; lat: number | null; lng: number | null; quote: { idempotencyKey?: string } }) =>
      sellerApi.requestPickup(args.orderId, {
        mobilePayment: args.phone,
        pickupLocation: {
          address: args.address,
          latitude: args.lat ?? 0,
          longitude: args.lng ?? 0
        },
        idempotencyKey: args.quote?.idempotencyKey
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Pickup request submitted successfully');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to request pickup').message);
    }
  });
}

export function useSelectHubDropoffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.selectHubDropoff(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Dropoff method set to Hub Dropoff');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to select hub dropoff').message);
    }
  });
}

export function useMarkDroppedAtHubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.markDroppedAtHub(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to update order status').message);
    }
  });
}

export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { orderId: string; status: OrderStatus }) =>
      sellerApi.updateOrderStatus(args.orderId, args.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to update order status').message);
    }
  });
}

export function useConfirmBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.confirmBooking(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Booking confirmed');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to confirm booking').message);
    }
  });
}

export function useCancelSellerOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => sellerApi.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerQueryKeys.orders() });
      toast.success('Order cancelled successfully');
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to cancel order').message);
    }
  });
}


