/**
 * SEO & Structured Data Types
 */

export interface BaseSEOProps {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'profile' | 'product';
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  schema?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface ProductSchemaInput {
  name: string;
  description?: string;
  image?: string | string[];
  price: number;
  currency?: string;
  sku?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  sellerName?: string;
  url?: string;
}

export interface StoreSchemaInput {
  name: string;
  description?: string;
  image?: string;
  url?: string;
  telephone?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
  priceRange?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}
