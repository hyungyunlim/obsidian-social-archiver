import type { PostData, Platform } from '@/types/post';
import { DateNumberFormatter } from './DateNumberFormatter';
import type { MediaResult } from '../../MediaHandler';

/**
 * MediaFormatter - Format media items for markdown
 * Single Responsibility: Media (images, videos, audio) formatting
 */
export class MediaFormatter {
  private dateNumberFormatter: DateNumberFormatter;

  constructor(dateNumberFormatter: DateNumberFormatter) {
    this.dateNumberFormatter = dateNumberFormatter;
  }

  /**
   * Format media items for markdown
   * @param media - Original media items from PostData
   * @param platform - Platform name
   * @param originalUrl - Original post URL
   * @param mediaResults - Downloaded media results (optional, if downloadMedia is enabled)
   */
  formatMedia(
    media: PostData['media'],
    platform: Platform,
    originalUrl: string,
    mediaResults?: MediaResult[]
  ): string {
    // For YouTube, use original URL directly (don't download video)
    if (platform === 'youtube') {
      return `![](${originalUrl})`;
    }

    if (!media || media.length === 0) {
      return '';
    }

    // If no media was downloaded (downloadMedia = OFF), skip media rendering
    if (!mediaResults || mediaResults.length === 0) {
      return '';
    }

    return media
      .map((item, index) => {
        // Support both altText and alt for backward compatibility
        const alt = item.altText || item.alt || `${item.type} ${index + 1}`;

        // Find downloaded media by matching originalUrl
        const downloadedMedia = mediaResults.find(r => r.originalUrl === item.url);

        // Skip if media was not downloaded
        if (!downloadedMedia) {
          return '';
        }

        const mediaUrl = downloadedMedia.localPath;

        if (item.type === 'image') {
          // Display image inline
          return `![${this.escapeMarkdown(alt)}](${mediaUrl})`;
        } else if (item.type === 'video') {
          // Embed video inline (Obsidian supports video embedding)
          const duration = item.duration ? ` (${this.dateNumberFormatter.formatDuration(item.duration)})` : '';
          return `![🎥 Video${duration}](${mediaUrl})`;
        } else if (item.type === 'audio') {
          // Embed audio inline
          const duration = item.duration ? ` (${this.dateNumberFormatter.formatDuration(item.duration)})` : '';
          return `![🎵 Audio${duration}](${mediaUrl})`;
        } else {
          return `[📄 Document](${mediaUrl})`;
        }
      })
      .filter(Boolean) // Remove empty strings
      .join('\n\n');
  }

  /**
   * Escape markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
  }
}
