import { setIcon, type TFile, type Vault, type App } from 'obsidian';
import type { PostData } from '../../../types/post';
import type SocialArchiverPlugin from '../../../main';
import {
  siFacebook,
  siInstagram,
  siTiktok,
  siX,
  siThreads,
  siYoutube,
  type SimpleIcon
} from 'simple-icons';
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
      // Comment header: "Jun commented on this post · 2h ago"
      const commentHeader = wrapper.createDiv({ cls: 'mb-2' });
      commentHeader.style.cssText = 'font-size: 13px; color: var(--text-muted);';

      const userNameSpan = commentHeader.createSpan({ text: userName });
      userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

      commentHeader.createSpan({ text: ' commented on this post' });

      // Add archived time
      if (archivedTime) {
        commentHeader.createSpan({ text: ` · ${archivedTime}` });
      }

      // Comment text
      const commentTextDiv = wrapper.createDiv({ cls: 'mb-3' });
      commentTextDiv.style.cssText = 'font-size: 14px; line-height: 1.5; color: var(--text-normal);';
      this.renderMarkdownLinks(commentTextDiv, post.comment, undefined, post.platform);
    } else {
      // Saved header: "Jun saved this post · 2h ago"
      const savedHeader = wrapper.createDiv({ cls: 'mb-2' });
      savedHeader.style.cssText = 'font-size: 13px; color: var(--text-muted);';

      const userNameSpan = savedHeader.createSpan({ text: userName });
      userNameSpan.style.cssText = 'font-weight: 600; color: var(--text-normal);';

      savedHeader.createSpan({ text: ' saved this post' });

      // Add archived time
      if (archivedTime) {
        savedHeader.createSpan({ text: ` · ${archivedTime}` });
      }
    }

    // Create nested container for the actual card (always nested now)
    const cardContainer = wrapper.createDiv();
    cardContainer.style.cssText = 'padding-left: 16px; border-left: 2px solid var(--background-modifier-border); margin-left: 4px;';

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
      console.log('[PostCardRenderer] Rendering YouTube embed');
      this.youtubeEmbedRenderer.renderYouTube(contentArea, post.videoId);
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
      this.commentRenderer.render(contentArea, post.comments);
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

    // Archive button (right-aligned)
    this.renderArchiveButton(interactions, post, rootElement);

    // Open Note button (right-aligned)
    this.renderOpenNoteButton(interactions, post);
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
}
