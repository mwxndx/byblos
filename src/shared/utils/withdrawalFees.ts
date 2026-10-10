export const MIN_WITHDRAWAL_AMOUNT = 50;
export const MAX_WITHDRAWAL_AMOUNT = 250_000;
export const WITHDRAWAL_FEE_TIERS = [
  { min: 50, max: 1500, fee: 21, label: 'KSh 50 - KSh 1,500' },
  { min: 1501, max: 19999.99, fee: 45, label: 'KSh 1,501 - KSh 19,999' },
  { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63, label: 'KSh 20,000 and above' }
] as const;

export const getWithdrawalFee = (amount: number) => {
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) return 0;
  return WITHDRAWAL_FEE_TIERS.find(({ min, max }) => amount >= min && amount <= max)?.fee || 0;
};

/**
 * Calculates the maximum net withdrawal amount A such that A + getWithdrawalFee(A) <= availableBalance.
 * Caps at MAX_WITHDRAWAL_AMOUNT (KSh 250,000) per Safaricom M-Pesa B2C limits.
 * Returns 0 if availableBalance is less than MIN_WITHDRAWAL_AMOUNT + minimum fee (KSh 71).
 */
export const getMaxWithdrawableAmount = (availableBalance: number): number => {
  if (!Number.isFinite(availableBalance) || availableBalance < MIN_WITHDRAWAL_AMOUNT + 21) {
    return 0;
  }

  // Tier 3: >= 20,000, fee = 63. Threshold: 20000 + 63 = 20063
  if (availableBalance >= 20000 + 63) {
    const net = Math.floor((availableBalance - 63) * 100) / 100;
    return Math.min(MAX_WITHDRAWAL_AMOUNT, net);
  }

  // Tier 2: 1,501 - 19,999.99, fee = 45. Threshold: 1501 + 45 = 1546
  if (availableBalance >= 1501 + 45) {
    const net = Math.floor((availableBalance - 45) * 100) / 100;
    return Math.min(19999.99, net);
  }

  // Tier 1: 50 - 1,500, fee = 21. Threshold: 50 + 21 = 71
  if (availableBalance >= 50 + 21) {
    const net = Math.floor((availableBalance - 21) * 100) / 100;
    return Math.min(1500, net);
  }

  return 0;
};
