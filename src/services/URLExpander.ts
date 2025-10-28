import type { IService } from './base/IService';

/**
 * URL expansion result
 */
export interface ExpansionResult {
  originalUrl: string;
  expandedUrl: string;
  hops: number;
  cached: boolean;
}

/**
 * URL expansion options
 */
export interface ExpansionOptions {
  maxHops?: number;
  timeout?: number;
  followMetaRefresh?: boolean;
}

/**
 * Cache entry for expanded URLs
 */
interface CacheEntry {
  expandedUrl: string;
  timestamp: Date;
}

/**
 * Known URL shortener domains
 */
const SHORTENER_DOMAINS = new Set([
  't.co',
  'bit.ly',
  'bitly.com',
  'tinyurl.com',
  'ow.ly',
  'buff.ly',
  'short.link',
  'rebrand.ly',
  'is.gd',
  'v.gd',
  'goo.gl',
  'x.co',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'lnkd.in',
  'fb.me',
  'youtu.be',
]);

/**
 * URLExpander - Expands shortened URLs by following redirects
 *
 * Single Responsibility: URL expansion and redirect following
 */
export class URLExpander implements IService {
  private cache: Map<string, CacheEntry>;
  private maxHops: number;
  private timeout: number;
  private cacheTTL: number;
  private followMetaRefresh: boolean;

  constructor(options: ExpansionOptions = {}) {
    this.cache = new Map();
    this.maxHops = options.maxHops ?? 3;
    this.timeout = options.timeout ?? 5000;
    this.followMetaRefresh = options.followMetaRefresh ?? true;
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  async initialize(): Promise<void> {
    // No async initialization needed
  }

  async dispose(): Promise<void> {
    // Clear cache
    this.cache.clear();
  }

  /**
   * Expand a shortened URL
   * Returns the original URL if expansion fails
   */
  async expandUrl(url: string): Promise<string> {
    try {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);

      // Check if URL is from a known shortener
      if (!this.isShortener(normalizedUrl)) {
        return normalizedUrl;
      }

      // Check cache
      const cached = this.getCached(normalizedUrl);
      if (cached) {
        return cached;
      }

      // Expand URL
      const expanded = await this.followRedirects(normalizedUrl);

      // Cache result
      this.setCached(normalizedUrl, expanded);

      return expanded;
    } catch (error) {
      // If expansion fails, return original URL
      console.error('[URLExpander] Failed to expand URL:', error);
      return url;
    }
  }

  /**
   * Expand URL with detailed result
   */
  async expandWithDetails(url: string): Promise<ExpansionResult> {
    const originalUrl = url;
    const normalizedUrl = this.normalizeUrl(url);

    // Check cache first
    const cached = this.getCached(normalizedUrl);
    if (cached) {
      return {
        originalUrl,
        expandedUrl: cached,
        hops: 0,
        cached: true,
      };
    }

    // Check if shortener
    if (!this.isShortener(normalizedUrl)) {
      return {
        originalUrl,
        expandedUrl: normalizedUrl,
        hops: 0,
        cached: false,
      };
    }

    // Expand
    try {
      let hops = 0;
      const expanded = await this.followRedirects(normalizedUrl, (hop) => {
        hops = hop;
      });

      this.setCached(normalizedUrl, expanded);

      return {
        originalUrl,
        expandedUrl: expanded,
        hops,
        cached: false,
      };
    } catch (error) {
      return {
        originalUrl,
        expandedUrl: normalizedUrl,
        hops: 0,
        cached: false,
      };
    }
  }

  /**
   * Check if URL is from a known shortener
   */
  isShortener(url: string): boolean {
    try {
      const urlObj = new URL(this.normalizeUrl(url));
      const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      return SHORTENER_DOMAINS.has(hostname);
    } catch {
      return false;
    }
  }

  /**
   * Follow redirects up to max hops
   */
  private async followRedirects(
    url: string,
    onHop?: (hop: number) => void
  ): Promise<string> {
    let currentUrl = url;
    let hops = 0;

    while (hops < this.maxHops) {
      const nextUrl = await this.fetchRedirect(currentUrl);

      if (!nextUrl || nextUrl === currentUrl) {
        // No more redirects
        break;
      }

      currentUrl = nextUrl;
      hops++;
      onHop?.(hops);

      // Check if we've reached a non-shortener URL
      if (!this.isShortener(currentUrl)) {
        break;
      }
    }

    return currentUrl;
  }

  /**
   * Fetch a single redirect
   */
  private async fetchRedirect(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD to avoid downloading content
        redirect: 'manual', // Handle redirects manually
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for HTTP redirects
      if (this.isRedirectStatus(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          return this.resolveUrl(url, location);
        }
      }

      // If HEAD didn't work, try GET with meta refresh check
      if (this.followMetaRefresh && response.status === 200) {
        return await this.checkMetaRefresh(url);
      }

      // No redirect found
      return null;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('URL expansion timeout');
      }

      // Try with GET if HEAD failed
      try {
        return await this.fetchRedirectWithGet(url);
      } catch {
        throw error;
      }
    }
  }

  /**
   * Fetch redirect using GET method
   */
  private async fetchRedirectWithGet(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (this.isRedirectStatus(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          return this.resolveUrl(url, location);
        }
      }

      // Check for meta refresh
      if (this.followMetaRefresh && response.status === 200) {
        const html = await response.text();
        return this.extractMetaRefresh(html, url);
      }

      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check for meta refresh redirect in HTML
   */
  private async checkMetaRefresh(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        return this.extractMetaRefresh(html, url);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract meta refresh URL from HTML
   */
  private extractMetaRefresh(html: string, baseUrl: string): string | null {
    // Match: <meta http-equiv="refresh" content="0;url=http://example.com">
    const metaRefreshPattern = /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);?\s*url=([^"']+)["'][^>]*>/i;
    const match = html.match(metaRefreshPattern);

    if (match && match[2]) {
      return this.resolveUrl(baseUrl, match[2]);
    }

    // Alternative pattern: content comes before http-equiv
    const altPattern = /<meta[^>]*content=["'](\d+);?\s*url=([^"']+)["'][^>]*http-equiv=["']refresh["'][^>]*>/i;
    const altMatch = html.match(altPattern);

    if (altMatch && altMatch[2]) {
      return this.resolveUrl(baseUrl, altMatch[2]);
    }

    return null;
  }

  /**
   * Check if status code is a redirect
   */
  private isRedirectStatus(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }

  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
      // If relative URL is already absolute, return it
      if (relativeUrl.match(/^https?:\/\//i)) {
        return relativeUrl;
      }

      // Resolve relative to base
      const base = new URL(baseUrl);
      const resolved = new URL(relativeUrl, base);
      return resolved.href;
    } catch {
      // If resolution fails, try to return relative URL as-is
      return relativeUrl;
    }
  }

  /**
   * Normalize URL
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim();

    // Add protocol if missing
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }

    return normalized;
  }

  /**
   * Get cached expanded URL
   */
  private getCached(url: string): string | null {
    const entry = this.cache.get(url);

    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - entry.timestamp.getTime();
    if (age > this.cacheTTL) {
      this.cache.delete(url);
      return null;
    }

    return entry.expandedUrl;
  }

  /**
   * Cache expanded URL
   */
  private setCached(url: string, expandedUrl: string): void {
    this.cache.set(url, {
      expandedUrl,
      timestamp: new Date(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    urls: string[];
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entries = Array.from(this.cache.entries());

    return {
      size: entries.length,
      urls: entries.map(([url]) => url),
      oldestEntry: entries.length > 0
        ? entries.reduce((oldest, [, entry]) =>
            entry.timestamp < oldest ? entry.timestamp : oldest,
            entries[0]![1].timestamp
          )
        : undefined,
      newestEntry: entries.length > 0
        ? entries.reduce((newest, [, entry]) =>
            entry.timestamp > newest ? entry.timestamp : newest,
            entries[0]![1].timestamp
          )
        : undefined,
    };
  }

  /**
   * Get list of supported shortener domains
   */
  getSupportedShorteners(): string[] {
    return Array.from(SHORTENER_DOMAINS);
  }
}
