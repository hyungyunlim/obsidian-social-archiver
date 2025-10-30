import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUserPosts, getPost, checkApiHealth, ApiError } from './client';

describe('API Client', () => {
	beforeEach(() => {
		// Reset fetch mock before each test
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	describe('getUserPosts', () => {
		it('should fetch user posts successfully', async () => {
			const mockResponse = {
				success: true,
				data: {
					username: 'testuser',
					posts: [
						{
							shareId: 'test123',
							platform: 'x',
							content: 'Test post',
							previewText: 'Test preview'
						}
					],
					pagination: {
						total: 1,
						page: 1,
						limit: 20,
						hasMore: false
					}
				}
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse
			});

			const result = await getUserPosts('testuser');

			expect(result.success).toBe(true);
			expect(result.data.username).toBe('testuser');
			expect(result.data.posts).toHaveLength(1);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/users/testuser/posts'),
				expect.objectContaining({
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				})
			);
		});

		it('should handle 404 error when user not found', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				json: async () => ({
					error: {
						code: 'NOT_FOUND',
						message: 'User not found'
					}
				})
			});

			await expect(getUserPosts('unknownuser')).rejects.toThrow(ApiError);
			await expect(getUserPosts('unknownuser')).rejects.toMatchObject({
				statusCode: 404,
				code: 'NOT_FOUND'
			});
		});

		it('should handle network errors with retry', async () => {
			let callCount = 0;
			global.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount <= 2) {
					throw new Error('Network error');
				}
				return Promise.resolve({
					ok: true,
					json: async () => ({ success: true, data: { username: 'test', posts: [] } })
				});
			});

			const result = await getUserPosts('testuser', { maxRetries: 2, retryDelay: 10 });

			expect(result.success).toBe(true);
			expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});
	});

	describe('getPost', () => {
		it('should fetch individual post successfully', async () => {
			const mockPost = {
				shareId: 'test123',
				platform: 'facebook',
				content: 'Test content',
				metadata: {
					title: 'Test Post',
					author: 'Test Author'
				}
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					success: true,
					data: mockPost
				})
			});

			const result = await getPost('test123');

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data.shareId).toBe('test123');
		});

		it('should transform post data correctly', async () => {
			const rawApiResponse = {
				content: 'Raw markdown content',
				metadata: {
					title: 'Post Title',
					platform: 'x',
					author: 'Author Name',
					originalUrl: 'https://x.com/test/123'
				},
				createdAt: 1234567890
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					success: true,
					data: rawApiResponse
				})
			});

			const result = await getPost('test123');

			expect(result.data.content.text).toBe('Raw markdown content');
			expect(result.data.author.name).toBe('Author Name');
			expect(result.data.platform).toBe('x');
		});
	});

	describe('checkApiHealth', () => {
		it('should return true when API is healthy', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true
			});

			const result = await checkApiHealth();

			expect(result).toBe(true);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('/health'),
				expect.objectContaining({ method: 'GET' })
			);
		});

		it('should return false when API is down', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

			const result = await checkApiHealth();

			expect(result).toBe(false);
		});

		it('should respect timeout setting', async () => {
			let timeoutReached = false;
			global.fetch = vi.fn().mockImplementation(() => {
				return new Promise((resolve) => {
					setTimeout(() => {
						timeoutReached = true;
						resolve({ ok: true });
					}, 10000); // Longer than timeout
				});
			});

			const result = await checkApiHealth();

			// Should timeout before the fetch completes
			expect(timeoutReached).toBe(false);
			expect(result).toBe(false);
		});
	});

	describe('ApiError', () => {
		it('should create error with correct properties', () => {
			const error = new ApiError('Test error', 500, 'TEST_ERROR');

			expect(error.message).toBe('Test error');
			expect(error.statusCode).toBe(500);
			expect(error.code).toBe('TEST_ERROR');
			expect(error).toBeInstanceOf(Error);
		});
	});
});