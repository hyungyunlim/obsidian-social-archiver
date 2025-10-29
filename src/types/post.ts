import { z } from 'zod';

// Platform types
export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads' | 'youtube';

// Media types
export interface Media {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnail?: string; // Use 'thumbnail' to match workers
  thumbnailUrl?: string; // Keep for backward compatibility
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  mimeType?: string;
  altText?: string; // Use 'altText' to match workers
  alt?: string; // Keep for backward compatibility
}

// Author information
export interface Author {
  name: string;
  url: string;
  avatar?: string;
  handle?: string; // @username format (e.g., @johndoe) - from workers
  username?: string; // Plain username (backward compatibility)
  verified?: boolean;
  bio?: string; // TikTok Fast API profile_biography
  followers?: number; // TikTok Fast API profile_followers
}

// Post metadata
export interface PostMetadata {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  bookmarks?: number; // TikTok collect_count
  timestamp: Date | string; // Support both Date objects and ISO strings
  editedAt?: Date | string;
  location?: string;
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
  downloadTime?: number; // Time taken to archive in seconds
}

// Comment types
export interface Comment {
  id: string;
  author: Author;
  content: string;
  timestamp: string;
  likes?: number;
  replies?: Comment[];
}

// AI analysis results
export interface FactCheckResult {
  claim: string;
  verdict: 'true' | 'false' | 'misleading' | 'unverifiable';
  evidence: string;
  confidence: number;
}

export interface AIAnalysis {
  summary: string;
  factCheck: FactCheckResult[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
  language: string;
  readingTime: number;
}

// Main PostData interface
/**
 * YouTube transcript entry
 */
export interface TranscriptEntry {
  start_time: number;    // milliseconds
  end_time: number;      // milliseconds
  duration: number;      // milliseconds
  text: string;
}

/**
 * YouTube transcript data
 */
export interface Transcript {
  raw?: string;                      // Full transcript text
  formatted?: TranscriptEntry[];     // Timestamp segments
}

export interface PostData {
  platform: Platform;
  id: string;
  url: string;
  author: Author;
  content: {
    text: string;
    html?: string;
    markdown?: string;
    hashtags?: string[]; // TikTok/X hashtags
  };
  media: Media[];
  metadata: PostMetadata;
  comments?: Comment[]; // Optional comments array
  transcript?: Transcript;  // YouTube transcript data
  videoId?: string;         // YouTube video ID
  filePath?: string;        // File path in vault (for Timeline View)
  comment?: string;         // User's personal note/comment
  like?: boolean;           // User's personal like (for sorting/filtering)
  archive?: boolean;        // Whether post is archived (hidden by default)
  publishedDate?: Date;     // Original post publication date
  archivedDate?: Date;      // Date when post was archived
  mediaSourceUrls?: string[]; // Original media URLs (before proxy download)
  ai?: AIAnalysis;
  raw?: unknown; // Original API response
}

// Zod schema for validation with version
export const PostDataSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  platform: z.enum(['facebook', 'linkedin', 'instagram', 'tiktok', 'x', 'threads', 'youtube']),
  id: z.string(),
  url: z.string().url(),
  author: z.object({
    name: z.string(),
    url: z.string().url(),
    avatar: z.string().url().optional(),
    username: z.string().optional(),
    verified: z.boolean().optional(),
    bio: z.string().optional(),
    followers: z.number().optional()
  }),
  content: z.object({
    text: z.string(),
    html: z.string().optional(),
    markdown: z.string().optional(),
    hashtags: z.array(z.string()).optional()
  }),
  media: z.array(z.object({
    type: z.enum(['image', 'video', 'audio', 'document']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    duration: z.number().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
    alt: z.string().optional()
  })),
  metadata: z.object({
    likes: z.number().optional(),
    comments: z.number().optional(),
    shares: z.number().optional(),
    views: z.number().optional(),
    bookmarks: z.number().optional(),
    timestamp: z.date(),
    editedAt: z.date().optional(),
    location: z.string().optional(),
    music: z.object({
      title: z.string(),
      author: z.string(),
      url: z.string(),
      cover: z.string().optional(),
      isOriginal: z.boolean().optional()
    }).optional(),
    originalSound: z.string().optional(),
    taggedUsers: z.array(z.object({
      handle: z.string(),
      name: z.string(),
      id: z.string(),
      url: z.string()
    })).optional(),
    externalLink: z.string().optional(),
    downloadTime: z.number().optional()
  }),
  ai: z.object({
    summary: z.string(),
    factCheck: z.array(z.object({
      claim: z.string(),
      verdict: z.enum(['true', 'false', 'misleading', 'unverifiable']),
      evidence: z.string(),
      confidence: z.number().min(0).max(1)
    })),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    topics: z.array(z.string()),
    language: z.string(),
    readingTime: z.number()
  }).optional(),
  raw: z.unknown().optional()
});

export type ValidatedPostData = z.infer<typeof PostDataSchema>;