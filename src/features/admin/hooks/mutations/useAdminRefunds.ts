import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';

export function useAdminRefundRequestsQuery(status: string, options?: { overdue?: boolean; sortBy?: string }, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.refunds(status, options?.overdue, options?.sortBy),
    queryFn: () => adminApi.getRefundRequests(status, options),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: enabled && status !== undefined
  });
}

export function useConfirmRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number | string; adminNotes: string; approvedAmount?: number; idempotencyKey: string }) =>
      adminApi.confirmRefund(args.id, { adminNotes: args.adminNotes, approvedAmount: args.approvedAmount }, { 'Idempotency-Key': args.idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    }
  });
}

export function useRejectRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number | string; adminNotes: string; idempotencyKey: string }) =>
      adminApi.rejectRefund(args.id, { adminNotes: args.adminNotes }, { 'Idempotency-Key': args.idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    }
  });
}


