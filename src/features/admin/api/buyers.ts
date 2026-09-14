import { api } from './instance';
import { toRequestParams, readPaginationMeta, type AdminListParams } from './pagination';
import type { PaginatedList } from '../types/dashboard';

// Both functions below deliberately let a request failure reject rather than
// resolving to []/null: this is a queryFn (getBuyers) and a mutationFn
// (getBuyerById, via useGetBuyerByIdMutation) respectively, and both already
// have a caller that handles rejection correctly -- TanStack Query's
// isError/retry for the former, and handleViewBuyer's existing try/catch +
// toast for the latter. Swallowing the error here previously meant a failed
// fetch silently looked like "zero buyers" / "buyer has no details" instead
// of a visible, retryable failure.
export async function getBuyers(params: AdminListParams = {}): Promise<PaginatedList<Record<string, unknown>>> {
  const response = await api.get('/admin/buyers', { params: toRequestParams(params) });

  const rows: unknown[] = response.data && Array.isArray(response.data.data)
    ? response.data.data
    : (Array.isArray(response.data) ? response.data : []);

  const items = rows.map((raw) => {
    const buyer = raw as Record<string, unknown>;
    return {
      id: String(buyer.id || `buyer-${globalThis.crypto.randomUUID()}`),
      name: String(buyer.name || buyer.full_name || 'Unnamed Buyer'),
      email: String(buyer.email || ''),
      phone: buyer.phone ? String(buyer.phone) : undefined,
      status: String(buyer.status || 'Active'),
      city: buyer.city || 'N/A',
      location: buyer.location || 'N/A',
      createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString(),
      user_id: buyer.user_id
    };
  });

  return { items, pagination: readPaginationMeta(response.data, items.length) };
}

export async function getBuyerById(id: string) {
  const response = await api.get(`/admin/buyers/${id}`);
  const buyer = response.data.data;
  if (!buyer) return null;
  return {
    ...buyer,
    id: String(buyer.id || ''),
    name: buyer.name || buyer.full_name || 'Unnamed Buyer',
    phone: buyer.phone || buyer.mobile_payment || '',
    createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString()
  };
}

export async function deleteUser(userId: string, idempotencyKey: string) {
  const response = await api.delete(`/admin/users/${userId}`, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}


