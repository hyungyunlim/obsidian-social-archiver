import { Plugin, Notice, addIcon, Modal, App } from 'obsidian';
import { SocialArchiverSettingTab } from './settings/SettingTab';
import { SocialArchiverSettings, DEFAULT_SETTINGS } from './types/settings';
import { WorkersAPIClient } from './services/WorkersAPIClient';
import { ArchiveOrchestrator } from './services/ArchiveOrchestrator';
import { VaultManager } from './services/VaultManager';
import { MarkdownConverter } from './services/MarkdownConverter';
import type { Media } from './types/post';

// Temporary ArchiveModal class until Svelte integration is complete
class ArchiveModal extends Modal {
  private plugin: SocialArchiverPlugin;
  private url: string = '';

  constructor(app: App, plugin: SocialArchiverPlugin) {
    super(app);
    this.plugin = plugin;
  }

  setUrl(url: string): void {
    this.url = url;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Archive Social Media Post' });

    const container = contentEl.createDiv({ cls: 'social-archiver-modal' });

    // URL Input
    container.createEl('label', { text: 'Post URL' });
    const urlInput = container.createEl('input', {
      type: 'text',
      placeholder: 'Paste URL from Facebook, LinkedIn, Instagram, TikTok, X, or Threads',
      value: this.url
    });
    urlInput.style.width = '100%';
    urlInput.style.marginBottom = '1em';

    // Disclaimer
    const disclaimer = container.createDiv({ cls: 'social-archiver-disclaimer' });
    disclaimer.innerHTML = `
      <p style="color: var(--text-muted); font-size: 0.9em; margin: 1em 0;">
        ⚠️ <strong>Important:</strong> Only archive content you have permission to save.
        Respect copyright and privacy rights.
      </p>
    `;

    // Buttons
    const buttonContainer = container.createDiv({ cls: 'social-archiver-buttons' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5em';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '1em';

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const archiveBtn = buttonContainer.createEl('button', {
      text: 'Archive',
      cls: 'mod-cta'
    });
    archiveBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) {
        new Notice('Please enter a URL');
        return;
      }

      // Close modal immediately
      this.close();

      // Show brief notice
      new Notice('📡 Archiving post...');

      // Run archive in background
      try {
        await this.plugin.archivePost(url);
        // Success notification is shown by archivePost method
      } catch (error) {
        console.error('Archive failed:', error);
        new Notice(`❌ Archive failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
      }
    });

    // Focus on input
    urlInput.focus();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default class SocialArchiverPlugin extends Plugin {
  settings: SocialArchiverSettings = DEFAULT_SETTINGS;
  private apiClient?: WorkersAPIClient;
  private orchestrator?: ArchiveOrchestrator;

  async onload(): Promise<void> {
    // Disable verbose console logs in production for better performance
    const originalConsoleLog = console.log;

    if (process.env.NODE_ENV === 'production' || !('process' in globalThis && process.env.NODE_ENV === 'development')) {
      console.log = () => {};
      console.debug = () => {};
      // Keep console.warn and console.error for important messages
    }

    originalConsoleLog('Social Archiver plugin loaded');

    await this.loadSettings();

    // Initialize services if API endpoint is configured
    await this.initializeServices();

    // Register custom icon
    addIcon('social-archive', `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path fill="currentColor" d="M20 30 L80 30 L80 70 L50 90 L20 70 Z" />
        <path fill="currentColor" opacity="0.6" d="M30 20 L70 20 L70 40 L30 40 Z" />
        <circle fill="currentColor" cx="50" cy="55" r="15" />
      </svg>
    `);

    // Add ribbon icon
    this.addRibbonIcon('social-archive', 'Archive social media post', () => {
      this.openArchiveModal();
    });

    // Add command
    this.addCommand({
      id: 'open-archive-modal',
      name: 'Archive social media post',
      callback: () => {
        this.openArchiveModal();
      }
    });

    // Add command for quick archive from clipboard
    this.addCommand({
      id: 'archive-from-clipboard',
      name: 'Archive from clipboard URL',
      callback: async () => {
        await this.archiveFromClipboard();
      }
    });

    // Add settings tab
    this.addSettingTab(new SocialArchiverSettingTab(this.app, this));

    // Register protocol handler for mobile share
    this.registerProtocolHandler();
  }

  async onunload(): Promise<void> {
    console.log('Social Archiver plugin unloaded');

    // Cleanup services
    await this.orchestrator?.dispose();
    await this.apiClient?.dispose();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reinitialize services if settings changed
    await this.initializeServices();
  }

  /**
   * Initialize API client and orchestrator
   */
  private async initializeServices(): Promise<void> {
    // Clean up existing services
    await this.orchestrator?.dispose();
    await this.apiClient?.dispose();

    // Only initialize if we have the required settings
    if (!this.settings.apiEndpoint) {
      console.log('[Social Archiver] API endpoint not configured');
      return;
    }

    try {
      // Initialize API client
      this.apiClient = new WorkersAPIClient({
        endpoint: this.settings.apiEndpoint,
        licenseKey: this.settings.licenseKey,
      });
      await this.apiClient.initialize();

      // Note: ArchiveService would need to be adapted for plugin use
      // For now, we'll primarily use the Workers API

      console.log('[Social Archiver] Services initialized successfully');

    } catch (error) {
      console.error('[Social Archiver] Failed to initialize services:', error);
      new Notice('Failed to initialize Social Archiver. Check console for details.');
    }
  }

  /**
   * Archive a social media post
   */
  async archivePost(url: string): Promise<void> {
    console.log('[Social Archiver] ========== ARCHIVE STARTED ==========');
    console.log('[Social Archiver] URL:', url);
    console.log('[Social Archiver] Plugin version:', this.manifest.version);

    if (!this.apiClient) {
      console.error('[Social Archiver] apiClient not initialized!');
      new Notice('⚠️ Please configure API endpoint in settings first');
      return;
    }

    console.log('[Social Archiver] Settings:', {
      apiEndpoint: this.settings.apiEndpoint,
      enableAI: this.settings.enableAI,
      deepResearch: this.settings.enableDeepResearch,
      archivePath: this.settings.archivePath,
    });

    try {
      console.log('[Social Archiver] Step 1: Submitting archive request...');

      // Submit archive request
      const response = await this.apiClient.submitArchive({
        url,
        options: {
          enableAI: this.settings.enableAI,
          deepResearch: this.settings.enableDeepResearch,
          downloadMedia: true,
        },
        licenseKey: this.settings.licenseKey,
      });

      console.log('[Social Archiver] Step 2: Job submitted, jobId:', response.jobId);

      console.log('[Social Archiver] Step 3: Waiting for job completion...');

      // Wait for completion (longer timeout for BrightData scraping)
      const result = await this.apiClient.waitForJob(response.jobId, {
        timeout: 2700000, // 45 minutes (TikTok can take 30 minutes, Threads ~7 minutes)
        pollInterval: 5000, // 5 seconds (reduce API calls, webhook will complete faster)
      });

      console.log('[Social Archiver] Step 4: Job completed!');
      console.log('[Social Archiver] PostData received:', {
        platform: result.postData.platform,
        id: result.postData.id,
        mediaCount: result.postData.media?.length || 0,
        hasContent: !!result.postData.content?.text,
        contentLength: result.postData.content?.text?.length || 0,
        contentPreview: result.postData.content?.text?.substring(0, 100),
      });

      // Debug: Log media array
      if (result.postData.media && result.postData.media.length > 0) {
        console.log('[Social Archiver] Media items:', result.postData.media.map((m: { type: string; url: string }) => ({
          type: m.type,
          url: m.url?.substring(0, 100) + '...',
        })));
      } else {
        console.warn('[Social Archiver] No media found in postData!');
      }

      // Save to vault using local services
      const vaultManager = new VaultManager({
        vault: this.app.vault,
        basePath: this.settings.archivePath || 'Social Archives'
      });
      const markdownConverter = new MarkdownConverter();

      await vaultManager.initialize();
      await markdownConverter.initialize();

      // Step 4.5: Download media files to local vault via Workers proxy
      if (result.postData.media && result.postData.media.length > 0) {
        console.log('[Social Archiver] Step 4.5: Downloading media files via proxy...');
        console.log(`[Social Archiver] Found ${result.postData.media.length} media items to download`);

        const downloadedMedia: Array<{ originalUrl: string; localPath: string }> = [];

        for (let i = 0; i < result.postData.media.length; i++) {
          const media = result.postData.media[i];
          console.log(`[Social Archiver] Downloading media ${i + 1}/${result.postData.media.length}...`);

          try {
            // Generate filename
            const extension = this.getFileExtension(media.url) || 'jpg';
            const filename = `media-${i + 1}.${extension}`;
            const basePath = `attachments/social-archives/${result.postData.platform}/${result.postData.id}`;
            const fullPath = `${basePath}/${filename}`;

            // Check if file already exists
            const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

            if (existingFile) {
              // File already exists, reuse it
              console.log(`[Social Archiver] ♻️ Media ${i + 1}: Already exists, reusing ${fullPath}`);

              downloadedMedia.push({
                originalUrl: media.url,
                localPath: fullPath,
              });
            } else {
              // Download via Workers proxy to bypass CORS
              const arrayBuffer = await this.apiClient!.proxyMedia(media.url);

              // Ensure folder exists
              await this.ensureFolderExists(basePath);

              // Save to vault
              const file = await this.app.vault.createBinary(fullPath, arrayBuffer);

              downloadedMedia.push({
                originalUrl: media.url,
                localPath: file.path,
              });

              console.log(`[Social Archiver] ✅ Media ${i + 1}: ${media.url.substring(0, 60)}... -> ${file.path}`);
            }

          } catch (error) {
            console.error(`[Social Archiver] ❌ Failed to download media ${i + 1}:`, error);
            // Continue with next media item
          }
        }

        console.log(`[Social Archiver] Successfully downloaded ${downloadedMedia.length}/${result.postData.media.length} media files`);

        // Update PostData media URLs to local paths
        result.postData.media = result.postData.media.map((media: Media) => {
          const downloaded = downloadedMedia.find(d => d.originalUrl === media.url);
          if (downloaded) {
            return {
              ...media,
              url: downloaded.localPath, // Replace CDN URL with local path
            };
          }
          return media; // Keep original URL if download failed
        });

        console.log('[Social Archiver] Media URLs updated to local paths');

        if (downloadedMedia.length < result.postData.media.length) {
          new Notice(`⚠️ Downloaded ${downloadedMedia.length}/${result.postData.media.length} media files`, 5000);
        }
      } else {
        console.log('[Social Archiver] No media to download');
      }

      console.log('[Social Archiver] Step 5: Converting to markdown...');
      const markdown = await markdownConverter.convert(result.postData);

      console.log('[Social Archiver] Markdown generated successfully!');
      console.log('[Social Archiver] Content length:', markdown.content.length);
      console.log('[Social Archiver] Content preview (first 300 chars):\n', markdown.content.substring(0, 300));

      console.log('[Social Archiver] Step 6: Saving to vault...');
      const filePath = await vaultManager.savePost(result.postData, markdown);

      console.log('[Social Archiver] Step 7: File saved successfully!');
      console.log('[Social Archiver] File path:', filePath);
      console.log('[Social Archiver] ========== ARCHIVE COMPLETED ==========');

      new Notice(`✅ Archived successfully! Credits used: ${result.creditsUsed}`, 5000);

      // Open the file
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.app.workspace.getLeaf().openFile(file as any);
      }

    } catch (error) {
      // Error will be handled by the modal's catch block
      throw error;
    }
  }

  private openArchiveModal(): void {
    new ArchiveModal(this.app, this).open();
  }

  private async archiveFromClipboard(): Promise<void> {
    try {
      const clipboardText = await navigator.clipboard.readText();

      if (!this.isValidUrl(clipboardText)) {
        new Notice('No valid URL found in clipboard');
        return;
      }

      const modal = new ArchiveModal(this.app, this);
      modal.setUrl(clipboardText);
      modal.open();

    } catch (error) {
      console.error('Failed to read clipboard:', error);
      new Notice('Failed to read clipboard. Please check permissions.');
    }
  }

  private isValidUrl(text: string): boolean {
    try {
      const url = new URL(text);
      const supportedDomains = [
        'facebook.com',
        'fb.com',
        'linkedin.com',
        'instagram.com',
        'tiktok.com',
        'x.com',
        'twitter.com',
        'threads.net'
      ];

      return supportedDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  private registerProtocolHandler(): void {
    // Register obsidian://social-archive protocol
    this.registerObsidianProtocolHandler('social-archive', async (params) => {
      const url = params.url;

      if (!url) {
        new Notice('No URL provided');
        return;
      }

      if (!this.isValidUrl(url)) {
        new Notice('Invalid or unsupported URL');
        return;
      }

      const modal = new ArchiveModal(this.app, this);
      modal.setUrl(url);
      modal.open();
    });
  }

  /**
   * Get file extension from URL
   */
  private getFileExtension(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('.');
      if (parts.length > 1) {
        const ext = parts[parts.length - 1];
        if (ext) {
          // Remove query parameters
          return ext.toLowerCase().split('?')[0] || null;
        }
      }
    } catch {
      // Invalid URL
    }
    return null;
  }

  /**
   * Ensure folder exists in vault
   */
  private async ensureFolderExists(path: string): Promise<void> {
    const parts = path.split('/');
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const existing = this.app.vault.getFolderByPath(currentPath);
      if (!existing) {
        try {
          await this.app.vault.createFolder(currentPath);
        } catch (error) {
          // Folder might have been created by another operation
          const folder = this.app.vault.getFolderByPath(currentPath);
          if (!folder) {
            throw error;
          }
        }
      }
    }
  }
}
