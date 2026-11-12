import apiClient from '@/infrastructure/http/apiClient';

export async function getOrderStatus(orderNumber: string, clientCheckoutToken?: string | null): Promise<unknown> {
  // Send the checkout ownership token so a verified buyer's poll can return an
  // auto-login token (backend gates it on this secret + payment success + verified).
  const url = clientCheckoutToken
    ? `/public/orders/${orderNumber}/status?client_checkout_token=${encodeURIComponent(clientCheckoutToken)}`
    : `/public/orders/${orderNumber}/status`;
  const response = await apiClient.get<unknown>(url);
  const data = response.data as Record<string, unknown>;
  return data.data;
}

export async function initiateProduct(payload: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
  const response = await apiClient.post('/payments/initiate-product', payload, {
    headers: {
      'Idempotency-Key': idempotencyKey
    }
  });
  return response.data;
}

export async function validateDiscountCode(payload: { code: string; order_amount: number }): Promise<unknown> {
  const response = await apiClient.post('/discount-codes/validate', payload);
  return response.data;
}

export async function getPaymentStatus(reference: string): Promise<unknown> {
  const response = await apiClient.get(`/payments/status/${reference}`);
  return response.data;
}

export async function getLogisticsQuote(payload: { legType: string; location: { address: string; latitude: number; longitude: number } }, signal?: AbortSignal): Promise<unknown> {
  const response = await apiClient.post('/payments/logistics-quote', payload, { signal });
  return response.data;
}

export async function cancelPublicOrder(orderNumber: string, clientCheckoutToken?: string | null): Promise<unknown> {
  const response = await apiClient.post(`/public/orders/${orderNumber}/cancel`, { clientCheckoutToken });
  return response.data;
}


