/**
 * Generates a URL-safe slug from a title string.
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Strips non-alphanumeric characters (except hyphens)
 * - Collapses consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
