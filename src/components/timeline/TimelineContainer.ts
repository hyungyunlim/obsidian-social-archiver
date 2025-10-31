import { setIcon, type Vault, type App } from 'obsidian';
import type { PostData } from '../../types/post';
import type SocialArchiverPlugin from '../../main';
import {
  siFacebook,
  siInstagram,
  siTiktok,
  siX,
  siThreads,
  siYoutube,
  type PlatformIcon as SimpleIcon
} from '../../constants/platform-icons';
import { PostDataParser } from './parsers/PostDataParser';
import { FilterSortManager } from './filters/FilterSortManager';
import { FilterPanel } from './filters/FilterPanel';
import { SortDropdown } from './filters/SortDropdown';
import { MediaGalleryRenderer } from './renderers/MediaGalleryRenderer';
import { CommentRenderer } from './renderers/CommentRenderer';
import { YouTubeEmbedRenderer } from './renderers/YouTubeEmbedRenderer';
import { LinkPreviewRenderer } from './renderers/LinkPreviewRenderer';
import { PostCardRenderer } from './renderers/PostCardRenderer';
import { YouTubePlayerController } from './controllers/YouTubePlayerController';

export interface TimelineContainerProps {
  vault: Vault;
  app: App;
  archivePath: string;
  plugin: SocialArchiverPlugin;
}

/**
 * Timeline Container - Pure TypeScript implementation
 * Renders archived social media posts in a chronological timeline
 */
export class TimelineContainer {
  private vault: Vault;
  private app: App;
  private archivePath: string;
  private plugin: SocialArchiverPlugin;
  private containerEl: HTMLElement;

  private posts: PostData[] = [];
  private filteredPosts: PostData[] = [];

  // Parser for loading posts from vault
  private postDataParser: PostDataParser;

  // Filter and sort management
  private filterSortManager: FilterSortManager;
  private filterPanel: FilterPanel;
  private sortDropdown: SortDropdown;

  // Renderers
  private mediaGalleryRenderer: MediaGalleryRenderer;
  private commentRenderer: CommentRenderer;
  private youtubeEmbedRenderer: YouTubeEmbedRenderer;
  private linkPreviewRenderer: LinkPreviewRenderer;
  private postCardRenderer: PostCardRenderer;

  // Store YouTube player controllers for each post
  private youtubeControllers: Map<string, YouTubePlayerController> = new Map();

  // Store scroll position for restoration after reload
  private savedScrollPosition: number = 0;

  constructor(target: HTMLElement, props: TimelineContainerProps) {
    this.containerEl = target;
    this.vault = props.vault;
    this.app = props.app;
    this.archivePath = props.archivePath;
    this.plugin = props.plugin;

    // Initialize PostDataParser
    this.postDataParser = new PostDataParser(this.vault);

    // Initialize FilterSortManager with plugin settings
    this.filterSortManager = new FilterSortManager(
      undefined, // Use default filter state
      {
        by: props.plugin.settings.timelineSortBy,
        order: props.plugin.settings.timelineSortOrder
      }
    );

    // Initialize FilterPanel
    this.filterPanel = new FilterPanel(
      (platform) => this.getPlatformSimpleIcon(platform),
      (platform) => this.getLucideIcon(platform)
    );

    // Initialize SortDropdown
    this.sortDropdown = new SortDropdown(props.plugin);

    // Initialize MediaGalleryRenderer
    this.mediaGalleryRenderer = new MediaGalleryRenderer(
      (path) => this.app.vault.adapter.getResourcePath(path)
    );

    // Initialize CommentRenderer
    this.commentRenderer = new CommentRenderer();

    // Initialize YouTubeEmbedRenderer
    this.youtubeEmbedRenderer = new YouTubeEmbedRenderer();

    // Initialize LinkPreviewRenderer
    const workerUrl = props.plugin.settings.workerUrl || 'https://social-archiver-api.junlim.org';
    this.linkPreviewRenderer = new LinkPreviewRenderer(workerUrl);

    // Initialize PostCardRenderer
    this.postCardRenderer = new PostCardRenderer(
      this.vault,
      this.app,
      this.plugin,
      this.mediaGalleryRenderer,
      this.commentRenderer,
      this.youtubeEmbedRenderer,
      this.linkPreviewRenderer,
      this.youtubeControllers
    );

    // Setup callbacks
    this.setupCallbacks();

    this.render();
    this.loadPosts();
  }

  /**
   * Setup callbacks for filter and sort changes
   */
  private setupCallbacks(): void {
    // FilterPanel callbacks
    this.filterPanel.onFilterChange((filter) => {
      this.filterSortManager.updateFilter(filter);
      this.filteredPosts = this.filterSortManager.applyFiltersAndSort(this.posts);
    });

    this.filterPanel.onRerender(() => {
      this.renderPostsFeed();
    });

    this.filterPanel.onGetFilterState(() => {
      return this.filterSortManager.getFilterState();
    });

    // SortDropdown callbacks
    this.sortDropdown.onSortChange((sort) => {
      this.filterSortManager.updateSort(sort);
      this.filteredPosts = this.filterSortManager.applyFiltersAndSort(this.posts);
    });

    this.sortDropdown.onRerender(() => {
      this.renderPostsFeed();
    });

    // PostCardRenderer callbacks
    this.postCardRenderer.onArchiveToggle((post, newArchiveStatus, cardElement) => {
      this.handleArchiveToggle(post, newArchiveStatus, cardElement);
    });
  }

  /**
   * Handle archive toggle event from PostCardRenderer
   * If the post is archived and includeArchived filter is false, remove the card with animation
   */
  private handleArchiveToggle(post: PostData, newArchiveStatus: boolean, cardElement: HTMLElement): void {
    const filterState = this.filterSortManager.getFilterState();

    // If post is archived and includeArchived filter is false, remove the card
    if (newArchiveStatus && !filterState.includeArchived) {
      // Animate card removal (fade out and slide up)
      cardElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      cardElement.style.opacity = '0';
      cardElement.style.transform = 'translateY(-10px)';

      // Remove from DOM after animation
      setTimeout(() => {
        cardElement.remove();

        // Update filteredPosts array
        const index = this.filteredPosts.findIndex(p => p.id === post.id);
        if (index !== -1) {
          this.filteredPosts.splice(index, 1);
        }

        // If no posts left, show empty state
        if (this.filteredPosts.length === 0) {
          this.renderEmpty();
        }

        console.log('[Timeline] Removed archived post from view:', post.id);
      }, 300);
    }
  }

  private render(): void {
    // Add Tailwind classes individually
    this.containerEl.className = 'w-full h-full overflow-y-auto p-4';
    // White background for clean look in main area
    this.containerEl.style.backgroundColor = 'var(--background-primary)';
    this.renderLoading();
  }

  private renderLoading(): void {
    this.containerEl.empty();

    const loading = this.containerEl.createDiv({
      cls: 'flex flex-col items-center justify-center min-h-[300px] text-[var(--text-muted)]'
    });

    loading.createDiv({ cls: 'timeline-loading-spinner' });
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

  /**
   * Render header with filter, sort, and refresh controls
   */
  private renderHeader(): HTMLElement {
    const header = this.containerEl.createDiv();
    header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; position: relative;';

    // Left side: Filter and Sort buttons
    const leftButtons = header.createDiv();
    leftButtons.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // Filter button
    this.renderFilterButton(leftButtons, header);

    // Sort controls (dropdown + order toggle)
    const sortState = this.filterSortManager.getSortState();
    this.sortDropdown.renderSortControls(leftButtons, sortState);

    // Right side: Refresh and Settings buttons
    const rightButtons = header.createDiv();
    rightButtons.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    this.renderRefreshButton(rightButtons);
    this.renderSettingsButton(rightButtons);

    return header;
  }

  /**
   * Render filter button
   */
  private renderFilterButton(parent: HTMLElement, header: HTMLElement): void {
    const filterBtn = parent.createDiv();
    filterBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 40px; border-radius: 8px; background: transparent; cursor: pointer; transition: all 0.2s; flex-shrink: 0; font-size: 13px; color: var(--text-muted);';
    filterBtn.setAttribute('title', 'Filter posts');

    const filterIcon = filterBtn.createDiv();
    filterIcon.style.cssText = 'width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: color 0.2s;';
    setIcon(filterIcon, 'filter');

    const filterText = filterBtn.createSpan({ text: 'Filter' });
    filterText.style.cssText = 'font-weight: 500; line-height: 1;';

    // Update filter button based on active filters
    const updateFilterButton = () => {
      const hasActiveFilters = this.filterSortManager.hasActiveFilters();

      if (hasActiveFilters) {
        filterBtn.style.background = 'var(--interactive-accent)';
        filterBtn.style.color = 'var(--text-on-accent)';
        filterIcon.style.color = 'var(--text-on-accent)';
      } else {
        filterBtn.style.background = 'transparent';
        filterBtn.style.color = 'var(--text-muted)';
        filterIcon.style.color = 'var(--text-muted)';
      }
    };

    updateFilterButton();

    filterBtn.addEventListener('mouseenter', () => {
      if (!this.filterPanel.isOpened) {
        filterBtn.style.background = 'var(--background-modifier-hover)';
      }
    });

    filterBtn.addEventListener('mouseleave', () => {
      if (!this.filterPanel.isOpened) {
        updateFilterButton();
      }
    });

    filterBtn.addEventListener('click', () => {
      const filterState = this.filterSortManager.getFilterState();
      this.filterPanel.toggle(header, filterState, updateFilterButton);
    });
  }

  /**
   * Render refresh button
   */
  private renderRefreshButton(parent: HTMLElement): void {
    const refreshBtn = parent.createDiv();
    refreshBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; background: transparent; cursor: pointer; transition: all 0.2s; flex-shrink: 0;';
    refreshBtn.setAttribute('title', 'Refresh timeline');

    const refreshIcon = refreshBtn.createDiv();
    refreshIcon.style.cssText = 'width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--text-muted); transition: color 0.2s;';
    setIcon(refreshIcon, 'refresh-cw');

    refreshBtn.addEventListener('mouseenter', () => {
      refreshBtn.style.background = 'var(--background-modifier-hover)';
      refreshIcon.style.color = 'var(--interactive-accent)';
    });

    refreshBtn.addEventListener('mouseleave', () => {
      refreshBtn.style.background = 'transparent';
      refreshIcon.style.color = 'var(--text-muted)';
    });

    refreshBtn.addEventListener('click', () => {
      this.loadPosts();
    });
  }

  /**
   * Render settings button
   */
  private renderSettingsButton(parent: HTMLElement): void {
    const settingsBtn = parent.createDiv();
    settingsBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; background: transparent; cursor: pointer; transition: all 0.2s; flex-shrink: 0;';
    settingsBtn.setAttribute('title', 'Open plugin settings');

    const settingsIcon = settingsBtn.createDiv();
    settingsIcon.style.cssText = 'width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--text-muted); transition: color 0.2s;';
    setIcon(settingsIcon, 'settings');

    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.background = 'var(--background-modifier-hover)';
      settingsIcon.style.color = 'var(--interactive-accent)';
    });

    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.background = 'transparent';
      settingsIcon.style.color = 'var(--text-muted)';
    });

    settingsBtn.addEventListener('click', () => {
      // Open plugin settings tab
      // @ts-ignore - app.setting is available but not typed
      this.app.setting.open();
      // @ts-ignore
      this.app.setting.openTabById(this.plugin.manifest.id);
    });
  }

  private renderPosts(): void {
    this.containerEl.empty();
    // Clear previous YouTube controllers when re-rendering
    this.youtubeControllers.clear();

    // Render header with filter/sort controls
    this.renderHeader();

    // Render posts feed
    this.renderPostsFeed();
  }


  /**
   * Re-render only the posts feed (keep header/panels intact)
   */
  private renderPostsFeed(): void {
    // Find and remove existing feed
    const existingFeed = this.containerEl.querySelector('.timeline-feed');
    if (existingFeed) {
      existingFeed.remove();
    }

    // Clear YouTube controllers
    this.youtubeControllers.clear();

    // Group posts by date
    const grouped = this.groupPostsByDate(this.filteredPosts);

    // Render posts in single-column feed (max-width for readability)
    const feed = this.containerEl.createDiv({
      cls: 'flex flex-col gap-4 max-w-2xl mx-auto timeline-feed'
    });

    // Remove date separators - just render all posts
    for (const [_, groupPosts] of grouped) {
      for (const post of groupPosts) {
        this.postCardRenderer.render(feed, post);
      }
    }
  }

  private async loadPosts(): Promise<void> {
    try {
      console.log('[Timeline] Loading posts from:', this.archivePath);

      this.renderLoading();

      // Use PostDataParser to load posts from vault
      this.posts = await this.postDataParser.loadFromVault(this.archivePath);

      // Use FilterSortManager to apply filters and sorting
      this.filteredPosts = this.filterSortManager.applyFiltersAndSort(this.posts);

      console.log(`[Timeline] Loaded ${this.posts.length} posts, ${this.filteredPosts.length} after filtering`);

      if (this.filteredPosts.length === 0) {
        this.renderEmpty();
      } else {
        this.renderPosts();
      }

    } catch (err) {
      console.error('[Timeline] Failed to load posts:', err);
      this.renderError(err instanceof Error ? err.message : 'Failed to load posts');
    }
  }

  /**
   * Apply filters and sorting to posts
   */


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


  /**
   * Get platform-specific Simple Icon
   * Returns null for LinkedIn (not available in simple-icons)
   */
  private getPlatformSimpleIcon(platform: string): SimpleIcon | null {
    const iconMap: Record<string, SimpleIcon | null> = {
      facebook: siFacebook,
      instagram: siInstagram,
      linkedin: null, // Use Lucide icon instead
      x: siX,
      twitter: siX, // X/Twitter alias
      tiktok: siTiktok,
      threads: siThreads,
      youtube: siYoutube
    };
    const key = platform.toLowerCase();
    // Check if key exists in map (including null values)
    if (key in iconMap) {
      const icon = iconMap[key];
      return icon !== undefined ? icon : null;
    }
    return siX; // Default fallback for unknown platforms
  }

  /**
   * Get Lucide icon name for platforms not in simple-icons
   */
  private getLucideIcon(platform: string): string {
    const iconMap: Record<string, string> = {
      linkedin: 'linkedin'
    };
    return iconMap[platform.toLowerCase()] || 'share-2';
  }

  /**
   * Format relative time (e.g., "2h ago", "Yesterday", "Mar 15")
   */

  public destroy(): void {
    this.containerEl.empty();
    this.youtubeControllers.clear();
  }

  /**
   * Reload the timeline (useful when view is re-activated)
   */
  public async reload(): Promise<void> {
    // Save current scroll position before reloading
    this.savedScrollPosition = this.containerEl.scrollTop;

    this.youtubeControllers.clear();
    await this.loadPosts();

    // Restore scroll position after rendering
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      this.containerEl.scrollTop = this.savedScrollPosition;
    });
  }
}
