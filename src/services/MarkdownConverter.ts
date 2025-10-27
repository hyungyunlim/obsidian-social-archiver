import type { IService } from './base/IService';
import type { PostData, Platform } from '@/types/post';
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
    return template.replace(CONDITIONAL_PATTERN, (match, condition, content) => {
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
    return template.replace(TEMPLATE_VAR_PATTERN, (match, path) => {
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
      return value.join(', ');
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
  facebook: `# {{author.name}}

**Platform:** Facebook
**Published:** {{metadata.timestamp}}
**Original URL:** [View Post]({{url}})

{{#if author.verified}}✓ Verified Account{{/if}}

---

{{content.text}}

{{#if media}}
## Media

{{media}}
{{/if}}

{{#if metadata.likes}}
**Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}{{#if metadata.shares}} | **Shares:** {{metadata.shares}}{{/if}}

{{#if ai}}
---

## AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}

{{#if ai.factCheck}}
### Fact Checks
{{ai.factCheck}}
{{/if}}
{{/if}}
`,

  linkedin: `# {{author.name}}

**Platform:** LinkedIn
**Published:** {{metadata.timestamp}}
**Original URL:** [View Post]({{url}})

{{#if author.verified}}✓ Verified Account{{/if}}

---

{{content.text}}

{{#if media}}
## Media

{{media}}
{{/if}}

{{#if metadata.likes}}
**Reactions:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}

{{#if ai}}
---

## AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}
{{/if}}
`,

  instagram: `# {{author.name}}

**Platform:** Instagram
**Published:** {{metadata.timestamp}}
**Original URL:** [View Post]({{url}})

{{#if author.verified}}✓ Verified Account{{/if}}

---

{{content.text}}

{{#if media}}
## Media

{{media}}
{{/if}}

{{#if metadata.likes}}
**Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}

{{#if ai}}
---

## AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}
{{/if}}
`,

  tiktok: `# {{author.name}}

**Platform:** TikTok
**Published:** {{metadata.timestamp}}
**Original URL:** [View Post]({{url}})

{{#if author.verified}}✓ Verified Account{{/if}}

---

{{content.text}}

{{#if media}}
## Media

{{media}}
{{/if}}

{{#if metadata.views}}
**Views:** {{metadata.views}}{{/if}}{{#if metadata.likes}} | **Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Comments:** {{metadata.comments}}{{/if}}

{{#if ai}}
---

## AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}
{{/if}}
`,

  x: `# {{author.name}}

**Platform:** X (Twitter)
**Published:** {{metadata.timestamp}}
**Original URL:** [View Post]({{url}})

{{#if author.verified}}✓ Verified Account{{/if}}

---

{{content.text}}

{{#if media}}
## Media

{{media}}
{{/if}}

{{#if metadata.likes}}
**Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Replies:** {{metadata.comments}}{{/if}}{{#if metadata.shares}} | **Retweets:** {{metadata.shares}}{{/if}}

{{#if ai}}
---

## AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}
{{/if}}
`,

  threads: `# {{author.name}}

**Platform:** Threads
**Published:** {{metadata.timestamp}}
**Original URL:** [View Post]({{url}})

{{#if author.verified}}✓ Verified Account{{/if}}

---

{{content.text}}

{{#if media}}
## Media

{{media}}
{{/if}}

{{#if metadata.likes}}
**Likes:** {{metadata.likes}}{{/if}}{{#if metadata.comments}} | **Replies:** {{metadata.comments}}{{/if}}

{{#if ai}}
---

## AI Analysis

**Summary:** {{ai.summary}}

**Sentiment:** {{ai.sentiment}}

**Topics:** {{ai.topics}}
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
export class MarkdownConverter implements IService<MarkdownResult> {
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
   * Generate YAML frontmatter
   */
  private generateFrontmatter(postData: PostData): YamlFrontmatter {
    return {
      share: false,
      platform: postData.platform,
      author: postData.author.name,
      authorUrl: postData.author.url,
      originalUrl: postData.url,
      archived: new Date(),
      lastModified: new Date(),
      credits_used: 0, // Will be set by orchestrator
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
    return {
      ...postData,
      metadata: {
        ...postData.metadata,
        timestamp: this.formatDate(postData.metadata.timestamp),
        editedAt: postData.metadata.editedAt ? this.formatDate(postData.metadata.editedAt) : undefined,
      },
      media: this.formatMedia(postData.media),
      ai: postData.ai ? {
        ...postData.ai,
        factCheck: this.formatFactChecks(postData.ai.factCheck),
      } : undefined,
    };
  }

  /**
   * Format date using custom formatter or default
   * Handles both Date objects and ISO string timestamps
   */
  private formatDate(date: Date | string): string {
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (this.customDateFormat) {
      return this.customDateFormat(dateObj);
    }

    // Default format: YYYY-MM-DD HH:mm
    return dateObj.toISOString().replace('T', ' ').slice(0, 16);
  }

  /**
   * Format media items for markdown
   */
  private formatMedia(media: PostData['media']): string {
    if (!media || media.length === 0) {
      return '';
    }

    return media
      .map((item, index) => {
        const alt = item.alt || `${item.type} ${index + 1}`;

        if (item.type === 'image') {
          return `![${this.escapeMarkdown(alt)}](${item.url})`;
        } else if (item.type === 'video') {
          const thumbnail = item.thumbnailUrl ? `![Thumbnail](${item.thumbnailUrl})` : '';
          return `${thumbnail}\n[🎥 Video](${item.url})`;
        } else if (item.type === 'audio') {
          return `[🎵 Audio](${item.url})`;
        } else {
          return `[📄 Document](${item.url})`;
        }
      })
      .join('\n\n');
  }

  /**
   * Format fact checks for markdown
   */
  private formatFactChecks(factChecks: PostData['ai']['factCheck']): string {
    if (!factChecks || factChecks.length === 0) {
      return '';
    }

    return factChecks
      .map((check, index) => {
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
