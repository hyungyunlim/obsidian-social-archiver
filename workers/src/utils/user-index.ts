import { z } from 'zod';
import { ValidationError, NotFoundError } from './errors';

/**
 * Username validation schema
 * Accepts alphanumeric characters and hyphens only
 */
export const UsernameSchema = z
	.string()
	.regex(/^[a-zA-Z0-9-]+$/, 'Username can only contain alphanumeric characters and hyphens')
	.min(1, 'Username is required')
	.max(50, 'Username must be less than 50 characters');

/**
 * User post index key naming convention
 */
export function getUserPostsKey(username: string): string {
	return `user_posts:${username.toLowerCase()}`;
}

/**
 * Validates and normalizes username
 * @param username - Raw username input
 * @returns Normalized lowercase username
 * @throws ValidationError if username is invalid
 */
export function validateUsername(username: string): string {
	try {
		const validated = UsernameSchema.parse(username);
		return validated.toLowerCase();
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new ValidationError('Invalid username format', error.errors);
		}
		throw error;
	}
}

/**
 * Retrieves all post IDs for a user
 * @param kv - KV namespace
 * @param username - Username (will be normalized)
 * @returns Array of share IDs
 * @throws ValidationError if username is invalid
 * @throws NotFoundError if user has no posts
 */
export async function getUserPosts(
	kv: KVNamespace,
	username: string
): Promise<string[]> {
	const normalizedUsername = validateUsername(username);
	const key = getUserPostsKey(normalizedUsername);

	const data = await kv.get(key);

	if (!data) {
		throw new NotFoundError('User posts', `User "${username}" has no shared posts`);
	}

	try {
		const shareIds: string[] = JSON.parse(data);
		return shareIds;
	} catch (error) {
		throw new Error(`Failed to parse user posts data for "${username}"`);
	}
}

/**
 * Options for user index operations
 */
export interface UserIndexOptions {
	/**
	 * Time-to-live in seconds
	 * null for permanent storage (pro tier)
	 * Default: 30 days (free tier)
	 */
	ttl?: number | null;
}

/**
 * Default TTL for free tier (30 days)
 */
export const DEFAULT_FREE_TIER_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Adds a post to user's timeline index
 * Automatically deduplicates if shareId already exists
 * @param kv - KV namespace
 * @param username - Username (will be normalized)
 * @param shareId - Share ID to add
 * @param options - Optional configuration (TTL)
 * @throws ValidationError if username is invalid
 */
export async function addPostToUserIndex(
	kv: KVNamespace,
	username: string,
	shareId: string,
	options?: UserIndexOptions
): Promise<void> {
	const normalizedUsername = validateUsername(username);
	const key = getUserPostsKey(normalizedUsername);

	// Get existing posts or initialize empty array
	let shareIds: string[] = [];
	const existingData = await kv.get(key);

	if (existingData) {
		try {
			shareIds = JSON.parse(existingData);
		} catch (error) {
			// If parse fails, start fresh
			shareIds = [];
		}
	}

	// Deduplicate: only add if not already present
	if (!shareIds.includes(shareId)) {
		shareIds.push(shareId);

		// Determine TTL
		const ttl = options?.ttl === null
			? undefined // No expiration for pro tier
			: (options?.ttl ?? DEFAULT_FREE_TIER_TTL);

		// Save back to KV
		await kv.put(
			key,
			JSON.stringify(shareIds),
			ttl !== undefined ? { expirationTtl: ttl } : undefined
		);
	}
}

/**
 * Removes a post from user's timeline index
 * @param kv - KV namespace
 * @param username - Username (will be normalized)
 * @param shareId - Share ID to remove
 * @param options - Optional configuration (TTL to apply when updating)
 * @throws ValidationError if username is invalid
 * @throws NotFoundError if user has no posts
 */
export async function removePostFromUserIndex(
	kv: KVNamespace,
	username: string,
	shareId: string,
	options?: UserIndexOptions
): Promise<void> {
	const normalizedUsername = validateUsername(username);
	const key = getUserPostsKey(normalizedUsername);

	// Get existing posts
	const existingData = await kv.get(key);

	if (!existingData) {
		throw new NotFoundError('User posts', `User "${username}" has no shared posts`);
	}

	let shareIds: string[] = [];
	try {
		shareIds = JSON.parse(existingData);
	} catch (error) {
		throw new Error(`Failed to parse user posts data for "${username}"`);
	}

	// Filter out the shareId
	const filteredShareIds = shareIds.filter(id => id !== shareId);

	// If array is now empty, delete the key entirely
	if (filteredShareIds.length === 0) {
		await kv.delete(key);
	} else {
		// Otherwise, save the filtered array back
		// Determine TTL
		const ttl = options?.ttl === null
			? undefined // No expiration for pro tier
			: (options?.ttl ?? DEFAULT_FREE_TIER_TTL);

		await kv.put(
			key,
			JSON.stringify(filteredShareIds),
			ttl !== undefined ? { expirationTtl: ttl } : undefined
		);
	}
}

/**
 * Adds multiple posts to user's timeline index in batch
 * Automatically deduplicates
 * @param kv - KV namespace
 * @param username - Username (will be normalized)
 * @param shareIds - Array of share IDs to add
 * @param options - Optional configuration (TTL)
 * @throws ValidationError if username is invalid
 */
export async function batchAddPostsToUserIndex(
	kv: KVNamespace,
	username: string,
	shareIds: string[],
	options?: UserIndexOptions
): Promise<void> {
	const normalizedUsername = validateUsername(username);
	const key = getUserPostsKey(normalizedUsername);

	// Get existing posts or initialize empty array
	let existingShareIds: string[] = [];
	const existingData = await kv.get(key);

	if (existingData) {
		try {
			existingShareIds = JSON.parse(existingData);
		} catch (error) {
			// If parse fails, start fresh
			existingShareIds = [];
		}
	}

	// Merge and deduplicate using Set
	const mergedShareIds = Array.from(new Set([...existingShareIds, ...shareIds]));

	// Only update if there are new items
	if (mergedShareIds.length > existingShareIds.length) {
		// Determine TTL
		const ttl = options?.ttl === null
			? undefined // No expiration for pro tier
			: (options?.ttl ?? DEFAULT_FREE_TIER_TTL);

		// Save back to KV
		await kv.put(
			key,
			JSON.stringify(mergedShareIds),
			ttl !== undefined ? { expirationTtl: ttl } : undefined
		);
	}
}

/**
 * Checks if a user has any shared posts
 * @param kv - KV namespace
 * @param username - Username (will be normalized)
 * @returns true if user has posts, false otherwise
 */
export async function userHasPosts(
	kv: KVNamespace,
	username: string
): Promise<boolean> {
	const normalizedUsername = validateUsername(username);
	const key = getUserPostsKey(normalizedUsername);

	const data = await kv.get(key);
	return data !== null;
}

/**
 * Gets the count of posts for a user
 * @param kv - KV namespace
 * @param username - Username (will be normalized)
 * @returns Number of posts, or 0 if user has none
 */
export async function getUserPostCount(
	kv: KVNamespace,
	username: string
): Promise<number> {
	try {
		const posts = await getUserPosts(kv, username);
		return posts.length;
	} catch (error) {
		if (error instanceof NotFoundError) {
			return 0;
		}
		throw error;
	}
}
