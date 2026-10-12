import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractDeepLinkPath, isAllowedDeepLinkPath } from '../deepLinkHandler';

describe('extractDeepLinkPath', () => {
  it('extracts path from https verification link with query parameters', () => {
    const url = 'https://www.byblosafrica.site/verify-email?token=abcdef123456&email=user%40example.com&type=seller';
    const path = extractDeepLinkPath(url);
    expect(path).toBe('/verify-email?token=abcdef123456&email=user%40example.com&type=seller');
  });

  it('extracts path from base domain verification link', () => {
    const url = 'https://byblosafrica.site/verify-email?token=xyz789&email=buyer%40example.com&type=buyer';
    const path = extractDeepLinkPath(url);
    expect(path).toBe('/verify-email?token=xyz789&email=buyer%40example.com&type=buyer');
  });

  it('extracts path from custom app scheme', () => {
    const url = 'byblos://verify-email?token=xyz789&email=creator%40example.com&type=creator';
    const path = extractDeepLinkPath(url);
    expect(path).toBe('/verify-email?token=xyz789&email=creator%40example.com&type=creator');
  });

  it('extracts path for password reset links', () => {
    const url = 'https://www.byblosafrica.site/seller/reset-password?token=resettok&email=seller%40shop.com';
    const path = extractDeepLinkPath(url);
    expect(path).toBe('/seller/reset-password?token=resettok&email=seller%40shop.com');
  });

  it('extracts path for order tracking links', () => {
    const url = 'https://www.byblosafrica.site/track/ORD-98765';
    const path = extractDeepLinkPath(url);
    expect(path).toBe('/track/ORD-98765');
  });

  it('rejects javascript: and pseudo protocols', () => {
    expect(extractDeepLinkPath('javascript:alert(1)')).toBeNull();
    expect(extractDeepLinkPath('data:text/html,<html></html>')).toBeNull();
  });

  it('rejects protocol-relative open redirect URLs', () => {
    expect(extractDeepLinkPath('//evil.com/hack')).toBeNull();
  });

  it('returns null for empty or invalid input', () => {
    expect(extractDeepLinkPath('')).toBeNull();
    expect(extractDeepLinkPath('   ')).toBeNull();
    expect(extractDeepLinkPath(null as unknown as string)).toBeNull();
    expect(extractDeepLinkPath(undefined as unknown as string)).toBeNull();
  });
});

describe('isAllowedDeepLinkPath', () => {
  it('allows verification routes', () => {
    expect(isAllowedDeepLinkPath('/verify-email?token=123')).toBe(true);
    expect(isAllowedDeepLinkPath('/verify-email')).toBe(true);
  });

  it('allows password reset routes for all roles', () => {
    expect(isAllowedDeepLinkPath('/seller/reset-password?token=123')).toBe(true);
    expect(isAllowedDeepLinkPath('/buyer/reset-password?token=123')).toBe(true);
    expect(isAllowedDeepLinkPath('/creator/reset-password?token=123')).toBe(true);
    expect(isAllowedDeepLinkPath('/reset-password?token=123')).toBe(true);
  });

  it('allows tracking routes', () => {
    expect(isAllowedDeepLinkPath('/track/token123')).toBe(true);
  });

  it('allows creator invite register links', () => {
    expect(isAllowedDeepLinkPath('/creator/register?token=invite123')).toBe(true);
  });

  it('allows storefront links', () => {
    expect(isAllowedDeepLinkPath('/shop/my-shop')).toBe(true);
  });

  it('rejects unrecognised or dangerous paths', () => {
    expect(isAllowedDeepLinkPath('//evil.com')).toBe(false);
    expect(isAllowedDeepLinkPath('/random-unauthorized-action')).toBe(false);
    expect(isAllowedDeepLinkPath('')).toBe(false);
  });
});
