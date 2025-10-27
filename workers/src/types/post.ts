/**
 * Post data types for Workers API
 */

export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads';

export interface Author {
  name: string;
  url: string;
  avatar?: string;
  handle?: string;
}

export interface Media {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  altText?: string;
}

export interface PostMetadata {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  timestamp: string; // ISO 8601 format
  editedAt?: string;
}

export interface AIAnalysis {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
  factCheck?: FactCheck[];
  keyPoints?: string[];
}

export interface FactCheck {
  claim: string;
  verdict: 'true' | 'false' | 'misleading' | 'unverified';
  sources: string[];
  explanation: string;
}

export interface PostData {
  platform: Platform;
  id: string;
  url: string;
  author: Author;
  content: {
    text: string;
    html?: string;
  };
  media: Media[];
  metadata: PostMetadata;
  ai?: AIAnalysis;
  raw?: any; // Original API response for debugging
}

export interface ArchiveJobData {
  url: string;
  platform: Platform;
  options: {
    enableAI: boolean;
    deepResearch: boolean;
    downloadMedia: boolean;
  };
  licenseKey?: string;
  creditsRequired: number;
}

export interface ArchiveResult {
  postData: PostData;
  creditsUsed: number;
  processingTime: number;
  cached: boolean;
}
