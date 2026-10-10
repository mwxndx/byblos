import { Suspense } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import { SellerProtectedRoute } from '@/app/router/AppProtectedRoute';
import { SellerLayout } from '@/app/layouts/SellerLayout';
import { safeLazy } from '@/shared/utils/safeLazy';
import { RouteFallback } from '@/app/router/RouteFallback';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

const SellerDashboard = safeLazy(() => import('@/features/seller/pages/SellerDashboard'));
const SellerRegistration = safeLazy(() => import('@/features/seller/pages/SellerRegistration'));
const SellerLogin = safeLazy(() => import('@/features/seller/pages/SellerLogin').then(m => m.SellerLogin));

// Create the seller routes
export const sellerRoutes: RouteObject[] = [
  // Public auth routes (completely independent of dashboard layout)
  {
    path: '/seller/login',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <SellerLogin />
      </Suspense>
    ),
  },
  {
    path: '/seller/register',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <SellerRegistration />
      </Suspense>
    ),
  },
  {
    path: '/join',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <SellerRegistration />
      </Suspense>
    ),
  },
  {
    path: '/seller/reset-password',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },

  // Protected seller routes with dashboard layout
  {
    path: '/seller',
    element: (
      <SellerProtectedRoute>
        <SellerLayout />
      </SellerProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <SellerDashboard />
          </Suspense>
        ),
      },
      // Redirects for protected routes
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: '*',
        element: <Navigate to="dashboard" replace />,
      },
    ],
  },
];
