import { useState } from 'react';
import { Clock, Info, Loader2, Wallet } from 'lucide-react';
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

export function CreatorWithdrawalPanel({ creator, clearance, withdrawals }: CreatorWithdrawalPanelProps) {
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
      toast.success('Withdrawal request sent.');
      setWithdrawalAmount('');
    } catch (error: unknown) {
      toast.error(classifyApiError(error, 'Could not request withdrawal.').message);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="rounded-card border border-separator bg-surface-1 p-4 text-label sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-fill text-brand-text">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-label">Get paid</h2>
            <p className="text-xs text-label-3">To {creator.mpesaNumber || 'your registered M-Pesa'}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium text-label-3">Available</div>
          <div className="text-base font-semibold text-sys-green">{money(availableBalance)}</div>
        </div>
      </div>

      {/* Earnings split: commission vs invited-business — lifetime earned, not
          the withdrawable balance (which nets out past withdrawals + T+2 holds). */}
      <p className="mt-4 text-[10px] font-medium text-label-3">Earned to date</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="rounded-control border border-separator bg-surface-2 p-3">
          <p className="text-[10px] font-medium text-label-3">Commission</p>
          <p className="mt-0.5 text-sm font-semibold text-label">{money(commissionEarnings)}</p>
          <p className="text-[10px] text-label-3">From promoted shops</p>
        </div>
        <div className="rounded-control border border-separator bg-surface-2 p-3">
          <p className="text-[10px] font-medium text-label-3">Invited business</p>
          <p className="mt-0.5 text-sm font-semibold text-label">{money(referralEarnings)}</p>
          <p className="text-[10px] text-label-3">From businesses you invited</p>
        </div>
      </div>

      {isClearing ? (
        <div className="mt-4 space-y-2 rounded-control border border-separator bg-[color-mix(in_srgb,var(--sys-blue)_12%,transparent)] p-3.5 text-xs text-label-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-sys-blue">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>T+2 clearance active (2 business days)</span>
            </div>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--sys-blue)_18%,transparent)] px-2 py-0.5 text-[10px] font-medium text-sys-blue">T+2 holding</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            <strong className="font-medium text-label">{money(clearingBalance)}</strong> is clearing from recent earnings. Funds unlock for withdrawal on{' '}
            <span className="font-medium text-label">{formattedClearingDate}</span>
            {formattedClearingTime ? ` at ${formattedClearingTime}` : ''}.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-label-3">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Earnings unlock 2 business days (T+2) after each sale or referral.</span>
        </div>
      )}

      <div className="mt-4 rounded-control border border-separator bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] p-3 text-xs">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-label">M-Pesa withdrawal fees</span>
              <span className="text-[10px] font-medium text-label-2">Min: KSh {MIN_WITHDRAWAL_AMOUNT}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[10px] font-medium">
              {WITHDRAWAL_FEE_TIERS.map((tier) => (
                <div key={tier.label} className="rounded-control border border-separator bg-surface-2 p-1.5 text-label">
                  <div className="text-[9px] text-label-3">{tier.label}</div>
                  <div className="mt-0.5 font-semibold text-brand-text">Fee: KSh {tier.fee}</div>
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
            value={withdrawalAmount}
            onChange={(event) => setWithdrawalAmount(event.target.value)}
            placeholder="Amount in KSh"
            className="h-11 pr-16 font-medium"
          />
          {maxWithdrawable > 0 && (
            <button
              type="button"
              onClick={() => setWithdrawalAmount(String(maxWithdrawable))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] px-2 py-1 text-[11px] font-medium text-brand-text transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_28%,transparent)]"
            >
              Max
            </button>
          )}
        </div>

        {requestedAmount >= MIN_WITHDRAWAL_AMOUNT && (
          <div className="space-y-1.5 rounded-control border border-separator bg-fill p-3 text-xs font-medium">
            <div className="flex justify-between gap-3">
              <span className="text-label-2">Withdrawal charge</span>
              <span className="text-label">{money(withdrawalFee)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-label-2">Total deducted</span>
              <span className={cn('font-semibold', hasEnoughBalance ? 'text-brand-text' : 'text-sys-red')}>
                {money(totalDeduction)}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handleWithdrawal}
          disabled={withdrawing || requestedAmount < MIN_WITHDRAWAL_AMOUNT || !hasEnoughBalance || availableBalance < MIN_WITHDRAWAL_AMOUNT}
          className="h-11 w-full"
        >
          {withdrawing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
          ) : isClearing && availableBalance < MIN_WITHDRAWAL_AMOUNT ? (
            `Clearing (Available ${formattedClearingDate})`
          ) : availableBalance >= MIN_WITHDRAWAL_AMOUNT ? (
            'Withdraw to M-Pesa'
          ) : totalBalance > 0 ? (
            `Min withdrawal KSh ${MIN_WITHDRAWAL_AMOUNT}`
          ) : (
            'No balance available'
          )}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {(withdrawals || []).slice(0, 3).map((item) => {
          const tone = getWithdrawalStatusTone(item.status);
          const toneClass = tone === 'success'
            ? 'text-sys-green'
            : tone === 'danger'
              ? 'text-sys-red'
              : tone === 'review'
                ? 'text-sys-orange'
                : 'text-brand-text';
          return (
            <div key={item.id} className="rounded-control border border-separator bg-surface-2 p-3 text-xs text-label">
              <div className="flex justify-between gap-3 font-medium">
                <span>{money(item.amount)}</span>
                <span className={toneClass}>{getWithdrawalStatusLabel(item.status)}</span>
              </div>
              <p className="mt-1 text-label-3">Charge {money(item.withdrawal_fee)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
