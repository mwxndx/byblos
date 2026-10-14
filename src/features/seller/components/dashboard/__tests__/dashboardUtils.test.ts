import { describe, it, expect } from 'vitest';
import {
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getWithdrawalFee,
  getMaxWithdrawableAmount,
  getSellerInitials,
  formatOrderStatusLabel,
  getPendingStatusStyles,
  normalizeSellerAnalytics
} from '../dashboardUtils';

describe('Seller Dashboard Utils & Withdrawal Fee Rules', () => {
  describe('Fee Tiers & Limits', () => {
    it('enforces Safaricom M-Pesa limits and minimums', () => {
      expect(MIN_WITHDRAWAL_AMOUNT).toBe(50);
      expect(MAX_WITHDRAWAL_AMOUNT).toBe(250_000);
      expect(WITHDRAWAL_FEE_TIERS).toHaveLength(3);
    });

    it('calculates tiered withdrawal fee accurately', () => {
      // Sub-minimum
      expect(getWithdrawalFee(49)).toBe(0);
      expect(getWithdrawalFee(0)).toBe(0);

      // Tier 1: 50 - 1,500 (KSh 21)
      expect(getWithdrawalFee(50)).toBe(21);
      expect(getWithdrawalFee(1000)).toBe(21);
      expect(getWithdrawalFee(1500)).toBe(21);

      // Tier 2: 1,501 - 19,999.99 (KSh 45)
      expect(getWithdrawalFee(1501)).toBe(45);
      expect(getWithdrawalFee(10000)).toBe(45);
      expect(getWithdrawalFee(19999)).toBe(45);

      // Tier 3: 20,000+ (KSh 63)
      expect(getWithdrawalFee(20000)).toBe(63);
      expect(getWithdrawalFee(50000)).toBe(63);
      expect(getWithdrawalFee(250000)).toBe(63);
    });

    it('calculates maximum withdrawable amount respecting fees and threshold', () => {
      // Insufficient balance (under 50 + 21 = 71)
      expect(getMaxWithdrawableAmount(70)).toBe(0);
      expect(getMaxWithdrawableAmount(0)).toBe(0);

      // Tier 1 threshold: exactly 71 -> 50 net
      expect(getMaxWithdrawableAmount(71)).toBe(50);

      // Mid Tier 1: 500 balance -> 479 net
      expect(getMaxWithdrawableAmount(500)).toBe(479);

      // Tier 2: 2000 balance -> 1955 net
      expect(getMaxWithdrawableAmount(2000)).toBe(1955);

      // Cap at Safaricom limit (250,000)
      expect(getMaxWithdrawableAmount(300_000)).toBe(MAX_WITHDRAWAL_AMOUNT);
    });
  });

  describe('UI Formatting & Styling', () => {
    it('extracts seller initials cleanly', () => {
      expect(getSellerInitials('Acme Store')).toBe('AS');
      expect(getSellerInitials('Nairobi')).toBe('N');
      expect(getSellerInitials('', 'Default Shop')).toBe('DS');
      expect(getSellerInitials()).toBe('S');
    });

    it('formats order status labels nicely', () => {
      expect(formatOrderStatusLabel('READY_FOR_COLLECTION')).toBe('Ready For Collection');
      expect(formatOrderStatusLabel('PAID')).toBe('Paid');
    });

    it('returns appropriate badge styles for pending order statuses', () => {
      expect(getPendingStatusStyles('PAID')).toContain('border-yellow-200');
      expect(getPendingStatusStyles('SERVICE_PENDING')).toContain('border-purple-200');
      expect(getPendingStatusStyles('READY_FOR_BUYER')).toContain('border-emerald-200');
      expect(getPendingStatusStyles('UNKNOWN')).toContain('border-slate-200');
    });
  });

  describe('normalizeSellerAnalytics', () => {
    it('provides safe defaults when analyticsData is null/empty', () => {
      const result = normalizeSellerAnalytics([], null);
      expect(result.totalProducts).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.balance).toBe(0);
      expect(result.creatorCount).toBe(0);
      expect(result.recentOrders).toEqual([]);
    });

    it('normalizes API analytics response correctly', () => {
      const mockAnalytics = {
        totalProducts: 1,
        totalRevenue: 45000,
        balance: 12000,
        availableBalance: 11000,
        creator_count: 5,
        creator_generated_sales: 15000,
        monthlySales: [{ month: 'Jan', sales: 45000 }]
      };

      const result = normalizeSellerAnalytics([{ id: 1, name: 'P1', price: 100 } as unknown as import('@/shared/types/view/productSummary').ProductSummary], mockAnalytics);
      expect(result.totalProducts).toBe(1);
      expect(result.totalRevenue).toBe(45000);
      expect(result.balance).toBe(12000);
      expect(result.availableBalance).toBe(11000);
      expect(result.creatorCount).toBe(5);
      expect(result.creatorGeneratedSales).toBe(15000);
    });
  });
});
