import { describe, it, expect } from '@jest/globals';
import {
	FacebookURLSchema,
	LinkedInURLSchema,
	InstagramURLSchema,
	TikTokURLSchema,
	XURLSchema,
	ThreadsURLSchema,
	AnySocialMediaURLSchema,
	getPlatformSchema,
	validateAndDetectPlatform,
	validatePlatformUrl,
	isSupportedPlatformUrl,
} from '@/schemas/platforms';

describe('Platform URL Schemas', () => {
	describe('FacebookURLSchema', () => {
		describe('Valid URLs', () => {
			const validUrls = [
				// Standard post URLs
				'https://facebook.com/johndoe/posts/123456789',
				'https://www.facebook.com/johndoe/posts/123456789',
				'http://facebook.com/johndoe/posts/123456789',
				'https://m.facebook.com/johndoe/posts/123456789',

				// Permalink URLs
				'https://facebook.com/permalink.php?story_fbid=123456789',
				'https://www.facebook.com/permalink.php?story_fbid=987654321',

				// Photo URLs
				'https://facebook.com/photo.php?fbid=123456789',
				'https://facebook.com/photo?fbid=123456789',

				// Watch/Video URLs
				'https://facebook.com/watch/?v=123456789',
				'https://facebook.com/johndoe/videos/123456789',
				'https://fb.watch/abc123',

				// Share URLs
				'https://facebook.com/share/abc123xyz',
				'https://facebook.com/share.php?id=123',

				// Story URLs
				'https://facebook.com/stories/123456789',

				// Group posts
				'https://facebook.com/groups/mygroup/posts/123456789',
				'https://facebook.com/groups/mygroup/permalink/123456789',

				// Mobile URLs
				'https://m.facebook.com/story.php?story_fbid=123456789',
				'https://m.facebook.com/photo.php?fbid=123456789',
			];

			validUrls.forEach((url) => {
				it(`should validate: ${url}`, () => {
					const result = FacebookURLSchema.safeParse(url);
					expect(result.success).toBe(true);
				});
			});
		});

		describe('Invalid URLs', () => {
			const invalidUrls = [
				'https://instagram.com/p/ABC123',
				'https://twitter.com/user/status/123',
				'https://facebook.com',
				'https://facebook.com/johndoe',
				'not a url',
				'',
				'https://fakebook.com/posts/123',
			];

			invalidUrls.forEach((url) => {
				it(`should reject: ${url}`, () => {
					const result = FacebookURLSchema.safeParse(url);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	describe('LinkedInURLSchema', () => {
		describe('Valid URLs', () => {
			const validUrls = [
				// Post URLs
				'https://linkedin.com/posts/johndoe_activity-1234567890',
				'https://www.linkedin.com/posts/johndoe_abcdefg-1234567890',

				// Activity update URLs
				'https://linkedin.com/feed/update/urn:li:activity:1234567890',
				'https://linkedin.com/feed/update/urn:li:share:9876543210',

				// Pulse articles
				'https://linkedin.com/pulse/my-article-slug',
				'https://www.linkedin.com/pulse/another-article',

				// Video URLs
				'https://linkedin.com/video/event/abc123',

				// Events
				'https://linkedin.com/events/event-id-123',

				// Company posts
				'https://linkedin.com/company/mycompany/posts',

				// Newsletters
				'https://linkedin.com/newsletters/newsletter-slug',

				// Shortened URLs
				'https://lnkd.in/abc123',
			];

			validUrls.forEach((url) => {
				it(`should validate: ${url}`, () => {
					const result = LinkedInURLSchema.safeParse(url);
					expect(result.success).toBe(true);
				});
			});
		});

		describe('Invalid URLs', () => {
			const invalidUrls = [
				'https://facebook.com/posts/123',
				'https://linkedin.com',
				'https://linkedin.com/in/johndoe',
				'not a url',
				'',
			];

			invalidUrls.forEach((url) => {
				it(`should reject: ${url}`, () => {
					const result = LinkedInURLSchema.safeParse(url);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	describe('InstagramURLSchema', () => {
		describe('Valid URLs', () => {
			const validUrls = [
				// Post URLs
				'https://instagram.com/p/ABC123xyz',
				'https://www.instagram.com/p/XYZ789abc',

				// Reel URLs
				'https://instagram.com/reel/ABC123',
				'https://instagram.com/reels/XYZ789',

				// TV/IGTV URLs
				'https://instagram.com/tv/ABC123',

				// Story URLs
				'https://instagram.com/stories/johndoe/123456789',

				// Shortened URLs
				'https://instagr.am/p/ABC123',
			];

			validUrls.forEach((url) => {
				it(`should validate: ${url}`, () => {
					const result = InstagramURLSchema.safeParse(url);
					expect(result.success).toBe(true);
				});
			});
		});

		describe('Invalid URLs', () => {
			const invalidUrls = [
				'https://facebook.com/posts/123',
				'https://instagram.com',
				'https://instagram.com/johndoe',
				'not a url',
				'',
			];

			invalidUrls.forEach((url) => {
				it(`should reject: ${url}`, () => {
					const result = InstagramURLSchema.safeParse(url);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	describe('TikTokURLSchema', () => {
		describe('Valid URLs', () => {
			const validUrls = [
				// Standard video URLs
				'https://tiktok.com/@username/video/1234567890',
				'https://www.tiktok.com/@johndoe/video/9876543210',

				// Video without username
				'https://tiktok.com/video/1234567890',

				// Shortened URLs
				'https://vm.tiktok.com/abc123',
				'https://vt.tiktok.com/xyz789',

				// Live URLs
				'https://tiktok.com/@username/live',

				// Photo posts
				'https://tiktok.com/@username/photo/1234567890',
			];

			validUrls.forEach((url) => {
				it(`should validate: ${url}`, () => {
					const result = TikTokURLSchema.safeParse(url);
					expect(result.success).toBe(true);
				});
			});
		});

		describe('Invalid URLs', () => {
			const invalidUrls = [
				'https://facebook.com/posts/123',
				'https://tiktok.com',
				'https://tiktok.com/@username',
				'not a url',
				'',
			];

			invalidUrls.forEach((url) => {
				it(`should reject: ${url}`, () => {
					const result = TikTokURLSchema.safeParse(url);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	describe('XURLSchema', () => {
		describe('Valid URLs', () => {
			const validUrls = [
				// X.com URLs
				'https://x.com/username/status/1234567890',
				'https://www.x.com/johndoe/status/9876543210',

				// Twitter.com URLs
				'https://twitter.com/username/status/1234567890',
				'https://www.twitter.com/johndoe/status/9876543210',

				// Tweet with photo
				'https://x.com/username/status/1234567890/photo/1',
				'https://twitter.com/username/status/1234567890/photo/2',

				// Tweet with video
				'https://x.com/username/status/1234567890/video/1',

				// Mobile URLs
				'https://mobile.x.com/username/status/1234567890',
				'https://mobile.twitter.com/username/status/1234567890',

				// Shortened URLs
				'https://t.co/abc123',

				// Moments
				'https://x.com/i/moments/1234567890',
				'https://twitter.com/i/moments/9876543210',

				// Spaces
				'https://x.com/i/spaces/abc123xyz',
				'https://twitter.com/i/spaces/xyz789abc',
			];

			validUrls.forEach((url) => {
				it(`should validate: ${url}`, () => {
					const result = XURLSchema.safeParse(url);
					expect(result.success).toBe(true);
				});
			});
		});

		describe('Invalid URLs', () => {
			const invalidUrls = [
				'https://facebook.com/posts/123',
				'https://x.com',
				'https://x.com/username',
				'not a url',
				'',
			];

			invalidUrls.forEach((url) => {
				it(`should reject: ${url}`, () => {
					const result = XURLSchema.safeParse(url);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	describe('ThreadsURLSchema', () => {
		describe('Valid URLs', () => {
			const validUrls = [
				// Standard post URLs
				'https://threads.net/@username/post/ABC123xyz',
				'https://www.threads.net/@johndoe/post/XYZ789abc',

				// Thread URLs
				'https://threads.net/t/ABC123',
				'https://www.threads.net/t/XYZ789',

				// Direct post URLs
				'https://threads.net/ABC123xyz',
			];

			validUrls.forEach((url) => {
				it(`should validate: ${url}`, () => {
					const result = ThreadsURLSchema.safeParse(url);
					expect(result.success).toBe(true);
				});
			});
		});

		describe('Invalid URLs', () => {
			const invalidUrls = [
				'https://facebook.com/posts/123',
				'https://threads.net',
				'https://threads.net/@username',
				'not a url',
				'',
			];

			invalidUrls.forEach((url) => {
				it(`should reject: ${url}`, () => {
					const result = ThreadsURLSchema.safeParse(url);
					expect(result.success).toBe(false);
				});
			});
		});
	});

	describe('AnySocialMediaURLSchema', () => {
		it('should validate URLs from all supported platforms', () => {
			const validUrls = [
				'https://facebook.com/user/posts/123',
				'https://linkedin.com/posts/user_activity-123',
				'https://instagram.com/p/ABC123',
				'https://tiktok.com/@user/video/123',
				'https://x.com/user/status/123',
				'https://threads.net/@user/post/ABC123',
			];

			validUrls.forEach((url) => {
				const result = AnySocialMediaURLSchema.safeParse(url);
				expect(result.success).toBe(true);
			});
		});

		it('should reject unsupported platform URLs', () => {
			const invalidUrls = [
				'https://youtube.com/watch?v=123',
				'https://reddit.com/r/test/comments/123',
				'https://pinterest.com/pin/123',
				'not a url',
				'',
			];

			invalidUrls.forEach((url) => {
				const result = AnySocialMediaURLSchema.safeParse(url);
				expect(result.success).toBe(false);
			});
		});
	});

	describe('getPlatformSchema', () => {
		it('should return correct schema for each platform', () => {
			expect(getPlatformSchema('facebook')).toBe(FacebookURLSchema);
			expect(getPlatformSchema('linkedin')).toBe(LinkedInURLSchema);
			expect(getPlatformSchema('instagram')).toBe(InstagramURLSchema);
			expect(getPlatformSchema('tiktok')).toBe(TikTokURLSchema);
			expect(getPlatformSchema('x')).toBe(XURLSchema);
			expect(getPlatformSchema('threads')).toBe(ThreadsURLSchema);
		});
	});

	describe('validateAndDetectPlatform', () => {
		it('should detect and validate Facebook URLs', () => {
			const result = validateAndDetectPlatform('https://facebook.com/user/posts/123');
			expect(result.valid).toBe(true);
			expect(result.platform).toBe('facebook');
			expect(result.errors).toEqual([]);
		});

		it('should detect and validate LinkedIn URLs', () => {
			const result = validateAndDetectPlatform('https://linkedin.com/posts/user_activity-123');
			expect(result.valid).toBe(true);
			expect(result.platform).toBe('linkedin');
			expect(result.errors).toEqual([]);
		});

		it('should detect and validate Instagram URLs', () => {
			const result = validateAndDetectPlatform('https://instagram.com/p/ABC123');
			expect(result.valid).toBe(true);
			expect(result.platform).toBe('instagram');
			expect(result.errors).toEqual([]);
		});

		it('should detect and validate TikTok URLs', () => {
			const result = validateAndDetectPlatform('https://tiktok.com/@user/video/123');
			expect(result.valid).toBe(true);
			expect(result.platform).toBe('tiktok');
			expect(result.errors).toEqual([]);
		});

		it('should detect and validate X URLs', () => {
			const result = validateAndDetectPlatform('https://x.com/user/status/123');
			expect(result.valid).toBe(true);
			expect(result.platform).toBe('x');
			expect(result.errors).toEqual([]);
		});

		it('should detect and validate Threads URLs', () => {
			const result = validateAndDetectPlatform('https://threads.net/@user/post/ABC123');
			expect(result.valid).toBe(true);
			expect(result.platform).toBe('threads');
			expect(result.errors).toEqual([]);
		});

		it('should return invalid for unsupported URLs', () => {
			const result = validateAndDetectPlatform('https://youtube.com/watch?v=123');
			expect(result.valid).toBe(false);
			expect(result.platform).toBe(null);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe('validatePlatformUrl', () => {
		it('should validate URL for specific platform', () => {
			const result = validatePlatformUrl('https://facebook.com/user/posts/123', 'facebook');
			expect(result.success).toBe(true);
		});

		it('should reject URL from wrong platform', () => {
			const result = validatePlatformUrl('https://instagram.com/p/ABC123', 'facebook');
			expect(result.success).toBe(false);
		});

		it('should reject invalid URLs', () => {
			const result = validatePlatformUrl('not a url', 'facebook');
			expect(result.success).toBe(false);
		});
	});

	describe('isSupportedPlatformUrl', () => {
		it('should return true for supported platform URLs', () => {
			expect(isSupportedPlatformUrl('https://facebook.com/user/posts/123')).toBe(true);
			expect(isSupportedPlatformUrl('https://instagram.com/p/ABC123')).toBe(true);
			expect(isSupportedPlatformUrl('https://x.com/user/status/123')).toBe(true);
		});

		it('should return false for unsupported URLs', () => {
			expect(isSupportedPlatformUrl('https://youtube.com/watch?v=123')).toBe(false);
			expect(isSupportedPlatformUrl('not a url')).toBe(false);
			expect(isSupportedPlatformUrl('')).toBe(false);
		});
	});

	describe('Custom error messages', () => {
		it('should provide custom error messages for empty URLs', () => {
			const result = FacebookURLSchema.safeParse('');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.errors[0].message).toContain('cannot be empty');
			}
		});

		it('should provide custom error messages for invalid URL format', () => {
			const result = FacebookURLSchema.safeParse('not a url');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.errors[0].message).toContain('Invalid URL format');
			}
		});

		it('should provide custom error messages for wrong domain', () => {
			const result = FacebookURLSchema.safeParse('https://instagram.com/p/ABC123');
			expect(result.success).toBe(false);
			if (!result.success) {
				const errorMessage = result.error.errors[0].message;
				expect(errorMessage).toContain('Facebook');
			}
		});
	});

	describe('Edge cases', () => {
		it('should handle URLs with tracking parameters', () => {
			const url = 'https://facebook.com/user/posts/123?utm_source=test&fbclid=abc';
			const result = FacebookURLSchema.safeParse(url);
			expect(result.success).toBe(true);
		});

		it('should handle URLs with hash fragments', () => {
			const url = 'https://facebook.com/user/posts/123#comment';
			const result = FacebookURLSchema.safeParse(url);
			expect(result.success).toBe(true);
		});

		it('should handle URLs with www prefix', () => {
			const url = 'https://www.facebook.com/user/posts/123';
			const result = FacebookURLSchema.safeParse(url);
			expect(result.success).toBe(true);
		});

		it('should handle URLs without protocol', () => {
			const url = 'facebook.com/user/posts/123';
			const result = FacebookURLSchema.safeParse(url);
			// This should fail because Zod's url() validator requires protocol
			expect(result.success).toBe(false);
		});

		it('should handle URLs with trailing slashes', () => {
			const url = 'https://facebook.com/user/posts/123/';
			const result = FacebookURLSchema.safeParse(url);
			expect(result.success).toBe(true);
		});

		it('should trim whitespace from URLs', () => {
			const url = '  https://facebook.com/user/posts/123  ';
			const result = FacebookURLSchema.safeParse(url);
			expect(result.success).toBe(true);
		});
	});
});
