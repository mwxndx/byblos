import type { LogisticsSort, LogisticsStatusUpdate } from '@/features/logistics/api';



export const SORT_OPTIONS: Array<{ value: LogisticsSort; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline Soon' },
  { value: 'oldest_paid', label: 'Oldest Paid' },
  { value: 'newest_paid', label: 'Newest Paid' },
];

export const PICKUP_ACTIONS: Record<string, Array<{ status: LogisticsStatusUpdate; label: string }>> = {
  payment_pending: [
    { status: 'pickup_pending', label: 'Mark pickup pending' },
  ],
  pending: [
    { status: 'pickup_assigned', label: 'Assign pickup' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  assigned: [
    { status: 'pickup_started', label: 'Start pickup' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  started: [
    { status: 'picked_up_from_seller', label: 'Picked up' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  picked_up: [
    { status: 'dropped_at_hub', label: 'Dropped at hub' },
    { status: 'pickup_failed', label: 'Mark failed' },
  ],
  // Collection orders (no delivery leg): the hub confirms the buyer collected.
  // courierActions only surfaces these once there's no delivery leg to advance,
  // so door-delivery orders show the delivery actions instead.
  dropped_at_hub: [
    { status: 'buyer_collected', label: 'Buyer collected' },
  ],
};

export const DELIVERY_ACTIONS: Record<string, Array<{ status: LogisticsStatusUpdate; label: string }>> = {
  payment_pending: [
    { status: 'delivery_pending', label: 'Mark delivery pending' },
  ],
  delivery_pending: [
    { status: 'courier_assigned', label: 'Assign courier' },
    { status: 'delivery_delayed', label: 'Mark delayed' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
  assigned: [
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivery_delayed', label: 'Mark delayed' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
  out_for_delivery: [
    { status: 'delivered', label: 'Delivered' },
    { status: 'delivery_delayed', label: 'Mark delayed' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
  delayed: [
    { status: 'courier_assigned', label: 'Assign courier' },
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivered', label: 'Delivered' },
    { status: 'delivery_failed', label: 'Mark failed' },
  ],
};
