import type { IService } from './base/IService';
import type { PostData, Platform } from '@/types/post';
import type { ArchiveOptions } from '@/types/archive';
import type { ArchiveRequest } from '@/types/api';
import { PostDataSchema } from '@/types/post';
import { ApiClient } from './ApiClient';

/**
 * ArchiveService configuration
 */
export interface ArchiveServiceConfig {
  apiClient: ApiClient;
  licenseKey?: string;
}

/**
 * Request builder for constructing platform-specific requests
 */
class RequestBuilder {
  /**
   * Detect platform from URL
   */
  static detectPlatform(url: string): Platform {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('facebook.com')) return 'facebook';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'x';
    if (urlLower.includes('threads.net')) return 'threads';

    throw new Error(`Unsupported platform: ${url}`);
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): void {
    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }

      // Basic format validation passed
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  /**
   * Build archive request
   */
  static buildRequest(
    url: string,
    options: ArchiveOptions,
    licenseKey?: string
  ): ArchiveRequest {
    this.validateUrl(url);

    return {
      url,
      options: {
        enableAI: options.enableAI,
        deepResearch: options.deepResearch,
        downloadMedia: options.downloadMedia,
      },
      licenseKey,
    };
  }
}

/**
 * Response transformer for converting API responses to PostData
 */
class ResponseTransformer {
  /**
   * Transform and validate API response to PostData
   */
  static transform(raw: unknown): PostData {
    try {
      // Validate using Zod schema
      const validated = PostDataSchema.parse(raw);

      // Convert to PostData format (remove schemaVersion)
      const { schemaVersion, ...postData } = validated;

      return postData as PostData;
    } catch (error) {
      throw new Error(
        `Invalid post data format: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sanitize and normalize post data
   */
  static sanitize(postData: PostData): PostData {
    return {
      ...postData,
      content: {
        text: this.sanitizeText(postData.content.text),
        html: postData.content.html
          ? this.sanitizeHtml(postData.content.html)
          : undefined,
        markdown: postData.content.markdown,
      },
      url: this.normalizeUrl(postData.url),
      author: {
        ...postData.author,
        url: this.normalizeUrl(postData.author.url),
      },
    };
  }

  /**
   * Sanitize text content
   */
  private static sanitizeText(text: string): string {
    // Remove null bytes
    return text.replace(/\0/g, '');
  }

  /**
   * Sanitize HTML content
   */
  private static sanitizeHtml(html: string): string {
    // Basic HTML sanitization (more comprehensive sanitization would use DOMPurify)
    // Remove script tags
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  /**
   * Normalize URL
   */
  private static normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return url;
    }
  }
}

/**
 * ArchiveService - Responsible for API orchestration
 * Handles communication with backend API for archiving posts
 *
 * Single Responsibility: API communication and response transformation
 */
export class ArchiveService implements IService<PostData> {
  private apiClient: ApiClient;
  private licenseKey?: string;

  constructor(config: ArchiveServiceConfig) {
    this.apiClient = config.apiClient;
    this.licenseKey = config.licenseKey;
  }

  async initialize(): Promise<void> {
    // Verify API client is ready
    const healthy = await this.apiClient.isHealthy();
    if (!healthy) {
      throw new Error('API client is not healthy');
    }
  }

  async dispose(): Promise<void> {
    // Cleanup handled by ApiClient
  }

  async isHealthy(): Promise<boolean> {
    return this.apiClient.isHealthy();
  }

  /**
   * Archive a post from URL
   * Main entry point for archiving operations
   */
  async archivePost(
    url: string,
    options: ArchiveOptions,
    onProgress?: (progress: number) => void
  ): Promise<PostData> {
    try {
      // Build request
      const request = RequestBuilder.buildRequest(
        url,
        options,
        this.licenseKey
      );

      // Submit archive job
      onProgress?.(10);
      const archiveResponse = await this.apiClient.archivePost(request);

      // Poll for completion
      onProgress?.(30);
      const rawResult = await this.apiClient.waitForJob(
        archiveResponse.jobId,
        (jobProgress) => {
          // Map job progress (0-100) to overall progress (30-90)
          const mappedProgress = 30 + (jobProgress * 0.6);
          onProgress?.(Math.round(mappedProgress));
        }
      );

      // Transform and validate response
      onProgress?.(90);
      const postData = ResponseTransformer.transform(rawResult);

      // Sanitize data
      const sanitized = ResponseTransformer.sanitize(postData);

      onProgress?.(100);
      return sanitized;
    } catch (error) {
      // Wrap and rethrow with context
      throw this.wrapError(error, url);
    }
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): Platform {
    return RequestBuilder.detectPlatform(url);
  }

  /**
   * Validate URL
   */
  validateUrl(url: string): boolean {
    try {
      RequestBuilder.validateUrl(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wrap errors with additional context
   */
  private wrapError(error: unknown, url: string): Error {
    if (error instanceof Error) {
      const wrappedError = new Error(
        `Failed to archive post from ${url}: ${error.message}`
      );
      wrappedError.name = 'ArchiveServiceError';
      wrappedError.cause = error;
      return wrappedError;
    }

    return new Error(`Failed to archive post from ${url}: Unknown error`);
  }
}
