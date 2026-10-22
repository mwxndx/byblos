import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/http/apiClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

import apiClient from '@/infrastructure/http/apiClient';
import { cancelOrder, confirmOrderReceipt } from '../orders';

const mockedPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>;

describe('buyer orders API', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  describe('cancelOrder', () => {
    it('returns success true when PATCH /orders/:id/cancel succeeds', async () => {
      mockedPatch.mockResolvedValueOnce({ data: { success: true } });

      const result = await cancelOrder('order-123');
      expect(mockedPatch).toHaveBeenCalledWith('/orders/order-123/cancel');
      expect(result).toEqual({ success: true });
    });

    it('throws an error when cancellation fails so React Query catches it', async () => {
      const errorResponse = {
        response: {
          data: { message: 'Order cannot be cancelled in current state' },
          status: 400,
        },
      };
      mockedPatch.mockRejectedValueOnce(errorResponse);

      await expect(cancelOrder('order-123')).rejects.toThrow(
        'Order cannot be cancelled in current state'
      );
    });
  });

  describe('confirmOrderReceipt', () => {
    it('sends idempotency key and succeeds', async () => {
      mockedPatch.mockResolvedValueOnce({ data: { success: true } });

      const result = await confirmOrderReceipt('order-456');
      expect(mockedPatch).toHaveBeenCalledWith(
        '/orders/order-456/confirm-receipt',
        {},
        expect.objectContaining({
          headers: { 'Idempotency-Key': 'confirm-receipt-order-456' },
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('throws with appropriate message when confirm receipt fails', async () => {
      const errorResponse = {
        response: {
          data: { message: 'Order is not ready for confirmation' },
          status: 400,
        },
      };
      mockedPatch.mockRejectedValueOnce(errorResponse);

      await expect(confirmOrderReceipt('order-456')).rejects.toThrow(
        'Order is not ready for confirmation'
      );
    });
  });
});
