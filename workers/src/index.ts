import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import type { Env } from './types/bindings';
import { 
  errorHandler, 
  requestIdMiddleware, 
  loggingMiddleware 
} from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { archiveRouter } from './handlers/archive';
import { shareRouter } from './handlers/share';
import { publicShareRouter } from './handlers/public-share';
import { licenseRouter } from './handlers/license';
import { healthRouter } from './handlers/health';
import { webhookRouter } from './handlers/webhook';
import { mediaProxyRouter } from './handlers/media-proxy-router';
import { statsRouter } from './handlers/stats-router';
import { uploadMediaRouter } from './handlers/upload-media';
import { userPostsRouter } from './handlers/user-posts';
import { linkPreviewRouter } from './handlers/link-preview';

const app = new Hono<Env>();

// Global middleware
app.use('*', requestIdMiddleware);
app.use('*', timing());
app.use('*', loggingMiddleware);

// CORS configuration for Obsidian and Share Web
app.use('*', cors({
  origin: [
    'app://obsidian.md',
    'obsidian://',
    'capacitor://localhost',
    'http://localhost',
    'http://localhost:*',
    'https://localhost',
    'https://localhost:*',
    'https://social-archive.junlim.org',  // Share Web frontend
    'https://obsidian-social-archiver.pages.dev'  // Cloudflare Pages preview
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-License-Key'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
  credentials: true
}));

// Rate limiting (DDoS protection)
app.use('/api/*', rateLimiter());

// Error handling
app.onError(errorHandler);

// Health check
app.route('/', healthRouter);

// API routes
app.route('/api/archive', archiveRouter);
app.route('/api/share', shareRouter);
app.route('/api/upload-share-media', uploadMediaRouter);
app.route('/api/license', licenseRouter);
app.route('/api/proxy-media', mediaProxyRouter);
app.route('/api/stats', statsRouter);
app.route('/api/users', userPostsRouter);
app.route('/api/link-preview', linkPreviewRouter);

// Public share pages (no rate limiting, no CORS)
app.route('/share', publicShareRouter);

// Public media serving (no rate limiting, no CORS)
app.route('/media', uploadMediaRouter);

// Webhook routes (no rate limiting for webhooks)
app.route('/webhook', webhookRouter);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  }, 404);
});

export default app;