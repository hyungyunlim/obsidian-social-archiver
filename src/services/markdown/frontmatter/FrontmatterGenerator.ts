import type { PostData } from '@/types/post';
import type { YamlFrontmatter } from '@/types/archive';
import { DateNumberFormatter } from '../formatters/DateNumberFormatter';
import { TextFormatter } from '../formatters/TextFormatter';

/**
 * FrontmatterGenerator - Generate YAML frontmatter for markdown files
 * Single Responsibility: YAML frontmatter generation and formatting
 */
export class FrontmatterGenerator {
  private dateNumberFormatter: DateNumberFormatter;
  private textFormatter: TextFormatter;

  constructor(dateNumberFormatter: DateNumberFormatter, textFormatter: TextFormatter) {
    this.dateNumberFormatter = dateNumberFormatter;
    this.textFormatter = textFormatter;
  }

  /**
   * Generate YAML frontmatter
   */
  generateFrontmatter(postData: PostData): YamlFrontmatter {
    // Current timestamp in YYYY-MM-DD HH:mm format (consistent with published)
    const now = new Date();
    const archived = this.dateNumberFormatter.formatDate(now);
    const lastModified = this.dateNumberFormatter.formatDate(now);

    // Format original post date (YYYY-MM-DD HH:mm in local timezone)
    const published = this.dateNumberFormatter.formatDate(postData.metadata.timestamp);

    // Extract hashtags from content
    const contentHashtags = this.textFormatter.extractHashtags(postData.content.text);

    return {
      share: false,
      platform: postData.platform,
      author: postData.author.name,
      authorUrl: postData.author.url,
      originalUrl: postData.url,
      published: published, // Original post date (YYYY-MM-DD HH:mm)
      archived: archived, // Archive timestamp (YYYY-MM-DD HH:mm)
      lastModified: lastModified, // Last modified timestamp (YYYY-MM-DD HH:mm)
      download_time: undefined, // Will be set by orchestrator
      archive: false, // Default: not archived (visible in timeline)
      hasTranscript: postData.transcript?.raw ? true : undefined,
      hasFormattedTranscript: postData.transcript?.formatted && postData.transcript.formatted.length > 0 ? true : undefined,
      videoId: postData.videoId,
      duration: postData.metadata.duration,
      tags: [
        `social/${postData.platform}`,
        ...(postData.ai?.topics || []).map(topic => `topic/${topic}`),
        ...contentHashtags, // Add extracted hashtags from content
      ],
      ai_summary: postData.ai?.summary,
      sentiment: postData.ai?.sentiment,
      topics: postData.ai?.topics,
    };
  }

  /**
   * Generate full markdown document with frontmatter
   */
  generateFullDocument(frontmatter: YamlFrontmatter, content: string): string {
    const yamlLines = Object.entries(frontmatter)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          if (value.length === 0) return null;
          return `${key}:\n${value.map(v => `  - ${this.formatYamlValue(v)}`).join('\n')}`;
        }
        return `${key}: ${this.formatYamlValue(value)}`;
      })
      .filter(Boolean)
      .join('\n');

    return `---
${yamlLines}
---

${content}`;
  }

  /**
   * Format value for YAML
   */
  private formatYamlValue(value: any): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string' && (value.includes(':') || value.includes('#'))) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }

    return String(value);
  }
}
