import { buyerApiInstance, ApiError } from './instance';
import type { ApiOrder } from '@/shared/types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// <unknown> + explicit narrowing at the unwrap boundary instead of the
// previous <any> -- see the matching comment on getOrders in
// seller/api/ordersApi.ts. Note this does not add full runtime validation
// of ApiOrder's other required fields (totalAmount, customer, seller,
// shippingAddress, per-item price/subtotal/imageUrl) -- the final `as
// ApiOrder` cast below still trusts those. Doing that properly would need a
// real schema (e.g. Zod) covering the whole shape, which is a larger,
// separate change; this fix is scoped to removing the blanket `any` that
// left every access on this unwrap path completely unchecked.
export async function getOrders(): Promise<ApiOrder[]> {
  const response = await buyerApiInstance.get<unknown>('/orders/user');
  let responseBody: unknown = response?.data !== undefined ? response.data : response;
  if (typeof responseBody === 'string' && responseBody.trim()) {
    try {
      responseBody = JSON.parse(responseBody);
    } catch {
      /* ignore json parse error */
    }
  }

  if (!responseBody || typeof responseBody !== 'object') {
    return [];
  }

  const body = responseBody as { data?: unknown; orders?: unknown };
  const nestedData = body.data as { orders?: unknown } | unknown[] | undefined;

  const rawOrders: unknown[] = Array.isArray(responseBody)
    ? responseBody
    : (Array.isArray(nestedData)
        ? nestedData
        : (Array.isArray((nestedData as { orders?: unknown } | undefined)?.orders)
            ? (nestedData as { orders: unknown[] }).orders
            : (Array.isArray(body.orders)
                ? body.orders
                : [])));

  return rawOrders.map((order: unknown) => {
    const o = (order && typeof order === 'object') ? (order as Record<string, unknown>) : {};
    return {
      ...o,
      items: o.items || [],
      status: typeof o.status === 'string' ? o.status.toUpperCase() : 'PENDING',
      paymentStatus: typeof o.paymentStatus === 'string' ? o.paymentStatus.toUpperCase() : 'PENDING'
    } as ApiOrder;
  });
}

export async function getOrder(orderId: string): Promise<ApiOrder> {
  const response = await buyerApiInstance.get<ApiResponse<ApiOrder>>(`/orders/${orderId}`);
  return response.data.data;
}

export async function cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await buyerApiInstance.patch(`/orders/${orderId}/cancel`);
    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to cancel order'
    };
  }
}

export async function confirmOrderReceipt(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const idempotencyKey = `confirm-receipt-${orderId}`;

    await buyerApiInstance.patch(`/orders/${orderId}/confirm-receipt`, {}, {
      timeout: 30000,
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });

    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    let errorMessage = 'Failed to confirm order receipt';

    if (err.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. Please check your internet connection and try again.';
    } else if (err.response) {
      errorMessage = err.response.data?.message || (err.response as { statusText?: string }).statusText || 'Server error occurred';
    } else if (err.request) {
      errorMessage = 'No response from server. Please try again later.';
    }

    throw new Error(errorMessage);
  }
}

export async function downloadDigitalProduct(orderId: string, productId: string, onProgress?: (percent: number) => void): Promise<void> {
  try {
    const response = await buyerApiInstance.get(`/orders/${orderId}/download/${productId}`, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download.zip';
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    const err = error as ApiError;
    throw new Error(err.response?.data?.message || 'Failed to download digital product');
  }
}

export async function markOrderAsCollected(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await buyerApiInstance.post(`/buyers/orders/${orderId}/collected`);
    return { success: true };
  } catch (error) {
    const err = error as ApiError;
    return {
      success: false,
      message: err.response?.data?.message || 'Failed to mark order as collected'
    };
  }
}

