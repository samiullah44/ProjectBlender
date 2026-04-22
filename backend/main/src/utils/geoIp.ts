// backend/src/utils/geoIp.ts
// Primary: ip-api.com (free, HTTP only, < 45 req/min)
// Fallback: ipapi.co (free tier, HTTPS, 1000 req/day)

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

const isPrivateIp = (ip: string): boolean => {
  const clean = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return (
    localIps.has(clean) ||
    clean.startsWith('192.168.') ||
    clean.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean)
  );
};

const fetchWithTimeout = async (url: string, ms: number, options: any = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveGeoFromIp = async (ip: string): Promise<GeoData | null> => {
  // Strip IPv4-mapped IPv6 prefix (e.g. "::ffff:1.2.3.4" → "1.2.3.4")
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (isPrivateIp(cleanIp)) {
    return {
      country:     'Development Env',
      countryCode: 'DEV',
      region:      'Local',
      city:        'localhost',
      timezone:    'UTC',
      isp:         'Local Network'
    };
  }

  const headers = {
    'User-Agent': 'RenderOnNodes-Analytics-Engine/1.0',
    'Accept': 'application/json'
  };

  // ── Primary: ip-api.com (HTTP, free, fast) ──────────────────
  try {
    const res = await fetchWithTimeout(
      `http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,region,city,lat,lon,timezone,isp`,
      4000,
      { headers }
    );
    const data = await res.json() as any;
    if (data.status === 'success') {
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
    }
    console.warn(`[GeoIP] ip-api.com status: ${data.status} for IP: ${cleanIp}`, data.message || '');
  } catch (err: any) {
    console.error(`[GeoIP] ip-api.com failed: ${err.message} for IP: ${cleanIp}`);
  }

  // ── Fallback: ipapi.co (HTTPS, free tier 1000/day) ──────────
  try {
    const res = await fetchWithTimeout(
      `https://ipapi.co/${cleanIp}/json/`,
      4000,
      { headers }
    );
    const data = await res.json() as any;
    if (data && data.country_name && !data.error) {
      return {
        country:     data.country_name,
        countryCode: data.country_code,
        region:      data.region,
        city:        data.city,
        lat:         data.latitude,
        lon:         data.longitude,
        timezone:    data.timezone,
        isp:         data.org,
      };
    }
    console.warn(`[GeoIP] ipapi.co error: ${data.error || data.reason || 'No country data'} for IP: ${cleanIp}`);
  } catch (err: any) {
    console.error(`[GeoIP] ipapi.co failed: ${err.message} for IP: ${cleanIp}`);
  }

  return null;
};
