/**
 * ShareAPIClient - Client service for communicating with Workers share API
 *
 * Features:
 * - POST /api/share endpoint integration
 * - Authentication with license keys
 * - Rate limiting detection and handling
 * - Exponential backoff retry logic
 * - Password protection and custom expiry support
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import type { PostData } from '@/types/post';
import type { IService } from './base/IService';
import {
  HttpError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  ServerError
} from '@/types/errors/http-errors';

/**
 * Share API request interface
 */
export interface ShareAPIRequest {
  postData?: PostData;
  // Legacy format (for backwards compatibility)
  content?: string;
  metadata?: {
    title: string;
    platform: string;
    author: string;
    originalUrl: string;
    tags?: string[];
    thumbnail?: string;
  };
  options?: {
    expiry?: number; // Unix timestamp
    password?: string;
    username?: string;
    shareId?: string; // For updates
  };
}

/**
 * Share API response interface
 */
export interface ShareAPIResponse {
  shareId: string;
  shareUrl: string;
  expiresAt?: number;
  passwordProtected: boolean;
}

/**
 * Share API client configuration
 */
export interface ShareAPIConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  debug?: boolean;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry: (error: HttpError) => boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<ShareAPIConfig, 'apiKey'>> = {
  baseURL: 'https://api.social-archiver.junlim.org',
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second base delay
  debug: false
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 32000, // 32 seconds
  shouldRetry: (error: HttpError) => {
    // Retry on network errors
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return true;
    }

    // Retry on rate limiting
    if (error instanceof RateLimitError) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error instanceof ServerError) {
      return true;
    }

    // Don't retry on client errors (4xx)
    if (error instanceof AuthenticationError || error instanceof InvalidRequestError) {
      return false;
    }

    return false;
  }
};

/**
 * ShareAPIClient service for Workers API integration
 */
export class ShareAPIClient implements IService {
  name = 'ShareAPIClient';
  private client: AxiosInstance;
  private config: Required<Omit<ShareAPIConfig, 'apiKey'>> & Pick<ShareAPIConfig, 'apiKey'>;
  private retryConfig: RetryConfig;

  constructor(config: ShareAPIConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.retryConfig = DEFAULT_RETRY_CONFIG;

    // Create axios instance
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'obsidian-social-archiver',
        'X-Version': '1.0.0'
      }
    });

    // Setup interceptors
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for request/response handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication if API key is provided
        if (this.config.apiKey) {
          config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          config.headers['X-License-Key'] = this.config.apiKey;
        }

        // Add request ID for tracing
        config.headers['X-Request-Id'] = this.generateRequestId();

        // Log request if debug mode
        if (this.config.debug) {
          console.log('[ShareAPIClient] Request:', {
            method: config.method,
            url: config.url,
            headers: config.headers,
            data: config.data
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log response if debug mode
        if (this.config.debug) {
          console.log('[ShareAPIClient] Response:', {
            status: response.status,
            data: response.data,
            headers: response.headers
          });
        }

        return response;
      },
      (error) => {
        // Transform to standardized error
        const httpError = this.transformError(error);

        // Log error if debug mode
        if (this.config.debug) {
          console.error('[ShareAPIClient] Error:', httpError);
        }

        return Promise.reject(httpError);
      }
    );
  }

  /**
   * Create a share link for a post
   */
  async createShare(request: ShareAPIRequest): Promise<ShareAPIResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post<ShareAPIResponse>('/api/share', request);
      return response.data;
    });
  }

  /**
   * Update an existing share
   */
  async updateShare(shareId: string, request: ShareAPIRequest): Promise<ShareAPIResponse> {
    // Add shareId to options for update
    const updateRequest: ShareAPIRequest = {
      ...request,
      options: {
        ...request.options,
        shareId
      }
    };

    return this.executeWithRetry(async () => {
      const response = await this.client.post<ShareAPIResponse>('/api/share', updateRequest);
      return response.data;
    });
  }

  /**
   * Delete a share link
   */
  async deleteShare(shareId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.delete(`/api/share/${shareId}`);
    });
  }

  /**
   * Get share status/info
   */
  async getShareInfo(shareId: string): Promise<ShareAPIResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<ShareAPIResponse>(`/api/share/${shareId}`);
      return response.data;
    });
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const httpError = error as HttpError;

      // Check if we should retry
      if (attempt >= this.retryConfig.maxAttempts - 1) {
        throw httpError;
      }

      if (!this.retryConfig.shouldRetry(httpError)) {
        throw httpError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateRetryDelay(attempt, httpError);

      if (this.config.debug) {
        console.log(`[ShareAPIClient] Retrying after ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxAttempts})`);
      }

      // Wait before retry
      await this.sleep(delay);

      // Retry the operation
      return this.executeWithRetry(operation, attempt + 1);
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, error: HttpError): number {
    // Use retry-after header if available (for rate limiting)
    if (error instanceof RateLimitError && error.retryAfter) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Exponential backoff: delay = base * 2^attempt
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelay);

    // Add jitter (±25% randomization) to prevent thundering herd
    const jitter = cappedDelay * 0.25;
    const jitteredDelay = cappedDelay + (Math.random() * 2 - 1) * jitter;

    return Math.round(Math.max(jitteredDelay, 0));
  }

  /**
   * Sleep helper for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Transform axios error to standardized HttpError
   */
  private transformError(error: unknown): HttpError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      // Network errors
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return new TimeoutError(
          axiosError.message || 'Request timeout',
          this.createRequestConfig(axiosError.config)
        );
      }

      if (!axiosError.response) {
        return new NetworkError(
          axiosError.message || 'Network error',
          this.createRequestConfig(axiosError.config),
          axiosError
        );
      }

      const status = axiosError.response.status;
      const data = axiosError.response.data;
      const headers = axiosError.response.headers as Record<string, string>;

      // Rate limiting
      if (status === 429) {
        const retryAfter = headers['retry-after'] ? parseInt(headers['retry-after'], 10) : undefined;
        return new RateLimitError(
          data?.message || 'Rate limit exceeded',
          {
            statusCode: status,
            request: this.createRequestConfig(axiosError.config),
            response: this.createResponse(axiosError.response),
            retryAfter,
            limit: headers['x-ratelimit-limit'] ? parseInt(headers['x-ratelimit-limit'], 10) : undefined,
            remaining: headers['x-ratelimit-remaining'] ? parseInt(headers['x-ratelimit-remaining'], 10) : undefined
          }
        );
      }

      // Authentication errors
      if (status === 401 || status === 403) {
        return new AuthenticationError(
          data?.message || 'Authentication failed',
          status,
          this.createRequestConfig(axiosError.config),
          this.createResponse(axiosError.response)
        );
      }

      // Invalid request errors
      if (status === 400 || status === 422) {
        return new InvalidRequestError(
          data?.message || 'Invalid request',
          status,
          {
            request: this.createRequestConfig(axiosError.config),
            response: this.createResponse(axiosError.response),
            validationErrors: data?.errors
          }
        );
      }

      // Server errors
      if (status >= 500) {
        return new ServerError(
          data?.message || 'Server error',
          status,
          this.createRequestConfig(axiosError.config),
          this.createResponse(axiosError.response)
        );
      }

      // Generic HTTP error
      return new HttpError(
        data?.message || axiosError.message || 'HTTP error',
        status,
        this.createRequestConfig(axiosError.config),
        this.createResponse(axiosError.response)
      );
    }

    // Non-axios error
    if (error instanceof Error) {
      return new HttpError(error.message, 0);
    }

    return new HttpError('Unknown error', 0);
  }

  /**
   * Create request config from axios config
   */
  private createRequestConfig(config?: AxiosRequestConfig): any {
    if (!config) return undefined;

    return {
      method: config.method?.toUpperCase() || 'GET',
      url: config.url || '',
      headers: config.headers as Record<string, string>,
      params: config.params,
      data: config.data,
      timeout: config.timeout
    };
  }

  /**
   * Create response from axios response
   */
  private createResponse(response?: AxiosResponse): any {
    if (!response) return undefined;

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      config: this.createRequestConfig(response.config),
      duration: 0
    };
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Helper method to add password protection to a share request
   */
  static addPasswordProtection(
    request: ShareAPIRequest,
    password: string
  ): ShareAPIRequest {
    return {
      ...request,
      options: {
        ...request.options,
        password
      }
    };
  }

  /**
   * Helper method to set custom expiry date
   */
  static setExpiryDate(
    request: ShareAPIRequest,
    expiryDate: Date,
    tier: 'free' | 'pro' = 'free'
  ): ShareAPIRequest {
    // Validate expiry based on tier
    const now = new Date();
    const maxFreeExpiry = new Date();
    maxFreeExpiry.setDate(maxFreeExpiry.getDate() + 30);

    if (tier === 'free' && expiryDate > maxFreeExpiry) {
      throw new Error('Free tier: Maximum expiry is 30 days');
    }

    if (expiryDate <= now) {
      throw new Error('Expiry date must be in the future');
    }

    return {
      ...request,
      options: {
        ...request.options,
        expiry: Math.floor(expiryDate.getTime() / 1000) // Convert to Unix timestamp
      }
    };
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return true;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // No initialization needed
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}