import type { IService } from './base/IService';
import type { PostData } from '@/types/post';
import type { MarkdownResult } from './MarkdownConverter';
import { Vault, TFile, TFolder, normalizePath } from 'obsidian';

/**
 * VaultManager configuration
 */
export interface VaultManagerConfig {
  vault: Vault;
  basePath?: string;
  organizationStrategy?: 'platform' | 'date' | 'flat';
}

/**
 * File save result
 */
export interface SaveResult {
  file: TFile;
  path: string;
  created: boolean;
}

/**
 * Path generator for organizing archived posts
 */
class PathGenerator {
  private basePath: string;
  private strategy: 'platform' | 'date' | 'flat';

  constructor(basePath: string = 'Social Archives', strategy: 'platform' | 'date' | 'flat' = 'platform') {
    this.basePath = basePath;
    this.strategy = strategy;
  }

  /**
   * Generate file path for a post
   */
  generatePath(postData: PostData): string {
    const filename = this.generateFilename(postData);

    switch (this.strategy) {
      case 'platform':
        return this.generatePlatformPath(postData, filename);
      case 'date':
        return this.generateDatePath(postData, filename);
      case 'flat':
        return this.generateFlatPath(filename);
      default:
        return this.generatePlatformPath(postData, filename);
    }
  }

  /**
   * Generate filename from post data
   */
  private generateFilename(postData: PostData): string {
    const date = this.formatDate(postData.metadata.timestamp);
    const author = this.sanitizeFilename(postData.author.name);

    // Extract meaningful title from content, skipping lines starting with symbols
    const title = this.extractMeaningfulTitle(postData.content.text);

    return `${date} - ${author} - ${title}.md`;
  }

  /**
   * Extract meaningful title from post content
   * Skips lines starting with symbols (-, •, *, #, @, etc.) or emojis
   */
  private extractMeaningfulTitle(text: string): string {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Regex to detect lines starting with common symbols or emojis
    const symbolPattern = /^[-•*#@\[\](){}<>|\/\\`~!+=_.,:;'"…]+\s*/;
    const emojiPattern = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    // Find first line that doesn't start with symbols or emojis
    for (const line of lines) {
      const cleanedLine = line.replace(symbolPattern, '').trim();

      if (cleanedLine.length === 0) continue; // Skip if only symbols
      if (emojiPattern.test(cleanedLine)) continue; // Skip if starts with emoji

      // Found a meaningful line
      const title = cleanedLine.length > 50
        ? cleanedLine.substring(0, 50) + '...'
        : cleanedLine;

      return this.sanitizeFilename(title);
    }

    // Fallback: use first line if no meaningful line found
    const firstLine = lines[0] || 'Untitled Post';
    const title = firstLine.length > 50
      ? firstLine.substring(0, 50) + '...'
      : firstLine;

    return this.sanitizeFilename(title);
  }

  /**
   * Generate path organized by platform
   * Format: Social Archives/{platform}/{year}/{month}/filename.md
   * Uses publish date from post metadata
   */
  private generatePlatformPath(postData: PostData, filename: string): string {
    const publishDate = typeof postData.metadata.timestamp === 'string'
      ? new Date(postData.metadata.timestamp)
      : postData.metadata.timestamp;
    const year = publishDate.getFullYear();
    const month = String(publishDate.getMonth() + 1).padStart(2, '0');
    const platform = postData.platform.charAt(0).toUpperCase() + postData.platform.slice(1);

    return normalizePath(`${this.basePath}/${platform}/${year}/${month}/${filename}`);
  }

  /**
   * Generate path organized by date
   * Format: Social Archives/{year}/{month}/{day}/filename.md
   * Uses publish date from post metadata
   */
  private generateDatePath(postData: PostData, filename: string): string {
    const publishDate = typeof postData.metadata.timestamp === 'string'
      ? new Date(postData.metadata.timestamp)
      : postData.metadata.timestamp;
    const year = publishDate.getFullYear();
    const month = String(publishDate.getMonth() + 1).padStart(2, '0');
    const day = String(publishDate.getDate()).padStart(2, '0');

    return normalizePath(`${this.basePath}/${year}/${month}/${day}/${filename}`);
  }

  /**
   * Generate flat path (all in base directory)
   */
  private generateFlatPath(filename: string): string {
    return normalizePath(`${this.basePath}/${filename}`);
  }

  /**
   * Format date as YYYY-MM-DD
   * Handles both Date objects and ISO string timestamps
   */
  private formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFilename(name: string): string {
    // Remove or replace invalid filename characters
    return name
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * VaultManager - Handles all Obsidian Vault file operations
 *
 * Single Responsibility: Vault file management
 */
export class VaultManager implements IService {
  private vault: Vault;
  private pathGenerator: PathGenerator;

  constructor(config: VaultManagerConfig) {
    this.vault = config.vault;
    this.pathGenerator = new PathGenerator(
      config.basePath,
      config.organizationStrategy
    );
  }

  async initialize(): Promise<void> {
    // Verify vault is accessible
    try {
      this.vault.getRoot();
    } catch (error) {
      throw new Error('Vault is not accessible');
    }
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
   * Save a post to the vault
   */
  async savePost(postData: PostData, markdown: MarkdownResult): Promise<string> {
    // Generate path
    const path = this.pathGenerator.generatePath(postData);

    // Ensure parent folder exists
    await this.ensureFolderExists(this.getParentPath(path));

    // Handle existing file
    const existingFile = this.vault.getFileByPath(path);
    if (existingFile) {
      // Generate unique path
      const uniquePath = await this.generateUniquePath(path);
      const file = await this.createFile(uniquePath, markdown.fullDocument);
      return file.path;
    }

    // Create new file
    const file = await this.createFile(path, markdown.fullDocument);
    return file.path;
  }

  /**
   * Create a file with atomic write
   */
  private async createFile(path: string, content: string): Promise<TFile> {
    try {
      const file = await this.vault.create(path, content);
      return file;
    } catch (error) {
      throw new Error(
        `Failed to create file at ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(file: TFile, content: string): Promise<void> {
    try {
      await this.vault.modify(file, content);
    } catch (error) {
      throw new Error(
        `Failed to update file ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if file exists at path
   */
  async fileExists(path: string): Promise<boolean> {
    return this.vault.getFileByPath(path) !== null;
  }

  /**
   * Create folder if it doesn't exist (recursive)
   */
  async createFolderIfNotExists(path: string): Promise<void> {
    await this.ensureFolderExists(path);
  }

  /**
   * Ensure folder exists, creating parent folders as needed
   */
  private async ensureFolderExists(path: string): Promise<TFolder> {
    const normalizedPath = normalizePath(path);

    // Check if folder already exists
    const existing = this.vault.getFolderByPath(normalizedPath);
    if (existing) {
      return existing;
    }

    // Create parent folders recursively
    const parentPath = this.getParentPath(normalizedPath);
    if (parentPath && parentPath !== '.') {
      await this.ensureFolderExists(parentPath);
    }

    // Create this folder
    try {
      return await this.vault.createFolder(normalizedPath);
    } catch (error) {
      // Folder might have been created by another operation
      const folder = this.vault.getFolderByPath(normalizedPath);
      if (folder) {
        return folder;
      }
      throw error;
    }
  }

  /**
   * Generate unique path by appending number
   */
  async generateUniquePath(basePath: string): Promise<string> {
    const extension = '.md';
    const pathWithoutExt = basePath.endsWith(extension)
      ? basePath.slice(0, -extension.length)
      : basePath;

    let counter = 1;
    let uniquePath = `${pathWithoutExt} ${counter}${extension}`;

    while (await this.fileExists(uniquePath)) {
      counter++;
      uniquePath = `${pathWithoutExt} ${counter}${extension}`;
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
   * Delete a file
   */
  async deleteFile(file: TFile): Promise<void> {
    try {
      await this.vault.delete(file);
    } catch (error) {
      throw new Error(
        `Failed to delete file ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Move file to trash
   */
  async trashFile(file: TFile, useSystemTrash: boolean = true): Promise<void> {
    try {
      await this.vault.trash(file, useSystemTrash);
    } catch (error) {
      throw new Error(
        `Failed to trash file ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Read file content
   */
  async readFile(file: TFile): Promise<string> {
    try {
      return await this.vault.read(file);
    } catch (error) {
      throw new Error(
        `Failed to read file ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get file by path
   */
  getFileByPath(path: string): TFile | null {
    return this.vault.getFileByPath(path);
  }

  /**
   * List all files in a folder
   */
  async listFiles(folderPath: string): Promise<TFile[]> {
    const folder = this.vault.getFolderByPath(folderPath);
    if (!folder) {
      return [];
    }

    const files: TFile[] = [];
    const traverse = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile) {
          files.push(child);
        } else if (child instanceof TFolder) {
          traverse(child);
        }
      }
    };

    traverse(folder);
    return files;
  }

  /**
   * Get vault statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
  }> {
    const allFiles = this.vault.getFiles();
    const totalSize = allFiles.reduce((sum, file) => sum + file.stat.size, 0);

    return {
      totalFiles: allFiles.length,
      totalSize,
    };
  }
}
