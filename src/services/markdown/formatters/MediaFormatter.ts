import type { PostData, Platform } from '@/types/post';
import { DateNumberFormatter } from './DateNumberFormatter';

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
   */
  formatMedia(media: PostData['media'], platform: Platform, originalUrl: string): string {
    // For YouTube, use original URL directly (don't download video)
    if (platform === 'youtube') {
      return `![](${originalUrl})`;
    }

    if (!media || media.length === 0) {
      return '';
    }

    return media
      .map((item, index) => {
        // Support both altText and alt for backward compatibility
        const alt = item.altText || item.alt || `${item.type} ${index + 1}`;

        if (item.type === 'image') {
          // Display image inline
          return `![${this.escapeMarkdown(alt)}](${item.url})`;
        } else if (item.type === 'video') {
          // Embed video inline (Obsidian supports video embedding)
          const duration = item.duration ? ` (${this.dateNumberFormatter.formatDuration(item.duration)})` : '';
          return `![🎥 Video${duration}](${item.url})`;
        } else if (item.type === 'audio') {
          // Embed audio inline
          const duration = item.duration ? ` (${this.dateNumberFormatter.formatDuration(item.duration)})` : '';
          return `![🎵 Audio${duration}](${item.url})`;
        } else {
          return `[📄 Document](${item.url})`;
        }
      })
      .join('\n\n');
  }

  /**
   * Escape markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
  }
}
