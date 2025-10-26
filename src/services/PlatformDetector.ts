import type { IService } from './base/IService';
import type { Platform } from '@/types/post';

/**
 * URL pattern for platform detection
 */
interface URLPattern {
  platform: Platform;
  patterns: RegExp[];
  domains: string[];
}

/**
 * Platform detection result
 */
export interface PlatformDetectionResult {
  platform: Platform;
  confidence: number; // 0-1
  matchedPattern: string;
}

/**
 * Platform-specific URL patterns
 * Patterns are ordered by specificity (most specific first)
 */
const PLATFORM_PATTERNS: URLPattern[] = [
  {
    platform: 'facebook',
    domains: ['facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com'],
    patterns: [
      // Post URLs
      /facebook\.com\/[^/]+\/posts\/\d+/i,
      /facebook\.com\/permalink\.php\?story_fbid=\d+/i,
      /facebook\.com\/photo\.php\?fbid=\d+/i,
      /facebook\.com\/photo\?fbid=\d+/i,

      // Watch/Video URLs
      /facebook\.com\/watch\/\?v=\d+/i,
      /facebook\.com\/[^/]+\/videos\/\d+/i,
      /fb\.watch\/[a-zA-Z0-9_-]+/i,

      // Share URLs
      /facebook\.com\/share\/[a-zA-Z0-9]+/i,
      /facebook\.com\/share\.php/i,

      // Story URLs
      /facebook\.com\/stories\/\d+/i,

      // Group posts
      /facebook\.com\/groups\/[^/]+\/posts\/\d+/i,
      /facebook\.com\/groups\/[^/]+\/permalink\/\d+/i,

      // Mobile URLs
      /m\.facebook\.com\/story\.php\?story_fbid=\d+/i,
      /m\.facebook\.com\/photo\.php\?fbid=\d+/i,
    ],
  },
  {
    platform: 'linkedin',
    domains: ['linkedin.com', 'lnkd.in'],
    patterns: [
      // Post/Activity URLs
      /linkedin\.com\/posts\/[^/]+_[a-zA-Z0-9-]+/i,
      /linkedin\.com\/feed\/update\/urn:li:activity:\d+/i,
      /linkedin\.com\/feed\/update\/urn:li:share:\d+/i,

      // Pulse/Article URLs
      /linkedin\.com\/pulse\/[^/]+/i,

      // Video URLs
      /linkedin\.com\/video\/event\/[^/]+/i,
      /linkedin\.com\/events\/[^/]+/i,

      // Company/Page posts
      /linkedin\.com\/company\/[^/]+\/posts/i,

      // Newsletter
      /linkedin\.com\/newsletters\/[^/]+/i,
    ],
  },
  {
    platform: 'instagram',
    domains: ['instagram.com', 'instagr.am'],
    patterns: [
      // Post URLs
      /instagram\.com\/p\/[A-Za-z0-9_-]+/i,

      // Reel URLs
      /instagram\.com\/reel\/[A-Za-z0-9_-]+/i,
      /instagram\.com\/reels\/[A-Za-z0-9_-]+/i,

      // TV/IGTV URLs
      /instagram\.com\/tv\/[A-Za-z0-9_-]+/i,

      // Story URLs (ephemeral, but should be detected)
      /instagram\.com\/stories\/[^/]+\/\d+/i,

      // Shortened URLs
      /instagr\.am\/p\/[A-Za-z0-9_-]+/i,
    ],
  },
  {
    platform: 'tiktok',
    domains: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    patterns: [
      // Standard video URLs
      /tiktok\.com\/@[^/]+\/video\/\d+/i,

      // Video URLs without username
      /tiktok\.com\/video\/\d+/i,

      // Shortened URLs
      /vm\.tiktok\.com\/[A-Za-z0-9]+/i,
      /vt\.tiktok\.com\/[A-Za-z0-9]+/i,

      // Live URLs
      /tiktok\.com\/@[^/]+\/live/i,

      // Photo mode posts
      /tiktok\.com\/@[^/]+\/photo\/\d+/i,
    ],
  },
  {
    platform: 'x',
    domains: ['x.com', 'twitter.com', 't.co', 'mobile.twitter.com', 'mobile.x.com'],
    patterns: [
      // Standard tweet URLs (x.com and twitter.com)
      /(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/i,

      // Tweet with additional path
      /(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+\/photo\/\d+/i,
      /(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+\/video\/\d+/i,

      // Mobile URLs
      /mobile\.(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/i,

      // Shortened URLs (will need expansion)
      /t\.co\/[A-Za-z0-9]+/i,

      // Moments
      /(?:x\.com|twitter\.com)\/i\/moments\/\d+/i,

      // Spaces (audio rooms)
      /(?:x\.com|twitter\.com)\/i\/spaces\/[A-Za-z0-9]+/i,
    ],
  },
  {
    platform: 'threads',
    domains: ['threads.net', 'www.threads.net'],
    patterns: [
      // Standard post URLs
      /threads\.net\/@[^/]+\/post\/[A-Za-z0-9_-]+/i,

      // Thread URLs (using /t/ path)
      /threads\.net\/t\/[A-Za-z0-9_-]+/i,

      // Direct post link format
      /threads\.net\/[A-Za-z0-9_-]+/i,
    ],
  },
];

/**
 * PlatformDetector - Detects social media platform from URL
 *
 * Single Responsibility: Platform detection and URL pattern matching
 */
export class PlatformDetector implements IService<Platform> {
  private patterns: URLPattern[];

  constructor() {
    this.patterns = PLATFORM_PATTERNS;
  }

  async initialize(): Promise<void> {
    // No async initialization needed
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Detect platform from URL
   * Returns null if platform cannot be determined
   */
  detectPlatform(url: string): Platform | null {
    try {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);

      // Check each platform's patterns
      for (const platformPattern of this.patterns) {
        // First check domain
        if (this.matchesDomain(urlObj.hostname, platformPattern.domains)) {
          // Then check URL patterns
          const fullUrl = urlObj.href;
          const pathname = urlObj.pathname;

          for (const pattern of platformPattern.patterns) {
            if (pattern.test(fullUrl) || pattern.test(pathname)) {
              return platformPattern.platform;
            }
          }

          // If domain matches but no specific pattern, return platform
          // This handles cases where new URL formats appear
          return platformPattern.platform;
        }
      }

      return null;
    } catch (error) {
      // Invalid URL
      return null;
    }
  }

  /**
   * Detect platform with confidence score
   */
  detectWithConfidence(url: string): PlatformDetectionResult | null {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);

      for (const platformPattern of this.patterns) {
        if (this.matchesDomain(urlObj.hostname, platformPattern.domains)) {
          const fullUrl = urlObj.href;
          const pathname = urlObj.pathname;

          // Check each pattern and calculate confidence
          for (const pattern of platformPattern.patterns) {
            if (pattern.test(fullUrl)) {
              return {
                platform: platformPattern.platform,
                confidence: 1.0, // Exact pattern match
                matchedPattern: pattern.source,
              };
            }

            if (pattern.test(pathname)) {
              return {
                platform: platformPattern.platform,
                confidence: 0.9, // Pathname match
                matchedPattern: pattern.source,
              };
            }
          }

          // Domain match only (lower confidence)
          return {
            platform: platformPattern.platform,
            confidence: 0.7, // Domain match only
            matchedPattern: 'domain',
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if URL is from a supported platform
   */
  isSupported(url: string): boolean {
    return this.detectPlatform(url) !== null;
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms(): Platform[] {
    return this.patterns.map(p => p.platform);
  }

  /**
   * Get platform-specific domains
   */
  getPlatformDomains(platform: Platform): string[] {
    const pattern = this.patterns.find(p => p.platform === platform);
    return pattern?.domains ?? [];
  }

  /**
   * Get platform from domain
   */
  detectPlatformFromDomain(domain: string): Platform | null {
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

    for (const platformPattern of this.patterns) {
      if (this.matchesDomain(normalizedDomain, platformPattern.domains)) {
        return platformPattern.platform;
      }
    }

    return null;
  }

  /**
   * Check if hostname matches any of the platform domains
   */
  private matchesDomain(hostname: string, domains: string[]): boolean {
    const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');

    for (const domain of domains) {
      const normalizedDomain = domain.toLowerCase();

      // Exact match
      if (normalizedHostname === normalizedDomain) {
        return true;
      }

      // Subdomain match (e.g., m.facebook.com matches facebook.com)
      if (normalizedHostname.endsWith(`.${normalizedDomain}`)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize URL for consistent processing
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim();

    // Add protocol if missing
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }

    // Handle common URL issues
    normalized = normalized
      // Remove whitespace
      .replace(/\s+/g, '')
      // Ensure single protocol
      .replace(/^(https?:\/\/)+/i, 'https://');

    return normalized;
  }

  /**
   * Extract post ID from URL (basic implementation)
   * Platform-specific services will provide more robust extraction
   */
  extractPostId(url: string): string | null {
    try {
      const urlObj = new URL(this.normalizeUrl(url));
      const platform = this.detectPlatform(url);

      if (!platform) {
        return null;
      }

      switch (platform) {
        case 'facebook':
          return this.extractFacebookPostId(urlObj);
        case 'linkedin':
          return this.extractLinkedInPostId(urlObj);
        case 'instagram':
          return this.extractInstagramPostId(urlObj);
        case 'tiktok':
          return this.extractTikTokPostId(urlObj);
        case 'x':
          return this.extractXPostId(urlObj);
        case 'threads':
          return this.extractThreadsPostId(urlObj);
        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Platform-specific post ID extraction methods
   */
  private extractFacebookPostId(urlObj: URL): string | null {
    // posts/123456
    const postsMatch = urlObj.pathname.match(/\/posts\/(\d+)/);
    if (postsMatch) return postsMatch[1];

    // story_fbid=123456
    const storyFbidMatch = urlObj.searchParams.get('story_fbid');
    if (storyFbidMatch) return storyFbidMatch;

    // fbid=123456
    const fbidMatch = urlObj.searchParams.get('fbid');
    if (fbidMatch) return fbidMatch;

    // v=123456 (video)
    const videoMatch = urlObj.searchParams.get('v');
    if (videoMatch) return videoMatch;

    return null;
  }

  private extractLinkedInPostId(urlObj: URL): string | null {
    // posts/username_activityId
    const postsMatch = urlObj.pathname.match(/\/posts\/[^_]+_([a-zA-Z0-9-]+)/);
    if (postsMatch) return postsMatch[1];

    // urn:li:activity:1234567890
    const activityMatch = urlObj.pathname.match(/urn:li:activity:(\d+)/);
    if (activityMatch) return activityMatch[1];

    return null;
  }

  private extractInstagramPostId(urlObj: URL): string | null {
    // /p/shortcode or /reel/shortcode
    const match = urlObj.pathname.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  }

  private extractTikTokPostId(urlObj: URL): string | null {
    // /video/1234567890
    const match = urlObj.pathname.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
  }

  private extractXPostId(urlObj: URL): string | null {
    // /username/status/1234567890
    const match = urlObj.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  private extractThreadsPostId(urlObj: URL): string | null {
    // /@username/post/postId or /t/postId
    const postMatch = urlObj.pathname.match(/\/post\/([A-Za-z0-9_-]+)/);
    if (postMatch) return postMatch[1];

    const threadMatch = urlObj.pathname.match(/\/t\/([A-Za-z0-9_-]+)/);
    return threadMatch ? threadMatch[1] : null;
  }
}
