// Production API endpoint (hardcoded, users cannot change)
export const API_ENDPOINT = 'https://social-archiver-api.junlim.org';

export interface SocialArchiverSettings {
  // API Configuration (apiEndpoint removed - now hardcoded)
  apiKey: string;
  licenseKey: string;

  // User Settings
  userName: string; // User's display name for comments

  // Storage Settings
  archivePath: string;
  mediaPath: string;
  fileNameFormat: string;

  // Feature Toggles
  enableAI: boolean;
  enableDeepResearch: boolean;
  enableSharing: boolean;
  autoArchive: boolean;
  downloadMedia: boolean;

  // Privacy Settings
  removeTracking: boolean;
  anonymizeAuthors: boolean;

  // Advanced Settings
  requestTimeout: number;
  maxRetries: number;
  debugMode: boolean;

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

  // User Settings
  userName: 'You', // Default name for comments

  // Storage Settings
  archivePath: 'Social Archives',
  mediaPath: 'assets/social',
  fileNameFormat: '[YYYY-MM-DD] {platform}-{slug}-{shortId}',

  // Feature Toggles
  enableAI: false,
  enableDeepResearch: false,
  enableSharing: false,
  autoArchive: false,
  downloadMedia: true,

  // Privacy Settings
  removeTracking: true,
  anonymizeAuthors: false,

  // Advanced Settings
  requestTimeout: 30000,
  maxRetries: 3,
  debugMode: false,

  // Credit Tracking
  creditsRemaining: 10,
  creditResetDate: new Date().toISOString(),

  // Timeline View Settings
  timelineSortBy: 'published',
  timelineSortOrder: 'newest'
};