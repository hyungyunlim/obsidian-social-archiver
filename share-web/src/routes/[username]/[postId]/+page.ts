import type { PageLoad } from './$types';
import { getPost, ApiError } from '$lib/api/client';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { username, postId } = params;

	try {
		const response = await getPost(postId);

		if (!response.success) {
			throw error(404, response.error?.message || 'Post not found');
		}

		// Skip username verification for now
		// TODO: Add username field to Post type and verify once API returns it

		return {
			username,
			postId,
			post: response.data
		};
	} catch (err) {
		if (err instanceof ApiError) {
			// Handle specific API errors
			if (err.statusCode === 404) {
				throw error(404, 'Post not found or has expired');
			}
			if (err.statusCode === 410) {
				throw error(410, 'This post has expired and is no longer available');
			}
			if (err.statusCode === 429) {
				throw error(429, 'Too many requests. Please try again later.');
			}
			throw error(err.statusCode || 500, err.message);
		}

		// Handle unexpected errors
		console.error('Failed to load post:', err);
		throw error(500, 'Failed to load post. Please try again later.');
	}
};
