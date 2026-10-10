import type { LogisticsLeg, LogisticsLegType, LogisticsLocation, LogisticsRequestCard } from '@/features/logistics/api';
import { DELIVERY_ACTIONS, PICKUP_ACTIONS } from '@/features/logistics/utils/mzigoDashboard.constants';
import { MZIGO_CBD_HUB, type NextAction, type RequestStage } from './mzigoJourney.types';

/**
 * The single "next thing the courier does".
 */
export function courierActions(request: LogisticsRequestCard): {
  legType: LogisticsLegType;
  leg: LogisticsLeg;
  primary: NextAction | null;
  secondary: NextAction[];
} | null {
  const pickup = request.pickupLeg ?? null;
  const delivery = request.deliveryLeg ?? null;

  const pickupDone = hasKeywords(pickup?.status, 'picked_up', 'dropped', 'hub');

  const chosen = selectNextLeg(pickup, delivery, pickupDone);
  if (!chosen) return null;

  const raw = chosen.legType === 'pickup'
    ? PICKUP_ACTIONS[String(chosen.leg.status || '').toLowerCase()] || []
    : DELIVERY_ACTIONS[String(chosen.leg.status || '').toLowerCase()] || [];

  const mapped: NextAction[] = raw.map((action) => ({
    legType: chosen.legType,
    status: action.status,
    label: action.label,
  }));

  const secondary = mapped.filter((action) => /fail|delay/i.test(action.label));
  const primary = mapped.find((action) => !/fail|delay/i.test(action.label)) || null;

  return { legType: chosen.legType, leg: chosen.leg, primary, secondary };
}

function hasKeywords(status: string | null | undefined, ...needles: string[]): boolean {
  const value = String(status || '').toLowerCase();
  return needles.some((needle) => value.includes(needle));
}

function selectNextLeg(
  pickup: LogisticsLeg | null,
  delivery: LogisticsLeg | null,
  pickupDone: boolean
): { legType: LogisticsLegType; leg: LogisticsLeg } | null {
  if (pickup && !pickupDone) {
    const actions = PICKUP_ACTIONS[String(pickup.status || '').toLowerCase()] || [];
    if (actions.length) return { legType: 'pickup', leg: pickup };
  }
  if (delivery) {
    const actions = DELIVERY_ACTIONS[String(delivery.status || '').toLowerCase()] || [];
    if (actions.length) return { legType: 'delivery', leg: delivery };
  }
  if (pickup) {
    const actions = PICKUP_ACTIONS[String(pickup.status || '').toLowerCase()] || [];
    if (actions.length) return { legType: 'pickup', leg: pickup };
  }
  return null;
}

/** The one place the courier goes next for the current action, with its address. */
export function requestNextStop(
  request: LogisticsRequestCard,
  primary: NextAction | null,
): { verb: string; place: string } | null {
  const seller = request.seller.physicalAddress || request.seller.location || request.pickupLeg?.origin.address || request.pickupLeg?.origin.label;
  const hub = request.sellerDropoff?.address || request.sellerDropoff?.label || MZIGO_CBD_HUB.address;
  const buyer = request.deliveryLeg?.destination.address || request.deliveryLeg?.destination.label;

  if (!primary) return null;
  if (primary.legType === 'delivery') {
    return { verb: 'Deliver to', place: buyer || 'buyer address on file' };
  }
  const status = String(request.pickupLeg?.status || '').toLowerCase();
  if (/picked_up/.test(status)) return { verb: 'Drop at hub', place: hub };
  if (/dropped|hub/.test(status)) return { verb: 'Buyer collects at', place: hub };
  return { verb: 'Pick up from', place: seller || 'seller address on file' };
}

/** Route link to open in Google Maps */
export function routeLink(request: LogisticsRequestCard): { href: string; label: string } | null {
  const origin: LogisticsLocation | null =
    request.pickupLeg?.origin
    || request.sellerDropoff
    || (request.seller.mapLink ? { mapLink: request.seller.mapLink } : null);
  const destination = request.deliveryLeg?.destination || null;

  const originCoord = coord(origin);
  const destCoord = coord(destination);

  if (originCoord && destCoord) {
    return {
      href: `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destCoord}&travelmode=driving`,
      label: 'Open route',
    };
  }
  const single = destination?.mapLink || origin?.mapLink || request.seller.mapLink;
  if (single) return { href: single, label: destination ? 'Open delivery map' : 'Open pickup map' };
  return null;
}

function coord(location?: LogisticsLocation | { latitude?: number | null; longitude?: number | null } | null): string | null {
  if (!location) return null;
  const lat = location.latitude;
  const lng = location.longitude;
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return `${nLat},${nLng}`;
}
