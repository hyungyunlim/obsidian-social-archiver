import { setIcon, type TFile, type Vault, type App } from 'obsidian';
import type { PostData, Comment, Media } from '../../types/post';
import type SocialArchiverPlugin from '../../main';
import {
  siFacebook,
  siInstagram,
  siTiktok,
  siX,
  siThreads,
  siYoutube,
  type SimpleIcon
} from 'simple-icons';
import { PostDataParser } from './parsers/PostDataParser';
import { FilterSortManager } from './filters/FilterSortManager';
import { FilterPanel } from './filters/FilterPanel';
import { SortDropdown } from './filters/SortDropdown';

export interface TimelineContainerProps {
  vault: Vault;
  app: App;
  archivePath: string;
  plugin: SocialArchiverPlugin;
}

/**
 * YouTube Player Controller - Controls YouTube iframe via postMessage API
 * @see https://medium.com/@mihauco/youtube-iframe-api-without-youtube-iframe-api-f0ac5fcf7c74
 */
class YouTubePlayerController {
  private iframe: HTMLIFrameElement;
  private ready = false;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;

    // Wait for iframe to load
    this.iframe.addEventListener('load', () => {
      this.ready = true;
      // Enable listening mode to receive player state updates
      this.sendCommand('listening');
    });
  }

  private sendCommand(func: string, args: any[] = []): void {
    if (!this.ready) {
      console.warn('[YouTubePlayer] Not ready yet');
      return;
    }

    const message = JSON.stringify({
      event: func === 'listening' ? 'listening' : 'command',
      func: func === 'listening' ? undefined : func,
      args
    });

    this.iframe.contentWindow?.postMessage(message, '*');
  }

  /**
   * Seek to specific time in video (in seconds)
   */
  public seekTo(seconds: number): void {
    this.sendCommand('seekTo', [seconds, true]);
  }

  /**
   * Play video
   */
  public play(): void {
    this.sendCommand('playVideo');
  }

  /**
   * Pause video
   */
  public pause(): void {
    this.sendCommand('pauseVideo');
  }

  /**
   * Mute video
   */
  public mute(): void {
    this.sendCommand('mute');
  }

  /**
   * Unmute video
   */
  public unmute(): void {
    this.sendCommand('unMute');
  }
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

  // Store YouTube player controllers for each post
  private youtubeControllers: Map<string, YouTubePlayerController> = new Map();

  constructor(target: HTMLElement, props: TimelineContainerProps) {
    this.containerEl = target;
    this.vault = props.vault;
    this.app = props.app;
    this.archivePath = props.archivePath;
    this.plugin = props.plugin;

    // Initialize PostDataParser
    this.postDataParser = new PostDataParser(this.vault, this.app);

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

    // Right side: Refresh button
    this.renderRefreshButton(header);

    return header;
  }

  /**
   * Render filter button
   */
  private renderFilterButton(parent: HTMLElement, header: HTMLElement): void {
    const filterBtn = parent.createDiv();
    filterBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; background: var(--background-secondary); cursor: pointer; transition: all 0.2s; flex-shrink: 0; font-size: 13px; color: var(--text-muted);';
    filterBtn.setAttribute('title', 'Filter posts');

    const filterIcon = filterBtn.createDiv();
    filterIcon.style.cssText = 'width: 16px; height: 16px; transition: color 0.2s;';
    setIcon(filterIcon, 'filter');

    const filterText = filterBtn.createSpan({ text: 'Filter' });
    filterText.style.cssText = 'font-weight: 500;';

    // Update filter button based on active filters
    const updateFilterButton = () => {
      const hasActiveFilters = this.filterSortManager.hasActiveFilters();

      if (hasActiveFilters) {
        filterBtn.style.background = 'var(--interactive-accent)';
        filterBtn.style.color = 'var(--text-on-accent)';
        filterIcon.style.color = 'var(--text-on-accent)';
      } else {
        filterBtn.style.background = 'var(--background-secondary)';
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
    refreshBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 8px; background: var(--background-secondary); cursor: pointer; transition: all 0.2s; flex-shrink: 0;';
    refreshBtn.setAttribute('title', 'Refresh timeline');

    const refreshIcon = refreshBtn.createDiv();
    refreshIcon.style.cssText = 'width: 20px; height: 20px; color: var(--text-muted); transition: color 0.2s;';
    setIcon(refreshIcon, 'refresh-cw');

    refreshBtn.addEventListener('mouseenter', () => {
      refreshBtn.style.background = 'var(--background-modifier-hover)';
      refreshIcon.style.color = 'var(--interactive-accent)';
    });

    refreshBtn.addEventListener('mouseleave', () => {
      refreshBtn.style.background = 'var(--background-secondary)';
      refreshIcon.style.color = 'var(--text-muted)';
    });

    refreshBtn.addEventListener('click', () => {
      this.loadPosts();
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
        this.renderPostCard(feed, post);
      }
    }
  }

  private renderPostCard(container: HTMLElement, post: PostData): void {
    // If comment exists, create wrapper for entire card
    let cardContainer = container;

    if (post.comment) {
      const wrapper = container.createDiv({ cls: 'mb-4' });

      const userName = this.plugin.settings.userName || 'You';

      // Comment header: "Jun commented on this post"
      const commentHeader = wrapper.createDiv({ cls: 'mb-2' });
      commentHeader.style.cssText = 'font-size: 13px; color: var(--text-muted);';

      const userNameSpan = commentHeader.createSpan({ text: userName });
      userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

      commentHeader.createSpan({ text: ' commented on this post' });

      // Comment text
      const commentTextDiv = wrapper.createDiv({ cls: 'mb-3' });
      commentTextDiv.style.cssText = 'font-size: 14px; line-height: 1.5; color: var(--text-normal);';
      this.renderMarkdownLinks(commentTextDiv, post.comment, undefined, post.platform);

      // Create nested container for the actual card
      cardContainer = wrapper.createDiv();
      cardContainer.style.cssText = 'padding-left: 16px; border-left: 2px solid var(--background-modifier-border); margin-left: 4px;';
    }

    const card = cardContainer.createDiv({
      cls: 'relative p-4 rounded-lg bg-[var(--background-secondary)] transition-all duration-200'
    });

    // Hover animation - subtle lift and shadow
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      card.style.backgroundColor = 'var(--background-modifier-hover)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      card.style.backgroundColor = 'var(--background-secondary)';
    });

    // Avatar (platform icon) - Top right corner, subtle style - click to open original URL
    const avatarContainer = card.createDiv();
    avatarContainer.style.cssText = 'position: absolute; top: 12px; right: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; opacity: 0.3; cursor: pointer; transition: opacity 0.2s;';
    avatarContainer.setAttribute('title', `Open on ${post.platform}`);

    avatarContainer.addEventListener('mouseenter', () => {
      avatarContainer.style.opacity = '0.6';
    });

    avatarContainer.addEventListener('mouseleave', () => {
      avatarContainer.style.opacity = '0.3';
    });

    avatarContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      if (post.url) {
        window.open(post.url, '_blank');
      }
    });

    const iconWrapper = avatarContainer.createDiv();
    iconWrapper.style.cssText = 'width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: var(--text-accent);';
    const icon = this.getPlatformSimpleIcon(post.platform);
    if (icon) {
      // Use Simple Icon with Obsidian theme color
      iconWrapper.innerHTML = `
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="fill: var(--text-accent); width: 100%; height: 100%;">
          <title>${icon.title}</title>
          <path d="${icon.path}"/>
        </svg>
      `;
    } else {
      // Use Lucide icon for platforms not in simple-icons (e.g., LinkedIn)
      const lucideIconName = this.getLucideIcon(post.platform);
      const lucideWrapper = iconWrapper.createDiv();
      lucideWrapper.style.cssText = 'width: 100%; height: 100%;';
      setIcon(lucideWrapper, lucideIconName);
    }

    // Content area
    const contentArea = card.createDiv({ cls: 'pr-14' });

    // Header: Author + Time
    const header = contentArea.createDiv({ cls: 'mb-3' });

    // Author name - click to open author URL
    const authorName = header.createEl('strong', {
      text: post.author.name,
      cls: 'text-[var(--text-normal)] block mb-1'
    });
    authorName.style.cursor = 'pointer';
    authorName.style.transition = 'color 0.2s';

    if (post.author.url) {
      authorName.setAttribute('title', `Visit ${post.author.name}'s profile`);

      authorName.addEventListener('mouseenter', () => {
        authorName.style.color = 'var(--interactive-accent)';
      });

      authorName.addEventListener('mouseleave', () => {
        authorName.style.color = 'var(--text-normal)';
      });

      authorName.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(post.author.url, '_blank');
      });
    }

    // Relative time
    const timeSpan = header.createDiv({
      cls: 'text-xs text-[var(--text-muted)]'
    });
    const timestamp = typeof post.metadata.timestamp === 'string'
      ? new Date(post.metadata.timestamp)
      : post.metadata.timestamp;
    timeSpan.setText(this.getRelativeTime(timestamp));

    // Content (full text with expand/collapse)
    const contentContainer = contentArea.createDiv({ cls: 'mb-3' });

    // Remove leading whitespace and get meaningful content
    const cleanContent = post.content.text.trim();
    const previewLength = 500; // Show more text initially
    const isLongContent = cleanContent.length > previewLength;

    const contentText = contentContainer.createDiv({
      cls: 'text-sm leading-relaxed text-[var(--text-normal)]'
    });
    contentText.style.whiteSpace = 'pre-wrap';
    contentText.style.wordBreak = 'break-word';

    // Pass videoId to renderMarkdownLinks for YouTube posts
    const videoId = post.platform === 'youtube' ? post.videoId : undefined;

    if (isLongContent) {
      // Smart preview truncation - don't cut markdown links in half
      let preview = cleanContent.substring(0, previewLength);

      // Check if we cut off in the middle of a markdown link
      const lastOpenBracket = preview.lastIndexOf('[');
      const lastCloseBracket = preview.lastIndexOf(']');

      // If there's an unclosed link at the end, truncate before it
      if (lastOpenBracket > lastCloseBracket) {
        preview = cleanContent.substring(0, lastOpenBracket);
      }

      this.renderMarkdownLinks(contentText, preview + '...', videoId, post.platform);

      const seeMoreBtn = contentContainer.createEl('button', {
        text: 'See more'
      });
      seeMoreBtn.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-top: 8px; display: inline-block; text-align: left; padding: 0; background: transparent; border: none; outline: none; box-shadow: none; cursor: pointer; transition: color 0.2s; font-family: inherit;';

      seeMoreBtn.addEventListener('mouseenter', () => {
        seeMoreBtn.style.color = 'var(--interactive-accent)';
      });

      seeMoreBtn.addEventListener('mouseleave', () => {
        seeMoreBtn.style.color = 'var(--text-muted)';
      });

      let expanded = false;
      seeMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        expanded = !expanded;
        if (expanded) {
          this.renderMarkdownLinks(contentText, cleanContent, videoId, post.platform);
          seeMoreBtn.setText('See less');
        } else {
          this.renderMarkdownLinks(contentText, preview + '...', videoId, post.platform);
          seeMoreBtn.setText('See more');
        }
      });
    } else {
      this.renderMarkdownLinks(contentText, cleanContent, videoId, post.platform);
    }

    // Debug: Log post platform and url
    console.log('[Timeline] Post platform:', post.platform, 'URL:', post.url);

    // YouTube embed (if YouTube platform)
    if (post.platform === 'youtube' && post.videoId) {
      console.log('[Timeline] Rendering YouTube embed');
      const player = this.renderYouTubeEmbed(contentArea, post.videoId);
      // Store controller for use with timestamp links
      this.youtubeControllers.set(post.videoId, player);
    }
    // TikTok embed (if TikTok platform)
    else if (post.platform === 'tiktok' && post.url) {
      console.log('[Timeline] Detected TikTok platform, rendering embed');
      this.renderTikTokEmbed(contentArea, post.url);
    }
    // Media carousel (if images exist)
    else if (post.media.length > 0) {
      console.log('[Timeline] Rendering media carousel');
      this.renderMediaCarousel(contentArea, post.media, post);
    } else {
      console.log('[Timeline] No media to render');
    }

    // Interaction bar (like Twitter/Facebook)
    const interactions = contentArea.createDiv();
    interactions.style.cssText = 'display: flex; align-items: center; gap: 24px; padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--background-modifier-border); color: var(--text-muted); flex-wrap: wrap;';

    // Likes
    if (post.metadata.likes !== undefined) {
      const likeBtn = interactions.createDiv();
      likeBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
      likeBtn.addEventListener('mouseenter', () => {
        likeBtn.style.color = 'var(--interactive-accent)';
      });
      likeBtn.addEventListener('mouseleave', () => {
        likeBtn.style.color = 'var(--text-muted)';
      });

      const likeIcon = likeBtn.createDiv();
      likeIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';
      setIcon(likeIcon, 'heart');

      const likeCount = likeBtn.createSpan({ text: this.formatNumber(post.metadata.likes) });
      likeCount.style.cssText = 'min-width: 20px; display: flex; align-items: center;';
    }

    // Comments
    if (post.metadata.comments !== undefined) {
      const commentBtn = interactions.createDiv();
      commentBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
      commentBtn.addEventListener('mouseenter', () => {
        commentBtn.style.color = 'var(--interactive-accent)';
      });
      commentBtn.addEventListener('mouseleave', () => {
        commentBtn.style.color = 'var(--text-muted)';
      });

      const commentIcon = commentBtn.createDiv();
      commentIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';
      setIcon(commentIcon, 'message-circle');

      const commentCount = commentBtn.createSpan({ text: this.formatNumber(post.metadata.comments) });
      commentCount.style.cssText = 'min-width: 20px; display: flex; align-items: center;';
    }

    // Shares
    if (post.metadata.shares !== undefined) {
      const shareBtn = interactions.createDiv();
      shareBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
      shareBtn.addEventListener('mouseenter', () => {
        shareBtn.style.color = 'var(--interactive-accent)';
      });
      shareBtn.addEventListener('mouseleave', () => {
        shareBtn.style.color = 'var(--text-muted)';
      });

      const shareIcon = shareBtn.createDiv();
      shareIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';
      setIcon(shareIcon, 'repeat-2');

      const shareCount = shareBtn.createSpan({ text: this.formatNumber(post.metadata.shares) });
      shareCount.style.cssText = 'min-width: 20px; display: flex; align-items: center;';
    }

    // Spacer
    const spacer = interactions.createDiv();
    spacer.style.flex = '1';

    // Personal Like button (star icon, right-aligned, distinct from post likes)
    const personalLikeBtn = interactions.createDiv();
    personalLikeBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
    personalLikeBtn.setAttribute('title', post.like ? 'Remove from favorites' : 'Add to favorites');

    const personalLikeIcon = personalLikeBtn.createDiv();
    personalLikeIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';

    // Set initial state
    if (post.like) {
      setIcon(personalLikeIcon, 'star');
      // Fill the star when liked
      const svgEl = personalLikeIcon.querySelector('svg');
      if (svgEl) {
        svgEl.style.fill = 'currentColor';
      }
      personalLikeBtn.style.color = 'var(--interactive-accent)';
    } else {
      setIcon(personalLikeIcon, 'star');
      personalLikeBtn.style.color = 'var(--text-muted)';
    }

    personalLikeBtn.addEventListener('mouseenter', () => {
      personalLikeBtn.style.color = 'var(--interactive-accent)';
    });
    personalLikeBtn.addEventListener('mouseleave', () => {
      personalLikeBtn.style.color = post.like ? 'var(--interactive-accent)' : 'var(--text-muted)';
    });

    // Personal Like button click handler
    personalLikeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.togglePersonalLike(post, personalLikeBtn, personalLikeIcon);
    });

    // Archive button (right-aligned)
    const archiveBtn = interactions.createDiv();
    archiveBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
    archiveBtn.setAttribute('title', post.archive ? 'Unarchive this post' : 'Archive this post');

    const archiveIcon = archiveBtn.createDiv();
    archiveIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';

    // Set initial state
    if (post.archive) {
      setIcon(archiveIcon, 'archive');
      // Fill the archive icon when archived (with internal details visible)
      const svgEl = archiveIcon.querySelector('svg');
      if (svgEl) {
        svgEl.style.fill = 'currentColor';
        svgEl.style.stroke = 'var(--background-primary)';
        svgEl.style.strokeWidth = '1.5';
        svgEl.style.strokeLinejoin = 'round';
        svgEl.style.strokeLinecap = 'round';
      }
      archiveBtn.style.color = 'var(--interactive-accent)';
    } else {
      setIcon(archiveIcon, 'archive');
      archiveBtn.style.color = 'var(--text-muted)';
    }

    archiveBtn.addEventListener('mouseenter', () => {
      archiveBtn.style.color = 'var(--interactive-accent)';
    });
    archiveBtn.addEventListener('mouseleave', () => {
      archiveBtn.style.color = post.archive ? 'var(--interactive-accent)' : 'var(--text-muted)';
    });

    // Archive button click handler
    archiveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.toggleArchive(post, archiveBtn, archiveIcon);
    });

    // Open Note button (right-aligned, next to Archive)
    const openNoteBtn = interactions.createDiv();
    openNoteBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
    openNoteBtn.setAttribute('title', 'Open note in Obsidian');
    openNoteBtn.addEventListener('mouseenter', () => {
      openNoteBtn.style.color = 'var(--interactive-accent)';
    });
    openNoteBtn.addEventListener('mouseleave', () => {
      openNoteBtn.style.color = 'var(--text-muted)';
    });

    const openNoteIcon = openNoteBtn.createDiv();
    openNoteIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';
    setIcon(openNoteIcon, 'external-link');

    // Open Note button click handler
    openNoteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.openNote(post);
    });

    // Comments section (Instagram style)
    if (post.comments && post.comments.length > 0) {
      this.renderComments(contentArea, post.comments);
    }
  }

  /**
   * Render comments section (Instagram style)
   */
  private renderComments(container: HTMLElement, comments: Comment[]): void {
    const commentsContainer = container.createDiv();
    commentsContainer.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--background-modifier-border);';

    const maxVisibleComments = 2;
    const hasMoreComments = comments.length > maxVisibleComments;

    // "View all X comments" button (if there are more than 2 comments)
    if (hasMoreComments) {
      const viewAllBtn = commentsContainer.createDiv();
      viewAllBtn.style.cssText = 'font-size: 13px; color: var(--text-muted); cursor: pointer; margin-bottom: 8px; transition: color 0.2s;';
      viewAllBtn.setText(`View all ${comments.length} comments`);

      let showingAll = false;

      viewAllBtn.addEventListener('mouseenter', () => {
        viewAllBtn.style.color = 'var(--text-normal)';
      });
      viewAllBtn.addEventListener('mouseleave', () => {
        viewAllBtn.style.color = 'var(--text-muted)';
      });

      viewAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showingAll = !showingAll;

        // Clear and re-render
        commentsListContainer.empty();
        const commentsToShow = showingAll ? comments : comments.slice(-maxVisibleComments);

        for (const comment of commentsToShow) {
          this.renderComment(commentsListContainer, comment);
        }

        viewAllBtn.setText(showingAll ? 'Hide comments' : `View all ${comments.length} comments`);
      });
    }

    // Comments list
    const commentsListContainer = commentsContainer.createDiv();
    commentsListContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    // Show last 2 comments initially (like Instagram)
    const commentsToShow = hasMoreComments ? comments.slice(-maxVisibleComments) : comments;

    for (const comment of commentsToShow) {
      this.renderComment(commentsListContainer, comment);
    }
  }

  /**
   * Render a single comment (Instagram style)
   */
  private renderComment(container: HTMLElement, comment: Comment, isReply: boolean = false): void {
    const commentDiv = container.createDiv();
    commentDiv.style.cssText = isReply
      ? 'font-size: 13px; line-height: 1.4; margin-left: 24px;'
      : 'font-size: 13px; line-height: 1.4;';

    // Comment content: **name** content (on same line)
    const contentSpan = commentDiv.createSpan();

    const usernameSpan = contentSpan.createEl('strong');
    usernameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal); cursor: pointer;';
    // Use author.name for display (e.g., "Charlie Moon" for LinkedIn)
    usernameSpan.setText(comment.author.name);

    if (comment.author.url) {
      usernameSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(comment.author.url, '_blank');
      });
      usernameSpan.addEventListener('mouseenter', () => {
        usernameSpan.style.textDecoration = 'underline';
      });
      usernameSpan.addEventListener('mouseleave', () => {
        usernameSpan.style.textDecoration = 'none';
      });
    }

    contentSpan.createSpan({ text: ' ' + comment.content, cls: 'color: var(--text-normal);' });

    // Time and likes (inline for both main comments and replies)
    // Only show time if timestamp exists and is valid
    if (comment.timestamp) {
      const timeSpan = contentSpan.createSpan();
      timeSpan.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-left: 8px;';
      const relativeTime = this.getRelativeTime(new Date(comment.timestamp));
      if (relativeTime && relativeTime !== 'Invalid Date') {
        timeSpan.setText(relativeTime);
      }
    }

    if (comment.likes && comment.likes > 0) {
      const likesSpan = contentSpan.createSpan();
      likesSpan.style.cssText = 'font-size: 12px; color: var(--text-muted);';
      // Add separator if timestamp was shown
      const separator = comment.timestamp ? ' · ' : ' ';
      likesSpan.style.marginLeft = comment.timestamp ? '0' : '8px';
      likesSpan.setText(`${separator}${comment.likes} ${comment.likes === 1 ? 'like' : 'likes'}`);
    }

    // Render replies (nested)
    if (comment.replies && comment.replies.length > 0) {
      const repliesContainer = container.createDiv();
      repliesContainer.style.marginTop = '8px';

      for (const reply of comment.replies) {
        this.renderComment(repliesContainer, reply, true);
      }
    }
  }

  /**
   * Render media carousel for images/videos (Instagram style)
   */
  private renderMediaCarousel(container: HTMLElement, media: Media[], post?: PostData): void {
    const carouselContainer = container.createDiv({
      cls: 'relative mt-3 rounded-lg overflow-hidden bg-[var(--background-modifier-border)]'
    });

    // Extract links from post content if available
    let extractedLink: string | null = null;
    if (post && media.length === 1) {
      const content = post.content.text;
      // Extract all URLs (markdown links and plain URLs)
      const markdownLinks = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => m[2]);
      const plainUrls = [...content.matchAll(/(https?:\/\/[^\s]+)/g)].map(m => m[1]);
      const allLinks = [...markdownLinks, ...plainUrls];

      // If exactly one link exists, use it for the image click
      if (allLinks.length === 1 && allLinks[0]) {
        extractedLink = allLinks[0];
      }
    }

    // Media container - preserves aspect ratio with max-height
    const mediaContainer = carouselContainer.createDiv();
    mediaContainer.style.cssText = 'position: relative; width: 100%; max-height: 600px; min-height: 200px; display: flex; align-items: center; justify-content: center;';

    let currentIndex = 0;

    // Create all media elements (hidden except current)
    const mediaElements: HTMLElement[] = [];
    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i];
      if (!mediaItem) continue; // Skip if undefined

      const resourcePath = this.app.vault.adapter.getResourcePath(mediaItem.url);

      // Determine if it's a video or image
      const isVideo = mediaItem.type === 'video' ||
                      mediaItem.url.endsWith('.mp4') ||
                      mediaItem.url.endsWith('.webm') ||
                      mediaItem.url.endsWith('.mov');

      let element: HTMLElement;

      if (isVideo) {
        // Render video - preserves original aspect ratio
        const video = mediaContainer.createEl('video', {
          attr: {
            src: resourcePath,
            controls: true,
            preload: 'metadata'
          }
        });

        video.style.cssText = 'max-width: 100%; max-height: 600px; width: auto; height: auto;';
        video.style.display = i === 0 ? 'block' : 'none';

        element = video;
      } else {
        // Render image - preserves original aspect ratio
        const img = mediaContainer.createEl('img', {
          attr: {
            src: resourcePath,
            alt: mediaItem.altText || `Image ${i + 1}`
          }
        });

        img.style.cssText = 'max-width: 100%; max-height: 600px; width: auto; height: auto;';
        img.style.display = i === 0 ? 'block' : 'none';

        // If single image and single link, make image clickable
        if (extractedLink && media.length === 1) {
          img.style.cursor = 'pointer';
          img.setAttribute('title', `Open link: ${extractedLink}`);
          img.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(extractedLink, '_blank');
          });
        }

        element = img;
      }

      mediaElements.push(element);
    }

    // Thumbnail navigation (Instagram style)
    if (media.length > 1) {
      // Thumbnails container
      const thumbnailsContainer = carouselContainer.createDiv();
      thumbnailsContainer.style.cssText = 'display: flex; gap: 8px; padding: 12px; overflow-x: auto; background: rgba(0, 0, 0, 0.02); scrollbar-width: thin; scrollbar-color: var(--background-modifier-border) transparent;';

      // Add webkit scrollbar styles
      thumbnailsContainer.addClass('media-thumbnails-scroll');

      // Convert vertical wheel scroll to horizontal scroll
      thumbnailsContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        thumbnailsContainer.scrollLeft += e.deltaY;
      });

      // Create thumbnails
      const thumbnailElements: HTMLElement[] = [];
      for (let i = 0; i < media.length; i++) {
        const mediaItem = media[i];
        if (!mediaItem) continue; // Skip if undefined

        const resourcePath = this.app.vault.adapter.getResourcePath(mediaItem.url);
        const isVideo = mediaItem.type === 'video' || mediaItem.url.endsWith('.mp4');

        const thumbnail = thumbnailsContainer.createDiv();
        thumbnail.style.cssText = 'position: relative; width: 60px; height: 60px; flex-shrink: 0; border-radius: 4px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;';

        if (isVideo) {
          // Video thumbnail - show play icon overlay
          const videoThumb = thumbnail.createEl('video', {
            attr: {
              src: resourcePath,
              preload: 'metadata'
            }
          });
          videoThumb.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

          // Play icon overlay
          const playOverlay = thumbnail.createDiv();
          playOverlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background: rgba(0, 0, 0, 0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center;';
          const playIcon = playOverlay.createDiv({ cls: 'w-3 h-3 text-white' });
          setIcon(playIcon, 'play');
        } else {
          // Image thumbnail
          const imgThumb = thumbnail.createEl('img', {
            attr: {
              src: resourcePath,
              alt: `Thumbnail ${i + 1}`
            }
          });
          imgThumb.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        }

        // Click to navigate
        thumbnail.addEventListener('click', (e) => {
          e.stopPropagation();
          showMedia(i);
        });

        // Active state
        if (i === 0) {
          thumbnail.style.borderColor = 'var(--interactive-accent)';
        }

        thumbnailElements.push(thumbnail);
      }

      // Counter indicator (bottom-right, above thumbnails)
      const counter = carouselContainer.createDiv();
      // Position above thumbnails: thumbnail height (60px) + padding (12px * 2) + gap (12px) = ~96px
      counter.style.cssText = 'position: absolute; bottom: 96px; right: 12px; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.15); color: rgba(255, 255, 255, 0.7); font-size: 11px; font-weight: 500; z-index: 10; backdrop-filter: blur(8px);';
      counter.setText(`1/${media.length}`);

      // Navigation functions
      const showMedia = (index: number) => {
        mediaElements.forEach((element, i) => {
          element.style.display = i === index ? 'block' : 'none';
          // Pause videos when hidden
          if (element instanceof HTMLVideoElement) {
            if (i !== index) {
              element.pause();
            }
          }
        });

        // Update thumbnail active state
        thumbnailElements.forEach((thumb, i) => {
          thumb.style.borderColor = i === index ? 'var(--interactive-accent)' : 'transparent';
        });

        counter.setText(`${index + 1}/${media.length}`);
        currentIndex = index;
      };

      // Keyboard navigation
      mediaContainer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.stopPropagation();
          const newIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1;
          showMedia(newIndex);
        } else if (e.key === 'ArrowRight') {
          e.stopPropagation();
          const newIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0;
          showMedia(newIndex);
        }
      });
    }
  }

  /**
   * Render YouTube embed iframe with playback control
   * @returns YouTubePlayerController instance for controlling playback
   */
  private renderYouTubeEmbed(container: HTMLElement, videoId: string): YouTubePlayerController {
    const embedContainer = container.createDiv();
    embedContainer.style.cssText = 'position: relative; width: 100%; padding-bottom: 56.25%; margin: 12px 0; border-radius: 8px; overflow: hidden; background: var(--background-secondary);';

    // IMPORTANT: enablejsapi=1 is required for postMessage control
    const iframe = embedContainer.createEl('iframe', {
      attr: {
        src: `https://www.youtube.com/embed/${videoId}?enablejsapi=1`,
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowfullscreen: 'true',
        referrerpolicy: 'strict-origin-when-cross-origin'
      }
    });
    iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

    // Create and return player controller
    return new YouTubePlayerController(iframe);
  }

  /**
   * Render TikTok embed iframe (direct method)
   */
  private renderTikTokEmbed(container: HTMLElement, url: string): void {
    console.log('[Timeline] Rendering TikTok embed for URL:', url);

    // Extract video ID from URL
    // URL patterns:
    // - https://www.tiktok.com/@username/video/1234567890
    // - https://vm.tiktok.com/ZMabcdefg/
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      console.warn('[Timeline] Could not extract TikTok video ID from URL:', url);
      // Fallback: show link
      const linkContainer = container.createDiv();
      linkContainer.style.cssText = 'padding: 20px; text-align: center; background: var(--background-secondary); border-radius: 8px; margin: 12px 0;';
      const link = linkContainer.createEl('a', {
        text: 'View on TikTok',
        attr: {
          href: url,
          target: '_blank'
        }
      });
      link.style.cssText = 'color: var(--interactive-accent); text-decoration: underline;';
      return;
    }

    console.log('[Timeline] TikTok video ID:', videoId);

    const embedContainer = container.createDiv();
    embedContainer.style.cssText = 'width: 100%; max-width: 340px; height: 700px; margin: 12px auto; border-radius: 8px; overflow: hidden; background: var(--background-secondary);';

    const iframe = embedContainer.createEl('iframe', {
      attr: {
        src: `https://www.tiktok.com/embed/v2/${videoId}`,
        width: '340',
        height: '700',
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true'
      }
    });
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

    console.log('[Timeline] TikTok iframe created successfully');
  }

  /**
   * Open the original note in Obsidian
   */
  private async openNote(post: PostData): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[Timeline] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file) {
        console.warn('[Timeline] File not found:', filePath);
        return;
      }

      // Check if it's a TFile
      if ('extension' in file) {
        // Open the file in a new leaf
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.openFile(file as TFile);
      } else {
        console.warn('[Timeline] Not a file:', filePath);
      }
    } catch (err) {
      console.error('[Timeline] Failed to open note:', err);
    }
  }

  /**
   * Toggle personal like status for a post
   */
  private async togglePersonalLike(post: PostData, btn: HTMLElement, icon: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[Timeline] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[Timeline] File not found:', filePath);
        return;
      }

      const tfile = file as TFile;

      // Read current file content
      const content = await this.vault.read(tfile);

      // Toggle like status
      const newLikeStatus = !post.like;

      // Update YAML frontmatter
      const updatedContent = this.updateYamlFrontmatter(content, { like: newLikeStatus });

      // Write back to file
      await this.vault.modify(tfile, updatedContent);

      // Update local state
      post.like = newLikeStatus;

      // Update UI
      btn.setAttribute('title', newLikeStatus ? 'Remove from favorites' : 'Add to favorites');
      btn.style.color = newLikeStatus ? 'var(--interactive-accent)' : 'var(--text-muted)';

      // Update star icon fill
      const svgEl = icon.querySelector('svg');
      if (svgEl) {
        if (newLikeStatus) {
          svgEl.style.fill = 'currentColor';
        } else {
          svgEl.style.fill = 'none';
        }
      }

      console.log('[Timeline] Toggled personal like:', post.id, newLikeStatus);
    } catch (err) {
      console.error('[Timeline] Failed to toggle personal like:', err);
    }
  }

  /**
   * Toggle archive status for a post
   */
  private async toggleArchive(post: PostData, btn: HTMLElement, icon: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[Timeline] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[Timeline] File not found:', filePath);
        return;
      }

      const tfile = file as TFile;

      // Read current file content
      const content = await this.vault.read(tfile);

      // Toggle archive status
      const newArchiveStatus = !post.archive;

      // Update YAML frontmatter
      const updatedContent = this.updateYamlFrontmatter(content, { archive: newArchiveStatus });

      // Write back to file
      await this.vault.modify(tfile, updatedContent);

      // Update post object
      post.archive = newArchiveStatus;

      // Update UI
      btn.style.color = newArchiveStatus ? 'var(--interactive-accent)' : 'var(--text-muted)';
      btn.setAttribute('title', newArchiveStatus ? 'Unarchive this post' : 'Archive this post');

      // Update archive icon fill (with internal details visible)
      const svgEl = icon.querySelector('svg');
      if (svgEl) {
        if (newArchiveStatus) {
          svgEl.style.fill = 'currentColor';
          svgEl.style.stroke = 'var(--background-primary)';
          svgEl.style.strokeWidth = '1.5';
          svgEl.style.strokeLinejoin = 'round';
          svgEl.style.strokeLinecap = 'round';
        } else {
          svgEl.style.fill = 'none';
          svgEl.style.stroke = '';
          svgEl.style.strokeWidth = '';
        }
      }

      console.log('[Timeline] Toggled archive:', post.id, newArchiveStatus);
    } catch (err) {
      console.error('[Timeline] Failed to toggle archive:', err);
    }
  }

  /**
   * Archive a post (set archive: true in YAML and remove from view)
   * @deprecated Use toggleArchive instead
   */
  // @ts-ignore - Deprecated method kept for reference
  private async _archivePost(post: PostData, cardElement: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[Timeline] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[Timeline] File not found:', filePath);
        return;
      }

      const tfile = file as TFile;

      // Read current file content
      const content = await this.vault.read(tfile);

      // Update YAML frontmatter
      const updatedContent = this.updateYamlFrontmatter(content, { archive: true });

      // Write back to file
      await this.vault.modify(tfile, updatedContent);

      // Animate card removal (fade out)
      cardElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      cardElement.style.opacity = '0';
      cardElement.style.transform = 'translateY(-10px)';

      // Remove from DOM after animation
      setTimeout(() => {
        cardElement.remove();

        // Remove from posts array
        const index = this.posts.findIndex(p => (p as any).filePath === filePath);
        if (index !== -1) {
          this.posts.splice(index, 1);
        }

        // Re-render if no posts left
        if (this.posts.length === 0) {
          this.renderEmpty();
        }
      }, 300);

      console.log('[Timeline] Archived post:', post.id);
    } catch (err) {
      console.error('[Timeline] Failed to archive post:', err);
    }
  }

  /**
   * Update YAML frontmatter with new values
   */
  private updateYamlFrontmatter(content: string, updates: Record<string, any>): string {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (!match || !match[1]) {
      // No frontmatter found, add it
      const yamlLines = Object.entries(updates)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      return `---\n${yamlLines}\n---\n\n${content}`;
    }

    const frontmatterContent = match[1];
    const restContent = content.slice(match[0].length);

    // Parse existing frontmatter
    const lines = frontmatterContent.split('\n');
    const updatedLines: string[] = [];
    const processedKeys = new Set<string>();

    // Update existing keys
    for (const line of lines) {
      const keyMatch = line.match(/^(\w+):/);
      if (keyMatch) {
        const key = keyMatch[1];
        if (key && updates.hasOwnProperty(key)) {
          updatedLines.push(`${key}: ${updates[key]}`);
          processedKeys.add(key);
        } else {
          updatedLines.push(line);
        }
      } else {
        updatedLines.push(line);
      }
    }

    // Add new keys
    for (const [key, value] of Object.entries(updates)) {
      if (!processedKeys.has(key)) {
        updatedLines.push(`${key}: ${value}`);
      }
    }

    return `---\n${updatedLines.join('\n')}\n---\n${restContent}`;
  }

  private async loadPosts(): Promise<void> {
    try {
      console.log('[Timeline] === loadPosts started ===');
      console.log('[Timeline] Archive path:', this.archivePath);

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
  private getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHour < 24) {
      return `${diffHour}h ago`;
    } else if (diffDay === 1) {
      return 'Yesterday';
    } else if (diffDay < 7) {
      return `${diffDay}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  /**
   * Format large numbers (e.g., 1000 -> 1K, 1000000 -> 1M)
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  }

  /**
   * Get hashtag URL for platform
   */
  private getHashtagUrl(hashtag: string, platform: string): string {
    // Remove # from hashtag
    const tag = hashtag.replace('#', '');

    const urlMap: Record<string, string> = {
      instagram: `https://www.instagram.com/explore/tags/${tag}/`,
      x: `https://twitter.com/hashtag/${tag}`,
      twitter: `https://twitter.com/hashtag/${tag}`,
      facebook: `https://www.facebook.com/hashtag/${tag}`,
      linkedin: `https://www.linkedin.com/feed/hashtag/${tag}/`,
      tiktok: `https://www.tiktok.com/tag/${tag}`,
      threads: `https://www.threads.net/tag/${tag}`,
      youtube: `https://www.youtube.com/hashtag/${tag}`
    };

    return urlMap[platform.toLowerCase()] || `https://www.google.com/search?q=${encodeURIComponent(hashtag)}`;
  }

  /**
   * Render text with hashtags highlighted and clickable
   */
  private renderTextWithHashtags(container: HTMLElement, text: string, platform?: string): void {
    // Hashtag pattern: #word (supports alphanumeric, underscore, and unicode characters like Korean/Japanese)
    const hashtagPattern = /(#[\w\u0080-\uFFFF]+)/g;
    const parts = text.split(hashtagPattern);

    for (const part of parts) {
      if (part.startsWith('#') && part.length > 1) {
        // This is a hashtag - make it clickable if platform is provided
        if (platform) {
          const hashtagLink = container.createEl('a', {
            text: part,
            attr: {
              href: this.getHashtagUrl(part, platform),
              target: '_blank',
              rel: 'noopener noreferrer',
              title: `Search ${part} on ${platform}`
            }
          });
          hashtagLink.style.cssText = 'color: var(--interactive-accent); font-weight: 500; text-decoration: none; cursor: pointer;';
          hashtagLink.addEventListener('mouseenter', () => {
            hashtagLink.style.textDecoration = 'underline';
          });
          hashtagLink.addEventListener('mouseleave', () => {
            hashtagLink.style.textDecoration = 'none';
          });
          hashtagLink.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        } else {
          // Just highlight without link
          const hashtagSpan = container.createEl('span', { text: part });
          hashtagSpan.style.cssText = 'color: var(--interactive-accent); font-weight: 500;';
        }
      } else {
        // Regular text
        container.appendText(part);
      }
    }
  }

  /**
   * Render text with markdown links and plain URLs converted to HTML
   * Converts [text](url) and plain URLs to clickable <a> tags
   * YouTube timestamp links (e.g., [00:00](youtube.com/...&t=0s)) are handled specially
   * Also highlights hashtags
   */
  private renderMarkdownLinks(container: HTMLElement, text: string, videoId?: string, platform?: string): void {
    container.empty();

    // First, replace markdown links with a placeholder to avoid processing them again
    const markdownLinks: Array<{ text: string; url: string; isTimestamp: boolean; seconds?: number }> = [];
    const markdownPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let processedText = text.replace(markdownPattern, (_match, linkText, linkUrl) => {
      const index = markdownLinks.length;

      // Check if this is a YouTube timestamp link
      let isTimestamp = false;
      let seconds: number | undefined;

      if (videoId) {
        // Pattern: &t=123s or ?t=123s
        const timestampMatch = linkUrl.match(/[?&]t=(\d+)s?/);
        if (timestampMatch && (linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be'))) {
          isTimestamp = true;
          seconds = parseInt(timestampMatch[1]);
        }
      }

      markdownLinks.push({ text: linkText, url: linkUrl, isTimestamp, seconds });
      return `__MDLINK${index}__`;
    });

    // Now find plain URLs (not already in markdown format)
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts: Array<{ type: 'text' | 'markdown' | 'url'; content: string; url?: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlPattern.exec(processedText)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        const textBefore = processedText.substring(lastIndex, match.index);
        parts.push({ type: 'text', content: textBefore });
      }

      // Add the URL
      const url = match[1];
      if (url) {
        parts.push({ type: 'url', content: url, url });
      }

      lastIndex = urlPattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < processedText.length) {
      const textAfter = processedText.substring(lastIndex);
      parts.push({ type: 'text', content: textAfter });
    }

    // Render all parts
    for (const part of parts) {
      if (part.type === 'text') {
        // Check for markdown link placeholders
        const placeholderPattern = /__MDLINK(\d+)__/g;
        let textLastIndex = 0;
        let placeholderMatch: RegExpExecArray | null;

        while ((placeholderMatch = placeholderPattern.exec(part.content)) !== null) {
          // Add text before placeholder (with hashtag highlighting)
          if (placeholderMatch.index > textLastIndex) {
            const textBefore = part.content.substring(textLastIndex, placeholderMatch.index);
            this.renderTextWithHashtags(container, textBefore, platform);
          }

          // Add markdown link
          if (!placeholderMatch[1]) continue; // Skip if no group match
          const linkIndex = parseInt(placeholderMatch[1]);
          const linkData = markdownLinks[linkIndex];

          if (!linkData) continue; // Skip if linkData is undefined

          if (linkData.isTimestamp && linkData.seconds !== undefined && videoId) {
            // YouTube timestamp link - create button that seeks to timestamp
            const timestampBtn = container.createEl('a', {
              text: linkData.text,
              attr: {
                href: '#',
                title: 'Jump to timestamp in video'
              }
            });
            timestampBtn.style.cssText = 'color: var(--interactive-accent); text-decoration: underline; cursor: pointer; font-family: monospace; font-weight: 600;';
            timestampBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              // Find controller at click time (in case it wasn't ready during render)
              const controller = this.youtubeControllers.get(videoId);
              if (controller && linkData.seconds) {
                controller.seekTo(linkData.seconds);
                console.log('[Timeline] Seeking to timestamp:', linkData.seconds);
              } else {
                console.warn('[Timeline] YouTube controller not found for video:', videoId);
              }
            });
          } else {
            // Regular link
            const link = container.createEl('a', {
              text: linkData.text,
              attr: {
                href: linkData.url,
                target: '_blank',
                rel: 'noopener noreferrer'
              }
            });
            link.style.cssText = 'color: var(--interactive-accent); text-decoration: underline; cursor: pointer;';
            link.addEventListener('click', (e) => {
              e.stopPropagation();
            });
          }

          textLastIndex = placeholderPattern.lastIndex;
        }

        // Add remaining text (with hashtag highlighting)
        if (textLastIndex < part.content.length) {
          const textAfter = part.content.substring(textLastIndex);
          this.renderTextWithHashtags(container, textAfter, platform);
        }
      } else if (part.type === 'url' && part.url) {
        // Create clickable link for plain URL
        const link = container.createEl('a', {
          text: part.content,
          attr: {
            href: part.url,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        });
        link.style.cssText = 'color: var(--interactive-accent); text-decoration: underline; cursor: pointer;';
        link.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    }
  }

  public destroy(): void {
    this.containerEl.empty();
    this.youtubeControllers.clear();
  }

  /**
   * Reload the timeline (useful when view is re-activated)
   */
  public async reload(): Promise<void> {
    this.youtubeControllers.clear();
    await this.loadPosts();
  }
}
