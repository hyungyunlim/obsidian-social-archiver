import type { PostData, Platform } from '@/types/post';
import { DateNumberFormatter } from './DateNumberFormatter';
import { TextFormatter } from './TextFormatter';

/**
 * CommentFormatter - Format comments for markdown
 * Single Responsibility: Comment and reply formatting with platform-specific features
 */
export class CommentFormatter {
  private dateNumberFormatter: DateNumberFormatter;
  private textFormatter: TextFormatter;

  constructor(dateNumberFormatter: DateNumberFormatter, textFormatter: TextFormatter) {
    this.dateNumberFormatter = dateNumberFormatter;
    this.textFormatter = textFormatter;
  }

  /**
   * Format comments for markdown (nested style with indentation)
   */
  formatComments(comments: PostData['comments'], platform: Platform): string {
    if (!comments || comments.length === 0) {
      return '';
    }

    try {
      return comments
        .map((comment) => {
          // Defensive checks
          if (!comment || !comment.author || !comment.content) {
            return '';
          }

          // Main comment - support both handle and username
          // LinkedIn: use name instead of handle (handles can be URL-encoded)
          // Instagram: use handle with link
          // Others: use handle if available, otherwise name
          const authorHandle = comment.author.handle || comment.author.username;

          let authorDisplay: string;
          if (platform === 'linkedin') {
            // LinkedIn: always use display name with link
            authorDisplay = comment.author.url
              ? `[${comment.author.name}](${comment.author.url})`
              : comment.author.name;
          } else if (platform === 'instagram' && authorHandle) {
            // Instagram: use handle with link
            authorDisplay = `[@${authorHandle}](https://instagram.com/${authorHandle})`;
          } else {
            // Others: use handle or name
            authorDisplay = authorHandle ? `@${authorHandle}` : comment.author.name;
          }

          const timestamp = this.dateNumberFormatter.formatDate(comment.timestamp);
          const likes = comment.likes ? ` · ${comment.likes} likes` : '';

          // Convert @mentions in comment content to links for Instagram
          const commentContent = platform === 'instagram'
            ? this.textFormatter.linkifyInstagramMentions(comment.content)
            : comment.content;

          // Format header: author [· timestamp] [· likes]
          const timestampPart = timestamp ? ` · ${timestamp}` : '';
          let result = `**${authorDisplay}**${timestampPart}${likes}\n${commentContent}`;

          // Nested replies with indentation
          if (comment.replies && comment.replies.length > 0) {
            const formattedReplies = comment.replies
              .map((reply) => {
                if (!reply || !reply.author || !reply.content) {
                  return '';
                }
                const replyHandle = reply.author.handle || reply.author.username;

                // Same logic as main comment
                let replyAuthorDisplay: string;
                if (platform === 'linkedin') {
                  // LinkedIn: always use display name with link
                  replyAuthorDisplay = reply.author.url
                    ? `[${reply.author.name}](${reply.author.url})`
                    : reply.author.name;
                } else if (platform === 'instagram' && replyHandle) {
                  // Instagram: use handle with link
                  replyAuthorDisplay = `[@${replyHandle}](https://instagram.com/${replyHandle})`;
                } else {
                  // Others: use handle or name
                  replyAuthorDisplay = replyHandle ? `@${replyHandle}` : reply.author.name;
                }

                const replyTime = this.dateNumberFormatter.formatDate(reply.timestamp);
                const replyLikes = reply.likes ? ` · ${reply.likes} likes` : '';

                // Convert @mentions in reply content to links for Instagram
                // Pass isReply=true to remove redundant first @mention
                const replyContent = platform === 'instagram'
                  ? this.textFormatter.linkifyInstagramMentions(reply.content, true)
                  : reply.content;

                // Format reply header: author [· timestamp] [· likes]
                const replyTimePart = replyTime ? ` · ${replyTime}` : '';
                return `  ↳ **${replyAuthorDisplay}**${replyTimePart}${replyLikes}\n  ${replyContent}`;
              })
              .filter(r => r.length > 0)
              .join('\n\n');

            if (formattedReplies.length > 0) {
              result += '\n\n' + formattedReplies;
            }
          }

          return result;
        })
        .filter(c => c.length > 0)
        .join('\n\n---\n\n');
    } catch (error) {
      console.error('[CommentFormatter] Error formatting comments:', error);
      return '';
    }
  }
}
