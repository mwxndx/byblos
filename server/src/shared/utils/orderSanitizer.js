/**
 * Order and Logistics Sanitization Helpers
 * Whitelists allowed order and logistics fields for frontend responses.
 */

export const parseObject = (value, fallback = {}) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const sanitizeLeg = (leg) => {
    if (!leg) return null;
    return {
        id: leg.id,
        status: leg.status,
        feeAmount: Number.parseFloat(leg.feeAmount || leg.fee_amount || 0),
        feeCurrency: leg.feeCurrency || leg.fee_currency || 'KES',
        distanceKm: leg.distanceKm !== undefined || leg.distance_km !== undefined
            ? Number.parseFloat(leg.distanceKm ?? leg.distance_km)
            : null,
        originLabel: leg.originLabel || leg.origin_label || null,
        destinationLabel: leg.destinationLabel || leg.destination_label || null,
        deadlineAt: leg.deadlineAt || leg.deadline_at || null,
        completedAt: leg.completedAt || leg.completed_at || null
    };
};

export const sanitizeLogistics = (logistics) => {
    const data = parseObject(logistics, null);
    if (!data) return null;

    const deliveryLeg = data.deliveryLeg || data.delivery_leg || null;
    const pickupLeg = data.pickupLeg || data.pickup_leg || null;

    return {
        requestId: data.requestId || data.request_id || null,
        packageCode: data.packageCode || data.package_code || null,
        status: data.status || null,
        serviceLevel: data.serviceLevel || data.service_level || null,
        deadlineAt: data.deadlineAt || data.deadline_at || null,
        completedAt: data.completedAt || data.completed_at || null,
        deliveryLeg: sanitizeLeg(deliveryLeg),
        pickupLeg: sanitizeLeg(pickupLeg),
        events: Array.isArray(data.events)
            ? data.events.map(event => ({
                id: event.id,
                type: event.type || event.event_type || null,
                status: event.status || null,
                message: event.message || null,
                source: event.source || null,
                createdAt: event.createdAt || event.created_at || null
            }))
            : []
    };
};

const extractBuyerPricing = (orderObj, metadata) => {
    const pricing = parseObject(metadata.pricing, {});
    const buyerServiceChargeAmount = Number.parseFloat(
        pricing.buyer_service_charge
        ?? pricing.product_service_charge
        ?? metadata.buyer_service_charge
        ?? metadata.product_service_charge
        ?? 0
    );
    const buyerServiceChargeRate = Number.parseFloat(
        pricing.buyer_service_charge_rate
        ?? pricing.product_service_charge_rate
        ?? metadata.buyer_service_charge_rate
        ?? metadata.product_service_charge_rate
        ?? 0.02
    );

    const buyerPricing = {
        buyer_service_charge: Number.isFinite(buyerServiceChargeAmount) ? buyerServiceChargeAmount : 0,
        buyer_service_charge_rate: Number.isFinite(buyerServiceChargeRate) ? buyerServiceChargeRate : 0.02,
        buyer_delivery_fee: Number.parseFloat(pricing.buyer_delivery_fee || 0) || 0,
        payable_total: Number.parseFloat(pricing.payable_total || orderObj.totalAmount || orderObj.total_amount || 0) || 0,
    };

    return {
        buyerPricing,
        buyerServiceChargeAmount: Number.isFinite(buyerServiceChargeAmount) ? buyerServiceChargeAmount : 0,
        buyerServiceChargeRate: Number.isFinite(buyerServiceChargeRate) ? buyerServiceChargeRate : 0.02
    };
};

const sanitizeSafeItems = (items = []) => {
    return items.map(item => ({
        id: item.id,
        productId: item.productId || item.product_id,
        name: item.name || item.product_name,
        price: Number.parseFloat(item.price || item.product_price || 0),
        quantity: Number.parseInt(item.quantity || 1),
        subtotal: Number.parseFloat(item.subtotal || 0),
        imageUrl: item.imageUrl || item.image_url || null,
        productType: item.productType || item.product_type || 'physical',
        isDigital: !!(item.isDigital || item.is_digital),
    }));
};

export const sanitizeOrder = (order, userType = 'buyer') => {
    if (!order) return null;
    const orderObj = order.toObject ? order.toObject() : order;
    const metadata = parseObject(orderObj.metadata, {});
    const { buyerPricing, buyerServiceChargeAmount, buyerServiceChargeRate } = extractBuyerPricing(orderObj, metadata);
    const logistics = sanitizeLogistics(orderObj.logistics || metadata.delivery?.logistics);
    const safeItems = sanitizeSafeItems(orderObj.items || []);

    const baseOrder = {
        id: orderObj.id,
        orderNumber: orderObj.orderNumber || orderObj.order_number,
        status: orderObj.status,
        paymentStatus: orderObj.paymentStatus || orderObj.payment_status,
        totalAmount: Number.parseFloat(orderObj.totalAmount || orderObj.total_amount || 0),
        paymentMethod: orderObj.paymentMethod || orderObj.payment_method,
        notes: orderObj.notes || '',
        createdAt: orderObj.createdAt || orderObj.created_at,
        updatedAt: orderObj.updatedAt || orderObj.updated_at,
        paidAt: orderObj.paidAt || orderObj.paid_at || null,
        completedAt: orderObj.completedAt || orderObj.completed_at || null,
        cancelledAt: orderObj.cancelledAt || orderObj.cancelled_at || null,
        items: safeItems,
        isDigital: (orderObj.items || []).some(i => i.isDigital || i.is_digital),
        metadata: {
            product_type: metadata.product_type || null,
            pricing: buyerPricing,
            delivery: metadata.delivery ? {
                doorDelivery: metadata.delivery.doorDelivery === true || metadata.delivery.door_delivery === true,
                deliveryMode: metadata.delivery.deliveryMode || metadata.delivery.delivery_mode || null,
                pricing: buyerPricing
            } : null,
            seller_handoff: metadata.seller_handoff || null,
            service_confirmation: metadata.service_confirmation || null,
        },
        logistics,
        buyerServiceChargeAmount,
        buyerServiceChargeRate,
        fulfillment_type: orderObj.fulfillment_type || orderObj.fulfillmentType || null,
        order_type: orderObj.order_type || orderObj.orderType || null,
        seller: orderObj.seller ? {
            id: orderObj.seller.id,
            shopName: orderObj.seller.shopName,
            theme: orderObj.seller.theme,
            isClient: orderObj.seller.isClient || false,
        } : null,
    };

    if (userType === 'seller' || userType === 'admin') {
        return {
            ...baseOrder,
            platformFeeAmount: Number.parseFloat(orderObj.platformFeeAmount || orderObj.platform_fee_amount || 0),
            sellerPayoutAmount: Number.parseFloat(orderObj.sellerPayoutAmount || orderObj.seller_payout_amount || 0),
            buyerName: orderObj.buyerName || orderObj.buyer_name || '',
            buyerWhatsAppNumber: orderObj.buyerWhatsAppNumber || orderObj.buyer_whatsapp_number || '',
            buyerMobilePayment: orderObj.buyerMobilePayment || orderObj.buyer_mobile_payment || '',
        };
    }

    return baseOrder;
};
