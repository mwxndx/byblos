import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Badge } from '@/shared/ui/badge';
import { Textarea } from '@/shared/ui/textarea';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { CheckCircle, XCircle, Clock, DollarSign, Loader2, AlertTriangle } from '@/shared/ui/icons';
import { RefundRequestCard } from '../components/RefundRequestCard';
import { useRefundRequests } from '../hooks/useRefundRequests';


export default function RefundRequestsPage() {
  const {
    requests,
    selectedRequest,
    setSelectedRequest,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    isRejectDialogOpen,
    setIsRejectDialogOpen,
    adminNotes,
    setAdminNotes,
    approvedAmount,
    setApprovedAmount,
    isProcessing,
    statusFilter,
    setStatusFilter,
    isOverdueOnly,
    setIsOverdueOnly,
    sortBy,
    setSortBy,
    isLoadingRequests,
    fetchRefundRequests,
    handleConfirmRefund,
    handleRejectRefund,
  } = useRefundRequests();

  const overdueCount = requests.filter((r) => {
    const isPendingOrReview = r.status === 'pending' || r.status === 'manual_review';
    if (!isPendingOrReview) return false;
    if (r.sla?.isBreached || r.is_sla_breached) return true;
    const requestedTime = new Date(r.requested_at).getTime();
    return Date.now() - requestedTime > 48 * 3600 * 1000;
  }).length;

  const getStatusBadge = (status: string, request?: RefundRequest) => {
    const isAutoApproved = (() => {
      if (!request) return false;
      try {
        const details = typeof request.payment_details === 'string'
          ? JSON.parse(request.payment_details)
          : (request.payment_details || {});
        return details.auto_approved === true;
      } catch {
        return false;
      }
    })();

    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'manual_review':
        return (
          <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Manual Review
          </Badge>
        );
      case 'completed':
        if (isAutoApproved) {
          return (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Auto-Approved
            </Badge>
          );
        }
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge className="bg-gray-500/10 text-label-2 border-separator">{status}</Badge>;
    }
  };

  const formatCurrency = (value: string) => {
    return `KSh ${Number.parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  if (isLoadingRequests) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-semibold text-label tracking-tight italic">REFUND<span className="text-red-500">.</span>PROTOCOL</h1>
          <p className="text-label-3 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 ml-1">Capital Reclamation Management</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-fill p-1.5 rounded-2xl border border-separator backdrop-blur-md flex-wrap gap-1">
            {['pending', 'manual_review', 'completed', 'rejected'].map((status) => (
              <Button
                key={status}
                variant="ghost"
                onClick={() => {
                  setStatusFilter(status);
                  setIsOverdueOnly(false);
                }}
                className={`capitalize px-5 h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 ${statusFilter === status && !isOverdueOnly
                  ? 'bg-white/10 text-label shadow-inner'
                  : 'text-label-3 hover:text-white hover:bg-fill'
                  }`}
              >
                {status === 'manual_review' ? 'Manual Review' : status}
              </Button>
            ))}
          </div>

          <div className="flex bg-fill p-1.5 rounded-2xl border border-separator backdrop-blur-md gap-1">
            <Button
              variant="ghost"
              onClick={() => setIsOverdueOnly(!isOverdueOnly)}
              className={`px-4 h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 ${
                isOverdueOnly
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-label-3 hover:text-red-400 hover:bg-fill'
              }`}
            >
              <span>🚨</span> Overdue SLA
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSortBy(sortBy === 'urgency' ? 'newest' : 'urgency')}
              className="px-4 h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest text-label-3 hover:text-white hover:bg-fill transition-all duration-300"
            >
              {sortBy === 'urgency' ? '⚡ Urgency' : '📅 Newest'}
            </Button>
          </div>
        </div>
      </div>

      {overdueCount > 0 && !isOverdueOnly && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-red-300 shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-3">
            <span className="text-xl animate-pulse">🚨</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                SLA Review Breaches Detected ({overdueCount} Overdue)
              </p>
              <p className="text-[11px] text-red-300/80">
                These requests have exceeded the 48-hour service level agreement and require urgent operator resolution.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOverdueOnly(true)}
            className="border-red-500/40 text-red-300 hover:bg-red-500 hover:text-white text-[10px] uppercase font-bold tracking-wider h-8 rounded-xl shrink-0"
          >
            Review Overdue Only
          </Button>
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-7 w-7" />}
          title={`No ${statusFilter} signals detected`}
          description="There are currently no refund requests in this view."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requests.map((request) => (
          <RefundRequestCard
            key={request.id}
            request={request}
            getStatusBadge={getStatusBadge}
            formatCurrency={formatCurrency}
            onApprove={() => {
              setAdminNotes('');
              setApprovedAmount(request.amount);
              setSelectedRequest(request);
              setIsConfirmDialogOpen(true);
            }}
            onReject={() => { setAdminNotes(''); setSelectedRequest(request); setIsRejectDialogOpen(true); }}
          />
        ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="bg-surface-1 border border-separator text-label sm:rounded-card p-10 max-w-md shadow-[0_0_100px_rgba(34,197,94,0.1)]"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-semibold text-label tracking-tight italic">AUTHORIZE<span className="text-green-500">.</span></DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 text-center shadow-inner">
                <p className="text-[10px] font-semibold text-green-500 uppercase tracking-widest mb-2 opacity-60">Requested Reclamation</p>
                <p className="text-4xl font-semibold text-green-400 tracking-tight tabular-nums mb-2">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <div className="h-px bg-green-500/20 w-12 mx-auto mb-2"></div>
                <p className="text-xs font-bold text-green-300">
                  Beneficiary: {selectedRequest.buyer_name}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="approvedAmountInput" className="text-[10px] font-semibold text-label-3 uppercase tracking-widest opacity-60">
                    Authorized Amount (KSh)
                  </Label>
                  {Number.parseFloat(approvedAmount || '0') < Number.parseFloat(selectedRequest.amount) && Number.parseFloat(approvedAmount || '0') > 0 && (
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Partial Refund
                    </span>
                  )}
                </div>
                <Input
                  id="approvedAmountInput"
                  type="number"
                  min="1"
                  max={selectedRequest.amount}
                  step="any"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="bg-white/[0.03] border-separator text-label rounded-2xl h-12 px-4 font-semibold text-base"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmNotes" className="text-[10px] font-semibold text-label-3 uppercase tracking-widest ml-1 opacity-60">Operator Log (Optional)</Label>
                <Textarea
                  id="confirmNotes"
                  placeholder="Record transmission details..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="bg-white/[0.03] border-separator text-label placeholder:text-gray-700 rounded-[1.5rem] focus:border-green-500/50 p-4 font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-8 gap-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmDialogOpen(false);
                setAdminNotes('');
                setApprovedAmount('');
              }}
              disabled={isProcessing}
              className="flex-1 h-12 border-separator text-label-3 hover:bg-fill hover:text-white bg-transparent rounded-2xl font-semibold text-[10px] uppercase tracking-widest"
            >
              Abort
            </Button>
            <Button
              onClick={handleConfirmRefund}
              disabled={isProcessing}
              className="flex-1 h-12 bg-green-500 hover:bg-green-400 text-black font-semibold text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-green-500/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="bg-surface-1 border border-separator text-label sm:rounded-card p-10 max-w-md shadow-[0_0_100px_rgba(239,68,68,0.1)]"
        >
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-semibold text-label tracking-tight italic">VETO<span className="text-red-500">.</span></DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-8">
              <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center shadow-inner">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-widest mb-4 opacity-60">Reclamation Void</p>
                <p className="text-5xl font-semibold text-red-400 tracking-tight tabular-nums mb-4">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                <div className="h-px bg-red-500/20 w-12 mx-auto mb-4"></div>
                <p className="text-xs font-bold text-red-300">
                  Subject: {selectedRequest.buyer_name}
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="rejectNotes" className="text-[10px] font-semibold text-label-3 uppercase tracking-widest ml-2 opacity-60">Veto Rationale *</Label>
                <Textarea
                  id="rejectNotes"
                  placeholder="Record rejection cause..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="bg-white/[0.03] border-separator text-label placeholder:text-gray-700 rounded-[1.5rem] focus:border-red-500/50 p-6 font-medium"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-10 gap-4 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setAdminNotes('');
              }}
              disabled={isProcessing}
              className="flex-1 h-12 border-separator text-label-3 hover:bg-fill hover:text-white bg-transparent rounded-2xl font-semibold text-[10px] uppercase tracking-widest"
            >
              Abort
            </Button>
            <Button
              onClick={handleRejectRefund}
              disabled={isProcessing || !adminNotes.trim()}
              className="flex-1 h-12 bg-red-500 hover:bg-red-400 text-white font-semibold text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/10"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Execute Veto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



