import { z } from 'zod';
import type { Platform } from '@/types/post';

// Import all platform schemas
import { FacebookURLSchema, FacebookPostIdSchema } from './facebook';
import { LinkedInURLSchema, LinkedInPostIdSchema, LinkedInActivityIdSchema } from './linkedin';
import { InstagramURLSchema, InstagramPostIdSchema } from './instagram';
import { TikTokURLSchema, TikTokVideoIdSchema, TikTokShortCodeSchema } from './tiktok';
import { XURLSchema, XTweetIdSchema, XMomentIdSchema, XSpaceIdSchema } from './x';
import { ThreadsURLSchema, ThreadsPostIdSchema } from './threads';
import { YouTubeURLSchema, YouTubeVideoIdSchema } from './youtube';

/**
 * Re-export all platform-specific schemas
 */
export {
	// Facebook
	FacebookURLSchema,
	FacebookPostIdSchema,
	// LinkedIn
	LinkedInURLSchema,
	LinkedInPostIdSchema,
	LinkedInActivityIdSchema,
	// Instagram
	InstagramURLSchema,
	InstagramPostIdSchema,
	// TikTok
	TikTokURLSchema,
	TikTokVideoIdSchema,
	TikTokShortCodeSchema,
	// X (Twitter)
	XURLSchema,
	XTweetIdSchema,
	XMomentIdSchema,
	XSpaceIdSchema,
	// Threads
	ThreadsURLSchema,
	ThreadsPostIdSchema,
	// YouTube
	YouTubeURLSchema,
	YouTubeVideoIdSchema,
};

/**
 * Platform to schema mapping
 * Used by getPlatformSchema to retrieve the correct schema for a platform
 */
const PLATFORM_SCHEMA_MAP = {
	facebook: FacebookURLSchema,
	linkedin: LinkedInURLSchema,
	instagram: InstagramURLSchema,
	tiktok: TikTokURLSchema,
	x: XURLSchema,
	threads: ThreadsURLSchema,
	youtube: YouTubeURLSchema,
} as const satisfies Record<Platform, z.ZodType>;

/**
 * Get platform-specific URL validation schema
 *
 * @param platform - The platform to get the schema for
 * @returns Zod schema for validating URLs from the specified platform
 *
 * @example
 * ```ts
 * const facebookSchema = getPlatformSchema('facebook');
 * const result = facebookSchema.safeParse('https://facebook.com/user/posts/123');
 * if (result.success) {
 *   console.log('Valid Facebook URL:', result.data);
 * }
 * ```
 */
export function getPlatformSchema(platform: Platform): z.ZodType {
	return PLATFORM_SCHEMA_MAP[platform];
}

/**
 * Composite schema that validates any supported social media URL
 * Tries each platform schema until one succeeds
 *
 * @example
 * ```ts
 * const result = AnySocialMediaURLSchema.safeParse('https://twitter.com/user/status/123');
 * if (result.success) {
 *   console.log('Valid social media URL:', result.data);
 * }
 * ```
 */
export const AnySocialMediaURLSchema = z
	.string()
	.trim()
	.min(1, { message: 'URL cannot be empty' })
	.url({ message: 'Invalid URL format' })
	.refine(
		(url) => {
			// Try to validate against each platform schema
			const schemas = Object.values(PLATFORM_SCHEMA_MAP);
			return schemas.some((schema) => schema.safeParse(url).success);
		},
		{
			message: 'URL must be from a supported social media platform (Facebook, LinkedIn, Instagram, TikTok, X/Twitter, Threads, YouTube)',
		}
	);

/**
 * Platform detection result with validation
 */
export interface PlatformSchemaValidationResult {
	valid: boolean;
	platform: Platform | null;
	url: string;
	errors: string[];
}

/**
 * Validate URL and detect platform in one operation
 * Returns validation result with detected platform
 *
 * @param url - The URL to validate and detect platform for
 * @returns Validation result with platform information
 *
 * @example
 * ```ts
 * const result = validateAndDetectPlatform('https://instagram.com/p/ABC123');
 * if (result.valid) {
 *   console.log('Platform:', result.platform); // 'instagram'
 * } else {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 */
export function validateAndDetectPlatform(url: string): PlatformSchemaValidationResult {
	const errors: string[] = [];

	// Try each platform schema
	const platforms: Platform[] = ['facebook', 'linkedin', 'instagram', 'tiktok', 'x', 'threads', 'youtube'];

	for (const platform of platforms) {
		const schema = getPlatformSchema(platform);
		const result = schema.safeParse(url);

		if (result.success) {
			return {
				valid: true,
				platform,
				url: result.data as string,
				errors: [],
			};
		}

		// Collect errors from each platform attempt
		if (result.error) {
			errors.push(`${platform}: ${result.error.errors.map((e) => e.message).join(', ')}`);
		}
	}

	// No platform matched
	return {
		valid: false,
		platform: null,
		url,
		errors: errors.length > 0 ? errors : ['URL is not from a supported social media platform'],
	};
}

/**
 * Validate URL for a specific platform
 * Returns detailed validation result
 *
 * @param url - The URL to validate
 * @param platform - The platform to validate against
 * @returns Validation result
 *
 * @example
 * ```ts
 * const result = validatePlatformUrl('https://facebook.com/post/123', 'facebook');
 * if (result.success) {
 *   console.log('Valid Facebook URL');
 * } else {
 *   console.error('Validation errors:', result.error.errors);
 * }
 * ```
 */
export function validatePlatformUrl(url: string, platform: Platform): z.SafeParseReturnType<string, string> {
	const schema = getPlatformSchema(platform);
	return schema.safeParse(url);
}

/**
 * Check if URL is from any supported platform (quick check)
 *
 * @param url - The URL to check
 * @returns true if URL is from a supported platform, false otherwise
 *
 * @example
 * ```ts
 * if (isSupportedPlatformUrl('https://twitter.com/user/status/123')) {
 *   console.log('This is a supported platform URL');
 * }
 * ```
 */
export function isSupportedPlatformUrl(url: string): boolean {
	return AnySocialMediaURLSchema.safeParse(url).success;
}

/**
 * Type inference from composite schema
 */
export type SocialMediaURL = z.infer<typeof AnySocialMediaURLSchema>;
