/**
 * BrightData API Service
 *
 * Handles scraping social media posts using BrightData's Web Scraping API
 *
 * Single Responsibility: BrightData API communication
 */

import type { Bindings } from '@/types/bindings';
import type { Platform, PostData, Media, Comment } from '@/types/post';
import { Logger } from '@/utils/logger';

export interface BrightDataConfig {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface BrightDataRequest {
  url: string;
  platform: Platform;
  options?: {
    includeComments?: boolean;
    includeShares?: boolean;
  };
}

export interface BrightDataResponse {
  success: boolean;
  data: any;
  metadata: {
    requestId: string;
    timestamp: number;
    processingTime: number;
  };
}

/**
 * BrightData API endpoints for each platform
 */
const PLATFORM_ENDPOINTS: Record<Platform, string> = {
  facebook: 'https://api.brightdata.com/datasets/v3/trigger',
  linkedin: 'https://api.brightdata.com/datasets/v3/trigger',
  instagram: 'https://api.brightdata.com/datasets/v3/trigger',
  tiktok: 'https://api.brightdata.com/datasets/v3/trigger',
  x: 'https://api.brightdata.com/datasets/v3/trigger',
  threads: 'https://api.brightdata.com/datasets/v3/trigger',
};

/**
 * BrightData dataset IDs for each platform
 * Note: These are actual dataset IDs from BrightData
 */
const DATASET_IDS: Record<Platform, string> = {
  facebook: 'gd_lyclm1571iy3mv57zw', // Facebook posts dataset - NEW API (2025-01-27)
  linkedin: 'gd_lyy3tktm25m4avu764', // LinkedIn posts dataset (supports /posts/ and /pulse/ URLs)
  instagram: 'gd_lk5ns7kz21pck8jpis', // Instagram posts dataset (confirmed)
  tiktok: 'gd_lu702nij2f790tmv9h', // TikTok posts dataset (confirmed)
  x: 'gd_lwxkxvnf1cynvib9co', // X (Twitter) posts dataset (confirmed)
  threads: 'gd_md75myxy14rihbjksa', // Threads posts dataset (confirmed)
};

export class BrightDataService {
  private config: BrightDataConfig;
  private logger: Logger;

  constructor(env: Bindings, logger: Logger) {
    if (!env.BRIGHTDATA_API_KEY) {
      throw new Error('BRIGHTDATA_API_KEY is required');
    }

    this.config = {
      apiKey: env.BRIGHTDATA_API_KEY,
      timeout: 25000, // 25 seconds (Workers waitUntil limit is 30s)
      maxRetries: 3,
    };
    this.logger = logger;
  }

  /**
   * Trigger data collection and return snapshot_id (for polling)
   */
  async triggerCollectionOnly(url: string, platform: Platform): Promise<string> {
    this.logger.info('Triggering BrightData collection', { url, platform });

    try {
      const snapshotId = await this.triggerCollection(url, platform);

      this.logger.info('BrightData collection triggered', {
        url,
        platform,
        snapshotId,
      });

      return snapshotId;

    } catch (error) {
      this.logger.error('Failed to trigger BrightData collection', {
        url,
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`BrightData trigger failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch post data from BrightData API (Webhook-based)
   * Returns snapshot_id immediately and BrightData will call webhook when ready
   */
  async fetchPostViaWebhook(request: BrightDataRequest, webhookUrl: string): Promise<string> {
    const { url, platform } = request;

    this.logger.info('Triggering BrightData collection with webhook', { url, platform, webhookUrl });

    try {
      // Trigger data collection with webhook notification
      // BrightData will call our webhook when scraping is complete
      const snapshotId = await this.triggerCollectionWithWebhook(url, platform, webhookUrl);

      this.logger.info('BrightData collection triggered with webhook notification', {
        url,
        platform,
        snapshotId,
        webhookUrl,
      });

      return snapshotId;

    } catch (error) {
      this.logger.error('Failed to trigger BrightData collection', {
        url,
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`BrightData trigger failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Setup webhook delivery for snapshot
   */
  private async setupWebhookDelivery(snapshotId: string, webhookUrl: string): Promise<void> {
    const response = await fetch(
      `https://api.brightdata.com/datasets/v3/deliver/${snapshotId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliver: {
            type: 'webhook',
            endpoint: webhookUrl,
            filename: {
              template: '{{snapshot_id}}.json',
              extension: 'json',
            },
          },
          compress: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Webhook delivery setup failed (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    this.logger.info('Webhook delivery configured', {
      snapshotId,
      deliveryId: data.delivery_id,
    });
  }

  /**
   * Fetch post data (legacy polling method - kept for compatibility)
   */
  async fetchPost(request: BrightDataRequest): Promise<PostData> {
    const { url, platform } = request;

    this.logger.info('Fetching post from BrightData (polling)', { url, platform });

    const startTime = Date.now();

    try {
      // Trigger data collection
      const snapshotId = await this.triggerCollection(url, platform);

      // Wait for collection to complete
      const rawData = await this.waitForCollection(snapshotId, platform);

      // Parse and normalize the data
      const postData = this.parseResponse(rawData, platform, url);

      const processingTime = Date.now() - startTime;
      this.logger.info('Post fetched successfully', {
        url,
        platform,
        processingTime
      });

      return postData;

    } catch (error) {
      this.logger.error('Failed to fetch post from BrightData', {
        url,
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`BrightData fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Trigger data collection with webhook notification
   * BrightData will call the webhook when scraping is complete
   */
  private async triggerCollectionWithWebhook(url: string, platform: Platform, webhookUrl: string): Promise<string> {
    const datasetId = DATASET_IDS[platform];

    // Add webhook parameters to query string
    const params = new URLSearchParams({
      dataset_id: datasetId,
      include_errors: 'true',
      notify: 'true',
      endpoint: webhookUrl,
      format: 'json',
    });

    const endpoint = `${PLATFORM_ENDPOINTS[platform]}?${params.toString()}`;

    // Build platform-specific request body
    const requestBody = this.buildRequestBody(url, platform);

    this.logger.info('Triggering collection with webhook', {
      endpoint,
      webhookUrl,
      platform
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`BrightData API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    this.logger.info('Trigger response received', { snapshotId: data.snapshot_id });
    return data.snapshot_id;
  }

  /**
   * Trigger data collection (legacy polling method)
   */
  private async triggerCollection(url: string, platform: Platform): Promise<string> {
    const datasetId = DATASET_IDS[platform];
    const endpoint = `${PLATFORM_ENDPOINTS[platform]}?dataset_id=${datasetId}&include_errors=true`;

    // Build platform-specific request body
    const requestBody = this.buildRequestBody(url, platform);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`BrightData API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    return data.snapshot_id;
  }

  /**
   * Normalize URL by removing query parameters and fragments
   * BrightData requires clean URLs without tracking parameters
   */
  private normalizeUrl(url: string, platform: Platform): string {
    try {
      const urlObj = new URL(url);

      // Remove all query parameters (utm_source, utm_medium, etc.)
      urlObj.search = '';

      // Remove fragment (#)
      urlObj.hash = '';

      // Platform-specific normalization
      if (platform === 'linkedin') {
        // LinkedIn post URLs should be: /posts/username-slug_activity-ID-hash
        // or /pulse/article-slug
        const path = urlObj.pathname;

        // Validate LinkedIn post URL format
        if (!path.includes('/posts/') && !path.includes('/pulse/')) {
          this.logger.warn('LinkedIn URL might not be supported', { url, path });
        }

        // Keep only the clean path
        return urlObj.origin + path;
      }

      // For other platforms, return clean URL
      return urlObj.origin + urlObj.pathname;

    } catch (error) {
      this.logger.error('Failed to normalize URL', { url, error });
      // Return original URL if normalization fails
      return url;
    }
  }

  /**
   * Build platform-specific request body
   * New BrightData API (2025-01-27) uses simple format for all platforms
   */
  private buildRequestBody(url: string, platform: Platform): any[] {
    // Normalize URL before sending to BrightData
    const cleanUrl = this.normalizeUrl(url, platform);

    this.logger.info('URL normalized for BrightData', {
      original: url,
      normalized: cleanUrl,
      platform
    });

    // All platforms use simple format: [{"url": "..."}]
    // The new Facebook dataset (gd_lyclm1571iy3mv57zw) doesn't support
    // get_all_replies, limit_records, comments_sort parameters
    return [{ url: cleanUrl }];
  }

  /**
   * Wait for collection to complete and fetch results
   */
  private async waitForCollection(snapshotId: string, platform: Platform): Promise<any> {
    const maxWaitTime = this.config.timeout!;
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkCollectionStatus(snapshotId);

      if (status.status === 'ready') {
        return await this.downloadSnapshot(snapshotId);
      }

      if (status.status === 'failed') {
        throw new Error(`BrightData collection failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('BrightData collection timeout');
  }

  /**
   * Check collection status
   */
  private async checkCollectionStatus(snapshotId: string): Promise<any> {
    const response = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Download snapshot data
   * BrightData returns NDJSON (Newline Delimited JSON) format
   */
  private async downloadSnapshot(snapshotId: string): Promise<any> {
    const response = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('Failed to download snapshot', { status: response.status, error: errorText });
      throw new Error(`Failed to download snapshot: ${response.status}`);
    }

    // BrightData returns NDJSON format (each line is a separate JSON object)
    const text = await response.text();
    this.logger.debug('Raw snapshot response', { snapshotId, responseLength: text.length });

    try {
      // Split by newlines and parse each line
      const lines = text.trim().split('\n');
      const results = lines
        .filter(line => line.trim().length > 0)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            this.logger.error('Failed to parse NDJSON line', { line: line.substring(0, 100), error: e });
            return null;
          }
        })
        .filter(result => result !== null);

      if (results.length === 0) {
        throw new Error('No valid data in snapshot response');
      }

      this.logger.debug('Parsed snapshot results', { count: results.length });
      return results[0]; // Return first result
    } catch (error) {
      this.logger.error('Failed to parse snapshot data', {
        snapshotId,
        error: error instanceof Error ? error.message : String(error),
        responsePreview: text.substring(0, 500)
      });
      throw new Error(`Failed to parse snapshot data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse and normalize BrightData response
   */
  private parseResponse(rawData: any, platform: Platform, url: string): PostData {
    // Platform-specific parsing
    switch (platform) {
      case 'facebook':
        return this.parseFacebookPost(rawData, url);
      case 'linkedin':
        return this.parseLinkedInPost(rawData, url);
      case 'instagram':
        return this.parseInstagramPost(rawData, url);
      case 'tiktok':
        return this.parseTikTokPost(rawData, url);
      case 'x':
        return this.parseXPost(rawData, url);
      case 'threads':
        return this.parseThreadsPost(rawData, url);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private parseFacebookPost(data: any, url: string): PostData {
    // Parse media from attachments or fallback to post_image
    const media: Media[] = [];

    this.logger.info('🔍 Parsing Facebook post', {
      hasAttachments: !!data.attachments,
      attachmentsCount: data.attachments?.length || 0,
      hasPostImage: !!data.post_image,
      hasMedia: !!data.media,
    });

    // Try attachments array first (new BrightData API format)
    if (data.attachments && Array.isArray(data.attachments) && data.attachments.length > 0) {
      this.logger.info('📎 Processing attachments', { count: data.attachments.length });

      data.attachments.forEach((attachment: any, index: number) => {
        this.logger.debug(`Attachment ${index}:`, {
          type: attachment.type,
          hasUrl: !!attachment.url,
          hasVideoUrl: !!attachment.video_url,
        });

        if (attachment.type === 'photo' && attachment.url) {
          media.push({
            type: 'image',
            url: attachment.url,
            thumbnail: attachment.thumbnail_url,
          });
          this.logger.info(`✅ Added image ${index + 1}`);
        } else if (attachment.type === 'video' && attachment.video_url) {
          media.push({
            type: 'video',
            url: attachment.video_url,
            thumbnail: attachment.thumbnail_url,
          });
          this.logger.info(`✅ Added video ${index + 1}`);
        } else {
          this.logger.warn(`⚠️ Skipped attachment ${index}:`, { type: attachment.type });
        }
      });
    }

    // Fallback to post_image if no attachments found
    if (media.length === 0 && data.post_image) {
      this.logger.info('📸 Using post_image fallback');
      media.push({
        type: 'image',
        url: data.post_image,
      });
    }

    // Fallback to old media format if available
    if (media.length === 0 && data.media && Array.isArray(data.media)) {
      this.logger.info('🔄 Using old media format fallback');
      data.media.forEach((m: any) => {
        if (m.url) {
          media.push({
            type: m.type || 'image',
            url: m.url,
            thumbnail: m.thumbnail,
            width: m.width,
            height: m.height,
          });
        }
      });
    }

    this.logger.info('✨ Media parsing complete', { totalMedia: media.length });

    // Calculate total likes from num_likes_type array if available
    let totalLikes = data.likes;
    if (!totalLikes && data.num_likes_type && Array.isArray(data.num_likes_type)) {
      totalLikes = data.num_likes_type.reduce((sum: number, like: any) => sum + (like.num || 0), 0);
    }

    // Parse comments if available (future support)
    const comments: Comment[] | undefined = data.comments && Array.isArray(data.comments) && data.comments.length > 0
      ? data.comments.map((comment: any) => ({
          id: comment.comment_id || comment.id || `comment-${Date.now()}`,
          author: {
            name: comment.author_name || comment.user_name || 'Unknown',
            url: comment.author_url || comment.user_url || '',
            avatar: comment.author_avatar || comment.user_avatar,
            handle: comment.author_handle || comment.user_handle,
          },
          content: comment.text || comment.content || '',
          timestamp: comment.created_time || comment.date || new Date().toISOString(),
          likes: comment.likes_count || comment.likes,
          replies: comment.replies && Array.isArray(comment.replies)
            ? comment.replies.map((reply: any) => ({
                id: reply.comment_id || reply.id || `reply-${Date.now()}`,
                author: {
                  name: reply.author_name || reply.user_name || 'Unknown',
                  url: reply.author_url || reply.user_url || '',
                  avatar: reply.author_avatar || reply.user_avatar,
                  handle: reply.author_handle || reply.user_handle,
                },
                content: reply.text || reply.content || '',
                timestamp: reply.created_time || reply.date || new Date().toISOString(),
                likes: reply.likes_count || reply.likes,
              }))
            : undefined,
        }))
      : undefined;

    return {
      platform: 'facebook',
      id: data.post_id || data.shortcode || this.extractIdFromUrl(url),
      url,
      author: {
        // Try multiple field names for author info
        name: data.user_username_raw || data.author_name || data.profile_handle || 'Unknown',
        url: data.page_url || data.user_url || data.author_url || '',
        avatar: data.avatar_image_url || data.page_logo || data.author_avatar,
        handle: data.profile_handle || data.user_handle || data.author_handle,
      },
      content: {
        text: data.content || data.text || '',
        html: data.html_content,
      },
      media,
      metadata: {
        likes: totalLikes || data.likes_count,
        comments: data.num_comments || data.comments_count,
        shares: data.num_shares || data.shares_count,
        timestamp: data.date_posted || data.created_time || new Date().toISOString(),
      },
      comments,
      raw: data,
    };
  }

  private parseLinkedInPost(data: any, url: string): PostData {
    // Extract username from author URL or author field
    const extractUsername = (authorData: any): string | undefined => {
      if (authorData.username) return authorData.username;
      if (authorData.author_username) return authorData.author_username;
      // Try to extract from URL: https://linkedin.com/in/username
      if (authorData.author_url) {
        const match = authorData.author_url.match(/\/in\/([^\/\?]+)/);
        if (match) return match[1];
      }
      return undefined;
    };

    const username = extractUsername(data);

    return {
      platform: 'linkedin',
      id: data.post_id || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.author || data.author_name || 'Unknown',
        url: data.author_url || '',
        avatar: data.author_avatar || data.author_profile_picture,
        username,
        handle: username ? `@${username}` : undefined,
        verified: data.author_verified || data.is_verified,
      },
      content: {
        text: data.text || data.commentary || data.content || '',
      },
      media: (data.images || []).map((img: any) => ({
        type: 'image' as const,
        url: img.url || img,
      })),
      metadata: {
        likes: data.num_likes || data.likes_count,
        comments: data.num_comments || data.comments_count,
        shares: data.num_shares || data.shares_count,
        timestamp: data.published_date || data.date_posted || new Date().toISOString(),
      },
      raw: data,
    };
  }

  private parseInstagramPost(data: any, url: string): PostData {
    // Parse media from various possible formats
    const media: Media[] = [];

    this.logger.info('🔍 Parsing Instagram post', {
      hasPhotos: !!data.photos,
      photosCount: data.photos?.length || 0,
      hasPostContent: !!data.post_content,
      postContentCount: data.post_content?.length || 0,
      hasDisplayResources: !!data.display_resources,
    });

    // Try post_content array first (new BrightData format)
    if (data.post_content && Array.isArray(data.post_content) && data.post_content.length > 0) {
      this.logger.info('📎 Processing post_content', { count: data.post_content.length });
      data.post_content.forEach((item: any, index: number) => {
        if (item.url) {
          media.push({
            type: item.type === 'Video' ? 'video' : 'image',
            url: item.url,
          });
          this.logger.info(`✅ Added ${item.type || 'image'} ${index + 1}`);
        }
      });
    }

    // Fallback to photos array
    if (media.length === 0 && data.photos && Array.isArray(data.photos)) {
      this.logger.info('📸 Using photos array fallback');
      data.photos.forEach((photoUrl: string) => {
        if (photoUrl) {
          media.push({
            type: 'image',
            url: photoUrl,
          });
        }
      });
    }

    // Fallback to display_resources (old format)
    if (media.length === 0 && data.display_resources && Array.isArray(data.display_resources)) {
      this.logger.info('🔄 Using display_resources fallback');
      data.display_resources.forEach((m: any) => {
        if (m && m.src) {
          media.push({
            type: data.is_video ? 'video' : 'image',
            url: m.src,
            width: m.config_width,
            height: m.config_height,
          });
        }
      });
    }

    // Fallback to single display_url
    if (media.length === 0 && data.display_url) {
      this.logger.info('🖼️ Using display_url fallback');
      media.push({
        type: data.is_video ? 'video' : 'image',
        url: data.display_url,
      });
    }

    this.logger.info('✨ Instagram media parsing complete', { totalMedia: media.length });

    // Parse comments from latest_comments (with replies)
    const comments: Comment[] | undefined = data.latest_comments && Array.isArray(data.latest_comments) && data.latest_comments.length > 0
      ? data.latest_comments.map((comment: any) => {
          // Parse replies if present
          const replies: Comment[] | undefined = comment.replies && Array.isArray(comment.replies) && comment.replies.length > 0
            ? comment.replies.map((reply: any) => ({
                id: reply.id || `reply-${Date.now()}-${Math.random()}`,
                author: {
                  name: reply.user_commenting || 'Unknown',
                  url: `https://instagram.com/${reply.user_commenting}`,
                  avatar: reply.profile_picture,
                  handle: reply.user_commenting,
                },
                content: reply.comments || '',
                timestamp: new Date().toISOString(),
                likes: reply.likes || 0,
              }))
            : undefined;

          return {
            id: comment.id || `comment-${Date.now()}`,
            author: {
              name: comment.user_commenting || 'Unknown',
              url: `https://instagram.com/${comment.user_commenting}`,
              avatar: comment.profile_picture,
              handle: comment.user_commenting,
            },
            content: comment.comments || '',
            timestamp: new Date().toISOString(),
            likes: comment.likes || 0,
            replies,
          };
        })
      : undefined;

    return {
      platform: 'instagram',
      id: data.shortcode || data.post_id || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.user_posted || data.owner_username || 'Unknown',
        url: data.profile_url || `https://instagram.com/${data.user_posted || data.owner_username}`,
        avatar: data.profile_image_link || data.owner_profile_pic_url,
        handle: data.user_posted || data.owner_username,
        verified: data.is_verified,
      },
      content: {
        text: data.description || data.caption || '',
      },
      media,
      metadata: {
        likes: data.likes || data.likes_count || data.edge_liked_by?.count,
        comments: data.num_comments || data.comments_count || data.edge_media_to_comment?.count,
        timestamp: data.date_posted || (data.taken_at_timestamp ? new Date(data.taken_at_timestamp * 1000).toISOString() : new Date().toISOString()),
      },
      comments,
      raw: data,
    };
  }

  private parseTikTokPost(data: any, url: string): PostData {
    return {
      platform: 'tiktok',
      id: data.id || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.author_name || data.author?.nickname || 'Unknown',
        url: `https://tiktok.com/@${data.author_username || data.author?.unique_id}`,
        avatar: data.author_avatar || data.author?.avatar_thumb?.url_list?.[0],
        handle: data.author_username || data.author?.unique_id,
      },
      content: {
        text: data.description || data.desc || '',
      },
      media: [
        {
          type: 'video',
          url: data.video_url || data.video?.play_addr?.url_list?.[0] || '',
          thumbnail: data.thumbnail_url || data.video?.cover?.url_list?.[0],
          duration: data.duration || data.video?.duration,
        },
      ],
      metadata: {
        likes: data.likes_count || data.statistics?.digg_count,
        comments: data.comments_count || data.statistics?.comment_count,
        shares: data.shares_count || data.statistics?.share_count,
        views: data.views_count || data.statistics?.play_count,
        timestamp: data.create_time ? new Date(data.create_time * 1000).toISOString() : new Date().toISOString(),
      },
      raw: data,
    };
  }

  private parseXPost(data: any, url: string): PostData {
    return {
      platform: 'x',
      id: data.id_str || data.id || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.user?.name || data.author_name || 'Unknown',
        url: `https://x.com/${data.user?.screen_name || data.author_username}`,
        avatar: data.user?.profile_image_url_https || data.author_avatar,
        handle: data.user?.screen_name || data.author_username,
      },
      content: {
        text: data.full_text || data.text || '',
      },
      media: (data.extended_entities?.media || data.media || []).map((m: any) => ({
        type: m.type === 'video' || m.type === 'animated_gif' ? 'video' : 'image' as const,
        url: m.media_url_https || m.url,
        thumbnail: m.media_url_https,
      })),
      metadata: {
        likes: data.favorite_count,
        comments: data.reply_count,
        shares: data.retweet_count,
        views: data.view_count,
        timestamp: data.created_at || new Date().toISOString(),
      },
      raw: data,
    };
  }

  private parseThreadsPost(data: any, url: string): PostData {
    return {
      platform: 'threads',
      id: data.code || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.user?.username || 'Unknown',
        url: `https://threads.net/@${data.user?.username}`,
        avatar: data.user?.profile_pic_url,
        handle: data.user?.username,
      },
      content: {
        text: data.caption?.text || '',
      },
      media: (data.image_versions2?.candidates || []).map((m: any) => ({
        type: 'image' as const,
        url: m.url,
        width: m.width,
        height: m.height,
      })),
      metadata: {
        likes: data.like_count,
        timestamp: data.taken_at ? new Date(data.taken_at * 1000).toISOString() : new Date().toISOString(),
      },
      raw: data,
    };
  }

  /**
   * Extract post ID from URL as fallback
   */
  private extractIdFromUrl(url: string): string {
    const match = url.match(/\/([^\/]+)\/?$/);
    return match?.[1] || `post-${Date.now()}`;
  }
}
