export interface ArchiveOptions {
  enableAI: boolean;
  downloadMedia: boolean;
  removeTracking: boolean;
  generateShareLink: boolean;
  deepResearch: boolean;
}

export interface ArchiveResult {
  success: boolean;
  filePath?: string;
  shareUrl?: string;
  creditsUsed: number;
  error?: string;
}

export interface YamlFrontmatter {
  share: boolean;
  shareUrl?: string;
  sharePassword?: string;
  shareExpiry?: Date;
  platform: string;
  author: string;
  authorUrl: string;
  originalUrl: string;
  archived: Date;
  lastModified: Date;
  download_time?: number; // Time taken to archive in seconds
  tags: string[];
  ai_summary?: string;
  sentiment?: string;
  topics?: string[];
  [key: string]: unknown; // Allow custom fields
}

export interface ArchiveProgress {
  stage: 'fetching' | 'processing' | 'downloading' | 'saving' | 'complete';
  progress: number; // 0-100
  message: string;
}

export interface CreditUsage {
  basic: 1;
  withAI: 3;
  deepResearch: 5;
}