import {
  getWithdrawalFee,
  getMaxWithdrawableAmount,
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS
} from '@/shared/utils/withdrawalFees';
import {
  formatSettlementDate,
  formatSettlementTimeOnly
} from '@/shared/utils/settlementFormatting';
import { formatCurrency as formatKes } from '@/shared/utils/formatting';

export {
  getWithdrawalFee,
  getMaxWithdrawableAmount,
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  formatKes,
  formatSettlementDate,
  formatSettlementTimeOnly
};

/**
 * Checks if a date falls on a weekend (Saturday or Sunday in UTC).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Adds business days (excluding weekends) to a start date (matching backend settlement logic).
 */
export function addBusinessDays(startDate: Date | string | number, days = 2): Date {
  const result = new Date(startDate);
  let remaining = Math.max(0, Math.floor(days));

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
}


