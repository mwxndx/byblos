/**
 * productCheckoutValidation.js
 *
 * Dedicated helper to parse bag line items, validate seller status,
 * compute per-line totals, and build pre-handoff SLA definitions.
 * Decouples input validation and business rules from productCheckout.service.js.
 */
import { AppError } from '../../../shared/utils/errorHandler.js';
import { roundMoney } from './checkoutPricing.js';

export const MAX_BAG_ITEMS = 5;

export function wantsDoorDelivery(metadata = {}) {
    const d = metadata.delivery || {};
    return (
        d.doorDelivery === true ||
        d.door_delivery === true ||
        d.deliveryMode === 'DOOR_DELIVERY' ||
        d.delivery_mode === 'DOOR_DELIVERY'
    );
}

export function isExplicitProviderFailure(err) {
    const code = err && err.statusCode;
    return typeof code === 'number' && code >= 400 && code < 500;
}

export function extractDeliveryLocation(metadata = {}, location = {}) {
    const d = metadata.delivery || {};
    const loc = d.location || location || {};
    return {
        address: loc.address || loc.fullAddress || loc.full_address || location.address || null,
        lat: loc.lat ?? loc.latitude ?? location.lat ?? null,
        lng: loc.lng ?? loc.longitude ?? location.lng ?? null,
    };
}

export function parseItems(normalizedOrder) {
    const { items, service } = normalizedOrder;
    let list = [];
    if (Array.isArray(items) && items.length > 0) {
        list = items.map((it) => ({
            productId: Number.parseInt(it.productId ?? it.product_id ?? it.id, 10),
            quantity: Math.max(1, Number.parseInt(it.quantity ?? 1, 10) || 1),
        }));
    } else if (service && service.id !== undefined && service.id !== null) {
        list = [{
            productId: Number.parseInt(service.id, 10),
            quantity: Math.max(1, Number.parseInt(service.quantity ?? 1, 10) || 1),
        }];
    }
    return list.filter((l) => Number.isInteger(l.productId) && l.productId > 0);
}

export function mergeQuantities(list) {
    const merged = new Map();
    for (const l of list) merged.set(l.productId, (merged.get(l.productId) || 0) + l.quantity);
    return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export function buildValidatedLines(items, productById, isMulti) {
    const lines = items.map((i) => {
        const p = productById.get(i.productId);
        const qty = Math.max(1, Number.parseInt(i.quantity, 10) || 1);
        const dbPrice = Number.parseFloat(p.price || 0);
        if (!Number.isFinite(dbPrice) || dbPrice <= 0) {
            throw new AppError('Invalid order amount after secure calculation', 400);
        }
        const lineSubtotal = roundMoney(dbPrice * qty);
        if (!(lineSubtotal > 0)) throw new AppError('Invalid order amount after secure calculation', 400);
        const productType = String(p.product_type || '').toLowerCase();
        const isDigital = p.is_digital === true || productType === 'digital';
        const isService = productType === 'service';
        const isPhysical = !isDigital && !isService;
        return {
            product: p,
            quantity: qty,
            price: roundMoney(dbPrice),
            lineSubtotal,
            productType,
            isDigital,
            isService,
            isPhysical,
            isCustom: isPhysical && p.is_custom_product === true,
            isImported: isPhysical && p.is_imported_product === true,
        };
    });

    if (isMulti) {
        for (const l of lines) {
            if (l.isService) throw new AppError('Services must be booked on their own, not in a bag.', 400);
            if (l.isCustom || l.isImported) throw new AppError('Custom and imported products must be bought on their own, not in a bag.', 400);
        }
    }

    return lines;
}

export function derivePreHandoffSla(singleLine, metadata) {
    if (!singleLine) return null;
    if (singleLine.isCustom && singleLine.isImported) {
        throw new AppError('Product cannot be both custom and imported.', 400);
    }
    const customInstructions = String(
        metadata.customization_instructions || metadata.custom_instructions || metadata.buyer_instructions || ''
    ).trim();

    if (singleLine.isCustom) {
        const productionDays = Number.parseInt(singleLine.product.production_days, 10);
        if (!Number.isInteger(productionDays) || productionDays < 1 || productionDays > 5) {
            throw new AppError('Custom product is misconfigured. Please contact the seller.', 400);
        }
        if (!customInstructions) {
            throw new AppError('Customization instructions are required for this custom product.', 400);
        }
        return {
            type: 'custom_production',
            production_days: productionDays,
            customization_prompt: singleLine.product.customization_prompt || 'Describe your customization',
            buyer_instructions: customInstructions,
            delivery_starts_after_seller_handoff: true,
            source_product_id: singleLine.product.id,
        };
    }

    if (singleLine.isImported) {
        const importDays = Number.parseInt(singleLine.product.import_days, 10);
        if (![7, 14, 21, 30].includes(importDays)) {
            throw new AppError('Imported product is misconfigured. Please contact the seller.', 400);
        }
        return {
            type: 'import_waiting',
            import_days: importDays,
            note: singleLine.product.import_note || 'Imported item. Delivery starts after seller handoff.',
            delivery_starts_after_seller_handoff: true,
            source_product_id: singleLine.product.id,
        };
    }

    return null;
}

export default {
    MAX_BAG_ITEMS,
    wantsDoorDelivery,
    isExplicitProviderFailure,
    extractDeliveryLocation,
    parseItems,
    mergeQuantities,
    buildValidatedLines,
    derivePreHandoffSla
};
