import { api } from './instance';

// Both functions below deliberately let a request failure reject rather than
// resolving to []/null: this is a queryFn (getBuyers) and a mutationFn
// (getBuyerById, via useGetBuyerByIdMutation) respectively, and both already
// have a caller that handles rejection correctly -- TanStack Query's
// isError/retry for the former, and handleViewBuyer's existing try/catch +
// toast for the latter. Swallowing the error here previously meant a failed
// fetch silently looked like "zero buyers" / "buyer has no details" instead
// of a visible, retryable failure.
export async function getBuyers() {
  const response = await api.get('/admin/buyers');

  if (response.data && Array.isArray(response.data.data)) {
    return response.data.data.map((buyer: Record<string, unknown>) => ({
      id: String(buyer.id || `buyer-${globalThis.crypto.randomUUID()}`),
      name: String(buyer.name || buyer.full_name || 'Unnamed Buyer'),
      email: String(buyer.email || ''),
      phone: buyer.phone ? String(buyer.phone) : undefined,
      status: String(buyer.status || 'Active'),
      city: buyer.city || 'N/A',
      location: buyer.location || 'N/A',
      createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString(),
      user_id: buyer.user_id
    }));
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
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


