import { Plugin, Notice, addIcon, Platform, Events } from 'obsidian';
import { SocialArchiverSettingTab } from './settings/SettingTab';
import { SocialArchiverSettings, DEFAULT_SETTINGS, API_ENDPOINT, MediaDownloadMode } from './types/settings';
import { WorkersAPIClient } from './services/WorkersAPIClient';
import { ArchiveOrchestrator } from './services/ArchiveOrchestrator';
import { VaultManager } from './services/VaultManager';
import { MarkdownConverter } from './services/MarkdownConverter';
import { LinkPreviewExtractor } from './services/LinkPreviewExtractor';
import { TimelineView, VIEW_TYPE_TIMELINE } from './views/TimelineView';
import { ArchiveModal } from './modals/ArchiveModal';

// Import styles for Vite to process
import '../styles.css';

export default class SocialArchiverPlugin extends Plugin {
  settings: SocialArchiverSettings = DEFAULT_SETTINGS;
  private apiClient?: WorkersAPIClient;
  private orchestrator?: ArchiveOrchestrator;
  public linkPreviewExtractor!: LinkPreviewExtractor; // Link preview URL extractor
  public events: Events = new Events();

  async onload(): Promise<void> {
    // TEMPORARILY ENABLE console logs for debugging
    // TODO: Re-enable production optimization after debugging
    console.log('Social Archiver plugin loaded');

    await this.loadSettings();

    // Initialize services if API endpoint is configured
    await this.initializeServices();

    // Register Timeline View
    this.registerView(
      VIEW_TYPE_TIMELINE,
      (leaf) => new TimelineView(leaf, this)
    );

    // Register custom icon
    addIcon('social-archive', `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path fill="currentColor" d="M20 30 L80 30 L80 70 L50 90 L20 70 Z" />
        <path fill="currentColor" opacity="0.6" d="M30 20 L70 20 L70 40 L30 40 Z" />
        <circle fill="currentColor" cx="50" cy="55" r="15" />
      </svg>
    `);

    // Add ribbon icon for archive
    this.addRibbonIcon('social-archive', 'Archive social media post', () => {
      this.openArchiveModal();
    });

    // Add ribbon icon for timeline
    // On mobile: opens in main area (full screen)
    // On desktop: opens in sidebar (side-by-side with notes)
    this.addRibbonIcon('calendar-clock', 'Open timeline view', () => {
      const location = Platform.isMobile ? 'main' : 'sidebar';
      this.activateTimelineView(location);
    });

    // Add command for archive modal
    this.addCommand({
      id: 'open-archive-modal',
      name: 'Archive social media post',
      callback: () => {
        this.openArchiveModal();
      }
    });

    // Add command for timeline view (sidebar)
    this.addCommand({
      id: 'open-timeline-view',
      name: 'Open timeline view (sidebar)',
      callback: () => {
        this.activateTimelineView('sidebar');
      }
    });

    // Add command for timeline view (main area)
    this.addCommand({
      id: 'open-timeline-view-main',
      name: 'Open timeline view (main area)',
      callback: () => {
        this.activateTimelineView('main');
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
    const savedData = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

    // Only auto-generate username if both username and userName are defaults
    // This ensures user-set display names are preserved
    const isDefaultUsername = !this.settings.username || this.settings.username === 'you';
    const hasCustomDisplayName = savedData.userName && savedData.userName !== 'You';

    if (isDefaultUsername && !hasCustomDisplayName) {
      // Only regenerate if both are defaults
      const displayName = this.settings.userName || 'You';
      this.settings.username = displayName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 30);
      await this.saveData(this.settings);
    } else if (isDefaultUsername && hasCustomDisplayName) {
      // User has custom display name but username needs regeneration
      this.settings.username = this.settings.userName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 30);
      await this.saveData(this.settings);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reinitialize services if settings changed
    await this.initializeServices();
    // Trigger settings-changed event for views to refresh
    this.events.trigger('settings-changed', this.settings);
  }

  /**
   * Initialize API client and orchestrator
   */
  private async initializeServices(): Promise<void> {
    // Clean up existing services
    await this.apiClient?.dispose();

    try {
      // Initialize API client with hardcoded production endpoint
      this.apiClient = new WorkersAPIClient({
        endpoint: API_ENDPOINT,
        licenseKey: this.settings.licenseKey,
      });
      await this.apiClient.initialize();

      // Initialize LinkPreviewExtractor (always available, no API dependency)
      this.linkPreviewExtractor = new LinkPreviewExtractor({
        maxLinks: 2, // Extract up to 2 URLs per post
        excludeImages: true,
        excludePlatformUrls: false // Include platform URLs for link previews
      });
      await this.linkPreviewExtractor.initialize();

      console.log('[Social Archiver] Services initialized successfully');

    } catch (error) {
      console.error('[Social Archiver] Failed to initialize services:', error);
      new Notice('Failed to initialize Social Archiver. Check console for details.');
    }
  }

  /**
   * Archive a social media post
   */
  async archivePost(
    url: string,
    options?: {
      includeTranscript?: boolean;
      includeFormattedTranscript?: boolean;
      comment?: string;
      downloadMedia?: MediaDownloadMode;
    }
  ): Promise<void> {
    // Track processing time
    const startTime = Date.now();

    console.log('[Social Archiver] ========== ARCHIVE STARTED ==========');
    console.log('[Social Archiver] URL:', url);
    console.log('[Social Archiver] Plugin version:', this.manifest.version);
    console.log('[Social Archiver] Options:', options);

    if (!this.apiClient) {
      console.error('[Social Archiver] apiClient not initialized!');
      new Notice('⚠️ Please configure API endpoint in settings first');
      return;
    }

    console.log('[Social Archiver] Settings:', {
      apiEndpoint: API_ENDPOINT,
      archivePath: this.settings.archivePath,
    });

    try {
      console.log('[Social Archiver] Step 1: Submitting archive request...');

      // Determine download mode (modal option overrides settings)
      const downloadMode = options?.downloadMedia ?? this.settings.downloadMedia;

      // Submit archive request
      const response = await this.apiClient.submitArchive({
        url,
        options: {
          enableAI: false, // AI features disabled
          deepResearch: false, // Deep research disabled
          downloadMedia: downloadMode !== 'text-only', // Worker needs boolean (always fetch URLs)
          // YouTube-specific options
          includeTranscript: options?.includeTranscript,
          includeFormattedTranscript: options?.includeFormattedTranscript,
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

      // Filter transcript based on user options (YouTube only)
      if (result.postData.platform === 'youtube' && result.postData.transcript) {
        if (!options?.includeTranscript) {
          delete result.postData.transcript.raw;
        }
        if (!options?.includeFormattedTranscript) {
          delete result.postData.transcript.formatted;
        }
        // Remove transcript object if both are disabled
        if (!result.postData.transcript.raw && !result.postData.transcript.formatted) {
          delete result.postData.transcript;
        }
      }

      // Debug: Log media array
      if (result.postData.media && result.postData.media.length > 0) {
        console.log('[Social Archiver] Media count:', result.postData.media.length);
        result.postData.media.forEach((m: any, idx: number) => {
          console.log(`[Social Archiver] Media ${idx}:`, {
            type: m.type,
            hasUrl: !!m.url,
            urlType: typeof m.url,
            url: m.url,
            keys: Object.keys(m),
          });
        });
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

      // Track downloaded media for markdown conversion
      const downloadedMedia: Array<{ originalUrl: string; localPath: string }> = [];

      // Step 4.5: Download media files to local vault via Workers proxy
      if (downloadMode !== 'text-only' && result.postData.media && result.postData.media.length > 0) {
        console.log('[Social Archiver] Step 4.5: Downloading media files via proxy...');
        console.log(`[Social Archiver] Download mode: ${downloadMode}`);
        console.log(`[Social Archiver] Found ${result.postData.media.length} media items to download`);

        // Generate media folder name: YYYY-MM-DD-platform-shortId (using publish date)
        const publishDate = typeof result.postData.metadata.timestamp === 'string'
          ? new Date(result.postData.metadata.timestamp)
          : result.postData.metadata.timestamp;
        const dateStr = `${publishDate.getFullYear()}-${String(publishDate.getMonth() + 1).padStart(2, '0')}-${String(publishDate.getDate()).padStart(2, '0')}`;
        const mediaFolderName = `${dateStr}-${result.postData.platform}-${result.postData.id}`;

        for (let i = 0; i < result.postData.media.length; i++) {
          const media = result.postData.media[i];

          // Filter by download mode
          if (downloadMode === 'images-only' && media.type !== 'image') {
            console.log(`[Social Archiver] Skipping ${media.type} (images-only mode)`);
            continue;
          }
          console.log(`[Social Archiver] Downloading media ${i + 1}/${result.postData.media.length}...`);

          // Extract URL string from media.url (handle both string and object formats)
          // Workers API may return video objects like: { video_url: "...", duration: 123 }
          let mediaUrl: string = '';

          try {
            if (typeof media.url === 'string') {
              mediaUrl = media.url;
            } else if (typeof media.url === 'object' && media.url !== null) {
              // Try to extract URL from object (video_url, url, or other common fields)
              const urlObj = media.url as any;
              mediaUrl = urlObj.video_url || urlObj.url || urlObj.image_url || urlObj.thumbnail_url || '';
              console.log('[Social Archiver] Extracted URL from object:', {
                originalObject: media.url,
                extractedUrl: mediaUrl,
              });
            } else {
              throw new Error(`Invalid media URL type: ${typeof media.url}`);
            }

            if (!mediaUrl) {
              throw new Error('No valid URL found in media object');
            }

            // Generate filename: 1.jpg, 2.jpg, 3.mp4, etc.
            const extension = this.getFileExtension(mediaUrl) || 'jpg';
            const filename = `${i + 1}.${extension}`;
            const basePath = `${this.settings.mediaPath}/${mediaFolderName}`;
            const fullPath = `${basePath}/${filename}`;

            // Check if file already exists
            const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

            if (existingFile) {
              // File already exists, reuse it
              console.log(`[Social Archiver] ♻️ Media ${i + 1}: Already exists, reusing ${fullPath}`);

              downloadedMedia.push({
                originalUrl: mediaUrl,
                localPath: fullPath,
              });
            } else {
              // Download via Workers proxy to bypass CORS
              const arrayBuffer = await this.apiClient!.proxyMedia(mediaUrl);

              // Ensure folder exists
              await this.ensureFolderExists(basePath);

              // Save to vault
              const file = await this.app.vault.createBinary(fullPath, arrayBuffer);

              downloadedMedia.push({
                originalUrl: mediaUrl,
                localPath: file.path,
              });

              console.log(`[Social Archiver] ✅ Media ${i + 1}: ${mediaUrl.substring(0, 60)}... -> ${file.path}`);
            }

          } catch (error) {
            // TikTok videos often fail due to DRM protection - use original post URL as fallback
            if (result.postData.platform === 'tiktok' && mediaUrl) {
              console.warn(`[Social Archiver] ⚠️ TikTok video download failed, using original post URL`);

              // TikTok CDN URLs don't work in browsers (Access Denied)
              // Use the original TikTok post URL instead, which always works
              downloadedMedia.push({
                originalUrl: mediaUrl,
                localPath: result.postData.url, // Use original TikTok post URL
              });
            } else {
              console.error(`[Social Archiver] ❌ Failed to download media ${i + 1}:`, error);
            }
            // Continue with next media item
          }
        }

        console.log(`[Social Archiver] Successfully downloaded ${downloadedMedia.length}/${result.postData.media.length} media files`);

        if (downloadedMedia.length < result.postData.media.length) {
          new Notice(`⚠️ Downloaded ${downloadedMedia.length}/${result.postData.media.length} media files`, 5000);
        }
      }

      console.log('[Social Archiver] Step 5: Converting to markdown...');

      // Convert downloadedMedia to MediaResult format for MarkdownConverter
      const mediaResults = downloadMode !== 'text-only' && downloadedMedia.length > 0 ? downloadedMedia.map(d => ({
        originalUrl: d.originalUrl,
        localPath: d.localPath,
        type: 'image' as const, // Default type, actual type doesn't matter for URL replacement
        size: 0,
        file: null as any, // Not needed for URL replacement
      })) : undefined;

      let markdown = await markdownConverter.convert(result.postData, undefined, mediaResults);

      // Add processing time to frontmatter (convert to seconds, 1 decimal place)
      markdown.frontmatter.download_time = Math.round((Date.now() - startTime) / 100) / 10;

      // Add user comment to frontmatter if provided
      if (options?.comment) {
        markdown.frontmatter.comment = options.comment;
      }

      // Regenerate fullDocument with updated frontmatter
      markdown = markdownConverter.updateFullDocument(markdown);

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

      // Refresh Timeline View if it's open (by re-activating it)
      this.refreshTimelineView();

    } catch (error) {
      // Error will be handled by the modal's catch block
      throw error;
    }
  }

  /**
   * Refresh Timeline View if it exists
   * Uses activateTimelineView to ensure proper refresh
   */
  private refreshTimelineView(): void {
    const leaves = this.app.workspace.getLeavesOfType('social-archiver-timeline');
    if (leaves.length > 0) {
      // Timeline View is open, refresh by re-activating
      console.log('[Social Archiver] Refreshing Timeline View by re-activating');
      this.activateTimelineView();
    }
  }

  /**
   * Open the archive modal
   */
  private openArchiveModal(initialUrl?: string): void {
    const modal = new ArchiveModal(this.app, this, initialUrl);
    modal.open();
  }

  private async archiveFromClipboard(): Promise<void> {
    try {
      const clipboardText = await navigator.clipboard.readText();

      if (!this.isValidUrl(clipboardText)) {
        new Notice('No valid URL found in clipboard');
        return;
      }

      this.openArchiveModal(clipboardText);

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
        'threads.net',
        'threads.com',
        'youtube.com',
        'youtu.be'
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

      this.openArchiveModal(url);
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

  /**
   * Activate the Timeline View
   * Opens the view in the specified location (sidebar or main area)
   * Automatically refreshes the timeline when activated
   *
   * @param location - Where to open the timeline ('sidebar' or 'main')
   */
  async activateTimelineView(location: 'sidebar' | 'main' = 'sidebar'): Promise<void> {
    const { workspace } = this.app;
    let leaf;

    // If opening in main area, always create a new leaf (allow multiple instances)
    if (location === 'main') {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({
        type: VIEW_TYPE_TIMELINE,
        active: true,
      });
    } else {
      // Sidebar mode: check if view is already open in sidebar
      const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
      const sidebarLeaf = existingLeaves.find(l => {
        // Check if leaf is in right sidebar
        const parent = l.getRoot();
        return parent === workspace.rightSplit;
      });

      if (sidebarLeaf) {
        // Reuse existing sidebar leaf
        leaf = sidebarLeaf;
      } else {
        // Create new leaf in right sidebar
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
          leaf = rightLeaf;
          await leaf.setViewState({
            type: VIEW_TYPE_TIMELINE,
            active: true,
          });
        }
      }
    }

    // Reveal the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);

      // Refresh the timeline view to load new posts
      const view = leaf.view;
      if (view && 'refresh' in view && typeof view.refresh === 'function') {
        await view.refresh();
      }
    }
  }
}
