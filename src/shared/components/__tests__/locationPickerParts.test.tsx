import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MapFlyTo } from '../locationPickerParts';

const mockStop = vi.fn();
const mockFlyTo = vi.fn();
const mockInvalidateSize = vi.fn();

vi.mock('react-leaflet', () => ({
    useMap: () => ({
        stop: mockStop,
        flyTo: mockFlyTo,
        invalidateSize: mockInvalidateSize,
        getZoom: () => 12,
    }),
    useMapEvents: vi.fn(),
    Marker: () => null,
}));

describe('MapFlyTo unmount teardown', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('triggers flyTo on mount and aborts active animation with map.stop() upon unmount', () => {
        const position: [number, number] = [-1.286389, 36.817223];
        const { unmount } = render(<MapFlyTo position={position} />);

        expect(mockInvalidateSize).toHaveBeenCalledWith({ animate: false });
        expect(mockFlyTo).toHaveBeenCalledWith(position, 15, {
            animate: true,
            duration: 0.6,
        });
        expect(mockStop).not.toHaveBeenCalled();

        unmount();
        expect(mockStop).toHaveBeenCalledTimes(1);
    });
});
