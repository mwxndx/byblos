import { api } from './instance';

// See the matching comment in buyers.ts: getSellers (a queryFn) and
// getSellerById (a mutationFn behind handleViewSeller's own try/catch) must
// reject on failure, not resolve to []/null, so the failure is actually
// visible instead of rendering as "zero sellers" / a silently empty modal.
export async function getSellers() {
  const response = await api.get('/admin/sellers');
  const sellersData = Array.isArray(response.data.data) ? response.data.data : [];
  return sellersData.map((seller: Record<string, unknown>) => ({
    ...seller,
    id: String(seller.id || ''),
    name: seller.name || seller.full_name || 'Unnamed Seller',
    phone: seller.phone || seller.whatsapp_number || '',
    createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
    user_id: seller.user_id
  }));
}

export async function getSellerById(id: string) {
  const response = await api.get(`/admin/sellers/${id}`);
  const seller = response.data.data;
  if (!seller) return null;
  return {
    ...seller,
    id: String(seller.id || ''),
    name: seller.name || seller.full_name || 'Unnamed Seller',
    phone: seller.phone || seller.whatsapp_number || '',
    createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
    recentOrders: (seller.recentOrders || []).map((o: Record<string, unknown>) => ({
      ...o,
      id: String(o.id || '')
    }))
  };
}

export function updateSellerStatus(sellerId: string, data: { status: string }, idempotencyKey: string) {
  return api.patch(
    `/admin/sellers/${sellerId}/status`,
    data,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
}


