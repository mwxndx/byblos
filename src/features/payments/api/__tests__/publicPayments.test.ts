import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/http/apiClient', () => ({
  default: { get: vi.fn() },
}));

import apiClient from '@/infrastructure/http/apiClient';
import { pollPaymentStatus } from '../publicPayments';

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

describe('pollPaymentStatus', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('continues polling when backend returns envelope success with nested status pending', async () => {
    // 1st call: backend returns HTTP envelope 'success', but nested payment data.status is 'pending'
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Payment status retrieved successfully',
        data: {
          status: 'pending',
          orderNumber: 'ORD-123',
          amount: 1500,
          currency: 'KES',
          reference: 'pay_ref_1'
        }
      }
    });

    // 2nd call: payment completed
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Payment status retrieved successfully',
        data: {
          status: 'completed',
          orderNumber: 'ORD-123',
          amount: 1500,
          currency: 'KES',
          reference: 'pay_ref_1'
        }
      }
    });

    const result = await pollPaymentStatus('pay_ref_1', 5, 10);
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'success',
      message: 'Payment status retrieved successfully',
      data: {
        status: 'completed',
        orderNumber: 'ORD-123',
        amount: 1500,
        currency: 'KES',
        reference: 'pay_ref_1'
      }
    });
  });

  it('resolves immediately when payment is already completed or successful', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          status: 'paid',
          orderNumber: 'ORD-456'
        }
      }
    });

    const result = await pollPaymentStatus('pay_ref_2', 5, 10);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect((result as Record<string, unknown>).data).toEqual({
      status: 'paid',
      orderNumber: 'ORD-456'
    });
  });

  it('resolves immediately on terminal failure states', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          status: 'failed',
          orderNumber: 'ORD-789'
        }
      }
    });

    const result = await pollPaymentStatus('pay_ref_3', 5, 10);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect((result as Record<string, unknown>).data).toEqual({
      status: 'failed',
      orderNumber: 'ORD-789'
    });
  });

  it('resolves with timeout when maxAttempts is reached without terminal status', async () => {
    mockedGet.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          status: 'pending'
        }
      }
    });

    const result = await pollPaymentStatus('pay_ref_timeout', 2, 10);
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'timeout',
      message: 'Polling timed out'
    });
  });
});
