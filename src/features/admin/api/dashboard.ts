import { api } from './instance';

export interface BroadcastUpdatePayload {
  minVersionCode?: number;
  title?: string;
  body?: string;
  storeUrl?: string;
}

export interface BroadcastUpdateResult {
  success: boolean;
  minVersionCode: number;
  targetedDevices: number;
  fcmSent: number;
  fcmFailed: number;
  inAppNotificationsCreated: number;
}

// Deliberately does not catch-and-default: a failed request must reject so
// TanStack Query marks this queryFn's query isError (and retries per its
// configured policy) instead of silently caching a fabricated all-zero
// result as if it were real data -- see useAdminDashboard.ts's read-error
// surfacing for how the failure reaches the admin.
export async function getDashboardStats() {
  const { data } = await api.get('/admin/stats');
  return data.data;
}

export async function broadcastAppUpdate(payload?: BroadcastUpdatePayload): Promise<BroadcastUpdateResult> {
  const { data } = await api.post('/admin/broadcast-update', payload || {});
  const res = data?.data || {};
  return {
    success: res.success ?? true,
    minVersionCode: res.minVersionCode ?? payload?.minVersionCode ?? 70,
    targetedDevices: res.targetedDevices ?? res.targeted ?? 0,
    fcmSent: res.fcmSent ?? res.sent ?? 0,
    fcmFailed: res.fcmFailed ?? res.failed ?? 0,
    inAppNotificationsCreated: res.inAppNotificationsCreated ?? res.inAppSent ?? 0,
  };
}
