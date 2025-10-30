/**
 * SEO utilities for generating meta tags
 */

import type { Post } from '$lib/types';
import { extractTextFromMarkdown } from './markdown';

export interface MetaTags {
	title: string;
	description: string;
	canonical?: string;
	openGraph?: {
		title: string;
		description: string;
		url: string;
		type: string;
		image?: string;
		siteName?: string;
	};
	twitter?: {
		card: string;
		title: string;
		description: string;
		image?: string;
		creator?: string;
		site?: string;
	};
}

/**
 * Generate meta tags for a post
 */
export function generatePostMetaTags(
	post: Post,
	username: string,
	baseUrl: string = 'https://share.social-archiver.com'
): MetaTags {
	// Generate title
	const title = post.title ||
		`${post.author.name} on ${post.platform}` ||
		'Social Media Post';

	// Generate description from content
	const description = post.previewText ||
		extractTextFromMarkdown(post.content.text, 160) ||
		`View this ${post.platform} post shared by ${username}`;

	// Get first image
	const image = post.thumbnail ||
		post.media.find(m => m.type === 'image')?.url;

	// Construct URLs
	const postUrl = `${baseUrl}/share/${username}/${post.shareId}`;

	return {
		title: `${title} - Social Archiver`,
		description,
		canonical: postUrl,
		openGraph: {
			title,
			description,
			url: postUrl,
			type: 'article',
			image: image || undefined,
			siteName: 'Social Archiver'
		},
		twitter: {
			card: image ? 'summary_large_image' : 'summary',
			title,
			description,
			image: image || undefined,
			site: '@socialarchiver'
		}
	};
}

/**
 * Generate meta tags for user timeline
 */
export function generateTimelineMetaTags(
	username: string,
	postCount: number,
	baseUrl: string = 'https://share.social-archiver.com'
): MetaTags {
	const title = `@${username}'s Timeline`;
	const description = postCount > 0
		? `View ${postCount} archived posts from @${username} on Social Archiver`
		: `View @${username}'s archived social media posts on Social Archiver`;

	const timelineUrl = `${baseUrl}/share/${username}`;

	return {
		title: `${title} - Social Archiver`,
		description,
		canonical: timelineUrl,
		openGraph: {
			title,
			description,
			url: timelineUrl,
			type: 'profile',
			siteName: 'Social Archiver'
		},
		twitter: {
			card: 'summary',
			title,
			description,
			site: '@socialarchiver'
		}
	};
}

/**
 * Generate structured data (JSON-LD) for a post
 */
export function generatePostStructuredData(
	post: Post,
	username: string,
	baseUrl: string = 'https://share.social-archiver.com'
): Record<string, any> {
	const postUrl = `${baseUrl}/share/${username}/${post.shareId}`;

	return {
		'@context': 'https://schema.org',
		'@type': 'SocialMediaPosting',
		headline: post.title || extractTextFromMarkdown(post.content.text, 100),
		url: postUrl,
		datePublished: post.metadata.timestamp,
		author: {
			'@type': 'Person',
			name: post.author.name,
			url: post.author.url
		},
		sharedContent: {
			'@type': 'Article',
			headline: post.title,
			articleBody: post.content.text,
			...(post.media.length > 0 && {
				image: post.media
					.filter(m => m.type === 'image')
					.map(m => m.url)
			})
		},
		interactionStatistic: [
			...(post.metadata.likes !== undefined ? [{
				'@type': 'InteractionCounter',
				interactionType: 'https://schema.org/LikeAction',
				userInteractionCount: post.metadata.likes
			}] : []),
			...(post.metadata.comments !== undefined ? [{
				'@type': 'InteractionCounter',
				interactionType: 'https://schema.org/CommentAction',
				userInteractionCount: post.metadata.comments
			}] : []),
			...(post.metadata.shares !== undefined ? [{
				'@type': 'InteractionCounter',
				interactionType: 'https://schema.org/ShareAction',
				userInteractionCount: post.metadata.shares
			}] : [])
		]
	};
}