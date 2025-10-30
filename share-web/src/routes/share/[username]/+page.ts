import type { PageLoad } from './$types';
import { getUserPosts, ApiError } from '$lib/api/client';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { username } = params;

	try {
		const response = await getUserPosts(username);

		if (!response.success) {
			throw error(404, response.error?.message || 'User not found');
		}

		return {
			username: response.data.username,
			posts: response.data.posts,
			total: response.data.total
		};
	} catch (err) {
		if (err instanceof ApiError) {
			// Handle specific API errors
			if (err.statusCode === 404) {
				throw error(404, `User "${username}" not found`);
			}
			if (err.statusCode === 429) {
				throw error(429, 'Too many requests. Please try again later.');
			}
			throw error(err.statusCode || 500, err.message);
		}

		// Handle unexpected errors
		console.error('Failed to load user posts:', err);
		throw error(500, 'Failed to load posts. Please try again later.');
	}
};
