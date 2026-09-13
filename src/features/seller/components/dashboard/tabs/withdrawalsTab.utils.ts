export const formatKes = (amount?: number | null) => {
  const safe = Number(amount);
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number.isFinite(safe) ? safe : 0);
};

// Withdrawal status labelling now lives in one shared place so every portal
// renders the same friendly text (and no raw enum leaks). Re-exported here so
// existing seller imports keep working.
export { getWithdrawalStatusLabel } from '@/shared/utils/withdrawalStatus';

export const formatSettlementDate = (value?: string | null) => {
  if (!value) return 'Pending schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending schedule';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export const formatSettlementTimeOnly = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

export const formatSettlementTime = (value?: string | null) => {
  if (!value) return 'Pending schedule';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending schedule';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};
