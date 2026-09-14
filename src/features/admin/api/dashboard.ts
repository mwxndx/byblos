import { api } from './instance';

// Deliberately does not catch-and-default: a failed request must reject so
// TanStack Query marks this queryFn's query isError (and retries per its
// configured policy) instead of silently caching a fabricated all-zero
// result as if it were real data -- see useAdminDashboard.ts's read-error
// surfacing for how the failure reaches the admin.
export async function getDashboardStats() {
  const { data } = await api.get('/admin/stats');
  return data.data;
}


