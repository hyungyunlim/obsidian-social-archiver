import { Notice } from 'obsidian';
import type { PostData, ArchiveOptions, ArchiveResult, ArchiveProgress } from '@/types';
import { ApiClient } from './ApiClient';
import { MarkdownConverter } from './MarkdownConverter';
import { MediaHandler } from './MediaHandler';
import { VaultManager } from './VaultManager';
import type SocialArchiverPlugin from '@/main';

export class ArchiveService {
  private apiClient: ApiClient;
  private markdownConverter: MarkdownConverter;
  private mediaHandler: MediaHandler;
  private vaultManager: VaultManager;

  constructor(private plugin: SocialArchiverPlugin) {
    this.apiClient = new ApiClient(plugin.settings);
    this.markdownConverter = new MarkdownConverter();
    this.mediaHandler = new MediaHandler(plugin.app.vault);
    this.vaultManager = new VaultManager(plugin.app.vault, plugin.settings);
  }

  async archive(
    url: string, 
    options: ArchiveOptions,
    onProgress?: (progress: ArchiveProgress) => void
  ): Promise<ArchiveResult> {
    try {
      // Check credits
      const creditsNeeded = this.calculateCredits(options);
      if (this.plugin.settings.creditsRemaining < creditsNeeded) {
        throw new Error(`Insufficient credits. Need ${creditsNeeded}, have ${this.plugin.settings.creditsRemaining}`);
      }

      // Stage 1: Fetch post data
      onProgress?.({
        stage: 'fetching',
        progress: 10,
        message: 'Fetching post data...'
      });

      const postData = await this.apiClient.fetchPost(url, options);

      // Stage 2: Process content
      onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Processing content...'
      });

      const markdown = await this.markdownConverter.convert(postData);

      // Stage 3: Download media
      if (options.downloadMedia && postData.media.length > 0) {
        onProgress?.({
          stage: 'downloading',
          progress: 50,
          message: `Downloading ${postData.media.length} media files...`
        });

        const mediaFiles = await this.mediaHandler.downloadMedia(
          postData.media,
          postData.platform,
          postData.id
        );

        // Update markdown with local media paths
        for (const media of mediaFiles) {
          markdown.content = markdown.content.replace(
            media.originalUrl,
            media.localPath
          );
        }
      }

      // Stage 4: Save to vault
      onProgress?.({
        stage: 'saving',
        progress: 80,
        message: 'Saving to vault...'
      });

      const filePath = await this.vaultManager.savePost(postData, markdown);

      // Stage 5: Generate share link if needed
      let shareUrl: string | undefined;
      if (options.generateShareLink) {
        shareUrl = await this.apiClient.createShareLink(filePath);
      }

      // Update credits
      this.plugin.settings.creditsRemaining -= creditsNeeded;
      await this.plugin.saveSettings();

      // Complete
      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Archive complete!'
      });

      new Notice(`Post archived successfully! ${creditsNeeded} credits used.`);

      return {
        success: true,
        filePath,
        shareUrl,
        creditsUsed: creditsNeeded
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`Archive failed: ${errorMessage}`);
      
      return {
        success: false,
        creditsUsed: 0,
        error: errorMessage
      };
    }
  }

  private calculateCredits(options: ArchiveOptions): number {
    let credits = 1; // Base cost
    
    if (options.enableAI) {
      credits += 2; // AI analysis
    }
    
    if (options.deepResearch) {
      credits += 2; // Deep research
    }
    
    return credits;
  }
}