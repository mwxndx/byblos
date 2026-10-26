import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhoneCheck } from '../usePhoneCheck';
import * as buyerPaymentsApi from '@/features/buyer/api/payments';
import { createOptionalBuyerLocation } from '@/infrastructure/location/location';

vi.mock('@/features/buyer/api/payments', () => ({
  getLogisticsQuote: vi.fn(),
}));

describe('TDD Slice 2: usePhoneCheck Delivery Quote Optimization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(buyerPaymentsApi.getLogisticsQuote).mockResolvedValue({
      feeAmount: 200,
      distanceKm: 5,
      chargeableDistanceKm: 5,
      rateKesPerKm: 40,
    } as unknown as Record<string, unknown>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not re-fetch logistics quote when only address text changes with same coordinates', async () => {
    const { result } = renderHook(() =>
      usePhoneCheck({
        isOpen: true,
        onPhoneSubmit: vi.fn(),
        isPhysicalProduct: true,
      })
    );

    // 1. Enable door delivery
    act(() => {
      result.current.setDoorDeliveryEnabled(true);
    });

    // 2. Set initial location with coordinates
    act(() => {
      result.current.setDeliveryLocation(createOptionalBuyerLocation('Westlands', { lat: -1.26, lng: 36.80 }));
    });

    // Fast-forward debounce timer
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(buyerPaymentsApi.getLogisticsQuote).toHaveBeenCalledTimes(1);

    // 3. Update detailed address only (e.g. user typing apartment or floor number) with identical coordinates
    act(() => {
      result.current.setDeliveryLocation(createOptionalBuyerLocation('Westlands, Apt 4B', { lat: -1.26, lng: 36.80 }));
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current.setDeliveryLocation(createOptionalBuyerLocation('Westlands, Apt 4B, 2nd Floor', { lat: -1.26, lng: 36.80 }));
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Quote should still have only been called once because lat/lng never changed!
    expect(buyerPaymentsApi.getLogisticsQuote).toHaveBeenCalledTimes(1);

    // 4. Now change actual coordinates (user dragged pin or selected a different area)
    act(() => {
      result.current.setDeliveryLocation(createOptionalBuyerLocation('Kilimani', { lat: -1.29, lng: 36.78 }));
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Quote should now be called a second time
    expect(buyerPaymentsApi.getLogisticsQuote).toHaveBeenCalledTimes(2);
  });
});
