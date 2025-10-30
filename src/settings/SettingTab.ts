import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type SocialArchiverPlugin from '../main';

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

    // API Section
    containerEl.createEl('h3', { text: 'API Configuration' });

    // Debug Mode
    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Enable detailed logging in console')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));

    // User Settings Section
    containerEl.createEl('h3', { text: 'User Settings' });

    new Setting(containerEl)
      .setName('Display name')
      .setDesc('Your name for comments (shown as "Name commented on this post")')
      .addText(text => text
        .setPlaceholder('You')
        .setValue(this.plugin.settings.userName)
        .onChange(async (value) => {
          this.plugin.settings.userName = value || 'You';
          await this.plugin.saveSettings();
        }));

    // Storage Section
    containerEl.createEl('h3', { text: 'Storage Settings' });

    new Setting(containerEl)
      .setName('Archive path')
      .setDesc('Folder where archived posts will be saved (e.g., Social Archives)')
      .addText(text => text
        .setPlaceholder('Social Archives')
        .setValue(this.plugin.settings.archivePath)
        .onChange(async (value) => {
          // Set to default if empty
          this.plugin.settings.archivePath = value || 'Social Archives';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Media path')
      .setDesc('Folder where downloaded media files will be saved (e.g., attachments/social-archives)')
      .addText(text => text
        .setPlaceholder('attachments/social-archives')
        .setValue(this.plugin.settings.mediaPath)
        .onChange(async (value) => {
          // Set to default if empty
          this.plugin.settings.mediaPath = value || 'attachments/social-archives';
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

    // Features Section
    containerEl.createEl('h3', { text: 'Features' });

    new Setting(containerEl)
      .setName('Download media')
      .setDesc('Automatically download images and videos')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.downloadMedia)
        .onChange(async (value) => {
          this.plugin.settings.downloadMedia = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('AI enhancement')
      .setDesc('Use AI to summarize and analyze content (requires Pro)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAI)
        .setDisabled(!this.plugin.settings.licenseKey)
        .onChange(async (value) => {
          this.plugin.settings.enableAI = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable sharing')
      .setDesc('Allow creating public share links for archived posts (requires Pro)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableSharing)
        .setDisabled(!this.plugin.settings.licenseKey)
        .onChange(async (value) => {
          this.plugin.settings.enableSharing = value;
          await this.plugin.saveSettings();
        }));

    // Privacy Section
    containerEl.createEl('h3', { text: 'Privacy' });

    new Setting(containerEl)
      .setName('Remove tracking parameters')
      .setDesc('Strip tracking parameters from URLs before archiving')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.removeTracking)
        .onChange(async (value) => {
          this.plugin.settings.removeTracking = value;
          await this.plugin.saveSettings();
        }));

    // Info Section
    containerEl.createEl('h3', { text: 'Info' });

    const infoDiv = containerEl.createDiv();
    infoDiv.innerHTML = `
      <p style="color: var(--text-muted); margin: 0.5em 0;">
        <strong>Version:</strong> 1.0.0<br>
        <strong>Local Dev Server:</strong> http://localhost:8787<br>
        <strong>Production API:</strong> https://social-archiver-api.junlim.org<br>
        <br>
        <strong>Free tier:</strong> 10 archives/month<br>
        <strong>Pro tier:</strong> 500 archives/month + AI features + Permanent shares<br>
        <br>
        <a href="https://social-archiver.com" target="_blank">Get Pro License</a> |
        <a href="https://github.com/hyungyunlim/obsidian-social-archiver" target="_blank">Documentation</a>
      </p>
    `;
  }
}
