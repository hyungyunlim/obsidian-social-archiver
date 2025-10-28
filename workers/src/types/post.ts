/**
 * Post data types for Workers API
 */

export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads';

export interface Author {
  name: string;
  url: string;
  avatar?: string;
  handle?: string; // @username format (e.g., @johndoe)
  username?: string; // Plain username (for compatibility with plugin)
  verified?: boolean;
}

export interface Media {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  altText?: string;
  size?: number; // File size in bytes
  mimeType?: string; // MIME type (for compatibility with plugin)
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

export interface Comment {
  id: string;
  author: Author;
  content: string;
  timestamp: string;
  likes?: number;
  replies?: Comment[];
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
  comments?: Comment[]; // Optional comments array for future support
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
