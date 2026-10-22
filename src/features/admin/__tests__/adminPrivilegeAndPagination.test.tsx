import { describe, it, expect } from 'vitest';
import { getDashboardPath } from '@/features/auth/utils/authRouting';
import type { UserRole } from '@/features/auth/contexts';

describe('Admin Role Privilege Enforcement & Dashboard Routing', () => {
  const evaluateIsAdmin = (auth: {
    isAuthenticated: boolean;
    role?: UserRole | null;
    user?: { role?: UserRole | null } | null;
  }) => {
    return Boolean(
      auth.isAuthenticated && (auth.role === 'admin' || auth.user?.role === 'admin')
    );
  };

  it('correctly grants admin privilege only when authenticated as admin', () => {
    expect(evaluateIsAdmin({ isAuthenticated: true, role: 'admin' })).toBe(true);
    expect(evaluateIsAdmin({ isAuthenticated: true, user: { role: 'admin' } })).toBe(true);
    expect(evaluateIsAdmin({ isAuthenticated: false, role: 'admin' })).toBe(false);
  });

  it('correctly denies admin privilege to non-admin roles', () => {
    const nonAdminRoles: UserRole[] = ['buyer', 'seller', 'creator', 'logistics'];
    for (const role of nonAdminRoles) {
      expect(evaluateIsAdmin({ isAuthenticated: true, role })).toBe(false);
      expect(evaluateIsAdmin({ isAuthenticated: true, user: { role } })).toBe(false);
    }
  });

  it('routes non-admin roles to their appropriate dashboard path', () => {
    expect(getDashboardPath('buyer')).toBe('/buyer/dashboard');
    expect(getDashboardPath('seller')).toBe('/seller/dashboard');
    expect(getDashboardPath('creator')).toBe('/creator/dashboard');
    expect(getDashboardPath('marketing')).toBe('/admin/marketing');
    expect(getDashboardPath('logistics')).toBe('/logistics/dashboard');
  });
});

describe('Admin Table & Queue Pagination Logic', () => {
  const paginateList = <T,>(items: T[], page: number, pageSize: number) => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const paginatedItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
    const pagination = {
      page: safePage,
      pageSize,
      total,
      hasMore: safePage * pageSize < total,
    };
    return { paginatedItems, pagination, totalPages };
  };

  it('slices logistics requests into 15 items per page', () => {
    const mockRequests = Array.from({ length: 35 }, (_, i) => ({ id: i + 1 }));
    const PAGE_SIZE = 15;

    // Page 1
    const p1 = paginateList(mockRequests, 1, PAGE_SIZE);
    expect(p1.paginatedItems.length).toBe(15);
    expect(p1.paginatedItems[0].id).toBe(1);
    expect(p1.paginatedItems[14].id).toBe(15);
    expect(p1.pagination.hasMore).toBe(true);
    expect(p1.pagination.total).toBe(35);

    // Page 2
    const p2 = paginateList(mockRequests, 2, PAGE_SIZE);
    expect(p2.paginatedItems.length).toBe(15);
    expect(p2.paginatedItems[0].id).toBe(16);
    expect(p2.paginatedItems[14].id).toBe(30);
    expect(p2.pagination.hasMore).toBe(true);

    // Page 3 (remainder)
    const p3 = paginateList(mockRequests, 3, PAGE_SIZE);
    expect(p3.paginatedItems.length).toBe(5);
    expect(p3.paginatedItems[0].id).toBe(31);
    expect(p3.paginatedItems[4].id).toBe(35);
    expect(p3.pagination.hasMore).toBe(false);
  });

  it('slices refund requests into 12 items per page', () => {
    const mockRefunds = Array.from({ length: 25 }, (_, i) => ({ id: `ref-${i + 1}` }));
    const PAGE_SIZE = 12;

    const p1 = paginateList(mockRefunds, 1, PAGE_SIZE);
    expect(p1.paginatedItems.length).toBe(12);
    expect(p1.pagination.hasMore).toBe(true);

    const p2 = paginateList(mockRefunds, 2, PAGE_SIZE);
    expect(p2.paginatedItems.length).toBe(12);
    expect(p2.pagination.hasMore).toBe(true);

    const p3 = paginateList(mockRefunds, 3, PAGE_SIZE);
    expect(p3.paginatedItems.length).toBe(1);
    expect(p3.pagination.hasMore).toBe(false);
  });

  it('clamps out-of-range page numbers gracefully', () => {
    const mockItems = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = paginateList(mockItems, 999, 10);
    expect(result.pagination.page).toBe(1);
    expect(result.paginatedItems.length).toBe(10);
  });
});
