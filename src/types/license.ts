/**
 * License and Gumroad API types
 */

/**
 * License providers
 */
export type LicenseProvider = 'gumroad' | 'lemonsqueezy' | 'paddle';

/**
 * License information
 */
export interface LicenseInfo {
  /** License key */
  licenseKey: string;
  /** Provider */
  provider: LicenseProvider;
  /** Product ID */
  productId: string;
  /** User email */
  email: string;
  /** Purchase date */
  purchaseDate: Date;
  /** Expiration date (null for lifetime) */
  expiresAt: Date | null;
  /** Activated devices */
  devices: DeviceInfo[];
  /** Whether license is active */
  isActive: boolean;
  /** Whether license is in grace period */
  inGracePeriod?: boolean;
  /** Grace period end date */
  gracePeriodEndsAt?: Date;
}

/**
 * Device information for license tracking
 */
export interface DeviceInfo {
  /** Device UUID */
  id: string;
  /** Device name */
  name: string;
  /** Platform (darwin, win32, linux) */
  platform: string;
  /** Activation date */
  activatedAt: Date;
  /** Last seen date */
  lastSeenAt: Date;
  /** Whether this is the current device */
  isCurrent?: boolean;
}

/**
 * Credit balance information
 */
export interface CreditBalance {
  /** Total credits for current period */
  total: number;
  /** Credits used in current period */
  used: number;
  /** Credits remaining */
  remaining: number;
  /** Next reset date */
  resetAt: Date;
  /** Credits carried over from previous period */
  carryover: number;
}

/**
 * Credit transaction log entry
 */
export interface CreditTransactionLog {
  /** Transaction ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Operation type */
  operation: 'basic_archive' | 'with_ai' | 'deep_research';
  /** Credits used */
  creditsUsed: number;
  /** Remaining balance after transaction */
  remainingBalance: number;
  /** Post URL */
  postUrl?: string;
  /** Platform */
  platform?: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Gumroad API response for license verification
 */
export interface GumroadLicenseResponse {
  success: boolean;
  uses: number;
  purchase: {
    seller_id: string;
    product_id: string;
    product_name: string;
    permalink: string;
    product_permalink: string;
    email: string;
    price: number;
    gumroad_fee: number;
    currency: string;
    quantity: number;
    discover_fee_charged: boolean;
    can_contact: boolean;
    referrer: string;
    order_number: number;
    sale_id: string;
    sale_timestamp: string;
    license_key: string;
    ip_country: string;
    refunded: boolean;
    disputed: boolean;
    dispute_won: boolean;
    chargebacked: boolean;
    subscription_id?: string;
    subscription_ended_at?: string;
    subscription_cancelled_at?: string;
    subscription_failed_at?: string;
    variants?: string;
    custom_fields?: Record<string, string>;
  };
}

/**
 * Gumroad API error response
 */
export interface GumroadErrorResponse {
  success: false;
  message: string;
}

/**
 * License validation result
 */
export interface LicenseValidationResult {
  /** Whether license is valid */
  valid: boolean;
  /** License information if valid */
  license?: LicenseInfo;
  /** Error message if invalid */
  error?: string;
  /** Error code */
  errorCode?: LicenseErrorCode;
}

/**
 * License error codes
 */
export enum LicenseErrorCode {
  INVALID_KEY = 'INVALID_KEY',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
  CHARGEBACKED = 'CHARGEBACKED',
  DEVICE_LIMIT_EXCEEDED = 'DEVICE_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * License storage data (encrypted)
 */
export interface StoredLicenseData {
  /** Encrypted license key */
  encryptedKey: string;
  /** Initialization vector for encryption */
  iv: string;
  /** Cached license info */
  cachedInfo?: LicenseInfo;
  /** Cache timestamp */
  cachedAt?: number;
  /** Device ID */
  deviceId: string;
  /** Integrity hash (SHA-256 of encrypted data) */
  integrityHash?: string;
}

/**
 * License configuration
 */
export interface LicenseConfig {
  /** Gumroad product ID */
  productId: string;
  /** Maximum devices per license */
  maxDevices: number;
  /** Cache duration in milliseconds (24 hours default) */
  cacheDuration: number;
  /** Grace period in days after expiration */
  gracePeriodDays: number;
  /** Offline grace period in days */
  offlineGracePeriodDays: number;
}

/**
 * Default license configuration
 */
export const DEFAULT_LICENSE_CONFIG: LicenseConfig = {
  productId: '', // To be set from settings
  maxDevices: 5,
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
  gracePeriodDays: 3,
  offlineGracePeriodDays: 7,
};

/**
 * Credit cost definitions
 */
export enum CreditCost {
  BASIC_ARCHIVE = 1,
  WITH_AI = 3,
  DEEP_RESEARCH = 5,
}

/**
 * Plan credit allowances
 */
export interface PlanAllowance {
  /** Monthly credit allowance */
  monthlyCredits: number;
  /** Maximum credit rollover */
  maxRollover: number;
  /** Features included */
  features: string[];
}

/**
 * Plan allowances by tier
 */
export const PLAN_ALLOWANCES: Record<'free' | 'pro', PlanAllowance> = {
  free: {
    monthlyCredits: 10,
    maxRollover: 0,
    features: ['basic_archive'],
  },
  pro: {
    monthlyCredits: 500,
    maxRollover: 100,
    features: ['basic_archive', 'with_ai', 'deep_research', 'custom_domain', 'permanent_share'],
  },
};

/**
 * Webhook event types from Gumroad
 */
export enum GumroadWebhookEvent {
  SALE = 'sale',
  REFUND = 'refund',
  DISPUTE = 'dispute',
  DISPUTE_WON = 'dispute_won',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_ENDED = 'subscription_ended',
  SUBSCRIPTION_RESTARTED = 'subscription_restarted',
}

/**
 * Gumroad webhook payload
 */
export interface GumroadWebhookPayload {
  seller_id: string;
  product_id: string;
  product_name: string;
  permalink: string;
  product_permalink: string;
  short_product_id: string;
  email: string;
  price: number;
  gumroad_fee: number;
  currency: string;
  quantity: number;
  discover_fee_charged: boolean;
  can_contact: boolean;
  referrer: string;
  card: {
    visual: string;
    type: string;
    bin: string;
    expiry_month: string;
    expiry_year: string;
  };
  order_number: number;
  sale_id: string;
  sale_timestamp: string;
  purchaser_id: string;
  subscription_id?: string;
  variants: string;
  test: boolean;
  license_key: string;
  ip_country: string;
  is_gift_receiver_purchase: boolean;
  refunded: boolean;
  disputed: boolean;
  dispute_won: boolean;
  custom_fields?: Record<string, string>;
}
