import { Plus } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { AddProductForm } from '../../AddProductForm';
import { ProductsList } from '../../ProductsList';
import type { ProductSummary } from '@/shared/types/view/productSummary';

interface ProductsTabProps {
  fetchProducts: () => Promise<void>;
  isAddProductModalOpen: boolean;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct?: (id: string) => void;
  onStatusUpdate: (productId: string, newStatus: 'available' | 'sold') => Promise<void>;
  products: ProductSummary[];
  setIsAddProductModalOpen: (open: boolean) => void;
}

export function ProductsTab({
  fetchProducts,
  isAddProductModalOpen,
  onDeleteProduct,
  onEditProduct,
  onStatusUpdate,
  products,
  setIsAddProductModalOpen
}: Readonly<ProductsTabProps>) {
  const hasProducts = products.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-6">
      {/* Header matching Penpot Seller - Products */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Products</h2>
          <p className="text-xs sm:text-sm text-[#a1a1a6] mt-0.5">Manage inventory and track stock levels</p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAddProductModalOpen(true)}
          className="gap-2 bg-[#f5c518] hover:bg-[#e5b510] text-black shadow-md px-4 py-2 rounded-[12px] font-semibold text-xs sm:text-sm h-10 w-full sm:w-auto shrink-0 transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      </div>

      {/* Service-charge notice */}
      <div className="rounded-[14px] border border-yellow-500/20 bg-yellow-500/10 text-yellow-200 px-4 py-3 text-xs leading-relaxed">
        Byblos adds a 2% service charge to each product price to keep products safe in transit, secure the transaction, and support operations.
      </div>

      {/* Single controlled add-product dialog */}
      <Dialog open={isAddProductModalOpen} onOpenChange={setIsAddProductModalOpen}>
        <DialogContent className="flex flex-col w-[92vw] max-w-lg sm:max-w-[540px] h-[85dvh] max-h-[85dvh] sm:h-[min(84dvh,640px)] p-0 overflow-hidden border border-[#34343a] bg-[#27272c] text-white rounded-[20px] shadow-2xl [&>button]:z-30">
          <DialogHeader className="sr-only">
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Create and publish a new product to your Byblos shop</DialogDescription>
          </DialogHeader>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#27272c] text-white">
            <AddProductForm
              onSuccess={() => {
                void fetchProducts().catch(() => {});
                setIsAddProductModalOpen(false);
              }}
              onClose={() => setIsAddProductModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {hasProducts ? (
        <ProductsList
          products={products as import('@/shared/types').Product[]}
          onDelete={onDeleteProduct}
          onEdit={onEditProduct}
          onStatusUpdate={onStatusUpdate}
          onRefresh={fetchProducts}
        />
      ) : (
        /* Empty state matching Penpot: package icon frame, title, description, and prominent CTA */
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center rounded-[16px] border border-[#34343a] bg-[#27272c] p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#121214] border border-[#34343a] text-[#a1a1a6]">
            <Plus className="h-8 w-8 text-[#f5c518]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-white">No products yet</h3>
            <p className="text-xs sm:text-sm text-[#a1a1a6] max-w-xs">
              Get started by adding your first product from the button above
            </p>
          </div>
          <Button
            onClick={() => setIsAddProductModalOpen(true)}
            className="mt-2 bg-[#f5c518] hover:bg-[#e5b510] text-black font-semibold rounded-[12px] px-5 py-2 text-sm shadow-md transition-transform active:scale-95"
          >
            Add product
          </Button>
        </div>
      )}
    </div>
  );
}
