import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { BuyerProfile } from '@/features/auth/types/authTypes';
import { useAsyncLock } from '@/shared/hooks/useAsyncLock';
import type { ApiOrder } from '@/shared/types';
import { isDigitalOrderItem } from '@/features/orders/utils/ordersSectionUtils';
import { useBuyerOrdersQuery } from '@/features/buyer/hooks/queries/useBuyerOrdersQuery';
import { useCancelOrderMutation } from '@/features/buyer/hooks/mutations/useCancelOrderMutation';
import { useConfirmOrderReceiptMutation } from '@/features/buyer/hooks/mutations/useConfirmOrderReceiptMutation';
import { useDownloadProductMutation } from '@/features/buyer/hooks/mutations/useDownloadProductMutation';
import { OrdersSectionView } from '@/components/orders/OrdersSectionView';

export function OrdersSectionContainer() {
  const { user: globalUser } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? globalUser.profile as BuyerProfile : null;
  // Separate lock per action: a single shared lock meant cancelling order A
  // and confirming receipt on order B -- two unrelated orders, two unrelated
  // actions -- couldn't run concurrently. The second click landing while the
  // first request was still in flight was silently dropped (runWithLock
  // just returns undefined), with no toast, no spinner, nothing -- it looked
  // like the button was broken.
  const { runWithLock: runCancelWithLock } = useAsyncLock();
  const { runWithLock: runConfirmWithLock } = useAsyncLock();

  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [currentConfirmOrderId, setCurrentConfirmOrderId] = useState<string | null>(null);

  // React Query: fetch orders
  const { data: orders = [], isLoading, error, refetch } = useBuyerOrdersQuery(!!user);

  // Mutations
  const cancelOrderMutation = useCancelOrderMutation();
  const confirmReceiptMutation = useConfirmOrderReceiptMutation();
  const downloadProductMutation = useDownloadProductMutation();

  const handleDownload = useCallback(async (order: ApiOrder) => {
    const digitalItem = order.items?.find(isDigitalOrderItem);
    if (!digitalItem?.productId) {
      toast.error('Could not find digital product to download.');
      return;
    }

    try {
      setDownloadingOrderId(order.id);
      setDownloadProgress(prev => ({ ...prev, [order.id]: 0 }));

      await downloadProductMutation.mutateAsync({
        orderId: String(order.id),
        productId: String(digitalItem.productId),
        onProgress: (percent) => setDownloadProgress(prev => ({ ...prev, [order.id]: percent }))
      });

      toast.success('Download Complete!');
    } catch {
      // Error handled in mutation's onError
    } finally {
      setDownloadingOrderId(null);
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    }
  }, [downloadProductMutation]);

  const handleConfirmReceiptClick = (orderId: string) => {
    setCurrentConfirmOrderId(orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!orderId) return;

    // runCancelWithLock provides a synchronous ref guard, so a second click
    // can't fire a duplicate cancel (and duplicate refund) before the first
    // resolves.
    await runCancelWithLock(async () => {
      setIsCancelling(orderId);
      try {
        await cancelOrderMutation.mutateAsync(orderId);
      } catch {
        // Error handled in mutation's onError
      } finally {
        setIsCancelling(null);
      }
    });
  };

  const handleConfirmReceipt = async (orderId: string) => {
    const targetOrderId = orderId || currentConfirmOrderId;
    if (!targetOrderId) return;

    await runConfirmWithLock(async () => {
      setIsConfirming(targetOrderId);
      const loadingToast = toast.loading('Confirming order receipt...');

      try {
        await confirmReceiptMutation.mutateAsync(targetOrderId);
        toast.dismiss(loadingToast);
      } catch (err) {
        const errorObj = err as { code?: string; message?: string; response?: { data?: { message?: string } } };
        const errorMessage = errorObj.response?.data?.message || errorObj.message || 'An error occurred while confirming order receipt';
        toast.error(errorObj.code === 'ECONNABORTED'
          ? 'Request timed out. Please check your internet connection and try again.'
          : `Error: ${errorMessage}`, { id: loadingToast });
      } finally {
        setIsConfirming(null);
      }
    });
  };

  return (
    <OrdersSectionView
      orders={orders}
      isLoading={isLoading}
      error={error as Error | null}
      refetch={refetch}
      downloadingOrderId={downloadingOrderId}
      downloadProgress={downloadProgress}
      isConfirming={isConfirming}
      isCancelling={isCancelling}
      onConfirmReceiptClick={handleConfirmReceiptClick}
      onCancelOrder={handleCancelOrder}
      onConfirmReceipt={handleConfirmReceipt}
      onDownload={handleDownload}
    />
  );
}

export default OrdersSectionContainer;
