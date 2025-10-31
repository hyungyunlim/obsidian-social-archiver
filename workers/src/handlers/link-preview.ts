import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { ValidationError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

export const linkPreviewRouter = new Hono<Env>();

// Cache configuration constants
export const CACHE_CONFIG = {
  TTL: 604800, // 7 days in seconds
  KEY_PREFIX: 'preview:',
  MAX_KEY_LENGTH: 512, // KV key length limit
} as const;

// Request/Response schemas
export const LinkPreviewRequestSchema = z.object({
  url: z.string().url('Invalid URL format')
});

export type LinkPreviewRequest = z.infer<typeof LinkPreviewRequestSchema>;

export interface LinkPreviewResponse {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  error?: string;
}

export interface CachedLinkPreview extends LinkPreviewResponse {
  cachedAt: number;
  expiresAt: number;
}

// SSRF Protection: Private IP ranges to block
const PRIVATE_IP_RANGES = [
  // IPv4 private ranges
  /^127\./,                    // 127.0.0.0/8 - Loopback
  /^10\./,                     // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 - Private
  /^192\.168\./,               // 192.168.0.0/16 - Private
  /^169\.254\./,               // 169.254.0.0/16 - Link-local
  /^0\./,                      // 0.0.0.0/8 - Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // 100.64.0.0/10 - Shared address space

  // IPv6 private ranges
  /^::1$/,                     // ::1/128 - Loopback
  /^fc00:/,                    // fc00::/7 - Unique local
  /^fe80:/,                    // fe80::/10 - Link-local
  /^ff00:/,                    // ff00::/8 - Multicast
];

// Reserved/dangerous hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',  // GCP metadata
  '169.254.169.254',            // AWS/Azure metadata
];

/**
 * Validate URL and check for SSRF vulnerabilities
 * @throws ValidationError if URL is invalid or contains SSRF risks
 */
export function validateUrl(urlString: string, logger: Logger): URL {
  logger.debug('Validating URL', { url: urlString });

  let url: URL;

  try {
    url = new URL(urlString);
  } catch (error) {
    logger.warn('Invalid URL format', { url: urlString, error });
    throw new ValidationError('Invalid URL format');
  }

  // Only allow HTTP/HTTPS schemes
  if (!['http:', 'https:'].includes(url.protocol)) {
    logger.warn('Invalid URL scheme', { url: urlString, protocol: url.protocol });
    throw new ValidationError(`Invalid URL scheme: ${url.protocol}. Only HTTP and HTTPS are allowed.`);
  }

  // Check for blocked hostnames
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    logger.warn('Blocked hostname detected', { url: urlString, hostname });
    throw new ValidationError('Access to this hostname is not allowed');
  }

  // Check for private IP ranges
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      logger.warn('Private IP range detected', { url: urlString, hostname });
      throw new ValidationError('Access to private IP addresses is not allowed');
    }
  }

  // Additional checks for IP-based URLs
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    // IPv4 - already checked above, but verify octets are valid
    const octets = hostname.split('.').map(Number);
    if (octets.some(octet => octet < 0 || octet > 255)) {
      logger.warn('Invalid IPv4 address', { url: urlString, hostname });
      throw new ValidationError('Invalid IP address');
    }
  }

  // Check for IPv6 addresses (enclosed in brackets in URL)
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();

    // Basic IPv6 validation
    if (!ipv6.includes(':')) {
      logger.warn('Invalid IPv6 address', { url: urlString, hostname });
      throw new ValidationError('Invalid IPv6 address');
    }

    // Check IPv6 private ranges
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(ipv6)) {
        logger.warn('Private IPv6 address detected', { url: urlString, hostname: ipv6 });
        throw new ValidationError('Access to private IP addresses is not allowed');
      }
    }
  }

  logger.info('URL validation passed', { url: urlString, hostname });
  return url;
}

/**
 * Resolve hostname and perform additional SSRF checks
 * Note: Cloudflare Workers don't have direct DNS resolution APIs,
 * so this is a placeholder for future implementation if needed
 */
async function checkHostnameResolution(hostname: string, logger: Logger): Promise<void> {
  // In Cloudflare Workers, we rely on Cloudflare's infrastructure
  // to handle DNS resolution. Additional checks could be:
  // 1. Use DNS-over-HTTPS API
  // 2. Implement allowlist for trusted domains
  // 3. Check DNSSEC validation

  // For now, we trust the URL validation above
  logger.debug('Hostname resolution check (placeholder)', { hostname });
}

/**
 * Normalize URL for consistent cache key generation
 * - Convert to lowercase hostname
 * - Remove trailing slashes
 * - Sort query parameters
 * - Remove common tracking parameters
 * - Remove fragment identifiers
 */
export function normalizeUrl(urlString: string, logger: Logger): string {
  logger.debug('Normalizing URL', { url: urlString });

  try {
    const url = new URL(urlString);

    // Normalize hostname to lowercase
    url.hostname = url.hostname.toLowerCase();

    // Remove www. prefix for consistency
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.substring(4);
    }

    // Remove fragment identifier
    url.hash = '';

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'ref', 'source'
    ];

    trackingParams.forEach(param => url.searchParams.delete(param));

    // Sort query parameters for consistency
    const sortedParams = new URLSearchParams(
      Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
    );
    url.search = sortedParams.toString();

    // Remove trailing slash from pathname (unless it's just "/")
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    const normalized = url.toString();
    logger.debug('URL normalized', { original: urlString, normalized });

    return normalized;
  } catch (error) {
    logger.warn('Failed to normalize URL, using original', {
      url: urlString,
      error: error instanceof Error ? error.message : String(error)
    });
    // Fallback to original URL if normalization fails
    return urlString;
  }
}

/**
 * Generate cache key for link preview
 * Format: preview:${normalizedUrl}
 * Handles key length limits by hashing long URLs
 */
export function generateCacheKey(urlString: string, logger: Logger): string {
  const normalizedUrl = normalizeUrl(urlString, logger);
  const key = `${CACHE_CONFIG.KEY_PREFIX}${normalizedUrl}`;

  // Check if key exceeds KV length limit
  if (key.length > CACHE_CONFIG.MAX_KEY_LENGTH) {
    // Hash the URL using simple hash function for shorter key
    const hash = simpleHash(normalizedUrl);
    const hashedKey = `${CACHE_CONFIG.KEY_PREFIX}hash:${hash}`;

    logger.debug('URL too long, using hashed key', {
      originalLength: key.length,
      hashedLength: hashedKey.length,
      url: urlString
    });

    return hashedKey;
  }

  logger.debug('Cache key generated', { key, url: urlString });
  return key;
}

/**
 * Simple hash function for URL to cache key conversion
 * Uses FNV-1a algorithm for fast, collision-resistant hashing
 */
function simpleHash(str: string): string {
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash *= 16777619; // FNV prime
    hash |= 0; // Convert to 32-bit integer
  }

  // Convert to positive hex string
  return (hash >>> 0).toString(16);
}

/**
 * Fetch HTML content with timeout, redirect handling, and security checks
 * @throws ValidationError if request fails or content is invalid
 */
export async function fetchHtml(url: string, logger: Logger, maxRedirects = 3): Promise<string> {
  const TIMEOUT_MS = 5000; // 5 seconds
  const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB limit
  const USER_AGENT = 'Mozilla/5.0 (compatible; SocialArchiver-LinkPreview/1.0; +https://social-archive.junlim.org)';

  let currentUrl = url;
  let redirectCount = 0;

  logger.debug('Starting HTML fetch', { url, maxRedirects });

  while (redirectCount <= maxRedirects) {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      logger.debug('Fetching URL', { currentUrl, redirectCount });

      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        redirect: 'manual', // Handle redirects manually to count them
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      logger.debug('Response received', {
        currentUrl,
        status: response.status,
        contentType: response.headers.get('content-type'),
      });

      // Handle redirects (3xx status codes)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');

        if (!location) {
          logger.warn('Redirect without Location header', { currentUrl, status: response.status });
          throw new ValidationError('Invalid redirect: missing Location header');
        }

        redirectCount++;

        if (redirectCount > maxRedirects) {
          logger.warn('Too many redirects', { url, redirectCount, maxRedirects });
          throw new ValidationError(`Too many redirects (max: ${maxRedirects})`);
        }

        // Resolve relative URLs
        currentUrl = new URL(location, currentUrl).toString();

        // Re-validate the redirect URL for SSRF
        validateUrl(currentUrl, logger);

        logger.info('Following redirect', { from: url, to: currentUrl, redirectCount });
        continue; // Continue to next iteration to fetch the redirect URL
      }

      // Handle error status codes
      if (!response.ok) {
        logger.warn('HTTP error response', { currentUrl, status: response.status });

        if (response.status === 404) {
          throw new ValidationError('Page not found (404)');
        } else if (response.status === 403) {
          throw new ValidationError('Access forbidden (403)');
        } else if (response.status === 401) {
          throw new ValidationError('Authentication required (401)');
        } else if (response.status >= 500) {
          throw new ValidationError(`Server error (${response.status})`);
        } else {
          throw new ValidationError(`HTTP error ${response.status}`);
        }
      }

      // Validate content type
      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html') ||
                     contentType.includes('application/xhtml+xml') ||
                     contentType.includes('application/xml');

      if (!isHtml) {
        logger.warn('Non-HTML content type', { currentUrl, contentType });
        throw new ValidationError(`Invalid content type: ${contentType}. Expected HTML.`);
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
        logger.warn('Content too large', { currentUrl, contentLength });
        throw new ValidationError(`Content too large (max: ${MAX_CONTENT_LENGTH} bytes)`);
      }

      // Read response body
      const html = await response.text();

      // Additional size check after reading
      if (html.length > MAX_CONTENT_LENGTH) {
        logger.warn('Content too large after reading', { currentUrl, size: html.length });
        throw new ValidationError(`Content too large (max: ${MAX_CONTENT_LENGTH} bytes)`);
      }

      logger.info('HTML fetched successfully', {
        url: currentUrl,
        size: html.length,
        redirects: redirectCount,
      });

      return html;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Request timeout', { currentUrl, timeout: TIMEOUT_MS });
        throw new ValidationError(`Request timeout after ${TIMEOUT_MS}ms`);
      }

      // Handle network errors
      logger.error('Network error during fetch', {
        currentUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ValidationError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Should never reach here, but just in case
  throw new ValidationError('Unexpected error during HTML fetch');
}

/**
 * Extract metadata from HTML using priority system:
 * 1. Open Graph tags (og:*)
 * 2. Twitter Cards (twitter:*)
 * 3. Standard meta tags (description, etc.)
 * 4. HTML title tag
 * 5. Fallback to URL
 */
export function extractMetadata(html: string, url: string, logger: Logger): LinkPreviewResponse {
  logger.debug('Starting metadata extraction', { url, htmlLength: html.length });

  // Simple HTML parser - extract meta tags and title
  const metadata: LinkPreviewResponse = {
    url,
    title: '',
  };

  // Extract Open Graph tags (priority 1)
  const ogTitle = extractMetaTag(html, 'property', 'og:title');
  const ogDescription = extractMetaTag(html, 'property', 'og:description');
  const ogImage = extractMetaTag(html, 'property', 'og:image');
  const ogSiteName = extractMetaTag(html, 'property', 'og:site_name');

  // Extract Twitter Card tags (priority 2)
  const twitterTitle = extractMetaTag(html, 'name', 'twitter:title');
  const twitterDescription = extractMetaTag(html, 'name', 'twitter:description');
  const twitterImage = extractMetaTag(html, 'name', 'twitter:image');

  // Extract standard meta tags (priority 3)
  const metaDescription = extractMetaTag(html, 'name', 'description');

  // Extract HTML title tag (priority 4)
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const htmlTitle = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : '';

  // Apply priority system for title
  metadata.title = ogTitle || twitterTitle || htmlTitle || extractDomainFromUrl(url);

  // Apply priority system for description
  metadata.description = ogDescription || twitterDescription || metaDescription;

  // Apply priority system for image
  metadata.image = resolveImageUrl(ogImage || twitterImage, url);

  // Site name
  metadata.siteName = ogSiteName || extractDomainFromUrl(url);

  // Favicon
  metadata.favicon = extractFavicon(html, url);

  logger.info('Metadata extracted', {
    url,
    hasTitle: !!metadata.title,
    hasDescription: !!metadata.description,
    hasImage: !!metadata.image,
    hasSiteName: !!metadata.siteName,
    hasFavicon: !!metadata.favicon,
  });

  return metadata;
}

/**
 * Extract meta tag content by attribute and value
 */
function extractMetaTag(html: string, attributeName: string, attributeValue: string): string | undefined {
  // Match <meta property="og:title" content="..." /> or <meta name="description" content="..." />
  const regex = new RegExp(
    `<meta\\s+[^>]*${attributeName}=["']${escapeRegex(attributeValue)}["'][^>]*content=["']([^"']+)["'][^>]*>|` +
    `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${attributeName}=["']${escapeRegex(attributeValue)}["'][^>]*>`,
    'i'
  );

  const match = html.match(regex);
  if (match) {
    const content = match[1] || match[2];
    return content ? decodeHtmlEntities(content.trim()) : undefined;
  }

  return undefined;
}

/**
 * Extract favicon URL from HTML
 */
function extractFavicon(html: string, baseUrl: string): string | undefined {
  // Try to find <link rel="icon" href="..." />
  const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
                    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["'][^>]*>/i);

  if (iconMatch) {
    return resolveImageUrl(iconMatch[1], baseUrl);
  }

  // Fallback to /favicon.ico
  const parsedUrl = new URL(baseUrl);
  return `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`;
}

/**
 * Resolve relative image URLs to absolute
 */
function resolveImageUrl(imageUrl: string | undefined, baseUrl: string): string | undefined {
  if (!imageUrl) return undefined;

  try {
    // If already absolute, return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    // Resolve relative URL
    const resolved = new URL(imageUrl, baseUrl);
    return resolved.toString();
  } catch (error) {
    // Invalid URL, return undefined
    return undefined;
  }
}

/**
 * Extract domain name from URL for fallback site name
 */
function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (error) {
    return url;
  }
}

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// POST /api/link-preview - Extract metadata from URL
linkPreviewRouter.post('/', async (c) => {
  const logger = c.get('logger') as Logger;

  try {
    const body = await c.req.json();
    const request = LinkPreviewRequestSchema.parse(body);

    logger.info('Link preview request received', { url: request.url });

    // Step 1: Validate URL and check for SSRF
    const validatedUrl = validateUrl(request.url, logger);

    // Step 2: Fetch HTML content with timeout and redirect handling
    const html = await fetchHtml(validatedUrl.toString(), logger);

    // Step 3: Extract metadata from HTML
    const metadata = extractMetadata(html, validatedUrl.toString(), logger);

    return c.json({
      success: true,
      data: metadata
    }, 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request data', { errors: error.errors });
      throw new ValidationError('Invalid request data', error.errors);
    }
    throw error;
  }
});

// GET /api/link-preview/health - Health check for link preview service
linkPreviewRouter.get('/health', async (c) => {
  return c.json({
    success: true,
    data: {
      service: 'link-preview',
      status: 'operational',
      timestamp: Date.now()
    }
  });
});
