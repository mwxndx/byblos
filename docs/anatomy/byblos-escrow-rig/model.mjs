/**
 * Byblos Escrow & Settlement Machine - Mathematical & Financial Model
 *
 * Models the multi-party atomic clearing workflow in Byblos:
 * - Deposit: 10,000 KES (100% held in escrow upon checkout)
 * - Seller Net Payout: 85% (8,500 KES)
 * - Courier Logistics Fee: 10% (1,000 KES)
 * - Byblos Platform Commission: 5% (500 KES)
 */

export const DEPOSIT_TOTAL = 10000; // KES
export const SHARES = {
  seller: 0.85,
  courier: 0.10,
  commission: 0.05,
};

export const AMOUNTS = {
  deposit: DEPOSIT_TOTAL,
  seller: DEPOSIT_TOTAL * SHARES.seller,       // 8,500 KES
  courier: DEPOSIT_TOTAL * SHARES.courier,     // 1,000 KES
  commission: DEPOSIT_TOTAL * SHARES.commission //   500 KES
};

export const ESCROW_TRAVEL = 36; // px travel of the upper piston
export const GATE_TRAVEL = 12;   // px travel of the release slide valve
export const LEVER_ANGLE = 28;   // degrees travel of the manual release lever

/**
 * Computes state quantities given settlement progress s in [0, 1].
 * s = 0: Escrow Locked (Order processing, funds securely escrowed)
 * s = 1: Fully Cleared (Delivery confirmed via OTP, funds dispatched to multi-party ledgers)
 */
export function evaluateRig(s) {
  const progress = Math.max(0, Math.min(1, s));

  // Chamber financial balances
  const escrowRemaining = DEPOSIT_TOTAL * (1 - progress);
  const sellerReceived = AMOUNTS.seller * progress;
  const courierReceived = AMOUNTS.courier * progress;
  const commissionReceived = AMOUNTS.commission * progress;

  // Mechanical displacements
  const pistonDrop = progress * ESCROW_TRAVEL;
  const gateDrop = progress * GATE_TRAVEL;
  const leverTilt = progress * LEVER_ANGLE;
  const dialAngle = progress * Math.PI; // 0 to 180 deg sweep

  // Status message
  let statusText = "ESCROW LOCKED";
  let badgeTone = "lo";
  if (progress > 0.02 && progress < 0.98) {
    statusText = "SETTLING SPLITS (" + Math.round(progress * 100) + "%)";
    badgeTone = "mid";
  } else if (progress >= 0.98) {
    statusText = "FUNDS RELEASED & SETTLED";
    badgeTone = "lit";
  }

  return {
    progress,
    escrowRemaining,
    sellerReceived,
    courierReceived,
    commissionReceived,
    pistonDrop,
    gateDrop,
    leverTilt,
    dialAngle,
    statusText,
    badgeTone
  };
}
