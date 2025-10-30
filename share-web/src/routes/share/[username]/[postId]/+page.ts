import type { PageLoad } from './$types';
import type { Post } from '$lib/types';

export const load: PageLoad = async ({ params }) => {
	const { username, postId } = params;

	// TODO: Implement API call to fetch individual post
	// const response = await fetch(`${API_URL}/api/share/${postId}`);
	// if (!response.ok) {
	//   throw error(404, 'Post not found');
	// }
	// const data = await response.json();

	// Placeholder data for now
	return {
		username,
		postId,
		post: null as Post | null
	};
};
