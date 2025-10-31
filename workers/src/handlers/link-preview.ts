import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { ValidationError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

export const linkPreviewRouter = new Hono<Env>();

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

    // TODO: Step 3: Extract metadata from HTML
    // For now, return a placeholder response
    const response: LinkPreviewResponse = {
      url: request.url,
      title: 'Link Preview (HTML Fetched)',
      description: `Successfully fetched ${html.length} bytes of HTML`,
    };

    return c.json({
      success: true,
      data: response
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
