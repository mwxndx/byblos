

export interface SellerRegistrationFormData {
  firstName: string;
  lastName: string;
  shopName: string;
  email: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
  physicalAddress: string;
  latitude: number | undefined;
  longitude: number | undefined;
  businessPhoto: string;
}

// Location data with Kenyan cities and their areas
export const locationData: Record<string, string[]> = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka']
};

/**
 * Normalizes seller shop name:
 * - Always starts with a capital letter
 * - Replaces underscores with spaces (separating words)
 * - Underscores are never shown
 * - Collapses consecutive spaces and trims edges
 * - Capitalizes each word (Title Case)
 */
export function normalizeShopName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Password strength checker function re-exported from canonical authValidation
export { checkPasswordStrength } from '@/features/auth/utils/authValidation';
