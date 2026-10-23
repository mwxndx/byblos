import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import LocationMapView from '../LocationMapView';

describe('Real Leaflet unmount test', () => {
  test('mounts LocationMapView and then unmounts without throwing', () => {
    const { unmount } = render(
      <LocationMapView
        center={[-1.22, 36.89]}
        markerPosition={[-1.22, 36.89]}
        watchKey="-1.22:36.89:-1.22:36.89"
        onMapClick={() => {}}
      />
    );

    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
