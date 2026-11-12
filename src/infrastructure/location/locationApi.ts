import apiClient from '@/infrastructure/http/apiClient';

export interface LocationSearchResult {
  provider: string;
  id: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface LocationMapConfig {
  cartoApiKey?: string;
}

let cachedConfigPromise: Promise<LocationMapConfig> | null = null;
let hasCachedConfigPromise = false;

export async function getLocationConfig(): Promise<LocationMapConfig> {
  if (hasCachedConfigPromise && cachedConfigPromise !== null) {
    return await cachedConfigPromise;
  }

  hasCachedConfigPromise = true;
  const fetchPromise = (async () => {
    try {
      const response = await apiClient.get('/locations/config');
      return (response.data?.data as LocationMapConfig) || {};
    } catch {
      return {};
    }
  })();

  cachedConfigPromise = fetchPromise;
  return await fetchPromise;
}

export function resetLocationConfigCache(): void {
  cachedConfigPromise = null;
  hasCachedConfigPromise = false;
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
  } catch {
    return [];
  }
}
