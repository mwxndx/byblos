import { describe, test, expect } from 'vitest';
import {
  getLoginPath,
  getDashboardPath,
  getRoleFromRoute,
  isPublicRoute,
  requiresEmailVerification,
} from './authRouting';

describe('authRouting utility unit tests', () => {
  describe('getRoleFromRoute', () => {
    test('resolves marketing for /admin/marketing without being shadowed by /admin', () => {
      expect(getRoleFromRoute('/admin/marketing')).toBe('marketing');
      expect(getRoleFromRoute('/admin/marketing/overview')).toBe('marketing');
      expect(getRoleFromRoute('/admin/marketing/login')).toBe('marketing');
      expect(getRoleFromRoute('/marketing')).toBe('marketing');
      expect(getRoleFromRoute('/marketing/login')).toBe('marketing');
    });

    test('resolves admin for pure /admin routes', () => {
      expect(getRoleFromRoute('/admin')).toBe('admin');
      expect(getRoleFromRoute('/admin/login')).toBe('admin');
      expect(getRoleFromRoute('/admin/dashboard')).toBe('admin');
    });

    test('resolves buyer routes', () => {
      expect(getRoleFromRoute('/buyer')).toBe('buyer');
      expect(getRoleFromRoute('/buyer/dashboard')).toBe('buyer');
      expect(getRoleFromRoute('/buyer/login')).toBe('buyer');
      expect(getRoleFromRoute('/buyer/orders')).toBe('buyer');
    });

    test('resolves seller routes', () => {
      expect(getRoleFromRoute('/seller')).toBe('seller');
      expect(getRoleFromRoute('/seller/dashboard')).toBe('seller');
      expect(getRoleFromRoute('/seller/login')).toBe('seller');
    });

    test('resolves creator routes', () => {
      expect(getRoleFromRoute('/creator')).toBe('creator');
      expect(getRoleFromRoute('/creator/dashboard')).toBe('creator');
      expect(getRoleFromRoute('/creator/login')).toBe('creator');
    });

    test('resolves logistics for /mzigo and /logistics routes', () => {
      expect(getRoleFromRoute('/mzigo')).toBe('logistics');
      expect(getRoleFromRoute('/mzigo/dashboard')).toBe('logistics');
      expect(getRoleFromRoute('/logistics')).toBe('logistics');
      expect(getRoleFromRoute('/logistics/dashboard')).toBe('logistics');
    });

    test('returns null for public/general routes', () => {
      expect(getRoleFromRoute('/')).toBe(null);
      expect(getRoleFromRoute('/legal')).toBe(null);
      expect(getRoleFromRoute('/shop/cool-shop')).toBe(null);
      expect(getRoleFromRoute('/cool-shop')).toBe(null);
    });
  });

  describe('getDashboardPath', () => {
    test('returns /admin/marketing for marketing role', () => {
      expect(getDashboardPath('marketing')).toBe('/admin/marketing');
    });

    test('returns standard dashboard paths for other roles', () => {
      expect(getDashboardPath('buyer')).toBe('/buyer/dashboard');
      expect(getDashboardPath('seller')).toBe('/seller/dashboard');
      expect(getDashboardPath('admin')).toBe('/admin/dashboard');
      expect(getDashboardPath('creator')).toBe('/creator/dashboard');
      expect(getDashboardPath('logistics')).toBe('/logistics/dashboard');
    });
  });

  describe('getLoginPath', () => {
    test('returns /admin/marketing/login for marketing role', () => {
      expect(getLoginPath('marketing')).toBe('/admin/marketing/login');
    });

    test('returns standard login paths for other roles', () => {
      expect(getLoginPath('buyer')).toBe('/buyer/login');
      expect(getLoginPath('seller')).toBe('/seller/login');
      expect(getLoginPath('admin')).toBe('/admin/login');
      expect(getLoginPath('creator')).toBe('/creator/login');
      expect(getLoginPath('logistics')).toBe('/logistics/login');
    });
  });

  describe('isPublicRoute', () => {
    test('identifies public auth routes', () => {
      expect(isPublicRoute('/')).toBe(true);
      expect(isPublicRoute('/buyer/login')).toBe(true);
      expect(isPublicRoute('/buyer/register')).toBe(true);
      expect(isPublicRoute('/seller/login')).toBe(true);
      expect(isPublicRoute('/seller/register')).toBe(true);
      expect(isPublicRoute('/creator/login')).toBe(true);
      expect(isPublicRoute('/admin/login')).toBe(true);
      expect(isPublicRoute('/admin/marketing/login')).toBe(true);
      expect(isPublicRoute('/marketing')).toBe(true);
    });

    test('identifies protected routes as non-public', () => {
      expect(isPublicRoute('/buyer/dashboard')).toBe(false);
      expect(isPublicRoute('/buyer/orders')).toBe(false);
      expect(isPublicRoute('/seller/dashboard')).toBe(false);
      expect(isPublicRoute('/admin/dashboard')).toBe(false);
      expect(isPublicRoute('/creator/dashboard')).toBe(false);
      expect(isPublicRoute('/mzigo/dashboard')).toBe(false);
    });
  });

  describe('requiresEmailVerification', () => {
    test('buyer and seller require verification', () => {
      expect(requiresEmailVerification('buyer')).toBe(true);
      expect(requiresEmailVerification('seller')).toBe(true);
    });

    test('admin, creator, logistics, marketing do not require buyer/seller verification flow', () => {
      expect(requiresEmailVerification('admin')).toBe(false);
      expect(requiresEmailVerification('creator')).toBe(false);
      expect(requiresEmailVerification('logistics')).toBe(false);
      expect(requiresEmailVerification('marketing')).toBe(false);
      expect(requiresEmailVerification(null)).toBe(false);
    });
  });
});
