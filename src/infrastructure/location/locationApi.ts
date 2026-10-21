import apiClient from '@/infrastructure/http/apiClient';

export interface LocationSearchResult {
  provider: string;
  id: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface LocationMapConfig {
  cartoApiKey?: string;
}

let cachedConfigPromise: Promise<LocationMapConfig> | null = null;

export async function getLocationConfig(): Promise<LocationMapConfig> {
  if (cachedConfigPromise) {
    return cachedConfigPromise;
  }

  cachedConfigPromise = (async () => {
    try {
      const response = await apiClient.get('/locations/config');
      return (response.data?.data as LocationMapConfig) || {};
    } catch (error) {
      console.warn('[locationApi] Failed to load location config:', error);
      return {};
    }
  })();

  return cachedConfigPromise;
}

export function resetLocationConfigCache(): void {
  cachedConfigPromise = null;
}

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  try {
    const response = await apiClient.get('/locations/search', {
      params: { q: trimmed }
    });

    return Array.isArray(response.data?.data) ? response.data.data : [];
  } catch (error) {
    console.error('[locationApi] Location search failed:', error);
    return [];
  }
}
