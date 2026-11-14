import type { LucideIcon } from '@/shared/ui/icons';

export type BuyerSection = 'shop' | 'notifications' | 'wishlist' | 'orders' | 'profile' | 'refunds';

export interface BuyerNavItem {
  key: BuyerSection;
  label: string;
  Icon: LucideIcon;
  path: string;
  badge?: boolean;
  count?: number;
}

interface BuyerBottomNavProps {
  activeNav: BuyerSection;
  navItems: readonly BuyerNavItem[];
  onSelect: (key: BuyerSection) => void;
  hidden?: boolean;
}

/**
 * Floating bottom navigation bar with rounded corners and identical fixed width
 * matching the seller dashboard floating navigation bar style.
 */
export function BuyerBottomNav({
  activeNav,
  navItems,
  onSelect,
  hidden = false,
}: Readonly<BuyerBottomNavProps>) {
  if (hidden) return null;

  return (
    <nav
      className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl sm:rounded-full border border-slate-300 dark:border-white/20 dashboard-floating-nav bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md px-2 py-1.5 transition-colors duration-200"
      aria-label="Buyer navigation"
    >
      <div className="flex h-12 sm:h-13 items-center justify-between w-full">
        {navItems.map((item) => {
          const isActive = activeNav === item.key;
          const showDot = Boolean(item.badge && (!item.count || item.count <= 0));
          const count = item.badge && item.count ? item.count : 0;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 cursor-pointer items-center justify-center rounded-xl py-2 transition-all duration-150 active:scale-95 ${isActive
                  ? 'text-black dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white'
                }`}
            >
              <item.Icon
                size={22}
                className={isActive ? 'text-black dark:text-white' : 'text-current transition-colors'}
              />
              <span className="sr-only">
                {item.label}
              </span>

              {count > 0 ? (
                <span className={`absolute top-0 right-[50%] translate-x-[14px] text-[10px] font-bold leading-none ${item.key === 'notifications' ? 'text-red-600 dark:text-red-500 [data-theme=light]_&:text-red-600 [data-theme=dark]_&:text-red-500' : 'text-black dark:text-white [data-theme=light]_&:text-black [data-theme=dark]_&:text-white'}`}>
                  {count > 99 ? '99+' : count}
                </span>
              ) : showDot ? (
                <div className="absolute top-1.5 right-[50%] h-1.5 w-1.5 translate-x-[10px] rounded-full bg-black dark:bg-white [data-theme=light]_&:bg-black [data-theme=dark]_&:bg-white" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
