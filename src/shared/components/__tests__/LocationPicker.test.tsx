import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocationPicker from '../LocationPicker';

vi.mock('../LocationMapView', () => ({
  default: () => <div data-testid="mock-location-map-view" />,
}));

describe('LocationPicker', () => {
  it('renders "Tap the map to pin exact location" when no pin is set', () => {
    render(
      <LocationPicker
        initialAddress=""
        initialCoordinates={null}
        onLocationChange={vi.fn()}
      />
    );

    expect(screen.getByText('Tap the map to pin exact location')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove pin \/ repin/i })).not.toBeInTheDocument();
  });

  it('renders "Location pinned" and "Remove Pin / Repin" button when pin is set', () => {
    const onLocationChange = vi.fn();
    render(
      <LocationPicker
        initialAddress="Kenyatta Avenue"
        initialCoordinates={{ lat: -1.283, lng: 36.823 }}
        onLocationChange={onLocationChange}
      />
    );

    expect(screen.getByText('Location pinned')).toBeInTheDocument();
    const removePinBtn = screen.getByRole('button', { name: /remove pin \/ repin/i });
    expect(removePinBtn).toBeInTheDocument();

    // Clicking "Remove Pin / Repin" clears the pin
    fireEvent.click(removePinBtn);
    expect(onLocationChange).toHaveBeenCalledWith('Kenyatta Avenue', null);
    expect(screen.getByText('Tap the map to pin exact location')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove pin \/ repin/i })).not.toBeInTheDocument();
  });
});
