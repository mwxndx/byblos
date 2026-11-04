/**
 * telemetry.ts
 *
 * Centralized deployment-aware telemetry gating.
 * Prevents Vercel-specific analytics and speed-insights integrations from executing
 * in deployments that do not use Vercel (e.g. self-hosted Docker, VPS, or local development).
 */

export function isVercelTelemetryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const env = import.meta.env;
  if (!env) return false;

  // Explicit opt-out or disable flag fails safe
  if (env.VITE_DISABLE_TELEMETRY === 'true' || env.VITE_TELEMETRY_DISABLED === 'true') {
    return false;
  }

  // Explicit Vercel target detection
  const isVercelTarget =
    env.VITE_DEPLOYMENT_TARGET === 'vercel' ||
    env.VITE_VERCEL === '1' ||
    env.VITE_VERCEL_ENV === 'production' ||
    env.VITE_ENABLE_VERCEL_TELEMETRY === 'true';

  return Boolean(isVercelTarget);
}

