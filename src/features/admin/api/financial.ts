import { api } from './instance';

// Must reject on failure -- see the matching comment in buyers.ts.
export async function getFinancialMetrics() {
  const response = await api.get('/admin/metrics/financial');
  return response.data.data || {
    totalSales: 0,
    totalOrders: 0,
    totalCommission: 0,
    totalRefunds: 0,
    totalRefundRequests: 0,
    pendingRefunds: 0,
    netRevenue: 0
  };
}

// Must reject on failure -- see the matching comment in buyers.ts.
export async function getMonthlyFinancialData() {
  const response = await api.get('/admin/metrics/financial/monthly');
  return response.data.data || [];
}

// Unlike the other admin reads, this one intentionally keeps a catch: it
// backs a payment-provider health widget, and the backend itself already
// degrades per-provider ({error: message}) rather than failing the whole
// request (see admin.controller.js getPaymentProviderBalances). Treating a
// health CHECK's own failure as a reason to fail the entire admin dashboard
// would be a worse outcome than showing "Unavailable" for this one widget.
// Both branches now return the identical shape (previously the success path
// fell back to `null`, forcing every consumer to handle two different
// "no data" shapes for the same condition).
export async function getPaymentProviderBalances() {
  try {
    const response = await api.get('/admin/payment-provider/balances');
    return response.data.data || {
      payin: { error: 'Unavailable' },
      payout: { error: 'Unavailable' },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      payin: { error: 'Unavailable' },
      payout: { error: 'Unavailable' },
      timestamp: new Date().toISOString()
    };
  }
}

export async function getRefundRequests(status: string) {
  const response = await api.get(`/admin/refunds?status=${status}`);
  return response.data;
}

export async function confirmRefund(id: number | string, data: { adminNotes: string }, headers: Record<string, string>) {
  const response = await api.patch(`/admin/refunds/${id}/confirm`, data, { headers });
  return response.data;
}

export async function rejectRefund(id: number | string, data: { adminNotes: string }, headers: Record<string, string>) {
  const response = await api.patch(`/admin/refunds/${id}/reject`, data, { headers });
  return response.data;
}


