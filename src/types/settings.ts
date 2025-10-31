// Production API endpoint (hardcoded, users cannot change)
export const API_ENDPOINT = 'https://social-archiver-api.junlim.org';

// Share Web URL (for SvelteKit-based share pages)
export const SHARE_WEB_URL = 'https://social-archive.junlim.org';

// Media download modes
export type MediaDownloadMode = 'text-only' | 'images-only' | 'images-and-videos';

export interface SocialArchiverSettings {
  // API Configuration (apiEndpoint removed - now hardcoded)
  apiKey: string;
  licenseKey: string;
  workerUrl: string; // Cloudflare Worker URL for share API
  username: string; // Auto-generated from userName (temporary until signup flow)

  // User Settings
  userName: string; // User's display name for comments
  userAvatar: string; // Avatar URL for user-created posts (optional)

  // Storage Settings
  archivePath: string;
  mediaPath: string;
  fileNameFormat: string;

  // Feature Toggles
  autoArchive: boolean;
  downloadMedia: MediaDownloadMode;

  // Privacy Settings
  anonymizeAuthors: boolean;

  // Advanced Settings
  requestTimeout: number;
  maxRetries: number;

  // Credit Tracking
  creditsRemaining: number;
  creditResetDate: string;

  // Timeline View Settings
  timelineSortBy: 'published' | 'archived';
  timelineSortOrder: 'newest' | 'oldest';
}

export const DEFAULT_SETTINGS: SocialArchiverSettings = {
  // API Configuration
  apiKey: '',
  licenseKey: '',
  workerUrl: API_ENDPOINT, // Use same endpoint for Worker API
  username: 'you', // Auto-generated from userName

  // User Settings
  userName: 'You', // Default name for comments
  userAvatar: '', // No avatar by default

  // Storage Settings
  archivePath: 'Social Archives',
  mediaPath: 'attachments/social-archives',
  fileNameFormat: '[YYYY-MM-DD] {platform}-{slug}-{shortId}',

  // Feature Toggles
  autoArchive: false,
  downloadMedia: 'images-and-videos',

  // Privacy Settings
  anonymizeAuthors: false,

  // Advanced Settings
  requestTimeout: 30000,
  maxRetries: 3,

  // Credit Tracking
  creditsRemaining: 10,
  creditResetDate: new Date().toISOString(),

  // Timeline View Settings
  timelineSortBy: 'published',
  timelineSortOrder: 'newest'
};