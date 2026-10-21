import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMapTileUrls } from '../location/mapTileUrls';
import { getLocationConfig, resetLocationConfigCache } from '@/infrastructure/location/locationApi';
import apiClient from '@/infrastructure/http/apiClient';

vi.mock('@/infrastructure/http/apiClient', () => ({
    default: {
        get: vi.fn(),
    },
}));

describe('LocationMapView tile configuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetLocationConfigCache();
    });

    it('generates authenticated CARTO tile URLs when an API key is provided', () => {
        const testKey = 'test_carto_key_123';
        const urls = getMapTileUrls(testKey);

        expect(urls.length).toBeGreaterThanOrEqual(3);
        expect(urls[0]).toContain('basemaps.cartocdn.com/rastertiles/voyager');
        expect(urls[0]).toContain(`?key=${testKey}`);
        expect(urls[1]).toContain('basemaps.cartocdn.com/light_all');
        expect(urls[1]).toContain(`?key=${testKey}`);
        expect(urls[urls.length - 1]).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    });

    it('falls back to OpenStreetMap and omits unauthenticated CARTO when API key is empty', () => {
        const urls = getMapTileUrls('');

        expect(urls).toEqual([
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ]);
        expect(urls.some((url) => url.includes('cartocdn.com'))).toBe(false);
    });

    it('fetches server-side map configuration from /locations/config', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({
            data: {
                status: 'success',
                data: {
                    cartoApiKey: 'server_env_carto_key',
                },
            },
        });

        const config = await getLocationConfig();
        expect(apiClient.get).toHaveBeenCalledWith('/locations/config');
        expect(config.cartoApiKey).toBe('server_env_carto_key');

        const urls = getMapTileUrls(config.cartoApiKey);
        expect(urls[0]).toContain('?key=server_env_carto_key');
    });

    it('gracefully handles server errors when fetching location config', async () => {
        vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network error'));

        const config = await getLocationConfig();
        expect(config).toEqual({});
    });
});
