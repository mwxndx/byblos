import type {
  ProductSchemaInput,
  StoreSchemaInput,
  BreadcrumbItem,
} from './types';

export const SITE_URL = 'https://www.byblosafrica.site';
export const SITE_NAME = 'Byblos';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/android-chrome-512x512.png`;

/**
 * Builds schema.org Organization definition
 */
export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: 'ByblosHQ',
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
    description: 'Social commerce and shop infrastructure for sellers and creators in Nairobi, Kenya.',
    sameAs: [
      'https://twitter.com/byblosafrica',
      'https://instagram.com/byblosafrica',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      areaServed: 'KE',
      availableLanguage: ['en', 'sw'],
    },
  };
}

/**
 * Builds schema.org WebSite definition with SearchAction
 */
export function buildWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Builds schema.org Store / LocalBusiness definition for seller storefronts
 */
export function buildStoreSchema(input: StoreSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: input.name,
    description: input.description || `${input.name} on ${SITE_NAME}`,
    image: input.image || DEFAULT_OG_IMAGE,
    url: input.url || SITE_URL,
    telephone: input.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: input.addressLocality || 'Nairobi',
      addressRegion: input.addressRegion || 'Nairobi',
      addressCountry: input.addressCountry || 'KE',
    },
    priceRange: input.priceRange || 'KSh 100 - KSh 100,000',
    currenciesAccepted: 'KES',
    paymentAccepted: 'M-Pesa, Credit Card, Debit Card',
  };
}

/**
 * Builds schema.org Product definition with Offer details
 */
export function buildProductSchema(input: ProductSchemaInput): Record<string, unknown> {
  const images = Array.isArray(input.image)
    ? input.image
    : input.image
      ? [input.image]
      : [DEFAULT_OG_IMAGE];

  const availabilityMap = {
    InStock: 'https://schema.org/InStock',
    OutOfStock: 'https://schema.org/OutOfStock',
    PreOrder: 'https://schema.org/PreOrder',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description || input.name,
    image: images,
    sku: input.sku || undefined,
    offers: {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: input.currency || 'KES',
      availability: availabilityMap[input.availability || 'InStock'],
      url: input.url || SITE_URL,
      seller: input.sellerName
        ? {
            '@type': 'Organization',
            name: input.sellerName,
          }
        : undefined,
    },
  };
}

/**
 * Builds schema.org BreadcrumbList definition
 */
export function buildBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url.startsWith('/') ? '' : '/'}${item.url}`,
    })),
  };
}
