/**
 * authContextObjects.ts
 *
 * Pure TypeScript — no JSX. Exports only context objects (createContext calls).
 * Kept in a .ts file so react-refresh/only-export-components is satisfied:
 * the corresponding .tsx provider files contain only React components.
 *
 * NOTE: Context types are defined inline here to avoid circular imports.
 */
import { createContext } from 'react';
import type { GlobalAuthContextType } from '../types/authTypes';

// ── GlobalAuth ─────────────────────────────────────────────────────────────
export const GlobalAuthContext = createContext<GlobalAuthContextType | undefined>(undefined);


