import type { IService } from './base/IService';
import type { ArchiveService } from './ArchiveService';
import type { MarkdownConverter } from './MarkdownConverter';
import type { VaultManager } from './VaultManager';
import type { MediaHandler, MediaResult } from './MediaHandler';
import type { PostData } from '@/types/post';
import type { ArchiveOptions, ArchiveResult, ArchiveProgress } from '@/types/archive';
import type { TFile } from 'obsidian';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  archiveService: ArchiveService;
  markdownConverter: MarkdownConverter;
  vaultManager: VaultManager;
  mediaHandler: MediaHandler;
  enableCache?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Extended orchestrator options
 */
export interface OrchestratorOptions extends ArchiveOptions {
  customTemplate?: string;
  organizationStrategy?: 'platform' | 'date' | 'flat';
  abortSignal?: AbortSignal;
}

/**
 * Orchestrator events
 */
export type OrchestratorEvent =
  | { type: 'progress'; data: ArchiveProgress }
  | { type: 'stage-complete'; data: { stage: ArchiveProgress['stage'] } }
  | { type: 'error'; data: Error }
  | { type: 'cancelled'; data: void };

/**
 * Event listener type
 */
export type EventListener = (event: OrchestratorEvent) => void;

/**
 * Simple EventEmitter implementation
 */
class EventEmitter {
  private listeners: Map<string, Set<EventListener>> = new Map();

  on(eventType: string, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  off(eventType: string, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  emit(event: OrchestratorEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

/**
 * Cache entry
 */
interface CacheEntry {
  postData: PostData;
  timestamp: Date;
  filePath: string;
}

/**
 * Transaction state for rollback
 */
interface TransactionState {
  createdFiles: TFile[];
  createdMediaFiles: TFile[];
}

/**
 * Retry utility
 */
class RetryHelper {
  /**
   * Execute function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries: number;
      retryDelay: number;
      onRetry?: (attempt: number, error: Error) => void;
    }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt === options.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryable(lastError)) {
          throw lastError;
        }

        // Notify retry attempt
        options.onRetry?.(attempt + 1, lastError);

        // Wait before retry with exponential backoff
        const delay = options.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private static isRetryable(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Network',
      'timeout',
      'rate limit',
    ];

    const message = error.message.toLowerCase();
    return retryableErrors.some(pattern =>
      message.includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * ArchiveOrchestrator - Main coordinator for archive workflow
 *
 * Single Responsibility: Workflow orchestration and coordination
 */
export class ArchiveOrchestrator implements IService<ArchiveResult> {
  private archiveService: ArchiveService;
  private markdownConverter: MarkdownConverter;
  private vaultManager: VaultManager;
  private mediaHandler: MediaHandler;
  private eventEmitter: EventEmitter;
  private cache: Map<string, CacheEntry>;
  private enableCache: boolean;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: OrchestratorConfig) {
    this.archiveService = config.archiveService;
    this.markdownConverter = config.markdownConverter;
    this.vaultManager = config.vaultManager;
    this.mediaHandler = config.mediaHandler;
    this.eventEmitter = new EventEmitter();
    this.cache = new Map();
    this.enableCache = config.enableCache ?? true;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  async initialize(): Promise<void> {
    // Initialize all services
    await Promise.all([
      this.archiveService.initialize?.(),
      this.markdownConverter.initialize?.(),
      this.vaultManager.initialize?.(),
      this.mediaHandler.initialize?.(),
    ]);
  }

  async dispose(): Promise<void> {
    // Clean up all services
    await Promise.all([
      this.archiveService.dispose?.(),
      this.markdownConverter.dispose?.(),
      this.vaultManager.dispose?.(),
      this.mediaHandler.dispose?.(),
    ]);

    // Clear cache and listeners
    this.cache.clear();
    this.eventEmitter.removeAllListeners();
  }

  async isHealthy(): Promise<boolean> {
    // Check all services are healthy
    const healthChecks = await Promise.all([
      this.archiveService.isHealthy?.() ?? true,
      this.markdownConverter.isHealthy?.() ?? true,
      this.vaultManager.isHealthy?.() ?? true,
      this.mediaHandler.isHealthy?.() ?? true,
    ]);

    return healthChecks.every(healthy => healthy);
  }

  /**
   * Register event listener
   */
  on(eventType: string, listener: EventListener): void {
    this.eventEmitter.on(eventType, listener);
  }

  /**
   * Unregister event listener
   */
  off(eventType: string, listener: EventListener): void {
    this.eventEmitter.off(eventType, listener);
  }

  /**
   * Main orchestration method
   */
  async orchestrate(
    url: string,
    options: OrchestratorOptions = {
      enableAI: false,
      downloadMedia: true,
      removeTracking: true,
      generateShareLink: false,
      deepResearch: false,
    }
  ): Promise<ArchiveResult> {
    const transaction: TransactionState = {
      createdFiles: [],
      createdMediaFiles: [],
    };

    try {
      // Check cancellation
      this.checkCancellation(options.abortSignal);

      // Check cache
      if (this.enableCache) {
        const cached = this.checkCache(url);
        if (cached) {
          return {
            success: true,
            filePath: cached.filePath,
            creditsUsed: 0, // Cached result
          };
        }
      }

      // Stage 1: Validate URL
      this.emitProgress('fetching', 0, 'Validating URL...');
      await this.validateUrl(url);

      // Stage 2: Detect platform
      this.emitProgress('fetching', 5, 'Detecting platform...');
      const platform = this.archiveService.detectPlatform(url);

      // Stage 3: Fetch post data with retry
      this.emitProgress('fetching', 10, 'Fetching post data...');
      const postData = await RetryHelper.withRetry(
        () => this.archiveService.archivePost(url, options, (progress) => {
          // Map archive progress (0-100) to fetching stage (10-50)
          const mappedProgress = 10 + (progress * 0.4);
          this.emitProgress('fetching', Math.round(mappedProgress), 'Fetching post data...');
        }),
        {
          maxRetries: this.maxRetries,
          retryDelay: this.retryDelay,
          onRetry: (attempt, error) => {
            this.emitProgress(
              'fetching',
              10,
              `Retry attempt ${attempt}/${this.maxRetries}: ${error.message}`
            );
          },
        }
      );

      this.checkCancellation(options.abortSignal);
      this.emitStageComplete('fetching');

      // Stage 4: Download media (if enabled)
      let mediaResults: MediaResult[] = [];
      if (options.downloadMedia && postData.media.length > 0) {
        this.emitProgress('downloading', 50, 'Downloading media files...');

        mediaResults = await RetryHelper.withRetry(
          () => this.mediaHandler.downloadMedia(
            postData.media,
            platform,
            postData.id,
            (downloaded, total) => {
              const progress = 50 + ((downloaded / total) * 20);
              this.emitProgress(
                'downloading',
                Math.round(progress),
                `Downloading media ${downloaded}/${total}...`
              );
            }
          ),
          {
            maxRetries: this.maxRetries,
            retryDelay: this.retryDelay,
            onRetry: (attempt, error) => {
              this.emitProgress(
                'downloading',
                50,
                `Retry media download ${attempt}/${this.maxRetries}: ${error.message}`
              );
            },
          }
        );

        transaction.createdMediaFiles = mediaResults.map(r => r.file);
        this.checkCancellation(options.abortSignal);
        this.emitStageComplete('downloading');
      } else {
        this.emitProgress('downloading', 70, 'Skipping media download...');
      }

      // Stage 5: Convert to markdown
      this.emitProgress('processing', 70, 'Converting to markdown...');
      const markdown = await this.markdownConverter.convert(
        postData,
        options.customTemplate
      );

      // Update frontmatter with credits used
      markdown.frontmatter.credits_used = this.calculateCreditsUsed(options);

      // Update media paths in markdown if downloaded
      if (mediaResults.length > 0) {
        // Replace media URLs with local paths in markdown
        // This would require updating the markdown content
        // For now, the MarkdownConverter handles this
      }

      this.checkCancellation(options.abortSignal);
      this.emitStageComplete('processing');

      // Stage 6: Save to vault
      this.emitProgress('saving', 80, 'Saving to vault...');
      const filePath = await this.vaultManager.savePost(postData, markdown);
      const file = this.vaultManager.getFileByPath(filePath);

      if (!file) {
        throw new Error('Failed to retrieve saved file');
      }

      transaction.createdFiles.push(file);
      this.checkCancellation(options.abortSignal);
      this.emitStageComplete('saving');

      // Stage 7: Generate share link (if enabled)
      let shareUrl: string | undefined;
      if (options.generateShareLink) {
        this.emitProgress('saving', 90, 'Generating share link...');
        // TODO: Implement share link generation
        // This would call a share service to upload and get URL
      }

      // Stage 8: Cache result
      if (this.enableCache) {
        this.cacheResult(url, postData, filePath);
      }

      // Complete
      this.emitProgress('complete', 100, 'Archive complete!');
      this.emitStageComplete('complete');

      return {
        success: true,
        filePath,
        shareUrl,
        creditsUsed: this.calculateCreditsUsed(options),
      };

    } catch (error) {
      // Emit error event
      const err = error instanceof Error ? error : new Error(String(error));
      this.eventEmitter.emit({ type: 'error', data: err });

      // Check if cancelled
      if (this.isCancellationError(error)) {
        this.eventEmitter.emit({ type: 'cancelled', data: undefined });
        await this.rollback(transaction);

        return {
          success: false,
          error: 'Archive cancelled by user',
          creditsUsed: 0,
        };
      }

      // Rollback transaction
      await this.rollback(transaction);

      return {
        success: false,
        error: err.message,
        creditsUsed: 0,
      };
    }
  }

  /**
   * Validate URL
   */
  private async validateUrl(url: string): Promise<void> {
    if (!this.archiveService.validateUrl(url)) {
      throw new Error('Invalid URL format');
    }
  }

  /**
   * Check cache for existing result
   */
  private checkCache(url: string): CacheEntry | null {
    const cached = this.cache.get(url);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid (e.g., within 1 hour)
    const cacheAge = Date.now() - cached.timestamp.getTime();
    const maxAge = 60 * 60 * 1000; // 1 hour

    if (cacheAge > maxAge) {
      this.cache.delete(url);
      return null;
    }

    return cached;
  }

  /**
   * Cache result
   */
  private cacheResult(url: string, postData: PostData, filePath: string): void {
    this.cache.set(url, {
      postData,
      filePath,
      timestamp: new Date(),
    });
  }

  /**
   * Calculate credits used based on options
   */
  private calculateCreditsUsed(options: OrchestratorOptions): number {
    if (options.deepResearch) {
      return 5;
    }
    if (options.enableAI) {
      return 3;
    }
    return 1;
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    stage: ArchiveProgress['stage'],
    progress: number,
    message: string
  ): void {
    this.eventEmitter.emit({
      type: 'progress',
      data: { stage, progress, message },
    });
  }

  /**
   * Emit stage complete event
   */
  private emitStageComplete(stage: ArchiveProgress['stage']): void {
    this.eventEmitter.emit({
      type: 'stage-complete',
      data: { stage },
    });
  }

  /**
   * Check if operation is cancelled
   */
  private checkCancellation(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }
  }

  /**
   * Check if error is cancellation error
   */
  private isCancellationError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('cancelled') || error.message.includes('abort');
    }
    return false;
  }

  /**
   * Rollback transaction - delete created files
   */
  private async rollback(transaction: TransactionState): Promise<void> {
    try {
      // Delete created media files
      await Promise.all(
        transaction.createdMediaFiles.map(file =>
          this.mediaHandler.deleteMedia(file).catch(err => {
            console.error(`Failed to rollback media file ${file.path}:`, err);
          })
        )
      );

      // Delete created note files
      await Promise.all(
        transaction.createdFiles.map(file =>
          this.vaultManager.deleteFile(file).catch(err => {
            console.error(`Failed to rollback file ${file.path}:`, err);
          })
        )
      );
    } catch (error) {
      console.error('Rollback failed:', error);
      // Don't throw - rollback should be best-effort
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    urls: string[];
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entries = Array.from(this.cache.entries());

    return {
      size: entries.length,
      urls: entries.map(([url]) => url),
      oldestEntry: entries.length > 0
        ? entries.reduce((oldest, [, entry]) =>
            entry.timestamp < oldest ? entry.timestamp : oldest,
            entries[0][1].timestamp
          )
        : undefined,
      newestEntry: entries.length > 0
        ? entries.reduce((newest, [, entry]) =>
            entry.timestamp > newest ? entry.timestamp : newest,
            entries[0][1].timestamp
          )
        : undefined,
    };
  }
}
