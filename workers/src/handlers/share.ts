import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { CreateShareRequestSchema, type ShareResponse } from '@/types/api';
import { generateShareId } from '@/utils/id';
import { ValidationError, NotFoundError, AuthenticationError } from '@/utils/errors';
import { Logger } from '@/utils/logger';
import { addPostToUserIndex, removePostFromUserIndex } from '@/utils/user-index';

export const shareRouter = new Hono<Env>();

// POST /api/share - Create share link
shareRouter.post('/', async (c) => {
  const logger = Logger.fromContext(c);

  try {
    const body = await c.req.json();
    const request = CreateShareRequestSchema.parse(body);

    // Use provided shareId (for updates) or generate new one
    const shareId = (request.options as any)?.shareId || generateShareId();

    // Use postData if provided (new format), otherwise use legacy format
    let shareData: any;
    if (request.postData) {
      // New format: Full PostData object
      shareData = {
        ...request.postData,
        shareId,
        createdAt: Date.now(),
        viewCount: 0,
        options: request.options
      };
    } else {
      // Legacy format: content + metadata
      shareData = {
        content: request.content,
        metadata: request.metadata,
        shareId,
        createdAt: Date.now(),
        viewCount: 0,
        options: request.options
      };
    }

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

    // Add to user index if username is provided
    const username = request.options?.username;
    if (username) {
      try {
        await addPostToUserIndex(
          c.env.SHARE_LINKS,
          username,
          shareId,
          { ttl }
        );
        logger.info('Added share to user index', { username, shareId });
      } catch (indexError) {
        // Log error but don't fail the share creation
        logger.error('Failed to add share to user index', {
          error: indexError,
          username,
          shareId
        });
      }
    }

    // Generate share URL using share-web domain (not API domain)
    const SHARE_WEB_URL = 'https://social-archive.junlim.org';

    // Build share URL with username if provided (no /share/ prefix)
    const shareUrl = username
      ? `${SHARE_WEB_URL}/${username}/${shareId}`
      : `${SHARE_WEB_URL}/${shareId}`;

    const response: ShareResponse = {
      shareId,
      shareUrl,
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

  // Return full shareData (contains full PostData if available, or legacy content+metadata)
  return c.json({
    success: true,
    data: shareData
  });
});

// DELETE /api/share/:shareId - Delete share link
shareRouter.delete('/:shareId', async (c) => {
  const logger = Logger.fromContext(c);
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

  // Get share data before deletion to remove from user index
  const shareData = await c.env.SHARE_LINKS.get(`share:${shareId}`, 'json') as any;

  if (shareData) {
    // Remove from user index if username exists
    const username = shareData.options?.username;
    if (username) {
      try {
        await removePostFromUserIndex(c.env.SHARE_LINKS, username, shareId);
        logger.info('Removed share from user index', { username, shareId });
      } catch (indexError) {
        // Log error but don't fail the deletion
        logger.error('Failed to remove share from user index', {
          error: indexError,
          username,
          shareId
        });
      }
    }
  }

  // Delete the share
  await c.env.SHARE_LINKS.delete(`share:${shareId}`);

  return c.json({
    success: true,
    data: {
      message: 'Share link deleted'
    }
  });
});