import { sellerQueryKeys } from '@/features/seller/api/queryKeys';

export const sellerDashboardQueryKeys = {
  analytics: sellerQueryKeys.analytics(),
  orders: sellerQueryKeys.orders(),
  products: sellerQueryKeys.products(),
  summary: sellerQueryKeys.summary(),
  withdrawals: sellerQueryKeys.withdrawals(),
};
