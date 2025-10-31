import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultStorageService } from '../../services/VaultStorageService';
import { VaultManager } from '../../services/VaultManager';
import { MarkdownConverter } from '../../services/MarkdownConverter';
import { PostData, Media } from '../../types/post';
import { SocialArchiverSettings } from '../../types/settings';
import { Vault, TFile } from 'obsidian';

// Mock Obsidian Vault
vi.mock('obsidian', () => ({
  Vault: vi.fn(),
  TFile: vi.fn(),
  TFolder: vi.fn(),
  normalizePath: (path: string) => path.replace(/\\/g, '/'),
}));

describe('VaultStorageService', () => {
  let service: VaultStorageService;
  let mockVault: Partial<Vault>;
  let mockSettings: SocialArchiverSettings;
  let mockVaultManager: Partial<VaultManager>;
  let mockMarkdownConverter: Partial<MarkdownConverter>;

  beforeEach(() => {
    // Mock Vault methods
    mockVault = {
      getFileByPath: vi.fn().mockReturnValue(null),
      createBinary: vi.fn().mockResolvedValue({
        path: 'attachments/social-archives/post/2024-03-15/image.png',
        name: 'image.png',
      } as TFile),
      create: vi.fn().mockResolvedValue({
        path: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        name: '2024-03-15-143052.md',
      } as TFile),
      modify: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockSettings = {
      apiKey: 'test-key',
      licenseKey: 'test-license',
      workerUrl: 'https://test.example.com',
      username: 'testuser',
      userName: 'Test User',
      userAvatar: 'https://example.com/avatar.png',
      archivePath: 'Social Archives',
      mediaPath: 'attachments/social-archives',
      fileNameFormat: '[YYYY-MM-DD] {platform}-{slug}-{shortId}',
      autoArchive: false,
      downloadMedia: 'images-and-videos',
      anonymizeAuthors: false,
      requestTimeout: 30000,
      maxRetries: 3,
      creditsRemaining: 10,
      creditResetDate: new Date().toISOString(),
      timelineSortBy: 'published',
      timelineSortOrder: 'newest',
    };

    // Mock VaultManager
    mockVaultManager = {
      createFolderIfNotExists: vi.fn().mockResolvedValue(undefined),
    };

    // Mock MarkdownConverter
    mockMarkdownConverter = {
      convert: vi.fn().mockResolvedValue({
        frontmatter: {
          platform: 'post',
          author: 'Test User',
          archived: '2024-03-15',
          tags: [],
          share: false,
        },
        content: 'Test post content',
        fullDocument: '---\nplatform: post\n---\n\nTest post content',
      }),
    };

    service = new VaultStorageService({
      vault: mockVault as Vault,
      settings: mockSettings,
      vaultManager: mockVaultManager as VaultManager,
      markdownConverter: mockMarkdownConverter as MarkdownConverter,
    });
  });

  describe('generateFilePath', () => {
    it('should generate correct file path for user post', () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: '',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Hello, world!',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      const path = service.generateFilePath(postData);

      expect(path).toBe('Social Archives/Posts/2024/03/2024-03-15-143052.md');
    });

    it('should handle different timestamps', () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1704110400000',
        url: '',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'New year post',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-01-01T12:00:00'),
        },
      };

      const path = service.generateFilePath(postData);

      expect(path).toBe('Social Archives/Posts/2024/01/2024-01-01-120000.md');
    });
  });

  describe('generateMediaPath', () => {
    it('should generate correct media path', () => {
      const timestamp = new Date('2024-03-15T14:30:52');
      const filename = 'my-image.png';

      const path = service.generateMediaPath(timestamp, filename);

      expect(path).toBe('attachments/social-archives/post/2024-03-15/my-image.png');
    });

    it('should sanitize filename with special characters', () => {
      const timestamp = new Date('2024-03-15T14:30:52');
      const filename = 'my:image?.png';

      const path = service.generateMediaPath(timestamp, filename);

      expect(path).toBe('attachments/social-archives/post/2024-03-15/my-image-.png');
    });

    it('should replace spaces with underscores', () => {
      const timestamp = new Date('2024-03-15T14:30:52');
      const filename = 'my image file.png';

      const path = service.generateMediaPath(timestamp, filename);

      expect(path).toBe('attachments/social-archives/post/2024-03-15/my_image_file.png');
    });
  });

  describe('saveMedia', () => {
    it('should save media file to Vault', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const timestamp = new Date('2024-03-15T14:30:52');

      const result = await service.saveMedia(mockFile, timestamp);

      expect(result.error).toBeUndefined();
      expect(result.savedPath).toBe('attachments/social-archives/post/2024-03-15/test.png');
      expect(result.url).toBe('attachments/social-archives/post/2024-03-15/test.png');
      expect(mockVault.createBinary).toHaveBeenCalled();
      expect(mockVaultManager.createFolderIfNotExists).toHaveBeenCalledWith(
        'attachments/social-archives/post/2024-03-15'
      );
    });

    it('should handle file save error', async () => {
      vi.mocked(mockVault.createBinary!).mockRejectedValueOnce(new Error('Disk full'));

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const timestamp = new Date('2024-03-15T14:30:52');

      const result = await service.saveMedia(mockFile, timestamp);

      expect(result.error).toBe('Disk full');
      expect(result.savedPath).toBe('');
      expect(result.url).toBe('');
    });

    it('should generate unique path if file exists', async () => {
      // First call returns existing file, then null
      vi.mocked(mockVault.getFileByPath!)
        .mockReturnValueOnce({ path: 'existing' } as TFile)
        .mockReturnValue(null);

      vi.mocked(mockVault.createBinary!).mockResolvedValueOnce({
        path: 'attachments/social-archives/post/2024-03-15/test_1.png',
        name: 'test_1.png',
      } as TFile);

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const timestamp = new Date('2024-03-15T14:30:52');

      const result = await service.saveMedia(mockFile, timestamp);

      expect(result.error).toBeUndefined();
      expect(result.savedPath).toContain('test_1.png');
    });
  });

  describe('savePost', () => {
    it('should save post without media', async () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Hello, world!',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      const result = await service.savePost(postData);

      expect(result.file).toBeDefined();
      expect(result.path).toBe('Social Archives/Posts/2024/03/2024-03-15-143052.md');
      expect(result.mediaSaved).toHaveLength(0);
      expect(mockMarkdownConverter.convert).toHaveBeenCalledWith(postData);
      expect(mockVault.create).toHaveBeenCalled();
    });

    it('should save post with media files', async () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Post with images',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

      const result = await service.savePost(postData, [mockFile]);

      expect(result.file).toBeDefined();
      expect(result.mediaSaved).toHaveLength(1);
      expect(result.mediaSaved[0].error).toBeUndefined();
      expect(postData.media).toHaveLength(1);
      expect(postData.media[0].type).toBe('image');
      expect(postData.media[0].url).toBe('attachments/social-archives/post/2024-03-15/test.png');
    });

    it('should handle video files', async () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Post with video',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      const mockFile = new File(['test'], 'video.mp4', { type: 'video/mp4' });

      const result = await service.savePost(postData, [mockFile]);

      expect(result.mediaSaved).toHaveLength(1);
      expect(postData.media[0].type).toBe('video');
    });

    it('should update existing file if exists', async () => {
      vi.mocked(mockVault.getFileByPath!).mockReturnValue({
        path: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        name: '2024-03-15-143052.md',
      } as TFile);

      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Updated post',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      await service.savePost(postData);

      expect(mockVault.modify).toHaveBeenCalled();
      expect(mockVault.create).not.toHaveBeenCalled();
    });

    it('should skip media with save errors', async () => {
      vi.mocked(mockVault.createBinary!).mockRejectedValueOnce(new Error('Save failed'));

      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Post with failed media',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

      const result = await service.savePost(postData, [mockFile]);

      expect(result.mediaSaved).toHaveLength(1);
      expect(result.mediaSaved[0].error).toBe('Save failed');
      expect(postData.media).toHaveLength(0); // Failed media not added
    });
  });

  describe('cleanupMedia', () => {
    it('should delete saved media files', async () => {
      const mediaSaved = [
        {
          originalFile: new File(['test'], 'test.png', { type: 'image/png' }),
          savedPath: 'attachments/test.png',
          url: 'attachments/test.png',
        },
      ];

      vi.mocked(mockVault.getFileByPath!).mockReturnValue({
        path: 'attachments/test.png',
      } as TFile);

      await service.cleanupMedia(mediaSaved);

      expect(mockVault.delete).toHaveBeenCalled();
    });

    it('should skip files with errors', async () => {
      const mediaSaved = [
        {
          originalFile: new File(['test'], 'test.png', { type: 'image/png' }),
          savedPath: '',
          url: '',
          error: 'Save failed',
        },
      ];

      await service.cleanupMedia(mediaSaved);

      expect(mockVault.delete).not.toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      const mediaSaved = [
        {
          originalFile: new File(['test'], 'test.png', { type: 'image/png' }),
          savedPath: 'attachments/test.png',
          url: 'attachments/test.png',
        },
      ];

      vi.mocked(mockVault.getFileByPath!).mockReturnValue({
        path: 'attachments/test.png',
      } as TFile);

      vi.mocked(mockVault.delete!).mockRejectedValueOnce(new Error('Delete failed'));

      // Should not throw
      await expect(service.cleanupMedia(mediaSaved)).resolves.toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple media files', async () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: 'Social Archives/Posts/2024/03/2024-03-15-143052.md',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Post with multiple images',
        },
        media: [],
        metadata: {
          timestamp: new Date('2024-03-15T14:30:52'),
        },
      };

      const mockFiles = [
        new File(['test1'], 'test1.png', { type: 'image/png' }),
        new File(['test2'], 'test2.png', { type: 'image/png' }),
        new File(['test3'], 'test3.png', { type: 'image/png' }),
      ];

      const result = await service.savePost(postData, mockFiles);

      expect(result.mediaSaved).toHaveLength(3);
      expect(postData.media).toHaveLength(3);
    });

    it('should handle ISO string timestamps', async () => {
      const postData: PostData = {
        platform: 'post',
        id: 'post_1710513052000',
        url: '',
        author: {
          name: 'Test User',
          url: '',
        },
        content: {
          text: 'Hello, world!',
        },
        media: [],
        metadata: {
          timestamp: '2024-03-15T14:30:52.000Z',
        },
      };

      const path = service.generateFilePath(postData);

      expect(path).toBe('Social Archives/Posts/2024/03/2024-03-15-143052.md');
    });
  });
});
