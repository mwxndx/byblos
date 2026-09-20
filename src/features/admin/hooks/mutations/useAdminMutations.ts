import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';

// Every mutation below calls a `src/features/admin/api/*` function that
// returns the raw axios promise uncaught (no try/catch, or a catch that just
// re-throws unchanged) — so `error` here is always the raw axios error, and
// `(error as Error).message` was always axios's own generic "Request failed
// with status code 400", never the backend's real validation reason.
// classifyApiError reads the actual response body instead. Same fix as
// checkout's useBagCheckout.ts (fd1c686e).

export function useGetSellerByIdMutation() {
  return useMutation({
    mutationFn: (sellerId: string) => adminApi.getSellerById(sellerId),
  });
}

export function useGetBuyerByIdMutation() {
  return useMutation({
    mutationFn: (buyerId: string) => adminApi.getBuyerById(buyerId),
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId, `delete-user-${userId}`),
    onSuccess: () => {
      // Base/prefix keys, not the page-1-no-search key -- this must
      // invalidate every cached page+search variant, not just one.
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.buyersAll() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.sellersAll() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      // Success toast is fired by the calling handler (more specific wording);
      // firing one here too produced two stacked toasts per action.
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to delete user').message);
    },
  });
}

export function useDeleteCreatorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (creatorId: string) => adminApi.deleteCreator(creatorId, `delete-creator-${creatorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.creatorsAll() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      // Success toast fired by the calling handler (see useDeleteUserMutation).
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to delete creator').message);
    },
  });
}

export function useUpdateWithdrawalRequestStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { requestId: string; status: 'completed' | 'failed'; idempotencyKey: string }) =>
      adminApi.updateWithdrawalRequestStatus(args.requestId, args.status, args.idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.withdrawalsAll() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.analytics() });
      // Success toast fired by the calling handler ("...has been approved/rejected").
    },
    onError: (error) => {
      toast.error(classifyApiError(error, 'Failed to update withdrawal request status').message);
    },
  });
}


