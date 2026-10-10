import { ReactNode } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  PackageSearch,
  Store,
  Truck,
} from '@/shared/ui/icons';
import { cn } from '@/shared/utils/formatting';
import type { UseOrderTrackingStateResult } from './useOrderTrackingState';

interface OrderTrackingHeaderProps {
  orderId: string | number;
  orderStatus: string;
  isOpen: boolean;
  onToggle: () => void;
  state: UseOrderTrackingStateResult;
}

export function OrderTrackingHeader({
  orderId,
  orderStatus,
  isOpen,
  onToggle,
  state,
}: OrderTrackingHeaderProps) {
  const { isSeller, isDoorDelivery, isPickup, isDigital, journey, riderMoving, liveEta } = state;

  const headerTitle = getHeaderTitle(isSeller, isDoorDelivery, isPickup, isDigital);
  const headerIcon = getHeaderIcon(isDoorDelivery, isPickup, isDigital);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={`logistics-unified-${orderId}`}
      className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-fill"
    >
      <span className="text-yellow-600 dark:text-yellow-400">{headerIcon}</span>
      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{headerTitle}</span>

      <span className="ml-auto flex items-center gap-2 shrink-0">
        {riderMoving ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-100 text-yellow-900 font-bold dark:border-yellow-400/50 dark:bg-yellow-400/20 dark:text-yellow-200 px-2.5 py-0.5 text-[11px]">
            <Truck className="h-3 w-3 animate-pulse text-yellow-700 dark:text-yellow-300" />
            {liveEta?.trackingStatus === 'arriving'
              ? 'Arriving Now'
              : typeof liveEta?.etaMinutes === 'number'
                ? `In Transit • ${liveEta.etaMinutes}m`
                : 'In Transit'}
          </span>
        ) : journey.isDelivered || orderStatus === 'COMPLETED' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-100 text-emerald-900 font-bold dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-200 px-2.5 py-0.5 text-[11px] shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
            {isSeller ? 'Delivered & Released' : journey.label}
          </span>
        ) : isPickup && (orderStatus === 'READY_FOR_BUYER' || orderStatus === 'COLLECTION_PENDING') ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-100 text-yellow-900 font-bold dark:border-yellow-400/50 dark:bg-yellow-400/20 dark:text-yellow-200 px-2.5 py-0.5 text-[11px]">
            {isSeller ? 'Waiting for Buyer' : 'Ready for Pickup'}
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-white/90 text-slate-800 dark:border-separator dark:bg-black/70 dark:text-yellow-100 px-2.5 py-0.5 text-[11px] font-semibold">
            {journey.label}
          </span>
        )}

        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 dark:text-white/60 transition-transform duration-200', isOpen && 'rotate-180')} />
      </span>
    </button>
  );
}

function getHeaderTitle(isSeller: boolean, isDoorDelivery: boolean, isPickup: boolean, isDigital: boolean): string {
  if (isSeller) {
    if (isDoorDelivery) return 'Dispatch & Delivery Tracking';
    if (isPickup) return 'Hub Collection Tracking';
    if (isDigital) return 'Digital Order Fulfillment';
    return 'Service Appointment Tracking';
  }
  if (isDoorDelivery) return 'Delivery & Logistics Tracking';
  if (isPickup) return 'Collection & Logistics Progress';
  if (isDigital) return 'Digital Fulfillment';
  return 'Service Tracking';
}

function getHeaderIcon(isDoorDelivery: boolean, isPickup: boolean, isDigital: boolean): ReactNode {
  if (isDoorDelivery) return <Truck className="h-4 w-4" />;
  if (isPickup) return <Store className="h-4 w-4" />;
  if (isDigital) return <Download className="h-4 w-4" />;
  return <PackageSearch className="h-4 w-4" />;
}
