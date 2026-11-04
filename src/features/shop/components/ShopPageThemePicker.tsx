import { useEffect, useRef, useState } from 'react';
import { ShopPageTheme, resolveShopTheme } from '@/features/shop/hooks/useShopPageTheme';
export type { ShopPageTheme };
import { ChevronDown, Moon, Sun } from '@/shared/ui/icons';
import { cn } from '@/shared/utils/formatting';




interface ShopPageThemePickerProps {
  theme: ShopPageTheme;
  onThemeChange: (t: ShopPageTheme) => void;
}

/**
 * Clean icon-only theme dropdown for the shop page: displays Sun/Moon icon with
 * a simple dropdown to switch between light and dark modes without 'D' and 'L' text.
 */
export function ShopPageThemePicker({ theme, onThemeChange }: Readonly<ShopPageThemePickerProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolved = resolveShopTheme(theme);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="fixed right-3 top-[calc(0.75rem+var(--sat,0px))] z-30 sm:right-6 sm:top-6"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Change theme"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-full border border-separator bg-white dark:bg-black px-2.5 py-1.5 text-label shadow-[var(--shadow-card)] transition-colors hover:bg-fill"
      >
        {resolved === 'dark' ? (
          <Moon className="h-4 w-4 text-yellow-400" />
        ) : (
          <Sun className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        )}
        <ChevronDown className={cn('h-3 w-3 text-label-2 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 flex flex-col gap-1 rounded-2xl border border-separator bg-white dark:bg-black p-1 shadow-[var(--shadow-pop)]">
          <button
            type="button"
            onClick={() => {
              onThemeChange('light');
              setIsOpen(false);
            }}
            aria-label="Light mode"
            title="Light mode"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
              resolved === 'light'
                ? 'bg-yellow-400/25 text-yellow-600 dark:text-yellow-400'
                : 'text-label-2 hover:bg-fill'
            )}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onThemeChange('dark');
              setIsOpen(false);
            }}
            aria-label="Dark mode"
            title="Dark mode"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
              resolved === 'dark'
                ? 'bg-yellow-400/25 text-yellow-400'
                : 'text-label-2 hover:bg-fill'
            )}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}


