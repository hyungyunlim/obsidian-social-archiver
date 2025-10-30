// Shared types for Social Archiver Share Web

export interface Post {
	shareId: string;
	title: string;
	platform: 'facebook' | 'instagram' | 'x' | 'linkedin' | 'tiktok' | 'threads' | 'reddit';
	author: string;
	createdAt: string;
	content: string;
	previewText?: string;
	thumbnail?: string;
}

export interface UserPostsResponse {
	success: boolean;
	data: {
		username: string;
		posts: Post[];
	};
}

export interface PostResponse {
	success: boolean;
	data: Post;
}
