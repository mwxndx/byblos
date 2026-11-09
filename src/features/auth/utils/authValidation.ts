/**
 * Authentication & Form Validation Facade for Byblos.
 * Re-exports canonical validation utilities from the shared layer to preserve clean architecture
 * boundaries while maintaining 100% backward compatibility for existing feature consumers.
 */

export * from '@/shared/utils/validation';
