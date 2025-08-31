import type { Context, Next } from 'hono';
import type { Env } from '@/types/bindings';
import { z } from 'zod';
import { BaseError } from '@/utils/errors';
import { Logger, generateRequestId } from '@/utils/logger';

// Request ID middleware - should be applied first
export const requestIdMiddleware = async (c: Context<Env>, next: Next) => {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
};

// Logging middleware
export const loggingMiddleware = async (c: Context<Env>, next: Next) => {
  const logger = Logger.fromContext(c);
  c.set('logger', logger);
  
  const start = Date.now();
  
  logger.info(`${c.req.method} ${c.req.url}`);
  
  try {
    await next();
    
    const duration = Date.now() - start;
    logger.info(`Request completed`, {
      status: c.res.status,
      duration
    });
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Request failed', {
      error,
      duration
    });
    throw error;
  }
};

// Global error handler
export const errorHandler = (err: Error, c: Context<Env>) => {
  const logger = c.get('logger') as Logger || Logger.fromContext(c);
  logger.error('Error occurred', err);
  
  // Handle custom errors
  if (err instanceof BaseError) {
    return c.json({
      success: false,
      error: err.toJSON()
    }, err.statusCode);
  }
  
  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors
      }
    }, 400);
  }
  
  // Log unexpected errors to dead letter queue if critical
  if (shouldLogToDeadLetterQueue(err)) {
    c.executionCtx.waitUntil(
      logToDeadLetterQueue(c.env, err, c)
    );
  }
  
  // Default error response
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  }, 500);
};

// Dead letter queue for critical errors
async function logToDeadLetterQueue(
  env: Env['Bindings'],
  error: Error,
  c: Context<Env>
): Promise<void> {
  const requestId = c.get('requestId') || generateRequestId();
  const key = `dlq:${requestId}`;
  
  try {
    await env.ARCHIVE_CACHE.put(
      key,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        url: c.req.url,
        method: c.req.method,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        headers: Object.fromEntries(c.req.raw.headers.entries())
      }),
      { expirationTtl: 86400 * 7 } // Keep for 7 days
    );
  } catch (dlqError) {
    console.error('Failed to write to dead letter queue:', dlqError);
  }
}

// Determine if error should be logged to DLQ
function shouldLogToDeadLetterQueue(error: Error): boolean {
  // Don't log client errors to DLQ
  if (error instanceof BaseError && error.statusCode < 500) {
    return false;
  }
  
  // Log all 5xx errors
  return true;
}

// Analytics tracking for errors
export async function trackError(
  c: Context<Env>,
  error: Error
): Promise<void> {
  const logger = c.get('logger') as Logger;
  
  // Track error metrics
  const metrics = {
    error_type: error.name,
    status_code: error instanceof BaseError ? error.statusCode : 500,
    path: new URL(c.req.url).pathname,
    method: c.req.method
  };
  
  logger.info('Error metrics', metrics);
  
  // In production, you could send these to Workers Analytics
  // or an external monitoring service
}