import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationMarker, MapSizeInvalidator, MapFlyTo } from './locationPickerParts';

const MAP_TILE_URLS = [
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
];

interface LocationMapViewProps {
    center: [number, number];
    markerPosition: [number, number] | null;
    watchKey: string;
    onMapClick: (lat: number, lng: number) => void;
}

// Split out of LocationPicker.tsx so react-leaflet/leaflet (569 KB raw /
// 169 KB gzip -- the single largest chunk in the whole app) only loads once
// this map is actually rendered, instead of being compiled into the eager
// entry chunk that ships on every page view. LocationPicker.tsx lazy-loads
// this via React.lazy + Suspense; its own search UI stays immediately
// available while the map loads in behind it.
export default function LocationMapView({ center, markerPosition, watchKey, onMapClick }: LocationMapViewProps) {
    const [tileUrlIndex, setTileUrlIndex] = useState(0);
    const tileUrl = MAP_TILE_URLS[tileUrlIndex] || MAP_TILE_URLS[0];

    return (
        <MapContainer
            center={center}
            zoom={13}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                key={tileUrl}
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url={tileUrl}
                eventHandlers={{
                    tileerror: () => {
                        setTileUrlIndex((currentIndex) => Math.min(currentIndex + 1, MAP_TILE_URLS.length - 1));
                    },
                }}
            />
            <LocationMarker position={markerPosition} setPosition={(pos) => onMapClick(pos[0], pos[1])} />
            <MapSizeInvalidator watchKey={watchKey} />
            <MapFlyTo position={center} />
        </MapContainer>
    );
}
