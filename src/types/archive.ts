export interface ArchiveOptions {
  enableAI: boolean;
  downloadMedia: boolean;
  removeTracking: boolean;
  generateShareLink: boolean;
  deepResearch: boolean;
  includeTranscript?: boolean;           // YouTube: include full transcript
  includeFormattedTranscript?: boolean;  // YouTube: include formatted transcript with timestamps
  comment?: string;                      // User's personal note/comment
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
  published: string; // Original post date in YYYY-MM-DD HH:mm format
  archived: string; // Date when archived (YYYY-MM-DD format)
  lastModified: string; // YYYY-MM-DD format
  download_time?: number; // Time taken to archive in seconds
  archive?: boolean; // Whether the post is archived (hidden from timeline)
  comment?: string; // User's personal note/comment
  like?: boolean; // User's personal like (for sorting/filtering)
  hasTranscript?: boolean; // YouTube: has full transcript text
  hasFormattedTranscript?: boolean; // YouTube: has formatted transcript with timestamps
  videoId?: string; // YouTube video ID
  duration?: number; // YouTube video duration in seconds
  likes?: number; // Engagement metrics
  comments?: number;
  shares?: number;
  views?: number;
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