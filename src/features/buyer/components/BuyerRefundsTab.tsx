import { Clock, Info, Wallet } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { useRefundCard } from '@/features/buyer/hooks/useRefundCard';
import { formatSettlementDate, formatSettlementTimeOnly } from '@/features/buyer/utils/refundUtils';
import { RefundConfirmDialog } from './RefundConfirmDialog';
import { RefundHistory } from './RefundHistory';

const cardClass =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-separator dark:bg-surface-1 sm:p-6';

/**
 * Buyer refund withdrawals, laid out like the seller Withdrawals tab so the
 * flow reads the same across roles: a hero "ready to withdraw" balance with the
 * withdraw action, supporting balance tiles, fee info, and a request history.
 * The withdraw form itself reuses the existing RefundConfirmDialog + the T+2
 * clearance logic buyers already have.
 */
export function BuyerRefundsTab({ refundAmount }: { refundAmount: number }) {
  const {
    isDialogOpen,
    setIsDialogOpen,
    isSubmitting,
    isLoadingPending,
    formatCurrency,
    handleWithdrawClick,
    handleConfirmWithdraw,
    handleSetMaxAmount,
    hasPendingRequest,
    totalRefunds,
    availableBalance,
    clearingBalance,
    isClearing,
    nextAvailableAt,
    maxWithdrawable,
    withdrawalAmount,
    setWithdrawalAmount,
    mpesaNumber,
    setMpesaNumber,
    mpesaName,
    setMpesaName,
    withdrawalFee,
    totalDeducted,
    remainingBalance,
    minWithdrawalAmount,
  } = useRefundCard(refundAmount);

  const nextDate = nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'Pending schedule';
  const nextTime = nextAvailableAt ? formatSettlementTimeOnly(nextAvailableAt) : null;
  const canWithdraw = !hasPendingRequest && !isLoadingPending && availableBalance >= minWithdrawalAmount;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
      <div className="px-2 text-center sm:px-0">
        <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">Refund Withdrawals</h2>
        <p className="text-xs font-medium text-slate-500 dark:text-white/60 sm:text-sm">
          Withdraw your refund balance to M-Pesa and track your requests
        </p>
      </div>

      {/* ── Hero balance ─────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 sm:text-sm">
                Ready to Withdraw
              </h3>
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-emerald-500 dark:text-emerald-400 sm:text-3xl">
              {formatCurrency(availableBalance)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-white/60">
              Available to send to M-Pesa immediately
            </p>
          </div>

          <Button
            onClick={handleWithdrawClick}
            disabled={!canWithdraw}
            className="h-11 w-full gap-2 rounded-xl bg-[#F5C518] px-5 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-50 sm:h-12 sm:w-auto"
          >
            <Wallet className="h-4 w-4" />
            {hasPendingRequest ? 'Withdrawal Pending' : 'Withdraw Refund'}
          </Button>
        </div>
      </div>

      {/* ── Supporting balance tiles ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-separator dark:bg-surface-1 sm:p-4">
          <div>
            <h4 className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 sm:text-xs">
              Refund balance
            </h4>
            <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-slate-900 dark:text-white sm:mt-1 sm:text-base md:text-xl">
              {formatCurrency(totalRefunds)}
            </p>
          </div>
          <p className="mt-1 truncate text-[9px] font-semibold text-slate-400 dark:text-white/40 sm:text-[10px]">Total credited</p>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-separator dark:bg-surface-1 sm:p-4">
          <div>
            <h4 className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 sm:text-xs">
              Clearing (T+2)
            </h4>
            <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-[#F5C518] sm:mt-1 sm:text-base md:text-xl">
              {formatCurrency(clearingBalance)}
            </p>
          </div>
          <p className="mt-1 truncate text-[9px] font-semibold text-slate-400 dark:text-white/40 sm:text-[10px]" title={`Next: ${nextDate}${nextTime ? ` at ${nextTime}` : ''}`}>
            {isClearing ? `Next: ${nextDate}` : 'No hold'}
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-separator dark:bg-surface-1 sm:p-4">
          <div>
            <h4 className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 sm:text-xs">
              Available
            </h4>
            <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-emerald-500 dark:text-emerald-400 sm:mt-1 sm:text-base md:text-xl">
              {formatCurrency(availableBalance)}
            </p>
          </div>
          <p className="mt-1 truncate text-[9px] font-semibold text-slate-400 dark:text-white/40 sm:text-[10px]">Withdrawable now</p>
        </div>
      </div>

      {/* ── Pending / clearance banner ───────────────────────── */}
      {!isLoadingPending && hasPendingRequest && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs font-semibold text-amber-600 dark:text-amber-300">
          <Clock className="h-4 w-4" />
          A withdrawal is awaiting admin approval.
        </div>
      )}
      {!isLoadingPending && !hasPendingRequest && isClearing && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-50 p-3 text-xs font-medium text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
          <Clock className="h-4 w-4 animate-pulse" />
          <span>
            <strong>{formatCurrency(clearingBalance)}</strong> is clearing under the T+2 holding period. Next available {nextDate}
            {nextTime ? ` at ${nextTime}` : ''}.
          </span>
        </div>
      )}

      {/* ── Fee info ─────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-3">
        <div className="mt-0.5 shrink-0 rounded-full border border-yellow-400/35 bg-yellow-400/15 p-1">
          <Info className="h-3.5 w-3.5 text-[#F5C518]" />
        </div>
        <div className="min-w-0">
          <h4 className="text-[11px] font-semibold text-slate-900 dark:text-white sm:text-xs">Minimum: KSh {minWithdrawalAmount}</h4>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-white/60">
            M-Pesa withdrawal charges (from KSh 21) are deducted from your refund balance together with the amount you request.
          </p>
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────── */}
      <RefundHistory />

      <RefundConfirmDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        availableBalance={availableBalance}
        maxWithdrawable={maxWithdrawable}
        withdrawalAmount={withdrawalAmount}
        onWithdrawalAmountChange={setWithdrawalAmount}
        onSetMaxAmount={handleSetMaxAmount}
        mpesaNumber={mpesaNumber}
        onMpesaNumberChange={setMpesaNumber}
        mpesaName={mpesaName}
        onMpesaNameChange={setMpesaName}
        withdrawalFee={withdrawalFee}
        totalDeducted={totalDeducted}
        remainingBalance={remainingBalance}
        minWithdrawalAmount={minWithdrawalAmount}
        onConfirm={handleConfirmWithdraw}
        isSubmitting={isSubmitting}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}

export default BuyerRefundsTab;
