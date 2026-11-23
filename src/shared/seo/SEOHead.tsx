import React from 'react';
import { Helmet } from 'react-helmet-async';
import type { BaseSEOProps } from './types';
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from './schemaGenerator';

const DEFAULT_TITLE = `${SITE_NAME} | Start and Run Your Business in Nairobi`;
const DEFAULT_DESCRIPTION = 'Byblos gives Nairobi sellers a trusted shop link, secure checkout, order management, delivery support, receipts, refunds, and withdrawals.';

function formatTitle(title?: string): string {
  if (!title) return DEFAULT_TITLE;
  const trimmed = title.trim();
  if (trimmed.toLowerCase().includes(SITE_NAME.toLowerCase())) {
    return trimmed;
  }
  return `${trimmed} | ${SITE_NAME}`;
}

function normalizeUrl(url?: string): string {
  if (!url) return SITE_URL;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const SEOHead: React.FC<BaseSEOProps> = ({
  title,
  description,
  image,
  imageAlt,
  url,
  canonical,
  type = 'website',
  noindex = false,
  publishedTime,
  modifiedTime,
  schema,
}) => {
  const metaTitle = formatTitle(title);
  const metaDescription = (description || DEFAULT_DESCRIPTION).trim();
  const metaImage = normalizeUrl(image || DEFAULT_OG_IMAGE);
  const metaUrl = normalizeUrl(url || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const canonicalUrl = canonical ? normalizeUrl(canonical) : metaUrl;
  const imageAltText = imageAlt || metaTitle;

  const schemas = schema ? (Array.isArray(schema) ? schema : [schema]) : [];

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      {import.meta.env.VITE_GOOGLE_SITE_VERIFICATION && (
        <meta name="google-site-verification" content={import.meta.env.VITE_GOOGLE_SITE_VERIFICATION} />
      )}
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="en_KE" />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:image:alt" content={imageAltText} />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@byblosafrica" />
      <meta name="twitter:url" content={metaUrl} />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:image:alt" content={imageAltText} />

      {/* Article Timestamps if applicable */}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* Structured Data (JSON-LD) */}
      {schemas.map((s, idx) => (
        <script key={`schema-${idx}`} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOHead;
