// src/utils/orderInstructions.ts

const COURIER_LOCATION = 'Dynamic Mall, Tom Mboya St - Shop SL 32';

export interface OrderInstructionConfig {
    status: string;
    userRole: 'buyer' | 'seller';
    orderType?: string;
    fulfillmentType?: string;
}

export interface OrderInstructionResult {
    text: string;
    color: 'blue' | 'amber' | 'green' | 'red';
}

const STATUS_COLORS: Record<string, 'blue' | 'amber' | 'green' | 'red'> = {
    PENDING: 'blue',
    RESERVED: 'blue',
    PAYMENT_PENDING: 'blue',
    PAID: 'blue',
    PROCESSING: 'blue',
    AWAITING_SELLER_ACTION: 'amber',
    FULFILLING: 'amber',
    READY_FOR_BUYER: 'amber',
    SERVICE_PENDING: 'amber',
    DELIVERY_PENDING: 'amber',
    COLLECTION_PENDING: 'amber',
    DELIVERY_COMPLETE: 'amber',
    COMPLETED: 'green',
    CANCELLED: 'red',
    FAILED: 'red',
};

function getBuyerInstructionText(
    status: string,
    flags: { isDigital: boolean; isCourier: boolean; isShopPickup: boolean; isService: boolean }
): string | null {
    const { isDigital, isCourier, isShopPickup, isService } = flags;
    switch (status) {
        case 'PENDING':
            if (isDigital) return 'Your download will be available once payment confirms.';
            if (isCourier) return 'Waiting for the seller to choose Mzigo Ego drop-off or pickup.';
            if (isShopPickup) return 'Seller is preparing your item for shop pickup.';
            return 'Waiting for seller to confirm your booking.';
        case 'RESERVED':
            return 'Slot reserved. Complete payment to confirm.';
        case 'PAYMENT_PENDING':
            return 'Waiting for payment confirmation.';
        case 'PAID':
            return 'Payment confirmed. Waiting for seller action.';
        case 'AWAITING_SELLER_ACTION':
            if (isService) return 'Waiting for seller to confirm your booking.';
            if (isCourier) return 'Seller will choose Mzigo Ego drop-off or request Mzigo pickup.';
            return 'Seller is preparing your order.';
        case 'FULFILLING':
            if (isService) return 'Booking confirmed. After the service is complete, mark it completed to release funds.';
            if (isCourier) return 'Mzigo Ego is handling the package securely and checking it against the order.';
            return 'Seller is preparing your pickup.';
        case 'READY_FOR_BUYER':
            if (isService) return 'Service delivered. Mark it completed to release funds.';
            if (isShopPickup) return 'Ready! Visit the shop to collect your order, then confirm receipt.';
            return `Ready at Mzigo Ego. Collect at ${COURIER_LOCATION}, then confirm receipt.`;
        case 'PROCESSING':
            return isService ? 'Seller is preparing for your appointment.' : 'Seller is packing your order.';
        case 'SERVICE_PENDING':
            return 'Booking confirmed. Be at your location at the scheduled time.';
        case 'DELIVERY_PENDING':
            return isCourier ? 'Mzigo Ego is handling your package securely and checking it before delivery.' : 'Your order is being delivered.';
        case 'COLLECTION_PENDING':
            return isShopPickup ? 'Ready! Visit the shop to collect your order.' : `Arrived at Mzigo Ego. Collect at ${COURIER_LOCATION}.`;
        case 'DELIVERY_COMPLETE':
            return `Your order is at Mzigo Ego. Collect at ${COURIER_LOCATION}.`;
        case 'COMPLETED':
            return 'Order complete. Thank you for shopping with Byblos!';
        case 'CANCELLED':
            return 'Order cancelled. Any refund has been added to your balance.';
        case 'FAILED':
            return 'Payment was not completed. No charges made.';
        default:
            return null;
    }
}

function getSellerInstructionText(
    status: string,
    flags: { isCourier: boolean; isShopPickup: boolean; isService: boolean }
): string | null {
    const { isCourier, isShopPickup, isService } = flags;
    switch (status) {
        case 'PENDING':
            if (isCourier) return 'Choose Mzigo Ego drop-off or request Mzigo pickup for this package.';
            if (isShopPickup) return 'Prepare item for buyer collection.';
            if (isService) return 'New booking! Confirm the appointment.';
            return 'New order received.';
        case 'RESERVED':
        case 'PAYMENT_PENDING':
            return 'Awaiting payment confirmation from buyer.';
        case 'PAID':
            return 'Payment confirmed. Choose the next action.';
        case 'AWAITING_SELLER_ACTION':
            if (isService) return 'Confirm this booking to proceed.';
            if (isCourier) return 'Choose Mzigo Ego drop-off or request Mzigo pickup.';
            return 'Prepare item for buyer collection.';
        case 'FULFILLING':
            if (isService) return 'Deliver the service as scheduled. The buyer will mark it completed to release funds.';
            if (isCourier) return 'Complete your selected Mzigo handoff. Mzigo Ego will secure and check the package against the order.';
            return 'Prepare item for buyer collection.';
        case 'READY_FOR_BUYER':
            if (isService) return 'Buyer has been asked to mark the service completed.';
            return 'Buyer has been notified. Complete handover when they arrive.';
        case 'PROCESSING':
            return 'Update status when item is ready for delivery/collection.';
        case 'SERVICE_PENDING':
            return 'Confirm this booking in your dashboard to proceed.';
        case 'DELIVERY_PENDING':
            return isCourier ? 'Mzigo Ego has received the package and started logistics tracking.' : 'Order is being delivered to buyer.';
        case 'COLLECTION_PENDING':
            return isShopPickup ? 'Item is ready. Hand over to buyer when they arrive.' : 'Item is at Mzigo Ego. Buyer has been notified.';
        case 'DELIVERY_COMPLETE':
            return 'Waiting for buyer to collect from Mzigo Ego.';
        case 'COMPLETED':
            return 'Order complete and paid out.';
        case 'CANCELLED':
            return 'Order was cancelled.';
        case 'FAILED':
            return 'Payment failed.';
        default:
            return null;
    }
}

export const getOrderInstruction = ({
    status,
    userRole,
    orderType = 'PHYSICAL',
    fulfillmentType,
}: OrderInstructionConfig): OrderInstructionResult | null => {
    const color = STATUS_COLORS[status];
    if (!color) return null;

    const isPhysical = orderType === 'PHYSICAL';
    const isService = orderType === 'SERVICE';
    const isDigital = orderType === 'DIGITAL';
    const isShopPickup = fulfillmentType === 'BUYER_TO_SELLER';
    const isCourier = isPhysical && !isShopPickup;

    const text = userRole === 'buyer'
        ? getBuyerInstructionText(status, { isDigital, isCourier, isShopPickup, isService })
        : getSellerInstructionText(status, { isCourier, isShopPickup, isService });

    if (!text) return null;
    return { text, color };
};
