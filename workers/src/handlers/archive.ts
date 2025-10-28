import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { ArchiveRequestSchema, type ArchiveResponse, type JobStatusResponse } from '@/types/api';
import { generateJobId } from '@/utils/id';
import {
  ValidationError,
  AuthenticationError,
  InsufficientCreditsError,
  NotFoundError
} from '@/utils/errors';
import { Logger } from '@/utils/logger';
import { ArchiveService } from '@/services/ArchiveService';

export const archiveRouter = new Hono<Env>();

// POST /api/archive - Create new archive job
archiveRouter.post('/', async (c) => {
  const logger = c.get('logger') as Logger;
  
  try {
    const body = await c.req.json();
    const request = ArchiveRequestSchema.parse(body);
    
    logger.info('Archive request received', { url: request.url });
    
    // Check license if provided
    let creditsAvailable = 10; // Free tier default
    if (request.licenseKey) {
      const license = await c.env.LICENSE_KEYS.get(request.licenseKey, 'json') as any;
      if (!license || !license.valid) {
        logger.warn('Invalid license key attempted', { licenseKey: request.licenseKey });
        throw new AuthenticationError('Invalid license key');
      }
      creditsAvailable = license.creditsRemaining;
      logger.setContext('userId', request.licenseKey);
    }
    
    // Calculate required credits
    const creditsRequired = calculateCredits(request.options);
    
    if (creditsAvailable < creditsRequired) {
      logger.warn('Insufficient credits', { 
        required: creditsRequired, 
        available: creditsAvailable 
      });
      throw new InsufficientCreditsError(creditsRequired, creditsAvailable);
    }
    
    // Create job
    const jobId = generateJobId();
    const job: JobStatusResponse = {
      jobId,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Store job in KV
    await c.env.ARCHIVE_CACHE.put(
      `job:${jobId}`,
      JSON.stringify(job),
      { expirationTtl: 3600 } // 1 hour TTL
    );
    
    // Trigger BrightData collection with webhook delivery (non-blocking)
    logger.info('Triggering BrightData webhook collection', { jobId });

    const webhookUrl = `${new URL(c.req.url).origin}/webhook/brightdata`;

    const backgroundTask = triggerWebhookCollection(
      c.env,
      jobId,
      request,
      webhookUrl,
      logger
    ).catch(error => {
      logger.error('Webhook trigger failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    });

    c.executionCtx.waitUntil(backgroundTask);

    const response: ArchiveResponse = {
      jobId,
      status: 'pending',
      estimatedTime: 30,
      creditsRequired
    };

    logger.info('Archive job created', { jobId, creditsRequired });
    
    return c.json({
      success: true,
      data: response
    }, 202);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request data', error.errors);
    }
    throw error;
  }
});

// GET /api/archive/:jobId - Get job status (with slow path polling support)
archiveRouter.get('/:jobId', async (c) => {
  const logger = c.get('logger') as Logger;
  const jobId = c.req.param('jobId');

  logger.info('Job status requested', { jobId });

  const job = await c.env.ARCHIVE_CACHE.get(`job:${jobId}`, 'json') as JobStatusResponse | null;

  if (!job) {
    logger.warn('Job not found', { jobId });
    throw new NotFoundError('Job', 'Job not found or expired');
  }

  // Slow path: If job is still processing and has snapshotId, check BrightData status
  if (job.status === 'processing' && (job as any).snapshotId) {
    const snapshotId = (job as any).snapshotId;
    logger.info('🔍 Checking BrightData status for slow path', { jobId, snapshotId });

    try {
      const status = await checkSnapshotStatus(snapshotId, c.env.BRIGHTDATA_API_KEY!, logger);

      if (status.status === 'ready') {
        logger.info('✅ Snapshot ready (slow path), processing', { jobId, snapshotId });

        // Use data from status check (already parsed)
        const rawData = status.data;
        if (!rawData) {
          logger.error('No data in ready status (slow path)', { jobId, snapshotId });
          const failedJob: JobStatusResponse = {
            ...job,
            status: 'failed',
            updatedAt: Date.now(),
            error: 'No data received from BrightData'
          };
          await c.env.ARCHIVE_CACHE.put(`job:${jobId}`, JSON.stringify(failedJob), { expirationTtl: 3600 });
          return c.json({ success: true, data: failedJob });
        }

        const platform = (job as any).platform || detectPlatformFromUrl((job as any).url);
        const url = (job as any).url;

        // Use ArchiveService to parse the data properly
        const archiveService = new ArchiveService(c.env, logger);
        const postData = await archiveService.parsePostData(rawData, platform, url);

        // Update job to completed
        const updatedJob: JobStatusResponse = {
          ...job,
          status: 'completed',
          updatedAt: Date.now(),
          result: {
            postData,
            creditsUsed: 1,
            processingTime: Date.now() - job.createdAt,
            cached: false,
          }
        };

        await c.env.ARCHIVE_CACHE.put(`job:${jobId}`, JSON.stringify(updatedJob), {
          expirationTtl: 3600,
        });

        logger.info('🎉 Job completed via slow path', { jobId });

        return c.json({
          success: true,
          data: updatedJob
        });

      } else if (status.status === 'failed' || status.error) {
        logger.error('❌ Snapshot failed (slow path)', { jobId, snapshotId, error: status.error });

        const failedJob: JobStatusResponse = {
          ...job,
          status: 'failed',
          updatedAt: Date.now(),
          error: status.error || 'BrightData collection failed'
        };

        await c.env.ARCHIVE_CACHE.put(`job:${jobId}`, JSON.stringify(failedJob), {
          expirationTtl: 3600,
        });

        return c.json({
          success: true,
          data: failedJob
        });
      }

      // Still processing - return current status
      logger.info('⏳ Still processing (slow path)', { jobId, snapshotStatus: status.status });

    } catch (error) {
      logger.error('⚠️ Failed to check BrightData status', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with returning current job status
    }
  }

  return c.json({
    success: true,
    data: job
  });
});

// Helper functions
function calculateCredits(options?: any): number {
  let credits = 1; // Base cost
  if (options?.enableAI) credits += 2;
  if (options?.deepResearch) credits += 2;
  return credits;
}

/**
 * Trigger BrightData collection with hybrid polling (Option 5)
 * - Fast path: Complete within 30s → immediate response
 * - Slow path: Timeout → return jobId for plugin polling
 */
async function triggerWebhookCollection(
  env: Env['Bindings'],
  jobId: string,
  request: any,
  webhookUrl: string,
  logger: Logger
): Promise<void> {
  logger.info('🚀 Triggering BrightData collection (hybrid mode)', {
    jobId,
    url: request.url
  });

  try {
    // Update job status to processing
    await updateJobStatus(env, jobId, 'processing');

    // Initialize ArchiveService
    const archiveService = new ArchiveService(env, logger);

    // Build webhook URL with jobId for tracking
    const webhookUrlWithJobId = `${webhookUrl}?jobId=${jobId}`;

    // Trigger collection with webhook (Option 3: Webhook + Polling hybrid)
    const snapshotId = await archiveService.triggerArchiveViaWebhook(
      request.url,
      webhookUrlWithJobId,
      request.options
    );

    logger.info('✅ Collection triggered with webhook, trying fast path (30s)', { jobId, snapshotId, webhookUrl: webhookUrlWithJobId });

    // Store snapshot info in job
    const job = await env.ARCHIVE_CACHE.get(`job:${jobId}`, 'json') as any;
    if (job) {
      job.snapshotId = snapshotId;
      job.platform = archiveService.detectPlatform(request.url);
      job.url = request.url;
      await env.ARCHIVE_CACHE.put(`job:${jobId}`, JSON.stringify(job), {
        expirationTtl: 3600,
      });
    }

    // Try fast path: poll for 30 seconds
    const completed = await pollSnapshotWithTimeout(env, jobId, snapshotId, request, logger, 30000);

    if (completed) {
      logger.info('⚡ Fast path: Completed within 30s', { jobId });
    } else {
      logger.info('🐌 Slow path: Timeout, plugin will poll', { jobId });
      // Job remains in 'processing' state for plugin to continue polling
    }

  } catch (error) {
    logger.error('❌ Collection failed', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url
    });

    try {
      await updateJobStatus(
        env,
        jobId,
        'failed',
        null,
        error instanceof Error ? error.message : String(error)
      );
    } catch (updateError) {
      logger.error('⚠️ Failed to update job status to failed', {
        jobId,
        updateError: updateError instanceof Error ? updateError.message : String(updateError)
      });
    }
  }
}

/**
 * Poll BrightData snapshot with timeout (returns true if completed, false if timeout)
 * Used for hybrid approach - tries to complete within time limit
 */
async function pollSnapshotWithTimeout(
  env: Env['Bindings'],
  jobId: string,
  snapshotId: string,
  request: any,
  logger: Logger,
  timeoutMs: number
): Promise<boolean> {
  const pollInterval = 2000; // 2 seconds
  const maxAttempts = Math.floor(timeoutMs / pollInterval);
  const startTime = Date.now();

  logger.info('📊 Starting snapshot polling with timeout', {
    jobId,
    snapshotId,
    timeoutMs,
    maxAttempts
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check if timeout exceeded
      if (Date.now() - startTime >= timeoutMs) {
        logger.info('⏱️ Polling timeout reached', { jobId, attempt });
        return false; // Timeout - let plugin continue polling
      }

      // Check snapshot status
      const status = await checkSnapshotStatus(snapshotId, env.BRIGHTDATA_API_KEY!, logger);

      logger.info(`📡 Polling attempt ${attempt}/${maxAttempts}`, {
        jobId,
        snapshotId,
        status: status.status,
        elapsed: Date.now() - startTime
      });

      if (status.status === 'ready') {
        logger.info('✅ Snapshot ready, processing data', { jobId, snapshotId });

        // Use data from status check (already parsed)
        const rawData = status.data;
        if (!rawData) {
          logger.error('No data in ready status', { jobId, snapshotId });
          await updateJobStatus(env, jobId, 'failed', null, 'No data received from BrightData');
          return true;
        }

        const platform = request.platform || detectPlatformFromUrl(request.url);

        // Use ArchiveService to parse the data properly
        const archiveService = new ArchiveService(env, logger);
        const postData = await archiveService.parsePostData(rawData, platform, request.url);

        // Complete job
        await updateJobStatus(env, jobId, 'completed', {
          postData,
          creditsUsed: calculateCredits(request.options),
          processingTime: Date.now() - (await env.ARCHIVE_CACHE.get(`job:${jobId}`, 'json') as any).createdAt,
          cached: false,
        });

        logger.info('🎉 Job completed via fast path', { jobId, elapsed: Date.now() - startTime });
        return true; // Completed successfully

      } else if (status.status === 'failed' || status.error) {
        logger.error('❌ Snapshot failed', { jobId, snapshotId, error: status.error });
        await updateJobStatus(env, jobId, 'failed', null, status.error || 'BrightData collection failed');
        return true; // Finished (with error)
      }

      // Wait before next poll (if not the last attempt)
      if (attempt < maxAttempts && Date.now() - startTime < timeoutMs - pollInterval) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

    } catch (error) {
      logger.error('⚠️ Polling error', {
        jobId,
        attempt,
        error: error instanceof Error ? error.message : String(error)
      });

      // Continue polling on errors
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
  }

  // Timeout reached
  logger.info('⏱️ Fast path timeout, switching to slow path', { jobId, snapshotId });
  return false; // Not completed within timeout
}

/**
 * Check BrightData snapshot status
 *
 * BrightData's /snapshot/{id} endpoint returns:
 * - NDJSON data (actual results) when ready
 * - Error object when failed
 * - Empty response when still processing
 */
async function checkSnapshotStatus(snapshotId: string, apiKey: string, logger: Logger): Promise<any> {
  const response = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    // HTTP error - treat as failed
    const errorText = await response.text().catch(() => 'Unknown error');
    logger.error('BrightData API error', { status: response.status, error: errorText });
    return {
      status: 'failed',
      error: `API error ${response.status}: ${errorText}`
    };
  }

  // Get response as text to detect format
  const text = await response.text();

  // Empty response = still processing
  if (!text || text.trim().length === 0) {
    logger.debug('Empty response - still processing', { snapshotId });
    return { status: 'running' };
  }

  // Try to detect NDJSON format (multiple lines of JSON or single JSON object)
  const lines = text.trim().split('\n').filter(line => line.trim().length > 0);

  // No valid lines = still processing
  if (lines.length === 0) {
    logger.debug('No valid JSON lines - still processing', { snapshotId });
    return { status: 'running' };
  }

  // Check if response is NDJSON data (ready)
  try {
    const firstLine = JSON.parse(lines[0]!);

    // If it's an error object
    if (firstLine.error || firstLine.status === 'error') {
      logger.error('BrightData returned error', { error: firstLine });
      return {
        status: 'failed',
        error: firstLine.error || firstLine.message || 'BrightData collection failed'
      };
    }

    // If it has data fields (post_id, author, text, etc.) = actual data = ready
    if (firstLine.post_id || firstLine.author || firstLine.text ||
        firstLine.id || firstLine.user_name || firstLine.comment_text ||
        firstLine.url || firstLine.caption) {
      logger.info('✅ NDJSON data detected - snapshot is ready', {
        snapshotId,
        lines: lines.length,
        firstLineKeys: Object.keys(firstLine).slice(0, 5)
      });

      // Parse all NDJSON lines
      const data = lines.map((line, idx) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          logger.warn('Failed to parse NDJSON line', { idx, line: line.substring(0, 100) });
          return null;
        }
      }).filter(item => item !== null);

      return {
        status: 'ready',
        data: data.length > 0 ? data[0] : null,
        allData: data
      };
    }

    // Unknown format - might be metadata or status
    logger.warn('Unknown response format', {
      snapshotId,
      firstLineKeys: Object.keys(firstLine)
    });
    return { status: 'running' };

  } catch (parseError) {
    // Not valid JSON
    logger.error('Failed to parse response', {
      snapshotId,
      error: parseError instanceof Error ? parseError.message : String(parseError),
      textPreview: text.substring(0, 200)
    });
    return { status: 'running' }; // Treat as still processing
  }
}

/**
 * Download snapshot data from BrightData
 */
async function downloadSnapshotData(snapshotId: string, apiKey: string, logger: Logger): Promise<any> {
  const response = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to download snapshot', { status: response.status, error: errorText });
    throw new Error(`Failed to download snapshot: ${response.status}`);
  }

  const text = await response.text();

  // Parse NDJSON
  const lines = text.trim().split('\n');
  const results = lines
    .filter(line => line.trim().length > 0)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        logger.error('Failed to parse NDJSON line', { line: line.substring(0, 100) });
        return null;
      }
    })
    .filter(result => result !== null);

  if (results.length === 0) {
    throw new Error('No valid data in snapshot response');
  }

  return results[0];
}

function detectPlatformFromUrl(url: string): string {
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('x.com') || url.includes('twitter.com')) return 'x';
  if (url.includes('threads.net')) return 'threads';
  return 'unknown';
}

/**
 * Legacy polling-based processing (kept for reference)
 */
async function processArchiveJob(
  env: Env['Bindings'],
  jobId: string,
  request: any,
  logger: Logger
): Promise<void> {
  logger.info('🚀 processArchiveJob STARTED', {
    jobId,
    url: request.url,
    options: request.options
  });

  try {
    // Update job status to processing
    logger.info('📝 Updating job status to processing', { jobId });
    await updateJobStatus(env, jobId, 'processing');
    logger.info('✅ Job status updated to processing', { jobId });

    // Initialize ArchiveService
    logger.info('🔧 Initializing ArchiveService', { jobId });
    const archiveService = new ArchiveService(env, logger);
    logger.info('✅ ArchiveService initialized', { jobId });

    // Archive the post
    logger.info('📥 Starting archivePost', { jobId, url: request.url });
    const result = await archiveService.archivePost(request.url, request.options);
    logger.info('✅ archivePost completed', { jobId, creditsUsed: result.creditsUsed });

    // Update job as completed
    logger.info('📝 Updating job status to completed', { jobId });
    await updateJobStatus(env, jobId, 'completed', result);
    logger.info('🎉 Archive job completed successfully', { jobId, creditsUsed: result.creditsUsed });

  } catch (error) {
    logger.error('❌ Job processing failed', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url
    });

    try {
      await updateJobStatus(
        env,
        jobId,
        'failed',
        null,
        error instanceof Error ? error.message : String(error)
      );
      logger.info('📝 Job status updated to failed', { jobId });
    } catch (updateError) {
      logger.error('⚠️ Failed to update job status to failed', {
        jobId,
        updateError: updateError instanceof Error ? updateError.message : String(updateError)
      });
    }
  }
}

async function updateJobStatus(
  env: Env['Bindings'],
  jobId: string,
  status: JobStatusResponse['status'],
  result?: any,
  error?: string
): Promise<void> {
  const job = await env.ARCHIVE_CACHE.get(`job:${jobId}`, 'json') as JobStatusResponse;
  
  if (job) {
    job.status = status;
    job.updatedAt = Date.now();
    if (result) job.result = result;
    if (error) job.error = error;
    
    await env.ARCHIVE_CACHE.put(
      `job:${jobId}`,
      JSON.stringify(job),
      { expirationTtl: 3600 }
    );
  }
}