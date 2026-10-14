import type { LogisticsLegType, LogisticsStatusUpdate } from '@/features/logistics/api';

export type JourneyState = 'normal' | 'delayed' | 'attention';

export interface JourneyStep {
  key: string;
  label: string;
}

export const MZIGO_CBD_HUB = {
  name: 'MZIGO EGO Hub',
  address: 'Dynamic mall shop sl32, Nairobi',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=Dynamic+Mall+Nairobi',
};

export const DOOR_DELIVERY_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'seller_handoff', label: 'Seller Handoff' },
  { key: 'hub_processing', label: 'Mzigo Hub' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

export const HUB_COLLECTION_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'seller_handoff', label: 'Seller Handoff' },
  { key: 'hub_processing', label: 'Mzigo Hub' },
  { key: 'ready_at_hub', label: 'Ready at Hub' },
  { key: 'collected', label: 'Collected' },
];

export const DIGITAL_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'paid', label: 'Payment Confirmed' },
  { key: 'ready', label: 'Download Ready' },
];

export const SERVICE_JOURNEY_STEPS: JourneyStep[] = [
  { key: 'booked', label: 'Booking Paid' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export const COURIER_JOURNEY_STEPS = DOOR_DELIVERY_JOURNEY_STEPS;
export const PICKUP_JOURNEY_STEPS = HUB_COLLECTION_JOURNEY_STEPS;
export const JOURNEY_STEPS: JourneyStep[] = DOOR_DELIVERY_JOURNEY_STEPS;

export interface Journey {
  /** 0-based index into steps for the step currently active. */
  stepIndex: number;
  steps: JourneyStep[];
  state: JourneyState;
  /** Plain-language headline for the current situation. */
  label: string;
  /** One line of reassuring context under the headline. */
  detail: string;
  isDelivered: boolean;
  isRiderMoving?: boolean;
  activeLeg: 'seller_to_hub' | 'hub' | 'hub_to_buyer' | 'completed';
  activeEta?: string | null;
  percentProgress: number;
}

export interface NextAction {
  legType: LogisticsLegType;
  status: LogisticsStatusUpdate;
  label: string;
}

export type RequestStage = 'pickup' | 'hub' | 'deliver' | 'collect';

export function hasStatusKeyword(status: string | null | undefined, ...needles: string[]): boolean {
  const value = String(status || '').toLowerCase();
  return needles.some((needle) => value.includes(needle));
}
