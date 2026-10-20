export type ApproximateArea = {
  latitude: number;
  longitude: number;
  label: string;
  zoom: number;
};

const endpoint = 'https://ipwho.is/?fields=success,latitude,longitude,city,region,country';
const cacheDuration = 10 * 60 * 1000;

export function parseApproximateArea(value: unknown): ApproximateArea {
  if (!value || typeof value !== 'object') throw new Error('Area estimate unavailable');
  const data = value as Record<string, unknown>;
  const { latitude, longitude } = data;
  if (data.success !== true || typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Area estimate unavailable');
  }
  const name = (key: string) => typeof data[key] === 'string' ? (data[key] as string).trim().slice(0, 80) : '';
  const city = name('city');
  const region = name('region');
  const country = name('country');
  const label = [...new Set([city || region, country].filter(Boolean))].join(', ') || 'Estimated area';
  return { latitude, longitude, label, zoom: city ? 8 : region ? 6 : 4.5 };
}

export function createApproximateAreaLookup(fetcher: typeof fetch = fetch) {
  // Memory only: switching views reuses the estimate without storing the IP
  // or keeping a persistent location record in the browser.
  let cached: { area: ApproximateArea; expires: number } | undefined;
  return async function lookup(signal: AbortSignal): Promise<ApproximateArea> {
    signal.throwIfAborted();
    if (cached && cached.expires > Date.now()) return cached.area;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const deadline = setTimeout(abort, 8000);
    try {
      // This must run in the visitor's browser, so the estimate uses their
      // connection's public IP rather than the website server's IP.
      const response = await fetcher(endpoint, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Area estimate unavailable');
      const area = parseApproximateArea(await response.json());
      controller.signal.throwIfAborted();
      cached = { area, expires: Date.now() + cacheDuration };
      return area;
    } finally {
      clearTimeout(deadline);
      signal.removeEventListener('abort', abort);
    }
  };
}

export const getApproximateArea = createApproximateAreaLookup();
