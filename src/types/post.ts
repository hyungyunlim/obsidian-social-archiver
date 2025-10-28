import { z } from 'zod';

// Platform types
export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads';

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
}

// Post metadata
export interface PostMetadata {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  timestamp: Date | string; // Support both Date objects and ISO strings
  editedAt?: Date | string;
  location?: string;
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
export interface PostData {
  platform: Platform;
  id: string;
  url: string;
  author: Author;
  content: {
    text: string;
    html?: string;
    markdown?: string;
  };
  media: Media[];
  metadata: PostMetadata;
  comments?: Comment[]; // Optional comments array
  ai?: AIAnalysis;
  raw?: unknown; // Original API response
}

// Zod schema for validation with version
export const PostDataSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  platform: z.enum(['facebook', 'linkedin', 'instagram', 'tiktok', 'x', 'threads']),
  id: z.string(),
  url: z.string().url(),
  author: z.object({
    name: z.string(),
    url: z.string().url(),
    avatar: z.string().url().optional(),
    username: z.string().optional(),
    verified: z.boolean().optional()
  }),
  content: z.object({
    text: z.string(),
    html: z.string().optional(),
    markdown: z.string().optional()
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
    timestamp: z.date(),
    editedAt: z.date().optional(),
    location: z.string().optional()
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