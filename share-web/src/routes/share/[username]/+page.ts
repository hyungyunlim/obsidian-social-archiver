import type { PageLoad } from './$types';
import type { Post } from '$lib/types';

export const load: PageLoad = async ({ params }) => {
	const { username } = params;

	// TODO: Implement API call to fetch user's posts
	// const response = await fetch(`${API_URL}/api/users/${username}/posts`);
	// if (!response.ok) {
	//   throw error(404, 'User not found');
	// }
	// const data = await response.json();

	// Placeholder data for now
	return {
		username,
		posts: [] as Post[]
	};
};
