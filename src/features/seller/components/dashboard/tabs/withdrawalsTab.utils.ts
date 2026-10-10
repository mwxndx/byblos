export const formatKes = (amount?: number | null) => {
  const safe = Number(amount);
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number.isFinite(safe) ? safe : 0);
};

// Withdrawal status labelling now lives in one shared place so every portal
// renders the same friendly text (and no raw enum leaks). Re-exported here so
// existing seller imports keep working.
export { getWithdrawalStatusLabel } from '@/shared/utils/withdrawalStatus';

export {
  formatSettlementDate,
  formatSettlementTimeOnly,
  formatSettlementTime
} from '@/shared/utils/settlementFormatting';
