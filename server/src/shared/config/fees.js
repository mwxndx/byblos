/**
 * Convert a monetary amount in KES to integer cents without floating point drift.
 * @param {number|string} amount
 * @returns {number}
 */
export function toCents(amount) {
    return Math.round(Number(amount || 0) * 100);
}

/**
 * Round a KES monetary amount to 2 decimal places using integer cents.
 * @param {number|string} amount
 * @returns {number}
 */
export function roundMoney(amount) {
    return toCents(amount) / 100;
}

const Fees = {
    PRODUCT_MIN_PRICE: 50,             // Minimum seller product price in KES
    PRODUCT_SERVICE_CHARGE_RATE: 0.02,  // Price-inclusive service charge for operations/transit security
    PLATFORM_COMMISSION_AMOUNT: 10,    // Flat KES 10 platform cut per order
    COLLECTION_FEE_AMOUNT: 100,        // Flat KES 100 hub collection fee (Mzigo)
    CREATOR_MIN_COMMISSION_RATE: 0.01,  // Minimum allowed creator commission rate (1%)
    CREATOR_MAX_COMMISSION_RATE: 0.30,  // Maximum allowed creator commission rate (30%)
    CREATOR_COMMISSION_RATE: 0.01,     // Default creator cut from seller payout base
    REFERRAL_REWARD_PER_PRODUCT: 3,    // Flat KES 3 referral reward per product sold by a referred seller
    DEFAULT_CURRENCY: 'KES',
    MIN_WITHDRAWAL_AMOUNT: 50,         // Minimum seller withdrawal amount in KES
    MAX_WITHDRAWAL_AMOUNT: 250000,
    WITHDRAWAL_FEE_TIERS: [
        { min: 50, max: 1500, fee: 21 },
        { min: 1500.01, max: 19999.99, fee: 45 },
        { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63 }
    ],
    toCents,
    roundMoney,
    calculateWithdrawalFee(amount) {
        const parsedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(parsedAmount)) {
            return 0;
        }

        const cents = toCents(parsedAmount);
        const minCents = toCents(this.MIN_WITHDRAWAL_AMOUNT);
        if (cents < minCents) {
            return 0;
        }

        // Tiers in integer cents:
        // Tier 1: 50.00 KES to 1,500.00 KES (<= 150,000 cents) -> fee KES 21
        if (cents <= 150000) {
            return 21;
        }
        // Tier 2: 1,500.01 KES to 19,999.99 KES (< 2,000,000 cents) -> fee KES 45
        if (cents < 2000000) {
            return 45;
        }
        // Tier 3: 20,000.00 KES and above (>= 2,000,000 cents) -> fee KES 63
        return 63;
    },
    calculateWithdrawalFeeInCents(amount) {
        return this.calculateWithdrawalFee(amount) * 100;
    },
    calculateProductServiceCharge(amount) {
        const parsedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return 0;
        }

        // Buyer service charge is ceil(subtotal × 2%) rounded UP to a whole KES
        // (authoritative Byblos rule): e.g. 999 → ceil(19.98) = 20.
        // Computed in integer cents to avoid IEEE-754 binary floating-point representation drift.
        const subtotalCents = toCents(parsedAmount);
        const chargeCents = Math.ceil((subtotalCents * 2) / 100);
        return Math.ceil(chargeCents / 100);
    },
    calculateProductServiceChargeInCents(amount) {
        return this.calculateProductServiceCharge(amount) * 100;
    }
};

export default Fees;
