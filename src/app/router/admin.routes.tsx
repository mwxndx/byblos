import { Suspense } from 'react';
import { RouteObject, Outlet, Navigate } from 'react-router-dom';
import { AdminProtectedRoute } from '@/app/router/AppProtectedRoute';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';

const AdminDashboard = safeLazy(() => import('@/features/admin/pages/NewDashboardPage'));
const AdminLoginPage = safeLazy(() => import('@/features/admin/pages/AdminLoginPage').then(m => m.AdminLoginPage));

// Admin routes configuration
export const adminRoutes: RouteObject[] = [
  // Public admin auth
  {
    path: '/admin/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <AdminLoginPage />
      </Suspense>
    ),
  },

  // Protected admin routes
  {
    path: '/admin',
    element: (
      <AdminProtectedRoute>
        <Outlet />
      </AdminProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AdminDashboard />
          </Suspense>
        ),
      },
    ],
  },
];

// Deprecated router alias for backwards compatibility
export const adminRouter = {
  routes: adminRoutes,
};
