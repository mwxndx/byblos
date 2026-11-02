import { Loader2, Wallet } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { MIN_WITHDRAWAL_AMOUNT, getMaxWithdrawableAmount } from '../dashboardUtils';
import { formatKes } from './withdrawalsTab.utils';

interface WithdrawalRequestFormProps {
  balance: number;
  showWithdrawalForm: boolean;
  setShowWithdrawalForm: (show: boolean) => void;
  handleWithdrawalRequest: (event: React.FormEvent) => Promise<void>;
  withdrawalForm: { amount: string; mpesaNumber: string; mpesaName: string };
  setWithdrawalForm: React.Dispatch<React.SetStateAction<{ amount: string; mpesaNumber: string; mpesaName: string }>>;
  isRequestingWithdrawal: boolean;
  withdrawalFee: number;
  totalDeducted: number;
}

const inputClass = 'h-11 bg-[#121214] border-[#34343a] text-white placeholder:text-[#a1a1a6] rounded-[12px] focus:border-[#f5c518] focus-visible:ring-1 focus-visible:ring-[#f5c518]';

export function WithdrawalRequestForm({
  balance,
  showWithdrawalForm,
  setShowWithdrawalForm,
  handleWithdrawalRequest,
  withdrawalForm,
  setWithdrawalForm,
  isRequestingWithdrawal,
  withdrawalFee,
  totalDeducted,
}: Readonly<WithdrawalRequestFormProps>) {
  const maxWithdrawable = getMaxWithdrawableAmount(balance);

  return (
    <div>
      {!showWithdrawalForm ? (
        <Button
          onClick={() => setShowWithdrawalForm(true)}
          className="gap-2 shadow-md px-5 py-2.5 rounded-[12px] font-semibold text-xs sm:text-sm w-full sm:w-auto h-11 bg-[#f5c518] hover:bg-[#e5b510] text-black transition-transform active:scale-95"
          disabled={balance < MIN_WITHDRAWAL_AMOUNT}
        >
          <Wallet className="h-4 w-4" />
          Request Withdrawal
        </Button>
      ) : (
        <div className="border border-[#34343a] bg-[#27272c] text-white rounded-[16px] p-5 sm:p-6 md:p-8 shadow-sm">
          <div className="mb-4">
            <h4 className="text-lg sm:text-xl font-bold text-white">Request Withdrawal</h4>
            <p className="text-xs text-[#a1a1a6] mt-0.5">Available to withdraw: {formatKes(balance)}</p>
          </div>

          <form onSubmit={handleWithdrawalRequest} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount" className="text-xs font-semibold text-[#a1a1a6] mb-1.5 block">
                  Amount (KSh)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount"
                  min={MIN_WITHDRAWAL_AMOUNT}
                  max={maxWithdrawable}
                  className={inputClass}
                  required
                />
                <p className="text-[11px] text-[#a1a1a6] mt-1">
                  Max: {formatKes(maxWithdrawable)}
                </p>
              </div>

              <div>
                <Label htmlFor="mpesaNumber" className="text-xs font-semibold text-[#a1a1a6] mb-1.5 block">
                  M-Pesa Number
                </Label>
                <Input
                  id="mpesaNumber"
                  type="tel"
                  value={withdrawalForm.mpesaNumber}
                  onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaNumber: e.target.value }))}
                  placeholder="0712345678"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="mpesaName" className="text-xs font-semibold text-[#a1a1a6] mb-1.5 block">
                Name on M-Pesa Number
              </Label>
              <Input
                id="mpesaName"
                type="text"
                value={withdrawalForm.mpesaName}
                onChange={(e) => setWithdrawalForm(prev => ({ ...prev, mpesaName: e.target.value }))}
                placeholder="Enter name as registered on M-Pesa"
                className={inputClass}
                required
              />
            </div>

            {totalDeducted > 0 && (
              <div className="rounded-[12px] border border-[#34343a] bg-[#121214] p-3 text-xs text-white space-y-1">
                <div className="flex items-center justify-between text-[#a1a1a6]">
                  <span>Withdrawal charge</span>
                  <span>{formatKes(withdrawalFee)}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-white pt-1 border-t border-[#34343a]">
                  <span>Total deducted from balance</span>
                  <span className="text-[#f5c518]">{formatKes(totalDeducted)}</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-[#a1a1a6] leading-relaxed">
              Withdrawals are reviewed and sent to your M-Pesa within 1-3 business days.
            </p>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
              <Button
                type="submit"
                disabled={isRequestingWithdrawal || totalDeducted > balance}
                className="shadow-md px-5 py-2.5 h-11 text-xs sm:text-sm rounded-[12px] font-semibold w-full sm:w-auto bg-[#f5c518] hover:bg-[#e5b510] text-black transition-transform active:scale-95"
              >
                {isRequestingWithdrawal ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5 mr-2" />
                    Confirm Withdrawal
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowWithdrawalForm(false);
                  setWithdrawalForm({
                    amount: '',
                    mpesaNumber: '',
                    mpesaName: ''
                  });
                }}
                className="px-5 py-2.5 h-11 text-xs sm:text-sm rounded-[12px] border-[#34343a] bg-[#121214] text-white hover:bg-white/10 w-full sm:w-auto font-medium"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
