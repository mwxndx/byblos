import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useGetOrderStatusMutation, useCancelPublicOrderMutation } from '@/features/buyer/hooks/queries/useOrderStatusQuery';
import { useGlobalAuth } from '@/features/auth/contexts';
import { isNativeApp, APP_DOWNLOAD_URL, getDevicePlatform, getAndroidDeepLink } from '@/infrastructure/navigation/mobileApp';
import { Loader2 } from '@/shared/ui/icons';
import { useToast } from '@/shared/hooks/use-toast';

type ModalState = 'POLLING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

interface Props {
  isOpen: boolean;
  orderNumber: string | null;
  invoiceId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  onCancelRetry?: () => void;
  isGuest?: boolean;
  email?: string;
  checkoutToken?: string | null;
  paymentSummary?: {
    productAmount?: number;
    deliveryFee?: number;
    serviceCharge?: number;
    totalAmount?: number;
  };
}

export const PaymentStatusModal = ({
  isOpen,
  orderNumber,
  invoiceId,
  onClose,
  onSuccess,
  onCancelRetry,
  isGuest,
  email,
  checkoutToken,
  paymentSummary
}: Props) => {
  const { toast } = useToast();
  const [state, setState] = useState<ModalState>('POLLING');
  const [attempts, setAttempts] = useState(0);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { loginWithToken } = useGlobalAuth();
  const getOrderStatusMutation = useGetOrderStatusMutation();
  const cancelPublicOrderMutation = useCancelPublicOrderMutation();
  // Store the latest mutateAsync in a ref so the polling effect doesn't need it as a dep
  const getOrderStatusRef = useRef(getOrderStatusMutation.mutateAsync);
  getOrderStatusRef.current = getOrderStatusMutation.mutateAsync;
  // Same ref pattern for onSuccess: keeping it out of the effect deps means a
  // parent passing an inline (non-memoized) callback can't tear down and
  // restart the 5s polling interval on every re-render.
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const MAX_ATTEMPTS = 60;


  useEffect(() => {
    if (isOpen && invoiceId) {
      setState('POLLING');
      setAttempts(0);
      setFailureReason(null);
    }
  }, [isOpen, invoiceId]);

  const handleAutoLogin = useCallback(async (token: string) => {
    try {
      await loginWithToken(token, 'buyer');
    } catch (err) {
      console.error('Auto-login failed:', err);
    }
  }, [loginWithToken]);

  useEffect(() => {
    if (!isOpen || !invoiceId || state !== 'POLLING') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const poll = async () => {
      try {
        const res = (await getOrderStatusRef.current({ orderNumber: invoiceId, clientCheckoutToken: checkoutToken })) as {
          paymentStatus?: string;
          paymentRecordStatus?: string;
          status?: string;
          autoLoginToken?: string;
          failureReason?: string;
        };
        const status = (res.paymentStatus || '').toLowerCase();
        const paymentRecordStatus = (res.paymentRecordStatus || '').toLowerCase();
        const orderStatus = String(res.status || '').toUpperCase();

        const isPaymentSuccess = ['completed', 'success', 'paid'].includes(status)
          || ['completed', 'success', 'paid'].includes(paymentRecordStatus);
        const isOrderPaid = [
          'PAID',
          'FULFILLMENT_PENDING',
          'FULFILLED',
          'DELIVERED',
          'COMPLETED',
          'BOOKED',
          'COLLECTION_PENDING'
        ].includes(orderStatus);
        const isPaymentFailure = ['failed', 'cancelled', 'manual_review_required', 'payment_mapping_failed', 'compensation_required'].includes(status)
          || ['failed', 'cancelled', 'manual_review_required', 'payment_mapping_failed', 'compensation_required'].includes(paymentRecordStatus)
          || ['FAILED', 'CANCELLED', 'COMPENSATION_REQUIRED'].includes(orderStatus);

        if (isPaymentSuccess || isOrderPaid) {
          setState('SUCCESS');
          if (intervalRef.current) clearInterval(intervalRef.current);

          if (isGuest && res.autoLoginToken) {
            await handleAutoLogin(res.autoLoginToken);
          }

          onSuccessRef.current?.();
          return;
        }

        if (isPaymentFailure) {
          setFailureReason(res.failureReason || null);
          setState('FAILED');
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        setAttempts(prev => {
          if (prev + 1 >= MAX_ATTEMPTS) {
            setState('TIMEOUT');
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
          return prev + 1;
        });
      } catch (err) {
        console.error('Poll error:', err);
        setAttempts(prev => {
          if (prev + 1 >= MAX_ATTEMPTS) {
            setState('TIMEOUT');
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
          return prev + 1;
        });
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, invoiceId, state, isGuest, checkoutToken, handleAutoLogin]);



  const handleRecheck = () => {
    setAttempts(0);
    setState('POLLING');
  };

  const handleCancelAndRetry = async () => {
    if (!invoiceId) {
      onCancelRetry?.();
      onClose();
      return;
    }
    setIsCancelling(true);
    try {
      await cancelPublicOrderMutation.mutateAsync({
        orderNumber: invoiceId,
        clientCheckoutToken: checkoutToken,
      });
      toast({
        title: 'Prompt Cancelled',
        description: 'Previous prompt was cancelled. Your bag items are ready.',
      });
      onCancelRetry?.();
      onClose();
    } catch (err) {
      console.error('Cancel order error:', err);
      try {
        const res = (await getOrderStatusRef.current({ orderNumber: invoiceId, clientCheckoutToken: checkoutToken })) as {
          paymentStatus?: string;
          paymentRecordStatus?: string;
          status?: string;
        };
        const status = (res.paymentStatus || '').toLowerCase();
        if (['completed', 'success', 'paid'].includes(status)) {
          setState('SUCCESS');
          onSuccessRef.current?.();
          return;
        }
      } catch {}
      toast({
        title: 'Cancellation Notice',
        description: 'Unable to cancel this order attempt. Please check your orders.',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && state !== 'POLLING') {
          onClose();
        }
      }}
    >
      <DialogContent
        onPointerDownOutside={(e) => {
          if (state === 'POLLING' || isCancelling) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (state === 'POLLING' || isCancelling) e.preventDefault();
        }}
        className="flex max-h-[85dvh] w-full max-w-[380px] flex-col justify-center overflow-y-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d] p-5 sm:p-6 text-slate-950 dark:text-white shadow-2xl transition-colors duration-200 [&>button]:hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Payment Status</DialogTitle>
          <DialogDescription>
            {state === 'POLLING'
              ? 'Confirming payment with M-Pesa prompt'
              : state === 'SUCCESS'
              ? 'Payment confirmed'
              : state === 'FAILED'
              ? 'Payment failed'
              : 'Payment status timed out'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center">
          {state === 'POLLING' && (
            <>
              <div className="relative mb-4">
                <div className="h-14 w-14 rounded-full border-4 border-slate-200 dark:border-white/10" />
                <div className="absolute left-0 top-0 h-14 w-14 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Confirming Payment</h2>
              <p className="mb-1 text-xs text-slate-600 dark:text-white/60">Check your phone for an M-Pesa prompt</p>
              {orderNumber && (
                <div className="mt-3 flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1.5">
                  <span className="text-xs text-slate-500 dark:text-white/50">Order:</span>
                  <span className="font-mono text-sm font-bold text-yellow-600 dark:text-yellow-400">{orderNumber}</span>
                </div>
              )}
              <div className="mt-4 rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 p-3">
                <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-100 font-semibold">
                  Please enter your M-Pesa PIN on the prompt sent to confirm your payment.
                </p>
              </div>
              <div className="mt-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-2.5">
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/60">Protected checkout, instant receipts, and live order tracking.</p>
              </div>
            </>
          )}

          {state === 'SUCCESS' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-green-500/20 bg-green-500/20">
                <span className="text-sm font-bold text-green-700 dark:text-green-400">OK</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Payment Confirmed</h2>
              {orderNumber && (
                <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-white/60">
                  Order <span className="font-mono font-bold text-yellow-600 dark:text-yellow-400">#{orderNumber}</span> has been successfully placed.
                </p>
              )}
              <div className="mb-3 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-2.5">
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/60">Protected checkout, instant receipts, and live order tracking.</p>
              </div>
              {!isNativeApp() && (
                <div className="mb-3 w-full rounded-xl border border-yellow-200 dark:border-yellow-400/20 bg-yellow-50 dark:bg-yellow-400/10 p-3 text-left">
                  {isGuest && (
                    <>
                      <p className="text-xs font-bold text-slate-950 dark:text-white">Your Byblos account is ready</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-700 dark:text-white/70">
                        Log in anytime with{email ? <> <span className="font-semibold text-slate-900 dark:text-white">{email}</span></> : ' your email'} to track this order.
                      </p>
                    </>
                  )}

                  {getDevicePlatform() === 'android' ? (
                    <>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-700 dark:text-white/70">
                        Track live courier updates and get push notifications in the Byblos Android App.
                      </p>
                      <a
                        href={getAndroidDeepLink(orderNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 dark:bg-white text-xs font-bold text-white dark:text-slate-950 transition-all hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]"
                      >
                        Open App / Get on Google Play
                      </a>
                    </>
                  ) : getDevicePlatform() === 'ios' ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-700 dark:text-white/70">
                      Order updates will be sent via SMS & Email. Save your tracking link to check status anytime.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-700 dark:text-white/70">
                        Get the Byblos Android app on your phone for live GPS courier tracking.
                      </p>
                      <a
                        href={APP_DOWNLOAD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 dark:bg-white text-xs font-bold text-white dark:text-slate-950 transition-all hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]"
                      >
                        Get it on Google Play
                      </a>
                    </>
                  )}
                </div>
              )}
              <div className="mt-2 w-full space-y-2">
                <a
                  href="/buyer/orders"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-yellow-400 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.98]"
                >
                  View My Orders
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 w-full text-sm font-medium text-slate-600 dark:text-white/60 transition-colors hover:text-slate-950 dark:hover:text-white"
                >
                  Return to Shop
                </button>
              </div>
            </>
          )}

          {state === 'FAILED' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/20">
                <span className="text-sm font-bold text-red-700 dark:text-red-400">NO</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Payment Failed</h2>
              <p className="mb-4 text-xs leading-relaxed text-slate-600 dark:text-white/60">
                {failureReason || 'No charges were made. This could be due to insufficient balance, a wrong M-Pesa PIN, cancellation, or timeout.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  onCancelRetry?.();
                  onClose();
                }}
                className="h-11 w-full rounded-xl bg-yellow-400 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.98]"
              >
                Try Again
              </button>
            </>
          )}

          {state === 'TIMEOUT' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/20">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">...</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">Still Waiting for Confirmation</h2>
              {orderNumber && (
                <div className="mb-3 flex items-center gap-2 rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1">
                  <span className="text-xs text-slate-500 dark:text-white/50">Order:</span>
                  <span className="font-mono text-xs font-bold text-yellow-600 dark:text-yellow-400">#{orderNumber}</span>
                </div>
              )}
              <div className="mb-4 w-full rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50 dark:bg-amber-400/10 p-3 text-left">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  M-Pesa prompts expire after 2 minutes.
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/80">
                  If you already entered your PIN on your phone, tap <strong>Check Again</strong>.
                  If you missed or did not receive the prompt, tap <strong>Cancel & Try Again</strong> to safely release this order and request a fresh prompt.
                </p>
              </div>
              <div className="w-full space-y-2.5">
                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={isCancelling}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-yellow-400 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-50"
                >
                  I entered my PIN — Check Again
                </button>
                <button
                  type="button"
                  onClick={handleCancelAndRetry}
                  disabled={isCancelling}
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 dark:border-white/20 bg-transparent text-sm font-semibold text-slate-800 dark:text-white transition-all hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling prompt...
                    </>
                  ) : (
                    "Didn't get prompt? Cancel & Try Again"
                  )}
                </button>
                <div className="flex items-center justify-between pt-1">
                  <a
                    href="/buyer/orders"
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white underline underline-offset-2"
                  >
                    View My Orders
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};



