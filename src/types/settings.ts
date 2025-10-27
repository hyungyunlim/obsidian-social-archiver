export interface SocialArchiverSettings {
  // API Configuration
  apiEndpoint: string;
  apiKey: string;
  licenseKey: string;
  
  // Storage Settings
  archivePath: string;
  mediaPath: string;
  fileNameFormat: string;
  
  // Feature Toggles
  enableAI: boolean;
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
}

export const DEFAULT_SETTINGS: SocialArchiverSettings = {
  // API Configuration
  // Use local dev server if available, otherwise production
  apiEndpoint: 'http://localhost:8787',
  apiKey: '',
  licenseKey: '',
  
  // Storage Settings
  archivePath: 'Social Archives',
  mediaPath: 'assets/social',
  fileNameFormat: '[YYYY-MM-DD] {platform}-{slug}-{shortId}',
  
  // Feature Toggles
  enableAI: false,
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
  creditResetDate: new Date().toISOString()
};