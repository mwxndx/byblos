import type { LogisticsRequestCard } from '@/features/logistics/api';
import type { ApiOrder } from '@/shared/types';
import { hasBuyerPaidDoorDelivery } from '@/features/seller/utils/sellerOrders.utils';
import {
  type Journey,
  type RequestStage,
} from './mzigoJourney.types';
import {
  requestHasDoorDelivery,
  deriveJourneyFromStatuses,
  deriveHubCollectionJourney,
  resolveDigitalOrderJourney,
  resolveServiceOrderJourney,
  resolveHubCollectionOrderJourney,
} from './mzigoJourney.resolvers';

export type {
  Journey,
  JourneyState,
  JourneyStep,
  NextAction,
  RequestStage,
} from './mzigoJourney.types';

export {
  MZIGO_CBD_HUB,
  DOOR_DELIVERY_JOURNEY_STEPS,
  HUB_COLLECTION_JOURNEY_STEPS,
  DIGITAL_JOURNEY_STEPS,
  SERVICE_JOURNEY_STEPS,
  COURIER_JOURNEY_STEPS,
  PICKUP_JOURNEY_STEPS,
  JOURNEY_STEPS,
} from './mzigoJourney.types';

export {
  isRiderMoving,
  isPickupTrackable,
  isDeliveryTrackable,
  requestHasDoorDelivery,
  deriveJourneyFromStatuses,
} from './mzigoJourney.resolvers';

export {
  courierActions,
  requestNextStop,
  routeLink,
} from './mzigoJourney.actions';

/** Collapse pickup + delivery leg statuses into one linear courier journey. */
export function deriveJourney(request: LogisticsRequestCard): Journey {
  const completed = Boolean(request.isCompleted) || request.status === 'completed';
  if (!requestHasDoorDelivery(request)) {
    return deriveHubCollectionJourney(request, completed);
  }
  return deriveJourneyFromStatuses(
    request.pickupLeg?.status ?? null,
    request.deliveryLeg?.status ?? null,
    completed,
  );
}

/**
 * Universal journey resolver supporting all fulfillment types:
 * - PHYSICAL (COURIER) Door Delivery: SELLER -> MZIGO HUB -> BUYER
 * - PHYSICAL (COURIER) Hub Pickup: SELLER -> MZIGO HUB -> BUYER AT HUB
 * - DIGITAL: Instant download
 * - SERVICE: Appointment at seller
 */
export function deriveOrderJourney(order: ApiOrder): Journey {
  const orderType = String(order.order_type || order.orderType || '').toUpperCase();
  const isDigital = orderType === 'DIGITAL' || Boolean(order.isDigital || order.items?.some((i) => i.productType === 'digital' || i.isDigital));
  const isService = orderType === 'SERVICE' || Boolean(order.items?.some((i) => i.productType === 'service'));

  if (isDigital) return resolveDigitalOrderJourney(order);
  if (isService) return resolveServiceOrderJourney(order);

  const hasDoorDelivery = hasBuyerPaidDoorDelivery(order) || Boolean(order.shippingAddress?.address);
  if (!hasDoorDelivery) return resolveHubCollectionOrderJourney(order);

  const pickupLeg = order.logistics?.pickupLeg;
  const deliveryLeg = order.logistics?.deliveryLeg;
  const isOrderCompleted = order.status === 'COMPLETED';

  return deriveJourneyFromStatuses(
    pickupLeg?.status,
    deliveryLeg?.status,
    isOrderCompleted || order.logistics?.status === 'completed',
    pickupLeg?.deadlineAt,
    deliveryLeg?.deadlineAt,
  );
}

/**
 * Which real-world action stage a live request sits in, so the queue can group
 * by "what the courier does next" rather than one flat list.
 */
export function requestStage(request: LogisticsRequestCard): RequestStage {
  const journey = deriveJourney(request);
  const door = requestHasDoorDelivery(request);
  if (journey.activeLeg === 'seller_to_hub') return 'pickup';
  if (journey.activeLeg === 'hub') return 'hub';
  return door ? 'deliver' : 'collect';
}
