import { Clock } from '@/shared/ui/icons';
import { Skeleton } from '@/shared/ui/skeleton';
import { useRefundHistoryQuery } from '@/features/buyer/hooks/queries/useRefundHistoryQuery';
import { formatSettlementDate } from '@/features/buyer/utils/refundUtils';

function statusMeta(status: string): { label: string; cls: string } {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'success') {
    return { label: 'Paid', cls: 'bg-[#30d158]/15 text-[#30d158]' };
  }
  if (s === 'rejected') {
    return { label: 'Rejected', cls: 'bg-[#ff5a52]/15 text-[#ff5a52]' };
  }
  if (s === 'failed' || s === 'cancelled' || s === 'canceled') {
    return { label: 'Failed', cls: 'bg-[#ff5a52]/15 text-[#ff5a52]' };
  }
  return { label: 'Processing', cls: 'bg-[#f5c518]/15 text-[#f5c518]' };
}

function formatKsh(amount: number): string {
  return `KSh ${Number(amount || 0).toLocaleString('en-KE')}`;
}

export function RefundHistory() {
  const { data, isLoading, isError } = useRefundHistoryQuery();
  const requests = data?.requests ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-[#f5c518]" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Refund history</h3>
      </div>

      {isLoading ? (
        <div role="status" aria-busy="true" aria-live="polite" className="space-y-2">
          <span className="sr-only">Loading refund history…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[14px]" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#27272c] p-4 text-sm text-slate-500 dark:text-[#a1a1a6]">
          Couldn’t load your refund history. Please try again.
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-slate-50 dark:bg-[#27272c] p-4 text-sm text-slate-500 dark:text-[#a1a1a6]">
          No refund withdrawals yet.
        </p>
      ) : (
        <ul className="rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] divide-y divide-slate-100 dark:divide-[#34343a] overflow-hidden">
          {requests.map((request) => {
            const meta = statusMeta(request.status);
            return (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 p-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatKsh(request.amount)}</p>
                  <p className="text-xs text-slate-500 dark:text-[#a1a1a6] mt-0.5">M-Pesa · {formatSettlementDate(request.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default RefundHistory;
