/**
 * Share tier type
 */
export type ShareTier = 'free' | 'pro';

/**
 * Share information structure (Workers-side)
 */
export interface ShareInfo {
  id: string;
  noteId: string;
  notePath: string;
  content: string;
  metadata: {
    title: string;
    author?: string;
    tags?: string[];
    created: number;
    modified: number;
  };
  password?: string; // Hashed password
  expiresAt?: Date;
  viewCount: number;
  tier: ShareTier;
  createdAt: Date;
  lastAccessed?: Date;
}
