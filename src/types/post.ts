import { z } from 'zod';

// Platform types
export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads';

// Media types
export interface Media {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  mimeType?: string;
  alt?: string;
}

// Author information
export interface Author {
  name: string;
  url: string;
  avatar?: string;
  username?: string;
  verified?: boolean;
}

// Post metadata
export interface PostMetadata {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  timestamp: Date;
  editedAt?: Date;
  location?: string;
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