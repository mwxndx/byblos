import { useEffect } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import L from 'leaflet';

// Fix Leaflet marker icon issue
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
    });
}

// Component to handle map clicks
export function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position ? <Marker position={position} /> : null;
}

export function MapSizeInvalidator({ watchKey }: { watchKey: string }) {
    const map = useMap();

    useEffect(() => {
        const invalidate = () => map.invalidateSize({ animate: false });
        const first = window.setTimeout(invalidate, 80);
        const second = window.setTimeout(invalidate, 300);

        return () => {
            window.clearTimeout(first);
            window.clearTimeout(second);
        };
    }, [map, watchKey]);

    return null;
}

// Component to fly to location
export function MapFlyTo({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            try {
                map.invalidateSize({ animate: false });
                map.flyTo(position, Math.max(map.getZoom(), 15), {
                    animate: true,
                    duration: 0.6
                });
            } catch {
                // Ignore if map is in an unready state
            }
        }
        return () => {
            try {
                // Leaflet's map.stop() can throw a TypeError (reading '_leaflet_pos') if the map container
                // or panes have already started unmounting. Catching it prevents route crash into RootErrorElement ("Page Error").
                map.stop();
            } catch {
                // Suppress unmount teardown exceptions
            }
        };
    }, [position, map]);
    return null;
}
