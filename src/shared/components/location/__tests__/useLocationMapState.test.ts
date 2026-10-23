import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocationMapState } from '../useLocationMapState';

describe('useLocationMapState', () => {
  it('allows clearing pin via handleClearPin', () => {
    const onLocationChange = vi.fn();
    const { result } = renderHook(() =>
      useLocationMapState({
        initialAddress: 'Biashara Street, Nairobi',
        initialCoordinates: { lat: -1.28, lng: 36.82 },
        onLocationChange,
      })
    );

    expect(result.current.markerPosition).toEqual([-1.28, 36.82]);

    act(() => {
      result.current.handleClearPin();
    });

    expect(result.current.markerPosition).toBeNull();
    expect(onLocationChange).toHaveBeenCalledWith('Biashara Street, Nairobi', null);
  });

  it('updates marker position when initialCoordinates prop changes', () => {
    const onLocationChange = vi.fn();
    const { result, rerender } = renderHook(
      (props) => useLocationMapState(props),
      {
        initialProps: {
          initialAddress: 'Kenyatta Ave',
          initialCoordinates: { lat: -1.28, lng: 36.82 },
          onLocationChange,
        },
      }
    );

    expect(result.current.markerPosition).toEqual([-1.28, 36.82]);

    rerender({
      initialAddress: 'Moi Avenue',
      initialCoordinates: { lat: -1.29, lng: 36.83 },
      onLocationChange,
    });

    expect(result.current.markerPosition).toEqual([-1.29, 36.83]);
    expect(result.current.address).toBe('Moi Avenue');
  });

  it('updates marker on handleMapClick', () => {
    const onLocationChange = vi.fn();
    const { result } = renderHook(() =>
      useLocationMapState({
        initialAddress: 'Tom Mboya St',
        initialCoordinates: null,
        onLocationChange,
      })
    );

    expect(result.current.markerPosition).toBeNull();

    act(() => {
      result.current.handleMapClick(-1.285, 36.825);
    });

    expect(result.current.markerPosition).toEqual([-1.285, 36.825]);
    expect(onLocationChange).toHaveBeenCalledWith('Tom Mboya St', { lat: -1.285, lng: 36.825 });
  });
});
