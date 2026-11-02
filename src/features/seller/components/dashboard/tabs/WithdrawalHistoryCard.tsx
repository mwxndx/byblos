import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { getWithdrawalFee } from '../dashboardUtils';
import type { ApiWithdrawalRequest } from '@/shared/types/api/withdrawal';
import { formatKes, getWithdrawalStatusLabel } from './withdrawalsTab.utils';
import { getWithdrawalStatusTone } from '@/shared/utils/withdrawalStatus';

export function WithdrawalHistoryCard({ request }: Readonly<{ request: ApiWithdrawalRequest }>) {
  return (
    <Card key={request.id} className="group transition-all duration-300 bg-[#27272c] border-[#34343a] text-white rounded-[16px] shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-w-0 justify-between items-start">
          <div className="space-y-3 min-w-0 w-full">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-lg sm:text-xl font-bold text-white truncate tabular-nums">
                {formatKes(request.amount)}
              </p>
              <Badge
                variant="outline"
                className={`${getWithdrawalStatusTone(request.status) === 'success'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : getWithdrawalStatusTone(request.status) === 'danger'
                    ? 'bg-red-500/15 text-red-300 border-red-500/30'
                    : getWithdrawalStatusTone(request.status) === 'review'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                  } rounded-full px-3 py-0.5 text-xs font-semibold`}
              >
                {getWithdrawalStatusLabel(request.status)}
              </Badge>
            </div>
            <p className="text-xs text-[#a1a1a6] break-words">
              M-Pesa: {request.mpesaNumber} ({request.mpesaName})
            </p>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 pt-1">
              <div className="rounded-[10px] border border-[#34343a] bg-[#121214] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]">Requested</p>
                <p className="text-xs font-medium text-white">{new Date(request.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="rounded-[10px] border border-[#34343a] bg-[#121214] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]">Processed</p>
                <p className="text-xs font-medium text-white">{request.processedAt ? new Date(request.processedAt).toLocaleDateString() : 'Pending'}</p>
              </div>
              <div className="rounded-[10px] border border-[#34343a] bg-[#121214] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]">Fee</p>
                <p className="text-xs font-medium text-white">{formatKes(request.withdrawalFee || getWithdrawalFee(request.amount))}</p>
              </div>
              <div className="rounded-[10px] border border-[#34343a] bg-[#121214] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]">Ref</p>
                <p className="truncate text-xs font-medium text-white">{request.providerReference || 'Pending'}</p>
              </div>
              <div className="rounded-[10px] border border-[#34343a] bg-[#121214] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]">Receipt</p>
                <p className="truncate text-xs font-medium text-white">{request.mpesaReceipt || 'Pending'}</p>
              </div>
              <div className="rounded-[10px] border border-[#34343a] bg-[#121214] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]">By</p>
                <p className="text-xs font-medium text-white">{request.processedBy || 'System'}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
