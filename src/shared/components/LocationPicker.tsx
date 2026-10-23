import { lazy, Suspense } from 'react';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Loader2, X, MapPin } from '@/shared/ui/icons';
import { cn } from '@/shared/utils/cn';
import type { LocationCoordinates } from '@/infrastructure/location/location';
import { useLocationSearch } from './location/useLocationSearch';
import { useLocationMapState } from './location/useLocationMapState';
import { LocationSearchCombobox } from './location/LocationSearchCombobox';

const LocationMapView = lazy(() => import('./LocationMapView'));

export interface LocationPickerProps {
  initialAddress?: string;
  initialCoordinates?: LocationCoordinates | null;
  onLocationChange: (address: string, coordinates: LocationCoordinates | null) => void;
  placeholder?: string;
  label?: string;
  detailedLabel?: string;
  className?: string;
  mapClassName?: string;
  autoPopulate?: boolean;
  initialValue?: string;
}

export default function LocationPicker({
  initialAddress = '',
  initialCoordinates = null,
  onLocationChange,
  placeholder = 'Search for a location...',
  label = 'Search Location',
  detailedLabel = 'Detailed Address',
  className,
  mapClassName,
  autoPopulate = true,
  initialValue = '',
}: LocationPickerProps) {
  const mapState = useLocationMapState({
    initialAddress,
    initialCoordinates,
    autoPopulate,
    onLocationChange,
  });

  const search = useLocationSearch({
    initialValue,
    onApplyResult: mapState.applyLocationResult,
  });

  return (
    <div className={cn('space-y-4', className)}>
      <LocationSearchCombobox
        label={label}
        placeholder={placeholder}
        searchQuery={search.searchQuery}
        isSearching={search.isSearching}
        showResults={search.showResults}
        searchResults={search.searchResults}
        activeIndex={search.activeIndex}
        searchError={search.searchError}
        hasSearched={search.hasSearched}
        onSearchChange={search.handleSearchChange}
        onSearchKeyDown={search.handleSearchKeyDown}
        onSelectResult={search.selectLocation}
        onSetActiveIndex={search.setActiveIndex}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="address-detailed" className="text-sm font-semibold text-slate-700 dark:text-label block">
            {detailedLabel}
          </Label>
          {mapState.address && (
            <button
              type="button"
              onClick={mapState.handleClearAddress}
              className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <div className="relative">
          <Input
            id="address-detailed"
            type="text"
            value={mapState.address}
            onChange={(e) => mapState.handleManualAddressChange(e.target.value)}
            className="h-11 bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 pr-9"
            placeholder="e.g. Building Name, Floor, Office/House No"
          />
          {mapState.address && (
            <button
              type="button"
              onClick={mapState.handleClearAddress}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              aria-label="Clear address"
              title="Clear address text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className={cn('h-56 w-full rounded-xl overflow-hidden border border-white/10 shadow-inner z-0 relative sm:h-64', mapClassName)}>
        <Suspense fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-white/5">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        }>
          <LocationMapView
            center={mapState.center}
            markerPosition={mapState.markerPosition}
            watchKey={mapState.mapWatchKey}
            onMapClick={mapState.handleMapClick}
          />
        </Suspense>
      </div>
      <div className="flex items-center justify-between text-xs px-1">
        <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          {mapState.markerPosition ? 'Location pinned' : 'Tap the map to pin exact location'}
        </p>
        {mapState.markerPosition && (
          <button
            type="button"
            onClick={mapState.handleClearPin}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 py-1 px-2 rounded-md transition-colors"
          >
            <MapPin className="h-3.5 w-3.5" /> Remove Pin / Repin
          </button>
        )}
      </div>
    </div>
  );
}
