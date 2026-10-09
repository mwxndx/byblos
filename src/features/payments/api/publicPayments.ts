import apiClient from '@/infrastructure/http/apiClient';

export async function pollPaymentStatus(
  reference: string,
  maxAttempts: number = 30,
  interval: number = 5000
): Promise<unknown> {
  const attempts = 0;

  return new Promise((resolve, reject) => {
    let currentAttempts = attempts;
    const checkStatus = async () => {
      try {
        currentAttempts++;
        const response = await apiClient.get(`payments/status/${reference}`);
        const responseData = (response.data || {}) as Record<string, unknown>;
        const innerData = (responseData.data && typeof responseData.data === 'object'
          ? responseData.data
          : null) as Record<string, unknown> | null;

        const rawStatus = typeof innerData?.status === 'string'
          ? innerData.status
          : typeof responseData.status === 'string'
            ? responseData.status
            : '';
        const status = rawStatus.toLowerCase();

        const isTerminalSuccess = status === 'completed' || status === 'success' || status === 'paid' || status === 'successful';
        const isTerminalFailure = status === 'failed' || status === 'cancelled' || status === 'rejected';

        if (isTerminalSuccess || isTerminalFailure) {
          resolve(response.data);
        } else if (currentAttempts >= maxAttempts) {
          resolve({ status: 'timeout', message: 'Polling timed out' });
        } else {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        console.error('[pollPaymentStatus] Error:', error);
        if (currentAttempts >= maxAttempts) {
          reject(error);
        } else {
          setTimeout(checkStatus, interval);
        }
      }
    };

    checkStatus();
  });
}


