import { describe, it, expect } from 'vitest';
import {
  getMaxWithdrawableAmount,
  getWithdrawalFee,
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  isWeekend,
  addBusinessDays
} from '../refundUtils';

describe('refundUtils consolidation', () => {
  it('correctly exports withdrawal constants and calculates fee', () => {
    expect(MIN_WITHDRAWAL_AMOUNT).toBe(50);
    expect(MAX_WITHDRAWAL_AMOUNT).toBe(250_000);
    expect(WITHDRAWAL_FEE_TIERS).toBeDefined();

    expect(getWithdrawalFee(100)).toBe(21);
    expect(getWithdrawalFee(2000)).toBe(45);
    expect(getWithdrawalFee(25000)).toBe(63);
  });

  it('correctly calculates maximum withdrawable amount across balance tiers', () => {
    // Under minimum threshold (50 + 21 = 71)
    expect(getMaxWithdrawableAmount(70)).toBe(0);
    expect(getMaxWithdrawableAmount(71)).toBe(50);

    // Tier 1 cap
    expect(getMaxWithdrawableAmount(1521)).toBe(1500);

    // Tier 2
    expect(getMaxWithdrawableAmount(2000)).toBe(1955);

    // Tier 3
    expect(getMaxWithdrawableAmount(50000)).toBe(49937);
  });

  it('detects weekends correctly', () => {
    const saturday = new Date('2026-10-24T12:00:00Z');
    const sunday = new Date('2026-10-25T12:00:00Z');
    const monday = new Date('2026-10-26T12:00:00Z');

    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(sunday)).toBe(true);
    expect(isWeekend(monday)).toBe(false);
  });

  it('adds business days skipping weekends', () => {
    // Friday + 2 business days = Tuesday
    const friday = new Date('2026-10-23T12:00:00Z');
    const result = addBusinessDays(friday, 2);
    expect(result.getUTCDay()).toBe(2); // Tuesday
  });
});
