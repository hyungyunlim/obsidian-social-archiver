/**
 * VaultStorageService
 *
 * Handles storage operations for user-created posts (platform: 'post').
 * Responsible for:
 * - File path generation for posts and media
 * - Saving media attachments to Vault
 * - Converting PostData to Markdown and saving to Vault
 *
 * Single Responsibility: User post storage operations
 */

import type { PostData, Media } from '../types/post';
import type { SocialArchiverSettings } from '../types/settings';
import { VaultManager } from './VaultManager';
import { MarkdownConverter } from './MarkdownConverter';
import { Vault, TFile, normalizePath } from 'obsidian';

/**
 * Media file save result
 */
export interface MediaSaveResult {
  originalFile: File;
  savedPath: string;
  url: string;
  error?: string;
}

/**
 * Post save result
 */
export interface PostSaveResult {
  file: TFile;
  path: string;
  mediaSaved: MediaSaveResult[];
}

/**
 * VaultStorageService configuration
 */
export interface VaultStorageServiceConfig {
  vault: Vault;
  settings: SocialArchiverSettings;
  vaultManager?: VaultManager;
  markdownConverter?: MarkdownConverter;
}

/**
 * VaultStorageService class
 */
export class VaultStorageService {
  private vault: Vault;
  private settings: SocialArchiverSettings;
  private vaultManager: VaultManager;
  private markdownConverter: MarkdownConverter;

  constructor(config: VaultStorageServiceConfig) {
    this.vault = config.vault;
    this.settings = config.settings;

    // Create VaultManager if not provided
    this.vaultManager = config.vaultManager || new VaultManager({
      vault: config.vault,
      basePath: config.settings.archivePath,
      organizationStrategy: 'platform',
    });

    // Create MarkdownConverter if not provided
    this.markdownConverter = config.markdownConverter || new MarkdownConverter();
  }

  /**
   * Generate file path for user-created post
   * Format: Social Archives/post/{YYYY}/{MM}/{YYYY-MM-DD-HHMMSS}.md
   * (Lowercase 'post' to match platform naming convention)
   */
  generateFilePath(postData: PostData): string {
    const timestamp = postData.metadata.timestamp instanceof Date
      ? postData.metadata.timestamp
      : new Date(postData.metadata.timestamp);

    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const date = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '');
    const fileName = `${date}-${timeStr}.md`;

    return normalizePath(`${this.settings.archivePath}/post/${year}/${month}/${fileName}`);
  }

  /**
   * Generate media file path
   * Format: attachments/social-archives/post/{YYYY-MM-DD}/{filename}
   */
  generateMediaPath(timestamp: Date, filename: string): string {
    const date = timestamp.toISOString().split('T')[0];
    const sanitizedFilename = this.sanitizeFilename(filename);

    return normalizePath(`${this.settings.mediaPath}/post/${date}/${sanitizedFilename}`);
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Save media file to Vault
   *
   * @param file - Browser File object from MediaAttacher
   * @param timestamp - Post creation timestamp
   * @returns Media save result with vault path
   */
  async saveMedia(file: File, timestamp: Date): Promise<MediaSaveResult> {
    try {
      // Generate media file path
      const mediaPath = this.generateMediaPath(timestamp, file.name);

      // Ensure parent folder exists
      const parentPath = this.getParentPath(mediaPath);
      await this.vaultManager.createFolderIfNotExists(parentPath);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Check if file already exists
      const existingFile = this.vault.getFileByPath(mediaPath);
      if (existingFile) {
        // Generate unique path
        const uniquePath = await this.generateUniqueMediaPath(mediaPath);
        const savedFile = await this.vault.createBinary(uniquePath, arrayBuffer);

        return {
          originalFile: file,
          savedPath: savedFile.path,
          url: savedFile.path,
        };
      }

      // Create new binary file
      const savedFile = await this.vault.createBinary(mediaPath, arrayBuffer);

      return {
        originalFile: file,
        savedPath: savedFile.path,
        url: savedFile.path,
      };
    } catch (error) {
      return {
        originalFile: file,
        savedPath: '',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate unique media path by appending counter
   */
  private async generateUniqueMediaPath(basePath: string): Promise<string> {
    const extension = basePath.substring(basePath.lastIndexOf('.'));
    const pathWithoutExt = basePath.substring(0, basePath.lastIndexOf('.'));

    let counter = 1;
    let uniquePath = `${pathWithoutExt}_${counter}${extension}`;

    while (this.vault.getFileByPath(uniquePath) !== null) {
      counter++;
      uniquePath = `${pathWithoutExt}_${counter}${extension}`;
    }

    return uniquePath;
  }

  /**
   * Get parent path from file path
   */
  private getParentPath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 1) {
      return '.';
    }
    return parts.slice(0, -1).join('/');
  }

  /**
   * Save user-created post to Vault
   *
   * 1. Save media files if provided
   * 2. Update PostData with saved media paths
   * 3. Convert PostData to Markdown
   * 4. Save markdown file to Vault
   *
   * @param postData - Post data generated by PostCreationService
   * @param mediaFiles - Media files from MediaAttacher (optional)
   * @returns Post save result
   */
  async savePost(postData: PostData, mediaFiles?: File[]): Promise<PostSaveResult> {
    const timestamp = postData.metadata.timestamp instanceof Date
      ? postData.metadata.timestamp
      : new Date(postData.metadata.timestamp);

    const mediaSaved: MediaSaveResult[] = [];

    // Save media files if provided
    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        const result = await this.saveMedia(file, timestamp);
        mediaSaved.push(result);

        // Only add to media array if save succeeded
        if (!result.error) {
          const media: Media = {
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: result.url,
            altText: file.name,
            size: file.size,
            mimeType: file.type,
          };

          postData.media.push(media);
        }
      }
    }

    // Convert PostData to Markdown
    const markdown = await this.markdownConverter.convert(postData);

    // Generate file path (use PostData.url if available, otherwise generate)
    const filePath = postData.url || this.generateFilePath(postData);

    // Ensure parent folder exists
    const parentPath = this.getParentPath(filePath);
    await this.vaultManager.createFolderIfNotExists(parentPath);

    // Save markdown file
    const file = await this.createOrUpdateFile(filePath, markdown.fullDocument);

    return {
      file,
      path: file.path,
      mediaSaved,
    };
  }

  /**
   * Create or update file in Vault
   */
  private async createOrUpdateFile(path: string, content: string): Promise<TFile> {
    const existingFile = this.vault.getFileByPath(path);

    if (existingFile) {
      // Update existing file
      await this.vault.modify(existingFile, content);
      return existingFile;
    }

    // Create new file
    return await this.vault.create(path, content);
  }

  /**
   * Delete media files (cleanup on error)
   */
  async cleanupMedia(mediaSaved: MediaSaveResult[]): Promise<void> {
    for (const result of mediaSaved) {
      if (!result.error && result.savedPath) {
        try {
          const file = this.vault.getFileByPath(result.savedPath);
          if (file) {
            await this.vault.delete(file);
          }
        } catch (error) {
          console.error(`Failed to cleanup media: ${result.savedPath}`, error);
        }
      }
    }
  }
}
