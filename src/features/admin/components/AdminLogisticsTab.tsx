import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, ShieldCheck, Truck } from '@/shared/ui/icons';
import { toast } from 'sonner';
import { adminApi, type AdminLogisticsStatusFilter } from '@/features/admin/api';
import { adminQueryKeys } from '@/features/admin/api/queryKeys';
import type {
  LogisticsLeg,
  LogisticsLegType,
  LogisticsRequestCard,
  LogisticsSort,
  LogisticsStatusUpdate,
} from '@/features/logistics/api';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { STATUS_FILTERS, SORT_OPTIONS, label, formatCurrency } from '../utils/adminLogisticsTab.utils';
import { LogisticsAdminCard } from './adminLogisticsTab.components';

export function AdminLogisticsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminLogisticsStatusFilter>('all');
  const [sort, setSort] = useState<LogisticsSort>('priority');
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
    // Re-entrancy guard: one dispute action at a time, so a second click (or a
    // different resolution button) can't fire a duplicate before the first
    // resolves. The dispute buttons are also disabled while this is set.
    if (resolvingId !== null) return;

    const note = window.prompt('Add an admin note for the tracking history.') || '';
    setResolvingId(requestId);
    disputeMutation.mutate({ requestId, resolution, note });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-separator bg-surface-1 text-label">
          <CardContent className="p-4">
            <Truck className="mb-3 h-5 w-5 text-yellow-300" />
            <p className="text-xs uppercase tracking-widest text-label-2">Total</p>
            <p className="text-2xl font-semibold">{dashboard?.count || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-300/20 bg-red-500/10 text-label">
          <CardContent className="p-4">
            <AlertTriangle className="mb-3 h-5 w-5 text-red-300" />
            <p className="text-xs uppercase tracking-widest text-label-2">Failed</p>
            <p className="text-2xl font-semibold">{dashboard?.summary?.failed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-300/20 bg-yellow-300/10 text-label">
          <CardContent className="p-4">
            <Clock className="mb-3 h-5 w-5 text-yellow-300" />
            <p className="text-xs uppercase tracking-widest text-label-2">Delayed</p>
            <p className="text-2xl font-semibold">{dashboard?.summary?.delayed || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-300/20 bg-cyan-300/10 text-label">
          <CardContent className="p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-cyan-200" />
            <p className="text-xs uppercase tracking-widest text-label-2">Review</p>
            <p className="text-2xl font-semibold">{dashboard?.summary?.manualReview || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation: fees owed to Mzigo across the requests in this view. */}
      <Card className="border-separator bg-surface-1 text-label">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-widest text-label-2">Owed to Mzigo — this view</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
            <span className="text-label-2">Delivery fees <span className="ml-1 font-semibold tabular-nums text-label">{formatCurrency(feeTotals.delivery)}</span></span>
            <span className="text-label-2">Collection fees <span className="ml-1 font-semibold tabular-nums text-label">{formatCurrency(feeTotals.collection)}</span></span>
            <span className="text-label-2">Pickup fees <span className="ml-1 font-semibold tabular-nums text-label">{formatCurrency(feeTotals.pickup)}</span></span>
            <span className="text-base font-semibold">Total <span className="ml-1 tabular-nums">{formatCurrency(feeTotals.pickup + feeTotals.delivery + feeTotals.collection)}</span></span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-separator bg-surface-1 text-label">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl text-label">Logistics Oversight</CardTitle>
            <p className="mt-1 text-sm text-label-2">Delivered completes logistics only. Escrow release stays under order completion rules.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                onClick={() => setStatus(filter.value)}
                className={status === filter.value ? 'bg-yellow-300 text-black hover:bg-yellow-200' : 'bg-fill text-label hover:bg-white hover:text-black'}
              >
                {filter.label}
              </Button>
            ))}
            <select
              className="h-9 rounded-xl border border-separator bg-black px-3 text-sm text-label"
              value={sort}
              onChange={(event) => setSort(event.target.value as LogisticsSort)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {logisticsQuery.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-fill" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-separator bg-black p-8 text-center text-label-2">
              No logistics requests match this filter.
            </div>
          ) : (
            <div className="grid gap-5">
              {requests.map((request) => (
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
        </CardContent>
      </Card>
    </div>
  );
}


