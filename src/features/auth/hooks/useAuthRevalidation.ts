import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authStateManager } from '@/infrastructure/auth/authState';
import { storage } from '@/infrastructure/storage/storage';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';
import {
  AUTH_REVALIDATION_TTL_MS,
  getDashboardPath,
  getRoleFromRoute,
  isPublicRoute,
} from '../utils/authRouting';
import { clearRoleSession, getActiveRole, getSessionKey, markRoleSessionActive } from '../services/authSession';
import type { GlobalUser, UserRole } from '../types/authTypes';
import {
  buyerProfileQueryOptions,
  sellerProfileQueryOptions,
  adminProfileQueryOptions,
  creatorProfileQueryOptions,
  logisticsProfileQueryOptions,
  marketingProfileQueryOptions,
} from './useAuthQueries';

const LAST_NATIVE_PATH_KEY = 'byblos_last_native_path';
const EXCLUDED_RESTORE_PATHS = ['/reset-password', '/forgot-password', '/payment', '/checkout', '/verify-email', '/login', '/register'];

const isExcludedFromRestoration = (path: string): boolean => {
  if (!path || path === '/') return true;
  return EXCLUDED_RESTORE_PATHS.some((p) => path.includes(p));
};

// A profile probe only proves the session is gone when the server definitively
// rejects it (401 Unauthorized / 404 Not Found). A 5xx, a timeout, being
// offline, or a cold-starting backend is a transient failure — NOT a logout —
// so we must not clear the persisted session marker on those, or a valid user
// gets signed out by a temporary blip. react-query already retries the profile
// query, so only a sustained failure reaches the callers of this.
export const isDefinitiveAuthFailure = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 404;
};

interface UseAuthRevalidationOptions {
  pathname: string;
  user: GlobalUser | null;
  setUser: Dispatch<SetStateAction<GlobalUser | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setInitializing: Dispatch<SetStateAction<boolean>>;
  navigate: NavigateFunction;
}

export function useAuthRevalidation({
  pathname,
  user,
  setUser,
  setIsLoading,
  setInitializing,
  navigate,
}: UseAuthRevalidationOptions) {
  const authCheckInProgress = useRef(false);
  const initialized = useRef(false);
  const lastCheckRef = useRef<number>(0);
  const lastRouteRoleRef = useRef<UserRole | null>(null);
  const queryClient = useQueryClient();

  const markAuthChecked = useCallback(() => {
    lastCheckRef.current = Date.now();
  }, []);

  // Track valid sub-page navigation on native app to allow cold-start restoration
  useEffect(() => {
    if (!isNativeApp()) return;
    if (!pathname || isPublicRoute(pathname) || isExcludedFromRestoration(pathname)) return;

    storage.set(LAST_NATIVE_PATH_KEY, pathname);
  }, [pathname]);

  const checkAuth = useCallback(async (force = false) => {
    if (authCheckInProgress.current && !force) return;

    const currentRole = getRoleFromRoute(pathname);
    const isStale = Date.now() - lastCheckRef.current > AUTH_REVALIDATION_TTL_MS;

    if (!force && user && user.role === currentRole && user.isAuthenticated && !isStale) {
      setIsLoading(false);
      setInitializing(false);
      return;
    }

    if (!currentRole || isPublicRoute(pathname)) {
      setIsLoading(false);
      // Do NOT call setInitializing(false) here on a public/root path.
      // The async cold-start effect (below) will call setInitializing(false)
      // once it has definitively determined whether a stored session exists.
      // Calling it here would show the login screen before the restore check finishes.
      if (!isNativeApp() || (pathname !== '/' && pathname !== '')) {
        setInitializing(false);
      }
      return;
    }

    authCheckInProgress.current = true;
    setIsLoading(true);
    authStateManager.setRehydrating(true);

    try {
      let queryOpts;
      if (currentRole === 'buyer') {
        queryOpts = buyerProfileQueryOptions;
      } else if (currentRole === 'seller') {
        queryOpts = sellerProfileQueryOptions;
      } else if (currentRole === 'admin') {
        queryOpts = adminProfileQueryOptions;
      } else if (currentRole === 'logistics') {
        queryOpts = logisticsProfileQueryOptions;
      } else if (currentRole === 'marketing') {
        queryOpts = marketingProfileQueryOptions;
      } else {
        queryOpts = creatorProfileQueryOptions;
      }

      // Fetch or get query data
      const profileData = await queryClient.fetchQuery(queryOpts);

      if (!profileData) {
        setUser(null);
        await clearRoleSession(currentRole);
        return;
      }

      setUser({
        role: currentRole,
        profile: profileData as import("@/features/auth/types/authTypes").UserProfile,
        isAuthenticated: true
      });

      await markRoleSessionActive(currentRole);
      markAuthChecked();
    } catch (error) {
      if (!isDefinitiveAuthFailure(error)) {
        // Transient error (5xx, timeout, offline, cold-starting backend): keep
        // the session marker and any existing user in place so a temporary
        // outage does not log a valid user out. A later revalidation recovers.
      } else if (currentRole === 'buyer') {
        // A buyer-route probe returning 401/404 must not clear another role's
        // session (cross-role safety).
      } else {
        setUser(null);
        await clearRoleSession(currentRole);
      }
    } finally {
      authStateManager.setRehydrating(false);
      setIsLoading(false);
      setInitializing(false);
      authCheckInProgress.current = false;
    }
  }, [markAuthChecked, pathname, setInitializing, setIsLoading, setUser, user, queryClient]);

  useEffect(() => {
    const currentRole = getRoleFromRoute(pathname);
    const routeRoleChanged = lastRouteRoleRef.current !== currentRole;
    const isStale = Date.now() - lastCheckRef.current > AUTH_REVALIDATION_TTL_MS;
    lastRouteRoleRef.current = currentRole;

    if (!initialized.current || routeRoleChanged || isStale) {
      initialized.current = true;
      checkAuth(routeRoleChanged || isStale);
    }
  }, [pathname, checkAuth]);

  useEffect(() => {
    const revalidateOnResume = () => {
      const currentRole = getRoleFromRoute(pathname);
      if (!currentRole || isPublicRoute(pathname)) return;
      const isStale = Date.now() - lastCheckRef.current > AUTH_REVALIDATION_TTL_MS;
      if (isStale) {
        checkAuth(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateOnResume();
      }
    };

    window.addEventListener('focus', revalidateOnResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidateOnResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname, checkAuth]);

  // Cold-start session restore. On native the app relaunches at "/" (a public
  // route), so the route-based checkAuth never re-fetches the profile and a
  // still-valid persisted token looks logged-out. If a role's session marker
  // survived, restore that session from its stored token and land on its
  // last active sub-page (or dashboard default) so the user is not forced to log in again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bootPath = pathname;
      if (getRoleFromRoute(bootPath) || !isPublicRoute(bootPath)) return;
      if (user) return;
      if (['/reset-password', '/forgot-password', '/payment', '/checkout'].some((p) => bootPath.includes(p))) return;

      // Prefer the explicitly-recorded active account so we restore exactly who
      // the user last signed in as — not whichever role marker comes first in a
      // fixed priority list (which would silently switch accounts when a stale
      // session from another user is still on the device).
      let activeRole: UserRole | null = null;
      const persistedRole = await getActiveRole();
      if (persistedRole && (await storage.get(getSessionKey(persistedRole))) === 'true') {
        activeRole = persistedRole;
      } else {
        const roles: UserRole[] = ['seller', 'buyer', 'creator', 'logistics', 'admin', 'marketing'];
        const sessionResults = await Promise.all(
          roles.map(async (r) => ({ role: r, isActive: (await storage.get(getSessionKey(r))) === 'true' }))
        );
        const activeMatch = sessionResults.find((res) => res.isActive);
        if (activeMatch) {
          activeRole = activeMatch.role;
        }
      }
      if (!activeRole || cancelled) {
        if (!cancelled) setInitializing(false);
        return;
      }

      // ── Optimistic navigation ────────────────────────────────────────────
      // We already know, from the local session marker, which dashboard this
      // returning user belongs on. Navigate there NOW — before the (possibly
      // slow, e.g. cold-starting backend) profile fetch — so the user lands on
      // their dashboard skeleton instead of flashing the public landing page
      // while the fetch runs. Keep isLoading true so AppProtectedRoute shows its
      // loading fallback rather than bouncing to /login while `user` is still
      // null; the fetch below fills the profile in, or clears the session on
      // failure (which then lets the protected route send them to login).
      if (bootPath === '/') {
        let destinationPath = getDashboardPath(activeRole);
        if (isNativeApp()) {
          const savedPath = await storage.get(LAST_NATIVE_PATH_KEY);
          if (savedPath && !isPublicRoute(savedPath) && !isExcludedFromRestoration(savedPath)) {
            const savedRole = getRoleFromRoute(savedPath);
            if (!savedRole || savedRole === activeRole) {
              destinationPath = savedPath;
            }
          }
        }
        if (cancelled) return;
        setIsLoading(true);
        setInitializing(false);
        navigate(destinationPath, { replace: true });
      }

      let queryOpts;
      if (activeRole === 'buyer') queryOpts = buyerProfileQueryOptions;
      else if (activeRole === 'seller') queryOpts = sellerProfileQueryOptions;
      else if (activeRole === 'admin') queryOpts = adminProfileQueryOptions;
      else if (activeRole === 'logistics') queryOpts = logisticsProfileQueryOptions;
      else queryOpts = creatorProfileQueryOptions;

      try {
        const profileData = await queryClient.fetchQuery(queryOpts);
        if (cancelled) return;
        if (!profileData) {
          await clearRoleSession(activeRole);
          return;
        }
        setUser({
          role: activeRole,
          profile: profileData as import('@/features/auth/types/authTypes').UserProfile,
          isAuthenticated: true,
        });
        await markRoleSessionActive(activeRole);
        markAuthChecked();
      } catch (error) {
        // Only a definitive auth failure (401/404) means the session is really
        // gone — drop the marker so AppProtectedRoute routes to login. A
        // transient error (5xx, timeout, cold-starting backend) is NOT a logout:
        // keep the marker so a valid user is not signed out by a blip and the
        // session restores on the next launch.
        if (isDefinitiveAuthFailure(error) && !cancelled) {
          await clearRoleSession(activeRole);
        }
      } finally {
        // Always ungate rendering after the restore attempt completes.
        if (!cancelled) {
          setIsLoading(false);
          setInitializing(false);
        }
      }
    })();
    // Safety fallback: ensure initializing is ungated after 3 seconds max
    const safetyTimer = setTimeout(() => {
      setInitializing(false);
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
    // Boot-only: run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { markAuthChecked };
}


