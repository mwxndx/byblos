import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { MapPin, Package, Store } from '@/shared/ui/icons';
import type { ApiOrder } from '@/shared/types';
import { getImageUrl } from '@/shared/utils/formatting';
import { canConfirmOrderReceipt, formatOrderCurrency, formatOrderDate, getConfirmReceiptLabel, getPaymentStatusBadge } from '@/features/orders/utils/ordersSectionUtils';
import { OrderStatusBadge } from '@/shared/ui/OrderStatusBadge';

interface OrderDetailsDialogProps {
  order: ApiOrder | null;
  serviceCharge: number;
  onClose: () => void;
  onViewImage: (image: string | null) => void;
  onConfirmReceiptClick: (orderId: string) => void;
}

export function OrderDetailsDialog({ order, serviceCharge, onClose, onViewImage, onConfirmReceiptClick }: Readonly<OrderDetailsDialogProps>) {
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] sm:max-w-xl bg-white dark:bg-[#1e1e22] border border-slate-200 dark:border-[#34343a] text-slate-950 dark:text-white rounded-[20px] p-5 sm:p-6 shadow-2xl transition-colors duration-200">
        {order && (
          <>
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-[#34343a] mx-auto mb-2" />
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">
                Order Details
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-[#a1a1a6]">
                {formatOrderDate(order)} · #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60dvh] overflow-y-auto pr-1">
              {/* Shop Details Card */}
              <div className="p-4 rounded-[14px] bg-slate-50 dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a1a1a6]">
                  <Store className="h-4 w-4 text-[#f5c518]" />
                  <span>Shop Details</span>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white text-base">
                    {order.seller?.shopName || order.seller?.name || 'Byblos Store'}
                  </p>
                  {order.seller?.location && (
                    <a
                      href={order.seller.location.startsWith('http') ? order.seller.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.seller.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#a1a1a6] hover:text-[#f5c518] transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>{order.seller.city ? `${order.seller.city} - ` : ''}{order.seller.location}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Items Card */}
              <div className="p-4 rounded-[14px] bg-slate-50 dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a1a1a6]">
                  Items ({order.items.length})
                </p>
                <div className="divide-y divide-slate-200 dark:divide-[#34343a]">
                  {order.items.map((item, idx) => (
                    <div key={item.id ?? `${item.name}-${idx}`} className="flex gap-3 py-2.5 items-center first:pt-0 last:pb-0">
                      {item.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => onViewImage(getImageUrl(item.imageUrl))}
                          aria-label={`View full-size image of ${item.name}`}
                          className="h-14 w-14 rounded-[10px] bg-slate-100 dark:bg-[#121214] overflow-hidden border border-slate-200 dark:border-[#34343a] flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={getImageUrl(item.imageUrl)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="h-14 w-14 rounded-[10px] bg-slate-100 dark:bg-[#121214] overflow-hidden border border-slate-200 dark:border-[#34343a] flex-shrink-0 flex items-center justify-center">
                          <Package className="h-6 w-6 text-slate-400 dark:text-[#8a8a91]" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate">{item.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-[#a1a1a6] mt-0.5">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white shrink-0">
                        {formatOrderCurrency(item.price * item.quantity, order.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address Card */}
              {order.shippingAddress && (
                <div className="p-4 rounded-[14px] bg-slate-50 dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#a1a1a6]">
                    Shipping To
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {order.shippingAddress.address}
                    {order.shippingAddress.city && `, ${order.shippingAddress.city}`}
                  </p>
                  {(order.customer?.phone || order.buyerMobilePayment) && (
                    <p className="text-xs text-slate-500 dark:text-[#a1a1a6]">
                      {order.customer?.phone || order.buyerMobilePayment}
                    </p>
                  )}
                </div>
              )}

              {/* Total Row */}
              <div className="p-4 rounded-[14px] bg-slate-50 dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-slate-900 dark:text-white">Total</span>
                  <p className="text-xs text-slate-500 dark:text-[#a1a1a6] mt-0.5">
                    Includes 2% Byblos charge{serviceCharge > 0 ? ` (${formatOrderCurrency(serviceCharge, order.currency)})` : ''}
                  </p>
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatOrderCurrency((order as unknown as Record<string, unknown>).total_amount as number || order.totalAmount, order.currency)}
                </span>
              </div>

              {/* Status Pills */}
              <div className="flex gap-2 pt-1">
                <OrderStatusBadge status={order.status} viewerRole="buyer" />
                {getPaymentStatusBadge(order.paymentStatus)}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2 sm:gap-2">
              {canConfirmOrderReceipt(order) && (
                <Button
                  className="h-12 w-full sm:w-auto rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity"
                  onClick={() => {
                    onConfirmReceiptClick(order.id);
                    onClose();
                  }}
                >
                  {getConfirmReceiptLabel(order)}
                </Button>
              )}
              <Button
                variant="outline"
                className="h-12 w-full sm:w-auto rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-transparent text-slate-800 dark:text-white font-semibold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                onClick={() => onClose()}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
