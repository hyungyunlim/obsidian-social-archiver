/**
 * Media Proxy Router
 */

import { Hono } from 'hono';
import type { Env } from '@/types/bindings';
import { handleMediaProxy, handleMediaProxyOptions } from './media-proxy';

export const mediaProxyRouter = new Hono<Env>();

// GET /api/proxy-media?url=<encoded-url>
mediaProxyRouter.get('/', handleMediaProxy);

// OPTIONS for CORS preflight
mediaProxyRouter.options('/', handleMediaProxyOptions);
