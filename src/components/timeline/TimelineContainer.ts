import { setIcon, type TFile, type Vault, type App } from 'obsidian';
import type { PostData, Comment } from '../../types/post';
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

    // Header with search and refresh button
    const header = this.containerEl.createDiv();
    header.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 24px;';

    // Search filter
    const searchInput = header.createEl('input', {
      type: 'text',
      placeholder: 'Search posts...',
      cls: 'px-4 py-3 rounded-lg border border-[var(--background-modifier-border)] bg-[var(--background-primary)] text-[var(--text-normal)] focus:outline-none focus:border-[var(--interactive-accent)] focus:ring-2 focus:ring-[var(--interactive-accent-hover)]'
    });
    searchInput.style.flex = '1';
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.renderPosts();
    });

    // Refresh button
    const refreshBtn = header.createDiv();
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

    refreshBtn.addEventListener('click', async () => {
      // Add spinning animation
      refreshIcon.style.animation = 'spin 0.6s linear';
      refreshBtn.style.pointerEvents = 'none';

      await this.loadPosts();

      // Remove animation after completion
      setTimeout(() => {
        refreshIcon.style.animation = '';
        refreshBtn.style.pointerEvents = 'auto';
      }, 600);
    });

    // Filter posts
    const filtered = this.filterPosts(this.posts, this.searchQuery);
    const grouped = this.groupPostsByDate(filtered);

    // Render posts in single-column feed (max-width for readability)
    const feed = this.containerEl.createDiv({
      cls: 'flex flex-col gap-4 max-w-2xl mx-auto'
    });

    // Remove date separators - just render all posts
    for (const [groupLabel, groupPosts] of grouped) {
      for (const post of groupPosts) {
        this.renderPostCard(feed, post);
      }
    }
  }

  private renderPostCard(container: HTMLElement, post: PostData): void {
    const card = container.createDiv({
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
    iconWrapper.style.cssText = 'width: 24px; height: 24px;';
    const iconName = this.getPlatformIcon(post.platform);
    setIcon(iconWrapper, iconName);

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
    timeSpan.setText(this.getRelativeTime(post.metadata.timestamp));

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

    if (isLongContent) {
      const preview = cleanContent.substring(0, previewLength);
      contentText.setText(preview + '...');

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
          contentText.setText(cleanContent);
          seeMoreBtn.setText('See less');
        } else {
          contentText.setText(preview + '...');
          seeMoreBtn.setText('See more');
        }
      });
    } else {
      contentText.setText(cleanContent);
    }

    // Debug: Log post platform and url
    console.log('[Timeline] Post platform:', post.platform, 'URL:', post.url);

    // YouTube embed (if YouTube platform)
    if (post.platform === 'youtube' && post.videoId) {
      console.log('[Timeline] Rendering YouTube embed');
      this.renderYouTubeEmbed(contentArea, post.videoId);
    }
    // TikTok embed (if TikTok platform)
    else if (post.platform === 'tiktok' && post.url) {
      console.log('[Timeline] Detected TikTok platform, rendering embed');
      this.renderTikTokEmbed(contentArea, post.url);
    }
    // Media carousel (if images exist)
    else if (post.media.length > 0) {
      console.log('[Timeline] Rendering media carousel');
      this.renderMediaCarousel(contentArea, post.media);
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
      likeIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
      setIcon(likeIcon, 'heart');

      const likeCount = likeBtn.createSpan({ text: this.formatNumber(post.metadata.likes) });
      likeCount.style.minWidth = '20px';
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
      commentIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
      setIcon(commentIcon, 'message-circle');

      const commentCount = commentBtn.createSpan({ text: this.formatNumber(post.metadata.comments) });
      commentCount.style.minWidth = '20px';
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
      shareIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
      setIcon(shareIcon, 'repeat-2');

      const shareCount = shareBtn.createSpan({ text: this.formatNumber(post.metadata.shares) });
      shareCount.style.minWidth = '20px';
    }

    // Spacer
    const spacer = interactions.createDiv();
    spacer.style.flex = '1';

    // Archive button (right-aligned)
    const archiveBtn = interactions.createDiv();
    archiveBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
    archiveBtn.setAttribute('title', 'Archive this post');
    archiveBtn.addEventListener('mouseenter', () => {
      archiveBtn.style.color = 'var(--interactive-accent)';
    });
    archiveBtn.addEventListener('mouseleave', () => {
      archiveBtn.style.color = 'var(--text-muted)';
    });

    const archiveIcon = archiveBtn.createDiv();
    archiveIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0;';
    setIcon(archiveIcon, 'archive');

    // Archive button click handler
    archiveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.archivePost(post, card);
    });

    // Comments section (Instagram style)
    if (post.comments && post.comments.length > 0) {
      this.renderComments(contentArea, post.comments);
    }

    // Click handler for entire card (opens note)
    card.addEventListener('click', async () => {
      await this.openNote(post);
    });
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

    // Comment content: **username** content (on same line)
    const contentSpan = commentDiv.createSpan();

    const usernameSpan = contentSpan.createEl('strong');
    usernameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal); cursor: pointer;';
    usernameSpan.setText(comment.author.username || comment.author.name);

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
  private renderMediaCarousel(container: HTMLElement, media: Media[]): void {
    const carouselContainer = container.createDiv({
      cls: 'relative mt-3 rounded-lg overflow-hidden bg-[var(--background-modifier-border)]'
    });

    // Media container - preserves aspect ratio with max-height
    const mediaContainer = carouselContainer.createDiv();
    mediaContainer.style.cssText = 'position: relative; width: 100%; max-height: 600px; min-height: 200px; display: flex; align-items: center; justify-content: center;';

    let currentIndex = 0;

    // Create all media elements (hidden except current)
    const mediaElements: HTMLElement[] = [];
    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i];
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

      // Counter indicator (top-right)
      const counter = carouselContainer.createDiv();
      counter.style.cssText = 'position: absolute; top: 12px; right: 12px; padding: 4px 8px; border-radius: 4px; background: rgba(0, 0, 0, 0.5); color: white; font-size: 12px; z-index: 10;';
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
   * Render YouTube embed iframe
   */
  private renderYouTubeEmbed(container: HTMLElement, videoId: string): void {
    const embedContainer = container.createDiv();
    embedContainer.style.cssText = 'position: relative; width: 100%; padding-bottom: 56.25%; margin: 12px 0; border-radius: 8px; overflow: hidden; background: var(--background-secondary);';

    const iframe = embedContainer.createEl('iframe', {
      attr: {
        src: `https://www.youtube.com/embed/${videoId}`,
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true',
      }
    });
    iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
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
   * Archive a post (set archive: true in YAML and remove from view)
   */
  private async archivePost(post: PostData, cardElement: HTMLElement): Promise<void> {
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

    if (!match) {
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

      const allFiles = this.vault.getMarkdownFiles();
      console.log('[Timeline] Total markdown files in vault:', allFiles.length);

      const archiveFiles = allFiles.filter(file =>
        file.path.startsWith(this.archivePath)
      );

      console.log(`[Timeline] Found ${archiveFiles.length} files in ${this.archivePath}`);
      console.log('[Timeline] Archive file paths:', archiveFiles.map(f => f.path));

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

      console.log('[Timeline] Loading file:', file.path);
      console.log('[Timeline] Frontmatter:', frontmatter);

      if (!frontmatter || !frontmatter.platform) {
        console.log('[Timeline] No frontmatter or platform, skipping');
        return null;
      }

      // Filter out archived posts (archive: true)
      if (frontmatter.archive === true) {
        console.log('[Timeline] Post is archived, skipping');
        return null;
      }

      const content = await this.vault.read(file);
      const contentText = this.extractContentText(content);
      const metadata = this.extractMetadata(content);
      const mediaUrls = this.extractMedia(content);
      const comments = this.extractComments(content);

      const postData: PostData = {
        platform: frontmatter.platform as any,
        id: file.basename,
        url: frontmatter.originalUrl || '',
        videoId: (frontmatter as any).videoId, // YouTube video ID
        filePath: file.path, // Store file path for opening
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

      console.log('[Timeline] Loaded post:', postData.platform, postData.id, 'URL:', postData.url);

      return postData;
    } catch (err) {
      console.warn(`[Timeline] Failed to load ${file.path}:`, err);
      return null;
    }
  }

  private extractContentText(markdown: string): string {
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

  /**
   * Extract metadata from markdown footer (Likes, Comments, Shares)
   */
  private extractMetadata(markdown: string): { likes?: number; comments?: number; shares?: number; views?: number } {
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
  private extractMedia(markdown: string): string[] {
    const mediaUrls: string[] = [];

    // Match ![image N](path) format
    const imageRegex = /!\[.*?\]\((.*?)\)/g;

    let match;
    while ((match = imageRegex.exec(markdown)) !== null) {
      const url = match[1];
      if (url && url.startsWith('attachments/')) {
        mediaUrls.push(url);
      }
    }

    return mediaUrls;
  }

  /**
   * Extract comments from markdown
   */
  private extractComments(markdown: string): Comment[] {
    const comments: Comment[] = [];

    // Find comments section
    const commentsMatch = markdown.match(/## 💬 Comments\n\n([\s\S]*?)(?=\n---\n\n\*\*Platform:|$)/);
    if (!commentsMatch) {
      return comments;
    }

    const commentsSection = commentsMatch[1];

    // Split by comment separator (--- between comments)
    const commentBlocks = commentsSection.split(/\n---\n\n/).filter(block => block.trim());

    for (const block of commentBlocks) {
      const lines = block.split('\n');
      if (lines.length === 0) continue;

      // Parse main comment header: **[@username](url)** [· timestamp] [· likes]
      // Timestamp is optional since Instagram comments don't have timestamp from API
      const headerMatch = lines[0].match(/\*\*\[?@?([^\]]*)\]?\(?([^)]*)\)?\*\*(?:(?: · ([^·\n]+))?)(?: · (\d+) likes)?/);
      if (!headerMatch) continue;

      const [, username, url, timestamp, likesStr] = headerMatch;

      // Extract comment content (lines after header, before any replies)
      const contentLines: string[] = [];
      let i = 1;
      while (i < lines.length && !lines[i].trim().startsWith('↳')) {
        contentLines.push(lines[i]);
        i++;
      }
      const content = contentLines.join('\n').trim();

      // Parse replies (lines starting with ↳)
      const replies: Comment[] = [];
      while (i < lines.length) {
        if (lines[i].trim().startsWith('↳')) {
          // Reply header: ↳ **[@username](url)** [· timestamp] [· likes]
          const replyHeaderMatch = lines[i].match(/↳ \*\*\[?@?([^\]]*)\]?\(?([^)]*)\)?\*\*(?:(?: · ([^·\n]+))?)(?: · (\d+) likes)?/);
          if (replyHeaderMatch) {
            const [, replyUsername, replyUrl, replyTimestamp, replyLikesStr] = replyHeaderMatch;
            i++;

            // Get reply content (lines starting with "  " but not "  ↳")
            const replyContentLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('  ') && !lines[i].trim().startsWith('↳')) {
              replyContentLines.push(lines[i].substring(2)); // Remove the 2-space indent
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
              timestamp: replyTimestamp?.trim() || '',
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
        timestamp: timestamp?.trim() || '',
        likes: likesStr ? parseInt(likesStr) : undefined,
        replies: replies.length > 0 ? replies : undefined,
      });
    }

    return comments;
  }

  /**
   * Get platform-specific lucide icon name
   */
  private getPlatformIcon(platform: string): string {
    const iconMap: Record<string, string> = {
      facebook: 'facebook',
      instagram: 'instagram',
      linkedin: 'linkedin',
      x: 'twitter', // X/Twitter (lucide doesn't have X icon yet)
      twitter: 'twitter',
      tiktok: 'video', // TikTok video platform
      threads: 'at-sign',
      youtube: 'youtube'
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

  public destroy(): void {
    this.containerEl.empty();
  }

  /**
   * Reload the timeline (useful when view is re-activated)
   */
  public async reload(): Promise<void> {
    await this.loadPosts();
  }
}
