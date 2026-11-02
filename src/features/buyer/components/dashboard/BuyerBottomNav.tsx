import type { LucideIcon } from '@/shared/ui/icons';

type BuyerSection = 'shop' | 'notifications' | 'wishlist' | 'orders' | 'profile' | 'refunds';

interface BuyerNavItem {
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
}

export function BuyerBottomNav({ activeNav, navItems, onSelect }: Readonly<BuyerBottomNavProps>) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 dark:border-[#34343a] bg-white dark:bg-[#27272c] pb-safe-bottom transition-colors duration-200"
      aria-label="Buyer navigation"
    >
      <div className="flex items-center justify-around h-[62px] px-1">
        {navItems.map(item => {
          const isActive = activeNav === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer relative py-1.5 transition-opacity duration-150 active:scale-95"
            >
              <item.Icon
                size={20}
                className={isActive ? 'text-[#f5c518]' : 'text-slate-500 dark:text-[#a1a1a6] transition-colors'}
              />
              <span className={`text-[10px] transition-colors ${isActive ? 'text-[#f5c518] font-bold' : 'text-slate-500 dark:text-[#a1a1a6] font-medium'}`}>
                {item.label}
              </span>
              {item.badge && (
                item.count && item.count > 0 ? (
                  <span className="absolute top-1 right-[50%] translate-x-[12px] min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-[#f5c518] text-black shadow-sm">
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                ) : (
                  <div className="absolute top-1.5 right-[50%] translate-x-[10px] w-2 h-2 rounded-full bg-[#f5c518] ring-1 ring-black/40" />
                )
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
