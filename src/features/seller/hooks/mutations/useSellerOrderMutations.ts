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
    mutationFn: (args: { orderId: string; phone: string; address: string; lat: number | null; lng: number | null; quote: unknown }) =>
      sellerApi.requestPickup(args.orderId, {
        mobilePayment: args.phone,
        pickupLocation: {
          address: args.address,
          latitude: args.lat ?? 0,
          longitude: args.lng ?? 0
        }
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


