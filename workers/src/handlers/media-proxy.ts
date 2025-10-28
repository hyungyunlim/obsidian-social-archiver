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
      'tiktok.com',        // TikTok video CDN (v16-webapp-prime.tiktok.com, etc)
      'tiktokcdn.com',     // TikTok static CDN
      'licdn.com',
      'threads.com',       // Threads (Meta)
    ];

    const isAllowed = allowedDomains.some(domain => url.hostname.includes(domain));
    if (!isAllowed) {
      logger.warn('❌ Blocked unauthorized domain', { hostname: url.hostname });
      return c.json({ error: 'Unauthorized domain' }, 403);
    }

    // Build headers based on platform
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    // TikTok requires specific headers to bypass 403
    if (url.hostname.includes('tiktok.com') || url.hostname.includes('tiktokcdn.com')) {
      headers['Referer'] = 'https://www.tiktok.com/';
      headers['Origin'] = 'https://www.tiktok.com';
      headers['Accept'] = 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5';
      headers['Accept-Language'] = 'en-US,en;q=0.9';
      headers['Accept-Encoding'] = 'identity;q=1, *;q=0';
      headers['Sec-Fetch-Dest'] = 'video';
      headers['Sec-Fetch-Mode'] = 'no-cors';
      headers['Sec-Fetch-Site'] = 'same-site';
      headers['Range'] = 'bytes=0-'; // Support partial content

      logger.info('🎯 TikTok headers', {
        hostname: url.hostname,
        hasExpire: url.searchParams.has('expire'),
        expireValue: url.searchParams.get('expire'),
      });
    } else {
      // Images for other platforms
      headers['Accept'] = 'image/webp,image/apng,image/*,*/*;q=0.8';
    }

    // Fetch media from CDN (server-side, no CORS)
    const response = await fetch(mediaUrl, {
      headers,
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
