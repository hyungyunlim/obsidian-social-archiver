import { z } from 'zod';

// Archive API types
export const ArchiveRequestSchema = z.object({
  url: z.string().url(),
  options: z.object({
    enableAI: z.boolean().optional().default(false),
    deepResearch: z.boolean().optional().default(false),
    downloadMedia: z.boolean().optional().default(true),
    // YouTube-specific options
    includeTranscript: z.boolean().optional().default(false),
    includeFormattedTranscript: z.boolean().optional().default(true)
  }).optional().default({}),
  licenseKey: z.string().optional()
});

export type ArchiveRequest = z.infer<typeof ArchiveRequestSchema>;

export interface ArchiveResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedTime?: number;
  creditsRequired: number;
}

// Share API types
export const CreateShareRequestSchema = z.object({
  // Full post data (new format - preferred)
  postData: z.any().optional(), // Full PostData object from plugin

  // Legacy format (deprecated but still supported)
  content: z.string().optional(),
  metadata: z.object({
    title: z.string(),
    platform: z.string(),
    author: z.string(),
    originalUrl: z.string(),
    tags: z.array(z.string()).optional(),
    thumbnail: z.string().optional()
  }).optional(),

  options: z.object({
    expiry: z.number().optional(), // Unix timestamp
    password: z.string().optional(),
    username: z.string().optional(), // Username for timeline indexing
    shareId: z.string().optional() // Client-provided shareId for Phase 2 updates
  }).optional()
});

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;

export interface ShareResponse {
  shareId: string;
  shareUrl: string;
  expiresAt?: number;
  passwordProtected: boolean;
}

// License API types
export const ValidateLicenseRequestSchema = z.object({
  licenseKey: z.string().min(1)
});

export type ValidateLicenseRequest = z.infer<typeof ValidateLicenseRequestSchema>;

export interface LicenseResponse {
  valid: boolean;
  plan: 'free' | 'pro';
  creditsRemaining: number;
  creditLimit: number;
  resetDate: string;
  features: string[];
}

// Job Status API types
export interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}