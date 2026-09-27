import { Clock } from '@/shared/ui/icons';
import { Skeleton } from '@/shared/ui/skeleton';
import { useRefundHistoryQuery } from '@/features/buyer/hooks/queries/useRefundHistoryQuery';
import { formatSettlementDate } from '@/features/buyer/utils/refundUtils';

function statusMeta(status: string): { label: string; cls: string } {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'paid' || s === 'success') {
    return { label: 'Paid', cls: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
  }
  if (s === 'rejected') {
    return { label: 'Rejected', cls: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400' };
  }
  if (s === 'failed' || s === 'cancelled' || s === 'canceled') {
    return { label: 'Failed', cls: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400' };
  }
  return { label: 'Processing', cls: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300' };
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
        <Clock className="h-4 w-4 text-[#F5C518]" />
        <h3 className="text-sm font-bold text-slate-950 dark:text-white">Refund history</h3>
      </div>

      {isLoading ? (
        <div role="status" aria-busy="true" aria-live="polite" className="space-y-2">
          <span className="sr-only">Loading refund history…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-slate-200 dark:border-separator bg-slate-50 dark:bg-surface-1 p-4 text-sm text-slate-500 dark:text-white/60">
          Couldn’t load your refund history. Please try again.
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-slate-200 dark:border-separator bg-slate-50 dark:bg-surface-1 p-4 text-sm text-slate-500 dark:text-white/60">
          No refund withdrawals yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => {
            const meta = statusMeta(request.status);
            return (
              <li
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-separator bg-slate-50 dark:bg-surface-1 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-950 dark:text-white">{formatKsh(request.amount)}</p>
                  <p className="text-xs text-slate-500 dark:text-white/60">{formatSettlementDate(request.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.cls}`}>
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
