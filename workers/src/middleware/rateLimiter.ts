import type { MiddlewareHandler } from 'hono';
import type { Env } from '@/types/bindings';
import { RateLimitError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
  keyPrefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  window: 60,
  keyPrefix: 'rate_limit'
};

export const rateLimiter = (config: Partial<RateLimitConfig> = {}): MiddlewareHandler<Env> => {
  const { limit, window, keyPrefix } = { ...DEFAULT_CONFIG, ...config };
  
  return async (c, next) => {
    const logger = c.get('logger') as Logger || Logger.fromContext(c);
    const clientId = getClientId(c);
    const key = `${keyPrefix}:${clientId}`;
    const now = Math.floor(Date.now() / 1000);
    
    logger.debug('Rate limit check', { clientId, key });
    
    try {
      // Get current count from KV
      const data = await c.env.ARCHIVE_CACHE.get(key, 'json') as { count: number; resetAt: number } | null;
      
      let count = 0;
      let resetAt = now + window;
      
      if (data && data.resetAt > now) {
        // Window hasn't expired
        count = data.count;
        resetAt = data.resetAt;
      } else {
        // New window
        count = 0;
        resetAt = now + window;
      }
      
      if (count >= limit) {
        // Rate limit exceeded
        const retryAfter = resetAt - now;
        
        c.header('X-RateLimit-Limit', limit.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', resetAt.toString());
        c.header('Retry-After', retryAfter.toString());
        
        logger.warn('Rate limit exceeded', { 
          clientId, 
          count, 
          limit, 
          retryAfter 
        });
        
        throw new RateLimitError(retryAfter);
      }
      
      // Increment counter
      count++;
      await c.env.ARCHIVE_CACHE.put(
        key,
        JSON.stringify({ count, resetAt }),
        { expirationTtl: window }
      );
      
      // Add rate limit headers
      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', (limit - count).toString());
      c.header('X-RateLimit-Reset', resetAt.toString());
      
      await next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow request to proceed
      await next();
    }
  };
};

function getClientId(c: any): string {
  // Try to get client ID from various sources
  const apiKey = c.req.header('X-API-Key');
  if (apiKey) return `api:${apiKey}`;
  
  const licenseKey = c.req.header('X-License-Key');
  if (licenseKey) return `license:${licenseKey}`;
  
  // Fallback to IP address
  const ip = c.req.header('CF-Connecting-IP') || 
             c.req.header('X-Forwarded-For') || 
             'unknown';
  
  return `ip:${ip}`;
}