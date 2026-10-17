export const FulfillmentType = {
    BUYER_TO_SELLER: 'BUYER_TO_SELLER',  // Service at the seller's location (buyer goes to seller)
    COURIER: 'COURIER',                  // Physical goods, routed via the Mzigo Ego hub (CBD)
    SELLER_TO_BUYER: 'SELLER_TO_BUYER',  // Legacy mobile-service value; no longer produced (kept for historical orders)
    DIGITAL: 'DIGITAL'                   // Instant delivery
};

/**
 * Resolves the fulfillment type from the product type. SINGLE SOURCE OF TRUTH.
 *
 * Authoritative business rule — everything physical centralizes on the Mzigo Ego
 * hub (CBD), the single access point for convenience + security (packages are
 * inspected at the hub). The buyer NEVER collects from the seller's coordinates.
 *
 *   - DIGITAL  (is_digital/is_virtual or product type digital) -> DIGITAL
 *   - SERVICE  -> BUYER_TO_SELLER. A seller can only create a service if they have
 *                 coordinates, so a service is always fulfilled AT the seller.
 *   - PHYSICAL -> COURIER (hub-routed). Whether the buyer pays for delivery or picks
 *                 up from the hub, and whether the seller drops off or pays for
 *                 pickup, is handled by the logistics legs — not the fulfillment type.
 *
 * @param {Object} _seller - Seller object (unused; kept for signature stability)
 * @param {string} productType - 'physical', 'service', or 'digital'
 * @param {Object} [metadata]
 * @returns {string} FulfillmentType
 */
export const resolveFulfillmentType = (_seller, productType, metadata = {}) => {
    const type = String(productType || '').toLowerCase();

    if (metadata?.is_virtual === true || metadata?.is_digital === true || type === 'digital') {
        return FulfillmentType.DIGITAL;
    }

    if (type === 'service') {
        return FulfillmentType.BUYER_TO_SELLER;
    }

    // All physical goods route through the hub — never buyer <-> seller directly.
    return FulfillmentType.COURIER;
};
