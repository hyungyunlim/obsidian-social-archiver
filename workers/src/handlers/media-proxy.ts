/**
 * Media Proxy Handler
 *
 * Proxies media downloads to bypass CORS restrictions
 * Instagram/Facebook CDN blocks direct browser requests
 */

import { Context } from 'hono';
import { Logger } from '@/utils/logger';
import type { Bindings } from '@/types/bindings';

/**
 * Proxy media download request
 * GET /api/proxy-media?url=<encoded-url>
 */
export async function handleMediaProxy(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const logger = Logger.fromContext(c);

  try {
    // Get media URL from query parameter
    const mediaUrl = c.req.query('url');

    if (!mediaUrl) {
      return c.json({ error: 'Missing url parameter' }, 400);
    }

    logger.info('🖼️ Proxying media download', {
      url: mediaUrl.substring(0, 100) + '...',
    });

    // Validate URL
    let url: URL;
    try {
      url = new URL(mediaUrl);
    } catch {
      return c.json({ error: 'Invalid URL' }, 400);
    }

    // Security: Only allow specific CDN domains
    const allowedDomains = [
      'cdninstagram.com',
      'fbcdn.net',
      'twimg.com',
      'tiktokcdn.com',
      'licdn.com',
      'threads.net',
    ];

    const isAllowed = allowedDomains.some(domain => url.hostname.includes(domain));
    if (!isAllowed) {
      logger.warn('❌ Blocked unauthorized domain', { hostname: url.hostname });
      return c.json({ error: 'Unauthorized domain' }, 403);
    }

    // Fetch media from CDN (server-side, no CORS)
    const response = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      cf: {
        // Cloudflare-specific options
        cacheTtl: 86400, // Cache for 24 hours
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      logger.error('❌ Failed to fetch media', {
        status: response.status,
        statusText: response.statusText,
      });
      return c.json({
        error: `Failed to fetch media: ${response.status} ${response.statusText}`
      }, response.status);
    }

    // Get content type and size
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const contentLength = response.headers.get('Content-Length');

    logger.info('✅ Media proxied successfully', {
      size: contentLength ? `${contentLength} bytes` : 'unknown',
      contentType,
    });

    // Stream the response directly (more efficient, no CPU time issues)
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || '',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });

  } catch (error) {
    logger.error('Media proxy error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export function handleMediaProxyOptions(c: Context): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
