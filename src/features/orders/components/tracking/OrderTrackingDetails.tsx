import { Navigation, ShieldCheck, Store, Truck, Clock } from '@/shared/ui/icons';
import { MZIGO_CBD_HUB, type Journey } from '@/features/logistics/utils/mzigoJourney';
import type { ApiOrder } from '@/shared/types';
import { formatDateTime } from './useOrderTrackingState';

interface OrderTrackingDetailsProps {
  order: ApiOrder;
  isSeller: boolean;
  isDoorDelivery: boolean;
  isPickup: boolean;
  isPhysical: boolean;
  journey: Journey;
  formatCurrency: (value: number | undefined, currency?: string) => string;
}

function label(value?: string | null) {
  return String(value || 'pending').replace(/_/g, ' ');
}

export function OrderTrackingDetails({
  order,
  isSeller,
  isDoorDelivery,
  isPickup,
  isPhysical,
  journey,
  formatCurrency,
}: OrderTrackingDetailsProps) {
  const logistics = order.logistics;
  const deliveryLeg = logistics?.deliveryLeg;

  return (
    <>
      {/* Tier 2: Specs Strip (Door Delivery vs. Hub Collection) */}
      {isDoorDelivery && (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200/80 dark:border-separator bg-white/70 dark:bg-black/40 p-2.5 sm:p-3">
            <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/55">
              <Truck className="h-3 w-3 text-yellow-600 dark:text-yellow-300" />
              {isSeller ? 'Logistics Type' : 'Fulfillment Mode'}
            </p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Door Delivery</p>
            <p className="text-[11px] text-slate-600 dark:text-white/70">
              {isSeller ? 'Store ➔ Hub ➔ Buyer' : 'Handled by Mzigo Ego'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200/80 dark:border-separator bg-white/70 dark:bg-black/40 p-2.5 sm:p-3">
            <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/55">
              <Store className="h-3 w-3 text-yellow-600 dark:text-yellow-300" />
              Central Transit Hub
            </p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{MZIGO_CBD_HUB.name}</p>
            <p className="text-[11px] text-slate-600 dark:text-white/70 truncate">{MZIGO_CBD_HUB.address}</p>
          </div>

          <div className="rounded-lg border border-slate-200/80 dark:border-separator bg-white/70 dark:bg-black/40 p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/55">
              {isSeller ? 'Escrow Status' : 'Delivery Fee'}
            </p>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
              {isSeller
                ? journey.isDelivered || order.status === 'COMPLETED'
                  ? 'Funds Released'
                  : 'Held in Escrow'
                : formatCurrency(deliveryLeg?.feeAmount || 0, deliveryLeg?.feeCurrency || order.currency)}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-white/70">
              {isSeller
                ? journey.isDelivered || order.status === 'COMPLETED'
                  ? 'Settled to wallet'
                  : 'Unlocks upon delivery'
                : 'Paid by customer'}
            </p>
          </div>
        </div>
      )}

      {/* Central Hub Collection Point Card if pickup */}
      {isPickup && (
        <div className="rounded-lg border border-slate-200/80 dark:border-separator bg-white/70 dark:bg-black/40 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
                <Store className="h-3.5 w-3.5" />
                Central Hub Collection Point
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {MZIGO_CBD_HUB.name}
              </p>
              <p className="text-xs text-slate-600 dark:text-white/70">{MZIGO_CBD_HUB.address} • Mon - Sat (8:00 AM - 7:00 PM)</p>
              {isSeller ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  Handoff package to Central Hub. Escrow releases automatically once buyer collects.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-700 dark:text-yellow-200/90 font-medium">
                  Bring your Order ID or phone number for instant package release.
                </p>
              )}
            </div>

            {!isSeller && (
              <a
                href={MZIGO_CBD_HUB.mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 sm:mt-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-800 dark:text-yellow-200 hover:bg-yellow-500/20 shrink-0 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" /> Get Directions
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tier 3: Milestones Timeline & Security Notice */}
      {isPhysical && (
        <div className="rounded-xl border border-slate-200/80 dark:border-separator bg-white/60 dark:bg-black/35 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/55">
            <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-300" />
            {isSeller ? 'Dispatch & Audit Trail' : isDoorDelivery ? 'Fulfillment Milestones' : 'Collection Timeline'}
          </p>

          <OrderTrackingTimeline events={logistics?.events || []} />

          <p className="mt-3 flex items-start gap-2 text-xs text-slate-600 dark:text-white/70 border-t border-slate-200/60 dark:border-separator pt-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            {isSeller
              ? 'Settlement Notice: Your earnings unlock automatically upon verified delivery receipt.'
              : 'Mzigo Ego Central Hub handles verification, package security, and milestone tracking.'}
          </p>
        </div>
      )}
    </>
  );
}

function OrderTrackingTimeline({ events }: { events: NonNullable<ApiOrder['logistics']>['events'] }) {
  if (!events?.length) {
    return (
      <p className="rounded-lg border border-separator bg-black/40 px-3 py-2 text-xs text-label-2">
        Updates will appear here as fulfillment progresses.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.slice(-5).reverse().map((event) => (
        <div key={`${event.id}-${event.createdAt}`} className="flex gap-2 rounded-lg border border-separator bg-black/40 p-2">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-300" />
          <div className="min-w-0">
            <p className="text-xs font-semibold capitalize text-label">{label(event.status || event.type)}</p>
            {event.message && <p className="text-xs text-label-2">{event.message}</p>}
            <p className="mt-0.5 text-[10px] text-label-2">{formatDateTime(event.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
