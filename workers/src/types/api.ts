import { z } from 'zod';

// Archive API types
export const ArchiveRequestSchema = z.object({
  url: z.string().url(),
  options: z.object({
    enableAI: z.boolean().optional().default(false),
    deepResearch: z.boolean().optional().default(false),
    downloadMedia: z.boolean().optional().default(true)
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
  content: z.string(),
  metadata: z.object({
    platform: z.string(),
    author: z.string(),
    originalUrl: z.string()
  }),
  options: z.object({
    expiry: z.number().optional(), // Unix timestamp
    password: z.string().optional()
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