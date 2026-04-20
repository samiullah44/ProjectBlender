// backend/src/utils/deviceDetect.ts
// Lightweight user-agent parsing without heavy dependencies

interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  userAgent?: string;
  language?: string;
}

export const detectDevice = (ua: string): DeviceInfo => {
  if (!ua) {
    return { type: 'unknown', os: 'Unknown', browser: 'Unknown', userAgent: ua };
  }

  // ── Device Type ──────────────────────────────────────────────
  let type: DeviceInfo['type'] = 'desktop';
  if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    type = 'tablet';
  } else if (/mobi|android|touch|mini|blackberry|iphone|ipod|opera mini|webos|windows phone/i.test(ua)) {
    type = 'mobile';
  }

  // ── OS Detection ─────────────────────────────────────────────
  // Order matters: more specific must come before generic
  let os = 'Unknown';
  if (/windows phone/i.test(ua))              os = 'Windows Phone';
  else if (/windows/i.test(ua))              os = 'Windows';
  else if (/cros/i.test(ua))                 os = 'ChromeOS';
  else if (/iphone/i.test(ua))               os = 'iOS';
  else if (/ipad/i.test(ua))                 os = 'iPadOS';
  else if (/macintosh|mac os/i.test(ua))     os = 'macOS';
  else if (/android/i.test(ua))              os = 'Android';
  else if (/linux/i.test(ua))                os = 'Linux';
  else if (/blackberry/i.test(ua))           os = 'BlackBerry';

  // ── Browser Detection ────────────────────────────────────────
  // Order matters: Edge/Brave/Samsung must be checked before Chrome/Safari
  let browser = 'Unknown';
  if (/edg\//i.test(ua))                     browser = 'Edge';
  else if (/brave/i.test(ua))                browser = 'Brave';
  else if (/samsungbrowser/i.test(ua))       browser = 'Samsung Browser';
  else if (/opr\/|opera/i.test(ua))          browser = 'Opera';
  else if (/msie|trident/i.test(ua))         browser = 'Internet Explorer';
  else if (/firefox|fxios/i.test(ua))        browser = 'Firefox';
  else if (/chrome|crios/i.test(ua))         browser = 'Chrome';
  else if (/safari/i.test(ua))               browser = 'Safari';
  else if (/curl|wget|postman|insomnia/i.test(ua)) browser = 'Bot/Tool';

  return { type, os, browser, userAgent: ua };
};
