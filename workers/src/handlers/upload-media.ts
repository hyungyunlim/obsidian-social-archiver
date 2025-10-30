import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { ValidationError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

export const uploadMediaRouter = new Hono<Env>();

// Schema for upload request
const UploadMediaRequestSchema = z.object({
  shareId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string(),
  data: z.string() // base64 encoded
});

/**
 * POST /api/upload-share-media - Upload image for sharing
 */
uploadMediaRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const request = UploadMediaRequestSchema.parse(body);

    // Decode base64 image data
    const imageBuffer = Uint8Array.from(atob(request.data), c => c.charCodeAt(0));

    // Check if R2_BUCKET is available
    if (!c.env.R2_BUCKET) {
      return c.json({
        success: false,
        error: {
          code: 'R2_NOT_CONFIGURED',
          message: 'R2 storage is not configured'
        }
      }, 500);
    }

    // Generate R2 key
    const r2Key = `shares/${request.shareId}/media/${request.filename}`;

    // Upload to R2
    await c.env.R2_BUCKET.put(r2Key, imageBuffer, {
      httpMetadata: {
        contentType: request.contentType
      }
    });

    // Generate public URL
    const publicUrl = `https://social-archiver-api.junlim.org/media/${request.shareId}/${request.filename}`;

    Logger.info(c, 'Media uploaded to R2', { shareId: request.shareId, filename: request.filename, r2Key });

    return c.json({
      success: true,
      data: {
        url: publicUrl,
        filename: request.filename,
        r2Key
      }
    }, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid upload request',
          details: error.errors
        }
      }, 400);
    }

    Logger.error(c, 'Upload failed', error);
    return c.json({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload media'
      }
    }, 500);
  }
});

/**
 * GET /media/:shareId/:filename - Serve uploaded media from R2
 */
uploadMediaRouter.get('/:shareId/:filename', async (c) => {
  const shareId = c.req.param('shareId');
  const filename = c.req.param('filename');
  const r2Key = `shares/${shareId}/media/${filename}`;

  try {
    if (!c.env.R2_BUCKET) {
      return c.json({
        success: false,
        error: {
          code: 'R2_NOT_CONFIGURED',
          message: 'R2 storage is not configured'
        }
      }, 500);
    }

    const object = await c.env.R2_BUCKET.get(r2Key);

    if (!object) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Media not found'
        }
      }, 404);
    }

    // Set cache headers
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.httpEtag
      }
    });

  } catch (error) {
    Logger.error(c, 'Failed to serve media', error);
    return c.json({
      success: false,
      error: {
        code: 'SERVE_FAILED',
        message: 'Failed to serve media'
      }
    }, 500);
  }
});
