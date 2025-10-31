/**
 * Shared types for Social Archiver Share Web
 *
 * These types are compatible with Workers API responses
 * and plugin PostData structure
 */

export type Platform = 'facebook' | 'linkedin' | 'instagram' | 'tiktok' | 'x' | 'threads' | 'youtube' | 'reddit';

/**
 * Post author information
 */
export interface Author {
	name: string;
	url: string;
	avatar?: string;
	handle?: string;
	username?: string;
	verified?: boolean;
	bio?: string;
	followers?: number;
}

/**
 * Media item (image, video, etc.)
 */
export interface Media {
	type: 'image' | 'video' | 'audio' | 'document';
	url: string;
	thumbnail?: string;
	width?: number;
	height?: number;
	duration?: number;
	altText?: string;
	size?: number;
	mimeType?: string;
}

/**
 * Post metadata (likes, views, etc.)
 */
export interface PostMetadata {
	likes?: number;
	comments?: number;
	shares?: number;
	views?: number;
	bookmarks?: number;
	timestamp: string; // ISO 8601
	editedAt?: string;
	duration?: number;
}

/**
 * Post content structure
 */
export interface PostContent {
	text: string;
	html?: string;
	hashtags?: string[];
}

/**
 * Comment structure
 */
export interface Comment {
	id: string;
	author: Author;
	content: string;
	timestamp?: string;
	likes?: number;
	replies?: Comment[];
}

/**
 * Post data (compatible with Workers API)
 */
export interface Post {
	// Share-specific fields
	shareId: string;
	shareUrl?: string;
	expiresAt?: string;

	// Post data fields (from Workers API)
	platform: Platform;
	id: string;
	url: string;
	videoId?: string; // YouTube
	author: Author;
	content: PostContent;
	media: Media[];
	metadata: PostMetadata;
	comments?: Comment[]; // Post comments
	linkPreviews?: Array<{ url: string }>; // Extracted URLs for link preview generation
	linkPreviewsMetadata?: LinkPreview[]; // Fetched metadata for link previews

	// User's personal data
	comment?: string; // User's personal comment/note
	like?: boolean; // User's personal like status
	archive?: boolean; // Archive status

	// Archive timestamps
	archivedDate?: Date; // When user archived this post
	publishedDate?: Date; // When post was originally published

	// Legacy/compatibility fields
	title?: string; // Derived from content or author
	previewText?: string; // First N characters of content
	thumbnail?: string; // First media thumbnail
	createdAt?: string; // Share creation timestamp
}

/**
 * API Response: Get user's shared posts
 */
export interface UserPostsResponse {
	success: boolean;
	data: {
		username: string;
		posts: Post[];
		total?: number;
		nextCursor?: string;
	};
	error?: {
		code: string;
		message: string;
	};
}

/**
 * API Response: Get individual post
 */
export interface PostResponse {
	success: boolean;
	data: Post;
	error?: {
		code: string;
		message: string;
	};
}

/**
 * Link preview metadata
 */
export interface LinkPreview {
	url: string;
	title: string;
	description?: string;
	image?: string;
	siteName?: string;
	favicon?: string;
}

/**
 * API Error response structure
 */
export interface ApiErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
		details?: Record<string, any>;
	};
}
