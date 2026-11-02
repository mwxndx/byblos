import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, ShieldCheck, Truck } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { adminApi, type AdminLogisticsStatusFilter } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import type {
  LogisticsLegType,
  LogisticsSort,
  LogisticsStatusUpdate,
} from '@/features/logistics/api';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { STATUS_FILTERS, SORT_OPTIONS, formatCurrency } from '../utils/adminLogisticsTab.utils';
import { LogisticsAdminCard } from './adminLogisticsTab.components';
import { AdminPaginationControls } from './AdminPaginationControls';
import type { PaginationMeta } from '../types/dashboard';

export function AdminLogisticsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminLogisticsStatusFilter>('all');
  const [sort, setSort] = useState<LogisticsSort>('priority');
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, LogisticsStatusUpdate>>({});
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const logisticsQuery = useQuery({
    queryKey: adminQueryKeys.logistics(status, sort),
    queryFn: () => adminApi.getLogisticsRequests({ status, sort }),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: adminApi.updateLogisticsLegStatus,
    onSuccess: () => {
      toast.success('Logistics status updated');
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Status update failed', {
        description: err?.response?.data?.message || err?.message || 'The logistics status was not updated.',
      });
    },
    onSettled: () => setUpdatingKey(null),
  });

  const disputeMutation = useMutation({
    mutationFn: adminApi.resolveLogisticsDispute,
    onSuccess: () => {
      toast.success('Dispute action recorded');
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Dispute action failed', {
        description: err?.response?.data?.message || err?.message || 'The dispute action was not recorded.',
      });
    },
    onSettled: () => setResolvingId(null),
  });

  const dashboard = logisticsQuery.data;
  const requests = useMemo(() => dashboard?.requests || [], [dashboard]);

  useEffect(() => {
    setPage(1);
  }, [status, sort]);

  const total = requests.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRequests = useMemo(() => {
    return requests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [requests, safePage]);

  const pagination: PaginationMeta = useMemo(() => ({
    page: safePage,
    pageSize: PAGE_SIZE,
    total,
    hasMore: safePage * PAGE_SIZE < total,
  }), [safePage, total]);

  // Reconciliation totals: what Byblos owes Mzigo across the requests in view.
  const feeTotals = useMemo(
    () =>
      requests.reduce(
        (acc, r) => {
          acc.pickup += r.fees?.pickup || 0;
          acc.delivery += r.fees?.delivery || 0;
          acc.collection += r.fees?.collection || 0;
          return acc;
        },
        { pickup: 0, delivery: 0, collection: 0 }
      ),
    [requests]
  );

  const handleDraftStatus = (key: string, nextStatus: LogisticsStatusUpdate) => {
    setDraftStatuses((current) => ({ ...current, [key]: nextStatus }));
  };

  const handleOverride = (requestId: number, legType: LogisticsLegType, nextStatus: LogisticsStatusUpdate) => {
    const reason = window.prompt('Reason for admin logistics override?') || '';
    setUpdatingKey(`${requestId}:${legType}`);
    statusMutation.mutate({ requestId, legType, status: nextStatus, reason });
  };

  const handleResolveDispute = (
    requestId: number,
    resolution: 'manual_review' | 'continue_delivery' | 'mark_failed' | 'resolved'
  ) => {
    if (resolvingId !== null) return;
    const note = window.prompt('Add an admin note for the tracking history.') || '';
    setResolvingId(requestId);
    disputeMutation.mutate({ requestId, resolution, note });
  };

  const totalOwed = feeTotals.pickup + feeTotals.delivery + feeTotals.collection;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Penpot Admin Logistics Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card className="border-[#34343a] bg-[#27272c] text-white rounded-[16px] shadow-sm">
          <CardContent className="p-4">
            <Truck className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-white/70" />
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#a1a1a6]">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{dashboard?.count || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-[#27272c] text-white rounded-[16px] shadow-sm">
          <CardContent className="p-4">
            <AlertTriangle className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-[#ff5a52]" />
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#a1a1a6]">Failed</p>
            <p className="text-xl sm:text-2xl font-bold text-[#ff5a52]">{dashboard?.summary?.failed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-[#f5c518]/20 bg-[#27272c] text-white rounded-[16px] shadow-sm">
          <CardContent className="p-4">
            <Clock className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-[#f5c518]" />
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#a1a1a6]">Delayed</p>
            <p className="text-xl sm:text-2xl font-bold text-[#f5c518]">{dashboard?.summary?.delayed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-[#f5c518]/20 bg-[#27272c] text-white rounded-[16px] shadow-sm">
          <CardContent className="p-4">
            <ShieldCheck className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-[#f5c518]" />
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#a1a1a6]">Review</p>
            <p className="text-xl sm:text-2xl font-bold text-[#f5c518]">{dashboard?.summary?.manualReview || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation: fees owed to Mzigo across the requests in this view (Penpot Spec) */}
      <Card className="border-[#34343a] bg-[#27272c] text-white rounded-[16px] shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[#34343a] pb-3">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-[#a1a1a6]">Owed to Mzigo — this view</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tabular-nums">
                {formatCurrency(totalOwed)}
              </p>
            </div>
            <span className="text-xs text-[#a1a1a6]">Calculated across {requests.length} active legs</span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <div className="rounded-xl border border-[#34343a] bg-[#121214] p-2.5">
              <span className="text-[#a1a1a6] text-[11px] block">Delivery fees</span>
              <span className="font-semibold tabular-nums text-white text-sm">{formatCurrency(feeTotals.delivery)}</span>
            </div>
            <div className="rounded-xl border border-[#34343a] bg-[#121214] p-2.5">
              <span className="text-[#a1a1a6] text-[11px] block">Collection fees</span>
              <span className="font-semibold tabular-nums text-white text-sm">{formatCurrency(feeTotals.collection)}</span>
            </div>
            <div className="rounded-xl border border-[#34343a] bg-[#121214] p-2.5">
              <span className="text-[#a1a1a6] text-[11px] block">Pickup fees</span>
              <span className="font-semibold tabular-nums text-white text-sm">{formatCurrency(feeTotals.pickup)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#34343a] bg-[#27272c] text-white rounded-[16px] shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#34343a] pb-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl text-white font-bold">Logistics Oversight</CardTitle>
            <p className="mt-1 text-xs sm:text-sm text-[#a1a1a6]">Delivered completes logistics only. Escrow release stays under order completion rules.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                onClick={() => setStatus(filter.value)}
                className={status === filter.value
                  ? 'bg-white text-black hover:bg-neutral-100 font-semibold rounded-xl border border-transparent shadow-sm'
                  : 'bg-[#121214] border border-[#34343a] text-[#a1a1a6] hover:text-white rounded-xl'
                }
              >
                {filter.label}
              </Button>
            ))}
            <select
              className="h-9 rounded-xl border border-[#34343a] bg-[#121214] px-3 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#f5c518]"
              value={sort}
              onChange={(event) => setSort(event.target.value as LogisticsSort)}
              aria-label="Sort logistics requests"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {logisticsQuery.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl bg-[#121214] border border-[#34343a]" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-[#34343a] bg-[#121214] p-8 text-center text-sm text-[#a1a1a6]">
              No logistics requests match this filter.
            </div>
          ) : (
            <div className="grid gap-4">
              {paginatedRequests.map((request) => (
                <LogisticsAdminCard
                  key={request.id}
                  request={request}
                  draftStatuses={draftStatuses}
                  onDraftStatus={handleDraftStatus}
                  onOverride={handleOverride}
                  onResolveDispute={handleResolveDispute}
                  updatingKey={updatingKey}
                  resolvingId={resolvingId}
                />
              ))}
            </div>
          )}
          {total > PAGE_SIZE && (
            <div className="pt-4 border-t border-[#34343a]">
              <AdminPaginationControls pagination={pagination} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
