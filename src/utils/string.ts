/**
 * String utilities
 */

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str;
}

export function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '-');
}
