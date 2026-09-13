// Single source of truth for turning a raw withdrawal status into UI text and a
// semantic colour tone. Every portal (buyer refund, seller, creator, admin)
// renders withdrawal statuses; before this each hand-rolled its own mapping (or
// showed the raw enum like "MANUAL_REVIEW"). Keep the label/tone maps aligned
// with the WithdrawalStatus union in shared/types/api/withdrawal.ts.

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  processing: 'Processing',
  manual_review: 'Under Review',
  completed: 'Completed',
  failed: 'Failed',
  compensation_required: 'Action Needed',
  rejected: 'Rejected',
  success: 'Completed',
  paid: 'Completed',
  // Legacy/label-only values that may still appear in historical rows or UI defaults.
  pending: 'Pending',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

/**
 * Maps a raw withdrawal status to a user-friendly label. Unknown statuses are
 * Title-Cased (underscores -> spaces) rather than shown raw, so no backend enum
 * term (e.g. "manual_review") ever leaks into the UI.
 */
export const getWithdrawalStatusLabel = (status?: string | null): string => {
  const key = (status || '').toLowerCase();
  if (WITHDRAWAL_STATUS_LABELS[key]) return WITHDRAWAL_STATUS_LABELS[key];
  if (!key) return 'Pending';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Semantic tone for badge colouring — each render site maps this to its own classes. */
export type WithdrawalStatusTone = 'success' | 'danger' | 'review' | 'progress';

const WITHDRAWAL_STATUS_TONES: Record<string, WithdrawalStatusTone> = {
  completed: 'success',
  success: 'success',
  paid: 'success',
  failed: 'danger',
  rejected: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  compensation_required: 'review',
  manual_review: 'review',
  processing: 'progress',
  pending: 'progress',
};

/** Coarse tone for a status; defaults to 'progress' for unknown/in-flight values. */
export const getWithdrawalStatusTone = (status?: string | null): WithdrawalStatusTone =>
  WITHDRAWAL_STATUS_TONES[(status || '').toLowerCase()] || 'progress';
