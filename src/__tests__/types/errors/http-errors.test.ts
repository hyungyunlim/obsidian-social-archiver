import { describe, it, expect } from 'vitest';
import {
	HttpError,
	NetworkError,
	TimeoutError,
	RateLimitError,
	AuthenticationError,
	InvalidRequestError,
	ServerError,
	BrightDataError,
	isRetryableError,
	getErrorStatusCode,
} from '@/types/errors/http-errors';

describe('HTTP Error Types', () => {
	describe('HttpError', () => {
		it('should create basic HTTP error', () => {
			const error = new HttpError('Test error', 'TEST_ERROR');

			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('HttpError');
			expect(error.message).toBe('Test error');
			expect(error.code).toBe('TEST_ERROR');
			expect(error.isRetryable).toBe(false);
		});

		it('should support status code', () => {
			const error = new HttpError('Not found', 'NOT_FOUND', {
				statusCode: 404,
			});

			expect(error.statusCode).toBe(404);
		});

		it('should support retryable flag', () => {
			const error = new HttpError('Server error', 'SERVER_ERROR', {
				statusCode: 500,
				isRetryable: true,
			});

			expect(error.isRetryable).toBe(true);
		});

		it('should support error cause', () => {
			const cause = new Error('Original error');
			const error = new HttpError('Wrapped error', 'WRAPPED', {
				cause,
			});

			expect(error.cause).toBe(cause);
		});

		it('should capture stack trace', () => {
			const error = new HttpError('Test error', 'TEST_ERROR');

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain('HttpError');
		});
	});

	describe('NetworkError', () => {
		it('should create network error', () => {
			const error = new NetworkError('Connection failed');

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('NetworkError');
			expect(error.code).toBe('NETWORK_ERROR');
			expect(error.isRetryable).toBe(true);
		});

		it('should support original error cause', () => {
			const cause = new Error('ECONNREFUSED');
			const error = new NetworkError('Connection refused', undefined, cause);

			expect(error.cause).toBe(cause);
		});
	});

	describe('TimeoutError', () => {
		it('should create timeout error', () => {
			const error = new TimeoutError('Request timeout');

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('TimeoutError');
			expect(error.code).toBe('TIMEOUT_ERROR');
			expect(error.isRetryable).toBe(true);
		});
	});

	describe('RateLimitError', () => {
		it('should create rate limit error with basic info', () => {
			const error = new RateLimitError('Rate limit exceeded', {
				statusCode: 429,
			});

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('RateLimitError');
			expect(error.code).toBe('RATE_LIMIT_ERROR');
			expect(error.statusCode).toBe(429);
			expect(error.isRetryable).toBe(true);
		});

		it('should include retry-after information', () => {
			const error = new RateLimitError('Rate limit exceeded', {
				retryAfter: 60,
				limit: 100,
				remaining: 0,
			});

			expect(error.retryAfter).toBe(60);
			expect(error.limit).toBe(100);
			expect(error.remaining).toBe(0);
		});

		it('should default status code to 429', () => {
			const error = new RateLimitError('Rate limit exceeded', {});

			expect(error.statusCode).toBe(429);
		});
	});

	describe('AuthenticationError', () => {
		it('should create 401 authentication error', () => {
			const error = new AuthenticationError('Unauthorized', 401);

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('AuthenticationError');
			expect(error.code).toBe('AUTHENTICATION_ERROR');
			expect(error.statusCode).toBe(401);
			expect(error.isRetryable).toBe(false);
		});

		it('should create 403 forbidden error', () => {
			const error = new AuthenticationError('Forbidden', 403);

			expect(error.statusCode).toBe(403);
			expect(error.isRetryable).toBe(false);
		});
	});

	describe('InvalidRequestError', () => {
		it('should create invalid request error', () => {
			const error = new InvalidRequestError('Bad request', 400, {});

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('InvalidRequestError');
			expect(error.code).toBe('INVALID_REQUEST_ERROR');
			expect(error.statusCode).toBe(400);
			expect(error.isRetryable).toBe(false);
		});

		it('should include validation errors', () => {
			const validationErrors = ['Field "email" is required', 'Field "age" must be a number'];
			const error = new InvalidRequestError('Validation failed', 422, {
				validationErrors,
			});

			expect(error.validationErrors).toEqual(validationErrors);
		});
	});

	describe('ServerError', () => {
		it('should create 500 server error', () => {
			const error = new ServerError('Internal server error', 500);

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('ServerError');
			expect(error.code).toBe('SERVER_ERROR');
			expect(error.statusCode).toBe(500);
			expect(error.isRetryable).toBe(true);
		});

		it('should create 502 bad gateway error', () => {
			const error = new ServerError('Bad gateway', 502);

			expect(error.statusCode).toBe(502);
			expect(error.isRetryable).toBe(true);
		});

		it('should create 503 service unavailable error', () => {
			const error = new ServerError('Service unavailable', 503);

			expect(error.statusCode).toBe(503);
			expect(error.isRetryable).toBe(true);
		});

		it('should create 504 gateway timeout error', () => {
			const error = new ServerError('Gateway timeout', 504);

			expect(error.statusCode).toBe(504);
			expect(error.isRetryable).toBe(true);
		});
	});

	describe('BrightDataError', () => {
		it('should create BrightData-specific error', () => {
			const error = new BrightDataError('API quota exceeded', 'QUOTA_EXCEEDED', {
				statusCode: 429,
				isRetryable: false,
			});

			expect(error).toBeInstanceOf(HttpError);
			expect(error.name).toBe('BrightDataError');
			expect(error.code).toBe('BRIGHTDATA_QUOTA_EXCEEDED');
			expect(error.statusCode).toBe(429);
			expect(error.isRetryable).toBe(false);
		});

		it('should prefix code with BRIGHTDATA_', () => {
			const error = new BrightDataError('Invalid credentials', 'INVALID_CREDENTIALS', {});

			expect(error.code).toBe('BRIGHTDATA_INVALID_CREDENTIALS');
		});
	});

	describe('isRetryableError', () => {
		it('should return true for retryable HTTP errors', () => {
			const networkError = new NetworkError('Connection failed');
			const timeoutError = new TimeoutError('Request timeout');
			const rateLimitError = new RateLimitError('Rate limit', {});
			const serverError = new ServerError('Server error', 500);

			expect(isRetryableError(networkError)).toBe(true);
			expect(isRetryableError(timeoutError)).toBe(true);
			expect(isRetryableError(rateLimitError)).toBe(true);
			expect(isRetryableError(serverError)).toBe(true);
		});

		it('should return false for non-retryable HTTP errors', () => {
			const authError = new AuthenticationError('Unauthorized', 401);
			const invalidError = new InvalidRequestError('Bad request', 400, {});

			expect(isRetryableError(authError)).toBe(false);
			expect(isRetryableError(invalidError)).toBe(false);
		});

		it('should detect retryable network errors from message', () => {
			const errors = [
				new Error('network timeout occurred'),
				new Error('ECONNRESET: Connection reset by peer'),
				new Error('ENOTFOUND: DNS lookup failed'),
				new Error('ETIMEDOUT: Operation timed out'),
			];

			errors.forEach((error) => {
				expect(isRetryableError(error)).toBe(true);
			});
		});

		it('should return false for generic errors', () => {
			const error = new Error('Some random error');

			expect(isRetryableError(error)).toBe(false);
		});

		it('should return false for non-error values', () => {
			expect(isRetryableError('string error')).toBe(false);
			expect(isRetryableError(null)).toBe(false);
			expect(isRetryableError(undefined)).toBe(false);
			expect(isRetryableError(123)).toBe(false);
		});
	});

	describe('getErrorStatusCode', () => {
		it('should extract status code from HTTP errors', () => {
			const errors = [
				{ error: new HttpError('Test', 'TEST', { statusCode: 404 }), expected: 404 },
				{ error: new AuthenticationError('Unauthorized', 401), expected: 401 },
				{ error: new RateLimitError('Rate limit', { statusCode: 429 }), expected: 429 },
				{ error: new ServerError('Server error', 500), expected: 500 },
			];

			errors.forEach(({ error, expected }) => {
				expect(getErrorStatusCode(error)).toBe(expected);
			});
		});

		it('should return undefined for errors without status code', () => {
			const networkError = new NetworkError('Connection failed');
			const timeoutError = new TimeoutError('Timeout');

			expect(getErrorStatusCode(networkError)).toBeUndefined();
			expect(getErrorStatusCode(timeoutError)).toBeUndefined();
		});

		it('should return undefined for non-HTTP errors', () => {
			const error = new Error('Generic error');

			expect(getErrorStatusCode(error)).toBeUndefined();
		});

		it('should return undefined for non-error values', () => {
			expect(getErrorStatusCode('string')).toBeUndefined();
			expect(getErrorStatusCode(null)).toBeUndefined();
			expect(getErrorStatusCode(undefined)).toBeUndefined();
		});
	});

	describe('Error inheritance', () => {
		it('should maintain prototype chain', () => {
			const error = new RateLimitError('Test', {});

			expect(error).toBeInstanceOf(RateLimitError);
			expect(error).toBeInstanceOf(HttpError);
			expect(error).toBeInstanceOf(Error);
		});

		it('should allow instanceof checks', () => {
			const errors = [
				new NetworkError('Network'),
				new TimeoutError('Timeout'),
				new RateLimitError('Rate limit', {}),
				new AuthenticationError('Auth', 401),
				new InvalidRequestError('Invalid', 400, {}),
				new ServerError('Server', 500),
				new BrightDataError('BrightData', 'ERROR', {}),
			];

			errors.forEach((error) => {
				expect(error).toBeInstanceOf(HttpError);
				expect(error).toBeInstanceOf(Error);
			});
		});
	});

	describe('Error serialization', () => {
		it('should serialize to JSON', () => {
			const error = new RateLimitError('Rate limit exceeded', {
				statusCode: 429,
				retryAfter: 60,
				limit: 100,
				remaining: 0,
			});

			const json = JSON.stringify(error);
			const parsed = JSON.parse(json);

			expect(parsed).toHaveProperty('message');
			expect(parsed).toHaveProperty('name');
			expect(parsed).toHaveProperty('code');
			expect(parsed).toHaveProperty('statusCode');
		});

		it('should include all custom properties', () => {
			const error = new InvalidRequestError('Validation failed', 422, {
				validationErrors: ['Error 1', 'Error 2'],
			});

			const serialized = JSON.parse(JSON.stringify(error));

			expect(serialized.validationErrors).toEqual(['Error 1', 'Error 2']);
		});
	});
});
