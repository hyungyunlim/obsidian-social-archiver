import { Plugin, Notice, addIcon } from 'obsidian';
import { SocialArchiverSettingTab } from './settings/SettingTab';
import { SocialArchiverSettings, DEFAULT_SETTINGS } from './types/settings';
import { ArchiveModal } from './components/ArchiveModal';

export default class SocialArchiverPlugin extends Plugin {
  settings: SocialArchiverSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    console.log('Social Archiver plugin loaded');
    
    await this.loadSettings();
    
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
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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