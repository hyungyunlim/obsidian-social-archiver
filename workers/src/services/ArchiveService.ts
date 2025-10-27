/**
 * Archive Service
 *
 * Main orchestrator for archiving social media posts
 *
 * Single Responsibility: Coordinate BrightData scraping and AI analysis
 */

import type { Bindings } from '@/types/bindings';
import type { Platform, PostData, ArchiveJobData, ArchiveResult } from '@/types/post';
import { BrightDataService } from './BrightDataService';
import { PerplexityService } from './PerplexityService';
import { Logger } from '@/utils/logger';

export interface ArchiveOptions {
  enableAI?: boolean;
  deepResearch?: boolean;
  downloadMedia?: boolean;
}

/**
 * Platform detection patterns
 */
const PLATFORM_PATTERNS: Array<[Platform, RegExp]> = [
  ['facebook', /(?:facebook\.com|fb\.com|fb\.watch)/i],
  ['linkedin', /linkedin\.com/i],
  ['instagram', /instagram\.com/i],
  ['tiktok', /tiktok\.com/i],
  ['x', /(?:x\.com|twitter\.com)/i],
  ['threads', /threads\.net/i],
];

export class ArchiveService {
  private brightData: BrightDataService;
  private perplexity?: PerplexityService;
  private env: Bindings;
  private logger: Logger;

  constructor(env: Bindings, logger: Logger) {
    this.env = env;
    this.logger = logger;
    this.brightData = new BrightDataService(env, logger);

    // Initialize Perplexity if API key is available
    if (env.PERPLEXITY_API_KEY) {
      this.perplexity = new PerplexityService(env, logger);
    }
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): Platform {
    for (const [platform, pattern] of PLATFORM_PATTERNS) {
      if (pattern.test(url)) {
        return platform;
      }
    }
    throw new Error('Unsupported platform or invalid URL');
  }

  /**
   * Validate URL format
   */
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Trigger archive job (non-blocking, returns snapshot_id for polling)
   */
  async triggerArchive(
    url: string,
    options: ArchiveOptions = {}
  ): Promise<string> {
    // Validate URL
    if (!this.validateUrl(url)) {
      throw new Error('Invalid URL format');
    }

    // Detect platform
    const platform = this.detectPlatform(url);

    this.logger.info('Triggering archive collection', { url, platform });

    // Trigger BrightData collection and get snapshot_id
    const snapshotId = await this.brightData.triggerCollectionOnly(url, platform);

    return snapshotId;
  }

  /**
   * Trigger archive job via webhook (non-blocking)
   * Returns snapshot_id immediately, BrightData will deliver results via webhook
   * NOTE: BrightData webhooks are unreliable, prefer triggerArchive() with polling
   */
  async triggerArchiveViaWebhook(
    url: string,
    webhookUrl: string,
    options: ArchiveOptions = {}
  ): Promise<string> {
    // Validate URL
    if (!this.validateUrl(url)) {
      throw new Error('Invalid URL format');
    }

    // Detect platform
    const platform = this.detectPlatform(url);

    this.logger.info('Triggering archive via webhook', { url, platform, webhookUrl });

    // Trigger BrightData collection with webhook delivery
    const snapshotId = await this.brightData.fetchPostViaWebhook({ url, platform }, webhookUrl);

    return snapshotId;
  }

  /**
   * Archive a post (legacy polling method - kept for compatibility)
   */
  async archivePost(
    url: string,
    options: ArchiveOptions = {}
  ): Promise<ArchiveResult> {
    const startTime = Date.now();

    this.logger.info('Starting archive process', { url, options });

    try {
      // Validate URL
      if (!this.validateUrl(url)) {
        throw new Error('Invalid URL format');
      }

      // Detect platform
      const platform = this.detectPlatform(url);
      this.logger.info('Platform detected', { url, platform });

      // Check cache first
      const cacheKey = `post:${platform}:${this.hashUrl(url)}`;
      const cached = await this.checkCache(cacheKey, options);
      if (cached) {
        this.logger.info('Returning cached result', { url, cacheKey });
        return {
          ...cached,
          cached: true,
          processingTime: Date.now() - startTime,
        };
      }

      // Fetch post data from BrightData
      const postData = await this.brightData.fetchPost({ url, platform });

      // Apply AI analysis if enabled
      if (options.enableAI && this.perplexity) {
        this.logger.info('Applying AI analysis', { url, deepResearch: options.deepResearch });

        const analysis = options.deepResearch
          ? await this.perplexity.deepResearch(postData)
          : await this.perplexity.analyzePost(postData, {
              enableFactCheck: options.deepResearch,
            });

        postData.ai = analysis;
      } else if (options.enableAI && !this.perplexity) {
        this.logger.warn('AI analysis requested but PERPLEXITY_API_KEY not configured', { url });
      }

      // Calculate credits used
      const creditsUsed = this.calculateCredits(options);

      // Cache the result
      await this.cacheResult(cacheKey, postData, creditsUsed);

      const result: ArchiveResult = {
        postData,
        creditsUsed,
        processingTime: Date.now() - startTime,
        cached: false,
      };

      this.logger.info('Archive completed successfully', {
        url,
        platform,
        creditsUsed,
        processingTime: result.processingTime,
        hasAI: !!postData.ai,
      });

      return result;

    } catch (error) {
      this.logger.error('Archive failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Check cache for existing result
   */
  private async checkCache(
    cacheKey: string,
    options: ArchiveOptions
  ): Promise<ArchiveResult | null> {
    try {
      const cached = await this.env.ARCHIVE_CACHE.get(cacheKey, 'json') as ArchiveResult | null;

      if (!cached) {
        return null;
      }

      // Validate cache has required data
      if (!cached.postData || !cached.creditsUsed) {
        return null;
      }

      // Check if cache has AI data when requested
      if (options.enableAI && !cached.postData.ai) {
        // Need fresh fetch with AI
        return null;
      }

      // Check if cache has deep research when requested
      if (options.deepResearch && !cached.postData.ai?.factCheck) {
        // Need fresh fetch with deep research
        return null;
      }

      return cached;

    } catch (error) {
      this.logger.warn('Cache check failed', {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache the result
   */
  private async cacheResult(
    cacheKey: string,
    postData: PostData,
    creditsUsed: number
  ): Promise<void> {
    try {
      const result: ArchiveResult = {
        postData,
        creditsUsed,
        processingTime: 0, // Will be set when retrieved
        cached: false,
      };

      // Cache for 24 hours
      await this.env.ARCHIVE_CACHE.put(
        cacheKey,
        JSON.stringify(result),
        { expirationTtl: 86400 }
      );

      this.logger.debug('Result cached', { cacheKey });

    } catch (error) {
      // Cache failure shouldn't break the flow
      this.logger.warn('Failed to cache result', {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Calculate credits based on options
   */
  private calculateCredits(options: ArchiveOptions): number {
    let credits = 1; // Base cost for scraping

    if (options.enableAI) {
      credits += 2; // AI analysis cost
    }

    if (options.deepResearch) {
      credits += 2; // Deep research cost
    }

    return credits;
  }

  /**
   * Hash URL for cache key
   */
  private hashUrl(url: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create job data for async processing
   */
  createJobData(
    url: string,
    options: ArchiveOptions,
    licenseKey?: string
  ): ArchiveJobData {
    const platform = this.detectPlatform(url);
    const creditsRequired = this.calculateCredits(options);

    return {
      url,
      platform,
      options: {
        enableAI: options.enableAI ?? false,
        deepResearch: options.deepResearch ?? false,
        downloadMedia: options.downloadMedia ?? true,
      },
      licenseKey,
      creditsRequired,
    };
  }

  /**
   * Process archive job (for background processing)
   */
  async processJob(jobData: ArchiveJobData): Promise<ArchiveResult> {
    return this.archivePost(jobData.url, jobData.options);
  }
}