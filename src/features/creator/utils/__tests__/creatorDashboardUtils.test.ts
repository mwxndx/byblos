import { describe, it, expect } from 'vitest';
import {
  money,
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getWithdrawalFee,
  getMaxWithdrawableAmount,
  formatSettlementDate,
  formatSettlementTimeOnly
} from '../creatorDashboardUtils';

describe('creatorDashboardUtils consolidation', () => {
  it('formats money string correctly', () => {
    expect(money(1500)).toBe('KSh 1,500');
    expect(money(0)).toBe('KSh 0');
  });

  it('provides consolidated withdrawal fee calculations', () => {
    expect(MIN_WITHDRAWAL_AMOUNT).toBe(50);
    expect(MAX_WITHDRAWAL_AMOUNT).toBe(250_000);
    expect(WITHDRAWAL_FEE_TIERS).toBeDefined();

    expect(getWithdrawalFee(100)).toBe(21);
    expect(getWithdrawalFee(5000)).toBe(45);
    expect(getWithdrawalFee(30000)).toBe(63);

    expect(getMaxWithdrawableAmount(71)).toBe(50);
    expect(getMaxWithdrawableAmount(2000)).toBe(1955);
  });

  it('formats settlement dates and times safely', () => {
    expect(formatSettlementDate(null)).toBe('Pending schedule');
    expect(formatSettlementDate('invalid-date')).toBe('Pending schedule');

    const d = new Date('2026-10-26T10:30:00Z');
    expect(formatSettlementDate(d)).toContain('2026');
    expect(formatSettlementTimeOnly(d)).toBeTruthy();
  });
});
