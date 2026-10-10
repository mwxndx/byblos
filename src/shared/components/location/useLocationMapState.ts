import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEFAULT_MAP_CENTER,
  createLocationSelection,
  normalizeCoordinates,
  type LocationCoordinates,
} from '@/infrastructure/location/location';
import type { LocationSearchResult } from '@/infrastructure/location/locationApi';

interface UseLocationMapStateProps {
  initialAddress?: string;
  initialCoordinates?: LocationCoordinates | null;
  autoPopulate?: boolean;
  onLocationChange: (address: string, coordinates: LocationCoordinates | null) => void;
}

export function useLocationMapState({
  initialAddress = '',
  initialCoordinates = null,
  autoPopulate = true,
  onLocationChange,
}: UseLocationMapStateProps) {
  const normalizedInitial = normalizeCoordinates(initialCoordinates);
  const [address, setAddress] = useState(initialAddress);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    normalizedInitial ? [normalizedInitial.lat, normalizedInitial.lng] : null
  );
  const [center, setCenter] = useState<[number, number]>(
    normalizedInitial ? [normalizedInitial.lat, normalizedInitial.lng] : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]
  );

  const addressRef = useRef(address);
  addressRef.current = address;
  const markerPosRef = useRef(markerPosition);
  markerPosRef.current = markerPosition;

  useEffect(() => {
    if (initialAddress && initialAddress !== addressRef.current) {
      setAddress(initialAddress);
    }
    const nextCoords = normalizeCoordinates(initialCoordinates);
    if (nextCoords) {
      const curr = markerPosRef.current;
      if (!curr || nextCoords.lat !== curr[0] || nextCoords.lng !== curr[1]) {
        const pos: [number, number] = [nextCoords.lat, nextCoords.lng];
        setMarkerPosition(pos);
        setCenter(pos);
      }
    }
  }, [initialAddress, initialCoordinates]);

  const applyLocationResult = useCallback((result: LocationSearchResult, shouldCloseResults: boolean) => {
    const lat = Number(result.lat);
    const lng = Number(result.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const newPos: [number, number] = [lat, lng];
    setMarkerPosition(newPos);
    setCenter(newPos);

    const finalAddress = autoPopulate && addressRef.current.trim() === '' ? result.displayName : addressRef.current;
    if (autoPopulate && addressRef.current.trim() === '') {
      setAddress(result.displayName);
    }

    const selectionAddress = autoPopulate ? (finalAddress || result.displayName) : addressRef.current;
    const selection = createLocationSelection(selectionAddress, { lat, lng });
    onLocationChange(selection.address, selection.coordinates);
  }, [autoPopulate, onLocationChange]);

  const handleManualAddressChange = useCallback((newAddress: string) => {
    setAddress(newAddress);
    const coords = markerPosition ? { lat: markerPosition[0], lng: markerPosition[1] } : null;
    const selection = createLocationSelection(newAddress, coords);
    onLocationChange(selection.address, selection.coordinates);
  }, [markerPosition, onLocationChange]);

  const handleClearAddress = useCallback(() => {
    setAddress('');
    const coords = markerPosition ? { lat: markerPosition[0], lng: markerPosition[1] } : null;
    const selection = createLocationSelection('', coords);
    onLocationChange(selection.address, selection.coordinates);
  }, [markerPosition, onLocationChange]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    const newPos: [number, number] = [lat, lng];
    setMarkerPosition(newPos);
    const selection = createLocationSelection(addressRef.current, { lat, lng });
    onLocationChange(selection.address, selection.coordinates);
  }, [onLocationChange]);

  const mapWatchKey = `${center[0]}:${center[1]}:${markerPosition?.[0] || ''}:${markerPosition?.[1] || ''}`;

  return {
    address,
    center,
    markerPosition,
    mapWatchKey,
    applyLocationResult,
    handleManualAddressChange,
    handleClearAddress,
    handleMapClick,
  };
}
