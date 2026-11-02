import { useState } from 'react';
import { Card, CardContent } from '@/shared/ui/card';
import { OrderStatusBadge } from '@/shared/ui/OrderStatusBadge';
import { Check, ChevronDown, Download, Loader2, ShieldCheck } from '@/shared/ui/icons';
import type { ApiOrder } from '@/shared/types';
import { cn, getImageUrl } from '@/shared/utils/formatting';
import { getOrderInstruction } from '@/features/orders/utils/orderInstructions';
import { OrderLogisticsTracking } from './OrderLogisticsTracking';
import {
  canConfirmOrderReceipt,
  formatOrderCurrency,
  formatOrderDate,
  getConfirmReceiptLabel,
  getBuyerServiceCharge,
  getPaymentStatusBadge,
  isDigitalOrder,
  isPaidOrder,
  isServiceOrder
} from '@/features/orders/utils/ordersSectionUtils';

interface BuyerOrderCardProps {
  order: ApiOrder;
  downloadingOrderId: string | null;
  downloadProgress: Record<string, number>;
  onViewDetails: (order: ApiOrder) => void;
  onConfirmReceipt: (orderId: string) => void;
  onDownload: (order: ApiOrder) => void;
}

function deriveBuyerOrderProductType(order: ApiOrder, isService: boolean, isDigital: boolean): string {
  if (order.order_type) return order.order_type;
  if (order.orderType) return order.orderType;
  if (isService) return 'SERVICE';
  if (isDigital) return 'DIGITAL';
  return order.items[0]?.productType || 'PHYSICAL';
}

export function BuyerOrderCard({
  order,
  downloadingOrderId,
  downloadProgress,
  onViewDetails,
  onConfirmReceipt,
  onDownload,
}: Readonly<BuyerOrderCardProps>) {
  const mainItem = order.items.find(item => item.imageUrl) || order.items[0];
  const mainImage = mainItem?.imageUrl ? getImageUrl(mainItem.imageUrl) : null;
  const isService = isServiceOrder(order);
  const isDigital = isDigitalOrder(order);
  const productType = deriveBuyerOrderProductType(order, isService, isDigital);
  const canConfirmReceipt = canConfirmOrderReceipt(order);
  const buyerServiceCharge = getBuyerServiceCharge(order);
  const instruction = getOrderInstruction({
    status: order.status,
    userRole: 'buyer',
    orderType: productType.toUpperCase(),
    fulfillmentType: order.fulfillment_type,
  });

  const [expanded, setExpanded] = useState(false);
  const itemCount = order.items?.length || 0;
  const extraCount = itemCount > 1 ? itemCount - 1 : 0;
  const summaryName = mainItem?.name || `#${order.orderNumber || order.id.slice(0, 8).toUpperCase()}`;

  const shopName = order.seller?.shopName || order.seller?.name || 'Shop';
  const shopInitial = shopName.trim().charAt(0).toUpperCase();

  return (
    <Card className="overflow-hidden transition-all duration-200 bg-white dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] rounded-[16px] shadow-sm">
      <CardContent className="p-0">
        {/* Top bar with shop avatar + name, order number, and status */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-[#34343a]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-[#34343a] bg-slate-100 dark:bg-[#121214] flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white">
              {mainImage ? (
                <img src={mainImage} alt={shopName} className="h-full w-full object-cover" />
              ) : (
                <span>{shopInitial}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {shopName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#a1a1a6] font-medium">
                #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <OrderStatusBadge status={order.status} viewerRole="buyer" />
            {getPaymentStatusBadge(order.paymentStatus)}
          </div>
        </div>

        {/* 3-column Meta Grid: Items, Placed, Total */}
        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-[12px] bg-slate-50 dark:bg-[#121214] border border-slate-100 dark:border-[#34343a]/50 text-center">
            <div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#a1a1a6] font-medium">Items</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#a1a1a6] font-medium">Placed</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {formatOrderDate(order)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#a1a1a6] font-medium">Total</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {formatOrderCurrency((order as unknown as Record<string, unknown>).total_amount as number || order.totalAmount, order.currency)}
              </p>
            </div>
          </div>

          {/* Escrow note with shield icon */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#a1a1a6] px-1">
            <ShieldCheck className="h-4 w-4 text-[#f5c518] shrink-0" />
            <span className="leading-snug">
              {canConfirmReceipt
                ? 'Confirm receipt to release payment to the seller.'
                : 'Your funds are held securely in escrow until delivery is confirmed.'}
            </span>
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {canConfirmReceipt && (
              <button
                type="button"
                onClick={() => onConfirmReceipt(order.id)}
                className="h-10 px-4 rounded-[12px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                <span>{getConfirmReceiptLabel(order)}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onViewDetails(order)}
              className="h-10 px-4 rounded-[12px] border border-slate-200 dark:border-[#34343a] bg-transparent text-slate-800 dark:text-white font-semibold text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              View Details
            </button>

            {isPaidOrder(order) && isDigitalOrder(order) && (
              <button
                type="button"
                onClick={() => onDownload(order)}
                disabled={downloadingOrderId === order.id}
                className="h-10 px-4 rounded-[12px] bg-[#f5c518] text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                {downloadingOrderId === order.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>
                      {downloadProgress[order.id] !== undefined
                        ? `Downloading ${downloadProgress[order.id]}%`
                        : 'Preparing...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="ml-auto h-10 px-3 rounded-[12px] text-xs font-semibold text-slate-500 dark:text-[#a1a1a6] hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>{expanded ? 'Hide Tracking' : 'Track'}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          </div>

          {/* Expanded logistics tracking & items */}
          {expanded && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#34343a]/70 space-y-3">
              {instruction && (
                <div
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors',
                    instruction.color === 'blue' && 'bg-blue-50 text-blue-950 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-500/30',
                    instruction.color === 'amber' && 'bg-amber-50 text-amber-950 border-amber-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-500/30',
                    instruction.color === 'green' && 'bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500/30',
                    instruction.color === 'red' && 'bg-red-50 text-red-950 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-500/30',
                  )}
                >
                  {instruction.text}
                </div>
              )}

              <OrderLogisticsTracking
                order={order}
                view="buyer"
                isPhysical={productType.toLowerCase() === 'physical'}
                formatCurrency={(value, currency) => formatOrderCurrency(value || 0, currency || order.currency)}
              />

              <div className="space-y-2 pt-1">
                {order.items.map((item, idx) => (
                  <div
                    key={item.id ?? `${item.name}-${idx}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-[10px] bg-slate-50 dark:bg-[#121214] border border-slate-100 dark:border-[#34343a]/50 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-slate-500 dark:text-[#a1a1a6]">Qty: {item.quantity || 1}</p>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white shrink-0">
                      {formatOrderCurrency(item.price || 0, order.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
