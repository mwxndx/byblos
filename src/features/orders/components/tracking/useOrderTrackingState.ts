import { useMemo } from 'react';
import type { ApiOrder } from '@/shared/types';
import {
  deriveOrderJourney,
  isRiderMoving,
  type Journey,
} from '@/features/logistics/utils/mzigoJourney';
import { useOrderLiveEtaQuery, type OrderLiveEta } from '@/features/logistics/hooks/useOrderLiveEtaQuery';
import { hasBuyerPaidDoorDelivery } from '@/features/seller/utils/sellerOrders.utils';

export type TrackingView = 'buyer' | 'seller';

export interface UseOrderTrackingStateResult {
  isSeller: boolean;
  isDoorDelivery: boolean;
  isPickup: boolean;
  isDigital: boolean;
  isService: boolean;
  journey: Journey;
  riderMoving: boolean;
  liveEta: OrderLiveEta | null | undefined;
  etaSource: string | null;
  dynamicProgressPercent: number;
}

function addHours(value: string | Date | undefined, hours: number): string | null {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function useOrderTrackingState(
  order: ApiOrder,
  view: TrackingView,
  isPhysical = true
): UseOrderTrackingStateResult {
  const isSeller = view === 'seller';
  const logistics = order.logistics;
  const deliveryLeg = logistics?.deliveryLeg || null;
  const pickupLeg = logistics?.pickupLeg || null;

  const fulfillmentType = String(order.fulfillment_type || '').toUpperCase();
  const orderType = String(order.order_type || order.orderType || '').toUpperCase();

  const isDoorDelivery = hasBuyerPaidDoorDelivery(order) || Boolean(order.shippingAddress?.address);
  const isDigital = orderType === 'DIGITAL' || Boolean(order.isDigital || order.items?.some((i) => i.productType === 'digital' || i.isDigital));
  const isService = orderType === 'SERVICE' || Boolean(order.items?.some((i) => i.productType === 'service'));
  const isPickup = !isDigital && !isService && (fulfillmentType === 'BUYER_TO_SELLER' || (!isDoorDelivery && isPhysical));

  const journey = useMemo(() => deriveOrderJourney(order), [order]);
  const riderMoving = isDoorDelivery && isRiderMoving(deliveryLeg);

  const isTrackingActive = isDoorDelivery && (riderMoving || deliveryLeg?.status === 'out_for_delivery' || pickupLeg?.status === 'started');
  const { data: liveEta } = useOrderLiveEtaQuery(order.id, Boolean(isTrackingActive));

  const fallbackDeadline = addHours(order.createdAt, 24);
  const etaSource = liveEta?.estimatedArrival || deliveryLeg?.deadlineAt || logistics?.deadlineAt || fallbackDeadline;

  const dynamicProgressPercent = useMemo(() => {
    if (journey.isDelivered || order.status === 'COMPLETED') return 100;
    if (liveEta && typeof liveEta.routeProgress === 'number' && liveEta.routeProgress > 0) {
      return Math.round(liveEta.routeProgress * 100);
    }
    return journey.percentProgress;
  }, [journey.isDelivered, journey.percentProgress, order.status, liveEta]);

  return {
    isSeller,
    isDoorDelivery,
    isPickup,
    isDigital,
    isService,
    journey,
    riderMoving,
    liveEta,
    etaSource,
    dynamicProgressPercent,
  };
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Pending schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending schedule';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
