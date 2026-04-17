// backend/src/utils/geoIp.ts
// Uses ip-api.com (free, no API key needed for < 45 req/min)
// For production use, swap for MaxMind GeoLite2 (offline, GDPR-safe)

interface GeoData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
}

const localIps = new Set(['127.0.0.1', '::1', '0.0.0.0', 'localhost']);

export const resolveGeoFromIp = async (ip: string): Promise<GeoData | null> => {
  if (localIps.has(ip) || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Development Env', countryCode: 'DEV', city: 'Localhost' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,lat,lon,timezone,isp`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    
    const data = await response.json() as any;
    if (data.status !== 'success') return null;
    
    return {
      country:     data.country,
      countryCode: data.countryCode,
      region:      data.region,
      city:        data.city,
      lat:         data.lat,
      lon:         data.lon,
      timezone:    data.timezone,
      isp:         data.isp,
    };
  } catch {
    return null;
  }
};
