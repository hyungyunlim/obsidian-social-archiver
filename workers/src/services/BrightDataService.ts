/**
 * BrightData API Service
 *
 * Handles scraping social media posts using BrightData's Web Scraping API
 *
 * Single Responsibility: BrightData API communication
 */

import type { Bindings } from '@/types/bindings';
import type { Platform, PostData } from '@/types/post';
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
  linkedin: 'gd_l1viktl72bvl7bjuj0', // LinkedIn profiles dataset (confirmed)
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
   * Build platform-specific request body
   * Facebook needs special parameters for comments
   */
  private buildRequestBody(url: string, platform: Platform): any[] {
    switch (platform) {
      case 'facebook':
        // Facebook with comments support
        return [{
          url,
          // Don't fetch deeply nested replies by default (performance)
          get_all_replies: false,
          // No limit on records
          limit_records: '',
          // Default comment sort
          comments_sort: '',
        }];

      default:
        // Other platforms use simple format
        return [{ url }];
    }
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
    return {
      platform: 'facebook',
      id: data.post_id || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.author_name || 'Unknown',
        url: data.author_url || '',
        avatar: data.author_avatar,
        handle: data.author_handle,
      },
      content: {
        text: data.text || '',
        html: data.html_content,
      },
      media: (data.media || []).map((m: any) => ({
        type: m.type || 'image',
        url: m.url,
        thumbnail: m.thumbnail,
        width: m.width,
        height: m.height,
      })),
      metadata: {
        likes: data.likes_count,
        comments: data.comments_count,
        shares: data.shares_count,
        timestamp: data.created_time || new Date().toISOString(),
      },
      raw: data,
    };
  }

  private parseLinkedInPost(data: any, url: string): PostData {
    return {
      platform: 'linkedin',
      id: data.post_id || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.author || 'Unknown',
        url: data.author_url || '',
        avatar: data.author_avatar,
      },
      content: {
        text: data.text || data.commentary || '',
      },
      media: (data.images || []).map((img: any) => ({
        type: 'image' as const,
        url: img.url || img,
      })),
      metadata: {
        likes: data.num_likes,
        comments: data.num_comments,
        shares: data.num_shares,
        timestamp: data.published_date || new Date().toISOString(),
      },
      raw: data,
    };
  }

  private parseInstagramPost(data: any, url: string): PostData {
    return {
      platform: 'instagram',
      id: data.shortcode || this.extractIdFromUrl(url),
      url,
      author: {
        name: data.owner_username || 'Unknown',
        url: `https://instagram.com/${data.owner_username}`,
        avatar: data.owner_profile_pic_url,
        handle: data.owner_username,
      },
      content: {
        text: data.caption || '',
      },
      media: (data.display_resources || [data.display_url]).map((m: any) => ({
        type: data.is_video ? 'video' : 'image' as const,
        url: typeof m === 'string' ? m : m.src,
        width: typeof m === 'object' ? m.config_width : undefined,
        height: typeof m === 'object' ? m.config_height : undefined,
      })),
      metadata: {
        likes: data.likes_count || data.edge_liked_by?.count,
        comments: data.comments_count || data.edge_media_to_comment?.count,
        timestamp: data.taken_at_timestamp ? new Date(data.taken_at_timestamp * 1000).toISOString() : new Date().toISOString(),
      },
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
