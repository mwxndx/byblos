import { Heart, Search } from '@/shared/ui/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWishlist } from '@/features/shop/wishlist/useWishlist';
import { ShopProductCard } from '@/features/shop/components/ShopProductCard';
import { Input } from '@/shared/ui/input';
import { useState } from 'react';

export default function WishlistSection() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  if (wishlist.length === 0) {
    return (
      <div className="py-12 sm:py-16">
        <div className="max-w-md mx-auto rounded-[16px] p-8 bg-white dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] text-center space-y-4 shadow-sm transition-colors duration-200">
          <div className="w-[72px] h-[72px] mx-auto bg-[#f5c518]/15 border border-[#f5c518]/30 rounded-2xl flex items-center justify-center text-[#f5c518] shadow-sm">
            <Heart className="h-8 w-8 fill-current" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Your wishlist is empty
          </h3>
          <p className="text-slate-600 dark:text-[#a1a1a6] text-sm leading-relaxed max-w-sm mx-auto">
            Tap the heart on any product to save it here for later.
          </p>
          <button
            type="button"
            onClick={() => navigate('/buyer/dashboard')}
            className="inline-flex items-center justify-center h-12 px-6 rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Browse shops
          </button>
        </div>
      </div>
    );
  }

  const filteredWishlist = wishlist.filter(product => {
    const query = searchQuery.toLowerCase();
    const productName = product.name.toLowerCase();
    const shopName = (product.seller?.shopName || '').toLowerCase();
    return productName.includes(query) || shopName.includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-sm ml-auto mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#8a8a91] pointer-events-none z-10" />
        <Input
          type="text"
          aria-label="Search wishlist"
          placeholder="Search wishlist..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white dark:bg-[#27272c] border border-slate-200 dark:border-[#34343a] text-slate-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#8a8a91] rounded-[14px] pl-10 h-11 shadow-sm transition-colors"
        />
      </div>

      {filteredWishlist.length === 0 && searchQuery ? (
        <div className="text-center py-12 px-4 bg-slate-100 dark:bg-[#27272c] rounded-2xl border border-slate-200 dark:border-[#34343a]">
          <p className="text-slate-500 dark:text-[#a1a1a6] text-sm">No items found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
          {filteredWishlist.map((product) => {
            const shopSlug = product.seller?.shopName || (product as unknown as Record<string, unknown>).sellerName as string || (product as unknown as Record<string, unknown>).sellerSlug as string || '';
            const handleTap = () => {
              if (!shopSlug) {
                toast.error('This shop is unavailable right now.');
                return;
              }
              // Open the seller shop with this product already in the bag.
              navigate(`/buyer/shop/${encodeURIComponent(shopSlug)}`, { state: { bagAdd: product } });
            };
            return (
              <div key={product.id} className="max-w-[260px] w-full mx-auto sm:mx-0">
                <ShopProductCard
                  product={product}
                  onTap={handleTap}
                  isWishlisted
                  onToggleWishlist={() => removeFromWishlist(String(product.id))}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
