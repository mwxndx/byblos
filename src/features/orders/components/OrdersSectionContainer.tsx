import { useCallback, useRef, useState } from 'react';
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
import { OrdersSectionView } from './OrdersSectionView';

const GUEST_ORDERS_KEY = 'byblos_guest_orders';

interface GuestOrderRef {
  orderNumber: string;
  checkoutToken?: string;
  email?: string;
  date: string;
}

function getGuestOrders(): GuestOrderRef[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY) || '[]') as GuestOrderRef[];
  } catch {
    return [];
  }
}

export function OrdersSectionContainer() {
  const { user: globalUser } = useGlobalAuth();
  const user = globalUser?.role === 'buyer' ? globalUser.profile as BuyerProfile : null;
  const guestOrders = !user ? getGuestOrders() : [];
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
  // Synchronous per-order guard for handleDownload: the button's `disabled`
  // prop only takes effect once state updates and React re-renders, so two
  // rapid clicks on the SAME order's download button before that repaint
  // could otherwise fire two concurrent downloads (duplicate requests,
  // overlapping onProgress callbacks stomping the same downloadProgress
  // entry). Keyed per order id (not a single shared lock) since different
  // orders are meant to download concurrently -- see BuyerOrderCard's
  // disabled={downloadingOrderId === order.id}.
  const inFlightDownloadsRef = useRef<Set<string>>(new Set());

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

    if (inFlightDownloadsRef.current.has(order.id)) return;
    inFlightDownloadsRef.current.add(order.id);

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
      inFlightDownloadsRef.current.delete(order.id);
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

  // Guests: show their locally-persisted orders (placed in this browser) + sign-in prompt
  if (!user) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        {guestOrders.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wide">Your Recent Orders</p>
            {guestOrders.map((o) => {
              const trackUrl = o.checkoutToken
                ? `/buyer/orders/reference/${o.orderNumber}?client_checkout_token=${o.checkoutToken}`
                : `/buyer/orders/reference/${o.orderNumber}`;
              return (
                <div key={o.orderNumber} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Order #{o.orderNumber}</p>
                  {o.date && (
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/40">
                      {new Date(o.date).toLocaleDateString()}
                    </p>
                  )}
                  <a
                    href={trackUrl}
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-yellow-400 px-3 text-xs font-bold text-black hover:bg-yellow-300"
                  >
                    Track Order
                  </a>
                </div>
              );
            })}
          </>
        )}
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-5 text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Sign in to view all your orders</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
            Get full order history, tracking updates, and receipts in one place.
          </p>
          <a
            href="/buyer/login"
            className="mt-3 inline-flex h-9 items-center rounded-xl bg-yellow-400 px-4 text-xs font-bold text-black hover:bg-yellow-300"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

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
