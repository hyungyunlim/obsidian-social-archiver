import { type TFile, type Vault } from 'obsidian';
import type { PostData, Comment } from '../../../types/post';
import type { YamlFrontmatter } from '../../../types/archive';

/**
 * PostDataParser - Handles parsing of archived posts from vault files
 * Single Responsibility: Parse markdown files into PostData objects
 */
export class PostDataParser {
  constructor(
    private vault: Vault
  ) {}

  /**
   * Load all posts from the specified archive path
   */
  async loadFromVault(archivePath: string): Promise<PostData[]> {
    console.log('[PostDataParser] Loading posts from:', archivePath);

    const allFiles = this.vault.getMarkdownFiles();

    const archiveFiles = allFiles.filter(file =>
      file.path.startsWith(archivePath)
    );

    console.log(`[PostDataParser] Found ${archiveFiles.length} files in ${archivePath}`);

    const loadedPosts: PostData[] = [];

    for (const file of archiveFiles) {
      try {
        const postData = await this.parseFile(file);
        if (postData) {
          loadedPosts.push(postData);
        }
      } catch (err) {
        console.warn(`[PostDataParser] Failed to load ${file.path}:`, err);
      }
    }

    console.log(`[PostDataParser] Successfully loaded ${loadedPosts.length} posts`);
    return loadedPosts;
  }

  /**
   * Parse a single file into PostData
   */
  private async parseFile(file: TFile): Promise<PostData | null> {
    try {
      console.log('[PostDataParser] Loading file:', file.path);

      // Read file content directly to avoid stale cache
      const content = await this.vault.read(file);

      // Parse frontmatter from file content
      const frontmatter = this.parseFrontmatter(content);

      if (!frontmatter || !frontmatter.platform) {
        console.log('[PostDataParser] No frontmatter or platform, skipping');
        return null;
      }
      const contentText = this.extractContentText(content);
      const metadata = this.extractMetadata(content);
      const mediaUrls = this.extractMedia(content);
      const comments = this.extractComments(content);

      const publishedDate = frontmatter.published ? new Date(frontmatter.published) : undefined;
      const archivedDate = frontmatter.archived ? new Date(frontmatter.archived) : undefined;

      const postData: PostData = {
        platform: frontmatter.platform as any,
        id: file.basename,
        url: frontmatter.originalUrl || '',
        videoId: (frontmatter as any).videoId, // YouTube video ID
        filePath: file.path, // Store file path for opening
        comment: frontmatter.comment, // User's personal note
        like: frontmatter.like, // User's personal like
        archive: frontmatter.archive, // Archive status
        publishedDate: publishedDate,
        archivedDate: archivedDate,
        author: {
          name: frontmatter.author || 'Unknown',
          url: frontmatter.authorUrl || '',
        },
        content: {
          text: contentText,
        },
        media: mediaUrls.map(url => ({ type: 'image' as const, url })),
        metadata: {
          timestamp: new Date(frontmatter.published || frontmatter.archived || file.stat.ctime),
          likes: metadata.likes,
          comments: metadata.comments,
          shares: metadata.shares,
          views: metadata.views,
        },
        comments: comments.length > 0 ? comments : undefined,
      };

      console.log('[PostDataParser] Loaded post:', postData.platform, postData.id);

      return postData;
    } catch (err) {
      console.warn(`[PostDataParser] Failed to load ${file.path}:`, err);
      return null;
    }
  }

  /**
   * Extract content text from markdown, removing frontmatter and metadata
   */
  extractContentText(markdown: string): string {
    // Remove frontmatter
    const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Split into sections by horizontal rules
    const sections = withoutFrontmatter.split(/\n---+\n/);

    // Get the first section (before any horizontal rules)
    const contentSection = sections[0] || '';

    // Remove common markdown headers and metadata
    const lines = contentSection.split('\n');
    const contentLines: string[] = [];
    let contentStarted = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip headers and metadata at the beginning
      if (!contentStarted) {
        if (!trimmed ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('**Platform:**') ||
            trimmed.startsWith('![')) {
          continue;
        }
        contentStarted = true;
      }

      // Stop at metadata footer
      if (trimmed.startsWith('**Platform:**') ||
          trimmed.startsWith('**Original URL:**') ||
          trimmed.startsWith('**Published:**')) {
        break;
      }

      contentLines.push(line);
    }

    return contentLines.join('\n').trim();
  }

  /**
   * Extract metadata from markdown footer (Likes, Comments, Shares, Views)
   */
  extractMetadata(markdown: string): { likes?: number; comments?: number; shares?: number; views?: number } {
    const metadata: { likes?: number; comments?: number; shares?: number; views?: number } = {};

    // Find metadata footer: **Likes:** 6 | **Comments:** 3 | **Shares:** 1
    const metadataRegex = /\*\*Likes:\*\*\s*(\d+)|\*\*Comments:\*\*\s*(\d+)|\*\*Shares:\*\*\s*(\d+)|\*\*Views:\*\*\s*(\d+)/g;

    let match;
    while ((match = metadataRegex.exec(markdown)) !== null) {
      if (match[1]) metadata.likes = parseInt(match[1]);
      if (match[2]) metadata.comments = parseInt(match[2]);
      if (match[3]) metadata.shares = parseInt(match[3]);
      if (match[4]) metadata.views = parseInt(match[4]);
    }

    return metadata;
  }

  /**
   * Extract media URLs from markdown
   */
  extractMedia(markdown: string): string[] {
    const mediaUrls: string[] = [];

    // Match ![image N](path) format
    const imageRegex = /!\[.*?\]\((.*?)\)/g;

    let match;
    while ((match = imageRegex.exec(markdown)) !== null) {
      const url = match[1];
      // Include all relative paths (not starting with http:// or https://)
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        mediaUrls.push(url);
      }
    }

    return mediaUrls;
  }

  /**
   * Extract comments from markdown
   */
  extractComments(markdown: string): Comment[] {
    const comments: Comment[] = [];

    // Find comments section
    const commentsMatch = markdown.match(/## 💬 Comments\n\n([\s\S]*?)(?=\n---\n\n\*\*Platform:|$)/);
    if (!commentsMatch || !commentsMatch[1]) {
      return comments;
    }

    const commentsSection = commentsMatch[1];

    // Split by comment separator (--- between comments)
    const commentBlocks = commentsSection.split(/\n---\n\n/).filter(block => block.trim());

    for (const block of commentBlocks) {
      const lines = block.split('\n');
      if (lines.length === 0 || !lines[0]) continue;

      // Parse main comment header: **[@username](url)** [· timestamp] [· likes]
      // Timestamp is optional since Instagram comments don't have timestamp from API
      const headerMatch = lines[0].match(/\*\*\[?@?([^\]]*)\]?\(?([^)]*)\)?\*\*(?:(?: · ([^·\n]+))?)(?: · (\d+) likes)?/);
      if (!headerMatch) continue;

      const [, username, url, timestamp, likesStr] = headerMatch;

      // Extract comment content (lines after header, before any replies)
      const contentLines: string[] = [];
      let i = 1;
      while (i < lines.length) {
        const line = lines[i];
        if (!line || line.trim().startsWith('↳')) break;
        contentLines.push(line);
        i++;
      }
      const content = contentLines.join('\n').trim();

      // Parse replies (lines starting with ↳)
      const replies: Comment[] = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine && currentLine.trim().startsWith('↳')) {
          // Reply header: ↳ **[@username](url)** [· timestamp] [· likes]
          const replyHeaderMatch = currentLine.match(/↳ \*\*\[?@?([^\]]*)\]?\(?([^)]*)\)?\*\*(?:(?: · ([^·\n]+))?)(?: · (\d+) likes)?/);
          if (replyHeaderMatch) {
            const [, replyUsername, replyUrl, replyTimestamp, replyLikesStr] = replyHeaderMatch;
            i++;

            // Get reply content (lines starting with "  " but not "  ↳")
            const replyContentLines: string[] = [];
            while (i < lines.length) {
              const line = lines[i];
              if (!line || !line.startsWith('  ') || line.trim().startsWith('↳')) break;
              replyContentLines.push(line.substring(2)); // Remove the 2-space indent
              i++;
            }
            const replyContent = replyContentLines.join('\n').trim();

            replies.push({
              id: `reply-${Date.now()}-${Math.random()}`,
              author: {
                name: replyUsername || 'Unknown',
                url: replyUrl || '',
                username: replyUsername,
              },
              content: replyContent,
              timestamp: replyTimestamp?.trim() || undefined,
              likes: replyLikesStr ? parseInt(replyLikesStr) : undefined,
            });
          } else {
            i++;
          }
        } else {
          i++;
        }
      }

      comments.push({
        id: `comment-${Date.now()}-${Math.random()}`,
        author: {
          name: username || 'Unknown',
          url: url || '',
          username: username,
        },
        content,
        timestamp: timestamp?.trim() || undefined,
        likes: likesStr ? parseInt(likesStr) : undefined,
        replies: replies.length > 0 ? replies : undefined,
      });
    }

    return comments;
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontmatter(markdown: string): YamlFrontmatter | null {
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch || !frontmatterMatch[1]) {
      return null;
    }

    const frontmatterText = frontmatterMatch[1];
    const lines = frontmatterText.split('\n');
    const frontmatter: any = {};

    let currentKey: string | null = null;
    let currentArray: string[] = [];

    for (const line of lines) {
      // Array item: "  - value"
      if (line.startsWith('  - ')) {
        const value = line.substring(4).trim();
        currentArray.push(value);
        continue;
      }

      // If we were building an array, save it
      if (currentKey && currentArray.length > 0) {
        frontmatter[currentKey] = currentArray;
        currentArray = [];
        currentKey = null;
      }

      // Key-value pair: "key: value"
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1];
        const value = match[2];
        currentKey = key;

        // Remove quotes if present (handle both regular and JSON-escaped quotes)
        let cleanValue = value.trim();

        // If value is JSON-stringified (starts and ends with quotes)
        if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
            (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
          try {
            // Try to parse as JSON to handle escaped characters
            cleanValue = JSON.parse(cleanValue);
          } catch {
            // If JSON parsing fails, just remove the quotes
            cleanValue = cleanValue.slice(1, -1);
          }
        }

        // Check if this starts an array (value is empty, next line will have array items)
        if (cleanValue === '') {
          currentArray = [];
        } else {
          // Parse value
          if (cleanValue === 'true') {
            frontmatter[key] = true;
          } else if (cleanValue === 'false') {
            frontmatter[key] = false;
          } else if (!isNaN(Number(cleanValue)) && cleanValue !== '') {
            frontmatter[key] = Number(cleanValue);
          } else {
            frontmatter[key] = cleanValue;
          }

          // Debug log for comment field
          if (key === 'comment') {
            console.log('[PostDataParser] Loaded comment:', cleanValue);
          }

          currentKey = null;
        }
      }
    }

    // Save last array if any
    if (currentKey && currentArray.length > 0) {
      frontmatter[currentKey] = currentArray;
    }

    return frontmatter as YamlFrontmatter;
  }
}
