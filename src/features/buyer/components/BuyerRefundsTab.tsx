import { Clock, Wallet } from '@/shared/ui/icons';
import { useRefundCard } from '@/features/buyer/hooks/useRefundCard';
import { formatSettlementDate, formatSettlementTimeOnly } from '@/features/buyer/utils/refundUtils';
import { RefundConfirmDialog } from './RefundConfirmDialog';
import { RefundHistory } from './RefundHistory';

/**
 * Buyer refund withdrawals matching Penpot Buyer – Refunds board:
 * Hero "Ready to Withdraw" card with large balance & white CTA button,
 * 2x2 supporting balance grid, pending approval banner, and refund history.
 */
export function BuyerRefundsTab({ refundAmount }: Readonly<{ refundAmount: number }>) {
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
    <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-5">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Refunds</h2>
        <p className="text-sm text-slate-500 dark:text-[#a1a1a6]">
          Withdraw your refund balance to M-Pesa and track your requests
        </p>
      </div>

      {/* ── Ready to Withdraw Hero Card ───────────────────────── */}
      <div className="rounded-[16px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-5 sm:p-6 space-y-4 shadow-sm transition-colors">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 bg-[#30d158]/15 text-[#30d158] text-xs font-semibold">
            Ready to Withdraw
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#a1a1a6]">
            Available to send to M-Pesa immediately
          </p>
          <p className="text-3xl sm:text-[34px] font-bold tracking-tight text-slate-900 dark:text-white tabular-nums pt-1">
            {formatCurrency(availableBalance)}
          </p>
        </div>

        <button
          type="button"
          onClick={handleWithdrawClick}
          disabled={!canWithdraw}
          className="w-full h-14 rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          <span>{hasPendingRequest ? 'Withdrawal Pending' : 'Withdraw'}</span>
        </button>
      </div>

      {/* ── 2x2 Stats Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-3.5 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-[#a1a1a6] font-medium">Refund balance</p>
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-1 truncate">
            {formatCurrency(totalRefunds)}
          </p>
        </div>

        <div className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-3.5 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-[#a1a1a6] font-medium">Total credited</p>
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-1 truncate">
            {formatCurrency(totalRefunds)}
          </p>
        </div>

        <div className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-3.5 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-[#a1a1a6] font-medium">Clearing (T+2)</p>
          <p className="text-base sm:text-lg font-bold text-[#f5c518] tabular-nums mt-1 truncate">
            {formatCurrency(clearingBalance)}
          </p>
          {isClearing && (
            <p className="text-[10px] text-slate-400 dark:text-[#a1a1a6] mt-0.5 truncate">
              Next: {nextDate}
            </p>
          )}
        </div>

        <div className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] p-3.5 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-[#a1a1a6] font-medium">Available</p>
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-1 truncate">
            {formatCurrency(availableBalance)}
          </p>
        </div>
      </div>

      {/* ── Pending / clearance banner ───────────────────────── */}
      {!isLoadingPending && hasPendingRequest && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-[#f5c518]/30 bg-[#f5c518]/10 p-3.5 text-xs sm:text-sm font-semibold text-[#f5c518]">
          <Clock className="h-4 w-4 shrink-0" />
          <span>A withdrawal is awaiting admin approval.</span>
        </div>
      )}

      {!isLoadingPending && !hasPendingRequest && isClearing && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-blue-400/25 bg-blue-500/10 p-3.5 text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
          <Clock className="h-4 w-4 shrink-0 animate-pulse" />
          <span>
            <strong>{formatCurrency(clearingBalance)}</strong> is clearing under the T+2 holding period. Next available {nextDate}{nextTime ? ` at ${nextTime}` : ''}.
          </span>
        </div>
      )}

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
