import type { Platform } from './post';

/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  platform: Platform;
  displayName: string;
  domains: string[];
  supportsMedia: boolean;
  supportsAI: boolean;
  maxMediaSize?: number; // in bytes
  rateLimit?: {
    requestsPerHour: number;
    requestsPerDay: number;
  };
  features: {
    stories: boolean;
    live: boolean;
    reels: boolean;
    threads: boolean;
  };
}

/**
 * Platform-specific URL validation result
 */
export interface URLValidationResult {
  valid: boolean;
  platform: Platform;
  postId: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Platform configurations for all supported platforms
 */
export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  facebook: {
    platform: 'facebook',
    displayName: 'Facebook',
    domains: ['facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 100 * 1024 * 1024, // 100MB
    rateLimit: {
      requestsPerHour: 200,
      requestsPerDay: 2000,
    },
    features: {
      stories: true,
      live: true,
      reels: true,
      threads: false,
    },
  },
  linkedin: {
    platform: 'linkedin',
    displayName: 'LinkedIn',
    domains: ['linkedin.com', 'lnkd.in'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 50 * 1024 * 1024, // 50MB
    rateLimit: {
      requestsPerHour: 100,
      requestsPerDay: 1000,
    },
    features: {
      stories: false,
      live: true,
      reels: false,
      threads: false,
    },
  },
  instagram: {
    platform: 'instagram',
    displayName: 'Instagram',
    domains: ['instagram.com', 'instagr.am'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 100 * 1024 * 1024, // 100MB
    rateLimit: {
      requestsPerHour: 200,
      requestsPerDay: 2000,
    },
    features: {
      stories: true,
      live: true,
      reels: true,
      threads: false,
    },
  },
  tiktok: {
    platform: 'tiktok',
    displayName: 'TikTok',
    domains: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 200 * 1024 * 1024, // 200MB (videos)
    rateLimit: {
      requestsPerHour: 100,
      requestsPerDay: 1000,
    },
    features: {
      stories: false,
      live: true,
      reels: false,
      threads: false,
    },
  },
  x: {
    platform: 'x',
    displayName: 'X (Twitter)',
    domains: ['x.com', 'twitter.com', 't.co', 'mobile.x.com', 'mobile.twitter.com'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 512 * 1024 * 1024, // 512MB (videos)
    rateLimit: {
      requestsPerHour: 300,
      requestsPerDay: 3000,
    },
    features: {
      stories: false,
      live: true,
      reels: false,
      threads: true,
    },
  },
  threads: {
    platform: 'threads',
    displayName: 'Threads',
    domains: ['threads.net'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 100 * 1024 * 1024, // 100MB
    rateLimit: {
      requestsPerHour: 200,
      requestsPerDay: 2000,
    },
    features: {
      stories: false,
      live: false,
      reels: false,
      threads: true,
    },
  },
  youtube: {
    platform: 'youtube',
    displayName: 'YouTube',
    domains: ['youtube.com', 'youtu.be', 'm.youtube.com'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 500 * 1024 * 1024, // 500MB (videos)
    rateLimit: {
      requestsPerHour: 150,
      requestsPerDay: 1500,
    },
    features: {
      stories: false,
      live: true,
      reels: true, // YouTube Shorts
      threads: false,
    },
  },
  reddit: {
    platform: 'reddit',
    displayName: 'Reddit',
    domains: ['reddit.com', 'old.reddit.com', 'new.reddit.com', 'redd.it'],
    supportsMedia: true,
    supportsAI: true,
    maxMediaSize: 100 * 1024 * 1024, // 100MB
    rateLimit: {
      requestsPerHour: 200,
      requestsPerDay: 2000,
    },
    features: {
      stories: false,
      live: false,
      reels: false,
      threads: true, // Reddit comment threads
    },
  },
  post: {
    platform: 'post',
    displayName: 'User Post',
    domains: [], // No external domains for user-created posts
    supportsMedia: true,
    supportsAI: false, // AI analysis not supported for user posts in Phase 1
    maxMediaSize: 10 * 1024 * 1024, // 10MB per image (max 10 images)
    rateLimit: {
      requestsPerHour: 10,
      requestsPerDay: 50,
    },
    features: {
      stories: false,
      live: false,
      reels: false,
      threads: false,
    },
  },
};

/**
 * Get platform configuration
 */
export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

/**
 * Get all platform configurations
 */
export function getAllPlatformConfigs(): PlatformConfig[] {
  return Object.values(PLATFORM_CONFIGS);
}

/**
 * Check if platform supports a specific feature
 */
export function platformSupportsFeature(
  platform: Platform,
  feature: keyof PlatformConfig['features']
): boolean {
  return PLATFORM_CONFIGS[platform].features[feature];
}

/**
 * Get platform by domain
 */
export function getPlatformByDomain(domain: string): Platform | null {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

  for (const config of Object.values(PLATFORM_CONFIGS)) {
    if (config.domains.some(d =>
      normalizedDomain === d || normalizedDomain.endsWith(`.${d}`)
    )) {
      return config.platform;
    }
  }

  return null;
}
