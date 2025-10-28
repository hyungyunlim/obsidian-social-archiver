import type { Variables } from './context';

export interface Bindings {
  // KV Namespaces
  ARCHIVE_CACHE: KVNamespace;
  LICENSE_KEYS: KVNamespace;
  SHARE_LINKS: KVNamespace;

  // R2 Buckets
  R2_BUCKET?: R2Bucket;

  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  BRIGHTDATA_API_KEY?: string;
  BRIGHTDATA_WEBHOOK_AUTH?: string;
  PERPLEXITY_API_KEY?: string;
  GUMROAD_PRODUCT_ID?: string;
  GUMROAD_WEBHOOK_SECRET?: string;
  HMAC_SECRET?: string;

  // Rate limiter
  RATE_LIMITER?: RateLimiter;

  // Index signature for Hono compatibility
  [key: string]: unknown;
}

export interface RateLimiter {
  limit: (key: string) => Promise<{ success: boolean }>;
}

export interface Env {
  Bindings: Bindings;
  Variables: Variables;
}