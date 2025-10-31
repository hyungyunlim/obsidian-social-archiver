import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '@/types/bindings';
import { ValidationError, NotFoundError } from '@/utils/errors';
import { Logger } from '@/utils/logger';

export const userPostsRouter = new Hono<Env>();

// Username validation schema
const UsernameSchema = z.string()
	.regex(/^[a-zA-Z0-9-]+$/, 'Username can only contain alphanumeric characters and hyphens')
	.min(1, 'Username is required')
	.max(50, 'Username must be less than 50 characters');

// Query parameters schema
const QueryParamsSchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(50).default(20)
});

interface UserPostsResponse {
	success: true;
	data: {
		username: string;
		posts: any[]; // Full post data including all PostData fields
		pagination: {
			page: number;
			limit: number;
			total: number;
			hasMore: boolean;
		};
	};
}

// GET /api/users/:username/posts - Retrieve user's shared posts
userPostsRouter.get('/:username/posts', async (c) => {
	const logger = Logger.fromContext(c);

	try {
		// Validate username parameter
		const username = UsernameSchema.parse(c.req.param('username'));

		// Parse and validate query parameters
		const queryParams = QueryParamsSchema.parse({
			page: c.req.query('page'),
			limit: c.req.query('limit')
		});

		logger.info(`Fetching posts for user: ${username}`, { username, ...queryParams });

		// Retrieve user's post list from KV
		const userPostsKey = `user_posts:${username.toLowerCase()}`;
		const userPostsData = await c.env.SHARE_LINKS.get(userPostsKey);

		if (!userPostsData) {
			logger.warn(`User not found: ${username}`, { username });
			throw new NotFoundError(`User "${username}" not found or has no shared posts`);
		}

		// Parse share IDs array
		const shareIds: string[] = JSON.parse(userPostsData);

		// Calculate pagination
		const total = shareIds.length;
		const startIndex = (queryParams.page - 1) * queryParams.limit;
		const endIndex = startIndex + queryParams.limit;
		const paginatedShareIds = shareIds.slice(startIndex, endIndex);

		// Fetch full post data for each share ID (in parallel)
		const postDataPromises = paginatedShareIds.map(async (shareId) => {
			try {
				const shareKey = `share:${shareId}`;
				const shareData = await c.env.SHARE_LINKS.get(shareKey);

				if (!shareData) {
					logger.warn(`Share not found: ${shareId}`, { shareId });
					return null;
				}

				const share = JSON.parse(shareData);

				// Return full share data (which contains full PostData if using new format)
				return {
					...share,
					shareId // Ensure shareId is included
				};
			} catch (error) {
				logger.error(`Error fetching share ${shareId}`, { error, shareId });
				return null;
			}
		});

		const postDataResults = await Promise.all(postDataPromises);

		// Filter out null results (failed fetches)
		const posts = postDataResults.filter((post): post is any => post !== null);

		// Sort by creation date (newest first)
		posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

		const response: UserPostsResponse = {
			success: true,
			data: {
				username,
				posts,
				pagination: {
					page: queryParams.page,
					limit: queryParams.limit,
					total,
					hasMore: endIndex < total
				}
			}
		};

		logger.info(`Successfully fetched ${posts.length} posts for ${username}`, {
			username,
			count: posts.length,
			total
		});

		return c.json(response, 200);

	} catch (error) {
		if (error instanceof z.ZodError) {
			logger.warn('Validation error in user posts request', { error: error.errors });
			throw new ValidationError('Invalid request parameters', error.errors);
		}

		logger.error('Error fetching user posts', error);
		throw error;
	}
});
