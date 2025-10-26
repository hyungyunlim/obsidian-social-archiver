import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownConverter } from '@/services/MarkdownConverter';
import type { PostData, Platform } from '@/types/post';

describe('MarkdownConverter', () => {
  let converter: MarkdownConverter;

  const mockPostData: PostData = {
    platform: 'facebook' as Platform,
    id: 'test-123',
    url: 'https://facebook.com/post/123',
    author: {
      name: 'Test User',
      url: 'https://facebook.com/user/test',
      verified: true,
    },
    content: {
      text: 'This is a test post with **markdown**.',
    },
    media: [
      {
        type: 'image',
        url: 'https://example.com/image.jpg',
        alt: 'Test image',
      },
      {
        type: 'video',
        url: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      },
    ],
    metadata: {
      timestamp: new Date('2024-01-01T12:00:00Z'),
      likes: 100,
      comments: 50,
      shares: 25,
    },
    ai: {
      summary: 'This is a summary of the post',
      sentiment: 'positive',
      topics: ['tech', 'innovation'],
      language: 'en',
      readingTime: 1,
      factCheck: [
        {
          claim: 'AI is revolutionary',
          verdict: 'true',
          evidence: 'Multiple studies confirm',
          confidence: 0.95,
        },
      ],
    },
  };

  beforeEach(() => {
    converter = new MarkdownConverter();
  });

  describe('convert', () => {
    it('should convert PostData to MarkdownResult', async () => {
      const result = await converter.convert(mockPostData);

      expect(result).toBeDefined();
      expect(result.frontmatter).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.fullDocument).toBeDefined();
    });

    it('should generate correct frontmatter', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.frontmatter.platform).toBe('facebook');
      expect(result.frontmatter.author).toBe('Test User');
      expect(result.frontmatter.authorUrl).toBe('https://facebook.com/user/test');
      expect(result.frontmatter.originalUrl).toBe('https://facebook.com/post/123');
      expect(result.frontmatter.share).toBe(false);
      expect(result.frontmatter.tags).toContain('social/facebook');
      expect(result.frontmatter.tags).toContain('topic/tech');
      expect(result.frontmatter.tags).toContain('topic/innovation');
      expect(result.frontmatter.ai_summary).toBe('This is a summary of the post');
      expect(result.frontmatter.sentiment).toBe('positive');
    });

    it('should include author name in content', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('Test User');
    });

    it('should include platform in content', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('Facebook');
    });

    it('should include post text in content', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('This is a test post with **markdown**.');
    });

    it('should format media correctly', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('![Test image](https://example.com/image.jpg)');
      expect(result.content).toContain('[🎥 Video](https://example.com/video.mp4)');
    });

    it('should include metadata statistics', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('Likes:** 100');
      expect(result.content).toContain('Comments:** 50');
      expect(result.content).toContain('Shares:** 25');
    });

    it('should include AI analysis', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('AI Analysis');
      expect(result.content).toContain('Summary:** This is a summary of the post');
      expect(result.content).toContain('Sentiment:** positive');
      expect(result.content).toContain('Topics:** tech, innovation');
    });

    it('should format fact checks correctly', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('Fact Checks');
      expect(result.content).toContain('AI is revolutionary');
      expect(result.content).toContain('Verdict: true');
      expect(result.content).toContain('Confidence: 95%');
      expect(result.content).toContain('Evidence: Multiple studies confirm');
    });

    it('should show verified badge for verified accounts', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('✓ Verified Account');
    });

    it('should generate full document with frontmatter', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.fullDocument).toMatch(/^---\n/);
      expect(result.fullDocument).toContain('platform: facebook');
      expect(result.fullDocument).toContain('author: Test User');
      expect(result.fullDocument).toMatch(/---\n\n# Test User/);
    });
  });

  describe('platform-specific templates', () => {
    it('should use LinkedIn template for LinkedIn posts', async () => {
      const linkedinPost = {
        ...mockPostData,
        platform: 'linkedin' as Platform,
      };

      const result = await converter.convert(linkedinPost);

      expect(result.content).toContain('LinkedIn');
      expect(result.content).toContain('Reactions:'); // LinkedIn-specific term
    });

    it('should use Instagram template for Instagram posts', async () => {
      const instagramPost = {
        ...mockPostData,
        platform: 'instagram' as Platform,
      };

      const result = await converter.convert(instagramPost);

      expect(result.content).toContain('Instagram');
    });

    it('should use TikTok template for TikTok posts', async () => {
      const tiktokPost = {
        ...mockPostData,
        platform: 'tiktok' as Platform,
        metadata: {
          ...mockPostData.metadata,
          views: 10000,
        },
      };

      const result = await converter.convert(tiktokPost);

      expect(result.content).toContain('TikTok');
      expect(result.content).toContain('Views:** 10000');
    });

    it('should use X template for X posts', async () => {
      const xPost = {
        ...mockPostData,
        platform: 'x' as Platform,
      };

      const result = await converter.convert(xPost);

      expect(result.content).toContain('X (Twitter)');
      expect(result.content).toContain('Retweets:'); // X-specific term
    });

    it('should use Threads template for Threads posts', async () => {
      const threadsPost = {
        ...mockPostData,
        platform: 'threads' as Platform,
      };

      const result = await converter.convert(threadsPost);

      expect(result.content).toContain('Threads');
    });
  });

  describe('custom templates', () => {
    it('should use custom template when provided', async () => {
      const customTemplate = '# Custom: {{author.name}}\n\n{{content.text}}';

      const result = await converter.convert(mockPostData, customTemplate);

      expect(result.content).toContain('Custom: Test User');
      expect(result.content).not.toContain('Platform:');
    });

    it('should allow setting platform-specific custom template', async () => {
      const customTemplate = '# My Custom Template\n\n{{content.text}}';
      converter.setTemplate('facebook', customTemplate);

      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('My Custom Template');
    });
  });

  describe('conditional rendering', () => {
    it('should show media section only if media exists', async () => {
      const postWithoutMedia = {
        ...mockPostData,
        media: [],
      };

      const result = await converter.convert(postWithoutMedia);

      expect(result.content).not.toContain('## Media');
    });

    it('should show AI section only if AI data exists', async () => {
      const postWithoutAI = {
        ...mockPostData,
        ai: undefined,
      };

      const result = await converter.convert(postWithoutAI);

      expect(result.content).not.toContain('## AI Analysis');
    });

    it('should not show verified badge for unverified accounts', async () => {
      const unverifiedPost = {
        ...mockPostData,
        author: {
          ...mockPostData.author,
          verified: false,
        },
      };

      const result = await converter.convert(unverifiedPost);

      expect(result.content).not.toContain('✓ Verified Account');
    });
  });

  describe('date formatting', () => {
    it('should format dates in ISO-like format by default', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('2024-01-01 12:00');
    });

    it('should use custom date formatter when set', async () => {
      converter.setDateFormat((date) => date.toLocaleDateString('en-US'));

      const result = await converter.convert(mockPostData);

      expect(result.content).toContain('1/1/2024');
    });
  });

  describe('markdown escaping', () => {
    it('should escape markdown special characters in alt text', async () => {
      const postWithSpecialChars = {
        ...mockPostData,
        media: [
          {
            type: 'image' as const,
            url: 'https://example.com/image.jpg',
            alt: 'Image with *asterisks* and [brackets]',
          },
        ],
      };

      const result = await converter.convert(postWithSpecialChars);

      expect(result.content).toContain('\\*asterisks\\*');
      expect(result.content).toContain('\\[brackets\\]');
    });
  });

  describe('YAML frontmatter formatting', () => {
    it('should format arrays correctly in YAML', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.fullDocument).toContain('tags:');
      expect(result.fullDocument).toContain('  - social/facebook');
      expect(result.fullDocument).toContain('  - topic/tech');
    });

    it('should quote values with special characters', async () => {
      const postWithSpecialUrl = {
        ...mockPostData,
        url: 'https://example.com/post#section:detail',
      };

      const result = await converter.convert(postWithSpecialUrl);

      expect(result.fullDocument).toMatch(/originalUrl: ".*#.*"/);
    });

    it('should omit undefined values from frontmatter', async () => {
      const result = await converter.convert(mockPostData);

      expect(result.fullDocument).not.toContain('shareUrl:');
      expect(result.fullDocument).not.toContain('sharePassword:');
    });
  });

  describe('media type formatting', () => {
    it('should format audio files correctly', async () => {
      const postWithAudio = {
        ...mockPostData,
        media: [
          {
            type: 'audio' as const,
            url: 'https://example.com/audio.mp3',
          },
        ],
      };

      const result = await converter.convert(postWithAudio);

      expect(result.content).toContain('[🎵 Audio](https://example.com/audio.mp3)');
    });

    it('should format documents correctly', async () => {
      const postWithDocument = {
        ...mockPostData,
        media: [
          {
            type: 'document' as const,
            url: 'https://example.com/doc.pdf',
          },
        ],
      };

      const result = await converter.convert(postWithDocument);

      expect(result.content).toContain('[📄 Document](https://example.com/doc.pdf)');
    });
  });
});
