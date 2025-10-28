/**
 * Stats Collection Handler
 *
 * Collects anonymous download time statistics to provide users
 * with average download time estimates per platform
 */

import { Context } from 'hono';
import { Logger } from '@/utils/logger';
import type { Bindings } from '@/types/bindings';

export interface DownloadTimeStats {
  platform: 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads';
  downloadTime: number; // in seconds
  timestamp: number;
}

/**
 * Submit download time statistics (anonymous)
 * POST /api/stats/download-time
 */
export async function handleStatsSubmit(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const logger = Logger.fromContext(c);

  try {
    // Parse request body
    const body = await c.req.json<DownloadTimeStats>();

    // Validate data
    if (!body.platform || !body.downloadTime) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const validPlatforms = ['facebook', 'linkedin', 'instagram', 'tiktok', 'x', 'threads'];
    if (!validPlatforms.includes(body.platform)) {
      return c.json({ error: 'Invalid platform' }, 400);
    }

    if (body.downloadTime <= 0 || body.downloadTime > 3600) {
      return c.json({ error: 'Invalid download time' }, 400);
    }

    // Store stats in KV (use platform as key prefix)
    const statsKey = `stats:download_time:${body.platform}:${Date.now()}`;
    const statsData = {
      platform: body.platform,
      downloadTime: body.downloadTime,
      timestamp: body.timestamp || Date.now(),
    };

    // Store with 90 day expiration
    await c.env.ARCHIVE_CACHE.put(statsKey, JSON.stringify(statsData), {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days
    });

    // Update aggregated stats (rolling average)
    await updateAggregatedStats(c, body.platform, body.downloadTime);

    logger.info('📊 Stats collected', {
      platform: body.platform,
      downloadTime: body.downloadTime,
    });

    return c.json({
      success: true,
      message: 'Stats recorded',
    });

  } catch (error) {
    logger.error('Failed to collect stats', {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({
      error: 'Failed to collect stats',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

/**
 * Get average download times for all platforms
 * GET /api/stats/download-time
 */
export async function handleStatsGet(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const logger = Logger.fromContext(c);

  try {
    const platforms = ['facebook', 'linkedin', 'instagram', 'tiktok', 'x', 'threads'];
    const stats: Record<string, { average: number; count: number }> = {};

    // Get aggregated stats for each platform
    for (const platform of platforms) {
      const statsKey = `stats:aggregate:${platform}`;
      const data = await c.env.ARCHIVE_CACHE.get(statsKey);

      if (data) {
        const parsed = JSON.parse(data);
        stats[platform] = {
          average: Math.round(parsed.average * 10) / 10, // Round to 1 decimal
          count: parsed.count,
        };
      } else {
        stats[platform] = {
          average: 0,
          count: 0,
        };
      }
    }

    logger.info('📊 Stats retrieved');

    return c.json({
      success: true,
      stats,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get stats', {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

/**
 * Update aggregated stats (rolling average)
 */
async function updateAggregatedStats(
  c: Context<{ Bindings: Bindings }>,
  platform: string,
  downloadTime: number
): Promise<void> {
  const statsKey = `stats:aggregate:${platform}`;
  const existing = await c.env.ARCHIVE_CACHE.get(statsKey);

  let newData;
  if (existing) {
    const parsed = JSON.parse(existing);
    const count = parsed.count + 1;
    const average = (parsed.average * parsed.count + downloadTime) / count;

    newData = {
      average,
      count,
      lastUpdated: Date.now(),
    };
  } else {
    newData = {
      average: downloadTime,
      count: 1,
      lastUpdated: Date.now(),
    };
  }

  // Store aggregated stats (no expiration)
  await c.env.ARCHIVE_CACHE.put(statsKey, JSON.stringify(newData));
}
