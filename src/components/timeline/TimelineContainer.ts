import type { TFile, Vault, App } from 'obsidian';
import type { PostData } from '../../types/post';
import type { YamlFrontmatter } from '../../types/archive';

export interface TimelineContainerProps {
  vault: Vault;
  app: App;
  archivePath: string;
}

/**
 * Timeline Container - Pure TypeScript implementation
 * Renders archived social media posts in a chronological timeline
 */
export class TimelineContainer {
  private vault: Vault;
  private app: App;
  private archivePath: string;
  private containerEl: HTMLElement;

  private posts: PostData[] = [];
  private searchQuery: string = '';

  constructor(target: HTMLElement, props: TimelineContainerProps) {
    this.containerEl = target;
    this.vault = props.vault;
    this.app = props.app;
    this.archivePath = props.archivePath;

    this.render();
    this.loadPosts();
  }

  private render(): void {
    // Add Tailwind classes individually
    this.containerEl.className = 'w-full h-full overflow-y-auto p-4';
    this.renderLoading();
  }

  private renderLoading(): void {
    this.containerEl.empty();

    const loading = this.containerEl.createDiv({
      cls: 'flex flex-col items-center justify-center min-h-[300px] text-[var(--text-muted)]'
    });

    const spinner = loading.createDiv({ cls: 'timeline-loading-spinner' });
    loading.createEl('p', {
      text: 'Loading archived posts...',
      cls: 'mt-4'
    });
  }

  private renderError(message: string): void {
    this.containerEl.empty();

    const errorDiv = this.containerEl.createDiv({
      cls: 'flex flex-col items-center justify-center min-h-[300px] text-center'
    });

    errorDiv.createEl('p', {
      text: '⚠️',
      cls: 'text-5xl mb-4'
    });

    errorDiv.createEl('p', {
      text: message,
      cls: 'text-[var(--text-muted)] mb-4'
    });

    const retryBtn = errorDiv.createEl('button', {
      text: 'Retry',
      cls: 'px-4 py-2 bg-[var(--interactive-accent)] text-[var(--text-on-accent)] rounded hover:bg-[var(--interactive-accent-hover)] cursor-pointer'
    });
    retryBtn.addEventListener('click', () => this.loadPosts());
  }

  private renderEmpty(): void {
    this.containerEl.empty();

    const emptyDiv = this.containerEl.createDiv({
      cls: 'flex flex-col items-center justify-center min-h-[300px] text-center text-[var(--text-muted)]'
    });

    emptyDiv.createEl('p', {
      text: '📭',
      cls: 'text-5xl mb-4'
    });

    emptyDiv.createEl('h3', {
      text: 'No archived posts yet',
      cls: 'text-xl font-semibold mb-2 text-[var(--text-normal)]'
    });

    emptyDiv.createEl('p', {
      text: 'Archive your first social media post to see it here!'
    });
  }

  private renderPosts(): void {
    this.containerEl.empty();

    // Search filter
    const filters = this.containerEl.createDiv({ cls: 'mb-6' });
    const searchInput = filters.createEl('input', {
      type: 'text',
      placeholder: 'Search posts...',
      cls: 'w-full px-4 py-3 rounded-lg border border-[var(--background-modifier-border)] bg-[var(--background-primary)] text-[var(--text-normal)] focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-2 focus:ring-[var(--interactive-accent-hover)]'
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.renderPosts();
    });

    // Filter posts
    const filtered = this.filterPosts(this.posts, this.searchQuery);
    const grouped = this.groupPostsByDate(filtered);

    // Render grouped posts
    const grid = this.containerEl.createDiv({ cls: 'flex flex-col gap-8' });

    for (const [groupLabel, groupPosts] of grouped) {
      const group = grid.createDiv({ cls: 'timeline-group' });

      group.createEl('h3', {
        text: groupLabel,
        cls: 'text-xl font-semibold mb-4 pb-2 border-b-2 border-[var(--background-modifier-border)] text-[var(--text-normal)]'
      });

      const postsContainer = group.createDiv({
        cls: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
      });

      for (const post of groupPosts) {
        this.renderPostCard(postsContainer, post);
      }
    }
  }

  private renderPostCard(container: HTMLElement, post: PostData): void {
    const card = container.createDiv({
      cls: 'p-4 rounded-lg border border-[var(--background-modifier-border)] bg-[var(--background-primary)] hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer'
    });

    // Platform badge
    const badge = card.createDiv({
      cls: 'inline-block px-3 py-1 rounded text-xs font-semibold uppercase mb-3 timeline-platform-badge'
    });
    badge.setAttribute('data-platform', post.platform);
    badge.setText(post.platform);

    // Author
    const author = card.createDiv({ cls: 'mb-2 text-[var(--text-normal)]' });
    author.createEl('strong', { text: post.author.name });

    // Content preview
    const content = card.createDiv({
      cls: 'mb-3 text-sm leading-relaxed text-[var(--text-muted)] line-clamp-4'
    });
    const preview = post.content.text.substring(0, 200);
    content.setText(preview + (post.content.text.length > 200 ? '...' : ''));

    // Metadata
    const meta = card.createDiv({
      cls: 'flex gap-4 text-xs text-[var(--text-faint)]'
    });

    const date = new Date(post.metadata.timestamp);
    meta.createSpan({ text: date.toLocaleDateString() });

    if (post.metadata.likes) {
      meta.createSpan({ text: `❤️ ${post.metadata.likes}` });
    }
    if (post.metadata.comments) {
      meta.createSpan({ text: `💬 ${post.metadata.comments}` });
    }
  }

  private async loadPosts(): Promise<void> {
    try {
      this.renderLoading();

      const allFiles = this.vault.getMarkdownFiles();
      const archiveFiles = allFiles.filter(file =>
        file.path.startsWith(this.archivePath)
      );

      console.log(`[Timeline] Found ${archiveFiles.length} files in ${this.archivePath}`);

      const loadedPosts: PostData[] = [];

      for (const file of archiveFiles) {
        try {
          const postData = await this.loadPostFromFile(file);
          if (postData) {
            loadedPosts.push(postData);
          }
        } catch (err) {
          console.warn(`[Timeline] Failed to load ${file.path}:`, err);
        }
      }

      // Sort by timestamp (newest first)
      loadedPosts.sort((a, b) =>
        new Date(b.metadata.timestamp).getTime() -
        new Date(a.metadata.timestamp).getTime()
      );

      this.posts = loadedPosts;

      console.log(`[Timeline] Loaded ${this.posts.length} posts`);

      if (this.posts.length === 0) {
        this.renderEmpty();
      } else {
        this.renderPosts();
      }

    } catch (err) {
      console.error('[Timeline] Failed to load posts:', err);
      this.renderError(err instanceof Error ? err.message : 'Failed to load posts');
    }
  }

  private async loadPostFromFile(file: TFile): Promise<PostData | null> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter as YamlFrontmatter | undefined;

      if (!frontmatter || !frontmatter.platform) {
        return null;
      }

      const content = await this.vault.read(file);
      const contentText = this.extractContentText(content);

      const postData: PostData = {
        platform: frontmatter.platform as any,
        id: file.basename,
        url: frontmatter.originalUrl || '',
        author: {
          name: frontmatter.author || 'Unknown',
          url: frontmatter.authorUrl || '',
        },
        content: {
          text: contentText,
        },
        media: [],
        metadata: {
          timestamp: new Date(frontmatter.archived || file.stat.ctime),
          likes: (frontmatter as any).likes,
          comments: (frontmatter as any).comments,
          shares: (frontmatter as any).shares,
          views: (frontmatter as any).views,
        },
      };

      return postData;
    } catch (err) {
      console.warn(`[Timeline] Failed to load ${file.path}:`, err);
      return null;
    }
  }

  private extractContentText(markdown: string): string {
    const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
    const lines = withoutFrontmatter.split('\n');
    const contentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('**Platform:**')) {
        if (contentLines.length > 0) break;
        continue;
      }

      contentLines.push(line);

      if (contentLines.length > 0 && !trimmed) {
        break;
      }
    }

    return contentLines.join('\n').trim();
  }

  private filterPosts(posts: PostData[], query: string): PostData[] {
    if (!query.trim()) return posts;

    const q = query.toLowerCase();
    return posts.filter(post =>
      post.content.text.toLowerCase().includes(q) ||
      post.author.name.toLowerCase().includes(q)
    );
  }

  private groupPostsByDate(posts: PostData[]): Map<string, PostData[]> {
    const grouped = new Map<string, PostData[]>();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    for (const post of posts) {
      const postDate = new Date(post.metadata.timestamp);
      const postDay = new Date(
        postDate.getFullYear(),
        postDate.getMonth(),
        postDate.getDate()
      );

      let groupLabel: string;

      if (postDay.getTime() === today.getTime()) {
        groupLabel = 'Today';
      } else if (postDay.getTime() === yesterday.getTime()) {
        groupLabel = 'Yesterday';
      } else if (postDate >= thisWeek) {
        groupLabel = 'This Week';
      } else {
        groupLabel = postDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }

      if (!grouped.has(groupLabel)) {
        grouped.set(groupLabel, []);
      }
      grouped.get(groupLabel)!.push(post);
    }

    return grouped;
  }

  public destroy(): void {
    this.containerEl.empty();
  }
}
