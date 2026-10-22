import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Loader2, Search } from '@/shared/ui/icons';
import { cn } from '@/shared/utils/cn';
import type { LocationSearchResult } from '@/infrastructure/location/locationApi';

interface LocationSearchComboboxProps {
  label: string;
  placeholder: string;
  searchQuery: string;
  isSearching: boolean;
  showResults: boolean;
  searchResults: LocationSearchResult[];
  activeIndex: number;
  searchError: string;
  hasSearched: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectResult: (result: LocationSearchResult) => void;
  onSetActiveIndex: (index: number) => void;
}

const LISTBOX_ID = 'location-search-results';
const optionId = (index: number) => `location-search-option-${index}`;

export function LocationSearchCombobox({
  label,
  placeholder,
  searchQuery,
  isSearching,
  showResults,
  searchResults,
  activeIndex,
  searchError,
  hasSearched,
  onSearchChange,
  onSearchKeyDown,
  onSelectResult,
  onSetActiveIndex,
}: LocationSearchComboboxProps) {
  return (
    <div>
      <Label htmlFor="location-search" className="text-sm font-semibold text-slate-700 dark:text-label block mb-2">
        {label}
      </Label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 md:pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 md:h-5 md:w-5 text-slate-400" />
        </div>
        <Input
          id="location-search"
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          className="pl-12 md:pl-12 h-11 bg-white border-slate-200 text-slate-950 placeholder:text-slate-400"
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          </div>
        )}

        {showResults && (
          <div
            id={LISTBOX_ID}
            role="listbox"
            aria-label={label}
            className="absolute left-0 right-0 top-full z-[5000] mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#141414] text-slate-900 dark:text-white shadow-2xl"
          >
            {searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <button
                  key={`${result.provider || 'location'}-${result.id || index}`}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    'w-full border-b border-slate-100 dark:border-white/10 px-3 py-2.5 text-left text-xs leading-snug text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 focus:bg-slate-100 dark:focus:bg-white/10 focus:outline-none sm:text-sm last:border-0',
                    index === activeIndex && 'bg-slate-100 dark:bg-white/10'
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => onSetActiveIndex(index)}
                  onClick={() => onSelectResult(result)}
                >
                  {result.displayName}
                </button>
              ))
            ) : (
              <div role="status" aria-live="polite" className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-white/60 sm:text-sm">
                {isSearching
                  ? 'Searching locations...'
                  : searchError || (hasSearched ? 'No locations found. Try adding Nairobi, Kenya, or a nearby landmark.' : 'Keep typing to search locations.')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
