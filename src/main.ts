import { Plugin, Notice, addIcon, Modal, App } from 'obsidian';
import { SocialArchiverSettingTab } from './settings/SettingTab';
import { SocialArchiverSettings, DEFAULT_SETTINGS } from './types/settings';
import { WorkersAPIClient } from './services/WorkersAPIClient';
import { ArchiveOrchestrator } from './services/ArchiveOrchestrator';
import { VaultManager } from './services/VaultManager';
import { MarkdownConverter } from './services/MarkdownConverter';
import { MediaHandler } from './services/MediaHandler';

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
    const urlLabel = container.createEl('label', { text: 'Post URL' });
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
    console.log('Social Archiver plugin loaded');

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

      // Initialize orchestrator (for local operations)
      const vaultManager = new VaultManager(this.app.vault, this.app.metadataCache);
      const markdownConverter = new MarkdownConverter();
      const mediaHandler = new MediaHandler(this.app.vault, {
        defaultImagePath: 'attachments/social-archives',
      });

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
    console.log('[Social Archiver] archivePost called', { url });

    if (!this.apiClient) {
      console.error('[Social Archiver] apiClient not initialized!');
      new Notice('⚠️ Please configure API endpoint in settings first');
      return;
    }

    console.log('[Social Archiver] apiClient initialized, submitting request');

    try {
      console.log('[Social Archiver] Calling submitArchive', {
        url,
        enableAI: this.settings.enableAI,
        deepResearch: this.settings.enableDeepResearch,
      });

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

      // Wait for completion (no progress notifications)
      const result = await this.apiClient.waitForJob(response.jobId, {
        timeout: 120000, // 2 minutes
        pollInterval: 2000, // 2 seconds
      });

      // Save to vault using local services
      const vaultManager = new VaultManager({
        vault: this.app.vault,
        basePath: this.settings.archivePath || 'Social Archives',
        organizationStrategy: this.settings.organizationStrategy || 'platform'
      });
      const markdownConverter = new MarkdownConverter();

      await vaultManager.initialize();
      await markdownConverter.initialize();

      const markdown = await markdownConverter.convert(result.postData);
      const filePath = await vaultManager.savePost(result.postData, markdown);

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
}
