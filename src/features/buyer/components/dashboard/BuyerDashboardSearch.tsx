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
}: Readonly<BuyerDashboardSearchProps>) {
  if (activeSection !== 'shop') return null;

  const cities = SUPPORTED_CITIES;
  const isSingleCity = cities.length <= 1;

  return (
    <div className="w-full px-4 sm:px-6 pb-3 pt-3 sm:pt-3.5 flex flex-col items-center shrink-0 gap-2.5">
      {/* City selector — centered in the middle above search products search bar */}
      <div className="relative inline-flex items-center rounded-full border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] text-slate-900 dark:text-white shadow-sm transition-colors">
        <MapPin className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-500 dark:text-[#a1a1a6]" aria-hidden="true" />
        <select
          aria-label="City"
          defaultValue={cities[0]}
          disabled={isSingleCity}
          className="cursor-pointer appearance-none rounded-full bg-transparent py-1.5 pl-8 pr-8 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50 disabled:cursor-default"
        >
          {cities.map((city) => (
            <option key={city} value={city} className="bg-white text-slate-900 dark:bg-[#27272c] dark:text-white">
              {city}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-slate-500 dark:text-[#a1a1a6]" aria-hidden="true" />
      </div>

      {/* Search products search bar */}
      <div className="flex items-center gap-3 rounded-[14px] border border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] px-4 h-12 w-full max-w-[760px] shadow-sm transition-colors duration-200">
        <Search className="h-[18px] w-[18px] text-slate-400 dark:text-[#8a8a91] shrink-0" />
        <input
          value={productSearchQuery}
          onChange={event => onProductSearchChange(event.target.value)}
          aria-label="Search products"
          placeholder="Search products"
          className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8a8a91] text-sm font-medium"
        />
      </div>
    </div>
  );
}
