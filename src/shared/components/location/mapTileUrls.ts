export const CARTO_API_KEY =
  (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim() || '';

export const getMapTileUrls = (apiKey: string = CARTO_API_KEY): string[] => {
  const key = apiKey.trim();
  const urls: string[] = [];
  if (key) {
    urls.push(
      `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`
    );
  }
  urls.push('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  return urls;
};
