import { sellerProfileApi } from './profileApi';
import { sellerProductsApi } from './productsApi';
import { sellerOrdersApi } from './ordersApi';
import { sellerWithdrawalsApi } from './withdrawalsApi';

export { checkShopNameAvailability, transformSeller } from './profileApi';
export { transformProduct } from './productsApi';
export { withdrawalService } from './withdrawalsApi';

export type {
  OrderQueryParams,
  OrdersAnalytics,
  RegisterSellerInput,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput
} from '../types';

export type { ApiSellerProduct as Product } from '@/shared/types/api/product';
export type { ApiSeller as Seller } from '@/shared/types/api/seller';
export type { ApiWithdrawalRequest as WithdrawalRequest } from '@/shared/types/api/withdrawal';

/**
 * Aggregated seller API surface. This barrel is the single source of truth for
 * the seller API layer; the individual modules under `./` own the actual calls.
 */
export const sellerApi = {
  ...sellerProfileApi,
  ...sellerProductsApi,
  ...sellerOrdersApi,
  ...sellerWithdrawalsApi
};

export default sellerApi;
