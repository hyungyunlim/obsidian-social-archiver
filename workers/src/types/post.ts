/**
 * Post data types for Workers API
 */

export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads' | 'youtube' | 'reddit';

export interface Author {
  name: string;
  url: string;
  avatar?: string;
  handle?: string; // @username format (e.g., @johndoe)
  username?: string; // Plain username (for compatibility with plugin)
  verified?: boolean;
  bio?: string; // TikTok Fast API profile_biography
  followers?: number; // TikTok Fast API profile_followers
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
  bookmarks?: number; // TikTok collect_count
  timestamp: string; // ISO 8601 format
  editedAt?: string;
  duration?: number; // Video/audio duration in seconds (YouTube, TikTok, etc)
  music?: {
    title: string;
    author: string;
    url: string;
    cover?: string;
    isOriginal?: boolean;
  }; // TikTok music info
  originalSound?: string; // TikTok original sound text
  taggedUsers?: Array<{
    handle: string;
    name: string;
    id: string;
    url: string;
  }>; // TikTok Fast API tagged_user
  externalLink?: string; // Threads external_link_title
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
  timestamp?: string; // Optional - some platforms don't provide comment timestamps
  likes?: number;
  replies?: Comment[];
}

export interface PostData {
  platform: Platform;
  id: string;
  url: string;
  videoId?: string; // YouTube video ID
  author: Author;
  content: {
    text: string;
    html?: string;
    hashtags?: string[]; // TikTok/X hashtags
    community?: {
      name: string;
      url: string;
    }; // Reddit community/subreddit
  };
  media: Media[];
  metadata: PostMetadata;
  comments?: Comment[]; // Optional comments array for future support
  mediaSourceUrls?: string[]; // Original media URLs (before proxy download, plugin-side only)
  ai?: AIAnalysis;
  transcript?: {
    raw?: string; // Full transcript text
    formatted?: Array<{
      start_time: number; // milliseconds
      end_time: number;
      duration: number;
      text: string;
    }>;
    language?: string;
  }; // YouTube transcript
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
