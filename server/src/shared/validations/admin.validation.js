import { z } from 'zod';

// Permissive schemas: path params are non-empty strings (always present in the
// URL, so this never false-rejects a valid request); known body fields are
// optional/loose; .passthrough() keeps every other field the controller reads.
// This adds a clean 400 for malformed input + param validation without changing
// accept/reject behavior for currently-valid traffic.
const id = z.string().min(1, 'Required path parameter is missing');
const s = z.string().optional();
const n = z.coerce.number().optional();
const anyId = z.union([z.string(), z.number()]).optional();

// The only sellers.status values the app actually recognizes: 'active'
// (default) and 'inactive' (the admin toggle), plus 'suspended' (the value
// auth.js gates access on) and 'deleted' (soft-delete). Validating the enum
// here means a typo or wrong-casing ('Active', 'pending_review', ...) is a
// clean 400 instead of being written verbatim into the column, where the
// exact-string auth gate would silently never match it while the admin UI
// reported success.
const sellerStatus = z.enum(['active', 'inactive', 'suspended', 'deleted'], {
  errorMap: () => ({ message: "status must be one of 'active', 'inactive', 'suspended', or 'deleted'" })
});

export const login = z.object({ email: s, password: s }).passthrough();
export const updateSellerStatus = z.object({ id: id, status: sellerStatus }).passthrough();
export const deleteCreator = z.object({ id: id }).passthrough();
export const deleteUser = z.object({ id: id, role: s }).passthrough();
export const updateWithdrawalStatus = z.object({ id: id, status: s }).passthrough();
export const adminUpdateLegStatus = z.object({ requestId: id, legType: id, status: s }).passthrough();
export const resolveDispute = z.object({ requestId: id }).passthrough();
export const exceptionalOrderReversal = z.object({
  id: id,
  reason: z.string().min(5, 'A valid reason of at least 5 characters is required'),
  notes: s
}).passthrough();
export const resolveFlaggedCreatorEarning = z.object({
  earningType: z.enum(['sales', 'referral'], { errorMap: () => ({ message: "earningType must be 'sales' or 'referral'" }) }),
  id: id,
  action: z.enum(['release', 'reverse'], { errorMap: () => ({ message: "action must be 'release' or 'reverse'" }) }),
  notes: s
}).passthrough();

