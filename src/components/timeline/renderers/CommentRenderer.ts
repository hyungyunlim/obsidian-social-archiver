import type { Comment } from '../../../types/post';

/**
 * CommentRenderer - Renders Instagram-style comments section
 * Single Responsibility: Comments rendering with replies
 */
export class CommentRenderer {
  constructor(
    private getRelativeTimeCallback?: (date: Date) => string
  ) {}

  /**
   * Format relative time (e.g., "2h ago", "Yesterday", "Mar 15")
   */
  private getRelativeTime(timestamp: Date): string {
    // Use callback if provided, otherwise use built-in implementation
    if (this.getRelativeTimeCallback) {
      return this.getRelativeTimeCallback(timestamp);
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
   * Render comments section (Instagram style)
   */
  render(container: HTMLElement, comments: Comment[]): void {
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
}
