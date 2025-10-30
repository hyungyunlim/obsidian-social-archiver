/**
 * User Index Utilities Test Suite
 *
 * Tests KV-based user timeline indexing operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	validateUsername,
	getUserPostsKey,
	getUserPosts,
	addPostToUserIndex,
	removePostFromUserIndex,
	batchAddPostsToUserIndex,
	userHasPosts,
	getUserPostCount,
	DEFAULT_FREE_TIER_TTL
} from '@/utils/user-index';
import { ValidationError, NotFoundError } from '@/utils/errors';

describe('User Index Utilities', () => {
	let mockKV: KVNamespace;

	beforeEach(() => {
		// Create mock KV namespace
		mockKV = {
			get: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
			getWithMetadata: vi.fn(),
			list: vi.fn()
		} as unknown as KVNamespace;
	});

	describe('validateUsername', () => {
		it('should validate and normalize valid usernames', () => {
			expect(validateUsername('JohnDoe')).toBe('johndoe');
			expect(validateUsername('user-name')).toBe('user-name');
			expect(validateUsername('User123')).toBe('user123');
			expect(validateUsername('test-user-123')).toBe('test-user-123');
		});

		it('should reject invalid username formats', () => {
			expect(() => validateUsername('')).toThrow(ValidationError);
			expect(() => validateUsername('user name')).toThrow(ValidationError); // space
			expect(() => validateUsername('user@name')).toThrow(ValidationError); // @
			expect(() => validateUsername('user_name')).toThrow(ValidationError); // underscore
			expect(() => validateUsername('user.name')).toThrow(ValidationError); // dot
			expect(() => validateUsername('a'.repeat(51))).toThrow(ValidationError); // too long
		});

		it('should include validation error details', () => {
			try {
				validateUsername('invalid@username');
				expect.fail('Should have thrown ValidationError');
			} catch (error) {
				expect(error).toBeInstanceOf(ValidationError);
				expect((error as ValidationError).details).toBeDefined();
			}
		});
	});

	describe('getUserPostsKey', () => {
		it('should generate correct KV key format', () => {
			expect(getUserPostsKey('JohnDoe')).toBe('user_posts:johndoe');
			expect(getUserPostsKey('test-user')).toBe('user_posts:test-user');
			expect(getUserPostsKey('User123')).toBe('user_posts:user123');
		});

		it('should always return lowercase keys', () => {
			expect(getUserPostsKey('UPPERCASE')).toBe('user_posts:uppercase');
			expect(getUserPostsKey('MiXeDCaSe')).toBe('user_posts:mixedcase');
		});
	});

	describe('getUserPosts', () => {
		it('should retrieve and parse user posts', async () => {
			const mockPosts = ['share1', 'share2', 'share3'];
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(mockPosts));

			const result = await getUserPosts(mockKV, 'testuser');

			expect(result).toEqual(mockPosts);
			expect(mockKV.get).toHaveBeenCalledWith('user_posts:testuser');
		});

		it('should throw NotFoundError when user has no posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);

			await expect(getUserPosts(mockKV, 'nonexistent'))
				.rejects.toThrow(NotFoundError);
		});

		it('should throw error on invalid JSON data', async () => {
			vi.mocked(mockKV.get).mockResolvedValue('invalid json');

			await expect(getUserPosts(mockKV, 'testuser'))
				.rejects.toThrow('Failed to parse user posts data');
		});

		it('should normalize username before lookup', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify([]));

			await getUserPosts(mockKV, 'TestUser');

			expect(mockKV.get).toHaveBeenCalledWith('user_posts:testuser');
		});
	});

	describe('addPostToUserIndex', () => {
		it('should add new post to empty user index', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);
			vi.mocked(mockKV.put).mockResolvedValue();

			await addPostToUserIndex(mockKV, 'testuser', 'share123');

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share123']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});

		it('should add post to existing index', async () => {
			const existingPosts = ['share1', 'share2'];
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(existingPosts));
			vi.mocked(mockKV.put).mockResolvedValue();

			await addPostToUserIndex(mockKV, 'testuser', 'share3');

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share1', 'share2', 'share3']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});

		it('should deduplicate existing shareIds', async () => {
			const existingPosts = ['share1', 'share2'];
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(existingPosts));
			vi.mocked(mockKV.put).mockResolvedValue();

			await addPostToUserIndex(mockKV, 'testuser', 'share1');

			// Should not call put since share1 already exists
			expect(mockKV.put).not.toHaveBeenCalled();
		});

		it('should apply custom TTL when provided', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);
			vi.mocked(mockKV.put).mockResolvedValue();

			const customTtl = 60 * 60 * 24 * 7; // 7 days
			await addPostToUserIndex(mockKV, 'testuser', 'share123', { ttl: customTtl });

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share123']),
				{ expirationTtl: customTtl }
			);
		});

		it('should not set TTL for pro tier (ttl: null)', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);
			vi.mocked(mockKV.put).mockResolvedValue();

			await addPostToUserIndex(mockKV, 'testuser', 'share123', { ttl: null });

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share123']),
				undefined
			);
		});

		it('should handle corrupted data gracefully', async () => {
			vi.mocked(mockKV.get).mockResolvedValue('invalid json');
			vi.mocked(mockKV.put).mockResolvedValue();

			await addPostToUserIndex(mockKV, 'testuser', 'share123');

			// Should start fresh with new array
			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share123']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});
	});

	describe('removePostFromUserIndex', () => {
		it('should remove post from user index', async () => {
			const existingPosts = ['share1', 'share2', 'share3'];
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(existingPosts));
			vi.mocked(mockKV.put).mockResolvedValue();

			await removePostFromUserIndex(mockKV, 'testuser', 'share2');

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share1', 'share3']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});

		it('should delete KV entry when last post is removed', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1']));
			vi.mocked(mockKV.delete).mockResolvedValue();

			await removePostFromUserIndex(mockKV, 'testuser', 'share1');

			expect(mockKV.delete).toHaveBeenCalledWith('user_posts:testuser');
			expect(mockKV.put).not.toHaveBeenCalled();
		});

		it('should throw NotFoundError when user has no posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);

			await expect(removePostFromUserIndex(mockKV, 'testuser', 'share123'))
				.rejects.toThrow(NotFoundError);
		});

		it('should handle corrupted data', async () => {
			vi.mocked(mockKV.get).mockResolvedValue('invalid json');

			await expect(removePostFromUserIndex(mockKV, 'testuser', 'share123'))
				.rejects.toThrow('Failed to parse user posts data');
		});

		it('should apply custom TTL when provided', async () => {
			const existingPosts = ['share1', 'share2'];
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(existingPosts));
			vi.mocked(mockKV.put).mockResolvedValue();

			const customTtl = 60 * 60 * 24; // 1 day
			await removePostFromUserIndex(mockKV, 'testuser', 'share1', { ttl: customTtl });

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share2']),
				{ expirationTtl: customTtl }
			);
		});

		it('should handle non-existent shareId gracefully', async () => {
			const existingPosts = ['share1', 'share2'];
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(existingPosts));
			vi.mocked(mockKV.put).mockResolvedValue();

			await removePostFromUserIndex(mockKV, 'testuser', 'nonexistent');

			// Should still update KV (array unchanged)
			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share1', 'share2']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});
	});

	describe('batchAddPostsToUserIndex', () => {
		it('should add multiple posts at once', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);
			vi.mocked(mockKV.put).mockResolvedValue();

			await batchAddPostsToUserIndex(mockKV, 'testuser', ['share1', 'share2', 'share3']);

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share1', 'share2', 'share3']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});

		it('should merge with existing posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1']));
			vi.mocked(mockKV.put).mockResolvedValue();

			await batchAddPostsToUserIndex(mockKV, 'testuser', ['share2', 'share3']);

			expect(mockKV.put).toHaveBeenCalledWith(
				'user_posts:testuser',
				JSON.stringify(['share1', 'share2', 'share3']),
				{ expirationTtl: DEFAULT_FREE_TIER_TTL }
			);
		});

		it('should deduplicate across existing and new posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1', 'share2']));
			vi.mocked(mockKV.put).mockResolvedValue();

			await batchAddPostsToUserIndex(mockKV, 'testuser', ['share2', 'share3', 'share1']);

			const putCall = vi.mocked(mockKV.put).mock.calls[0];
			const savedArray = JSON.parse(putCall[1] as string);

			expect(savedArray).toHaveLength(3);
			expect(savedArray).toContain('share1');
			expect(savedArray).toContain('share2');
			expect(savedArray).toContain('share3');
		});

		it('should not update KV if no new posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1', 'share2']));

			await batchAddPostsToUserIndex(mockKV, 'testuser', ['share1', 'share2']);

			expect(mockKV.put).not.toHaveBeenCalled();
		});

		it('should handle empty array gracefully', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1']));

			await batchAddPostsToUserIndex(mockKV, 'testuser', []);

			expect(mockKV.put).not.toHaveBeenCalled();
		});
	});

	describe('userHasPosts', () => {
		it('should return true when user has posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1']));

			const result = await userHasPosts(mockKV, 'testuser');

			expect(result).toBe(true);
		});

		it('should return false when user has no posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);

			const result = await userHasPosts(mockKV, 'testuser');

			expect(result).toBe(false);
		});
	});

	describe('getUserPostCount', () => {
		it('should return correct post count', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(['share1', 'share2', 'share3']));

			const count = await getUserPostCount(mockKV, 'testuser');

			expect(count).toBe(3);
		});

		it('should return 0 when user has no posts', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(null);

			const count = await getUserPostCount(mockKV, 'testuser');

			expect(count).toBe(0);
		});

		it('should return 0 for empty array', async () => {
			vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify([]));

			const count = await getUserPostCount(mockKV, 'testuser');

			expect(count).toBe(0);
		});
	});
});
