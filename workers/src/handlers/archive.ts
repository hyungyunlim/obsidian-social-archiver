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
// import { ArchiveService } from '@/services/ArchiveService'; // TODO: Implement when needed

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
    
    // Queue the actual processing (in production, use Durable Objects or Queues)
    c.executionCtx.waitUntil(
      processArchiveJob(c.env, jobId, request, logger)
    );
    
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

// GET /api/archive/:jobId - Get job status
archiveRouter.get('/:jobId', async (c) => {
  const logger = c.get('logger') as Logger;
  const jobId = c.req.param('jobId');
  
  logger.info('Job status requested', { jobId });
  
  const job = await c.env.ARCHIVE_CACHE.get(`job:${jobId}`, 'json') as JobStatusResponse | null;
  
  if (!job) {
    logger.warn('Job not found', { jobId });
    throw new NotFoundError('Job', 'Job not found or expired');
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

async function processArchiveJob(
  env: Env['Bindings'],
  jobId: string,
  _request: any,
  logger: Logger
): Promise<void> {
  try {
    logger.info('Processing archive job', { jobId });
    
    // Update job status to processing
    await updateJobStatus(env, jobId, 'processing');
    
    // TODO: Implement actual archive logic
    // 1. Call BrightData API to scrape content
    // 2. Process and clean the data
    // 3. If AI enabled, call Perplexity API
    // 4. Store result in KV
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update job as completed
    await updateJobStatus(env, jobId, 'completed', {
      postData: {
        platform: 'facebook',
        content: 'Sample archived content',
        // ... rest of the data
      }
    });
    
    logger.info('Archive job completed', { jobId });
    
  } catch (error) {
    logger.error(`Job ${jobId} failed`, error);
    await updateJobStatus(env, jobId, 'failed', null, String(error));
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