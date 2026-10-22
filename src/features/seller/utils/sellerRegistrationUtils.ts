import { checkPasswordStrength } from '@/features/auth/utils/authValidation';

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
}

// Location data with Kenyan cities and their areas
export const locationData: Record<string, string[]> = {
  'Nairobi': ['CBD', 'Westlands', 'Karen', 'Runda', 'Kileleshwa', 'Kilimani', 'Lavington', 'Parklands', 'Eastleigh', 'South B', 'South C', 'Langata', 'Kasarani', 'Embakasi', 'Ruaraka']
};

// Password strength checker function re-exported from canonical authValidation
export { checkPasswordStrength };
