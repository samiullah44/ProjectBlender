/**
 * Utility for handling cross-subdomain cookies for session synchronization.
 */

const AUTH_TOKEN_KEY = 'auth_token';

/**
 * Sets a cookie that is shared across all subdomains.
 */
export const setSharedToken = (token: string, days: number = 7) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const isProd = window.location.hostname.includes('renderonnodes.com');
    const domain = isProd ? '; domain=.renderonnodes.com' : '';
    
    document.cookie = `${AUTH_TOKEN_KEY}=${token}; expires=${expires}; path=/; SameSite=Lax${domain}${isProd ? '; Secure' : ''}`;
};

/**
 * Retrieves the shared token from cookies.
 */
export const getSharedToken = (): string | null => {
    const name = `${AUTH_TOKEN_KEY}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
};

/**
 * Removes the shared token from cookies across all subdomains.
 */
export const removeSharedToken = () => {
    const isProd = window.location.hostname.includes('renderonnodes.com');
    const domain = isProd ? '; domain=.renderonnodes.com' : '';
    
    document.cookie = `${AUTH_TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${domain}${isProd ? '; Secure' : ''}`;
};
