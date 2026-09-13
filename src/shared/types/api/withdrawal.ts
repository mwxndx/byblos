/**
 * The complete set of values withdrawal_requests.status can hold — the single
 * source of truth for withdrawal status across the app. This mirrors the backend
 * CHECK constraint exactly (server migration
 * 20260913130000_add_withdrawal_status_check_constraints): createWithdrawalRequest
 * seeds 'processing'/'manual_review'; the payout state machine drives the terminal
 * 'completed'/'failed'/'compensation_required'; admin reject sets 'rejected'; and
 * 'success'/'paid' are legacy completed-equivalents the service still recognises.
 * Keep this union in lockstep with that constraint — do NOT loosen it to `string`.
 */
export type WithdrawalStatus =
  | 'processing'
  | 'manual_review'
  | 'completed'
  | 'failed'
  | 'compensation_required'
  | 'rejected'
  | 'success'
  | 'paid';

export interface ApiWithdrawalRequest {
  id: string;
  amount: number;
  withdrawalFee?: number;
  totalDeducted?: number;
  mpesaNumber: string;
  mpesaName: string;
  status: WithdrawalStatus;
  createdAt: string;
  updatedAt?: string;
  processedAt?: string;
  processedBy?: string;
  providerReference?: string;
  mpesaReceipt?: string;
  failureReason?: string;
}


