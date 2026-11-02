const TONE_CLASSES: Record<string, string> = {
  success: 'text-[#30d158]',
  danger: 'text-[#ff5a52]',
  review: 'text-[#f5c518]',
};

function getWithdrawalButtonContent(params: {
  withdrawing: boolean;
  isClearing: boolean;
  availableBalance: number;
  formattedClearingDate: string;
  totalBalance: number;
}) {
  const { withdrawing, isClearing, availableBalance, formattedClearingDate, totalBalance } = params;
  if (withdrawing) {
    return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>;
  }
  if (isClearing && availableBalance < MIN_WITHDRAWAL_AMOUNT) {
    return `Clearing (Available ${formattedClearingDate})`;
  }
  if (availableBalance >= MIN_WITHDRAWAL_AMOUNT) {
    return 'Withdraw to M-Pesa';
  }
  if (totalBalance > 0) {
    return `Min withdrawal KSh ${MIN_WITHDRAWAL_AMOUNT}`;
  }
  return 'No balance available';
}

import { useState } from 'react';
import { Clock, Info, Loader2, Wallet } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/utils/formatting';
import { getWithdrawalStatusLabel, getWithdrawalStatusTone } from '@/shared/utils/withdrawalStatus';
import { classifyApiError } from '@/shared/utils/errorClassification';
import { useCreatorWithdrawalMutation } from '@/features/creator/hooks/mutations/useCreatorWithdrawalMutation';
import {
  money,
  MIN_WITHDRAWAL_AMOUNT,
  MAX_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getWithdrawalFee,
  getMaxWithdrawableAmount,
  formatSettlementDate,
  formatSettlementTimeOnly,
  type CreatorProfile,
  type CreatorClearance,
  type WithdrawalRow
} from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorWithdrawalPanelProps {
  creator: CreatorProfile;
  clearance?: CreatorClearance;
  withdrawals: WithdrawalRow[];
}

export function CreatorWithdrawalPanel({ creator, clearance, withdrawals }: Readonly<CreatorWithdrawalPanelProps>) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const withdrawalMutation = useCreatorWithdrawalMutation();

  const totalBalance = Number(clearance?.totalBalance ?? creator.balance ?? 0);
  const availableBalance = Number(clearance?.availableBalance ?? creator.balance ?? 0);
  const clearingBalance = Number(clearance?.clearingBalance ?? 0);
  const isClearing = Boolean(clearance?.isClearing);
  const nextAvailableAt = clearance?.nextAvailableAt;
  const formattedClearingDate = nextAvailableAt ? formatSettlementDate(nextAvailableAt) : 'Pending schedule';
  const formattedClearingTime = nextAvailableAt ? formatSettlementTimeOnly(nextAvailableAt) : '';
  const maxWithdrawable = getMaxWithdrawableAmount(availableBalance);

  const commissionEarnings = Number(clearance?.commissionEarnings ?? 0);
  const referralEarnings = Number(clearance?.referralEarnings ?? 0);

  const requestedAmount = Number(withdrawalAmount || 0);
  const withdrawalFee = getWithdrawalFee(requestedAmount);
  const totalDeduction = requestedAmount >= MIN_WITHDRAWAL_AMOUNT ? requestedAmount + withdrawalFee : 0;
  const hasEnoughBalance = availableBalance >= totalDeduction;

  const handleWithdrawal = async () => {
    const amount = Number(withdrawalAmount);
    const fee = getWithdrawalFee(amount);
    const deduction = amount + fee;
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      toast.error(`Minimum withdrawal is KSh ${MIN_WITHDRAWAL_AMOUNT}.`);
      return;
    }
    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      toast.error(`Maximum withdrawal is KSh ${MAX_WITHDRAWAL_AMOUNT.toLocaleString()}.`);
      return;
    }
    if (availableBalance < deduction) {
      if (isClearing && totalBalance >= deduction) {
        toast.error(`Funds are currently clearing under standard T+2 holding. Available to withdraw now: KSh ${availableBalance.toLocaleString()}`);
      } else {
        toast.error(`Your available balance must cover the withdrawal and KSh ${fee} charge.`);
      }
      return;
    }
    setWithdrawing(true);
    try {
      await withdrawalMutation.mutateAsync(amount);
      toast.success(`Withdrawal of ${money(amount)} initiated.`);
      setWithdrawalAmount('');
    } catch (error: unknown) {
      toast.error(classifyApiError(error, 'Withdrawal request failed.').message);
    } finally {
      setWithdrawing(false);
    }
  };

  const buttonDisabled =
    withdrawing ||
    (isClearing && availableBalance < MIN_WITHDRAWAL_AMOUNT) ||
    !hasEnoughBalance ||
    requestedAmount < MIN_WITHDRAWAL_AMOUNT ||
    requestedAmount > MAX_WITHDRAWAL_AMOUNT;

  const buttonContent = getWithdrawalButtonContent({
    withdrawing,
    isClearing,
    availableBalance,
    formattedClearingDate,
    totalBalance
  });

  return (
    <section className="space-y-4 rounded-[16px] border border-[#34343a] bg-[#27272c] p-4 text-white sm:p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#121214] border border-[#34343a] text-[#f5c518]">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Get paid</h2>
            <p className="text-xs text-[#a1a1a6]">To {creator.mpesaNumber || 'your registered M-Pesa'}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium text-[#a1a1a6]">Available</div>
          <div className="text-base font-bold text-[#30d158]">{money(availableBalance)}</div>
        </div>
      </div>

      {/* Earnings split: commission vs invited-business */}
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1a6]">Earned to date</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-[#34343a] bg-[#121214] p-3">
          <p className="text-[10px] font-medium text-[#a1a1a6]">Commission</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{money(commissionEarnings)}</p>
          <p className="text-[10px] text-[#636366]">From promoted shops</p>
        </div>
        <div className="rounded-xl border border-[#34343a] bg-[#121214] p-3">
          <p className="text-[10px] font-medium text-[#a1a1a6]">Invited business</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{money(referralEarnings)}</p>
          <p className="text-[10px] text-[#636366]">From businesses you invited</p>
        </div>
      </div>

      {isClearing ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/10 p-3.5 text-xs text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-[#f5c518]">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>T+2 clearance active (2 business days)</span>
            </div>
            <span className="rounded-full bg-[#f5c518]/20 px-2 py-0.5 text-[10px] font-semibold text-[#f5c518]">T+2 holding</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
            <strong className="font-semibold text-white">{money(clearingBalance)}</strong> is clearing from recent earnings. Funds unlock for withdrawal on{' '}
            <span className="font-semibold text-white">{formattedClearingDate}</span>
            {formattedClearingTime ? ` at ${formattedClearingTime}` : ''}.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[#a1a1a6]">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#f5c518]" />
          <span>Earnings unlock 2 business days (T+2) after each sale or referral.</span>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[#34343a] bg-[#121214] p-3.5 text-xs">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#f5c518]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">M-Pesa withdrawal fees</span>
              <span className="text-[10px] font-medium text-[#a1a1a6]">Min: KSh {MIN_WITHDRAWAL_AMOUNT}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] font-medium">
              {WITHDRAWAL_FEE_TIERS.map((tier) => (
                <div key={tier.label} className="rounded-lg border border-[#34343a] bg-[#27272c] p-1.5 text-white">
                  <div className="text-[9px] text-[#a1a1a6]">{tier.label}</div>
                  <div className="mt-0.5 font-semibold text-[#f5c518]">Fee: KSh {tier.fee}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Input
            type="number"
            min={MIN_WITHDRAWAL_AMOUNT}
            max={MAX_WITHDRAWAL_AMOUNT}
            value={withdrawalAmount}
            onChange={(event) => setWithdrawalAmount(event.target.value)}
            placeholder="Amount in KSh"
            className="h-11 border-[#34343a] bg-[#121214] pr-16 font-medium text-white placeholder:text-[#636366]"
          />
          {maxWithdrawable > 0 && (
            <button
              type="button"
              onClick={() => setWithdrawalAmount(String(maxWithdrawable))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-[#f5c518]/20 px-2 py-1 text-[11px] font-semibold text-[#f5c518] transition-colors hover:bg-[#f5c518]/30"
            >
              Max
            </button>
          )}
        </div>

        {requestedAmount >= MIN_WITHDRAWAL_AMOUNT && (
          <div className="space-y-1.5 rounded-xl border border-[#34343a] bg-[#121214] p-3 text-xs font-medium">
            <div className="flex justify-between gap-3">
              <span className="text-[#a1a1a6]">Withdrawal charge</span>
              <span className="text-white">{money(withdrawalFee)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#a1a1a6]">Total deducted</span>
              <span className={cn('font-semibold', hasEnoughBalance ? 'text-[#f5c518]' : 'text-[#ff5a52]')}>
                {money(totalDeduction)}
              </span>
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={handleWithdrawal}
          disabled={buttonDisabled}
          className="h-12 w-full rounded-xl bg-white hover:bg-neutral-100 text-black font-semibold text-sm transition-all"
        >
          {buttonContent}
        </Button>
      </div>

      {/* Past withdrawals */}
      {withdrawals.length > 0 && (
        <div className="mt-5 border-t border-[#34343a] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a1a1a6]">Recent withdrawals</h3>
          <div className="mt-3 space-y-2">
            {withdrawals.slice(0, 5).map((w) => {
              const toneKey = getWithdrawalStatusTone(w.status);
              const toneClass = TONE_CLASSES[toneKey] || 'text-[#a1a1a6]';
              return (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-[#34343a] bg-[#121214] p-3 text-xs">
                  <div>
                    <p className="font-semibold text-white">{money(w.amount)}</p>
                    <p className="mt-0.5 text-[11px] text-[#636366]">{w.created_at ? formatSettlementDate(w.created_at) : 'Recent'}</p>
                  </div>
                  <span className={cn('font-semibold uppercase tracking-wide text-[10px]', toneClass)}>
                    {getWithdrawalStatusLabel(w.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
