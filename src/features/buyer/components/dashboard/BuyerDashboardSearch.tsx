import { ChevronDown, MapPin, Search } from '@/shared/ui/icons';

const SUPPORTED_CITIES = ['Nairobi'] as const;

interface BuyerDashboardSearchProps {
  activeSection: 'shop' | 'notifications' | 'wishlist' | 'orders' | 'profile';
  productSearchQuery: string;
  onProductSearchChange: (value: string) => void;
}

export function BuyerDashboardSearch({
  activeSection,
  productSearchQuery,
  onProductSearchChange,
}: BuyerDashboardSearchProps) {
  if (activeSection !== 'shop') return null;

  const cities = SUPPORTED_CITIES;
  const isSingleCity = cities.length <= 1;

  return (
    <div className="w-full px-4 sm:px-6 pb-3 pt-3 sm:pt-3.5 flex flex-col items-center shrink-0 gap-2.5">
      {/* City selector — centered in the middle above search products search bar */}
      <div className="relative inline-flex items-center rounded-full border border-separator bg-white dark:bg-black text-label shadow-sm">
        <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-label-2" aria-hidden="true" />
        <select
          aria-label="City"
          defaultValue={cities[0]}
          disabled={isSingleCity}
          className="cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pl-7 pr-7 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]/50 disabled:cursor-default"
        >
          {cities.map((city) => (
            <option key={city} value={city} className="bg-white text-slate-900 dark:bg-black dark:text-white">
              {city}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-label-2" aria-hidden="true" />
      </div>

      {/* Search products search bar */}
      <div className="flex items-center gap-2.5 rounded-xl border border-separator bg-white dark:bg-black px-3.5 h-10 w-full max-w-[760px] shadow-[var(--shadow-card)] transition-colors duration-200">
        <Search className="h-4 w-4 text-label-2 shrink-0" />
        <input
          value={productSearchQuery}
          onChange={event => onProductSearchChange(event.target.value)}
          aria-label="Search products"
          placeholder="Search products..."
          className="flex-1 bg-transparent border-none outline-none text-label placeholder:text-label-3 text-xs sm:text-sm font-medium"
        />
      </div>
    </div>
  );
}
