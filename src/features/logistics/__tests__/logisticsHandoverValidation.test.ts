import { describe, expect, it, vi, beforeEach } from 'vitest';
import { validateHandoverCode } from '../utils/mzigoDashboard.utils';
import { fetchOrderLiveEta } from '../api/eta';
import { updateLogisticsLegStatus } from '../api/requests';
import { logisticsQueryKeys } from '../api/queryKeys';
import apiClient from '@/infrastructure/http/apiClient';

vi.mock('@/infrastructure/http/apiClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../api/auth', () => ({
  logisticsHeaders: () => ({ Authorization: 'Bearer mock-token' }),
}));

describe('Logistics Handover Code Validation', () => {
  it('rejects empty or whitespace-only verification code', () => {
    const emptyResult = validateHandoverCode('');
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.error).toContain('cannot be empty');

    const whitespaceResult = validateHandoverCode('    ');
    expect(whitespaceResult.isValid).toBe(false);
    expect(whitespaceResult.error).toContain('cannot be empty');
  });

  it('rejects codes shorter than 4 characters', () => {
    const shortResult = validateHandoverCode('123');
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toContain('at least 4 characters');
  });

  it('rejects codes longer than 24 characters', () => {
    const longResult = validateHandoverCode('A'.repeat(25));
    expect(longResult.isValid).toBe(false);
    expect(longResult.error).toContain('cannot exceed 24 characters');
  });

  it('rejects codes with invalid special characters', () => {
    const specialResult = validateHandoverCode('123@#$');
    expect(specialResult.isValid).toBe(false);
    expect(specialResult.error).toContain('may only contain letters, numbers, and hyphens');
  });

  it('accepts valid 4-digit OTP numeric codes and preserves trimmed uppercase value', () => {
    const result = validateHandoverCode('  1042  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('1042');
    expect(result.error).toBeUndefined();
  });

  it('accepts valid full package codes with hyphens and letters', () => {
    const result = validateHandoverCode('byb-log-9872');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('BYB-LOG-9872');
    expect(result.error).toBeUndefined();
  });
});

describe('Live ETA API and Logistics Query Keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps response.data.data correctly from fetchOrderLiveEta', async () => {
    const mockEtaData = {
      orderId: '42',
      legId: 'leg-1',
      trackingStatus: 'in_transit',
      etaMinutes: 15,
      estimatedArrival: '2026-10-22T20:00:00Z',
      routeProgress: 0.65,
      lastUpdatedAt: '2026-10-22T19:45:00Z',
      isStale: false,
    };

    (apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: mockEtaData,
      },
    });

    const result = await fetchOrderLiveEta('42');
    expect(result).toEqual(mockEtaData);
    expect(result.routeProgress).toBe(0.65);
    expect(result.etaMinutes).toBe(15);
  });

  it('generates unified logistics query keys for live ETA queries', () => {
    const key = logisticsQueryKeys.liveEta('42');
    expect(key).toEqual(['logistics', 'liveEta', '42']);
  });

  it('passes sanitized verificationCode in updateLogisticsLegStatus payload', async () => {
    (apiClient.patch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        data: {
          updated: true,
          requestId: 10,
          legId: 2,
          legType: 'delivery',
          previousStatus: 'out_for_delivery',
          status: 'delivered',
          externalStatus: 'delivered',
          logisticsStatus: 'delivered',
        },
      },
    });

    const result = await updateLogisticsLegStatus({
      requestId: 10,
      legType: 'delivery',
      status: 'delivered',
      verificationCode: '  byb-log-1042  ',
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/logistics/requests/10/legs/delivery/status',
      { status: 'delivered', verificationCode: 'BYB-LOG-1042' },
      { headers: { Authorization: 'Bearer mock-token' } }
    );
    expect(result.updated).toBe(true);
  });
});
