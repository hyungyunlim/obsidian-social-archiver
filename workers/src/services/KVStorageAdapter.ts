import type { ShareInfo } from './ShareService';

/**
 * Storage operation result
 */
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Migration result for tier upgrades
 */
export interface MigrationResult {
  shareId: string;
  fromTier: 'free' | 'pro';
  toTier: 'free' | 'pro';
  success: boolean;
  error?: string;
}

/**
 * KV Storage Adapter
 *
 * Handles KV Store operations with TTL management and R2 integration
 * for pro tier permanent storage
 */
export class KVStorageAdapter {
  constructor(
    private readonly kv: KVNamespace,
    private readonly r2?: R2Bucket
  ) {}

  /**
   * Save share to KV Store
   */
  async saveShare(shareInfo: ShareInfo): Promise<StorageResult> {
    try {
      const key = `share:${shareInfo.id}`;
      const value = JSON.stringify(shareInfo);

      // Calculate TTL based on tier
      const ttl = this.calculateTTL(shareInfo);

      // Save to KV with TTL
      await this.kv.put(key, value, {
        expirationTtl: ttl,
        metadata: {
          tier: shareInfo.tier,
          createdAt: shareInfo.createdAt.toISOString(),
          noteId: shareInfo.noteId
        }
      });

      // If pro tier and R2 available, also save to R2 for permanent backup
      if (shareInfo.tier === 'pro' && this.r2) {
        await this.saveToR2(shareInfo);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save share'
      };
    }
  }

  /**
   * Get share from KV Store
   */
  async getShare(id: string): Promise<StorageResult<ShareInfo>> {
    try {
      const key = `share:${id}`;
      const value = await this.kv.get(key, 'json') as ShareInfo | null;

      if (!value) {
        // If not in KV, try R2 (for pro tier)
        if (this.r2) {
          const r2Value = await this.getFromR2(id);
          if (r2Value) {
            // Restore to KV
            await this.saveShare(r2Value);
            return { success: true, data: r2Value };
          }
        }

        return {
          success: false,
          error: 'Share not found'
        };
      }

      // Parse dates
      value.createdAt = new Date(value.createdAt);
      if (value.expiresAt) {
        value.expiresAt = new Date(value.expiresAt);
      }
      if (value.lastAccessed) {
        value.lastAccessed = new Date(value.lastAccessed);
      }

      return { success: true, data: value };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get share'
      };
    }
  }

  /**
   * Delete share from KV Store
   */
  async deleteShare(id: string): Promise<StorageResult> {
    try {
      const key = `share:${id}`;

      // Delete from KV
      await this.kv.delete(key);

      // Delete from R2 if exists
      if (this.r2) {
        await this.deleteFromR2(id);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete share'
      };
    }
  }

  /**
   * Update share metadata (view count, last accessed)
   */
  async updateShareMetadata(
    id: string,
    updates: Partial<Pick<ShareInfo, 'viewCount' | 'lastAccessed'>>
  ): Promise<StorageResult> {
    try {
      const result = await this.getShare(id);
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const shareInfo = result.data;
      Object.assign(shareInfo, updates);

      return await this.saveShare(shareInfo);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update metadata'
      };
    }
  }

  /**
   * Migrate share between tiers
   */
  async migrateTier(
    id: string,
    fromTier: 'free' | 'pro',
    toTier: 'free' | 'pro'
  ): Promise<MigrationResult> {
    try {
      const result = await this.getShare(id);
      if (!result.success || !result.data) {
        return {
          shareId: id,
          fromTier,
          toTier,
          success: false,
          error: 'Share not found'
        };
      }

      const shareInfo = result.data;
      shareInfo.tier = toTier;

      // Update expiration based on new tier
      if (toTier === 'pro') {
        // Pro tier: extend to 1 year
        shareInfo.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      } else {
        // Free tier: set to 30 days from now
        shareInfo.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      const saveResult = await this.saveShare(shareInfo);
      if (!saveResult.success) {
        return {
          shareId: id,
          fromTier,
          toTier,
          success: false,
          error: saveResult.error
        };
      }

      return {
        shareId: id,
        fromTier,
        toTier,
        success: true
      };
    } catch (error) {
      return {
        shareId: id,
        fromTier,
        toTier,
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed'
      };
    }
  }

  /**
   * Batch cleanup of expired shares
   */
  async cleanupExpiredShares(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    try {
      // List all share keys
      const list = await this.kv.list({ prefix: 'share:' });

      for (const key of list.keys) {
        const id = key.name.replace('share:', '');
        const result = await this.getShare(id);

        if (result.success && result.data) {
          const shareInfo = result.data;

          // Check if expired
          if (shareInfo.expiresAt && new Date() > shareInfo.expiresAt) {
            const deleteResult = await this.deleteShare(id);
            if (deleteResult.success) {
              deleted++;
            } else {
              errors++;
            }
          }
        }
      }
    } catch (error) {
      console.error('[KVStorageAdapter] Cleanup failed:', error);
    }

    return { deleted, errors };
  }

  /**
   * Calculate TTL based on share info
   */
  private calculateTTL(shareInfo: ShareInfo): number {
    if (shareInfo.tier === 'pro') {
      // Pro tier: 1 year TTL (KV max is ~400 days, so use max)
      return 365 * 24 * 60 * 60; // 31,536,000 seconds
    }

    // Free tier: 30 days
    if (shareInfo.expiresAt) {
      const now = Date.now();
      const expiryTime = shareInfo.expiresAt.getTime();
      const ttlMs = expiryTime - now;
      return Math.max(0, Math.floor(ttlMs / 1000));
    }

    return 30 * 24 * 60 * 60; // 2,592,000 seconds (30 days)
  }

  /**
   * Save to R2 for permanent pro tier storage
   */
  private async saveToR2(shareInfo: ShareInfo): Promise<void> {
    if (!this.r2) return;

    try {
      const key = `shares/${shareInfo.id}.json`;
      const value = JSON.stringify(shareInfo);

      await this.r2.put(key, value, {
        httpMetadata: {
          contentType: 'application/json'
        },
        customMetadata: {
          tier: shareInfo.tier,
          createdAt: shareInfo.createdAt.toISOString()
        }
      });
    } catch (error) {
      console.error('[KVStorageAdapter] Failed to save to R2:', error);
      // Don't throw - R2 is backup storage
    }
  }

  /**
   * Get from R2 backup storage
   */
  private async getFromR2(id: string): Promise<ShareInfo | null> {
    if (!this.r2) return null;

    try {
      const key = `shares/${id}.json`;
      const object = await this.r2.get(key);

      if (!object) return null;

      const text = await object.text();
      const shareInfo = JSON.parse(text) as ShareInfo;

      // Parse dates
      shareInfo.createdAt = new Date(shareInfo.createdAt);
      if (shareInfo.expiresAt) {
        shareInfo.expiresAt = new Date(shareInfo.expiresAt);
      }
      if (shareInfo.lastAccessed) {
        shareInfo.lastAccessed = new Date(shareInfo.lastAccessed);
      }

      return shareInfo;
    } catch (error) {
      console.error('[KVStorageAdapter] Failed to get from R2:', error);
      return null;
    }
  }

  /**
   * Delete from R2 backup storage
   */
  private async deleteFromR2(id: string): Promise<void> {
    if (!this.r2) return;

    try {
      const key = `shares/${id}.json`;
      await this.r2.delete(key);
    } catch (error) {
      console.error('[KVStorageAdapter] Failed to delete from R2:', error);
      // Don't throw - best effort cleanup
    }
  }

  /**
   * Implement retry logic with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const delay = 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
