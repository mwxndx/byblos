import { api } from './instance';
import { toRequestParams, readPaginationMeta, type AdminListParams } from './pagination';
import type { PaginatedList } from '../types/dashboard';

// See the matching comment in buyers.ts: getSellers (a queryFn) and
// getSellerById (a mutationFn behind handleViewSeller's own try/catch) must
// reject on failure, not resolve to []/null, so the failure is actually
// visible instead of rendering as "zero sellers" / a silently empty modal.
export async function getSellers(params: AdminListParams = {}): Promise<PaginatedList<Record<string, unknown>>> {
  const response = await api.get('/admin/sellers', { params: toRequestParams(params) });
  const sellersData: unknown[] = Array.isArray(response.data.data) ? response.data.data : [];
  const items = sellersData.map((raw) => {
    const seller = raw as Record<string, unknown>;
    return {
      ...seller,
      id: String(seller.id || ''),
      name: seller.name || seller.full_name || 'Unnamed Seller',
      phone: seller.phone || seller.whatsapp_number || '',
      createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
      user_id: seller.user_id
    };
  });

  return { items, pagination: readPaginationMeta(response.data, items.length) };
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


