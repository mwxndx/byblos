import { useState } from 'react';
import type { ApiOrder } from '@/shared/types';
import { MzigoJourneyStepper } from '@/features/logistics/components/MzigoJourneyStepper';
import { useOrderTrackingState, type TrackingView } from './tracking/useOrderTrackingState';
import { OrderTrackingHeader } from './tracking/OrderTrackingHeader';
import { OrderTrackingHeadline } from './tracking/OrderTrackingHeadline';
import { OrderTrackingDetails } from './tracking/OrderTrackingDetails';

interface OrderLogisticsTrackingProps {
  order: ApiOrder;
  view: TrackingView;
  isPhysical?: boolean;
  formatCurrency: (value: number | undefined, currency?: string) => string;
}

export function OrderLogisticsTracking({
  order,
  view,
  isPhysical = true,
  formatCurrency,
}: OrderLogisticsTrackingProps) {
  const [isOpen, setIsOpen] = useState(true);
  const state = useOrderTrackingState(order, view, isPhysical);

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-yellow-400/30 bg-yellow-400/[0.08] text-label">
      {/* ── Single Master Dropdown Header ── */}
      <OrderTrackingHeader
        orderId={order.id}
        orderStatus={order.status}
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        state={state}
      />

      {/* ── Unified Dropdown Body ── */}
      {isOpen && (
        <div id={`logistics-unified-${order.id}`} className="space-y-3 border-t border-slate-200/60 dark:border-separator p-3 pt-3.5">
          {/* Tier 1: Visual Stepper */}
          <div className="rounded-xl border border-slate-200/80 dark:border-separator bg-white/70 dark:bg-black/40 px-3 py-3">
            <MzigoJourneyStepper journey={state.journey} />
          </div>

          {/* Dynamic Progress Bar & Live ETA Headline */}
          <OrderTrackingHeadline order={order} state={state} />

          {/* Specs Strip, Hub Collection Card, & Milestones */}
          <OrderTrackingDetails
            order={order}
            isSeller={state.isSeller}
            isDoorDelivery={state.isDoorDelivery}
            isPickup={state.isPickup}
            isPhysical={isPhysical}
            journey={state.journey}
            formatCurrency={formatCurrency}
          />
        </div>
      )}
    </section>
  );
}
