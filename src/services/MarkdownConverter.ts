import type { IService } from './base/IService';
import type { PostData, Platform, FactCheckResult } from '@/types/post';
import type { YamlFrontmatter } from '@/types/archive';

/**
 * Template variable pattern: {{variable}} or {{object.property}}
 */
const TEMPLATE_VAR_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Conditional block pattern: {{#if condition}}...{{/if}}
 */
const CONDITIONAL_PATTERN = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

/**
 * Template engine for variable substitution and conditional rendering
 */
class TemplateEngine {
  /**
   * Process template with data
   */
  static process(template: string, data: Record<string, any>): string {
    let result = template;

    // Process conditional blocks first
    result = this.processConditionals(result, data);

    // Process variable substitution
    result = this.processVariables(result, data);

    return result;
  }

  /**
   * Process conditional blocks
   */
  private static processConditionals(template: string, data: Record<string, any>): string {
    return template.replace(CONDITIONAL_PATTERN, (_match, condition, content) => {
      const value = this.resolveValue(condition.trim(), data);

      // Truthy check
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        return content;
      }

      return '';
    });
  }

  /**
   * Process variable substitution
   */
  private static processVariables(template: string, data: Record<string, any>): string {
    return template.replace(TEMPLATE_VAR_PATTERN, (_match, path) => {
      const value = this.resolveValue(path.trim(), data);
      return this.formatValue(value);
    });
  }

  /**
   * Resolve nested property path
   */
  private static resolveValue(path: string, data: Record<string, any>): any {
    const keys = path.split('.');
    let value: any = data;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return '';
      }
      value = value[key];
    }

    return value;
  }

  /**
   * Format value for output
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      // Format arrays as markdown list (one item per line)
      return value.map(item => `- ${String(item)}`).join('\n');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }
}

/**
 * Default markdown templates for each platform
 */
const DEFAULT_TEMPLATES: Record<Platform, string> = {
  facebook: `{{content.text}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

{{#if ai}}

---

## 🤖 AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}

### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}

---

**Platform:** Facebook{{#if author.verified}} ✓{{/if}} | **Author:** [{{author.name}}]({{author.url}}) | **Published:** {{metadata.timestamp}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}{{#if metadata.shares}} | **Shares:** {{metadata.shares}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,

  linkedin: `{{content.text}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

{{#if ai}}

---

## 🤖 AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}

### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}

---

**Platform:** LinkedIn{{#if author.verified}} ✓{{/if}} | **Author:** [{{author.name}}]({{author.url}}) | **Published:** {{metadata.timestamp}}{{#if metadata.likes}} | **Reactions:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,

  instagram: `{{content.text}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

{{#if ai}}

---

## 🤖 AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}

### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}

---

**Platform:** Instagram{{#if author.verified}} ✓{{/if}} | **Author:** {{authorMention}} | **Published:** {{metadata.timestamp}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,

  tiktok: `{{content.text}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

{{#if ai}}

---

## 🤖 AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}

### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}

---

**Platform:** TikTok{{#if author.verified}} ✓{{/if}} | **Author:** [{{author.name}}]({{author.url}}) | **Published:** {{metadata.timestamp}}{{#if metadata.views}} | **Views:** {{metadata.views}}{{/if}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,

  x: `{{content.text}}

{{#if metadata.externalLink}}

🔗 **Link:** [{{metadata.externalLink}}]({{metadata.externalLink}})
{{/if}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

{{#if ai}}

---

## 🤖 AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}

### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}

---

**Platform:** X (Twitter){{#if author.verified}} ✓{{/if}} | **Author:** [{{author.name}}]({{author.url}}) | **Published:** {{metadata.timestamp}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Replies:** {{metadata.comments}}{{/if}}{{#if metadata.shares}} | **Retweets:** {{metadata.shares}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,

  threads: `{{content.text}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

{{#if ai}}

---

## 🤖 AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}

### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}

---

**Platform:** Threads{{#if author.verified}} ✓{{/if}} | **Author:** [{{author.name}}]({{author.url}}) | **Published:** {{metadata.timestamp}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Replies:** {{metadata.comments}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,

  youtube: `{{content.text}}

{{#if media}}

---

{{media}}
{{/if}}

{{#if transcript}}

---

## 📝 Transcript

{{transcript}}
{{/if}}

{{#if comments}}

---

## 💬 Comments

{{comments}}
{{/if}}

---

**Platform:** YouTube{{#if author.verified}} ✓{{/if}} | **Channel:** [{{author.name}}]({{author.url}}) | **Published:** {{metadata.timestamp}}{{#if metadata.views}} | **Views:** {{metadata.views}}{{/if}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}{{#if metadata.duration}} | **Duration:** {{metadata.duration}}{{/if}}

**Original URL:** {{url}}

{{#if mediaSourceUrls}}
**Original Media URLs:**
{{mediaSourceUrls}}
{{/if}}
`,
};

/**
 * Markdown conversion result
 */
export interface MarkdownResult {
  frontmatter: YamlFrontmatter;
  content: string;
  fullDocument: string;
}

/**
 * MarkdownConverter - Transforms PostData into Markdown format
 *
 * Single Responsibility: Markdown generation and template processing
 */
export class MarkdownConverter implements IService {
  private templates: Map<Platform, string>;
  private customDateFormat?: (date: Date) => string;

  constructor() {
    this.templates = new Map(Object.entries(DEFAULT_TEMPLATES) as [Platform, string][]);
  }

  async initialize(): Promise<void> {
    // No async initialization needed
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    return true;
  }

  /**
   * Set custom template for a platform
   */
  setTemplate(platform: Platform, template: string): void {
    this.templates.set(platform, template);
  }

  /**
   * Set custom date formatter
   */
  setDateFormat(formatter: (date: Date) => string): void {
    this.customDateFormat = formatter;
  }

  /**
   * Convert PostData to Markdown
   */
  async convert(postData: PostData, customTemplate?: string): Promise<MarkdownResult> {
    // Generate frontmatter
    const frontmatter = this.generateFrontmatter(postData);

    // Get template
    const template = customTemplate || this.templates.get(postData.platform) || DEFAULT_TEMPLATES[postData.platform];

    // Prepare template data
    const templateData = this.prepareTemplateData(postData);

    // Process template
    const content = TemplateEngine.process(template, templateData);

    // Generate full document
    const fullDocument = this.generateFullDocument(frontmatter, content);

    return {
      frontmatter,
      content,
      fullDocument,
    };
  }

  /**
   * Update full document with modified frontmatter
   */
  updateFullDocument(markdown: MarkdownResult): MarkdownResult {
    return {
      ...markdown,
      fullDocument: this.generateFullDocument(markdown.frontmatter, markdown.content),
    };
  }

  /**
   * Generate YAML frontmatter
   */
  private generateFrontmatter(postData: PostData): YamlFrontmatter {
    // Format as YYYY-MM-DD (split always returns valid string at index 0)
    const today = new Date().toISOString().split('T')[0]!;

    // Format original post date (YYYY-MM-DD HH:mm in local timezone)
    const published = this.formatDate(postData.metadata.timestamp);

    return {
      share: false,
      platform: postData.platform,
      author: postData.author.name,
      authorUrl: postData.author.url,
      originalUrl: postData.url,
      published: published, // Original post date
      archived: today, // Date when archived
      lastModified: today,
      download_time: undefined, // Will be set by orchestrator
      archive: false, // Default: not archived (visible in timeline)
      hasTranscript: postData.transcript?.raw ? true : undefined,
      hasFormattedTranscript: postData.transcript?.formatted && postData.transcript.formatted.length > 0 ? true : undefined,
      videoId: postData.videoId,
      duration: postData.metadata.duration,
      tags: [
        `social/${postData.platform}`,
        ...(postData.ai?.topics || []).map(topic => `topic/${topic}`),
      ],
      ai_summary: postData.ai?.summary,
      sentiment: postData.ai?.sentiment,
      topics: postData.ai?.topics,
    };
  }

  /**
   * Prepare data for template engine
   */
  private prepareTemplateData(postData: PostData): Record<string, any> {
    // Generate author mention for Instagram
    const authorMention = postData.platform === 'instagram' && postData.author.handle
      ? `[@${postData.author.handle}](https://instagram.com/${postData.author.handle})`
      : postData.author.name;

    // Format transcript for YouTube
    const hasRawTranscript = !!postData.transcript?.raw;
    const hasFormattedTranscript = !!postData.transcript?.formatted && postData.transcript.formatted.length > 0;
    const formattedTranscript = (hasRawTranscript || hasFormattedTranscript)
      ? this.formatTranscript(postData.transcript, postData.videoId, hasRawTranscript, hasFormattedTranscript)
      : undefined;

    return {
      ...postData,
      authorMention,
      content: {
        ...postData.content,
        text: postData.platform === 'instagram'
          ? this.linkifyInstagramMentions(postData.content.text)
          : postData.platform === 'youtube' && postData.videoId
          ? this.linkifyYouTubeTimestamps(postData.content.text, postData.videoId)
          : postData.content.text,
      },
      metadata: {
        timestamp: this.formatDate(postData.metadata.timestamp),
        editedAt: postData.metadata.editedAt ? this.formatDate(postData.metadata.editedAt) : undefined,
        likes: postData.metadata.likes ? this.formatNumber(postData.metadata.likes) : undefined,
        comments: postData.metadata.comments ? this.formatNumber(postData.metadata.comments) : undefined,
        shares: postData.metadata.shares ? this.formatNumber(postData.metadata.shares) : undefined,
        views: postData.metadata.views ? this.formatNumber(postData.metadata.views) : undefined,
      },
      media: this.formatMedia(postData.media, postData.platform, postData.url),
      comments: this.formatComments(postData.comments, postData.platform),
      transcript: formattedTranscript,  // Formatted transcript for YouTube
      ai: postData.ai ? {
        ...postData.ai,
        factCheck: this.formatFactChecks(postData.ai.factCheck),
      } : undefined,
    };
  }

  /**
   * Format number with thousand separators
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  /**
   * Format date using custom formatter or default
   * Handles both Date objects and ISO string timestamps
   */
  private formatDate(date: Date | string): string {
    // Return empty string if no date provided
    if (!date) {
      return '';
    }

    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return '';
    }

    if (this.customDateFormat) {
      return this.customDateFormat(dateObj);
    }

    // Default format: YYYY-MM-DD HH:mm (in local timezone)
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Format media items for markdown
   */
  private formatMedia(media: PostData['media'], platform: Platform, originalUrl: string): string {
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
          const duration = item.duration ? ` (${this.formatDuration(item.duration)})` : '';
          return `![🎥 Video${duration}](${item.url})`;
        } else if (item.type === 'audio') {
          // Embed audio inline
          const duration = item.duration ? ` (${this.formatDuration(item.duration)})` : '';
          return `![🎵 Audio${duration}](${item.url})`;
        } else {
          return `[📄 Document](${item.url})`;
        }
      })
      .join('\n\n');
  }

  /**
   * Format duration in seconds to human-readable format (e.g., "1:23" or "12:34:56")
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Convert milliseconds to seconds for YouTube URL timestamp parameter
   */
  private formatTimestampForUrl(milliseconds: number): number {
    return Math.floor(milliseconds / 1000);
  }

  /**
   * Format milliseconds to MM:SS or HH:MM:SS display format
   */
  private formatTimestampDisplay(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format YouTube transcript for markdown
   */
  private formatTranscript(transcript: PostData['transcript'], videoId: string | undefined, includeRaw: boolean, includeFormatted: boolean): string {
    if (!transcript || !videoId) {
      return '';
    }

    const parts: string[] = [];

    // Add raw transcript text FIRST (if both are enabled)
    if (includeRaw && transcript.raw) {
      parts.push('**Full Transcript:**\n\n' + transcript.raw);
    }

    // Add formatted transcript with clickable timestamps SECOND
    if (includeFormatted && transcript.formatted && transcript.formatted.length > 0) {
      const chapterLinks = transcript.formatted
        .map((entry) => {
          const timeDisplay = this.formatTimestampDisplay(entry.start_time);
          const timeSeconds = this.formatTimestampForUrl(entry.start_time);
          const url = `https://www.youtube.com/watch?v=${videoId}&t=${timeSeconds}s`;
          return `[${timeDisplay}](${url}) ${entry.text}`;
        })
        .join('\n');

      if (parts.length > 0) {
        parts.push('---\n\n**Chapter Links** (click to open at specific time):\n\n' + chapterLinks);
      } else {
        parts.push('**Chapter Links** (click to open at specific time):\n\n' + chapterLinks);
      }
    }

    if (parts.length === 0) {
      return '';
    }

    // Wrap in Obsidian callout for collapsible section
    return `> [!note]- Click to expand transcript\n>\n` +
      parts.join('\n\n').split('\n').map(line => `> ${line}`).join('\n');
  }

  /**
   * Format comments for markdown (nested style with indentation)
   */
  private formatComments(comments: PostData['comments'], platform: Platform): string {
    if (!comments || comments.length === 0) {
      return '';
    }

    try {
      return comments
        .map((comment) => {
          // Defensive checks
          if (!comment || !comment.author || !comment.content) {
            return '';
          }

          // Main comment - support both handle and username
          const authorHandle = comment.author.handle || comment.author.username;
          const authorName = authorHandle
            ? `@${authorHandle}`
            : comment.author.name;

          // Convert author name to link for Instagram
          const authorDisplay = authorHandle && platform === 'instagram'
            ? `[@${authorHandle}](https://instagram.com/${authorHandle})`
            : authorName;

          const timestamp = this.formatDate(comment.timestamp);
          const likes = comment.likes ? ` · ${comment.likes} likes` : '';

          // Convert @mentions in comment content to links for Instagram
          const commentContent = platform === 'instagram'
            ? this.linkifyInstagramMentions(comment.content)
            : comment.content;

          // Format header: author [· timestamp] [· likes]
          const timestampPart = timestamp ? ` · ${timestamp}` : '';
          let result = `**${authorDisplay}**${timestampPart}${likes}\n${commentContent}`;

          // Nested replies with indentation
          if (comment.replies && comment.replies.length > 0) {
            const formattedReplies = comment.replies
              .map((reply) => {
                if (!reply || !reply.author || !reply.content) {
                  return '';
                }
                const replyHandle = reply.author.handle || reply.author.username;
                const replyAuthor = replyHandle
                  ? `@${replyHandle}`
                  : reply.author.name;

                // Convert reply author to link for Instagram
                const replyAuthorDisplay = replyHandle && platform === 'instagram'
                  ? `[@${replyHandle}](https://instagram.com/${replyHandle})`
                  : replyAuthor;

                const replyTime = this.formatDate(reply.timestamp);
                const replyLikes = reply.likes ? ` · ${reply.likes} likes` : '';

                // Convert @mentions in reply content to links for Instagram
                // Pass isReply=true to remove redundant first @mention
                const replyContent = platform === 'instagram'
                  ? this.linkifyInstagramMentions(reply.content, true)
                  : reply.content;

                // Format reply header: author [· timestamp] [· likes]
                const replyTimePart = replyTime ? ` · ${replyTime}` : '';
                return `  ↳ **${replyAuthorDisplay}**${replyTimePart}${replyLikes}\n  ${replyContent}`;
              })
              .filter(r => r.length > 0)
              .join('\n\n');

            if (formattedReplies.length > 0) {
              result += '\n\n' + formattedReplies;
            }
          }

          return result;
        })
        .filter(c => c.length > 0)
        .join('\n\n---\n\n');
    } catch (error) {
      console.error('[MarkdownConverter] Error formatting comments:', error);
      return '';
    }
  }

  /**
   * Convert @mentions to Instagram profile links
   */
  private linkifyInstagramMentions(text: string, isReply: boolean = false): string {
    // For replies, remove the first @mention if it's at the start (it's redundant)
    let processedText = text;
    if (isReply) {
      processedText = text.replace(/^@[\w.]+\s*/, '');
    }

    // Match @username (Instagram usernames can contain letters, numbers, underscores, periods)
    // Don't match if already in a markdown link
    return processedText.replace(/@([\w.]+)(?!\])/g, (_match, username) => {
      return `[@${username}](https://instagram.com/${username})`;
    });
  }

  /**
   * Convert YouTube timestamps to clickable links
   * Example: "00:00 Introduction" -> "[00:00](https://www.youtube.com/watch?v=VIDEO_ID&t=0s) Introduction"
   */
  private linkifyYouTubeTimestamps(text: string, videoId: string): string {
    // Match timestamps at the beginning of lines: HH:MM:SS or MM:SS
    // Pattern: line start, optional whitespace, timestamp, space, description text
    return text.replace(/^(\s*)(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/gm, (_match, whitespace, timestamp, description) => {
      // Convert timestamp to seconds
      const parts = timestamp.split(':').map(Number);
      let seconds: number;

      if (parts.length === 3) {
        // HH:MM:SS format
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else {
        // MM:SS format
        seconds = parts[0] * 60 + parts[1];
      }

      // Create YouTube timestamp link (only timestamp is clickable, not description)
      const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
      return `${whitespace}[${timestamp}](${url}) ${description}`;
    });
  }

  /**
   * Format fact checks for markdown
   */
  private formatFactChecks(factChecks: FactCheckResult[] | undefined): string {
    if (!factChecks || factChecks.length === 0) {
      return '';
    }

    return factChecks
      .map((check: FactCheckResult, index: number) => {
        const icon = {
          true: '✅',
          false: '❌',
          misleading: '⚠️',
          unverifiable: '❓',
        }[check.verdict];

        return `**${index + 1}. ${icon} ${check.claim}**
- Verdict: ${check.verdict}
- Confidence: ${(check.confidence * 100).toFixed(0)}%
- Evidence: ${check.evidence}`;
      })
      .join('\n\n');
  }

  /**
   * Escape markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
  }

  /**
   * Generate full markdown document with frontmatter
   */
  private generateFullDocument(frontmatter: YamlFrontmatter, content: string): string {
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
