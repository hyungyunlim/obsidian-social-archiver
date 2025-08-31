import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { CreateShareRequestSchema, type ShareResponse } from '@/types/api';
import { generateShareId } from '@/utils/id';
import { ValidationError, NotFoundError, AuthenticationError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

export const shareRouter = new Hono<Env>();

// POST /api/share - Create share link
shareRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const request = CreateShareRequestSchema.parse(body);
    
    const shareId = generateShareId();
    const shareData = {
      ...request,
      createdAt: Date.now(),
      viewCount: 0
    };
    
    // Calculate expiration
    const ttl = request.options?.expiry 
      ? Math.floor((request.options.expiry - Date.now()) / 1000)
      : 30 * 24 * 60 * 60; // 30 days default
    
    // Store in KV
    await c.env.SHARE_LINKS.put(
      `share:${shareId}`,
      JSON.stringify(shareData),
      { expirationTtl: ttl }
    );
    
    const response: ShareResponse = {
      shareId,
      shareUrl: `https://share.social-archiver.com/${shareId}`,
      expiresAt: request.options?.expiry,
      passwordProtected: !!request.options?.password
    };
    
    return c.json({
      success: true,
      data: response
    }, 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      }, 400);
    }
    throw error;
  }
});

// GET /api/share/:shareId - Get shared content
shareRouter.get('/:shareId', async (c) => {
  const shareId = c.req.param('shareId');
  const password = c.req.query('password');
  
  const shareData = await c.env.SHARE_LINKS.get(`share:${shareId}`, 'json') as any;
  
  if (!shareData) {
    return c.json({
      success: false,
      error: {
        code: 'SHARE_NOT_FOUND',
        message: 'Share link not found or expired'
      }
    }, 404);
  }
  
  // Check password if protected
  if (shareData.options?.password && shareData.options.password !== password) {
    return c.json({
      success: false,
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Invalid password'
      }
    }, 401);
  }
  
  // Increment view count
  shareData.viewCount = (shareData.viewCount || 0) + 1;
  await c.env.SHARE_LINKS.put(
    `share:${shareId}`,
    JSON.stringify(shareData)
  );
  
  return c.json({
    success: true,
    data: {
      content: shareData.content,
      metadata: shareData.metadata,
      createdAt: shareData.createdAt,
      viewCount: shareData.viewCount
    }
  });
});

// DELETE /api/share/:shareId - Delete share link
shareRouter.delete('/:shareId', async (c) => {
  const shareId = c.req.param('shareId');
  const licenseKey = c.req.header('X-License-Key');
  
  if (!licenseKey) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'License key required'
      }
    }, 401);
  }
  
  // Verify ownership (simplified - in production, store owner info)
  await c.env.SHARE_LINKS.delete(`share:${shareId}`);
  
  return c.json({
    success: true,
    data: {
      message: 'Share link deleted'
    }
  });
});