import { api } from './instance';
import { toRequestParams, readPaginationMeta, type AdminListParams } from './pagination';
import type { PaginatedList } from '../types/dashboard';

// Must reject on failure -- see the matching comment in buyers.ts.
export async function getCreators(params: AdminListParams = {}): Promise<PaginatedList<Record<string, unknown>>> {
  const response = await api.get('/admin/creators', { params: toRequestParams(params) });
  const creatorsData: unknown[] = Array.isArray(response.data.data) ? response.data.data : [];
  const items = creatorsData.map((raw) => {
    const creator = raw as {
      id?: string | number;
      user_id?: string | number;
      name?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      mpesa_number?: string;
      whatsapp_number?: string;
      balance?: number | string;
      total_sales?: number | string;
      total_earnings?: number | string;
      total_referral_earnings?: number | string;
      total_income?: number | string;
      linked_shops?: number | string;
      link_clicks?: number | string;
      pending_requests?: number | string;
      status?: string;
      created_at?: string;
      createdAt?: string;
      [key: string]: unknown;
    };
    return {
      ...creator,
      id: String(creator.id || ''),
      user_id: creator.user_id ? String(creator.user_id) : '',
      name: creator.name || [creator.first_name, creator.last_name].filter(Boolean).join(' ') || 'Unnamed Creator',
      email: String(creator.email || ''),
      mpesaNumber: String(creator.mpesa_number || ''),
      whatsappNumber: String(creator.whatsapp_number || ''),
      balance: Number(creator.balance || 0),
      totalSales: Number(creator.total_sales || 0),
      totalEarnings: Number(creator.total_earnings || 0),
      totalReferralEarnings: Number(creator.total_referral_earnings || 0),
      totalIncome: Number(creator.total_income || 0),
      linkedShops: Number(creator.linked_shops || 0),
      linkClicks: Number(creator.link_clicks || 0),
      pendingRequests: Number(creator.pending_requests || 0),
      status: String(creator.status || 'active'),
      createdAt: creator.created_at || creator.createdAt || new Date().toISOString()
    };
  });

  return { items, pagination: readPaginationMeta(response.data, items.length) };
}

export async function deleteCreator(creatorId: string, idempotencyKey: string) {
  const response = await api.delete(`/admin/creators/${creatorId}`, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}


