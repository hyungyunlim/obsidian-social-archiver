import { Hono } from 'hono';
import type { Env } from '@/types/bindings';
import { Logger } from '@/utils/logger';

export const webhookRouter = new Hono<Env>();

/**
 * Gumroad webhook event types
 */
enum GumroadWebhookEvent {
  SALE = 'sale',
  REFUND = 'refund',
  DISPUTE = 'dispute',
  DISPUTE_WON = 'dispute_won',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_ENDED = 'subscription_ended',
  SUBSCRIPTION_RESTARTED = 'subscription_restarted',
}

/**
 * Webhook event record for KV storage
 */
interface WebhookEventRecord {
  id: string;
  type: GumroadWebhookEvent;
  payload: any;
  receivedAt: number;
  processed: boolean;
  processedAt?: number;
  attempts: number;
  lastError?: string;
}

/**
 * POST /webhook/gumroad - Handle Gumroad webhooks
 */
webhookRouter.post('/gumroad', async (c) => {
  const logger = new Logger('webhook:gumroad', { requestId: c.var.requestId });

  try {
    // Get signature from header
    const signature = c.req.header('X-Gumroad-Signature');
    if (!signature) {
      logger.warn('Missing webhook signature');
      return c.json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Webhook signature required'
        }
      }, 401);
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Verify HMAC signature
    const isValid = await verifyHmacSignature(
      rawBody,
      signature,
      c.env.GUMROAD_WEBHOOK_SECRET || c.env.HMAC_SECRET || ''
    );

    if (!isValid) {
      logger.error('Invalid webhook signature');
      return c.json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature'
        }
      }, 401);
    }

    // Parse payload
    const payload = JSON.parse(rawBody);

    // Generate event ID for idempotency
    const eventId = `${payload.sale_id}-${payload.sale_timestamp}`;

    // Check if event already processed (idempotency)
    const existingEvent = await c.env.LICENSE_KEYS.get(`webhook:${eventId}`, 'json') as WebhookEventRecord | null;

    if (existingEvent?.processed) {
      logger.info('Webhook event already processed', { eventId });
      return c.json({
        success: true,
        message: 'Event already processed',
        eventId
      });
    }

    // Determine event type
    const eventType = determineEventType(payload);

    // Create event record
    const eventRecord: WebhookEventRecord = {
      id: eventId,
      type: eventType,
      payload,
      receivedAt: Date.now(),
      processed: false,
      attempts: 0
    };

    // Store event record
    await c.env.LICENSE_KEYS.put(
      `webhook:${eventId}`,
      JSON.stringify(eventRecord),
      { expirationTtl: 7 * 24 * 60 * 60 } // 7 days retention
    );

    // Process event
    const result = await processWebhookEvent(eventRecord, c);

    // Mark as processed
    eventRecord.processed = true;
    eventRecord.processedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `webhook:${eventId}`,
      JSON.stringify(eventRecord),
      { expirationTtl: 7 * 24 * 60 * 60 }
    );

    logger.info('Webhook processed successfully', {
      eventId,
      eventType,
      licenseKey: payload.license_key
    });

    return c.json({
      success: true,
      eventId,
      eventType,
      processed: true
    });

  } catch (error) {
    logger.error('Webhook processing failed', { error });

    return c.json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, 500);
  }
});

/**
 * Verify HMAC signature using Web Crypto API
 */
async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Import secret as key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    // Compute expected signature
    const payloadData = encoder.encode(payload);
    const expectedSignatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert to base64
    const expectedSignature = arrayBufferToBase64(expectedSignatureBuffer);

    // Timing-safe comparison
    return timingSafeEqual(expectedSignature, signature);
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Determine event type from payload
 */
function determineEventType(payload: any): GumroadWebhookEvent {
  if (payload.refunded) {
    return GumroadWebhookEvent.REFUND;
  }

  if (payload.disputed && !payload.dispute_won) {
    return GumroadWebhookEvent.DISPUTE;
  }

  if (payload.disputed && payload.dispute_won) {
    return GumroadWebhookEvent.DISPUTE_WON;
  }

  if (payload.subscription_cancelled_at || payload.subscription_failed_at) {
    return GumroadWebhookEvent.SUBSCRIPTION_ENDED;
  }

  if (payload.subscription_id) {
    return GumroadWebhookEvent.SUBSCRIPTION_UPDATED;
  }

  return GumroadWebhookEvent.SALE;
}

/**
 * Process webhook event by type
 */
async function processWebhookEvent(
  event: WebhookEventRecord,
  c: any
): Promise<void> {
  const { type, payload } = event;
  const logger = new Logger('webhook:processor', { requestId: c.var.requestId });

  logger.info(`Processing ${type} event`, {
    licenseKey: payload.license_key,
    email: payload.email
  });

  switch (type) {
    case GumroadWebhookEvent.SALE:
      await handleSaleEvent(payload, c);
      break;

    case GumroadWebhookEvent.REFUND:
      await handleRefundEvent(payload, c);
      break;

    case GumroadWebhookEvent.DISPUTE:
      await handleDisputeEvent(payload, c);
      break;

    case GumroadWebhookEvent.DISPUTE_WON:
      await handleDisputeWonEvent(payload, c);
      break;

    case GumroadWebhookEvent.SUBSCRIPTION_UPDATED:
      await handleSubscriptionUpdatedEvent(payload, c);
      break;

    case GumroadWebhookEvent.SUBSCRIPTION_ENDED:
      await handleSubscriptionEndedEvent(payload, c);
      break;

    default:
      logger.warn('Unknown event type', { type });
  }
}

/**
 * Handle sale event - Create or activate license
 */
async function handleSaleEvent(payload: any, c: any): Promise<void> {
  const licenseKey = payload.license_key;

  // Check if license already exists
  const existing = await c.env.LICENSE_KEYS.get(`license:${licenseKey}`, 'json');

  if (existing) {
    // Reactivate if previously deactivated
    existing.isActive = true;
    existing.refunded = false;
    existing.disputed = false;
    existing.updatedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `license:${licenseKey}`,
      JSON.stringify(existing)
    );
    return;
  }

  // Create new license
  const license = {
    key: licenseKey,
    plan: 'pro',
    email: payload.email,
    productId: payload.product_id,
    productName: payload.product_name,
    price: payload.price,
    currency: payload.currency,
    saleId: payload.sale_id,
    purchaseDate: payload.sale_timestamp,
    subscriptionId: payload.subscription_id,
    isActive: true,
    refunded: false,
    disputed: false,
    creditsRemaining: 500,
    creditLimit: 500,
    resetDate: getNextResetDate(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await c.env.LICENSE_KEYS.put(
    `license:${licenseKey}`,
    JSON.stringify(license)
  );
}

/**
 * Handle refund event - Deactivate license
 */
async function handleRefundEvent(payload: any, c: any): Promise<void> {
  const licenseKey = payload.license_key;
  const license = await c.env.LICENSE_KEYS.get(`license:${licenseKey}`, 'json') as any;

  if (license) {
    license.isActive = false;
    license.refunded = true;
    license.refundedAt = Date.now();
    license.updatedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `license:${licenseKey}`,
      JSON.stringify(license)
    );
  }
}

/**
 * Handle dispute event - Deactivate license
 */
async function handleDisputeEvent(payload: any, c: any): Promise<void> {
  const licenseKey = payload.license_key;
  const license = await c.env.LICENSE_KEYS.get(`license:${licenseKey}`, 'json') as any;

  if (license) {
    license.isActive = false;
    license.disputed = true;
    license.disputedAt = Date.now();
    license.updatedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `license:${licenseKey}`,
      JSON.stringify(license)
    );
  }
}

/**
 * Handle dispute won event - Reactivate license
 */
async function handleDisputeWonEvent(payload: any, c: any): Promise<void> {
  const licenseKey = payload.license_key;
  const license = await c.env.LICENSE_KEYS.get(`license:${licenseKey}`, 'json') as any;

  if (license) {
    license.isActive = true;
    license.disputed = false;
    license.disputeWon = true;
    license.updatedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `license:${licenseKey}`,
      JSON.stringify(license)
    );
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdatedEvent(payload: any, c: any): Promise<void> {
  const licenseKey = payload.license_key;
  const license = await c.env.LICENSE_KEYS.get(`license:${licenseKey}`, 'json') as any;

  if (license) {
    license.subscriptionId = payload.subscription_id;
    license.updatedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `license:${licenseKey}`,
      JSON.stringify(license)
    );
  }
}

/**
 * Handle subscription ended event
 */
async function handleSubscriptionEndedEvent(payload: any, c: any): Promise<void> {
  const licenseKey = payload.license_key;
  const license = await c.env.LICENSE_KEYS.get(`license:${licenseKey}`, 'json') as any;

  if (license) {
    license.subscriptionEndedAt = payload.subscription_ended_at || Date.now();
    license.isActive = false;
    license.updatedAt = Date.now();

    await c.env.LICENSE_KEYS.put(
      `license:${licenseKey}`,
      JSON.stringify(license)
    );
  }
}

/**
 * Calculate next reset date (first of next month)
 */
function getNextResetDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
