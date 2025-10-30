/**
 * API Client for Social Archiver Share Web
 *
 * Handles communication with the Workers API endpoints
 * Includes error handling, retry logic, and timeout management
 */

import type { UserPostsResponse, PostResponse } from '$lib/types';

/**
 * API Client configuration
 */
interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ApiClientConfig = {
  baseUrl: import.meta.env.VITE_API_URL || 'https://social-archiver-api.junlim.org',
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000 // 1 second
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408, 'TIMEOUT');
    }
    throw error;
  }
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: ApiClientConfig
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, config.timeout);

      // Don't retry client errors (4xx), only server errors (5xx) and network errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      lastError = new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );

      // If this was the last attempt, return the response anyway
      if (attempt === config.maxRetries) {
        return response;
      }

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw lastError;
      }
    }

    // Wait before retrying (exponential backoff)
    const delay = config.retryDelay * Math.pow(2, attempt);
    await sleep(delay);
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new ApiError('Unknown error occurred', 500, 'UNKNOWN');
}

/**
 * Parse API response
 */
async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = 'HTTP_ERROR';

    try {
      const errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
      if (errorData.error?.code) {
        errorCode = errorData.error.code;
      }
    } catch {
      // If JSON parsing fails, use default error message
    }

    throw new ApiError(errorMessage, response.status, errorCode);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError(
      'Failed to parse response JSON',
      500,
      'PARSE_ERROR'
    );
  }
}

/**
 * Get user's shared posts
 *
 * @param username - Username to fetch posts for
 * @param config - Optional API client configuration
 * @returns Promise resolving to user posts response
 */
export async function getUserPosts(
  username: string,
  config: Partial<ApiClientConfig> = {}
): Promise<UserPostsResponse> {
  const clientConfig = { ...DEFAULT_CONFIG, ...config };
  const url = `${clientConfig.baseUrl}/api/users/${encodeURIComponent(username)}/posts`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    clientConfig
  );

  return parseResponse<UserPostsResponse>(response);
}

/**
 * Get individual shared post
 *
 * @param shareId - Share ID to fetch
 * @param config - Optional API client configuration
 * @returns Promise resolving to post response
 */
export async function getPost(
  shareId: string,
  config: Partial<ApiClientConfig> = {}
): Promise<PostResponse> {
  const clientConfig = { ...DEFAULT_CONFIG, ...config };
  const url = `${clientConfig.baseUrl}/api/share/${encodeURIComponent(shareId)}`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    clientConfig
  );

  return parseResponse<PostResponse>(response);
}

/**
 * Verify API health
 *
 * @param config - Optional API client configuration
 * @returns Promise resolving to boolean indicating API availability
 */
export async function checkApiHealth(
  config: Partial<ApiClientConfig> = {}
): Promise<boolean> {
  const clientConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const response = await fetchWithTimeout(
      `${clientConfig.baseUrl}/health`,
      { method: 'GET' },
      5000 // 5 second timeout for health check
    );
    return response.ok;
  } catch {
    return false;
  }
}
