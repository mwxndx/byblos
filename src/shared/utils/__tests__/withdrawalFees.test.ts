import { describe, it, expect } from 'vitest';
import {
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getWithdrawalFee,
  getMaxWithdrawableAmount,
} from '../withdrawalFees';

describe('withdrawalFees utility', () => {
  describe('constants', () => {
    it('defines expected min and max withdrawal bounds', () => {
      expect(MIN_WITHDRAWAL_AMOUNT).toBe(50);
      expect(MAX_WITHDRAWAL_AMOUNT).toBe(250_000);
      expect(WITHDRAWAL_FEE_TIERS).toHaveLength(3);
    });
  });

  describe('getWithdrawalFee', () => {
    it('returns 0 for non-finite or sub-minimum amounts', () => {
      expect(getWithdrawalFee(0)).toBe(0);
      expect(getWithdrawalFee(-10)).toBe(0);
      expect(getWithdrawalFee(49.99)).toBe(0);
      expect(getWithdrawalFee(NaN)).toBe(0);
      expect(getWithdrawalFee(Infinity)).toBe(0);
    });

    it('calculates Tier 1 fee (KES 21) for KES 50 to 1,500', () => {
      expect(getWithdrawalFee(50)).toBe(21);
      expect(getWithdrawalFee(500)).toBe(21);
      expect(getWithdrawalFee(1500)).toBe(21);
    });

    it('calculates Tier 2 fee (KES 45) for KES 1,500.01 to 19,999.99', () => {
      expect(getWithdrawalFee(1500.01)).toBe(45);
      expect(getWithdrawalFee(5000)).toBe(45);
      expect(getWithdrawalFee(19999.99)).toBe(45);
    });

    it('calculates Tier 3 fee (KES 63) for KES 20,000 and above', () => {
      expect(getWithdrawalFee(20000)).toBe(63);
      expect(getWithdrawalFee(50000)).toBe(63);
      expect(getWithdrawalFee(250000)).toBe(63);
    });
  });

  describe('getMaxWithdrawableAmount', () => {
    it('returns 0 when balance is below minimum withdrawal plus minimum fee', () => {
      expect(getMaxWithdrawableAmount(0)).toBe(0);
      expect(getMaxWithdrawableAmount(50)).toBe(0);
      expect(getMaxWithdrawableAmount(70.99)).toBe(0);
    });

    it('calculates maximum net amount in Tier 1', () => {
      // 71 balance -> 71 - 21 = 50 net
      expect(getMaxWithdrawableAmount(71)).toBe(50);
      // 1000 balance -> 1000 - 21 = 979 net
      expect(getMaxWithdrawableAmount(1000)).toBe(979);
      // 1521 balance -> 1521 - 21 = 1500 net (max for Tier 1)
      expect(getMaxWithdrawableAmount(1521)).toBe(1500);
    });

    it('calculates maximum net amount in Tier 2', () => {
      // 2000 balance -> 2000 - 45 = 1955 net
      expect(getMaxWithdrawableAmount(2000)).toBe(1955);
      // 10000 balance -> 10000 - 45 = 9955 net
      expect(getMaxWithdrawableAmount(10000)).toBe(9955);
    });

    it('calculates maximum net amount in Tier 3 capped at Safaricom limit', () => {
      // 25000 balance -> 25000 - 63 = 24937 net
      expect(getMaxWithdrawableAmount(25000)).toBe(24937);
      // 300000 balance -> capped at MAX_WITHDRAWAL_AMOUNT (250,000)
      expect(getMaxWithdrawableAmount(300000)).toBe(250000);
    });
  });
});
