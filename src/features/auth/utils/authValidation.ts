/**
 * Canonical Authentication & Form Validation Module for Byblos.
 * Serves as the single source of truth across Buyer, Seller, Creator, and Admin registration & reset flows.
 */

export interface PasswordStrength {
  minLength: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  hasUpper: boolean;
  hasLower: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
  unmetRequirements: string[];
}

/**
 * Checks all 5 Byblos password complexity criteria:
 * 1. Minimum 8 characters
 * 2. At least one numeric digit (0-9)
 * 3. At least one special character (!@#$%^&*(),.?":{}|<>)
 * 4. At least one uppercase letter (A-Z)
 * 5. At least one lowercase letter (a-z)
 */
export const checkPasswordStrength = (password: string): PasswordStrength => {
  const pwd = password || '';
  return {
    minLength: pwd.length >= 8,
    hasNumber: /\d/.test(pwd),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
  };
};

/**
 * Returns human-readable descriptions of any unmet password criteria.
 */
export const getUnmetPasswordRequirements = (strength: PasswordStrength): string[] => {
  const unmet: string[] = [];
  if (!strength.minLength) unmet.push("at least 8 characters");
  if (!strength.hasNumber) unmet.push("a number");
  if (!strength.hasSpecial) unmet.push("a special character");
  if (!strength.hasUpper) unmet.push("an uppercase letter");
  if (!strength.hasLower) unmet.push("a lowercase letter");
  return unmet;
};

/**
 * Validates password criteria and confirmation match.
 */
export const validatePasswordRequirements = (
  password: string,
  confirmPassword?: string
): PasswordValidationResult => {
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {
      isValid: false,
      error: 'Passwords do not match',
      unmetRequirements: [],
    };
  }

  const strength = checkPasswordStrength(password);
  const unmetRequirements = getUnmetPasswordRequirements(strength);

  if (unmetRequirements.length > 0) {
    return {
      isValid: false,
      error: `Password needs ${unmetRequirements.join(', ')}`,
      unmetRequirements,
    };
  }

  return {
    isValid: true,
    unmetRequirements: [],
  };
};

/**
 * Standard RFC-compliant email address format validator.
 */
export const isValidEmail = (email?: string | null): boolean => {
  if (!email || typeof email !== 'string') return false;
  return /^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
};

/**
 * Normalizes Kenyan mobile phone numbers into local standard format (0XXXXXXXXX).
 * Handles +254..., 254..., and local 07... / 01... numbers.
 */
export const normalizeKenyanPhone = (phone?: string | null): string => {
  if (!phone) return '';
  let digits = String(phone).replace(/\s+/g, '');
  if (digits.startsWith('+254')) {
    digits = `0${digits.slice(4)}`;
  } else if (digits.startsWith('254')) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
};
