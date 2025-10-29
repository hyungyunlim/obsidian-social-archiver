import type { IService } from './base/IService';
import type { PostData, Platform } from '@/types/post';
import type { YamlFrontmatter } from '@/types/archive';
import { TemplateEngine } from './markdown/template/TemplateEngine';
import { DateNumberFormatter } from './markdown/formatters/DateNumberFormatter';
import { MediaFormatter } from './markdown/formatters/MediaFormatter';
import { TextFormatter } from './markdown/formatters/TextFormatter';
import { TranscriptFormatter } from './markdown/formatters/TranscriptFormatter';
import { CommentFormatter } from './markdown/formatters/CommentFormatter';
import { FactCheckFormatter } from './markdown/formatters/FactCheckFormatter';
import { FrontmatterGenerator } from './markdown/frontmatter/FrontmatterGenerator';

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
 * Single Responsibility: Markdown generation orchestration using specialized formatters
 */
export class MarkdownConverter implements IService {
  private templates: Map<Platform, string>;

  // Formatters
  private dateNumberFormatter: DateNumberFormatter;
  private mediaFormatter: MediaFormatter;
  private textFormatter: TextFormatter;
  private transcriptFormatter: TranscriptFormatter;
  private commentFormatter: CommentFormatter;
  private factCheckFormatter: FactCheckFormatter;
  private frontmatterGenerator: FrontmatterGenerator;

  constructor() {
    this.templates = new Map(Object.entries(DEFAULT_TEMPLATES) as [Platform, string][]);

    // Initialize formatters
    this.dateNumberFormatter = new DateNumberFormatter();
    this.textFormatter = new TextFormatter();
    this.mediaFormatter = new MediaFormatter(this.dateNumberFormatter);
    this.transcriptFormatter = new TranscriptFormatter();
    this.commentFormatter = new CommentFormatter(this.dateNumberFormatter, this.textFormatter);
    this.factCheckFormatter = new FactCheckFormatter();
    this.frontmatterGenerator = new FrontmatterGenerator(this.dateNumberFormatter, this.textFormatter);
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
    this.dateNumberFormatter.setDateFormat(formatter);
  }

  /**
   * Convert PostData to Markdown
   */
  async convert(postData: PostData, customTemplate?: string): Promise<MarkdownResult> {
    // Generate frontmatter
    const frontmatter = this.frontmatterGenerator.generateFrontmatter(postData);

    // Get template
    const template = customTemplate || this.templates.get(postData.platform) || DEFAULT_TEMPLATES[postData.platform];

    // Prepare template data
    const templateData = this.prepareTemplateData(postData);

    // Process template
    const content = TemplateEngine.process(template, templateData);

    // Generate full document
    const fullDocument = this.frontmatterGenerator.generateFullDocument(frontmatter, content);

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
      fullDocument: this.frontmatterGenerator.generateFullDocument(markdown.frontmatter, markdown.content),
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
      ? this.transcriptFormatter.formatTranscript(postData.transcript, postData.videoId, hasRawTranscript, hasFormattedTranscript)
      : undefined;

    return {
      ...postData,
      authorMention,
      content: {
        ...postData.content,
        text: postData.platform === 'instagram'
          ? this.textFormatter.linkifyInstagramMentions(postData.content.text)
          : postData.platform === 'youtube' && postData.videoId
          ? this.textFormatter.linkifyYouTubeTimestamps(postData.content.text, postData.videoId)
          : postData.content.text,
      },
      metadata: {
        timestamp: this.dateNumberFormatter.formatDate(postData.metadata.timestamp),
        editedAt: postData.metadata.editedAt ? this.dateNumberFormatter.formatDate(postData.metadata.editedAt) : undefined,
        likes: postData.metadata.likes ? this.dateNumberFormatter.formatNumber(postData.metadata.likes) : undefined,
        comments: postData.metadata.comments ? this.dateNumberFormatter.formatNumber(postData.metadata.comments) : undefined,
        shares: postData.metadata.shares ? this.dateNumberFormatter.formatNumber(postData.metadata.shares) : undefined,
        views: postData.metadata.views ? this.dateNumberFormatter.formatNumber(postData.metadata.views) : undefined,
        duration: postData.metadata.duration ? this.dateNumberFormatter.formatDuration(postData.metadata.duration) : undefined,
      },
      media: this.mediaFormatter.formatMedia(postData.media, postData.platform, postData.url),
      comments: this.commentFormatter.formatComments(postData.comments, postData.platform),
      transcript: formattedTranscript,  // Formatted transcript for YouTube
      ai: postData.ai ? {
        ...postData.ai,
        factCheck: this.factCheckFormatter.formatFactChecks(postData.ai.factCheck),
      } : undefined,
    };
  }
}
