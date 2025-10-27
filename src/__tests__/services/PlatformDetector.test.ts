import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformDetector } from '@/services/PlatformDetector';
import type { Platform } from '@/types/post';

describe('PlatformDetector', () => {
  let detector: PlatformDetector;

  beforeEach(() => {
    detector = new PlatformDetector();
  });

  describe('Facebook URLs', () => {
    const testCases: Array<[string, string]> = [
      // Standard post URLs
      ['https://www.facebook.com/zuck/posts/123456789', 'Standard post'],
      ['https://facebook.com/john.doe/posts/987654321', 'Post without www'],
      ['https://m.facebook.com/story.php?story_fbid=123456&id=789', 'Mobile story'],

      // Permalink URLs
      ['https://www.facebook.com/permalink.php?story_fbid=123&id=456', 'Permalink format'],

      // Photo URLs
      ['https://www.facebook.com/photo.php?fbid=123456789', 'Photo with fbid'],
      ['https://www.facebook.com/photo?fbid=123456789&set=a.456', 'Photo with set'],
      ['https://m.facebook.com/photo.php?fbid=123&set=pb.456', 'Mobile photo'],

      // Video/Watch URLs
      ['https://www.facebook.com/watch/?v=123456789', 'Watch video'],
      ['https://www.facebook.com/username/videos/123456789', 'User video'],
      ['https://fb.watch/abc123def', 'FB watch shortlink'],

      // Share URLs
      ['https://www.facebook.com/share/abc123def', 'Share link'],
      ['https://www.facebook.com/share.php?u=https://example.com', 'Share with URL'],

      // Story URLs
      ['https://www.facebook.com/stories/123456789', 'Story URL'],

      // Group posts
      ['https://www.facebook.com/groups/groupname/posts/123456', 'Group post'],
      ['https://www.facebook.com/groups/123/permalink/456', 'Group permalink'],
    ];

    testCases.forEach(([url, description]) => {
      it(`should detect Facebook from ${description}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBe('facebook');
      });
    });

    it('should extract Facebook post IDs', () => {
      expect(detector.extractPostId('https://facebook.com/user/posts/123456')).toBe('123456');
      expect(detector.extractPostId('https://facebook.com/photo.php?fbid=789')).toBe('789');
      expect(detector.extractPostId('https://facebook.com/watch/?v=456')).toBe('456');
    });
  });

  describe('LinkedIn URLs', () => {
    const testCases: Array<[string, string]> = [
      // Activity/Post URLs
      ['https://www.linkedin.com/posts/johndoe_activity-123456789', 'Standard post'],
      ['https://linkedin.com/posts/jane-doe_update-987654321', 'Post with update'],

      // Feed update URLs
      ['https://www.linkedin.com/feed/update/urn:li:activity:1234567890', 'Activity URN'],
      ['https://www.linkedin.com/feed/update/urn:li:share:9876543210', 'Share URN'],

      // Pulse/Article URLs
      ['https://www.linkedin.com/pulse/article-title-author-name', 'Pulse article'],

      // Video URLs
      ['https://www.linkedin.com/video/event/urn:li:ugcPost:123', 'Video event'],
      ['https://www.linkedin.com/events/123456789', 'Event URL'],

      // Company posts
      ['https://www.linkedin.com/company/company-name/posts', 'Company posts'],

      // Newsletter
      ['https://www.linkedin.com/newsletters/newsletter-name-123', 'Newsletter'],
    ];

    testCases.forEach(([url, description]) => {
      it(`should detect LinkedIn from ${description}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBe('linkedin');
      });
    });

    it('should extract LinkedIn post IDs', () => {
      expect(detector.extractPostId('https://linkedin.com/posts/user_activity-abc123')).toBe('activity-abc123');
      expect(detector.extractPostId('https://linkedin.com/feed/update/urn:li:activity:456')).toBe('456');
    });
  });

  describe('Instagram URLs', () => {
    const testCases: Array<[string, string]> = [
      // Standard post URLs
      ['https://www.instagram.com/p/ABC123xyz/', 'Standard post'],
      ['https://instagram.com/p/XYZ789abc', 'Post without www'],
      ['https://www.instagram.com/p/aB1-_cD2/', 'Post with special chars'],

      // Reel URLs
      ['https://www.instagram.com/reel/ABC123xyz/', 'Single reel'],
      ['https://www.instagram.com/reels/XYZ789abc/', 'Reels plural'],

      // TV/IGTV URLs
      ['https://www.instagram.com/tv/ABC123xyz/', 'IGTV post'],

      // Story URLs
      ['https://www.instagram.com/stories/username/123456789/', 'User story'],

      // Shortened URLs
      ['https://instagr.am/p/ABC123/', 'Shortened URL'],
    ];

    testCases.forEach(([url, description]) => {
      it(`should detect Instagram from ${description}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBe('instagram');
      });
    });

    it('should extract Instagram post IDs', () => {
      expect(detector.extractPostId('https://instagram.com/p/ABC123xyz')).toBe('ABC123xyz');
      expect(detector.extractPostId('https://instagram.com/reel/XYZ789')).toBe('XYZ789');
      expect(detector.extractPostId('https://instagram.com/tv/DEF456')).toBe('DEF456');
    });
  });

  describe('TikTok URLs', () => {
    const testCases: Array<[string, string]> = [
      // Standard video URLs
      ['https://www.tiktok.com/@username/video/1234567890123456789', 'Standard video'],
      ['https://tiktok.com/@user.name/video/9876543210987654321', 'Username with dot'],

      // Video without username
      ['https://www.tiktok.com/video/1234567890', 'Video without user'],

      // Shortened URLs
      ['https://vm.tiktok.com/ABC123/', 'VM shortened'],
      ['https://vt.tiktok.com/XYZ789/', 'VT shortened'],

      // Live URLs
      ['https://www.tiktok.com/@username/live', 'Live stream'],

      // Photo mode
      ['https://www.tiktok.com/@username/photo/123456', 'Photo post'],
    ];

    testCases.forEach(([url, description]) => {
      it(`should detect TikTok from ${description}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBe('tiktok');
      });
    });

    it('should extract TikTok post IDs', () => {
      expect(detector.extractPostId('https://tiktok.com/@user/video/123456789')).toBe('123456789');
      expect(detector.extractPostId('https://tiktok.com/video/987654321')).toBe('987654321');
    });
  });

  describe('X (Twitter) URLs', () => {
    const testCases: Array<[string, string]> = [
      // X.com URLs
      ['https://x.com/username/status/1234567890', 'X.com status'],
      ['https://www.x.com/user/status/9876543210', 'X.com with www'],

      // Twitter.com URLs (legacy)
      ['https://twitter.com/username/status/1234567890', 'Twitter.com status'],
      ['https://www.twitter.com/user/status/9876543210', 'Twitter with www'],

      // Tweet with media
      ['https://x.com/user/status/123/photo/1', 'Tweet with photo'],
      ['https://x.com/user/status/123/video/1', 'Tweet with video'],

      // Mobile URLs
      ['https://mobile.x.com/user/status/123', 'Mobile X.com'],
      ['https://mobile.twitter.com/user/status/456', 'Mobile Twitter'],

      // Shortened URLs
      ['https://t.co/abc123def', 'T.co shortened'],

      // Moments
      ['https://x.com/i/moments/123456', 'X moments'],
      ['https://twitter.com/i/moments/789', 'Twitter moments'],

      // Spaces
      ['https://x.com/i/spaces/ABC123xyz', 'X spaces'],
      ['https://twitter.com/i/spaces/XYZ789', 'Twitter spaces'],
    ];

    testCases.forEach(([url, description]) => {
      it(`should detect X from ${description}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBe('x');
      });
    });

    it('should extract X post IDs', () => {
      expect(detector.extractPostId('https://x.com/user/status/1234567890')).toBe('1234567890');
      expect(detector.extractPostId('https://twitter.com/user/status/987654')).toBe('987654');
    });
  });

  describe('Threads URLs', () => {
    const testCases: Array<[string, string]> = [
      // Standard post URLs
      ['https://www.threads.net/@username/post/ABC123xyz', 'Standard post'],
      ['https://threads.net/@user.name/post/XYZ789abc', 'Username with dot'],

      // Thread URLs
      ['https://www.threads.net/t/ABC123xyz', 'Thread format'],
      ['https://threads.net/t/XYZ789', 'Thread without www'],

      // Direct post format
      ['https://www.threads.net/ABC123xyz', 'Direct post ID'],
    ];

    testCases.forEach(([url, description]) => {
      it(`should detect Threads from ${description}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBe('threads');
      });
    });

    it('should extract Threads post IDs', () => {
      expect(detector.extractPostId('https://threads.net/@user/post/ABC123')).toBe('ABC123');
      expect(detector.extractPostId('https://threads.net/t/XYZ789')).toBe('XYZ789');
    });
  });

  describe('URL normalization', () => {
    it('should handle URLs without protocol', () => {
      expect(detector.detectPlatform('facebook.com/user/posts/123')).toBe('facebook');
      expect(detector.detectPlatform('instagram.com/p/ABC123')).toBe('instagram');
    });

    it('should handle URLs with www prefix', () => {
      expect(detector.detectPlatform('www.facebook.com/user/posts/123')).toBe('facebook');
      expect(detector.detectPlatform('www.instagram.com/p/ABC123')).toBe('instagram');
    });

    it('should handle URLs with whitespace', () => {
      expect(detector.detectPlatform(' https://facebook.com/user/posts/123 ')).toBe('facebook');
      expect(detector.detectPlatform('https://instagram.com/p/ABC123 ')).toBe('instagram');
    });

    it('should handle http protocol', () => {
      expect(detector.detectPlatform('http://facebook.com/user/posts/123')).toBe('facebook');
    });
  });

  describe('Confidence scoring', () => {
    it('should return high confidence for exact pattern match', () => {
      const result = detector.detectWithConfidence('https://facebook.com/user/posts/123');
      expect(result).not.toBeNull();
      expect(result?.platform).toBe('facebook');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should return lower confidence for domain-only match', () => {
      const result = detector.detectWithConfidence('https://facebook.com/unknown-path');
      expect(result).not.toBeNull();
      expect(result?.platform).toBe('facebook');
      expect(result?.confidence).toBeLessThan(0.9);
    });

    it('should return null for unsupported URLs', () => {
      const result = detector.detectWithConfidence('https://example.com/post/123');
      expect(result).toBeNull();
    });
  });

  describe('Unsupported platforms', () => {
    const unsupportedUrls = [
      'https://example.com/post/123',
      'https://reddit.com/r/subreddit/comments/123',
      'https://youtube.com/watch?v=abc123',
      'https://github.com/user/repo',
      'not-a-url',
      '',
    ];

    unsupportedUrls.forEach(url => {
      it(`should return null for unsupported URL: ${url}`, () => {
        const platform = detector.detectPlatform(url);
        expect(platform).toBeNull();
      });
    });
  });

  describe('Utility methods', () => {
    it('should check if URL is supported', () => {
      expect(detector.isSupported('https://facebook.com/user/posts/123')).toBe(true);
      expect(detector.isSupported('https://example.com/post/123')).toBe(false);
    });

    it('should return all supported platforms', () => {
      const platforms = detector.getSupportedPlatforms();
      expect(platforms).toHaveLength(6);
      expect(platforms).toContain('facebook');
      expect(platforms).toContain('linkedin');
      expect(platforms).toContain('instagram');
      expect(platforms).toContain('tiktok');
      expect(platforms).toContain('x');
      expect(platforms).toContain('threads');
    });

    it('should return platform-specific domains', () => {
      const facebookDomains = detector.getPlatformDomains('facebook');
      expect(facebookDomains).toContain('facebook.com');
      expect(facebookDomains).toContain('m.facebook.com');

      const instagramDomains = detector.getPlatformDomains('instagram');
      expect(instagramDomains).toContain('instagram.com');
    });

    it('should detect platform from domain', () => {
      expect(detector.detectPlatformFromDomain('facebook.com')).toBe('facebook');
      expect(detector.detectPlatformFromDomain('m.facebook.com')).toBe('facebook');
      expect(detector.detectPlatformFromDomain('instagram.com')).toBe('instagram');
      expect(detector.detectPlatformFromDomain('example.com')).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed URLs', () => {
      expect(detector.detectPlatform('not-a-valid-url')).toBeNull();
      expect(detector.detectPlatform('htp://facebook.com')).toBeNull();
    });

    it('should handle empty strings', () => {
      expect(detector.detectPlatform('')).toBeNull();
    });

    it('should handle URLs with fragments', () => {
      expect(detector.detectPlatform('https://facebook.com/user/posts/123#comment')).toBe('facebook');
    });

    it('should handle URLs with query parameters', () => {
      expect(detector.detectPlatform('https://facebook.com/user/posts/123?ref=share')).toBe('facebook');
    });

    it('should handle case-insensitive domains', () => {
      expect(detector.detectPlatform('https://FACEBOOK.COM/user/posts/123')).toBe('facebook');
      expect(detector.detectPlatform('https://Facebook.Com/user/posts/123')).toBe('facebook');
    });
  });

  describe('Mobile URLs', () => {
    it('should detect mobile Facebook URLs', () => {
      expect(detector.detectPlatform('https://m.facebook.com/story.php?story_fbid=123')).toBe('facebook');
      expect(detector.detectPlatform('https://m.facebook.com/photo.php?fbid=456')).toBe('facebook');
    });

    it('should detect mobile X URLs', () => {
      expect(detector.detectPlatform('https://mobile.x.com/user/status/123')).toBe('x');
      expect(detector.detectPlatform('https://mobile.twitter.com/user/status/456')).toBe('x');
    });
  });

  describe('International domains', () => {
    it('should handle subdomains correctly', () => {
      expect(detector.detectPlatform('https://de-de.facebook.com/user/posts/123')).toBe('facebook');
      expect(detector.detectPlatform('https://uk.linkedin.com/posts/user_activity-123')).toBe('linkedin');
    });
  });

  describe('Post ID extraction edge cases', () => {
    it('should return null for invalid URLs', () => {
      expect(detector.extractPostId('not-a-url')).toBeNull();
      expect(detector.extractPostId('https://example.com')).toBeNull();
    });

    it('should return null for URLs without post IDs', () => {
      expect(detector.extractPostId('https://facebook.com/username')).toBeNull();
      expect(detector.extractPostId('https://instagram.com/')).toBeNull();
    });
  });

  describe('URL Canonicalization', () => {
    describe('Facebook canonicalization', () => {
      it('should remove tracking parameters', () => {
        const url = 'https://www.facebook.com/user/posts/123?utm_source=twitter&fbclid=abc123&__cft__=xyz';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://facebook.com/user/posts/123');
      });

      it('should convert mobile URLs to desktop', () => {
        const url = 'https://m.facebook.com/story.php?story_fbid=123&id=456';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toContain('facebook.com');
        expect(canonical).not.toContain('m.facebook.com');
      });

      it('should preserve essential parameters', () => {
        const url = 'https://www.facebook.com/photo.php?fbid=789&set=a.123&ref=share';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toContain('fbid=789');
        expect(canonical).not.toContain('ref=share');
      });

      it('should convert fb.com to facebook.com', () => {
        const url = 'https://fb.com/user/posts/123';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toContain('facebook.com');
        expect(canonical).not.toContain('fb.com');
      });
    });

    describe('LinkedIn canonicalization', () => {
      it('should remove tracking parameters', () => {
        const url = 'https://www.linkedin.com/posts/user_activity-abc123?trk=public_post&utm_source=share';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).not.toContain('trk=');
        expect(canonical).not.toContain('utm_source=');
      });

      it('should remove LinkedIn-specific tracking', () => {
        const url = 'https://linkedin.com/feed/update/urn:li:activity:123?lipi=xyz&trackingId=abc';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).not.toContain('lipi=');
        expect(canonical).not.toContain('trackingId=');
      });
    });

    describe('Instagram canonicalization', () => {
      it('should remove all query parameters', () => {
        const url = 'https://www.instagram.com/p/ABC123/?utm_source=ig_web_copy_link&igshid=xyz';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://instagram.com/p/ABC123');
      });

      it('should convert instagr.am to instagram.com', () => {
        const url = 'https://instagr.am/p/ABC123/';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://instagram.com/p/ABC123');
      });

      it('should remove trailing slash', () => {
        const url = 'https://www.instagram.com/reel/XYZ789/';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://instagram.com/reel/XYZ789');
      });
    });

    describe('TikTok canonicalization', () => {
      it('should remove tracking parameters', () => {
        const url = 'https://www.tiktok.com/@user/video/123?is_copy_url=1&is_from_webapp=v1&utm_source=share';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).not.toContain('is_copy_url=');
        expect(canonical).not.toContain('is_from_webapp=');
        expect(canonical).not.toContain('utm_source=');
      });

      it('should preserve shortened URLs', () => {
        const url = 'https://vm.tiktok.com/ABC123/';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toContain('vm.tiktok.com/ABC123');
      });
    });

    describe('X (Twitter) canonicalization', () => {
      it('should convert twitter.com to x.com', () => {
        const url = 'https://twitter.com/user/status/123456789';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toContain('x.com');
        expect(canonical).not.toContain('twitter.com');
      });

      it('should convert mobile URLs to desktop', () => {
        const url = 'https://mobile.twitter.com/user/status/123';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://x.com/user/status/123');
      });

      it('should remove photo/video suffixes', () => {
        const url = 'https://x.com/user/status/123/photo/1';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://x.com/user/status/123');
      });

      it('should remove X-specific tracking parameters', () => {
        const url = 'https://x.com/user/status/123?s=20&t=abc&utm_source=twitter';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://x.com/user/status/123');
      });

      it('should preserve t.co shortened URLs', () => {
        const url = 'https://t.co/abc123def';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toContain('t.co/abc123def');
      });
    });

    describe('Threads canonicalization', () => {
      it('should remove all query parameters', () => {
        const url = 'https://www.threads.net/@user/post/ABC123?utm_source=share';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://threads.net/@user/post/ABC123');
      });

      it('should remove trailing slash', () => {
        const url = 'https://threads.net/t/XYZ789/';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).toBe('https://threads.net/t/XYZ789');
      });
    });

    describe('General canonicalization', () => {
      it('should remove www prefix', () => {
        const urls = [
          'https://www.facebook.com/user/posts/123',
          'https://www.instagram.com/p/ABC123',
          'https://www.linkedin.com/posts/user_activity-abc',
        ];

        urls.forEach(url => {
          const canonical = detector.canonicalizeUrl(url);
          expect(canonical).not.toContain('www.');
        });
      });

      it('should remove hash fragments', () => {
        const url = 'https://facebook.com/user/posts/123#comment-456';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).not.toContain('#');
      });

      it('should remove common UTM parameters', () => {
        const url = 'https://facebook.com/user/posts/123?utm_source=social&utm_medium=twitter&utm_campaign=spring';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).not.toContain('utm_');
      });

      it('should handle URLs without platform detection', () => {
        const url = 'https://example.com/page?utm_source=test&ref=abc';
        const canonical = detector.canonicalizeUrl(url);
        expect(canonical).not.toContain('utm_source');
        expect(canonical).not.toContain('ref');
      });

      it('should be idempotent', () => {
        const url = 'https://www.facebook.com/user/posts/123?utm_source=test';
        const canonical1 = detector.canonicalizeUrl(url);
        const canonical2 = detector.canonicalizeUrl(canonical1);
        expect(canonical1).toBe(canonical2);
      });

      it('should produce same result for equivalent URLs', () => {
        const urls = [
          'https://www.facebook.com/user/posts/123?utm_source=twitter',
          'https://facebook.com/user/posts/123?fbclid=abc',
          'https://m.facebook.com/user/posts/123?ref=share',
          'https://www.facebook.com/user/posts/123/',
        ];

        const canonicals = urls.map(url => detector.canonicalizeUrl(url));
        const unique = new Set(canonicals);
        expect(unique.size).toBe(1);
      });
    });

    describe('Error handling', () => {
      it('should return original URL for invalid URLs', () => {
        const invalidUrl = 'not-a-valid-url';
        const canonical = detector.canonicalizeUrl(invalidUrl);
        // URL parser may add protocol, accept either original or normalized form
        expect(canonical).toMatch(/not-a-valid-url/);
      });

      it('should handle malformed URLs gracefully', () => {
        const malformed = 'http://[invalid';
        const canonical = detector.canonicalizeUrl(malformed);
        expect(canonical).toBe(malformed);
      });
    });
  });
});
