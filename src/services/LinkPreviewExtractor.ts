import type { IService } from './base/IService';
import type { Platform } from '@/types/post';

/**
 * Link preview object
 */
export interface LinkPreview {
  url: string;
}

/**
 * URL extraction options
 */
export interface ExtractionOptions {
  maxLinks?: number;
  excludeImages?: boolean;
  excludePlatformUrls?: boolean;
}

/**
 * URL extraction result with metadata
 */
export interface ExtractionResult {
  links: LinkPreview[];
  totalFound: number;
  excluded: number;
}

/**
 * Platform-specific URL patterns to exclude
 */
const PLATFORM_DOMAINS = new Set([
  'facebook.com',
  'fb.com',
  'fb.watch',
  'instagram.com',
  'instagr.am',
  'linkedin.com',
  'lnkd.in',
  'tiktok.com',
  'x.com',
  'twitter.com',
  't.co',
  'threads.net',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'redd.it',
]);

/**
 * Image and video file extensions to exclude
 */
const MEDIA_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'ico',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'm4v',
]);

/**
 * LinkPreviewExtractor - Extracts URLs from post content for link preview generation
 *
 * Single Responsibility: URL extraction and filtering
 */
export class LinkPreviewExtractor implements IService {
  private maxLinks: number;
  private excludeImages: boolean;
  private excludePlatformUrls: boolean;

  // URL extraction regex pattern
  // Matches: http(s):// followed by any characters except whitespace and angle brackets
  // Negative lookahead excludes common media file extensions
  private readonly urlPattern = /https?:\/\/(?!.*\.(jpg|jpeg|png|gif|webp|mp4|mov))[^\s<]+/gi;

  constructor(options: ExtractionOptions = {}) {
    this.maxLinks = options.maxLinks ?? 2;
    this.excludeImages = options.excludeImages ?? true;
    this.excludePlatformUrls = options.excludePlatformUrls ?? true;
  }

  async initialize(): Promise<void> {
    // No async initialization needed
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }

  isHealthy(): boolean {
    return true;
  }

  /**
   * Extract URLs from content text
   * Returns array of link preview objects (up to maxLinks)
   */
  extractUrls(content: string, platform?: Platform): LinkPreview[] {
    const result = this.extractUrlsWithDetails(content, platform);
    return result.links;
  }

  /**
   * Extract URLs with detailed extraction statistics
   */
  extractUrlsWithDetails(content: string, _platform?: Platform): ExtractionResult {
    if (!content || typeof content !== 'string') {
      return {
        links: [],
        totalFound: 0,
        excluded: 0,
      };
    }

    // Extract all URLs using regex
    const matches = Array.from(content.matchAll(this.urlPattern));
    const totalFound = matches.length;

    if (matches.length === 0) {
      return {
        links: [],
        totalFound: 0,
        excluded: 0,
      };
    }

    // Filter and collect unique URLs
    const uniqueUrls = new Set<string>();
    const links: LinkPreview[] = [];
    let excluded = 0;

    for (const match of matches) {
      const url = match[0];

      // Check if we've reached max links
      if (links.length >= this.maxLinks) {
        excluded += matches.length - (links.length + excluded);
        break;
      }

      // Skip duplicates
      if (uniqueUrls.has(url)) {
        excluded++;
        continue;
      }

      // Apply filters
      if (this.shouldExcludeUrl(url)) {
        excluded++;
        continue;
      }

      // Add to result
      uniqueUrls.add(url);
      links.push({ url });
    }

    return {
      links,
      totalFound,
      excluded,
    };
  }

  /**
   * Check if URL should be excluded based on filters
   */
  private shouldExcludeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Check if it's an image/video URL
      if (this.excludeImages && this.isMediaUrl(urlObj)) {
        return true;
      }

      // Check if it's a platform-specific URL
      if (this.excludePlatformUrls && this.isPlatformUrl(urlObj)) {
        return true;
      }

      return false;
    } catch (error) {
      // Invalid URL, exclude it
      return true;
    }
  }

  /**
   * Check if URL points to a media file
   */
  private isMediaUrl(urlObj: URL): boolean {
    const pathname = urlObj.pathname.toLowerCase();
    const extension = pathname.split('.').pop();

    if (!extension) {
      return false;
    }

    return MEDIA_EXTENSIONS.has(extension);
  }

  /**
   * Check if URL is from a social media platform
   */
  private isPlatformUrl(urlObj: URL): boolean {
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');

    // Check exact match
    if (PLATFORM_DOMAINS.has(hostname)) {
      return true;
    }

    // Check if it's a subdomain of a platform
    for (const domain of PLATFORM_DOMAINS) {
      if (hostname.endsWith(`.${domain}`)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update extraction options
   */
  setOptions(options: Partial<ExtractionOptions>): void {
    if (options.maxLinks !== undefined) {
      this.maxLinks = options.maxLinks;
    }
    if (options.excludeImages !== undefined) {
      this.excludeImages = options.excludeImages;
    }
    if (options.excludePlatformUrls !== undefined) {
      this.excludePlatformUrls = options.excludePlatformUrls;
    }
  }

  /**
   * Get current options
   */
  getOptions(): ExtractionOptions {
    return {
      maxLinks: this.maxLinks,
      excludeImages: this.excludeImages,
      excludePlatformUrls: this.excludePlatformUrls,
    };
  }

  /**
   * Get supported media extensions
   */
  getSupportedMediaExtensions(): string[] {
    return Array.from(MEDIA_EXTENSIONS);
  }

  /**
   * Get platform domains list
   */
  getPlatformDomains(): string[] {
    return Array.from(PLATFORM_DOMAINS);
  }
}
