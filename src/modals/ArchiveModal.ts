import { Modal, App, Notice, Setting } from 'obsidian';
import type SocialArchiverPlugin from '../main';
import type { Platform } from '../types/post';
import type { MediaDownloadMode } from '../types/settings';

/**
 * Archive Modal - Minimal Obsidian Native Style
 * Uses Obsidian's built-in components for native look and feel
 */
export class ArchiveModal extends Modal {
  private plugin: SocialArchiverPlugin;
  private url: string = '';
  private detectedPlatform: Platform | null = null;
  private isValidUrl: boolean = false;
  private urlInput!: HTMLInputElement;
  private archiveBtn!: HTMLButtonElement;
  private platformBadge!: HTMLElement;
  private generalOptions!: HTMLElement;
  private youtubeOptions!: HTMLElement;
  private commentContainer!: HTMLElement;

  // General options
  private downloadMedia: MediaDownloadMode = 'images-and-videos'; // Will be set from settings

  // YouTube options
  private includeTranscript: boolean = true;
  private includeFormattedTranscript: boolean = false;

  // User comment
  private comment: string = '';
  private commentTextarea!: HTMLTextAreaElement;

  constructor(app: App, plugin: SocialArchiverPlugin, initialUrl?: string) {
    super(app);
    this.plugin = plugin;
    // Set default from settings
    this.downloadMedia = plugin.settings.downloadMedia;
    if (initialUrl) {
      this.url = initialUrl;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Title
    contentEl.createEl('h2', { text: 'Archive Social Post', cls: 'archive-modal-title' });

    // URL Input (full width, separate line)
    const inputContainer = contentEl.createDiv({ cls: 'archive-url-container' });

    this.urlInput = inputContainer.createEl('input', {
      type: 'text',
      placeholder: 'Paste URL from Facebook, LinkedIn, Instagram, TikTok, X, Threads, or YouTube',
      cls: 'archive-url-input',
      value: this.url
    });

    this.urlInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.url = target.value;
      this.validateUrl(target.value);
      this.updateUI();
    });

    // Platform Badge (shown when detected)
    this.platformBadge = contentEl.createDiv({ cls: 'archive-platform-badge' });

    // General options (shown when URL is detected)
    this.generalOptions = contentEl.createDiv({ cls: 'archive-general-options' });
    this.generalOptions.style.display = 'none';

    new Setting(this.generalOptions)
      .setName('Download media')
      .setDesc('Choose what media to download with this post')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('text-only', 'Text only')
          .addOption('images-only', 'Images only')
          .addOption('images-and-videos', 'Images and videos')
          .setValue(this.downloadMedia)
          .onChange((value: string) => {
            this.downloadMedia = value as MediaDownloadMode;
          })
      );

    // YouTube-specific options (hidden by default)
    this.youtubeOptions = contentEl.createDiv({ cls: 'archive-youtube-options' });
    this.youtubeOptions.style.display = 'none';

    new Setting(this.youtubeOptions)
      .setName('Include transcript')
      .setDesc('Download full transcript text')
      .addToggle((toggle) =>
        toggle
          .setValue(this.includeTranscript)
          .onChange((value) => {
            this.includeTranscript = value;
          })
      );

    new Setting(this.youtubeOptions)
      .setName('Include formatted transcript')
      .setDesc('Add clickable chapter links with timestamps')
      .addToggle((toggle) =>
        toggle
          .setValue(this.includeFormattedTranscript)
          .onChange((value) => {
            this.includeFormattedTranscript = value;
          })
      );

    // Comment section (shown when URL is detected)
    this.commentContainer = contentEl.createDiv({ cls: 'archive-comment-container' });
    this.commentContainer.style.display = 'none';

    const commentLabel = this.commentContainer.createDiv({ cls: 'archive-comment-label' });
    commentLabel.setText('💭 My Notes (optional)');

    this.commentTextarea = this.commentContainer.createEl('textarea', {
      cls: 'archive-comment-textarea',
      placeholder: 'Add your thoughts, tags, or reminders about this post...'
    });
    this.commentTextarea.addEventListener('input', (e) => {
      const target = e.target as HTMLTextAreaElement;
      this.comment = target.value;
    });

    // Disclaimer as subtle helper text
    const disclaimer = contentEl.createDiv({ cls: 'archive-disclaimer' });
    disclaimer.innerHTML = '⚠️ Archive only content you have permission to save. Respect copyright and privacy laws.';

    // Footer buttons
    const footer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = footer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    this.archiveBtn = footer.createEl('button', {
      text: 'Archive',
      cls: 'mod-cta',
      attr: { disabled: 'true' }
    });
    this.archiveBtn.addEventListener('click', () => this.handleArchive());

    // Keyboard shortcuts
    this.scope.register([], 'Escape', () => {
      this.close();
      return false;
    });

    this.scope.register(['Mod'], 'Enter', () => {
      if (this.isValidUrl) {
        this.handleArchive();
      }
      return false;
    });

    // Focus input
    setTimeout(() => this.urlInput.focus(), 100);

    // Initial validation if URL provided
    if (this.url) {
      this.validateUrl(this.url);
      this.updateUI();
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Validate URL and detect platform
   */
  private validateUrl(url: string): void {
    if (!url || url.trim().length === 0) {
      this.isValidUrl = false;
      this.detectedPlatform = null;
      return;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Detect platform
      if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
        this.detectedPlatform = 'facebook';
      } else if (hostname.includes('linkedin.com')) {
        this.detectedPlatform = 'linkedin';
      } else if (hostname.includes('instagram.com')) {
        this.detectedPlatform = 'instagram';
      } else if (hostname.includes('tiktok.com')) {
        this.detectedPlatform = 'tiktok';
      } else if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
        this.detectedPlatform = 'x';
      } else if (hostname.includes('threads.net') || hostname.includes('threads.com')) {
        this.detectedPlatform = 'threads';
      } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        this.detectedPlatform = 'youtube';
      } else if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
        this.detectedPlatform = 'reddit';
      } else {
        this.isValidUrl = false;
        this.detectedPlatform = null;
        return;
      }

      this.isValidUrl = true;

    } catch {
      this.isValidUrl = false;
      this.detectedPlatform = null;
    }
  }

  /**
   * Update UI based on detected platform
   */
  private updateUI(): void {
    // Update platform badge
    if (this.detectedPlatform) {
      this.platformBadge.setText(`✓ ${this.getPlatformName(this.detectedPlatform)} detected`);
      this.platformBadge.style.display = 'block';
    } else {
      this.platformBadge.style.display = 'none';
    }

    // Show/hide general options (show when URL is valid, except for YouTube and TikTok)
    if (this.isValidUrl && this.detectedPlatform !== 'youtube' && this.detectedPlatform !== 'tiktok') {
      this.generalOptions.style.display = 'block';
    } else {
      this.generalOptions.style.display = 'none';
    }

    // Show/hide YouTube options
    if (this.detectedPlatform === 'youtube') {
      this.youtubeOptions.style.display = 'block';
    } else {
      this.youtubeOptions.style.display = 'none';
    }

    // Show/hide comment section (show when URL is valid)
    if (this.isValidUrl) {
      this.commentContainer.style.display = 'block';
    } else {
      this.commentContainer.style.display = 'none';
    }

    // Update archive button
    this.updateArchiveButton();
  }

  /**
   * Update archive button state
   */
  private updateArchiveButton(): void {
    if (this.isValidUrl) {
      this.archiveBtn.removeAttribute('disabled');
    } else {
      this.archiveBtn.setAttribute('disabled', 'true');
    }
  }

  /**
   * Handle archive action
   */
  private async handleArchive(): Promise<void> {
    if (!this.isValidUrl) {
      new Notice('Please enter a valid URL');
      return;
    }

    // Close modal immediately
    this.close();

    // Show brief notice
    new Notice('📡 Archiving post...');

    try {
      // Pass options including comment
      const options: any = {};

      // General options
      options.downloadMedia = this.downloadMedia;

      // YouTube-specific options
      if (this.detectedPlatform === 'youtube') {
        options.includeTranscript = this.includeTranscript;
        options.includeFormattedTranscript = this.includeFormattedTranscript;
      }

      // Add comment if provided
      if (this.comment && this.comment.trim()) {
        options.comment = this.comment.trim();
      }

      await this.plugin.archivePost(this.url, Object.keys(options).length > 0 ? options : undefined);
    } catch (error) {
      console.error('[ArchiveModal] Archive failed:', error);
      new Notice(
        `❌ Archive failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        8000
      );
    }
  }

  /**
   * Get platform display name
   */
  private getPlatformName(platform: Platform): string {
    const names: Record<Platform, string> = {
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      x: 'X',
      threads: 'Threads',
      youtube: 'YouTube',
      reddit: 'Reddit',
      post: 'User Post'
    };

    return names[platform] || platform;
  }

  /**
   * Set initial URL (for clipboard paste feature)
   */
  public setUrl(url: string): void {
    this.url = url;
  }
}
