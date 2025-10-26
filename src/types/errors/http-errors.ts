/**
 * HTTP and BrightData-specific error types
 */

import type { HttpRequestConfig, HttpResponse } from '../brightdata';

/**
 * Base HTTP error class
 */
export class HttpError extends Error {
	public readonly code: string;
	public readonly statusCode?: number;
	public readonly request?: HttpRequestConfig;
	public readonly response?: HttpResponse;
	public readonly isRetryable: boolean;

	constructor(
		message: string,
		code: string,
		options: {
			statusCode?: number;
			request?: HttpRequestConfig;
			response?: HttpResponse;
			isRetryable?: boolean;
			cause?: Error;
		} = {}
	) {
		super(message);
		this.name = 'HttpError';
		this.code = code;
		this.statusCode = options.statusCode;
		this.request = options.request;
		this.response = options.response;
		this.isRetryable = options.isRetryable ?? false;

		if (options.cause) {
			this.cause = options.cause;
		}

		// Maintains proper stack trace for where error was thrown (V8 only)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

/**
 * Network-related errors (connection, DNS, etc.)
 */
export class NetworkError extends HttpError {
	constructor(message: string, request?: HttpRequestConfig, cause?: Error) {
		super(message, 'NETWORK_ERROR', {
			request,
			isRetryable: true,
			cause,
		});
		this.name = 'NetworkError';
	}
}

/**
 * Request timeout error
 */
export class TimeoutError extends HttpError {
	constructor(message: string, request?: HttpRequestConfig) {
		super(message, 'TIMEOUT_ERROR', {
			request,
			isRetryable: true,
		});
		this.name = 'TimeoutError';
	}
}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitError extends HttpError {
	public readonly retryAfter?: number;
	public readonly limit?: number;
	public readonly remaining?: number;

	constructor(
		message: string,
		options: {
			statusCode?: number;
			request?: HttpRequestConfig;
			response?: HttpResponse;
			retryAfter?: number;
			limit?: number;
			remaining?: number;
		}
	) {
		super(message, 'RATE_LIMIT_ERROR', {
			statusCode: options.statusCode ?? 429,
			request: options.request,
			response: options.response,
			isRetryable: true,
		});
		this.name = 'RateLimitError';
		this.retryAfter = options.retryAfter;
		this.limit = options.limit;
		this.remaining = options.remaining;
	}
}

/**
 * Authentication/Authorization errors (401, 403)
 */
export class AuthenticationError extends HttpError {
	constructor(
		message: string,
		statusCode: number,
		request?: HttpRequestConfig,
		response?: HttpResponse
	) {
		super(message, 'AUTHENTICATION_ERROR', {
			statusCode,
			request,
			response,
			isRetryable: false,
		});
		this.name = 'AuthenticationError';
	}
}

/**
 * Invalid request errors (400, 422)
 */
export class InvalidRequestError extends HttpError {
	public readonly validationErrors?: string[];

	constructor(
		message: string,
		statusCode: number,
		options: {
			request?: HttpRequestConfig;
			response?: HttpResponse;
			validationErrors?: string[];
		}
	) {
		super(message, 'INVALID_REQUEST_ERROR', {
			statusCode,
			request: options.request,
			response: options.response,
			isRetryable: false,
		});
		this.name = 'InvalidRequestError';
		this.validationErrors = options.validationErrors;
	}
}

/**
 * Server errors (500, 502, 503, 504)
 */
export class ServerError extends HttpError {
	constructor(
		message: string,
		statusCode: number,
		request?: HttpRequestConfig,
		response?: HttpResponse
	) {
		super(message, 'SERVER_ERROR', {
			statusCode,
			request,
			response,
			isRetryable: true,
		});
		this.name = 'ServerError';
	}
}

/**
 * BrightData-specific errors
 */
export class BrightDataError extends HttpError {
	constructor(
		message: string,
		code: string,
		options: {
			statusCode?: number;
			request?: HttpRequestConfig;
			response?: HttpResponse;
			isRetryable?: boolean;
		}
	) {
		super(message, `BRIGHTDATA_${code}`, {
			...options,
		});
		this.name = 'BrightDataError';
	}
}

/**
 * Helper function to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof HttpError) {
		return error.isRetryable;
	}

	// Network errors are generally retryable
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes('network') ||
			message.includes('timeout') ||
			message.includes('econnreset') ||
			message.includes('enotfound') ||
			message.includes('etimedout')
		);
	}

	return false;
}

/**
 * Helper function to extract status code from error
 */
export function getErrorStatusCode(error: unknown): number | undefined {
	if (error instanceof HttpError) {
		return error.statusCode;
	}
	return undefined;
}
