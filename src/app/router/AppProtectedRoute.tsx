import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useGlobalAuth, UserRole } from '@/features/auth/contexts';
import { RouteFallback } from '@/app/router/RouteFallback';
import { requiresEmailVerification, getDashboardPath } from '@/features/auth/utils/authRouting';
import { useMyAccounts } from '@/features/auth/hooks/useMyAccounts';
import { Button } from '@/shared/ui/button';
import { Loader2 } from '@/shared/ui/icons';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AppProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    redirectTo?: string;
    fallback?: React.ReactNode;
}

// ─── Protected Route ──────────────────────────────────────────────────────────
export function AppProtectedRoute({
    children,
    allowedRoles,
    redirectTo,
    fallback,
}: AppProtectedRouteProps) {
    const { user, isAuthenticated, isLoading, role, switchAccount } = useGlobalAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { data: myAccounts, isLoading: isAccountsLoading } = useMyAccounts(Boolean(isAuthenticated && user));
    const [isSwitching, setIsSwitching] = useState(false);

    // Show branded fallback while auth state is resolving only if user is not yet hydrated
    if (isLoading && !user) {
        return <>{fallback ?? <RouteFallback />}</>;
    }

    // Not authenticated → redirect to appropriate login page
    if (!isAuthenticated || !user) {
        const getLoginPath = (): string => {
            if (redirectTo) return redirectTo;
            const path = location.pathname;
            if (path.startsWith('/buyer')) return '/buyer/login';
            if (path.startsWith('/seller')) return '/seller/login';
            if (path.startsWith('/admin/marketing') || path.startsWith('/marketing')) return '/admin/marketing/login';
            if (path.startsWith('/admin')) return '/admin/login';
            if (path.startsWith('/creator')) return '/creator/login';
            if (path.startsWith('/mzigo') || path.startsWith('/logistics')) return '/mzigo/login';
            return '/buyer/login';
        };

        // Prevent redirect loop: if already on the login page, don't add `from` state
        const loginPath = getLoginPath();
        const isAlreadyOnLoginPage =
            location.pathname === loginPath ||
            location.pathname.includes('/login') ||
            location.pathname.includes('/register');

        return (
            <Navigate
                to={loginPath}
                state={isAlreadyOnLoginPage ? undefined : { from: location }}
                replace
            />
        );
    }

    // ─── Verification Check ───────────────────────────────────────────────────
    if (requiresEmailVerification(role) && user && !user.profile?.is_verified) {
        return (
            <Navigate
                to={`/verify-email?email=${encodeURIComponent(String(user.profile.email || ''))}&type=${String(role || '')}`}
                state={{ from: location }}
                replace
            />
        );
    }

    // Wrong role → check if user owns an eligible cross-role account before bouncing
    if (role && !allowedRoles.includes(role)) {
        if (isAccountsLoading) {
            return <>{fallback ?? <RouteFallback />}</>;
        }

        const switchableTargetRole = (['buyer', 'seller', 'creator'] as const).find(
            (r) => allowedRoles.includes(r) && myAccounts?.accounts?.[r]
        );

        if (switchableTargetRole) {
            return (
                <div className="flex min-h-[100svh] items-center justify-center bg-[var(--byblos-bg,#000000)] p-4 text-[var(--byblos-text,#ffffff)]">
                    <div className="w-full max-w-md space-y-4 rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-zinc-900 p-6 text-center shadow-lg">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            Account Switch Required
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            You are currently active as a <span className="font-semibold capitalize">{role}</span>. This page requires your <span className="font-semibold capitalize">{switchableTargetRole}</span> account.
                        </p>
                        <div className="pt-2 flex flex-col gap-2">
                            <Button
                                type="button"
                                disabled={isSwitching}
                                onClick={async () => {
                                    setIsSwitching(true);
                                    try {
                                        await switchAccount(switchableTargetRole);
                                    } catch {
                                        setIsSwitching(false);
                                    }
                                }}
                                className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-semibold text-black transition hover:bg-yellow-300 disabled:opacity-50"
                            >
                                {isSwitching ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Switching...</span>
                                    </span>
                                ) : (
                                    `Switch to ${switchableTargetRole.charAt(0).toUpperCase() + switchableTargetRole.slice(1)}`
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(getDashboardPath(role), { replace: true })}
                                className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-zinc-800"
                            >
                                Return to {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return <Navigate to={getDashboardPath(role)} replace />;
    }

    return <>{children}</>;
}

// ─── Convenience Wrappers ──────────────────────────────────────────────────────
export function BuyerProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['buyer']}>{children}</AppProtectedRoute>;
}

export function SellerProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['seller']}>{children}</AppProtectedRoute>;
}

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
    return <AppProtectedRoute allowedRoles={['admin']}>{children}</AppProtectedRoute>;
}

export function MultiRoleProtectedRoute({
    children,
    roles,
}: {
    children: React.ReactNode;
    roles: UserRole[];
}) {
    return <AppProtectedRoute allowedRoles={roles}>{children}</AppProtectedRoute>;
}


