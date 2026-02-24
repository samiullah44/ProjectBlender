/**
 * Normalizes a Blender version string (X.Y.Z) to its base minor version (X.Y.0).
 * This ensures that nodes only need to download and cache one version per minor series.
 * 
 * @param version The Blender version string to normalize (e.g., "4.0.1", "3.3.15")
 * @returns The normalized version string (e.g., "4.0.0", "3.3.0")
 */
export const normalizeBlenderVersion = (version: string): string => {
    if (!version) return '4.5.0';

    // Handle cases like "4.5" -> "4.5.0"
    const parts = version.split('.');
    if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
        return `${parts[0]}.${parts[1]}.0`;
    }

    // Fallback for single numbers or weird strings
    if (parts.length === 1 && parts[0] !== undefined && /^\d+$/.test(parts[0])) {
        return `${parts[0]}.0.0`;
    }

    return version;
};
