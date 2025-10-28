import type { Platform } from '../types/post';

/**
 * Validate if a string is a valid URL
 */
export function validateUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Extract platform from URL
 */
export function extractPlatform(url: string): Platform | null {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();

		if (hostname.includes('facebook.com') || hostname.includes('fb.')) {
			return 'facebook';
		}
		if (hostname.includes('linkedin.com')) {
			return 'linkedin';
		}
		if (hostname.includes('instagram.com')) {
			return 'instagram';
		}
		if (hostname.includes('tiktok.com')) {
			return 'tiktok';
		}
		if (hostname.includes('twitter.com') || hostname.includes('x.com') || hostname.includes('t.co')) {
			return 'x';
		}
		if (hostname.includes('threads.net')) {
			return 'threads';
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Canonicalize URL by removing tracking parameters and normalizing
 */
export function canonicalizeUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const platform = extractPlatform(url);

		// Define tracking parameters to remove per platform
		const trackingParams: Record<Platform, string[]> = {
			facebook: ['mibextid', 'rdid', '_rdr', 'fs', 'ref', 'referrer', '__tn__', '__xts__'],
			linkedin: ['trackingId', 'trk', 'refId', 'originalSubdomain', 'lipi'],
			instagram: ['igsh', 'igshid', 'img_index', 'utm_source', 'utm_medium'],
			tiktok: ['is_from_webapp', 'sender_device', 'refer', '_r', 'u_code', 'sec_uid'],
			x: ['s', 't', 'ref_src', 'ref_url', 'src', 'twclid'],
			threads: ['utm_source', 'utm_medium', 'utm_campaign'],
		};

		// Remove tracking parameters based on platform
		if (platform && trackingParams[platform]) {
			trackingParams[platform].forEach(param => {
				urlObj.searchParams.delete(param);
			});
		}

		// Remove common tracking parameters
		const commonTrackingParams = [
			'utm_source',
			'utm_medium',
			'utm_campaign',
			'utm_term',
			'utm_content',
			'fbclid',
			'gclid',
			'msclkid',
		];

		commonTrackingParams.forEach(param => {
			urlObj.searchParams.delete(param);
		});

		// Return clean URL
		return urlObj.toString();
	} catch {
		// If URL parsing fails, return original
		return url;
	}
}
