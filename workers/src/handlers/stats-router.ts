/**
 * Stats Router
 * Routes for download time statistics collection
 */

import { Hono } from 'hono';
import type { Env } from '@/types/bindings';
import { handleStatsSubmit, handleStatsGet } from './stats';

export const statsRouter = new Hono<Env>();

// POST /api/stats/download-time - Submit download time stats
statsRouter.post('/download-time', handleStatsSubmit);

// GET /api/stats/download-time - Get average download times
statsRouter.get('/download-time', handleStatsGet);
