import { Download, Info, Wallet, X } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { exportWithdrawalsToCSV } from '@/shared/utils/exportUtils';
import { getWithdrawalFee, MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_FEE_TIERS } from '../dashboardUtils';
import type { ApiWithdrawalRequest } from '@/shared/types/api/withdrawal';
import { formatKes, formatSettlementDate, formatSettlementTimeOnly } from './withdrawalsTab.utils';
import { WithdrawalHistoryCard } from './WithdrawalHistoryCard';
import { WithdrawalRequestForm } from './WithdrawalRequestForm';

interface WithdrawalsTabProps {
  balance: number;
  pendingSettlementBalance?: number;
  withdrawalReservedBalance?: number;
  refundReservedBalance?: number;
  nextSettlementAt?: string | null;
  endDate: string;
  filteredWithdrawals: ApiWithdrawalRequest[];
  handleWithdrawalRequest: (event: React.FormEvent) => Promise<void>;
  isRequestingWithdrawal: boolean;
  setEndDate: (date: string) => void;
  setShowWithdrawalForm: (show: boolean) => void;
  setStartDate: (date: string) => void;
  setWithdrawalForm: React.Dispatch<React.SetStateAction<{ amount: string; mpesaNumber: string; mpesaName: string }>>;
  showWithdrawalForm: boolean;
  startDate: string;
  withdrawalForm: { amount: string; mpesaNumber: string; mpesaName: string };
  withdrawalRequests: ApiWithdrawalRequest[];
}

export function WithdrawalsTab({
  balance,
  pendingSettlementBalance = 0,
  withdrawalReservedBalance = 0,
  refundReservedBalance = 0,
  nextSettlementAt = null,
  endDate,
  filteredWithdrawals,
  handleWithdrawalRequest,
  isRequestingWithdrawal,
  setEndDate,
  setShowWithdrawalForm,
  setStartDate,
  setWithdrawalForm,
  showWithdrawalForm,
  startDate,
  withdrawalForm,
  withdrawalRequests
}: Readonly<WithdrawalsTabProps>) {
  const requestedAmount = Number.parseFloat(withdrawalForm.amount || '0');
  const withdrawalFee = getWithdrawalFee(requestedAmount);
  const totalDeducted = Number.isFinite(requestedAmount) && requestedAmount >= MIN_WITHDRAWAL_AMOUNT
    ? requestedAmount + withdrawalFee
    : 0;
  const nextSettlementDate = nextSettlementAt
    ? formatSettlementDate(nextSettlementAt)
    : 'Pending schedule';
  const nextSettlementTime = nextSettlementAt
    ? formatSettlementTimeOnly(nextSettlementAt)
    : null;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Header matching Penpot */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Withdrawals</h2>
        <p className="text-xs sm:text-sm text-[#a1a1a6] mt-0.5">Request and track your withdrawal requests</p>
      </div>

      {/* ── Ready to Withdraw Hero Card (Matching Penpot) ───────────── */}
      <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#30d158]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a1a1a6]">Ready to Withdraw</h3>
            </div>
            <p className="mt-1 text-3xl sm:text-4xl font-extrabold text-[#30d158] tracking-tight tabular-nums">
              {formatKes(balance)}
            </p>
            <p className="mt-1 text-xs text-[#a1a1a6]">Available to send to M-Pesa immediately</p>
          </div>

          {!showWithdrawalForm && (
            <div className="w-full sm:w-auto shrink-0">
              <Button
                onClick={() => setShowWithdrawalForm(true)}
                className="gap-2 bg-[#f5c518] hover:bg-[#e5b510] text-black font-semibold rounded-[12px] px-5 py-2.5 text-xs sm:text-sm h-11 w-full sm:w-auto shadow-md transition-transform active:scale-95"
                disabled={balance < MIN_WITHDRAWAL_AMOUNT}
              >
                <Wallet className="h-4 w-4" />
                Request Withdrawal
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Supporting Balances (Preparing, In Transit, Held for Refunds) ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[14px] border border-[#34343a] bg-[#27272c] p-3 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            <h4 className="text-[10px] sm:text-xs font-semibold text-[#a1a1a6] uppercase tracking-wider truncate">
              Preparing
            </h4>
            <p className="mt-1 text-sm sm:text-lg font-bold text-[#f5c518] truncate tabular-nums">
              {formatKes(pendingSettlementBalance)}
            </p>
          </div>
          <p className="mt-1 text-[10px] text-[#a1a1a6] truncate">
            Next: {nextSettlementDate}
          </p>
        </div>

        <div className="rounded-[14px] border border-[#34343a] bg-[#27272c] p-3 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            <h4 className="text-[10px] sm:text-xs font-semibold text-[#a1a1a6] uppercase tracking-wider truncate">
              In Transit
            </h4>
            <p className="mt-1 text-sm sm:text-lg font-bold text-white truncate tabular-nums">
              {formatKes(withdrawalReservedBalance)}
            </p>
          </div>
          <p className="mt-1 text-[10px] text-[#a1a1a6] truncate">
            Processing
          </p>
        </div>

        <div className="rounded-[14px] border border-[#34343a] bg-[#27272c] p-3 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            <h4 className="text-[10px] sm:text-xs font-semibold text-[#a1a1a6] uppercase tracking-wider truncate">
              Held
            </h4>
            <p className="mt-1 text-sm sm:text-lg font-bold text-white truncate tabular-nums">
              {formatKes(refundReservedBalance)}
            </p>
          </div>
          <p className="mt-1 text-[10px] text-[#a1a1a6] truncate">
            Dispute hold
          </p>
        </div>
      </div>

      {/* ── Fee Information Banner ──────────────────────────────────── */}
      <div className="rounded-[14px] border border-[#34343a] bg-[#121214] p-3.5 sm:p-4 flex items-start gap-3">
        <div className="rounded-full border border-[#f5c518]/30 bg-[#f5c518]/10 p-1 mt-0.5 shrink-0">
          <Info className="h-3.5 w-3.5 text-[#f5c518]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-xs">Minimum: KSh {MIN_WITHDRAWAL_AMOUNT}</h4>
          <p className="text-[#a1a1a6] text-[11px] mt-0.5 leading-tight">
            Withdrawal charges are deducted from your available balance together with the requested amount.
          </p>
          <div className="mt-2 grid gap-1.5 text-[10px] font-semibold text-white sm:grid-cols-3">
            {WITHDRAWAL_FEE_TIERS.map((tier) => (
              <span key={tier.label} className="rounded-[8px] border border-[#34343a] bg-[#27272c] px-2.5 py-1">
                {tier.label}: KSh {tier.fee}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Withdrawal Form ─────────────────────────────────────────── */}
      {showWithdrawalForm && (
        <WithdrawalRequestForm
          balance={balance}
          showWithdrawalForm={showWithdrawalForm}
          setShowWithdrawalForm={setShowWithdrawalForm}
          handleWithdrawalRequest={handleWithdrawalRequest}
          withdrawalForm={withdrawalForm}
          setWithdrawalForm={setWithdrawalForm}
          isRequestingWithdrawal={isRequestingWithdrawal}
          withdrawalFee={withdrawalFee}
          totalDeducted={totalDeducted}
        />
      )}

      {/* ── Withdrawal Requests History ─────────────────────────────── */}
      <div className="rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Withdrawal Requests</h3>
            <p className="text-xs text-[#a1a1a6] mt-0.5">Track your withdrawal request history</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 bg-[#121214] border-[#34343a] text-white rounded-[12px] focus-visible:ring-1 focus-visible:ring-[#f5c518]"
              placeholder="Start date"
            />
            <span className="text-[#a1a1a6] text-xs">to</span>
            <Input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 bg-[#121214] border-[#34343a] text-white rounded-[12px] focus-visible:ring-1 focus-visible:ring-[#f5c518]"
              placeholder="End date"
            />
            {(startDate || endDate) && (
              <IconButton
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                variant="outline"
                aria-label="Clear date filters"
                className="border-[#34343a] bg-[#121214] text-white hover:bg-white/10 h-10 w-10 shrink-0 rounded-[10px]"
              >
                <X className="h-4 w-4" />
              </IconButton>
            )}
          </div>

          <Button
            onClick={() => exportWithdrawalsToCSV(withdrawalRequests)}
            variant="outline"
            className="border-[#34343a] bg-[#121214] text-white hover:bg-white/10 gap-2 h-10 rounded-[12px] font-medium shrink-0"
            disabled={withdrawalRequests.length === 0}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>

        {filteredWithdrawals.length > 0 ? (
          <div className="space-y-3">
            {filteredWithdrawals.map((request) => (
              <WithdrawalHistoryCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 border border-[#34343a] bg-[#121214] rounded-full flex items-center justify-center">
              <Wallet className="h-8 w-8 text-[#a1a1a6]" />
            </div>
            <h4 className="text-base font-semibold text-white mb-1">No withdrawal requests</h4>
            <p className="text-xs text-[#a1a1a6] max-w-xs mx-auto">You haven't made any withdrawal requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
