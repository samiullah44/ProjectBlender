// backend/src/utils/deviceDetect.ts
// Lightweight user-agent parsing without heavy dependencies

interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os?: string;
  browser?: string;
  userAgent?: string;
  language?: string;
}

export const detectDevice = (ua: string): DeviceInfo => {
  const info: DeviceInfo = { type: 'unknown', userAgent: ua };

  if (!ua) return info;

  // Device type
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    info.type = 'tablet';
  } else if (/mobi|android|touch|mini|blackberry|iphone|ipod|opera mini|webos/i.test(ua)) {
    info.type = 'mobile';
  } else {
    info.type = 'desktop';
  }

  // OS
  if (/windows/i.test(ua))          info.os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) info.os = 'macOS';
  else if (/linux/i.test(ua))       info.os = 'Linux';
  else if (/android/i.test(ua))     info.os = 'Android';
  else if (/ios|iphone|ipad/i.test(ua)) info.os = 'iOS';

  // Browser
  if (/edg\//i.test(ua))            info.browser = 'Edge';
  else if (/chrome/i.test(ua))      info.browser = 'Chrome';
  else if (/firefox/i.test(ua))     info.browser = 'Firefox';
  else if (/safari/i.test(ua))      info.browser = 'Safari';
  else if (/opera|opr\//i.test(ua)) info.browser = 'Opera';
  else if (/msie|trident/i.test(ua)) info.browser = 'IE';

  return info;
};
