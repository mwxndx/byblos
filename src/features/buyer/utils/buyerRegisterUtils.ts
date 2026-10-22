import { checkPasswordStrength } from '@/features/auth/utils/authValidation';

export interface BuyerRegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  mobilePayment: string;
  whatsappNumber: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
}

// Password strength checker function re-exported from canonical authValidation
export { checkPasswordStrength };
