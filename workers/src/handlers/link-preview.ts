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
    const ipv6 = hostname.slice(1, -1);
    // Basic IPv6 validation - more thorough check would be done by private range patterns
    if (!ipv6.includes(':')) {
      logger.warn('Invalid IPv6 address', { url: urlString, hostname });
      throw new ValidationError('Invalid IPv6 address');
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

// POST /api/link-preview - Extract metadata from URL
linkPreviewRouter.post('/', async (c) => {
  const logger = c.get('logger') as Logger;

  try {
    const body = await c.req.json();
    const request = LinkPreviewRequestSchema.parse(body);

    logger.info('Link preview request received', { url: request.url });

    // Step 1: Validate URL and check for SSRF
    const validatedUrl = validateUrl(request.url, logger);

    // TODO: Implement next steps (HTML fetching, metadata extraction)
    // For now, return a placeholder response
    const response: LinkPreviewResponse = {
      url: request.url,
      title: 'Link Preview (Coming Soon)',
      description: 'URL validation completed successfully',
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
