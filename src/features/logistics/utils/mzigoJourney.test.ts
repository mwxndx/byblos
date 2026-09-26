import { describe, test, expect } from 'vitest';
import type { LogisticsLeg, LogisticsRequestCard } from '@/features/logistics/api';
import type { ApiOrder } from '@/shared/types';
import {
  DOOR_DELIVERY_JOURNEY_STEPS,
  HUB_COLLECTION_JOURNEY_STEPS,
  courierActions,
  deriveJourney,
  deriveOrderJourney,
  requestHasDoorDelivery,
  requestNextStop,
  requestStage,
} from './mzigoJourney';

function leg(status: string): LogisticsLeg {
  return {
    id: 1,
    status,
    feeAmount: 0,
    feeCurrency: 'KES',
    feeStatus: 'pending',
    origin: { address: 'Seller shop, CBD' },
    destination: { address: 'Buyer, Westlands' },
  };
}

function request(overrides: Partial<LogisticsRequestCard>): LogisticsRequestCard {
  return {
    id: 1,
    group: 'pickup_delivery',
    status: 'active',
    isOverdue: false,
    order: { id: 1, orderNumber: 'BY-1', totalAmount: 0, paymentStatus: 'paid' },
    product: { items: [], summary: 'Package' },
    seller: { physicalAddress: 'Seller shop, CBD' },
    buyer: {},
    pickupFeeStatus: 'pending',
    deliveryFeeStatus: 'pending',
    sellerDropoff: { address: 'Mzigo hub' },
    events: [],
    ...overrides,
  } as LogisticsRequestCard;
}

// Buyer/seller see the SAME order through deriveOrderJourney; build the order
// equivalent of a Mzigo request so the two views can be asserted equal.
function order(overrides: {
  status: string;
  pickup?: string | null;
  delivery?: string | null;
}): ApiOrder {
  const logistics: Record<string, unknown> = {};
  if (overrides.pickup) logistics.pickupLeg = { status: overrides.pickup };
  if (overrides.delivery) logistics.deliveryLeg = { status: overrides.delivery };
  return {
    order_type: 'PHYSICAL',
    status: overrides.status,
    items: [{ productType: 'physical' }],
    logistics,
  } as unknown as ApiOrder;
}

describe('deriveJourney — flow-aware step track', () => {
  test('collection order (no delivery leg) uses the hub-collection track, not the door track', () => {
    const j = deriveJourney(request({ group: 'pickup_only', pickupLeg: leg('dropped_at_hub') }));
    expect(j.steps).toBe(HUB_COLLECTION_JOURNEY_STEPS);
    expect(j.stepIndex).toBe(2); // Ready at Hub
    expect(j.label).toBe('Ready at Hub');
  });

  test('collected pickup completes the collection journey', () => {
    const j = deriveJourney(request({ group: 'pickup_only', pickupLeg: leg('buyer_collected') }));
    expect(j.steps).toBe(HUB_COLLECTION_JOURNEY_STEPS);
    expect(j.stepIndex).toBe(3);
    expect(j.isDelivered).toBe(true);
  });

  test('door-delivery order keeps the door track and ends Delivered', () => {
    const j = deriveJourney(request({ pickupLeg: leg('dropped_at_hub'), deliveryLeg: leg('delivered') }));
    expect(j.steps).toBe(DOOR_DELIVERY_JOURNEY_STEPS);
    expect(j.stepIndex).toBe(3);
    expect(j.isDelivered).toBe(true);
  });
});

describe('requestHasDoorDelivery', () => {
  test('true only when a delivery leg exists', () => {
    expect(requestHasDoorDelivery(request({ deliveryLeg: leg('delivery_pending') }))).toBe(true);
    expect(requestHasDoorDelivery(request({ group: 'pickup_only', pickupLeg: leg('started') }))).toBe(false);
  });
});

describe('requestStage — queue bucketing by action', () => {
  test('before pickup → pickup stage', () => {
    expect(requestStage(request({ pickupLeg: leg('started'), deliveryLeg: leg('delivery_pending') }))).toBe('pickup');
  });

  test('out for delivery → deliver stage', () => {
    expect(requestStage(request({ pickupLeg: leg('dropped_at_hub'), deliveryLeg: leg('out_for_delivery') }))).toBe('deliver');
  });

  test('collection order at hub → collect stage', () => {
    expect(requestStage(request({ group: 'pickup_only', pickupLeg: leg('dropped_at_hub') }))).toBe('collect');
  });
});

describe('requestNextStop — where to go next', () => {
  test('door delivery out for delivery points at the buyer', () => {
    const r = request({ pickupLeg: leg('dropped_at_hub'), deliveryLeg: leg('out_for_delivery') });
    const stop = requestNextStop(r, courierActions(r)?.primary ?? null);
    expect(stop?.verb).toBe('Deliver to');
    expect(stop?.place).toContain('Westlands');
  });

  test('collection at hub points the buyer to the hub', () => {
    const r = request({ group: 'pickup_only', pickupLeg: leg('dropped_at_hub') });
    const stop = requestNextStop(r, courierActions(r)?.primary ?? null);
    expect(stop?.verb).toBe('Buyer collects at');
    expect(stop?.place).toContain('hub');
  });

  test('before pickup points at the seller', () => {
    const r = request({ pickupLeg: leg('assigned'), deliveryLeg: leg('delivery_pending') });
    const stop = requestNextStop(r, courierActions(r)?.primary ?? null);
    expect(stop?.verb).toBe('Pick up from');
    expect(stop?.place).toContain('Seller');
  });
});

// The Mzigo console (deriveJourney) and the buyer/seller tracking card
// (deriveOrderJourney) must tell the same story for the same order. Each case
// pairs a Mzigo request with its buyer/seller order and asserts step + label.
describe('three-actor alignment — Mzigo vs buyer/seller', () => {
  test('collection: hub confirms buyer collected → both read "Collected"', () => {
    const mzigo = deriveJourney(request({ group: 'pickup_only', pickupLeg: leg('buyer_collected') }));
    // Order is still READY_FOR_BUYER (buyer confirm / 48h backstop pending).
    const buyerSeller = deriveOrderJourney(order({ status: 'READY_FOR_BUYER', pickup: 'buyer_collected' }));
    expect(mzigo.label).toBe('Collected');
    expect(buyerSeller.label).toBe('Collected');
    expect(buyerSeller.stepIndex).toBe(mzigo.stepIndex);
  });

  test('collection: package at hub → both read "Ready at Hub"', () => {
    const mzigo = deriveJourney(request({ group: 'pickup_only', pickupLeg: leg('dropped_at_hub') }));
    const buyerSeller = deriveOrderJourney(order({ status: 'READY_FOR_BUYER', pickup: 'dropped_at_hub' }));
    expect(mzigo.label).toBe('Ready at Hub');
    expect(buyerSeller.label).toBe('Ready at Hub');
    expect(buyerSeller.stepIndex).toBe(mzigo.stepIndex);
  });

  test('door delivery: rider delivered → both read "Delivered"', () => {
    const mzigo = deriveJourney(request({ pickupLeg: leg('dropped_at_hub'), deliveryLeg: leg('delivered') }));
    const buyerSeller = deriveOrderJourney(order({ status: 'READY_FOR_BUYER', pickup: 'dropped_at_hub', delivery: 'delivered' }));
    expect(mzigo.label).toBe('Delivered');
    expect(buyerSeller.label).toBe('Delivered');
    expect(buyerSeller.stepIndex).toBe(mzigo.stepIndex);
  });

  test('both flows finish on the same step index (collection ~ delivery)', () => {
    const collected = deriveOrderJourney(order({ status: 'COMPLETED', pickup: 'buyer_collected' }));
    const delivered = deriveOrderJourney(order({ status: 'COMPLETED', pickup: 'dropped_at_hub', delivery: 'delivered' }));
    expect(collected.isDelivered).toBe(true);
    expect(delivered.isDelivered).toBe(true);
    expect(collected.stepIndex).toBe(3);
    expect(delivered.stepIndex).toBe(3);
  });
});
