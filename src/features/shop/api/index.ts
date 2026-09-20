import apiClient from '@/infrastructure/http/apiClient';
import { searchSellers, searchProducts } from './search';
import { getSellersPage, getSellers, knockSeller, getSellerInfo } from './sellers';
import { getProductsPage, getProducts, getProduct, getFeaturedProducts, getProductsByLocation } from './products';
import { pollPaymentStatus } from '@/features/payments/api/publicPayments';
import { fetchPublicTracking } from './tracking';

export * from './types';
export * from './search';
export * from './sellers';
export * from './products';
export * from '@/features/payments/api/publicPayments';
export * from './tracking';

export const publicApiService = {
  searchSellers,
  getSellersPage,
  getSellers,
  knockSeller,
  getProductsPage,
  getProducts,
  getProduct,
  getSellerInfo,
  getFeaturedProducts,
  searchProducts,
  getProductsByLocation,
  pollPaymentStatus
};

export const publicApi = apiClient;
export default publicApiService;



