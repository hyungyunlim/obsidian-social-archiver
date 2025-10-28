import type { IService } from './base/IService';
import type { Vault, TFile } from 'obsidian';
import type { Media, Platform } from '@/types/post';
import { normalizePath } from 'obsidian';
import type { WorkersAPIClient } from './WorkersAPIClient';

/**
 * MediaHandler configuration
 */
export interface MediaHandlerConfig {
  vault: Vault;
  workersClient?: WorkersAPIClient; // Optional for proxy download
  basePath?: string;
  maxConcurrent?: number;
  maxImageDimension?: number;
  timeout?: number;
}

/**
 * Media download result
 */
export interface MediaResult {
  originalUrl: string;
  localPath: string;
  type: Media['type'];
  size: number;
  file: TFile;
}

/**
 * Download progress callback
 */
export type DownloadProgressCallback = (downloaded: number, total: number) => void;

/**
 * Media type detector
 */
class MediaTypeDetector {
  private static imageExtensions = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'
  ]);

  private static videoExtensions = new Set([
    'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'
  ]);

  private static audioExtensions = new Set([
    'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'
  ]);

  /**
   * Detect media type from URL or MIME type
   */
  static detect(url: string, mimeType?: string): Media['type'] {
    // Check MIME type first
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
    }

    // Check file extension
    const extension = this.getExtension(url);
    if (this.imageExtensions.has(extension)) return 'image';
    if (this.videoExtensions.has(extension)) return 'video';
    if (this.audioExtensions.has(extension)) return 'audio';

    return 'document';
  }

  /**
   * Validate media type
   */
  static validate(_type: Media['type'], data: ArrayBuffer): boolean {
    // Basic validation - check that data exists
    if (data.byteLength === 0) {
      return false;
    }

    // Could add more sophisticated validation here
    // (e.g., checking magic numbers for file type verification)
    return true;
  }

  /**
   * Get file extension from URL
   */
  private static getExtension(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('.');
      return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : '';
    } catch {
      return '';
    }
  }
}

/**
 * Media path generator
 */
class MediaPathGenerator {
  private basePath: string;

  constructor(basePath: string = 'attachments/social-archives') {
    this.basePath = basePath;
  }

  /**
   * Generate path for media file
   * Format: {basePath}/{platform}/{authorUsername}/
   */
  generatePath(platform: Platform, authorUsername: string, filename: string): string {
    const sanitized = this.sanitizeFilename(filename);
    const sanitizedAuthor = this.sanitizeFilename(authorUsername || 'unknown');
    return normalizePath(`${this.basePath}/${platform}/${sanitizedAuthor}/${sanitized}`);
  }

  /**
   * Generate filename from URL
   * Format: {date}-{authorUsername}-{postId}-{index}.{extension}
   */
  generateFilename(url: string, index: number, postId: string, authorUsername: string): string {
    try {
      // Get current date for archiving timestamp
      const now = new Date();
      const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      // Get extension
      const extension = this.getExtensionFromUrl(url) || 'bin';

      // Sanitize author username and postId
      const sanitizedAuthor = this.sanitizeFilename(authorUsername || 'unknown');
      const sanitizedPostId = this.sanitizeFilename(postId);

      // Format: YYYYMMDD-username-postId-index.ext
      return `${date}-${sanitizedAuthor}-${sanitizedPostId}-${index + 1}.${extension}`;
    } catch {
      return `media-${index + 1}.bin`;
    }
  }

  /**
   * Get extension from URL
   */
  private getExtensionFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('.');
      if (parts.length > 1) {
        const ext = parts[parts.length - 1]!.toLowerCase();
        // Remove query parameters
        return ext.split('?')[0] || null;
      }
    } catch {
      // Invalid URL
    }
    return null;
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '_')
      .trim();
  }
}

/**
 * Download queue manager using p-limit pattern
 */
class DownloadQueue {
  private maxConcurrent: number;
  private activeCount = 0;
  private queue: Array<() => Promise<void>> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add task to queue
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      this.queue.push(wrappedTask);
      this.processQueue();
    });
  }

  /**
   * Process queue
   */
  private processQueue(): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.activeCount++;
        task();
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { active: number; queued: number } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
    };
  }
}

/**
 * MediaHandler - Handles media file downloading and processing
 *
 * Single Responsibility: Media file management
 */
export class MediaHandler implements IService {
  private vault: Vault;
  private workersClient?: WorkersAPIClient;
  private pathGenerator: MediaPathGenerator;
  private downloadQueue: DownloadQueue;
  // Reserved for future use: image dimension processing
  // private _maxImageDimension: number;
  private timeout: number;

  constructor(config: MediaHandlerConfig) {
    this.vault = config.vault;
    this.workersClient = config.workersClient;
    this.pathGenerator = new MediaPathGenerator(config.basePath);
    this.downloadQueue = new DownloadQueue(config.maxConcurrent || 3);
    // this._maxImageDimension = config.maxImageDimension || 2048;
    this.timeout = config.timeout || 30000;
  }

  async initialize(): Promise<void> {
    // No async initialization needed
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    try {
      this.vault.getRoot();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download media files for a post
   */
  async downloadMedia(
    media: Media[],
    platform: Platform,
    postId: string,
    authorUsername: string,
    onProgress?: DownloadProgressCallback
  ): Promise<MediaResult[]> {
    const results: MediaResult[] = [];
    let completed = 0;
    const total = media.length;

    // Download all media files
    const downloadPromises = media.map((item, index) =>
      this.downloadQueue.add(async () => {
        const result = await this.downloadSingleMedia(item, platform, postId, authorUsername, index);
        results.push(result);
        completed++;
        onProgress?.(completed, total);
        return result;
      })
    );

    await Promise.all(downloadPromises);

    return results;
  }

  /**
   * Download a single media file
   */
  private async downloadSingleMedia(
    media: Media,
    platform: Platform,
    postId: string,
    authorUsername: string,
    index: number
  ): Promise<MediaResult> {
    try {
      // Download data
      const data = await this.downloadFromUrl(media.url);

      // Validate
      const detectedType = MediaTypeDetector.detect(media.url, media.mimeType);
      if (!MediaTypeDetector.validate(detectedType, data)) {
        throw new Error('Invalid media data');
      }

      // Process based on type
      let processedData = data;
      if (detectedType === 'image') {
        // Could optimize image here (resize, compress)
        // For now, just use original data
        processedData = data;
      }

      // Generate path and save
      const filename = this.pathGenerator.generateFilename(media.url, index, postId, authorUsername);
      const path = this.pathGenerator.generatePath(platform, authorUsername, filename);

      // Ensure parent folder exists
      await this.ensureFolderExists(this.getParentPath(path));

      // Save to vault
      const file = await this.vault.createBinary(path, processedData);

      return {
        originalUrl: media.url,
        localPath: file.path,
        type: detectedType,
        size: processedData.byteLength,
        file,
      };
    } catch (error) {
      throw new Error(
        `Failed to download media from ${media.url}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Download from URL with timeout
   * Uses Workers proxy if available (required for Instagram, TikTok, Threads due to CORS)
   */
  private async downloadFromUrl(url: string): Promise<ArrayBuffer> {
    // Use Workers proxy if available (bypasses CORS)
    if (this.workersClient) {
      try {
        console.log('[MediaHandler] Using Workers proxy for download:', url.substring(0, 100) + '...');
        return await this.workersClient.proxyMedia(url);
      } catch (error) {
        console.warn('[MediaHandler] Proxy download failed, falling back to direct fetch:', error);
        // Fall through to direct fetch
      }
    }

    // Fallback to direct fetch (may fail due to CORS)
    console.log('[MediaHandler] Using direct fetch for download:', url.substring(0, 100) + '...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.arrayBuffer();
      clearTimeout(timeoutId);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Download timeout');
      }

      throw error;
    }
  }

  /**
   * Ensure folder exists
   */
  private async ensureFolderExists(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);

    // Check if folder already exists
    const existing = this.vault.getFolderByPath(normalizedPath);
    if (existing) {
      return;
    }

    // Create parent folders recursively
    const parentPath = this.getParentPath(normalizedPath);
    if (parentPath && parentPath !== '.') {
      await this.ensureFolderExists(parentPath);
    }

    // Create this folder
    try {
      await this.vault.createFolder(normalizedPath);
    } catch (error) {
      // Folder might have been created by another operation
      const folder = this.vault.getFolderByPath(normalizedPath);
      if (!folder) {
        throw error;
      }
    }
  }

  /**
   * Get parent path
   */
  private getParentPath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 1) {
      return '.';
    }
    return parts.slice(0, -1).join('/');
  }

  /**
   * Delete media file
   */
  async deleteMedia(file: TFile): Promise<void> {
    try {
      await this.vault.delete(file);
    } catch (error) {
      throw new Error(
        `Failed to delete media ${file.path}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { active: number; queued: number } {
    return this.downloadQueue.getStatus();
  }

  /**
   * Cleanup orphaned media files
   * (Media files that don't have corresponding notes)
   */
  async cleanupOrphanedMedia(_dryRun: boolean = true): Promise<TFile[]> {
    const mediaFolder = this.vault.getFolderByPath(this.pathGenerator['basePath']);
    if (!mediaFolder) {
      return [];
    }

    const orphaned: TFile[] = [];

    // This would require checking which media files are referenced in notes
    // For now, just return empty array
    // A full implementation would:
    // 1. Scan all media files
    // 2. Search all notes for references to those files
    // 3. Identify unreferenced files
    // 4. Delete them (if not dry run)

    return orphaned;
  }
}
