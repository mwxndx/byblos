import SellerOrdersSection from '../../SellerOrdersSection';

export function OrdersTab() {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Orders</h2>
          <p className="text-xs sm:text-sm text-[#a1a1a6] mt-0.5">View and manage customer orders</p>
        </div>
      </div>
      <SellerOrdersSection />
    </div>
  );
}
