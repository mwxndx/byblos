import { api } from './instance';
import type { WithdrawalStatus } from '@/shared/types/api/withdrawal';
import { toRequestParams, readPaginationMeta, type AdminListParams } from './pagination';
import type { PaginatedList } from '../types/dashboard';

// The exact 8 values the backend's withdrawal_requests.status CHECK
// constraint allows (migration 20260913130000) -- kept in lockstep with the
// WithdrawalStatus union it validates against.
const KNOWN_WITHDRAWAL_STATUSES = new Set<WithdrawalStatus>([
  'processing', 'manual_review', 'completed', 'failed',
  'compensation_required', 'rejected', 'success', 'paid'
]);

function isWithdrawalStatus(value: string): value is WithdrawalStatus {
  return (KNOWN_WITHDRAWAL_STATUSES as Set<string>).has(value);
}

// Narrows a raw status string into WithdrawalStatus | 'pending' instead of
// the plain `string` the previous `String(request.status || 'pending')`
// produced -- that widened type let useAdminDashboard.ts force-cast the
// whole array to WithdrawalRequest[] with zero runtime check, defeating the
// WithdrawalStatus union entirely (any typo'd/unexpected value would
// compile and silently mis-render/mis-branch downstream with no signal).
// The DB CHECK constraint makes an unrecognized value here practically
// impossible in normal operation; if it ever happens anyway (constraint
// removed, direct DB edit), warn instead of silently pretending it was
// validated -- getWithdrawalStatusLabel/Tone already render an unknown
// value safely, so surfacing it as-is (not silently relabeling it
// 'pending', which would misrepresent a real, different state) is correct.
function normalizeWithdrawalStatus(raw: unknown, requestId: string): WithdrawalStatus | 'pending' {
  const value = String(raw || '').toLowerCase();
  if (!value) return 'pending';
  if (isWithdrawalStatus(value)) return value;
  console.warn(`[admin] Unrecognized withdrawal status "${value}" for request ${requestId}`);
  return value as WithdrawalStatus;
}

// Must reject on failure -- see the matching comment in buyers.ts.
export async function getWithdrawalRequests(
  params: AdminListParams & { status?: string } = {}
): Promise<PaginatedList<Record<string, unknown>>> {
  const { status, ...listParams } = params;
  const requestParams = toRequestParams(listParams);
  if (status) requestParams.status = status;

  const response = await api.get('/admin/withdrawal-requests', { params: requestParams });

  const rows: unknown[] = response.data && Array.isArray(response.data.data)
    ? response.data.data
    : (Array.isArray(response.data) ? response.data : []);

  const items = rows.map((raw) => {
    const request = raw as Record<string, unknown>;
    const id = String(request.id || `withdrawal-${globalThis.crypto.randomUUID()}`);
    return {
      id,
      amount: Number(request.amount || 0),
      mpesaNumber: String(request.mpesa_number || request.mpesaNumber || ''),
      mpesaName: String(request.mpesa_name || request.mpesaName || ''),
      status: normalizeWithdrawalStatus(request.status, id),
      sellerId: String(request.seller_id || request.sellerId || ''),
      sellerName: String(request.entityName || request.entity_name || request.seller_name || request.sellerName || request.mpesaName || request.mpesa_name || 'Seller'),
      sellerEmail: String(request.entityEmail || request.entity_email || request.seller_email || request.sellerEmail || ''),
      providerReference: request.provider_reference || request.providerReference || null,
      createdAt: request.created_at || request.createdAt || new Date().toISOString(),
      processedAt: request.processed_at || request.processedAt || null,
      processedBy: request.processed_by || request.processedBy || null
    };
  });

  return { items, pagination: readPaginationMeta(response.data, items.length) };
}

// The backend (admin.service.js overrideWithdrawalStatus) only ever accepts
// 'completed' or 'failed' -- the only two values withdrawal_requests.status
// actually reaches in its real lifecycle (see withdrawal.service.js). It
// used to be called with 'approved'/'rejected', which every single call
// rejected with a 400 "must be 'completed' or 'failed'" -- unconditionally,
// not just on a double-click.
export async function updateWithdrawalRequestStatus(
  requestId: string,
  status: 'completed' | 'failed',
  idempotencyKey: string
) {
  return api.patch(
    `/admin/withdrawal-requests/${requestId}/status`,
    { status },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
}


