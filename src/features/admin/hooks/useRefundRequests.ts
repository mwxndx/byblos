import { useState, useCallback } from 'react';
import { useAdminRefundRequestsQuery, useConfirmRefundMutation, useRejectRefundMutation } from '@/features/admin/hooks/mutations/useAdminRefunds';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';
import type { RefundRequest } from '../types/refunds';

export function useRefundRequests() {
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'urgency' | 'newest'>('urgency');

  const confirmRefundMutation = useConfirmRefundMutation();
  const rejectRefundMutation = useRejectRefundMutation();

  const refundQuery = useAdminRefundRequestsQuery(statusFilter, { overdue: isOverdueOnly, sortBy });

  // Derived directly during render instead of mirrored into its own state
  // via a useEffect -- matches useDetections.ts's identical pattern
  // (`earnings = flaggedQuery.data?.data || []`). The effect version had a
  // real gap: right after fetchRefundRequests() triggers a refetch,
  // `requests` kept showing the stale value until the effect fired on the
  // next render pass -- two sources of truth for the same data that could
  // drift for a render.
  const requests = refundQuery.data?.data?.requests || [];

  const fetchRefundRequests = useCallback(async () => {
    await refundQuery.refetch();
  }, [refundQuery]);

  const isLoadingRequests = refundQuery.isLoading;

  const handleConfirmRefund = async () => {
    if (!selectedRequest) return;

    const parsedAmount = approvedAmount ? Number.parseFloat(approvedAmount) : Number.parseFloat(selectedRequest.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    const maxAmount = Number.parseFloat(selectedRequest.amount);
    if (parsedAmount > maxAmount) {
      toast.error(`Approved amount cannot exceed requested amount (${maxAmount})`);
      return;
    }

    setIsProcessing(true);
    try {
      const idempotencyKey = `refund-confirm-${selectedRequest.id}-${parsedAmount}`;

      await confirmRefundMutation.mutateAsync({
        id: selectedRequest.id,
        adminNotes,
        approvedAmount: parsedAmount,
        idempotencyKey
      });

      toast.success(parsedAmount < maxAmount ? 'Partial refund confirmed successfully!' : 'Refund confirmed and processed successfully!');
      setIsConfirmDialogOpen(false);
      setAdminNotes('');
      setApprovedAmount('');
      setSelectedRequest(null);
      fetchRefundRequests();
    } catch (error: unknown) {
      console.error('Error confirming refund:', error);
      toast.error(classifyApiError(error, 'Failed to confirm refund').message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const idempotencyKey = `refund-reject-${selectedRequest.id}`;

      await rejectRefundMutation.mutateAsync({
        id: selectedRequest.id,
        adminNotes,
        idempotencyKey
      });

      toast.success('Refund request rejected');
      setIsRejectDialogOpen(false);
      setAdminNotes('');
      setApprovedAmount('');
      setSelectedRequest(null);
      fetchRefundRequests();
    } catch (error: unknown) {
      console.error('Error rejecting refund:', error);
      toast.error(classifyApiError(error, 'Failed to reject refund').message);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    requests,
    selectedRequest,
    setSelectedRequest,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    isRejectDialogOpen,
    setIsRejectDialogOpen,
    adminNotes,
    setAdminNotes,
    approvedAmount,
    setApprovedAmount,
    isProcessing,
    statusFilter,
    setStatusFilter,
    isOverdueOnly,
    setIsOverdueOnly,
    sortBy,
    setSortBy,
    isLoadingRequests,
    fetchRefundRequests,
    handleConfirmRefund,
    handleRejectRefund,
  };
}
