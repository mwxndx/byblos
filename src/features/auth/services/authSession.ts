import type { UserRole } from '../types/authTypes';
import { storage, authStorage } from '@/infrastructure/storage/storage';
import apiClient from '@/infrastructure/http/apiClient';

const ALL_ROLES: UserRole[] = ['buyer', 'seller', 'admin', 'creator', 'logistics', 'marketing'];

export const getSessionKey = (role: UserRole): string => `${role}SessionActive`;

export const markRoleSessionActive = async (role: UserRole): Promise<void> => {
  await storage.set(getSessionKey(role), 'true');
};

export const clearRoleSession = async (role: UserRole): Promise<void> => {
  await storage.remove(getSessionKey(role));
};

export const setActiveRole = async (role: UserRole): Promise<void> => {
  await authStorage.setActiveRole(role);
};

export const getActiveRole = async (): Promise<UserRole | null> => {
  const value = await authStorage.getActiveRole();
  return value && ALL_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
};

/**
 * Enforce a single active account on the device.
 * 1. Evicts legacy storage keys across all 6 roles.
 * 2. Collects previous JWT tokens for all roles other than activeRole.
 * 3. Revokes previous tokens on the server via POST /auth/revoke-token.
 * 4. Removes token, refresh token and session marker for every role OTHER than active.
 * 5. Records active role under byblos.auth.active_role.
 */
export const enforceSingleActiveRole = async (activeRole: UserRole): Promise<void> => {
  const inactiveRoles = ALL_ROLES.filter((role) => role !== activeRole);

  const oldTokens = await Promise.all(
    inactiveRoles.map(async (role) => {
      const oldToken = await storage.get(`${role}Token`);
      return typeof oldToken === 'string' && oldToken ? oldToken : null;
    })
  );
  const tokensToRevoke = oldTokens.filter((token): token is string => Boolean(token));

  await authStorage.purgeLegacyAndInactiveKeys(activeRole);

  await Promise.all(
    inactiveRoles.flatMap((role) => [
      storage.remove(getSessionKey(role)),
      storage.remove(`${role}Token`),
      storage.remove(`${role}RefreshToken`)
    ])
  );

  if (tokensToRevoke.length > 0) {
    try {
      await apiClient.post('/auth/revoke-token', { tokens: tokensToRevoke });
    } catch {
      // Ignore network errors during background token revocation
    }
  }

  await setActiveRole(activeRole);
};

export const clearRoleSessionMarkers = async (): Promise<void> => {
  await authStorage.clearAuth();
  await Promise.all(
    ALL_ROLES.flatMap((role) => [
      storage.remove(`${role}SessionActive`),
      storage.remove(`${role}Token`),
      storage.remove(`${role}RefreshToken`)
    ])
  );
};
