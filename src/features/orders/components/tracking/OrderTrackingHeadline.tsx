import { Clock } from '@/shared/ui/icons';
import { cn } from '@/shared/utils/formatting';
import type { UseOrderTrackingStateResult } from './useOrderTrackingState';
import { formatDateTime } from './useOrderTrackingState';
import type { ApiOrder } from '@/shared/types';

interface OrderTrackingHeadlineProps {
  order: ApiOrder;
  state: UseOrderTrackingStateResult;
}

export function OrderTrackingHeadline({ order, state }: OrderTrackingHeadlineProps) {
  const { isSeller, isDoorDelivery, isPickup, isDigital, journey, liveEta, etaSource, dynamicProgressPercent, riderMoving } = state;
  const deliveryLeg = order.logistics?.deliveryLeg;
  const logistics = order.logistics;

  const headlineText = getHeadlineText({
    isSeller,
    isDoorDelivery,
    isPickup,
    isDigital,
    journey,
    order,
    deliveryLeg,
    logistics,
    liveEta,
    etaSource,
    riderMoving,
  });

  return (
    <>
      {/* Dynamic Movement Progress Bar */}
      <div className="overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 p-0.5">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all duration-500',
            journey.state === 'attention'
              ? 'bg-red-500'
              : journey.state === 'delayed'
                ? 'bg-amber-500'
                : journey.isDelivered || order.status === 'COMPLETED'
                  ? 'bg-emerald-500'
                  : riderMoving
                    ? 'bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-400 animate-pulse'
                    : 'bg-yellow-500 dark:bg-yellow-400'
          )}
          style={{ width: `${Math.min(100, Math.max(8, dynamicProgressPercent))}%` }}
        />
      </div>

      {/* Live ETA & Status Headline Card */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200/80 dark:border-separator bg-white/70 dark:bg-black/40 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-300" />
          <span className="text-slate-900 dark:text-white font-medium text-xs sm:text-sm">
            {headlineText}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {liveEta?.isStale && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">
              Location update delayed
            </span>
          )}
          <span className="text-xs text-slate-600 dark:text-white/70">
            {liveEta?.lastUpdatedAt && !liveEta.isStale
              ? 'Updated just now'
              : journey.detail}
          </span>
        </div>
      </div>
    </>
  );
}

function getHeadlineText(params: {
  isSeller: boolean;
  isDoorDelivery: boolean;
  isPickup: boolean;
  isDigital: boolean;
  journey: UseOrderTrackingStateResult['journey'];
  order: ApiOrder;
  deliveryLeg?: { completedAt?: string | number | null } | null;
  logistics?: { completedAt?: string | number | null } | null;
  liveEta?: { trackingStatus?: string; etaMinutes?: number; estimatedArrival?: string | number | null } | null;
  etaSource: string | null;
  riderMoving: boolean;
}): string {
  const { isSeller, isDoorDelivery, isPickup, isDigital, journey, order, deliveryLeg, logistics, liveEta, etaSource, riderMoving } = params;

  if (journey.isDelivered || order.status === 'COMPLETED') {
    const timeStr = formatDateTime(String(deliveryLeg?.completedAt || logistics?.completedAt || order.updatedAt || ''));
    return isSeller
      ? `Delivered on ${timeStr} — Escrow released`
      : `${isPickup ? 'Collected' : 'Delivered'} on ${timeStr}`;
  }

  if (liveEta?.trackingStatus === 'arriving') {
    return isSeller ? 'Rider arriving at buyer destination now' : 'Arriving now (within 1 min)';
  }

  if (liveEta && typeof liveEta.etaMinutes === 'number') {
    const formattedEta = formatDateTime(String(liveEta.estimatedArrival || etaSource || ''));
    return isSeller
      ? `Rider en route to buyer • ETA ~${liveEta.etaMinutes} min (by ${formattedEta})`
      : `Arriving in ${liveEta.etaMinutes} min (by ${formattedEta})`;
  }

  if (isDoorDelivery) {
    const formattedEta = formatDateTime(etaSource);
    if (isSeller) {
      return riderMoving
        ? `En route to customer • Est. ${formattedEta}`
        : `Preparing for dispatch • Est. delivery ${formattedEta}`;
    }
    return riderMoving
      ? `Arriving by ${formattedEta}`
      : `Est. delivery by ${formattedEta}`;
  }

  if (isPickup) {
    const isReady = order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING';
    if (isReady) {
      return isSeller
        ? 'Parcel securely held at Central Hub — Buyer notified to collect'
        : 'Ready for collection at Central Hub';
    }
    return isSeller
      ? 'Awaiting handoff to Central Hub for collection'
      : 'Estimated ready within 24 hours';
  }

  return isDigital ? 'Instant access available' : 'Booking active';
}
