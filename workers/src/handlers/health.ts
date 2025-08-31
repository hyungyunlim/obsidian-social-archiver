import { Hono } from 'hono';
import type { Env } from '@/types/bindings';

export const healthRouter = new Hono<Env>();

healthRouter.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

healthRouter.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString()
    }
  });
});

healthRouter.get('/ready', async (c) => {
  try {
    // Check KV namespaces are accessible
    const checks = await Promise.allSettled([
      c.env.ARCHIVE_CACHE.get('health_check'),
      c.env.LICENSE_KEYS.get('health_check'),
      c.env.SHARE_LINKS.get('health_check')
    ]);
    
    const allHealthy = checks.every(result => result.status === 'fulfilled');
    
    if (!allHealthy) {
      return c.json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Some services are not ready'
        }
      }, 503);
    }
    
    return c.json({
      success: true,
      data: {
        status: 'ready',
        services: {
          archiveCache: 'ready',
          licenseKeys: 'ready',
          shareLinks: 'ready'
        }
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Health check failed'
      }
    }, 503);
  }
});