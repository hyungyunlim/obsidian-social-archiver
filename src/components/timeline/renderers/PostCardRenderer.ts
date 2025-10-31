import { setIcon, Notice, Scope, type TFile, type Vault, type App } from 'obsidian';
import type { PostData, Media } from '../../../types/post';
import type SocialArchiverPlugin from '../../../main';
import {
  siFacebook,
  siInstagram,
  siTiktok,
  siX,
  siThreads,
  siYoutube,
  siReddit,
  type PlatformIcon as SimpleIcon
} from '../../../constants/platform-icons';
import { MediaGalleryRenderer } from './MediaGalleryRenderer';
import { CommentRenderer } from './CommentRenderer';
import { YouTubeEmbedRenderer } from './YouTubeEmbedRenderer';
import { YouTubePlayerController } from '../controllers/YouTubePlayerController';

/**
 * PostCardRenderer - Renders individual post cards
 * Handles post card HTML generation, interactions, and state updates
 */
export class PostCardRenderer {
  private vault: Vault;
  private app: App;
  private plugin: SocialArchiverPlugin;

  // Renderer dependencies
  private mediaGalleryRenderer: MediaGalleryRenderer;
  private commentRenderer: CommentRenderer;
  private youtubeEmbedRenderer: YouTubeEmbedRenderer;

  // YouTube player controllers map (shared with parent)
  private youtubeControllers: Map<string, YouTubePlayerController>;

  // Callback for archive toggle
  private onArchiveToggleCallback?: (post: PostData, newArchiveStatus: boolean, cardElement: HTMLElement) => void;

  constructor(
    vault: Vault,
    app: App,
    plugin: SocialArchiverPlugin,
    mediaGalleryRenderer: MediaGalleryRenderer,
    commentRenderer: CommentRenderer,
    youtubeEmbedRenderer: YouTubeEmbedRenderer,
    youtubeControllers: Map<string, YouTubePlayerController>
  ) {
    this.vault = vault;
    this.app = app;
    this.plugin = plugin;
    this.mediaGalleryRenderer = mediaGalleryRenderer;
    this.commentRenderer = commentRenderer;
    this.youtubeEmbedRenderer = youtubeEmbedRenderer;
    this.youtubeControllers = youtubeControllers;
  }

  /**
   * Set callback for archive toggle events
   */
  public onArchiveToggle(callback: (post: PostData, newArchiveStatus: boolean, cardElement: HTMLElement) => void): void {
    this.onArchiveToggleCallback = callback;
  }

  /**
   * Main render method for post card
   * Returns the root element (wrapper if comment exists, otherwise cardContainer)
   */
  public render(container: HTMLElement, post: PostData): HTMLElement {
    // Always create wrapper for entire card (for consistent structure)
    const wrapper = container.createDiv({ cls: 'mb-4' });
    const rootElement: HTMLElement = wrapper;

    const userName = this.plugin.settings.userName || 'You';
    const archivedTime = this.getRelativeTime(post.archivedDate);

    if (post.comment) {
      // Comment section container (editable)
      const commentSection = wrapper.createDiv({ cls: 'mb-3' });
      commentSection.style.cssText = 'position: relative; cursor: pointer;';

      // Comment header: "Jun commented on this post · 2h ago"
      const commentHeader = commentSection.createDiv({ cls: 'mb-2' });
      commentHeader.style.cssText = 'font-size: 13px; color: var(--text-muted);';

      const userNameSpan = commentHeader.createSpan({ text: userName });
      userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

      commentHeader.createSpan({ text: ' commented on this post' });

      // Add archived time
      if (archivedTime) {
        commentHeader.createSpan({ text: ` · ${archivedTime}` });
      }

      // Comment text with inline edit icon
      const commentTextContainer = commentSection.createDiv();
      commentTextContainer.style.cssText = 'display: inline;';

      const commentTextDiv = commentTextContainer.createSpan();
      commentTextDiv.style.cssText = 'font-size: 14px; line-height: 1.5; color: var(--text-normal);';
      this.renderMarkdownLinks(commentTextDiv, post.comment, undefined, post.platform);

      // Edit icon (appears on hover, inline at the end of text)
      const editIcon = commentTextContainer.createSpan();
      editIcon.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 6px;
        width: 14px;
        height: 14px;
        opacity: 0;
        transition: opacity 0.2s;
        color: var(--text-muted);
        vertical-align: middle;
      `;
      setIcon(editIcon, 'pencil');

      // Hover effects
      commentSection.addEventListener('mouseenter', () => {
        editIcon.style.opacity = '0.6';
      });
      commentSection.addEventListener('mouseleave', () => {
        editIcon.style.opacity = '0';
      });

      // Click to edit inline
      commentSection.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editCommentInline(post, commentSection);
      });
    } else {
      // Saved header: "Jun saved this post · 2h ago" (clickable to add note inline)
      const savedSection = wrapper.createDiv({ cls: 'mb-3' });
      savedSection.style.cssText = 'position: relative; cursor: pointer;';

      const savedHeader = savedSection.createDiv();
      savedHeader.style.cssText = 'font-size: 13px; color: var(--text-muted); display: inline;';

      const userNameSpan = savedHeader.createSpan({ text: userName });
      userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

      savedHeader.createSpan({ text: ' saved this post' });

      // Add archived time
      if (archivedTime) {
        savedHeader.createSpan({ text: ` · ${archivedTime}` });
      }

      // Edit icon (appears on hover, inline at the end)
      const editIcon = savedSection.createSpan();
      editIcon.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 6px;
        width: 14px;
        height: 14px;
        opacity: 0;
        transition: opacity 0.2s;
        color: var(--text-muted);
        vertical-align: middle;
      `;
      setIcon(editIcon, 'pencil');

      // Hover effects - only show icon
      savedSection.addEventListener('mouseenter', () => {
        editIcon.style.opacity = '0.6';
      });
      savedSection.addEventListener('mouseleave', () => {
        editIcon.style.opacity = '0';
      });

      // Click to add note inline (same as comment editing)
      savedSection.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editCommentInline(post, savedSection);
      });
    }

    // Create nested container for the actual card (always nested now)
    const cardContainer = wrapper.createDiv();
    cardContainer.style.cssText = 'padding-left: 16px; border-left: 2px solid var(--background-modifier-border); margin-left: 4px;';

    const card = cardContainer.createDiv({
      cls: 'relative p-4 rounded-lg bg-[var(--background-primary)] transition-all duration-200'
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
      card.style.backgroundColor = 'var(--background-primary)';
    });

    // Avatar (platform icon) - Top right corner
    this.renderAvatar(card, post);

    // Content area
    const contentArea = card.createDiv({ cls: 'pr-14' });

    // Header: Author + Time
    this.renderHeader(contentArea, post);

    // Content (full text with expand/collapse)
    this.renderContent(contentArea, post);

    // Debug: Log post platform and url
    console.log('[PostCardRenderer] Post platform:', post.platform, 'URL:', post.url);

    // YouTube embed (if YouTube platform)
    if (post.platform === 'youtube' && post.videoId) {
      console.log('[PostCardRenderer] Rendering YouTube embed for video:', post.videoId);
      const iframe = this.youtubeEmbedRenderer.renderYouTube(contentArea, post.videoId);

      // Create player controller for this YouTube video
      const controller = new YouTubePlayerController(iframe);
      this.youtubeControllers.set(post.id, controller);
      console.log('[PostCardRenderer] YouTube controller created for post:', post.id);
    }
    // TikTok embed (if TikTok platform)
    else if (post.platform === 'tiktok' && post.url) {
      console.log('[PostCardRenderer] Detected TikTok platform, rendering embed');
      this.youtubeEmbedRenderer.renderTikTok(contentArea, post.url);
    }
    // Media carousel (if images exist)
    else if (post.media.length > 0) {
      console.log('[PostCardRenderer] Rendering media carousel');
      this.mediaGalleryRenderer.render(contentArea, post.media, post);
    } else {
      console.log('[PostCardRenderer] No media to render');
    }

    // Interaction bar
    this.renderInteractions(contentArea, post, rootElement);

    // Comments section (Instagram style)
    if (post.comments && post.comments.length > 0) {
      this.commentRenderer.render(contentArea, post.comments, post.platform);
    }

    return rootElement;
  }

  /**
   * Render avatar (platform icon) in top right corner
   */
  private renderAvatar(card: HTMLElement, post: PostData): void {
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
  }

  /**
   * Render header (author name + timestamp)
   */
  private renderHeader(contentArea: HTMLElement, post: PostData): void {
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
  }

  /**
   * Render content text with expand/collapse
   */
  private renderContent(contentArea: HTMLElement, post: PostData): void {
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
  }

  /**
   * Render interaction bar (likes, comments, shares, actions)
   */
  private renderInteractions(contentArea: HTMLElement, post: PostData, rootElement: HTMLElement): void {
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

    // Personal Like button (star icon, right-aligned)
    this.renderPersonalLikeButton(interactions, post);

    // Share button (right-aligned)
    this.renderShareButton(interactions, post);

    // Archive button (right-aligned)
    this.renderArchiveButton(interactions, post, rootElement);

    // Open Note button (right-aligned)
    this.renderOpenNoteButton(interactions, post);

    // Delete button (right-aligned)
    this.renderDeleteButton(interactions, post, rootElement);
  }

  /**
   * Render personal like button
   */
  private renderPersonalLikeButton(parent: HTMLElement, post: PostData): void {
    const personalLikeBtn = parent.createDiv();
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
  }

  /**
   * Render archive button
   */
  private renderArchiveButton(parent: HTMLElement, post: PostData, rootElement: HTMLElement): void {
    const archiveBtn = parent.createDiv();
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
      await this.toggleArchive(post, archiveBtn, archiveIcon, rootElement);
    });
  }

  /**
   * Render open note button
   */
  private renderOpenNoteButton(parent: HTMLElement, post: PostData): void {
    const openNoteBtn = parent.createDiv();
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
  }

  /**
   * Render delete button
   */
  private renderDeleteButton(parent: HTMLElement, post: PostData, rootElement: HTMLElement): void {
    const deleteBtn = parent.createDiv();
    deleteBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';
    deleteBtn.setAttribute('title', 'Delete this post');
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.color = 'var(--text-error)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.color = 'var(--text-muted)';
    });

    const deleteIcon = deleteBtn.createDiv();
    deleteIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';
    setIcon(deleteIcon, 'trash-2');

    // Delete button click handler
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.deletePost(post, rootElement);
    });
  }

  /**
   * Render share button
   */
  private renderShareButton(parent: HTMLElement, post: PostData): void {
    const shareBtn = parent.createDiv();
    shareBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; transition: color 0.2s;';

    // Check if already shared
    const isShared = !!(post as any).shareUrl;
    const shareUrl = (post as any).shareUrl;

    // Set tooltip
    shareBtn.setAttribute('title', isShared ? 'Shared - Click to unshare' : 'Share this post to the web');

    const shareIcon = shareBtn.createDiv();
    shareIcon.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;';

    // Use different icons for shared vs unshared state
    if (isShared) {
      setIcon(shareIcon, 'link');
      shareBtn.style.color = 'var(--interactive-accent)';
    } else {
      setIcon(shareIcon, 'share-2');
      shareBtn.style.color = 'var(--text-muted)';
    }

    // Hover effects
    shareBtn.addEventListener('mouseenter', () => {
      shareBtn.style.color = 'var(--interactive-accent)';
    });
    shareBtn.addEventListener('mouseleave', () => {
      shareBtn.style.color = isShared ? 'var(--interactive-accent)' : 'var(--text-muted)';
    });

    // Share button click handler
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (isShared && shareUrl) {
        // Click to unshare
        await this.unsharePost(post, shareBtn, shareIcon);
      } else if (!isShared) {
        // Create new share
        await this.createShare(post, shareBtn, shareIcon);
      }
    });
  }

  /**
   * Create share link for post
   */
  private async createShare(post: PostData, shareBtn: HTMLElement, shareIcon: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        new Notice('Cannot share: file path not found');
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        new Notice('Cannot share: file not found');
        return;
      }

      const tfile = file as TFile;

      // Show loading state
      shareBtn.style.color = 'var(--text-muted)';
      shareBtn.style.opacity = '0.5';
      shareBtn.style.cursor = 'wait';

      // Read original file content
      const originalContent = await this.vault.read(tfile);

      // Extract link previews from post content
      console.log('[PostCardRenderer] Extracting link previews:', {
        hasContent: !!post.content?.text,
        contentLength: post.content?.text?.length,
        hasExtractor: !!this.plugin.linkPreviewExtractor,
        platform: post.platform
      });

      const linkPreviews = post.content?.text && this.plugin.linkPreviewExtractor
        ? this.plugin.linkPreviewExtractor.extractUrls(post.content.text, post.platform)
        : [];

      console.log('[PostCardRenderer] Link previews extracted:', {
        count: linkPreviews.length,
        previews: linkPreviews
      });

      // Generate share ID first
      const shareId = this.generateShareId();
      const workerUrl = this.plugin.settings.workerUrl || 'https://social-archiver-api.junlim.org';

      // Generate username from display name (temporary until proper signup)
      const displayName = this.plugin.settings.userName || 'anonymous';
      const username = displayName.toLowerCase()
        .replace(/\s+/g, '-')  // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '')  // Remove special characters
        .substring(0, 30);  // Limit length

      // PHASE 1: Create share WITHOUT media first (for instant link)
      const hasMedia = post.media && post.media.length > 0;

      // Prepare PostData WITHOUT media for instant share creation
      const postData = {
        platform: post.platform,
        id: post.id,
        url: post.url,
        videoId: post.videoId,
        author: {
          name: post.author.name,
          url: post.author.url,
          avatar: post.author.avatar,
          handle: post.author.handle,
          verified: post.author.verified
        },
        content: {
          text: post.content.text,
          html: post.content.html,
          hashtags: post.content.hashtags
        },
        media: [], // Empty array for instant share creation - will update with media later
        metadata: {
          likes: post.metadata.likes,
          comments: post.metadata.comments,
          shares: post.metadata.shares,
          views: post.metadata.views,
          bookmarks: post.metadata.bookmarks,
          timestamp: typeof post.metadata.timestamp === 'string'
            ? post.metadata.timestamp
            : post.metadata.timestamp.toISOString()
        },
        comments: post.comments || [],
        linkPreviews: post.linkPreviews || [], // Include link previews for web display
        title: post.title,
        thumbnail: post.thumbnail,
        archivedDate: post.archivedDate, // Include archive timestamp
        comment: post.comment, // Include user's personal comment/note
        like: post.like, // Include user's personal like status
        archive: post.archive // Include archive status
      };

      // Create share request with full post data
      const shareRequest = {
        postData,
        options: {
          expiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days for free tier
          username: username,  // Username for URL generation
          shareId: shareId  // Include shareId so Worker uses our ID
        }
      };

      console.log('[PostCardRenderer] Phase 1 POST - shareRequest:', JSON.stringify({ shareId, username, hasShareId: !!shareRequest.options.shareId }));

      // Call Worker API to create share
      const response = await fetch(`${workerUrl}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shareRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[PostCardRenderer] Share API error:', errorData);
        throw new Error(`Share creation failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Invalid share response');
      }

      const shareData = result.data;
      // Use shareUrl from Worker API response (already points to share-web)
      const shareUrl = shareData.shareUrl;

      // Update YAML frontmatter in ORIGINAL content (preserves all existing fields)
      const yamlUpdates: Record<string, any> = {
        share: true,
        shareUrl: shareUrl,
        shareExpiry: shareData.expiresAt ? new Date(shareData.expiresAt) : undefined,
      };

      // Add linkPreviews if any were found
      if (linkPreviews.length > 0) {
        yamlUpdates.linkPreviews = linkPreviews;
        console.log('[PostCardRenderer] Adding linkPreviews to YAML:', linkPreviews);
      } else {
        console.log('[PostCardRenderer] No linkPreviews to add to YAML');
      }

      console.log('[PostCardRenderer] YAML updates:', yamlUpdates);
      const updatedContent = this.updateYamlFrontmatter(originalContent, yamlUpdates);
      await this.vault.modify(tfile, updatedContent);
      console.log('[PostCardRenderer] YAML updated successfully');

      // Update post object
      (post as any).shareUrl = shareUrl;

      // Update UI to show shared state
      shareBtn.style.opacity = '1';
      shareBtn.style.cursor = 'pointer';
      shareBtn.style.color = 'var(--interactive-accent)';
      shareBtn.setAttribute('title', 'Shared - Click to copy link');

      // Update icon to link icon
      const shareIcon = shareBtn.querySelector('div');
      if (shareIcon) {
        setIcon(shareIcon as HTMLElement, 'link');
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      const mediaMessage = hasMedia ? ' (uploading images...)' : '';
      new Notice(`✅ Published! Share link copied to clipboard.${mediaMessage}`);

      console.log('[PostCardRenderer] Share created:', { shareUrl, expiresAt: shareData.expiresAt });

      // PHASE 2: Upload media in background and update share
      if (hasMedia) {
        this.uploadMediaAndUpdateShare(post, shareId, username, workerUrl, shareUrl)
          .catch(err => {
            console.error('[PostCardRenderer] Background media upload failed:', err);
            new Notice('⚠️ Some images failed to upload');
          });
      }

    } catch (err) {
      console.error('[PostCardRenderer] Failed to create share:', err);
      new Notice('Failed to publish post');

      // Reset button state
      shareBtn.style.opacity = '1';
      shareBtn.style.cursor = 'pointer';
      shareBtn.style.color = 'var(--text-muted)';
    }
  }

  /**
   * Upload media in background and update share
   */
  private async uploadMediaAndUpdateShare(
    post: PostData,
    shareId: string,
    username: string,
    workerUrl: string,
    shareUrl: string
  ): Promise<void> {
    console.log('[PostCardRenderer] Starting background media upload for share:', shareId);

    // Progress tracking with Notice
    let progressNotice: Notice | null = null;
    const totalImages = post.media.length;

    const onProgress = (current: number, total: number) => {
      // Hide previous notice
      if (progressNotice) {
        progressNotice.hide();
      }
      // Show new progress notice
      progressNotice = new Notice(`Uploading images... (${current}/${total})`, 0); // 0 = don't auto-hide
    };

    try {
      // Upload media files to R2 with progress callback
      const remoteMedia = await this.uploadMediaFilesToR2(post.media, shareId, workerUrl, onProgress);

    // Prepare updated PostData with media
    const postDataWithMedia = {
      platform: post.platform,
      id: post.id,
      url: post.url,
      videoId: post.videoId,
      author: {
        name: post.author.name,
        url: post.author.url,
        avatar: post.author.avatar,
        handle: post.author.handle,
        verified: post.author.verified
      },
      content: {
        text: post.content.text,
        html: post.content.html,
        hashtags: post.content.hashtags
      },
      media: remoteMedia, // Now with uploaded media URLs
      metadata: {
        likes: post.metadata.likes,
        comments: post.metadata.comments,
        shares: post.metadata.shares,
        views: post.metadata.views,
        bookmarks: post.metadata.bookmarks,
        timestamp: typeof post.metadata.timestamp === 'string'
          ? post.metadata.timestamp
          : post.metadata.timestamp.toISOString()
      },
      comments: post.comments || [],
      linkPreviews: post.linkPreviews || [], // Include link previews for web display
      title: post.title,
      thumbnail: post.thumbnail,
      archivedDate: post.archivedDate,
      comment: post.comment,
      like: post.like,
      archive: post.archive
    };

    // Update share with media (same shareId will overwrite in KV)
    const updateRequest = {
      postData: postDataWithMedia,
      options: {
        expiry: Date.now() + (30 * 24 * 60 * 60 * 1000),
        username: username,
        shareId: shareId // Include shareId to overwrite existing share
      }
    };

    console.log('[PostCardRenderer] Phase 2 POST - updateRequest:', JSON.stringify({ shareId, username, hasShareId: !!updateRequest.options.shareId, mediaCount: postDataWithMedia.media.length }));

    const response = await fetch(`${workerUrl}/api/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateRequest),
    });

    if (!response.ok) {
      throw new Error(`Media update failed: ${response.statusText}`);
    }

      // Hide progress notice and show completion message
      if (progressNotice) {
        progressNotice.hide();
      }

      console.log('[PostCardRenderer] Media uploaded and share updated:', shareId);
      new Notice(`✅ All ${totalImages} image${totalImages > 1 ? 's' : ''} uploaded successfully!`);
    } catch (err) {
      // Hide progress notice on error
      if (progressNotice) {
        progressNotice.hide();
      }
      // Re-throw to be handled by caller
      throw err;
    }
  }

  /**
   * Unshare post - delete from Worker API and remove from YAML
   */
  private async unsharePost(post: PostData, shareBtn: HTMLElement, shareIcon: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        new Notice('Cannot unshare: file path not found');
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        new Notice('Cannot unshare: file not found');
        return;
      }

      const tfile = file as TFile;
      const shareUrl = (post as any).shareUrl;

      if (!shareUrl) {
        new Notice('Post is not shared');
        return;
      }

      // Extract shareId from URL
      // URL format: https://social-archive.junlim.org/username/shareId
      const shareId = shareUrl.split('/').pop();
      if (!shareId) {
        new Notice('Invalid share URL');
        return;
      }

      // Show loading state
      shareBtn.style.opacity = '0.5';
      shareBtn.style.cursor = 'wait';

      // Delete from Worker API
      const workerUrl = this.plugin.settings.workerUrl || 'https://social-archiver-api.junlim.org';
      // TODO: Implement proper authentication for delete operations
      // Current implementation just checks if any license key exists, not validating it
      // Proper solution: Generate a delete token when creating shares and use that for auth
      // Use a dummy license key if none is configured (temporary fix)
      const licenseKey = this.plugin.settings.licenseKey || 'free-user';

      const response = await fetch(`${workerUrl}/api/share/${shareId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-License-Key': licenseKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[PostCardRenderer] Unshare API error:', errorData);
        throw new Error(`Unshare failed: ${response.statusText}`);
      }

      // Read file content
      const content = await this.vault.read(tfile);

      // Remove share-related fields from YAML frontmatter
      const updatedContent = this.removeShareFromYaml(content);
      await this.vault.modify(tfile, updatedContent);

      // Update post object
      delete (post as any).shareUrl;

      // Update UI to show unshared state
      shareBtn.style.opacity = '1';
      shareBtn.style.cursor = 'pointer';
      shareBtn.style.color = 'var(--text-muted)';
      shareBtn.setAttribute('title', 'Share this post to the web');

      // Update icon to share icon
      setIcon(shareIcon, 'share-2');

      new Notice('✅ Post unshared successfully');

      console.log('[PostCardRenderer] Post unshared:', shareId);

    } catch (err) {
      console.error('[PostCardRenderer] Failed to unshare:', err);
      new Notice('Failed to unshare post');

      // Reset button state
      shareBtn.style.opacity = '1';
      shareBtn.style.cursor = 'pointer';
    }
  }

  /**
   * Open the original note in Obsidian
   */
  private async openNote(post: PostData): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[PostCardRenderer] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file) {
        console.warn('[PostCardRenderer] File not found:', filePath);
        return;
      }

      // Check if it's a TFile
      if ('extension' in file) {
        // Open the file in a new leaf
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.openFile(file as TFile);
      } else {
        console.warn('[PostCardRenderer] Not a file:', filePath);
      }
    } catch (err) {
      console.error('[PostCardRenderer] Failed to open note:', err);
    }
  }

  /**
   * Delete post and remove card from timeline
   */
  private async deletePost(post: PostData, rootElement: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[PostCardRenderer] No file path for post:', post.id);
        new Notice('Cannot delete post: file path not found');
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[PostCardRenderer] File not found:', filePath);
        new Notice('Cannot delete post: file not found');
        return;
      }

      // Count media files that will be deleted (all relative paths, not http(s) URLs)
      const mediaCount = post.media.filter(m =>
        m.url && !m.url.startsWith('http://') && !m.url.startsWith('https://')
      ).length;
      const mediaText = mediaCount > 0 ? `\n${mediaCount} media file(s) will also be deleted.\n` : '';

      // Show confirmation dialog
      const confirmed = confirm(
        `Are you sure you want to delete this post?\n\n` +
        `Author: ${post.author.name}\n` +
        `Platform: ${post.platform}\n` +
        mediaText +
        `\nThis action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      const tfile = file as TFile;

      // Animate card removal (fade out and slide up)
      rootElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      rootElement.style.opacity = '0';
      rootElement.style.transform = 'translateY(-10px)';

      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Delete media files first (all relative paths, not http(s) URLs)
      const deletedMedia: string[] = [];
      const failedMedia: string[] = [];
      let mediaFolderPath: string | null = null;

      for (const media of post.media) {
        if (media.url && !media.url.startsWith('http://') && !media.url.startsWith('https://')) {
          try {
            const mediaFile = this.vault.getAbstractFileByPath(media.url);
            if (mediaFile && 'extension' in mediaFile) {
              // Extract parent folder path from first media file
              if (!mediaFolderPath) {
                const pathParts = media.url.split('/');
                pathParts.pop(); // Remove filename
                mediaFolderPath = pathParts.join('/');
              }

              await this.vault.delete(mediaFile as TFile);
              deletedMedia.push(media.url);
              console.log('[PostCardRenderer] Deleted media:', media.url);
            }
          } catch (err) {
            console.warn('[PostCardRenderer] Failed to delete media:', media.url, err);
            failedMedia.push(media.url);
          }
        }
      }

      // Delete media folder if it's empty
      if (mediaFolderPath) {
        try {
          const mediaFolder = this.vault.getAbstractFileByPath(mediaFolderPath);
          if (mediaFolder && !('extension' in mediaFolder)) {
            const folderContents = await this.vault.adapter.list(mediaFolderPath);
            if (folderContents.files.length === 0 && folderContents.folders.length === 0) {
              await this.vault.adapter.rmdir(mediaFolderPath, false);
              console.log('[PostCardRenderer] Deleted empty media folder:', mediaFolderPath);
            }
          }
        } catch (err) {
          console.warn('[PostCardRenderer] Failed to delete media folder:', mediaFolderPath, err);
        }
      }

      // Delete the markdown file
      await this.vault.delete(tfile);

      // Remove from DOM
      rootElement.remove();

      // Show success notice
      const successMsg = deletedMedia.length > 0
        ? `Post and ${deletedMedia.length} media file(s) deleted successfully`
        : 'Post deleted successfully';
      new Notice(successMsg);

      if (failedMedia.length > 0) {
        console.warn('[PostCardRenderer] Some media files could not be deleted:', failedMedia);
      }

      console.log('[PostCardRenderer] Deleted post:', post.id, filePath);
    } catch (err) {
      console.error('[PostCardRenderer] Failed to delete post:', err);
      new Notice('Failed to delete post. Check console for details.');
    }
  }

  /**
   * Toggle personal like status for a post
   */
  private async togglePersonalLike(post: PostData, btn: HTMLElement, icon: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[PostCardRenderer] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[PostCardRenderer] File not found:', filePath);
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

      console.log('[PostCardRenderer] Toggled personal like:', post.id, newLikeStatus);
    } catch (err) {
      console.error('[PostCardRenderer] Failed to toggle personal like:', err);
    }
  }

  /**
   * Edit comment inline (replace with textarea)
   */
  private async editCommentInline(post: PostData, commentSection: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[PostCardRenderer] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[PostCardRenderer] File not found:', filePath);
        return;
      }

      const tfile = file as TFile;

      // Save original comment value
      const originalComment = post.comment;
      const hasComment = !!originalComment;

      // Helper function to restore original UI
      const restoreOriginalUI = () => {
        commentSection.empty();
        commentSection.style.cssText = 'position: relative; cursor: pointer;';

        const userName = this.plugin.settings.userName || 'You';
        const archivedTime = this.getRelativeTime(post.archivedDate);

        if (hasComment) {
          // Restore comment UI: "Jun commented on this post · 2h ago"
          const commentHeader = commentSection.createDiv({ cls: 'mb-2' });
          commentHeader.style.cssText = 'font-size: 13px; color: var(--text-muted);';

          const userNameSpan = commentHeader.createSpan({ text: userName });
          userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

          commentHeader.createSpan({ text: ' commented on this post' });

          if (archivedTime) {
            commentHeader.createSpan({ text: ` · ${archivedTime}` });
          }

          // Comment text with inline edit icon
          const commentTextContainer = commentSection.createDiv();
          commentTextContainer.style.cssText = 'display: inline;';

          const commentTextDiv = commentTextContainer.createSpan();
          commentTextDiv.style.cssText = 'font-size: 14px; line-height: 1.5; color: var(--text-normal);';
          this.renderMarkdownLinks(commentTextDiv, originalComment || '', undefined, post.platform);

          // Edit icon
          const editIcon = commentTextContainer.createSpan();
          editIcon.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 6px;
            width: 14px;
            height: 14px;
            opacity: 0;
            transition: opacity 0.2s;
            color: var(--text-muted);
            vertical-align: middle;
          `;
          setIcon(editIcon, 'pencil');

          // Hover effects
          commentSection.addEventListener('mouseenter', () => {
            editIcon.style.opacity = '0.6';
          });
          commentSection.addEventListener('mouseleave', () => {
            editIcon.style.opacity = '0';
          });
        } else {
          // Restore saved UI: "Jun saved this post · 2h ago"
          const savedHeader = commentSection.createDiv();
          savedHeader.style.cssText = 'font-size: 13px; color: var(--text-muted); display: inline;';

          const userNameSpan = savedHeader.createSpan({ text: userName });
          userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

          savedHeader.createSpan({ text: ' saved this post' });

          if (archivedTime) {
            savedHeader.createSpan({ text: ` · ${archivedTime}` });
          }

          // Edit icon
          const editIcon = commentSection.createSpan();
          editIcon.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 6px;
            width: 14px;
            height: 14px;
            opacity: 0;
            transition: opacity 0.2s;
            color: var(--text-muted);
            vertical-align: middle;
          `;
          setIcon(editIcon, 'pencil');

          // Hover effects
          commentSection.addEventListener('mouseenter', () => {
            editIcon.style.opacity = '0.6';
          });
          commentSection.addEventListener('mouseleave', () => {
            editIcon.style.opacity = '0';
          });
        }

        // Click to edit
        commentSection.addEventListener('click', (e) => {
          e.stopPropagation();
          this.editCommentInline(post, commentSection);
        });
      };

      // Clear section and create edit UI
      commentSection.empty();
      commentSection.style.cssText = 'position: relative;';

      // Create a scope for keyboard shortcuts
      const editScope = new Scope();

      // Textarea
      const textarea = commentSection.createEl('textarea');
      textarea.style.cssText = `
        width: 100%;
        min-height: 60px;
        padding: 8px;
        font-family: var(--font-text);
        font-size: 14px;
        line-height: 1.5;
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        background: var(--background-primary);
        color: var(--text-normal);
        resize: vertical;
        margin-bottom: 8px;
      `;
      textarea.value = post.comment || '';

      // Focus and select
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 10);

      // Button container
      const btnContainer = commentSection.createDiv();
      btnContainer.style.cssText = 'display: flex; gap: 8px;';

      // Save button
      const saveBtn = btnContainer.createEl('button', {
        text: 'Save',
        cls: 'mod-cta'
      });
      saveBtn.style.cssText = 'font-size: 13px; padding: 4px 12px;';

      // Cancel button
      const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
      cancelBtn.style.cssText = 'font-size: 13px; padding: 4px 12px;';

      // Save handler
      const handleSave = async () => {
        const newComment = textarea.value.trim();

        try {
          const content = await this.vault.read(tfile);
          const updatedContent = this.updateYamlFrontmatter(content, {
            comment: newComment || null
          });
          await this.vault.modify(tfile, updatedContent);

          post.comment = newComment || undefined;
          console.log('[PostCardRenderer] Updated comment inline:', post.id);

          // Unregister scope
          this.app.keymap.popScope(editScope);

          // Note: UI will auto-refresh via vault modify event listener
        } catch (err) {
          console.error('[PostCardRenderer] Failed to update comment:', err);
          new Notice('Failed to save note');
          // Restore original on error
          this.app.keymap.popScope(editScope);
          restoreOriginalUI();
        }
      };

      const handleCancel = () => {
        this.app.keymap.popScope(editScope);
        restoreOriginalUI();
      };

      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleSave();
      });

      // Cancel handler
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCancel();
      });

      // Register keyboard shortcuts with Obsidian's keymap
      editScope.register(['Mod'], 'Enter', (evt: KeyboardEvent) => {
        evt.preventDefault();
        handleSave();
        return false;
      });

      editScope.register([], 'Escape', (evt: KeyboardEvent) => {
        evt.preventDefault();
        handleCancel();
        return false;
      });

      // Push scope to keymap stack
      this.app.keymap.pushScope(editScope);

    } catch (err) {
      console.error('[PostCardRenderer] Failed to edit comment inline:', err);
    }
  }

  /**
   * Toggle archive status for a post
   */
  private async toggleArchive(post: PostData, btn: HTMLElement, icon: HTMLElement, rootElement: HTMLElement): Promise<void> {
    try {
      const filePath = (post as any).filePath;
      if (!filePath) {
        console.warn('[PostCardRenderer] No file path for post:', post.id);
        return;
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !('extension' in file)) {
        console.warn('[PostCardRenderer] File not found:', filePath);
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

      console.log('[PostCardRenderer] Toggled archive:', post.id, newArchiveStatus);

      // Notify parent component
      if (this.onArchiveToggleCallback) {
        this.onArchiveToggleCallback(post, newArchiveStatus, rootElement);
      }
    } catch (err) {
      console.error('[PostCardRenderer] Failed to toggle archive:', err);
    }
  }

  /**
   * Update YAML frontmatter with new values
   */
  private updateYamlFrontmatter(content: string, updates: Record<string, any>): string {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    // Helper function to format YAML value
    const formatYamlValue = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'string') {
        // Use JSON.stringify for strings to handle newlines and quotes properly
        return JSON.stringify(value);
      }
      if (typeof value === 'object' && value.url) {
        // Format object with url property (for linkPreviews items)
        return `url: ${value.url}`;
      }
      return String(value);
    };

    // Helper function to format YAML key-value pair (handles arrays)
    const formatYamlEntry = (key: string, value: any): string | null => {
      if (value === null || value === undefined) {
        return null;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        const arrayItems = value.map(v => `  - ${formatYamlValue(v)}`).join('\n');
        return `${key}:\n${arrayItems}`;
      }

      // Handle simple values
      return `${key}: ${formatYamlValue(value)}`;
    };

    if (!match || !match[1]) {
      // No frontmatter found, add it
      const yamlLines = Object.entries(updates)
        .map(([key, value]) => formatYamlEntry(key, value))
        .filter(Boolean)
        .join('\n');
      return `---\n${yamlLines}\n---\n\n${content}`;
    }

    const frontmatterContent = match[1];
    const restContent = content.slice(match[0].length);

    // Parse existing frontmatter
    const lines = frontmatterContent.split('\n');
    const updatedLines: string[] = [];
    const processedKeys = new Set<string>();

    // Track if we're inside an array (lines starting with "  -")
    let currentArrayKey: string | null = null;

    // Update existing keys
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const keyMatch = line.match(/^(\w+):/);

      if (keyMatch) {
        // This line defines a key
        const key = keyMatch[1];
        currentArrayKey = null; // Reset array tracking

        if (key && updates.hasOwnProperty(key)) {
          const value = updates[key];
          if (value === null || value === undefined) {
            // Skip this line to remove the field
            processedKeys.add(key);

            // Skip array items if this was an array key
            while (i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
              i++;
            }
            continue;
          }

          // Add formatted entry (handles arrays automatically)
          const formatted = formatYamlEntry(key, value);
          if (formatted) {
            updatedLines.push(formatted);
          }
          processedKeys.add(key);

          // Skip old array items if this is now an array
          if (Array.isArray(value)) {
            while (i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
              i++;
            }
          }
        } else {
          // Keep existing line
          updatedLines.push(line);
          // Track if this starts an array
          if (i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
            currentArrayKey = key;
          }
        }
      } else if (line.match(/^\s+-\s/) && currentArrayKey && !updates.hasOwnProperty(currentArrayKey)) {
        // This is an array item line, keep it if we're not updating this key
        updatedLines.push(line);
      } else if (!line.match(/^\s+-\s/)) {
        // Other lines (empty, comments, etc.)
        updatedLines.push(line);
        currentArrayKey = null;
      }
    }

    // Add new keys
    for (const [key, value] of Object.entries(updates)) {
      if (!processedKeys.has(key) && value !== null && value !== undefined) {
        const formatted = formatYamlEntry(key, value);
        if (formatted) {
          updatedLines.push(formatted);
        }
      }
    }

    return `---\n${updatedLines.join('\n')}\n---\n${restContent}`;
  }

  /**
   * Remove share-related fields from YAML frontmatter
   */
  private removeShareFromYaml(content: string): string {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (!match || !match[1]) {
      // No frontmatter, nothing to remove
      return content;
    }

    const frontmatterContent = match[1];
    const restContent = content.slice(match[0].length);

    // Parse existing frontmatter and remove share-related keys
    const lines = frontmatterContent.split('\n');
    const shareKeys = ['share', 'shareUrl', 'shareExpiry'];
    const filteredLines = lines.filter(line => {
      const keyMatch = line.match(/^(\w+):/);
      if (keyMatch && keyMatch[1]) {
        return !shareKeys.includes(keyMatch[1]);
      }
      return true;
    });

    return `---\n${filteredLines.join('\n')}\n---\n${restContent}`;
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
      youtube: siYoutube,
      reddit: siReddit
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
  public getRelativeTime(timestamp: Date | undefined): string {
    if (!timestamp) {
      return '';
    }

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
                console.log('[PostCardRenderer] Seeking to timestamp:', linkData.seconds);
              } else {
                console.warn('[PostCardRenderer] YouTube controller not found for video:', videoId);
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

  /**
   * Generate random share ID (12 characters, alphanumeric)
   */
  private generateShareId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Upload local images to R2 and replace markdown paths with R2 URLs
   */
  private async uploadLocalImagesAndReplaceUrls(content: string, shareId: string, workerUrl: string): Promise<string> {
    let updatedContent = content;

    // Find all markdown image references
    const imageRegex = /!\[([^\]]*)\]\((attachments\/[^)]+)\)/g;
    const matches = Array.from(content.matchAll(imageRegex));

    for (const match of matches) {
      const [fullMatch, alt, localPath] = match;

      if (!localPath) continue;

      try {
        // Get the file from vault
        const imageFile = this.vault.getAbstractFileByPath(localPath);
        if (!imageFile || !('extension' in imageFile)) {
          console.warn('[PostCardRenderer] Image file not found:', localPath);
          continue;
        }

        // Read image as binary
        const imageBuffer = await this.vault.readBinary(imageFile as TFile);

        // Convert to base64
        const base64 = this.arrayBufferToBase64(imageBuffer);

        // Extract filename
        const filename = localPath.split('/').pop() || 'image.jpg';

        // Determine content type from extension
        const ext = filename.split('.').pop()?.toLowerCase();
        const contentType = ext === 'png' ? 'image/png' :
                           ext === 'gif' ? 'image/gif' :
                           ext === 'webp' ? 'image/webp' : 'image/jpeg';

        // Upload to Worker
        const uploadResponse = await fetch(`${workerUrl}/api/upload-share-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shareId,
            filename,
            contentType,
            data: base64
          })
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PostCardRenderer] Failed to upload image:', filename, errorData);
          continue;
        }

        const uploadResult = await uploadResponse.json();
        const r2Url = uploadResult.data.url;

        // Replace local path with R2 URL in content
        updatedContent = updatedContent.replace(fullMatch, `![${alt}](${r2Url})`);

        console.log('[PostCardRenderer] Uploaded image to R2:', { filename, r2Url });

      } catch (error) {
        console.error('[PostCardRenderer] Error uploading image:', error);
      }
    }

    return updatedContent;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i] as number);
    }
    return btoa(binary);
  }

  /**
   * Upload local media files to R2 and return updated media array with remote URLs
   */
  private async uploadMediaFilesToR2(
    media: Media[],
    shareId: string,
    workerUrl: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Media[]> {
    const updatedMedia: Media[] = [];
    const totalMedia = media.length;

    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i];
      // Skip if URL is already remote (http/https)
      if (mediaItem.url.startsWith('http://') || mediaItem.url.startsWith('https://')) {
        updatedMedia.push(mediaItem);
        continue;
      }

      try {
        // Get the file from vault
        const mediaFile = this.vault.getAbstractFileByPath(mediaItem.url);
        if (!mediaFile || !('extension' in mediaFile)) {
          console.warn('[PostCardRenderer] Media file not found:', mediaItem.url);
          // Keep original media item even if file not found
          updatedMedia.push(mediaItem);
          continue;
        }

        // Read media as binary
        const mediaBuffer = await this.vault.readBinary(mediaFile as TFile);

        // Convert to base64
        const base64 = this.arrayBufferToBase64(mediaBuffer);

        // Extract filename
        const filename = mediaItem.url.split('/').pop() || 'media';

        // Determine content type from extension
        const ext = filename.split('.').pop()?.toLowerCase();
        const contentType = ext === 'png' ? 'image/png' :
                           ext === 'gif' ? 'image/gif' :
                           ext === 'webp' ? 'image/webp' :
                           ext === 'mp4' ? 'video/mp4' :
                           ext === 'webm' ? 'video/webm' :
                           ext === 'mov' ? 'video/quicktime' : 'image/jpeg';

        // Upload to Worker
        const uploadResponse = await fetch(`${workerUrl}/api/upload-share-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shareId,
            filename,
            contentType,
            data: base64
          })
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PostCardRenderer] Media upload failed:', errorData);
          // Keep original media item on upload failure
          updatedMedia.push(mediaItem);
          continue;
        }

        const uploadResult = await uploadResponse.json();
        if (uploadResult.success && uploadResult.data?.url) {
          // Update media item with remote URL
          updatedMedia.push({
            ...mediaItem,
            url: uploadResult.data.url,
            thumbnail: uploadResult.data.url // Use same URL for thumbnail
          });

          // Report progress after successful upload
          if (onProgress) {
            onProgress(i + 1, totalMedia);
          }
        } else {
          console.error('[PostCardRenderer] Invalid upload response:', uploadResult);
          // Keep original media item
          updatedMedia.push(mediaItem);
        }
      } catch (err) {
        console.error('[PostCardRenderer] Error uploading media:', mediaItem.url, err);
        // Keep original media item on error
        updatedMedia.push(mediaItem);
      }
    }

    return updatedMedia;
  }

  /**
   * Remove YAML frontmatter from markdown content
   */
  private removeYamlFrontmatter(content: string): string {
    // Remove YAML frontmatter (---\n...\n---)
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  /**
   * Remove first H1 heading from markdown content
   */
  private removeFirstH1(content: string): string {
    // Remove first # Title line
    return content.replace(/^#\s+.+\n/, '');
  }
}
