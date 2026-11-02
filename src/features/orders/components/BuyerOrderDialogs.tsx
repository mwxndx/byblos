import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { AlertTriangle, RefreshCw, ShieldCheck, XCircle } from '@/shared/ui/icons';
import type { ApiOrder } from '@/shared/types';
import { getBuyerServiceCharge, isServiceOrder } from '@/features/orders/utils/ordersSectionUtils';
import { OrderDetailsDialog } from './OrderDetailsDialog';

interface BuyerOrderDialogsProps {
  orders: ApiOrder[];
  currentOrderId: string | null;
  isConfirming: string | null;
  isCancelling: string | null;
  showCancelDialog: boolean;
  showReceiptDialog: boolean;
  selectedOrderForDetails: ApiOrder | null;
  viewingImage: string | null;
  onCancelDialogChange: (open: boolean) => void;
  onReceiptDialogChange: (open: boolean) => void;
  onSelectedOrderChange: (order: ApiOrder | null) => void;
  onViewingImageChange: (image: string | null) => void;
  onCancelOrder: () => void;
  onConfirmReceipt: () => void;
  onConfirmReceiptClick: (orderId: string) => void;
}

export function BuyerOrderDialogs({
  orders,
  currentOrderId,
  isConfirming,
  isCancelling,
  showCancelDialog,
  showReceiptDialog,
  selectedOrderForDetails,
  viewingImage,
  onCancelDialogChange,
  onReceiptDialogChange,
  onSelectedOrderChange,
  onViewingImageChange,
  onCancelOrder,
  onConfirmReceipt,
  onConfirmReceiptClick
}: BuyerOrderDialogsProps) {
  const currentOrder = orders.find(order => order.id === currentOrderId) || null;
  const currentIsService = isServiceOrder(currentOrder);
  const currentFulfillmentType = currentOrder?.fulfillment_type?.toUpperCase() || '';
  const currentIsHubCollection = currentOrder && !currentIsService && ['COURIER', 'SELLER_TO_HUB'].includes(currentFulfillmentType);
  const showPhysicalReceiptLocation = Boolean(currentIsHubCollection);
  const selectedOrderServiceCharge = getBuyerServiceCharge(selectedOrderForDetails);

  const confirmationContent = currentIsService ? (
    <div className="space-y-2 text-center">
      <p className="text-sm text-slate-600 dark:text-[#a1a1a6] leading-relaxed">
        By clicking <strong>Confirm Receipt</strong>, you confirm that the service was completed. Once confirmed, funds will be released to the provider.
      </p>
    </div>
  ) : (
    <div className="space-y-2 text-center">
      <p className="text-sm text-slate-600 dark:text-[#a1a1a6] leading-relaxed">
        By clicking Confirm Receipt, you confirm you received your order. Once confirmed, funds will be released to the provider.
      </p>
      {showPhysicalReceiptLocation && (
        <p className="text-xs text-slate-500 dark:text-[#8a8a91] pt-1">
          Collection location: <strong>{currentOrder?.seller?.physicalAddress || 'Dynamic Mall, Tom Mboya St, Nairobi | Shop SL 32'}</strong>
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* ── Cancel Order Dialog matching Penpot ── */}
      <Dialog open={showCancelDialog} onOpenChange={onCancelDialogChange}>
        <DialogContent className="w-[92vw] sm:max-w-[360px] bg-white dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] text-slate-950 dark:text-white rounded-[20px] p-6 shadow-2xl transition-colors duration-200 text-center">
          <div className="w-14 h-14 rounded-full bg-[#ff5a52]/15 border border-[#ff5a52]/30 flex items-center justify-center mx-auto text-[#ff5a52] mb-3">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
              Cancel Order
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-[#a1a1a6] leading-relaxed text-center">
              Are you sure you want to cancel this order? This action cannot be undone. You will receive a refund to your account balance.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5 flex flex-col gap-2.5 sm:flex-col sm:space-x-0">
            <button
              type="button"
              onClick={onCancelOrder}
              disabled={isCancelling === currentOrderId}
              className="h-14 w-full rounded-[14px] bg-[#ff5a52] text-white font-semibold text-base hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCancelling === currentOrderId ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                'Cancel Order'
              )}
            </button>
            <button
              type="button"
              onClick={() => onCancelDialogChange(false)}
              disabled={isCancelling === currentOrderId}
              className="h-14 w-full rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-transparent text-slate-800 dark:text-white font-semibold text-base hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              No, Keep Order
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderDetailsDialog
        order={selectedOrderForDetails}
        serviceCharge={selectedOrderServiceCharge}
        onClose={() => onSelectedOrderChange(null)}
        onViewImage={onViewingImageChange}
        onConfirmReceiptClick={onConfirmReceiptClick}
      />

      {/* ── Confirm Delivery Dialog matching Penpot ── */}
      <Dialog open={showReceiptDialog} onOpenChange={onReceiptDialogChange}>
        <DialogContent className="w-[92vw] sm:max-w-[360px] bg-white dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] text-slate-950 dark:text-white rounded-[20px] p-6 shadow-2xl transition-colors duration-200 text-center">
          <div className="w-14 h-14 rounded-full bg-[#30d158]/15 border border-[#30d158]/30 flex items-center justify-center mx-auto text-[#30d158] mb-3">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
              Delivery Confirmation
            </DialogTitle>
            <DialogDescription asChild>
              {confirmationContent}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5 flex flex-col gap-2.5 sm:flex-col sm:space-x-0">
            <button
              type="button"
              onClick={onConfirmReceipt}
              disabled={isConfirming === currentOrderId}
              className="h-14 w-full rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isConfirming === currentOrderId ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                'Confirm Receipt'
              )}
            </button>
            <button
              type="button"
              onClick={() => onReceiptDialogChange(false)}
              disabled={isConfirming === currentOrderId}
              className="h-14 w-full rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-transparent text-slate-800 dark:text-white font-semibold text-base hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Not Yet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Preview Modal ── */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && onViewingImageChange(null)}>
        <DialogContent className="sm:max-w-3xl bg-transparent border-0 shadow-none p-0 flex items-center justify-center pointer-events-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Order Item Image Preview</DialogTitle>
            <DialogDescription>Enlarged view of the ordered product image</DialogDescription>
          </DialogHeader>
          <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => onViewingImageChange(null)}
              className="absolute -top-10 right-0 sm:-right-10 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors border border-white/20"
            >
              <XCircle className="h-6 w-6" />
            </button>
            {viewingImage && (
              <img
                src={viewingImage}
                alt="Full View"
                className="max-h-[85dvh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
