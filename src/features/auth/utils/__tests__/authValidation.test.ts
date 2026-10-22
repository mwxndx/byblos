import { describe, it, expect } from 'vitest';
import {
  checkPasswordStrength,
  getUnmetPasswordRequirements,
  validatePasswordRequirements,
  isValidEmail,
  normalizeKenyanPhone,
} from '../authValidation';

describe('authValidation', () => {
  describe('checkPasswordStrength', () => {
    it('returns all false for empty or missing string', () => {
      const result = checkPasswordStrength('');
      expect(result).toEqual({
        minLength: false,
        hasNumber: false,
        hasSpecial: false,
        hasUpper: false,
        hasLower: false,
      });
    });

    it('correctly validates individual criteria', () => {
      expect(checkPasswordStrength('abcdefgh').minLength).toBe(true);
      expect(checkPasswordStrength('abc').minLength).toBe(false);

      expect(checkPasswordStrength('abc1').hasNumber).toBe(true);
      expect(checkPasswordStrength('abc').hasNumber).toBe(false);

      expect(checkPasswordStrength('abc!').hasSpecial).toBe(true);
      expect(checkPasswordStrength('abc@').hasSpecial).toBe(true);
      expect(checkPasswordStrength('abc#').hasSpecial).toBe(true);
      expect(checkPasswordStrength('abc').hasSpecial).toBe(false);

      expect(checkPasswordStrength('abcA').hasUpper).toBe(true);
      expect(checkPasswordStrength('abca').hasUpper).toBe(false);

      expect(checkPasswordStrength('ABCa').hasLower).toBe(true);
      expect(checkPasswordStrength('ABC').hasLower).toBe(false);
    });

    it('returns all true for strong password', () => {
      const result = checkPasswordStrength('Passw0rd!2026');
      expect(result).toEqual({
        minLength: true,
        hasNumber: true,
        hasSpecial: true,
        hasUpper: true,
        hasLower: true,
      });
    });
  });

  describe('getUnmetPasswordRequirements', () => {
    it('returns list of missing requirements', () => {
      const strength = checkPasswordStrength('pass');
      const unmet = getUnmetPasswordRequirements(strength);
      expect(unmet).toContain('at least 8 characters');
      expect(unmet).toContain('a number');
      expect(unmet).toContain('a special character');
      expect(unmet).toContain('an uppercase letter');
      expect(unmet).not.toContain('a lowercase letter');
    });

    it('returns empty array when all requirements are met', () => {
      const strength = checkPasswordStrength('Str0ngP@ss');
      expect(getUnmetPasswordRequirements(strength)).toEqual([]);
    });
  });

  describe('validatePasswordRequirements', () => {
    it('fails when confirmPassword does not match', () => {
      const result = validatePasswordRequirements('Str0ngP@ss', 'DiffP@ss1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });

    it('fails when requirements are unmet', () => {
      const result = validatePasswordRequirements('weak', 'weak');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Password needs');
      expect(result.unmetRequirements.length).toBeGreaterThan(0);
    });

    it('succeeds when password is valid and matches confirmation', () => {
      const result = validatePasswordRequirements('Str0ngP@ss123', 'Str0ngP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.unmetRequirements).toEqual([]);
    });

    it('succeeds when confirmPassword is omitted and password is strong', () => {
      const result = validatePasswordRequirements('Str0ngP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('isValidEmail', () => {
    it('validates email formats accurately', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('first.last+tag@domain.co.ke')).toBe(true);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('missing@tld')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('normalizeKenyanPhone', () => {
    it('normalizes +254 prefix to 0', () => {
      expect(normalizeKenyanPhone('+254712345678')).toBe('0712345678');
      expect(normalizeKenyanPhone('+254 712 345 678')).toBe('0712345678');
    });

    it('normalizes 254 prefix to 0', () => {
      expect(normalizeKenyanPhone('254712345678')).toBe('0712345678');
    });

    it('preserves already normalized 07/01 numbers', () => {
      expect(normalizeKenyanPhone('0712345678')).toBe('0712345678');
      expect(normalizeKenyanPhone('0112345678')).toBe('0112345678');
    });

    it('handles empty or null input gracefully', () => {
      expect(normalizeKenyanPhone('')).toBe('');
      expect(normalizeKenyanPhone(null)).toBe('');
      expect(normalizeKenyanPhone(undefined)).toBe('');
    });
  });
});
