import { App, PluginSettingTab, Setting } from 'obsidian';
import type SocialArchiverPlugin from '../main';
import { FolderSuggest } from './FolderSuggest';
import type { MediaDownloadMode } from '../types/settings';

export class SocialArchiverSettingTab extends PluginSettingTab {
  plugin: SocialArchiverPlugin;

  constructor(app: App, plugin: SocialArchiverPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Social Archiver Settings' });

    // User Settings Section
    containerEl.createEl('h3', { text: 'User Settings' });

    new Setting(containerEl)
      .setName('Display name')
      .setDesc('Your name for comments and sharing posts')
      .addText(text => text
        .setPlaceholder('You')
        .setValue(this.plugin.settings.userName)
        .onChange(async (value) => {
          this.plugin.settings.userName = value || 'You';
          // Auto-generate username from display name (temporary until proper signup)
          const cleanUsername = (value || 'You').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          this.plugin.settings.username = cleanUsername;
          await this.plugin.saveSettings();
        }));

    // Archive Settings Section (formerly Storage Settings)
    containerEl.createEl('h3', { text: 'Archive Settings' });

    new Setting(containerEl)
      .setName('Archive Folder')
      .setDesc('Folder where archived posts will be saved')
      .addText(text => {
        text
          .setPlaceholder('Social Archives')
          .setValue(this.plugin.settings.archivePath)
          .onChange(async (value) => {
            // Set to default if empty
            this.plugin.settings.archivePath = value || 'Social Archives';
            await this.plugin.saveSettings();
          });

        // Add folder suggestions
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('Media Folder')
      .setDesc('Folder where downloaded media files will be saved')
      .addText(text => {
        text
          .setPlaceholder('attachments/social-archives')
          .setValue(this.plugin.settings.mediaPath)
          .onChange(async (value) => {
            // Set to default if empty
            this.plugin.settings.mediaPath = value || 'attachments/social-archives';
            await this.plugin.saveSettings();
          });

        // Add folder suggestions
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('Download media')
      .setDesc('Choose what media to download with posts. This setting serves as the default for the archive modal.')
      .addDropdown(dropdown => dropdown
        .addOption('text-only', 'Text only')
        .addOption('images-only', 'Images only')
        .addOption('images-and-videos', 'Images and videos')
        .setValue(this.plugin.settings.downloadMedia)
        .onChange(async (value: string) => {
          this.plugin.settings.downloadMedia = value as MediaDownloadMode;
          await this.plugin.saveSettings();
        }));

    // License Section
    containerEl.createEl('h3', { text: 'License' });

    new Setting(containerEl)
      .setName('License key')
      .setDesc('Enter your Gumroad license key for Pro features')
      .addText(text => text
        .setPlaceholder('Enter license key')
        .setValue(this.plugin.settings.licenseKey || '')
        .onChange(async (value) => {
          this.plugin.settings.licenseKey = value;
          await this.plugin.saveSettings();
        }));

    // Credits Display
    const creditsInfo = containerEl.createDiv({ cls: 'social-archiver-credits' });
    creditsInfo.innerHTML = `
      <p style="color: var(--text-muted); margin: 0.5em 0; padding: 1em; background: var(--background-secondary); border-radius: 4px;">
        <strong>Credits remaining:</strong> ${this.plugin.settings.creditsRemaining}/10<br>
        <strong>Resets on:</strong> ${new Date(this.plugin.settings.creditResetDate).toLocaleDateString()}<br>
        ${this.plugin.settings.licenseKey ? '<strong>Status:</strong> Pro ✨' : '<strong>Status:</strong> Free'}
      </p>
    `;
  }
}
