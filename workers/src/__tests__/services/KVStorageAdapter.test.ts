import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVStorageAdapter, type StorageResult, type MigrationResult } from '@/services/KVStorageAdapter';
import type { ShareInfo } from '@/services/ShareService';

describe('KVStorageAdapter', () => {
  let adapter: KVStorageAdapter;
  let mockKV: KVNamespace;
  let mockR2: R2Bucket;

  beforeEach(() => {
    // Mock KV Store
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    } as any;

    // Mock R2 Bucket
    mockR2 = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as any;

    adapter = new KVStorageAdapter(mockKV, mockR2);
  });

  describe('saveShare', () => {
    const mockShareInfo: ShareInfo = {
      id: 'test123',
      noteId: 'note.md',
      notePath: 'note.md',
      content: '# Test Note',
      metadata: {
        title: 'Test',
        created: Date.now(),
        modified: Date.now()
      },
      viewCount: 0,
      tier: 'free',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    it('should save share to KV Store with TTL for free tier', async () => {
      const result = await adapter.saveShare(mockShareInfo);

      expect(result.success).toBe(true);
      expect(mockKV.put).toHaveBeenCalledWith(
        'share:test123',
        expect.any(String),
        expect.objectContaining({
          expirationTtl: expect.any(Number),
          metadata: expect.objectContaining({
            tier: 'free',
            noteId: 'note.md'
          })
        })
      );
    });

    it('should save pro tier share to both KV and R2', async () => {
      const proShare: ShareInfo = {
        ...mockShareInfo,
        tier: 'pro'
      };

      const result = await adapter.saveShare(proShare);

      expect(result.success).toBe(true);
      expect(mockKV.put).toHaveBeenCalled();
      expect(mockR2.put).toHaveBeenCalledWith(
        'shares/test123.json',
        expect.any(String),
        expect.objectContaining({
          httpMetadata: { contentType: 'application/json' },
          customMetadata: expect.objectContaining({
            tier: 'pro'
          })
        })
      );
    });

    it('should handle KV Store errors gracefully', async () => {
      vi.mocked(mockKV.put).mockRejectedValueOnce(new Error('KV error'));

      const result = await adapter.saveShare(mockShareInfo);

      expect(result.success).toBe(false);
      expect(result.error).toBe('KV error');
    });

    it('should calculate correct TTL for free tier (30 days)', async () => {
      await adapter.saveShare(mockShareInfo);

      const call = vi.mocked(mockKV.put).mock.calls[0];
      const options = call[2] as any;

      // TTL should be around 30 days (2592000 seconds)
      expect(options.expirationTtl).toBeGreaterThanOrEqual(2591000);
      expect(options.expirationTtl).toBeLessThanOrEqual(2593000);
    });

    it('should calculate correct TTL for pro tier (365 days)', async () => {
      const proShare: ShareInfo = {
        ...mockShareInfo,
        tier: 'pro'
      };

      await adapter.saveShare(proShare);

      const call = vi.mocked(mockKV.put).mock.calls[0];
      const options = call[2] as any;

      // TTL should be 365 days (31536000 seconds)
      expect(options.expirationTtl).toBe(365 * 24 * 60 * 60);
    });

    it('should not save to R2 if R2 is not configured', async () => {
      const adapterWithoutR2 = new KVStorageAdapter(mockKV);
      const proShare: ShareInfo = {
        ...mockShareInfo,
        tier: 'pro'
      };

      await adapterWithoutR2.saveShare(proShare);

      expect(mockKV.put).toHaveBeenCalled();
      expect(mockR2.put).not.toHaveBeenCalled();
    });
  });

  describe('getShare', () => {
    it('should retrieve share from KV Store', async () => {
      const mockShare: ShareInfo = {
        id: 'test123',
        noteId: 'note.md',
        notePath: 'note.md',
        content: '# Test',
        metadata: {
          title: 'Test',
          created: Date.now(),
          modified: Date.now()
        },
        viewCount: 5,
        tier: 'free',
        createdAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-12-31')
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(mockShare as any);

      const result = await adapter.getShare('test123');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('test123');
      expect(result.data?.createdAt).toBeInstanceOf(Date);
      expect(result.data?.expiresAt).toBeInstanceOf(Date);
    });

    it('should return error for non-existent share', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(null);
      vi.mocked(mockR2.get).mockResolvedValueOnce(null);

      const result = await adapter.getShare('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Share not found');
    });

    it('should fallback to R2 if not found in KV', async () => {
      const mockShare: ShareInfo = {
        id: 'test123',
        noteId: 'note.md',
        notePath: 'note.md',
        content: '# Test',
        metadata: {
          title: 'Test',
          created: Date.now(),
          modified: Date.now()
        },
        viewCount: 5,
        tier: 'pro',
        createdAt: new Date('2024-01-01')
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(null);
      vi.mocked(mockR2.get).mockResolvedValueOnce({
        text: vi.fn().mockResolvedValue(JSON.stringify(mockShare))
      } as any);

      const result = await adapter.getShare('test123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test123');
      expect(mockR2.get).toHaveBeenCalledWith('shares/test123.json');
    });

    it('should restore share to KV after retrieving from R2', async () => {
      const mockShare: ShareInfo = {
        id: 'test123',
        noteId: 'note.md',
        notePath: 'note.md',
        content: '# Test',
        metadata: {
          title: 'Test',
          created: Date.now(),
          modified: Date.now()
        },
        viewCount: 5,
        tier: 'pro',
        createdAt: new Date('2024-01-01')
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(null);
      vi.mocked(mockR2.get).mockResolvedValueOnce({
        text: vi.fn().mockResolvedValue(JSON.stringify(mockShare))
      } as any);

      await adapter.getShare('test123');

      // Should restore to KV
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should parse dates correctly', async () => {
      const shareData = {
        id: 'test123',
        noteId: 'note.md',
        notePath: 'note.md',
        content: '# Test',
        metadata: {
          title: 'Test',
          created: Date.now(),
          modified: Date.now()
        },
        viewCount: 5,
        tier: 'free',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2025-12-31T00:00:00.000Z',
        lastAccessed: '2024-06-01T00:00:00.000Z'
      };

      vi.mocked(mockKV.get).mockResolvedValueOnce(shareData as any);

      const result = await adapter.getShare('test123');

      expect(result.data?.createdAt).toBeInstanceOf(Date);
      expect(result.data?.expiresAt).toBeInstanceOf(Date);
      expect(result.data?.lastAccessed).toBeInstanceOf(Date);
    });
  });

  describe('deleteShare', () => {
    it('should delete share from KV Store', async () => {
      const result = await adapter.deleteShare('test123');

      expect(result.success).toBe(true);
      expect(mockKV.delete).toHaveBeenCalledWith('share:test123');
    });

    it('should delete share from R2 if configured', async () => {
      await adapter.deleteShare('test123');

      expect(mockR2.delete).toHaveBeenCalledWith('shares/test123.json');
    });

    it('should not fail if R2 delete fails', async () => {
      vi.mocked(mockR2.delete).mockRejectedValueOnce(new Error('R2 error'));

      const result = await adapter.deleteShare('test123');

      // Should still succeed even if R2 fails
      expect(result.success).toBe(true);
    });

    it('should handle KV delete errors', async () => {
      vi.mocked(mockKV.delete).mockRejectedValueOnce(new Error('Delete failed'));

      const result = await adapter.deleteShare('test123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('updateShareMetadata', () => {
    const mockShare: ShareInfo = {
      id: 'test123',
      noteId: 'note.md',
      notePath: 'note.md',
      content: '# Test',
      metadata: {
        title: 'Test',
        created: Date.now(),
        modified: Date.now()
      },
      viewCount: 5,
      tier: 'free',
      createdAt: new Date()
    };

    it('should update view count', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(mockShare as any);

      const result = await adapter.updateShareMetadata('test123', { viewCount: 6 });

      expect(result.success).toBe(true);
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should update last accessed timestamp', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(mockShare as any);

      const now = new Date();
      const result = await adapter.updateShareMetadata('test123', { lastAccessed: now });

      expect(result.success).toBe(true);
    });

    it('should return error if share not found', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(null);
      vi.mocked(mockR2.get).mockResolvedValueOnce(null);

      const result = await adapter.updateShareMetadata('nonexistent', { viewCount: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Share not found');
    });
  });

  describe('migrateTier', () => {
    const mockShare: ShareInfo = {
      id: 'test123',
      noteId: 'note.md',
      notePath: 'note.md',
      content: '# Test',
      metadata: {
        title: 'Test',
        created: Date.now(),
        modified: Date.now()
      },
      viewCount: 5,
      tier: 'free',
      createdAt: new Date()
    };

    it('should migrate from free to pro tier', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(mockShare as any);

      const result = await adapter.migrateTier('test123', 'free', 'pro');

      expect(result.success).toBe(true);
      expect(result.fromTier).toBe('free');
      expect(result.toTier).toBe('pro');
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should extend expiry to 1 year when upgrading to pro', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(mockShare as any);

      await adapter.migrateTier('test123', 'free', 'pro');

      const putCall = vi.mocked(mockKV.put).mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);

      const expiresAt = new Date(savedData.expiresAt);
      const now = new Date();
      const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it('should set expiry to 30 days when downgrading to free', async () => {
      const proShare = { ...mockShare, tier: 'pro' as const };
      vi.mocked(mockKV.get).mockResolvedValueOnce(proShare as any);

      await adapter.migrateTier('test123', 'pro', 'free');

      const putCall = vi.mocked(mockKV.put).mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);

      const expiresAt = new Date(savedData.expiresAt);
      const now = new Date();
      const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(30);
    });

    it('should return error if share not found', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce(null);
      vi.mocked(mockR2.get).mockResolvedValueOnce(null);

      const result = await adapter.migrateTier('nonexistent', 'free', 'pro');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Share not found');
    });
  });

  describe('cleanupExpiredShares', () => {
    it('should delete expired shares', async () => {
      const mockShares = [
        {
          id: 'expired1',
          expiresAt: new Date('2020-01-01')
        },
        {
          id: 'active1',
          expiresAt: new Date('2025-12-31')
        },
        {
          id: 'expired2',
          expiresAt: new Date('2021-01-01')
        }
      ];

      vi.mocked(mockKV.list).mockResolvedValueOnce({
        keys: [
          { name: 'share:expired1' },
          { name: 'share:active1' },
          { name: 'share:expired2' }
        ]
      } as any);

      mockShares.forEach(share => {
        vi.mocked(mockKV.get).mockResolvedValueOnce({
          ...share,
          noteId: 'note.md',
          notePath: 'note.md',
          content: 'test',
          metadata: { title: 'Test', created: Date.now(), modified: Date.now() },
          viewCount: 0,
          tier: 'free',
          createdAt: new Date()
        } as any);
      });

      const result = await adapter.cleanupExpiredShares();

      expect(result.deleted).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(mockKV.list).mockResolvedValueOnce({
        keys: [{ name: 'share:test1' }]
      } as any);

      vi.mocked(mockKV.get).mockResolvedValueOnce({
        id: 'test1',
        noteId: 'note.md',
        notePath: 'note.md',
        content: 'test',
        metadata: { title: 'Test', created: Date.now(), modified: Date.now() },
        viewCount: 0,
        tier: 'free',
        createdAt: new Date(),
        expiresAt: new Date('2020-01-01')
      } as any);

      vi.mocked(mockKV.delete).mockRejectedValueOnce(new Error('Delete failed'));

      const result = await adapter.cleanupExpiredShares();

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('should not delete shares without expiry', async () => {
      vi.mocked(mockKV.list).mockResolvedValueOnce({
        keys: [{ name: 'share:pro1' }]
      } as any);

      vi.mocked(mockKV.get).mockResolvedValueOnce({
        id: 'pro1',
        noteId: 'note.md',
        notePath: 'note.md',
        content: 'test',
        metadata: { title: 'Test', created: Date.now(), modified: Date.now() },
        viewCount: 0,
        tier: 'pro',
        createdAt: new Date()
        // No expiresAt
      } as any);

      const result = await adapter.cleanupExpiredShares();

      expect(result.deleted).toBe(0);
      expect(mockKV.delete).not.toHaveBeenCalled();
    });
  });
});
