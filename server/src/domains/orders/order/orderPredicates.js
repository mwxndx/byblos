import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';

export const parseOrderMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
};

export const isPaidOrder = (order) => {
  if (!order) return false;
  const paymentStatus = String(order.payment_status || '').toLowerCase();
  if (paymentStatus === 'completed' || paymentStatus === 'paid') return true;
  const orderStatus = String(order.status || '').toUpperCase();
  return [
    OrderStatus.PAID,
    OrderStatus.AWAITING_SELLER_ACTION,
    OrderStatus.FULFILLING,
    OrderStatus.READY_FOR_BUYER,
    OrderStatus.COMPLETED
  ].includes(orderStatus);
};

export const isPhysicalOnlineOrder = (order) => {
  if (!order) return false;
  const orderType = String(order.order_type || '').toUpperCase();
  if (orderType === OrderType.PHYSICAL) return true;
  if (orderType === OrderType.DIGITAL || orderType === OrderType.SERVICE) return false;
  const fulfillmentType = String(order.fulfillment_type || '').toUpperCase();
  if (fulfillmentType === 'PHYSICAL') return true;
  return !order.is_digital;
};

export const hasActivePickup = (order) => {
  if (!order) return false;
  const pickupStatus = String(order.pickup_leg_status || '').toLowerCase();
  if (['pending', 'active', 'assigned', 'in_transit', 'picked_up'].includes(pickupStatus)) {
    return true;
  }
  const meta = parseOrderMetadata(order.metadata);
  const sellerHandoff = meta.seller_handoff || {};
  if (sellerHandoff.method === 'seller_pickup' && ['pickup_requested', 'pickup_paid', 'active'].includes(sellerHandoff.status)) {
    return true;
  }
  if (meta.seller_pickup?.payment_status === 'pending') {
    return true;
  }
  return false;
};

export const hasBuyerDoorDelivery = (order) => {
  if (!order) return false;
  const deliveryType = String(order.delivery_type || '').toUpperCase();
  if (deliveryType === 'DOOR_DELIVERY') return true;
  if (order.delivery_leg_id != null) return true;
  if (order.shipping_address != null) return true;
  const meta = parseOrderMetadata(order.metadata);
  if (meta.buyer_delivery_required === true) return true;
  if (meta.pricing?.buyer_delivery_fee > 0) return true;
  return false;
};

export const generateOrderNumber = async (client) => {
  try {
    await client.query("CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 100001");
  } catch {
    // Ignored
  }
  const res = await client.query("SELECT nextval('order_number_seq') as seq");
  const seq = res.rows[0].seq;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${dateStr}-${String(seq).padStart(6, '0')}`;
};
