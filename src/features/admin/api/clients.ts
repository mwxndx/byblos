import { api } from './instance';

// Must reject on failure -- see the matching comment in buyers.ts.
export async function getClients() {
  const response = await api.get('/admin/clients');
  const clientsData = Array.isArray(response.data.data) ? response.data.data : [];
  return clientsData.map((client: Record<string, unknown>) => ({
    ...client,
    id: String(client.id || ''),
    createdAt: client.created_at || client.createdAt || new Date().toISOString()
  }));
}


