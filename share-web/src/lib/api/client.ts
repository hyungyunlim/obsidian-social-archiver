/**
 * API Client for Social Archiver Share Web
 *
 * Handles communication with the Workers API endpoints
 * Includes error handling, retry logic, and timeout management
 */

import type { UserPostsResponse, PostResponse, Post } from '$lib/types';

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
 * Fix Reddit comment data (BrightData returns incorrect format)
 * - author.url is empty -> generate from username
 * - timestamp contains upvote info ("2 likes") -> parse to likes field
 */
function fixRedditComments(comments: any[], platform: string): any[] {
  if (platform !== 'reddit' || !comments) return comments;

  return comments.map(comment => {
    const fixed = { ...comment };

    // Fix author URL if empty
    if (fixed.author && (!fixed.author.url || fixed.author.url === '')) {
      const username = fixed.author.username || fixed.author.name;
      fixed.author.url = `https://www.reddit.com/user/${username}`;
    }

    // Parse upvote info from timestamp field
    if (fixed.timestamp && typeof fixed.timestamp === 'string' && fixed.timestamp.includes('like')) {
      const match = fixed.timestamp.match(/(\d+)\s+like/);
      if (match) {
        fixed.likes = parseInt(match[1], 10);
        fixed.timestamp = undefined; // Clear incorrect timestamp
      }
    }

    // Recursively fix replies
    if (fixed.replies && Array.isArray(fixed.replies)) {
      fixed.replies = fixRedditComments(fixed.replies, platform);
    }

    return fixed;
  });
}

/**
 * Transform API response to Post structure
 */
function transformPostData(apiData: any): Post {
  // Handle both old and new API response formats
  const post: Post = {
    shareId: apiData.shareId || '',
    shareUrl: apiData.shareUrl,
    expiresAt: apiData.expiresAt,
    platform: apiData.platform || apiData.metadata?.platform || 'x',
    id: apiData.id || apiData.shareId || '',
    url: apiData.url || apiData.metadata?.originalUrl || '',
    videoId: apiData.videoId,
    author: {
      name: apiData.author?.name || apiData.metadata?.author || 'Unknown',
      url: apiData.author?.url || '',
      avatar: apiData.author?.avatar,
      handle: apiData.author?.handle,
      verified: apiData.author?.verified
    },
    content: {
      text: typeof apiData.content === 'string' ? apiData.content : apiData.content?.text || apiData.previewText || '',
      html: apiData.content?.html,
      hashtags: apiData.content?.hashtags
    },
    media: apiData.media || [],
    metadata: {
      timestamp: apiData.metadata?.timestamp || apiData.createdAt || new Date().toISOString(),
      likes: apiData.metadata?.likes,
      comments: apiData.metadata?.comments,
      shares: apiData.metadata?.shares,
      views: apiData.metadata?.views,
      bookmarks: apiData.metadata?.bookmarks
    },
    comments: fixRedditComments(apiData.comments || [], apiData.platform || 'x'), // Fix Reddit comment data
    linkPreviews: apiData.linkPreviews, // Extracted URLs for link preview generation
    comment: apiData.comment, // User's personal comment/note
    like: apiData.like, // User's personal like status
    archive: apiData.archive, // Archive status
    title: apiData.title || apiData.metadata?.title,
    previewText: apiData.previewText,
    thumbnail: apiData.thumbnail,
    archivedDate: apiData.archivedDate ? new Date(apiData.archivedDate) : undefined,
    publishedDate: apiData.publishedDate ? new Date(apiData.publishedDate) : undefined,
    createdAt: apiData.createdAt // Share creation timestamp
  };

  return post;
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

  const data = await parseResponse<any>(response);

  // Transform posts if successful
  if (data.success && data.data?.posts) {
    const transformedPosts = data.data.posts.map(transformPostData);
    return {
      success: true,
      data: {
        username: data.data.username,
        posts: transformedPosts,
        total: data.data.pagination?.total,
        nextCursor: data.data.pagination?.nextCursor
      }
    };
  }

  return data;
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

  const data = await parseResponse<any>(response);

  // Transform post if successful
  if (data.success && data.data) {
    const transformedPost = transformPostData({
      ...data.data,
      shareId: shareId // Ensure shareId is included
    });
    return {
      success: true,
      data: transformedPost
    };
  }

  return data;
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

/**
 * Fetch link preview metadata for a single URL
 *
 * @param url - URL to fetch preview metadata for
 * @param config - Optional API client configuration
 * @returns Promise resolving to LinkPreview or null if fetch fails
 */
export async function fetchLinkPreviewMetadata(
  url: string,
  config: Partial<ApiClientConfig> = {}
): Promise<import('$lib/types').LinkPreview | null> {
  const clientConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const response = await fetchWithTimeout(
      `${clientConfig.baseUrl}/api/link-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      },
      10000 // 10 second timeout for link preview fetch
    );

    const data = await parseResponse<any>(response);

    if (data.success && data.data) {
      return data.data as import('$lib/types').LinkPreview;
    }

    return null;
  } catch (error) {
    // Log error but don't throw - graceful degradation
    console.error(`[API] Failed to fetch link preview for ${url}:`, error);
    return null;
  }
}

/**
 * Fetch link preview metadata for multiple URLs concurrently
 *
 * @param urls - Array of URLs to fetch preview metadata for
 * @param config - Optional API client configuration
 * @returns Promise resolving to array of LinkPreview (nulls filtered out)
 */
export async function fetchLinkPreviewsMetadata(
  urls: string[],
  config: Partial<ApiClientConfig> = {}
): Promise<import('$lib/types').LinkPreview[]> {
  if (!urls || urls.length === 0) {
    return [];
  }

  try {
    // Fetch all previews concurrently with Promise.all
    const results = await Promise.all(
      urls.map(url => fetchLinkPreviewMetadata(url, config))
    );

    // Filter out null results (failed fetches)
    return results.filter((preview): preview is import('$lib/types').LinkPreview => preview !== null);
  } catch (error) {
    // If Promise.all fails entirely, return empty array (graceful degradation)
    console.error('[API] Failed to fetch link previews:', error);
    return [];
  }
}
