import type { LogisticsLeg, LogisticsRequestCard } from '@/features/logistics/api';
import type { ApiOrder, ApiOrderLogisticsDeliveryLeg } from '@/shared/types';
import { hasBuyerPaidDoorDelivery } from '@/features/seller/utils/sellerOrders.utils';
import {
  DOOR_DELIVERY_JOURNEY_STEPS,
  HUB_COLLECTION_JOURNEY_STEPS,
  DIGITAL_JOURNEY_STEPS,
  SERVICE_JOURNEY_STEPS,
  hasStatusKeyword,
  type Journey,
  type JourneyState,
} from './mzigoJourney.types';

export function isRiderMoving(deliveryLeg?: ApiOrderLogisticsDeliveryLeg | LogisticsLeg | null): boolean {
  if (!deliveryLeg) return false;
  const status = String(deliveryLeg.status || '').toLowerCase();
  return status === 'out_for_delivery' || Boolean((deliveryLeg as any).startedAt && status !== 'delivered' && status !== 'failed');
}

export function isPickupTrackable(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  if (/picked|dropped|failed|cancelled/.test(s)) return false;
  return /assigned|started|out_for_pickup|en_route/.test(s);
}

export function isDeliveryTrackable(status: string | null | undefined): boolean {
  return /out_for_delivery|out for delivery/.test(String(status || '').toLowerCase());
}

export function requestHasDoorDelivery(request: LogisticsRequestCard): boolean {
  return Boolean(request.deliveryLeg);
}

/**
 * Shared journey logic for courier door deliveries (Seller -> Mzigo Hub -> Buyer).
 */
export function deriveJourneyFromStatuses(
  pickup: string | null | undefined,
  delivery: string | null | undefined,
  completed = false,
  pickupDeadline?: string | null,
  deliveryDeadline?: string | null,
): Journey {
  const isCompleted = completed || hasStatusKeyword(delivery, 'delivered');
  const failed = hasStatusKeyword(pickup, 'failed') || hasStatusKeyword(delivery, 'failed');
  const delayed = hasStatusKeyword(pickup, 'delayed') || hasStatusKeyword(delivery, 'delayed');
  const riderInMotion = hasStatusKeyword(delivery, 'out_for_delivery', 'out for');
  const atHub = hasStatusKeyword(pickup, 'picked_up', 'dropped', 'hub') || hasStatusKeyword(delivery, 'courier', 'assigned');

  let stepIndex = 0;
  let percentProgress = 15;
  let activeLeg: Journey['activeLeg'] = 'seller_to_hub';
  let activeEta = pickupDeadline || deliveryDeadline || null;

  if (isCompleted || hasStatusKeyword(delivery, 'delivered')) {
    stepIndex = 3;
    percentProgress = 100;
    activeLeg = 'completed';
    activeEta = deliveryDeadline || null;
  } else if (riderInMotion) {
    stepIndex = 2;
    percentProgress = 75;
    activeLeg = 'hub_to_buyer';
    activeEta = deliveryDeadline || null;
  } else if (atHub) {
    stepIndex = 1;
    percentProgress = 45;
    activeLeg = 'hub';
    activeEta = deliveryDeadline || null;
  } else {
    stepIndex = 0;
    percentProgress = 15;
    activeLeg = 'seller_to_hub';
    activeEta = pickupDeadline || deliveryDeadline || null;
  }

  let state: JourneyState = 'normal';
  if (failed) state = 'attention';
  else if (delayed) state = 'delayed';

  const isDelivered = stepIndex === 3 && state === 'normal';

  return {
    stepIndex,
    steps: DOOR_DELIVERY_JOURNEY_STEPS,
    state,
    label: journeyLabel(stepIndex, state),
    detail: journeyDetail(stepIndex, state),
    isDelivered,
    isRiderMoving: riderInMotion,
    activeLeg,
    activeEta,
    percentProgress,
  };
}

function journeyLabel(stepIndex: number, state: JourneyState): string {
  if (state === 'attention') return 'Needs attention';
  if (state === 'delayed') return 'Running late';
  return DOOR_DELIVERY_JOURNEY_STEPS[stepIndex]?.label ?? 'Seller Handoff';
}

function journeyDetail(stepIndex: number, state: JourneyState): string {
  if (state === 'attention') return 'A pickup or delivery step could not be completed. Follow up with the courier.';
  if (state === 'delayed') return 'The package is taking longer than usual. It is still on track.';
  switch (stepIndex) {
    case 3: return 'Delivered to destination and checked against order.';
    case 2: return 'Rider has departed Mzigo CBD Hub and is en route to your delivery address.';
    case 1: return 'Package verified at Byblos CBD Hub (Shop SL 32, Dynamic Mall). Preparing for dispatch.';
    default: return 'Seller is preparing your package for handoff to Mzigo Ego Hub.';
  }
}

export function deriveHubCollectionJourney(request: LogisticsRequestCard, completed: boolean): Journey {
  const pickup = request.pickupLeg?.status;
  const collected = completed || hasStatusKeyword(pickup, 'collected') || String(request.order.status || '').toUpperCase() === 'COMPLETED';
  const atHub = hasStatusKeyword(pickup, 'dropped', 'hub');
  const enRoute = hasStatusKeyword(pickup, 'picked_up');
  const failed = hasStatusKeyword(pickup, 'failed');
  const delayed = hasStatusKeyword(pickup, 'delayed');

  let stepIndex = 0;
  let percentProgress = 15;
  let activeLeg: Journey['activeLeg'] = 'seller_to_hub';
  if (collected) { stepIndex = 3; percentProgress = 100; activeLeg = 'completed'; }
  else if (atHub) { stepIndex = 2; percentProgress = 70; activeLeg = 'hub_to_buyer'; }
  else if (enRoute) { stepIndex = 1; percentProgress = 45; activeLeg = 'hub'; }

  let state: JourneyState = 'normal';
  if (failed) state = 'attention';
  else if (delayed) state = 'delayed';

  return {
    stepIndex,
    steps: HUB_COLLECTION_JOURNEY_STEPS,
    state,
    label: hubCollectionLabel(stepIndex, state),
    detail: hubCollectionDetail(stepIndex, state),
    isDelivered: stepIndex === 3 && state === 'normal',
    activeLeg,
    activeEta: request.pickupLeg?.deadlineAt || request.deadlineAt || null,
    percentProgress,
  };
}

function hubCollectionLabel(stepIndex: number, state: JourneyState): string {
  if (state === 'attention') return 'Needs attention';
  if (state === 'delayed') return 'Running late';
  return HUB_COLLECTION_JOURNEY_STEPS[stepIndex]?.label ?? 'Seller Handoff';
}

function hubCollectionDetail(stepIndex: number, state: JourneyState): string {
  if (state === 'attention') return 'A pickup step could not be completed. Follow up with the courier.';
  if (state === 'delayed') return 'The package is taking longer than usual. It is still on track.';
  switch (stepIndex) {
    case 3: return 'Buyer collected the package at the Mzigo hub.';
    case 2: return 'Package is at the Mzigo hub, ready for the buyer to collect.';
    case 1: return 'Rider has picked up from the seller and is heading to the hub.';
    default: return 'Seller is preparing the package for handoff to the Mzigo hub.';
  }
}

export function resolveDigitalOrderJourney(order: ApiOrder): Journey {
  const isReady = order.status === 'PAID' || order.status === 'COMPLETED' || order.status === 'READY_FOR_BUYER';
  return {
    stepIndex: isReady ? 1 : 0,
    steps: DIGITAL_JOURNEY_STEPS,
    state: 'normal',
    label: isReady ? 'Download Ready' : 'Payment Processing',
    detail: isReady ? 'Your digital purchase is ready for instant download.' : 'Verifying payment for your digital items.',
    isDelivered: isReady,
    activeLeg: isReady ? 'completed' : 'hub',
    percentProgress: isReady ? 100 : 50,
  };
}

export function resolveServiceOrderJourney(order: ApiOrder): Journey {
  const isCompleted = order.status === 'COMPLETED';
  const isFulfilling = order.status === 'FULFILLING' || order.status === 'PROCESSING';
  const stepIndex = isCompleted ? 2 : isFulfilling ? 1 : 0;
  return {
    stepIndex,
    steps: SERVICE_JOURNEY_STEPS,
    state: 'normal',
    label: isCompleted ? 'Completed' : isFulfilling ? 'In Progress' : 'Booking Confirmed',
    detail: isCompleted
      ? 'Service rendered and confirmed.'
      : isFulfilling
        ? 'Seller is currently providing the booked service.'
        : 'Service booking is confirmed and scheduled.',
    isDelivered: isCompleted,
    activeLeg: isCompleted ? 'completed' : 'hub',
    percentProgress: isCompleted ? 100 : isFulfilling ? 60 : 25,
  };
}

export function resolveHubCollectionOrderJourney(order: ApiOrder): Journey {
  const pickupLeg = order.logistics?.pickupLeg;
  const collectedByHub = hasStatusKeyword(pickupLeg?.status, 'collected');
  const isCompleted = order.status === 'COMPLETED' || collectedByHub;
  const isReady = order.status === 'READY_FOR_BUYER' || order.status === 'COLLECTION_PENDING';
  const isAtHub = hasStatusKeyword(pickupLeg?.status, 'picked_up', 'dropped', 'hub') || isReady;
  const stepIndex = isCompleted ? 3 : isReady ? 2 : isAtHub ? 1 : 0;

  return {
    stepIndex,
    steps: HUB_COLLECTION_JOURNEY_STEPS,
    state: 'normal',
    label: isCompleted
      ? 'Collected'
      : isReady
        ? 'Ready at Hub'
        : isAtHub
          ? 'Mzigo Hub'
          : 'Seller Handoff',
    detail: isCompleted
      ? 'Package collected at Byblos CBD Hub and confirmed.'
      : isReady
        ? 'Your order is ready for collection at Byblos CBD Hub (Shop SL 32, Dynamic Mall, Tom Mboya St).'
        : isAtHub
          ? 'Package received and verified at Byblos CBD Hub.'
          : 'Seller is preparing package for delivery to Byblos CBD Hub.',
    isDelivered: isCompleted,
    activeLeg: isCompleted ? 'completed' : isReady ? 'hub_to_buyer' : isAtHub ? 'hub' : 'seller_to_hub',
    activeEta: pickupLeg?.deadlineAt || order.logistics?.deadlineAt || null,
    percentProgress: isCompleted ? 100 : isReady ? 75 : isAtHub ? 45 : 15,
  };
}
