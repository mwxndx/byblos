import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2 } from '@/shared/ui/icons';

interface RefundConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
  maxWithdrawable: number;
  withdrawalAmount: string;
  onWithdrawalAmountChange: (val: string) => void;
  onSetMaxAmount: () => void;
  mpesaNumber: string;
  onMpesaNumberChange: (val: string) => void;
  mpesaName: string;
  onMpesaNameChange: (val: string) => void;
  withdrawalFee: number;
  totalDeducted: number;
  remainingBalance: number;
  minWithdrawalAmount: number;
  onConfirm: () => void;
  isSubmitting: boolean;
  formatCurrency: (value: number) => string;
}

export function RefundConfirmDialog({
  open,
  onOpenChange,
  availableBalance,
  maxWithdrawable,
  withdrawalAmount,
  onWithdrawalAmountChange,
  onSetMaxAmount,
  mpesaNumber,
  onMpesaNumberChange,
  mpesaName,
  onMpesaNameChange,
  withdrawalFee,
  totalDeducted,
  remainingBalance,
  minWithdrawalAmount,
  onConfirm,
  isSubmitting,
  formatCurrency
}: RefundConfirmDialogProps) {
  const parsedAmount = Number.parseFloat(withdrawalAmount) || 0;
  const isAmountValid = parsedAmount >= minWithdrawalAmount && totalDeducted <= availableBalance;
  const isPhoneValid = Boolean(mpesaNumber.trim());
  const isNameValid = Boolean(mpesaName.trim());
  const canSubmit = isAmountValid && isPhoneValid && isNameValid && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-[480px] max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#1e1e22] text-slate-950 dark:text-white rounded-[20px] p-5 sm:p-6 shadow-2xl transition-colors duration-200">
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-[#34343a] mx-auto mb-2" />
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-xl font-bold text-slate-950 dark:text-white">
            Withdraw Refund Balance
          </DialogTitle>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#a1a1a6]">
            Available cleared balance: <strong className="text-slate-900 dark:text-white">{formatCurrency(availableBalance)}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount input & Max button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="withdrawal-amount" className="text-xs font-semibold text-slate-700 dark:text-[#a1a1a6]">
                Amount to withdraw (KSh)
              </Label>
              {maxWithdrawable > 0 && (
                <button
                  type="button"
                  onClick={onSetMaxAmount}
                  className="text-xs font-semibold text-[#f5c518] hover:underline"
                >
                  Max: {formatCurrency(maxWithdrawable)}
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="withdrawal-amount"
                type="number"
                min={minWithdrawalAmount}
                max={maxWithdrawable}
                step="any"
                value={withdrawalAmount}
                onChange={(e) => onWithdrawalAmountChange(e.target.value)}
                placeholder={`Min ${minWithdrawalAmount}`}
                className="h-14 rounded-[14px] border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#27272c] font-semibold text-slate-950 dark:text-white pr-16 text-base"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 dark:text-[#8a8a91]">
                KES
              </span>
            </div>
            {parsedAmount > 0 && parsedAmount < minWithdrawalAmount && (
              <p className="text-xs font-medium text-red-500">
                Minimum withdrawal amount is KSh {minWithdrawalAmount}
              </p>
            )}
            {totalDeducted > availableBalance && (
              <p className="text-xs font-medium text-red-500">
                Total deduction exceeds available balance of {formatCurrency(availableBalance)}
              </p>
            )}
          </div>

          {/* M-Pesa destination fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mpesa-number" className="text-xs font-semibold text-slate-700 dark:text-[#a1a1a6]">
                M-Pesa Phone Number
              </Label>
              <Input
                id="mpesa-number"
                type="tel"
                value={mpesaNumber}
                onChange={(e) => onMpesaNumberChange(e.target.value)}
                placeholder="0712 345 678"
                className="h-14 rounded-[14px] border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#27272c] font-medium text-slate-950 dark:text-white text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpesa-name" className="text-xs font-semibold text-slate-700 dark:text-[#a1a1a6]">
                Name on M-Pesa
              </Label>
              <Input
                id="mpesa-name"
                type="text"
                value={mpesaName}
                onChange={(e) => onMpesaNameChange(e.target.value)}
                placeholder="Registered name"
                className="h-14 rounded-[14px] border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#27272c] font-medium text-slate-950 dark:text-white text-base"
              />
            </div>
          </div>

          {/* Summary Breakdown Card */}
          {parsedAmount > 0 && (
            <div className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#27272c] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-[#a1a1a6]">
                <span>Withdrawal amount to receive</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-[#a1a1a6]">
                <span>Withdrawal charge</span>
                <span className="font-semibold text-slate-900 dark:text-white">+{formatCurrency(withdrawalFee)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-[#34343a] pt-2 flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                <span>Total deducted from refund balance</span>
                <span>{formatCurrency(totalDeducted)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-[#a1a1a6] pt-0.5">
                <span>Remaining refund balance</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(remainingBalance)}</span>
              </div>
            </div>
          )}

          {/* Withdrawal Fee Notice matching Penpot */}
          <div className="rounded-[14px] border border-[#f5c518]/30 bg-[#f5c518]/10 p-4 space-y-2">
            <p className="text-xs font-bold text-[#f5c518]">
              Withdrawal Fee Notice
            </p>
            <div className="space-y-1 text-xs text-slate-700 dark:text-[#a1a1a6]">
              <div className="flex items-center justify-between">
                <span>KSh 50 - KSh 1,500:</span>
                <span className="font-semibold text-slate-900 dark:text-white">KSh 21</span>
              </div>
              <div className="flex items-center justify-between">
                <span>KSh 1,501 - KSh 19,999:</span>
                <span className="font-semibold text-slate-900 dark:text-white">KSh 45</span>
              </div>
              <div className="flex items-center justify-between">
                <span>KSh 20,000 and above:</span>
                <span className="font-semibold text-slate-900 dark:text-white">KSh 63</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#a1a1a6] pt-1">
              This fee is automatically deducted from your refund balance.
            </p>
          </div>

          {/* Processing time notice */}
          <p className="text-xs text-slate-500 dark:text-[#a1a1a6] leading-relaxed">
            <strong>Schedule:</strong> Withdrawals are reviewed and sent to your M-Pesa within 1-3 business days.
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2.5 sm:flex-col sm:space-x-0 pt-2">
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            className="h-14 w-full rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Withdraw'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-14 w-full rounded-[14px] border-slate-200 dark:border-[#34343a] bg-transparent text-slate-800 dark:text-white font-semibold text-base hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
