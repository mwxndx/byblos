import type { UseMutateAsyncFunction } from '@tanstack/react-query';
import type { UserRole, UserProfile } from '../types/authTypes';
import {
  buyerProfileQueryOptions,
  sellerProfileQueryOptions,
  adminProfileQueryOptions,
  creatorProfileQueryOptions,
  logisticsProfileQueryOptions,
  marketingProfileQueryOptions,
} from './useAuthQueries';

export type LoginMutationFn = UseMutateAsyncFunction<unknown, Error, { email: string; password: string; acceptTerms?: boolean }>;

export interface LoginMutations {
  buyer: LoginMutationFn;
  seller: LoginMutationFn;
  admin: LoginMutationFn;
  creator: LoginMutationFn;
  logistics: LoginMutationFn;
  marketing: LoginMutationFn;
}

export async function executeRoleLogin(
  mutations: LoginMutations,
  role: UserRole,
  credentials: { email: string; password: string; acceptTerms?: boolean }
): Promise<{ response: unknown; profile: UserProfile }> {
  let response: unknown;

  switch (role) {
    case 'buyer':
      response = await mutations.buyer(credentials);
      break;
    case 'seller':
      response = await mutations.seller(credentials);
      break;
    case 'creator':
      response = await mutations.creator(credentials);
      break;
    case 'admin':
      response = await mutations.admin(credentials);
      break;
    case 'logistics':
      response = await mutations.logistics(credentials);
      break;
    case 'marketing':
      response = await mutations.marketing(credentials);
      break;
    default:
      throw new Error(`Unsupported login role: ${role}`);
  }

  const profile = extractProfileForRole(role, response);
  return { response, profile };
}

export function extractProfileForRole(role: UserRole, response: unknown): UserProfile {
  const r = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
  const nestedData = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>;
  switch (role) {
    case 'buyer':
      return r.buyer as UserProfile;
    case 'seller':
      return r.seller as UserProfile;
    case 'creator':
      return r.creator as UserProfile;
    case 'logistics':
      return r.partner as UserProfile;
    default:
      return (r.user || nestedData.user) as UserProfile;
  }
}

export function getProfileQueryOptionsForRole(role: UserRole) {
  switch (role) {
    case 'buyer':
      return buyerProfileQueryOptions;
    case 'seller':
      return sellerProfileQueryOptions;
    case 'creator':
      return creatorProfileQueryOptions;
    case 'logistics':
      return logisticsProfileQueryOptions;
    case 'marketing':
      return marketingProfileQueryOptions;
    default:
      return adminProfileQueryOptions;
  }
}

export function getLogoutEndpointForRole(role: UserRole): string {
  switch (role) {
    case 'seller':
      return '/sellers/logout';
    case 'admin':
    case 'marketing':
      return '/admin/logout';
    case 'creator':
      return '/creators/logout';
    case 'logistics':
      return '/logistics/logout';
    default:
      return '/buyers/logout';
  }
}
