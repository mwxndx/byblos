import { useState, useEffect, useCallback } from 'react';
import { useAdminRefundRequestsQuery, useConfirmRefundMutation, useRejectRefundMutation } from '@/features/admin/hooks/mutations/useAdminRefunds';
import { toast } from 'sonner';
import { classifyApiError } from '@/shared/utils/errorClassification';
import type { RefundRequest } from '../types/refunds';

export function useRefundRequests() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  const confirmRefundMutation = useConfirmRefundMutation();
  const rejectRefundMutation = useRejectRefundMutation();

  const refundQuery = useAdminRefundRequestsQuery(statusFilter);

  useEffect(() => {
    if (refundQuery.data) {
      setRequests(refundQuery.data.data?.requests || []);
    }
  }, [refundQuery.data]);

  const fetchRefundRequests = useCallback(async () => {
    await refundQuery.refetch();
  }, [refundQuery]);

  const isLoadingRequests = refundQuery.isLoading;

  const handleConfirmRefund = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const idempotencyKey = `refund-confirm-${selectedRequest.id}`;

      await confirmRefundMutation.mutateAsync({
        id: selectedRequest.id,
        adminNotes,
        idempotencyKey
      });

      toast.success('Refund confirmed and processed successfully!');
      setIsConfirmDialogOpen(false);
      setAdminNotes('');
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
    isProcessing,
    statusFilter,
    setStatusFilter,
    isLoadingRequests,
    fetchRefundRequests,
    handleConfirmRefund,
    handleRejectRefund,
  };
}
