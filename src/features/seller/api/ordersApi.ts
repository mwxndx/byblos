import apiClient from '@/infrastructure/http/apiClient';
import type { ApiOrder, OrderStatus } from '@/shared/types';
import type { OrdersAnalytics, OrderQueryParams } from '../types';

const sellerApiInstance = apiClient;

export const sellerOrdersApi = {
  // Previously typed the raw axios response <any>, so every property read
  // through the fallback chain below (responseBody?.data?.orders etc.) was
  // completely unchecked -- the return type (Promise<ApiOrder[]>) was pure
  // assertion, trusted on nothing. <unknown> plus explicit narrowing at each
  // step keeps the same tolerance for multiple possible response shapes
  // (deliberate -- this backend's envelope shape isn't fully consistent
  // across endpoints) while forcing the compiler to actually check the
  // accesses instead of waving every one of them through.
  async getOrders(params?: OrderQueryParams): Promise<ApiOrder[]> {
    const response = await sellerApiInstance.get<unknown>('/sellers/orders', { params });
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

    const rawOrders: unknown = Array.isArray(responseBody)
      ? responseBody
      : (Array.isArray(nestedData)
          ? nestedData
          : (Array.isArray((nestedData as { orders?: unknown } | undefined)?.orders)
              ? (nestedData as { orders: unknown[] }).orders
              : (Array.isArray(body.orders)
                  ? body.orders
                  : [])));

    return rawOrders as ApiOrder[];
  },

  async getOrder(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.get<{ data: ApiOrder }>(`/sellers/orders/${orderId}`);
    return response.data.data;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<ApiOrder> {
    const response = await sellerApiInstance.patch<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}`,
      { status }
    );
    return response.data.data;
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string; refundAmount: number }> {
    const response = await sellerApiInstance.patch<{ success: boolean; message: string; refundAmount: number }>(
      `/orders/${orderId}/seller-cancel`
    );
    return response.data;
  },

  async getOrdersAnalytics(): Promise<OrdersAnalytics> {
    const response = await sellerApiInstance.get<{ data: OrdersAnalytics }>('/sellers/orders/analytics');
    return response.data.data;
  },

  async quotePickup(location: { address: string; latitude: number; longitude: number }): Promise<{
    feeAmount: number;
    distanceKm: number;
    chargeableDistanceKm: number;
    rateKesPerKm: number;
    currency: string;
    pricingModel?: string;
    cbdPickupFeeKes?: number;
    cbdRadiusKm?: number;
  }> {
    const response = await sellerApiInstance.post<{ data: unknown }>('/payments/logistics-quote', {
      legType: 'pickup',
      location
    });

    // Previously cast response.data.data straight to this shape with no
    // runtime check. The one current caller (usePickupRequestFlow.ts)
    // already defensively coerces feeAmount/distanceKm/chargeableDistanceKm/
    // rateKesPerKm/currency with Number(x || 0) before use, but
    // pricingModel/cbdPickupFeeKes/cbdRadiusKm were trusted as-is with no
    // check anywhere -- a partial/malformed response would silently carry a
    // wrong type into anything reading those fields directly. Doing the
    // same coercion here, once, at the boundary, means every caller (not
    // just the one that happens to defend itself today) gets a genuinely
    // safe value instead of an unchecked assertion.
    const raw = (response.data.data && typeof response.data.data === 'object' ? response.data.data : {}) as Record<string, unknown>;
    return {
      feeAmount: Number(raw.feeAmount) || 0,
      distanceKm: Number(raw.distanceKm) || 0,
      chargeableDistanceKm: Number(raw.chargeableDistanceKm) || 0,
      rateKesPerKm: Number(raw.rateKesPerKm) || 40,
      currency: typeof raw.currency === 'string' ? raw.currency : 'KES',
      pricingModel: typeof raw.pricingModel === 'string' ? raw.pricingModel : undefined,
      cbdPickupFeeKes: typeof raw.cbdPickupFeeKes === 'number' ? raw.cbdPickupFeeKes : undefined,
      cbdRadiusKm: typeof raw.cbdRadiusKm === 'number' ? raw.cbdRadiusKm : undefined,
    };
  },

  async requestPickup(orderId: string, payload: {
    mobilePayment: string;
    pickupLocation: { address: string; latitude: number; longitude: number };
    idempotencyKey?: string;
  }): Promise<unknown> {
    const response = await sellerApiInstance.post<{ data: unknown }>(
      `/sellers/orders/${orderId}/request-pickup`,
      payload,
      {
        headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : undefined
      }
    );
    return response.data.data;
  },

  async selectHubDropoff(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.post<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}/select-hub-dropoff`
    );
    return response.data.data;
  },

  async markDroppedAtHub(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.post<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}/mark-dropped-at-hub`
    );
    return response.data.data;
  },

  async confirmBooking(orderId: string): Promise<ApiOrder> {
    const response = await sellerApiInstance.post<{ data: ApiOrder }>(
      `/sellers/orders/${orderId}/confirm-booking`
    );
    return response.data.data;
  }
};


