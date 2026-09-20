import { buyerApiInstance } from './instance';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  status?: string;
}

export async function getShops(params: { page?: number; limit?: number } = {}): Promise<unknown[]> {
  try {
    const response = await buyerApiInstance.get<ApiResponse<unknown[]>>('/buyers/shops', { params });
    const isSuccess = response.data?.success || response.data?.status === 'success';
    if (!isSuccess) {
      throw new Error('Failed to fetch shops');
    }
    return response.data.data;
  } catch (error) {
    console.error('Error fetching shops:', error);
    throw error;
  }
}


