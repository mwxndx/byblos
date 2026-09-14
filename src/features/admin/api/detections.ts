import { api } from './instance';
import type { FlaggedEarning, FlaggedEarningAction } from '../types/detections';

// Previously cast response.data straight to this shape with no runtime
// check. If this endpoint ever returned an error envelope or a
// differently-shaped body (e.g. under a proxy/gateway error), the caller
// (useDetections.ts: `flaggedQuery.data?.data || []`) already degrades to an
// empty list gracefully -- but the cast meant that happened by accident,
// with no compiler or runtime signal that the shape didn't actually match.
// Narrowing here produces the same graceful-empty behavior deliberately.
export async function getFlaggedEarnings(limit = 50): Promise<{ status: string; results: number; data: FlaggedEarning[] }> {
  const response = await api.get<unknown>(`/admin/creators/flagged-earnings?limit=${limit}`);
  const body = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;
  return {
    status: typeof body.status === 'string' ? body.status : 'unknown',
    results: typeof body.results === 'number' ? body.results : 0,
    data: Array.isArray(body.data) ? (body.data as FlaggedEarning[]) : []
  };
}

export async function resolveFlaggedEarning(
  earningType: FlaggedEarning['earning_type'],
  id: number | string,
  data: { action: FlaggedEarningAction; notes?: string },
  headers: Record<string, string>
) {
  const response = await api.patch(
    `/admin/creators/flagged-earnings/${earningType}/${id}/resolve`,
    data,
    { headers }
  );
  return response.data;
}
