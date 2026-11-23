import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import {
  SEOHead,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildStoreSchema,
  buildProductSchema,
  buildBreadcrumbSchema,
  SITE_URL,
  SITE_NAME,
} from '../index';

describe('SEO System & Structured Data Generator', () => {
  it('builds valid schema.org Organization definition', () => {
    const org = buildOrganizationSchema();
    expect(org['@context']).toBe('https://schema.org');
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe(SITE_NAME);
    expect(org.url).toBe(SITE_URL);
    expect(org.logo).toContain('android-chrome-512x512.png');
  });

  it('builds valid schema.org WebSite definition with SearchAction', () => {
    const website = buildWebSiteSchema();
    expect(website['@context']).toBe('https://schema.org');
    expect(website['@type']).toBe('WebSite');
    expect(website.name).toBe(SITE_NAME);
    expect(website.url).toBe(SITE_URL);
    expect(website.potentialAction).toBeDefined();
  });

  it('builds valid schema.org Store definition with local Nairobi defaults', () => {
    const store = buildStoreSchema({
      name: 'Nairobi Threads',
      description: 'Vintage boutique in CBD',
      url: `${SITE_URL}/nairobi-threads`,
      telephone: '+254712345678',
    });
    expect(store['@type']).toBe('Store');
    expect(store.name).toBe('Nairobi Threads');
    expect(store.url).toBe(`${SITE_URL}/nairobi-threads`);
    expect(store.currenciesAccepted).toBe('KES');
    expect((store.address as { addressCountry: string }).addressCountry).toBe('KE');
  });

  it('builds valid schema.org Product definition with Offer details', () => {
    const prod = buildProductSchema({
      name: 'Handcrafted Denim Jacket',
      description: 'Custom vintage upcycled jacket',
      price: 3500,
      currency: 'KES',
      sellerName: 'Denim Studio',
      url: `${SITE_URL}/shop/denim/item/1`,
      availability: 'InStock',
    });
    expect(prod['@type']).toBe('Product');
    expect(prod.name).toBe('Handcrafted Denim Jacket');
    expect((prod.offers as { price: number }).price).toBe(3500);
    expect((prod.offers as { priceCurrency: string }).priceCurrency).toBe('KES');
    expect((prod.offers as { availability: string }).availability).toBe('https://schema.org/InStock');
  });

  it('builds valid schema.org BreadcrumbList definition with proper positions', () => {
    const breadcrumbs = buildBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Fashion', url: '/shop/fashion' },
      { name: 'Sneakers', url: '/shop/fashion/sneakers' },
    ]);
    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    const items = breadcrumbs.itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${SITE_URL}/`,
    });
    expect(items[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'Sneakers',
      item: `${SITE_URL}/shop/fashion/sneakers`,
    });
  });

  it('renders SEOHead with title, description, canonical, and schemas into document head', async () => {
    render(
      <HelmetProvider>
        <SEOHead
          title="Streetwear Collective"
          description="Nairobi street fashion hub"
          canonical="https://www.byblosafrica.site/streetwear"
          schema={buildStoreSchema({ name: 'Streetwear Collective' })}
        />
      </HelmetProvider>
    );

    // Wait for Helmet to commit head updates in JSDOM
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.title).toContain('Streetwear Collective | Byblos');
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
    expect(metaDesc).toBe('Nairobi street fashion hub');

    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    expect(canonical).toBe('https://www.byblosafrica.site/streetwear');

    const ogSite = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
    expect(ogSite).toBe('Byblos');

    const twitterSite = document.querySelector('meta[name="twitter:site"]')?.getAttribute('content');
    expect(twitterSite).toBe('@byblosafrica');

    const jsonLd = document.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(jsonLd).toContain('Streetwear Collective');
  });
});
