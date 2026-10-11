import { useCallback, useEffect, useMemo, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthActions } from '../hooks/useAuthActions';
import { useAuthRevalidation } from '../hooks/useAuthRevalidation';
import { isPublicRoute } from '../utils/authRouting';
import { GlobalAuthContext } from './authContextObjects';
import {
    clearAppNavigator,
    registerAppNavigator,
    SESSION_EXPIRED_EVENT,
    type SessionExpiredDetail,
} from '@/infrastructure/navigation/navigationService';
import { storage } from '@/infrastructure/storage/storage';

export { GlobalAuthContext } from './authContextObjects';

export type {
    AdminProfile,
    BuyerProfile,
    BuyerRegistrationData,
    GlobalAuthContextType,
    GlobalUser,
    RegistrationData,
    SellerProfile,
    SellerRegistrationData,
    UserProfile,
    UserRole,
} from '../types/authTypes';

const CACHED_SESSION_KEY = 'byblos.auth.session';

function getInitialUser(): import('../types/authTypes').GlobalUser | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CACHED_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.role && parsed.isAuthenticated) {
            return parsed as import('../types/authTypes').GlobalUser;
        }
    } catch {
        /* ignore parsing errors */
    }
    return null;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function AuthCoreProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<import('../types/authTypes').GlobalUser | null>(() => getInitialUser());
    const [isLoading, setIsLoading] = useState<boolean>(() => !getInitialUser());
    // Only true when on an unauthenticated protected route waiting for storage/network probe.
    // If a user was already hydrated or path is public, immediately false to prevent loading flash.
    const [initializing, setInitializing] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        if (getInitialUser()) return false;
        const currentPath = window.location.pathname || '/';
        return currentPath !== '/' && !isPublicRoute(currentPath);
    });
    const navigate = useNavigate();
    const location = useLocation();

    const setUser = useCallback<Dispatch<SetStateAction<import('../types/authTypes').GlobalUser | null>>>((action) => {
        setUserState((prev) => {
            const next = typeof action === 'function' ? action(prev) : action;
            try {
                if (next && next.isAuthenticated) {
                    localStorage.setItem(CACHED_SESSION_KEY, JSON.stringify(next));
                } else {
                    localStorage.removeItem(CACHED_SESSION_KEY);
                }
            } catch {
                /* ignore storage error */
            }
            return next;
        });
    }, []);

    const { markAuthChecked } = useAuthRevalidation({
        pathname: location.pathname,
        user,
        setUser,
        setIsLoading,
        setInitializing,
        navigate,
    });

    // Bridge non-React modules (axios 401 handler, native push deep-links) to the
    // client-side router so they navigate WITHOUT a full page reload. A hard
    // `location.href` reload wipes this in-memory auth state and, on native,
    // cold-reboots the WebView — which is what bounced users back to login.
    useEffect(() => {
        const navigateFn = (path: string, options?: { replace?: boolean }) =>
            navigate(path, options);
        registerAppNavigator(navigateFn);

        const handleSessionExpired = (event: Event) => {
            const detail = (event as CustomEvent<SessionExpiredDetail>).detail;
            const redirectPath = detail?.redirectPath ?? '/buyer/login';
            void storage.remove('byblos_auth_checked');
            void storage.remove('byblos_user_role');
            setUser(null);
            navigate(redirectPath, { replace: true });
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

        return () => {
            clearAppNavigator(navigateFn);
            window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        };
    }, [navigate]);

    const {
        login,
        loginWithToken,
        loginAdmin,
        register,
        logout,
        switchAccount,
        refreshRole,
        forgotPassword,
        resetPassword,
        getProfile,
        updateProfile,
    } = useAuthActions({
        navigate,
        user,
        setUser,
        setIsLoading,
        markAuthChecked,
    });
    // ============================================================================
    // CONTEXT VALUE
    // ============================================================================

    const value: import('../types/authTypes').GlobalAuthContextType = useMemo(() => ({
        user,
        isAuthenticated: user?.isAuthenticated || false,
        isLoading,
        role: user?.role || null,
        login,
        loginWithToken,
        loginAdmin,
        register,
        logout,
        switchAccount,
        refreshRole,
        forgotPassword,
        resetPassword,
        getProfile,
        updateProfile,
    }), [user, isLoading, login, loginWithToken, loginAdmin, register, logout, switchAccount, refreshRole, forgotPassword, resetPassword, getProfile, updateProfile]);

    // ============================================================================
    // RENDER GATING (Prevents Flickering)
    // ============================================================================

    // Only gate on the FIRST page-load auth check when no cached user exists.
    // Using `initializing && !user` so cached sessions render instantly without loading flash.
    if (initializing && !user) {
        return <LoadingScreen message="Loading..." />;
    }

    return (
        <GlobalAuthContext.Provider value={value}>
            {children}
        </GlobalAuthContext.Provider>
    );
}


