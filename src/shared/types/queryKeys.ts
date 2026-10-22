export const commonQueryKeys = {
  public: {
    shop: (shopName: string) => ['seller-shop', shopName] as const,
    products: (sellerId: string | number) => ['seller-public-products', sellerId] as const,
    sellers: (params?: Record<string, unknown>) => ['public-sellers', params?.page || 1, params?.limit || 48] as const,
  }
};
