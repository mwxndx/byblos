import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { CheckCircle, User, Phone, XCircle } from '@/shared/ui/icons';
import type { ReactNode } from 'react';
import type { RefundRequest } from '../types/refunds';

interface RefundRequestCardProps {
  request: RefundRequest;
  getStatusBadge: (status: string, request?: RefundRequest) => ReactNode;
  formatCurrency: (value: string) => string;
  onApprove: () => void;
  onReject: () => void;
}

export function RefundRequestCard({ request, getStatusBadge, formatCurrency, onApprove, onReject }: RefundRequestCardProps) {
  const details = (() => {
    try {
      return typeof request.payment_details === 'string'
        ? JSON.parse(request.payment_details)
        : (request.payment_details || {});
    } catch {
      return {};
    }
  })();
  const isAutoApproved = details.auto_approved === true;

  const slaMetrics = (() => {
    if (request.sla) return request.sla;
    const requestedDate = new Date(request.requested_at || Date.now());
    const targetHours = Number(details.sla?.target_hours) || 48;
    const deadlineDate = details.sla?.deadline_at
      ? new Date(details.sla.deadline_at)
      : new Date(requestedDate.getTime() + targetHours * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const isTerminal = request.status === 'completed' || request.status === 'rejected';
    const isBreached = diffMs < 0;
    const hoursRemaining = !isBreached ? Math.max(0, Math.round(diffHours * 10) / 10) : 0;
    const hoursOverdue = isBreached ? Math.round(Math.abs(diffHours) * 10) / 10 : 0;
    let slaStatus: 'on_track' | 'warning' | 'breached' | 'met' = 'on_track';
    if (isTerminal) {
      slaStatus = details.sla?.is_breached ? 'breached' : 'met';
    } else if (isBreached) {
      slaStatus = 'breached';
    } else if (diffHours <= 12) {
      slaStatus = 'warning';
    }
    return {
      targetHours,
      deadlineAt: deadlineDate.toISOString(),
      hoursRemaining,
      hoursOverdue,
      isBreached,
      slaStatus,
      isEscalated: Boolean(details.sla?.is_breached || (!isTerminal && isBreached))
    };
  })();

  const isPendingOrReview = request.status === 'pending' || request.status === 'manual_review';
  const isOverdueActive = isPendingOrReview && slaMetrics.slaStatus === 'breached';

  return (
    <Card
      key={request.id}
      className={`bg-surface-1 backdrop-blur-2xl border ${
        isOverdueActive
          ? 'border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.08)]'
          : 'border-separator'
      } rounded-card overflow-hidden shadow-2xl group hover:border-white/20 transition-all duration-500`}
    >
      <CardHeader className="p-8 border-b border-separator bg-white/[0.01]">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-60">Sequence</p>
              <div className="px-3 py-1 bg-fill rounded-full border border-separator text-[10px] font-semibold text-label">#{request.id}</div>
              {request.order_number && (
                <div className="px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20 text-[10px] font-semibold text-orange-400">
                  Order: #{request.order_number}
                </div>
              )}
              {isAutoApproved && (
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1 shadow-sm shadow-emerald-500/10">
                  <span>⚡</span> Auto-Approved
                </div>
              )}
              {details.is_partial_approval && (
                <div className="px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/30 text-[10px] font-bold text-amber-400 flex items-center gap-1 shadow-sm shadow-amber-500/10">
                  <span>⚖️</span> Partial ({formatCurrency(String(details.credited_amount))})
                </div>
              )}
              {isPendingOrReview && (
                slaMetrics.slaStatus === 'breached' ? (
                  <div className="px-3 py-1 bg-red-500/15 rounded-full border border-red-500/40 text-[10px] font-bold text-red-400 flex items-center gap-1 shadow-sm shadow-red-500/10 animate-pulse">
                    <span>🚨</span> SLA Breached ({slaMetrics.hoursOverdue}h overdue)
                  </div>
                ) : slaMetrics.slaStatus === 'warning' ? (
                  <div className="px-3 py-1 bg-amber-500/15 rounded-full border border-amber-500/40 text-[10px] font-bold text-amber-400 flex items-center gap-1 shadow-sm shadow-amber-500/10">
                    <span>⚠️</span> SLA Expiring ({slaMetrics.hoursRemaining}h left)
                  </div>
                ) : (
                  <div className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 text-[10px] font-semibold text-blue-300 flex items-center gap-1">
                    <span>⏱️</span> SLA: {slaMetrics.hoursRemaining}h left
                  </div>
                )
              )}
            </div>
            <p className="text-[10px] font-semibold text-label-2 uppercase tracking-widest">
              Captured: {format(new Date(request.requested_at), 'MMM d, yyyy • h:mm a')}
            </p>
          </div>
          {getStatusBadge(request.status, request)}
        </div>
      </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40">Subject Identification</p>
                    <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-separator">
                      <div className="w-12 h-12 rounded-xl bg-fill flex items-center justify-center border border-separator shadow-inner">
                        <User className="h-5 w-5 text-label-2" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-label tracking-tight">{request.buyer_name}</p>
                        <p className="text-[10px] font-bold text-label-3 lowercase opacity-60">{request.buyer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-label-3 uppercase tracking-widest ml-1">
                      <Phone className="h-3 w-3" />
                      {request.buyer_phone}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40">Capital Breakdown</p>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] text-green-400/60 font-semibold uppercase tracking-widest mb-1">Requested Reclamation</p>
                      <p className="text-3xl font-semibold text-green-400 tracking-tight tabular-nums">
                        {formatCurrency(request.amount)}
                      </p>
                    </div>
                    <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest ml-1 opacity-60">
                      Total Allocation: <span className="text-label ml-2 tabular-nums">{formatCurrency(request.buyer_current_refunds)}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-separator space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40 mb-3">Protocol</p>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-separator text-xs font-bold text-label tracking-tight">
                        {request.payment_method}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40 mb-3">Endpoint Meta</p>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-separator space-y-2">
                        {details.phone && <p className="text-xs font-bold text-label-2">📱 {details.phone}</p>}
                        {details.name && <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest">{details.name}</p>}
                        {!details.phone && !details.name && <p className="text-xs font-bold text-gray-600">Standard M-Pesa</p>}
                      </div>
                    </div>
                  </div>

                  {details.policy_reason && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1">
                        Policy Triage Assessment
                      </p>
                      <p className="text-xs font-medium text-amber-200">
                        {details.policy_reason}
                      </p>
                    </div>
                  )}

                  {request.notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-40 mb-3">Subject Manifest</p>
                      <p className="text-xs font-medium text-label-2 bg-white/[0.02] p-5 rounded-2xl border border-separator leading-relaxed">{request.notes}</p>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest mb-3">Operator Annotation</p>
                      <p className="text-xs font-bold text-blue-400 bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20">{request.admin_notes}</p>
                    </div>
                  )}
                </div>

                {(request.status === 'pending' || request.status === 'manual_review') && (
                  <div className="flex gap-4 pt-6">
                    <Button
                      onClick={onApprove}
                      className="flex-1 h-14 bg-green-500 hover:bg-green-400 text-black font-semibold text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/10"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Authorize Payout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onReject}
                      className="flex-1 h-14 border-separator text-red-400 hover:bg-red-500 hover:text-white rounded-2xl bg-transparent font-semibold text-[10px] uppercase tracking-widest transition-all duration-300"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Veto Request
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
  );
}
