import type { WithdrawalStatus } from '@/shared/types/api/withdrawal';
export {
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getWithdrawalFee,
  getMaxWithdrawableAmount
} from '@/shared/utils/withdrawalFees';
export {
  formatSettlementDate,
  formatSettlementTimeOnly
} from '@/shared/utils/settlementFormatting';

export const money = (amount: number | string) => `KSh ${Number(amount || 0).toLocaleString()}`;
export type AnalysisPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Mirror server/src/domains/growth/creators/creatorLimits.js — used for the
// "X/3" counters and to disable actions at the cap.
export const MAX_PROMOTED_SHOPS = 3;
export const MAX_INVITED_BUSINESSES = 3;
export type ApiError = { response?: { data?: { message?: string } }; message?: string };
export type CreatorProfile = {
  id?: number;
  userId?: number;
  balance?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  mpesaNumber?: string;
  whatsappNumber?: string;
  instagramLink?: string | null;
  tiktokLink?: string | null;
  totalEarnings?: number;
  totalSales?: number;
};
export type ShopRequest = { id: number; shop_name?: string; seller_name?: string };
export type LinkedShop = {
  id: number;
  seller_id?: number;
  shop_name?: string;
  slug?: string;
  avatar_url?: string | null;
  code?: string;
  commission_rate?: number | string;
  sales_count?: number | string;
  click_count?: number | string;
  earnings?: number | string;
  sellerCreatorModeOff?: boolean;
  status?: string;
};
export type InvitedBusiness = {
  id: number;
  shop_name?: string;
  earnings?: number | string;
  units_sold?: number | string;
};
export type AnalysisRow = {
  period?: string;
  period_start?: string;
  month?: string;
  sales?: number | string;
  sales_value?: number | string;
  salesValue?: number | string;
  earnings?: number | string;
  commission_earnings?: number | string;
  referral_earnings?: number | string;
  clicks?: number | string;
};
export type BusinessEarningRow = {
  period?: string;
  period_start?: string;
  seller_id: number;
  shop_name?: string;
  earnings?: number | string;
};
export type WithdrawalRow = { id: number; amount?: number | string; withdrawal_fee?: number | string; status?: WithdrawalStatus };
export type LeaderboardRow = {
  id: number;
  first_name?: string;
  last_name?: string;
  total_sales?: number | string;
  total_income?: number | string;
};
export type CreatorClearance = {
  totalBalance?: number;
  availableBalance?: number;
  clearingBalance?: number;
  nextAvailableAt?: string | null;
  isClearing?: boolean;
  flaggedAmount?: number;
  hasFlaggedHolds?: boolean;
  commissionEarnings?: number;
  referralEarnings?: number;
};

export type DashboardData = {
  creator?: CreatorProfile;
  clearance?: CreatorClearance;
  shops?: LinkedShop[];
  shopRequests?: ShopRequest[];
  analysis?: AnalysisRow[];
  businessEarnings?: BusinessEarningRow[];
  analysisPeriod?: string;
  monthly?: AnalysisRow[];
  withdrawals?: WithdrawalRow[];
  leaderboard?: LeaderboardRow[];
  linkClicks?: number;
};
export type ReferralData = { referralCode?: string; referredSellers?: InvitedBusiness[] };



// Error messaging now goes through the shared classifyApiError
// (src/shared/utils/errorClassification) so network/timeout/HTTP-body failures
// are distinguished consistently across the app.
