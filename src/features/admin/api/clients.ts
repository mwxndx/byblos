import { api } from './instance';
import { toRequestParams, readPaginationMeta, type AdminListParams } from './pagination';
import type { PaginatedList } from '../types/dashboard';

// Must reject on failure -- see the matching comment in buyers.ts.
export async function getClients(params: AdminListParams = {}): Promise<PaginatedList<Record<string, unknown>>> {
  const response = await api.get('/admin/clients', { params: toRequestParams(params) });
  const clientsData: unknown[] = Array.isArray(response.data.data) ? response.data.data : [];
  const items = clientsData.map((raw) => {
    const client = raw as Record<string, unknown>;
    return {
      ...client,
      id: String(client.id || ''),
      createdAt: client.created_at || client.createdAt || new Date().toISOString()
    };
  });

  return { items, pagination: readPaginationMeta(response.data, items.length) };
}


