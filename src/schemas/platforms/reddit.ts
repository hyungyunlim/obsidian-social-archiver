import { z } from 'zod';

/**
 * Reddit post ID validation (base36 alphanumeric, 6-7 characters)
 * Examples: "1oc24k8", "1cmqs1d"
 */
export const RedditPostIdSchema = z
	.string()
	.regex(/^[a-z0-9]{6,7}$/i, { message: 'Invalid Reddit post ID format' })
	.describe('Reddit post ID (base36 alphanumeric)');

/**
 * Reddit post URL validation
 * Supports:
 * - https://www.reddit.com/r/subreddit/comments/postid/title/
 * - https://reddit.com/r/subreddit/comments/postid/title/
 * - https://old.reddit.com/r/subreddit/comments/postid/title/
 * - https://new.reddit.com/r/subreddit/comments/postid/title/
 * - https://redd.it/postid
 */
export const RedditURLSchema = z
	.string()
	.trim()
	.min(1, { message: 'URL cannot be empty' })
	.url({ message: 'Invalid URL format' })
	.refine(
		(url) => {
			const urlObj = new URL(url);
			const hostname = urlObj.hostname.toLowerCase();

			// Check if it's a Reddit domain
			const isRedditDomain = [
				'reddit.com',
				'www.reddit.com',
				'old.reddit.com',
				'new.reddit.com',
				'redd.it',
			].includes(hostname);

			if (!isRedditDomain) {
				return false;
			}

			// redd.it short URLs: /postid
			if (hostname === 'redd.it') {
				return /^\/[a-z0-9]{6,7}\/?$/i.test(urlObj.pathname);
			}

			// Full Reddit URLs: /r/subreddit/comments/postid/...
			return /^\/r\/[^/]+\/comments\/[a-z0-9]{6,7}\//i.test(urlObj.pathname);
		},
		{ message: 'Invalid Reddit post URL format' }
	)
	.describe('Reddit post URL');

/**
 * Type inference for Reddit URL
 */
export type RedditURL = z.infer<typeof RedditURLSchema>;

/**
 * Type inference for Reddit post ID
 */
export type RedditPostId = z.infer<typeof RedditPostIdSchema>;
