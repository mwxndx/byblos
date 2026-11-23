import { useMutation, useQueryClient } from '@tanstack/react-query';
import buyerApi from '@/features/buyer/api';
import { buyerQueryKeys } from '@/features/buyer/api/queryKeys';
import { toast } from 'sonner';

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => buyerApi.cancelOrder(orderId),
    onMutate: async (orderId: string) => {
      await queryClient.cancelQueries({ queryKey: buyerQueryKeys.order(orderId) });
      const previousOrder = queryClient.getQueryData(buyerQueryKeys.order(orderId));
      if (previousOrder && typeof previousOrder === 'object') {
        queryClient.setQueryData(buyerQueryKeys.order(orderId), {
          ...previousOrder,
          status: 'CANCELLED',
          statusFormatted: 'Cancelled',
        });
      }
      return { previousOrder };
    },
    onError: (error, orderId, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(buyerQueryKeys.order(orderId), context.previousOrder);
      }
      const err = error as Error;
      toast.error(err.message || 'Failed to cancel order');
    },
    onSuccess: () => {
      toast.success('Order cancelled successfully');
    },
    onSettled: (_data, _error, orderId) => {
      void queryClient.invalidateQueries({ queryKey: buyerQueryKeys.orders() });
      void queryClient.invalidateQueries({ queryKey: buyerQueryKeys.order(orderId) });
    },
  });
}
