/**
 * TextFormatter - Text linkification utilities
 * Single Responsibility: Convert text patterns to markdown links (mentions, timestamps)
 */
export class TextFormatter {
  /**
   * Convert @mentions to Instagram profile links
   */
  linkifyInstagramMentions(text: string, isReply: boolean = false): string {
    // For replies, remove the first @mention if it's at the start (it's redundant)
    let processedText = text;
    if (isReply) {
      processedText = text.replace(/^@[\w.]+\s*/, '');
    }

    // Match @username (Instagram usernames can contain letters, numbers, underscores, periods)
    // Don't match if already in a markdown link
    return processedText.replace(/@([\w.]+)(?!\])/g, (_match, username) => {
      return `[@${username}](https://instagram.com/${username})`;
    });
  }

  /**
   * Convert YouTube timestamps to clickable links
   * Example: "00:00 Introduction" -> "[00:00](https://www.youtube.com/watch?v=VIDEO_ID&t=0s) Introduction"
   */
  linkifyYouTubeTimestamps(text: string, videoId: string): string {
    // Match timestamps at the beginning of lines: HH:MM:SS or MM:SS
    // Pattern: line start, optional whitespace, timestamp, space, description text
    return text.replace(/^(\s*)(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/gm, (_match, whitespace, timestamp, description) => {
      // Convert timestamp to seconds
      const parts = timestamp.split(':').map(Number);
      let seconds: number;

      if (parts.length === 3) {
        // HH:MM:SS format
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else {
        // MM:SS format
        seconds = parts[0] * 60 + parts[1];
      }

      // Create YouTube timestamp link (only timestamp is clickable, not description)
      const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
      return `${whitespace}[${timestamp}](${url}) ${description}`;
    });
  }

  /**
   * Extract hashtags from text
   */
  extractHashtags(text: string): string[] {
    // Hashtag pattern: #word (supports alphanumeric, underscore, and unicode characters like Korean/Japanese)
    const hashtagPattern = /#([\w\u0080-\uFFFF]+)/g;
    const hashtags: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = hashtagPattern.exec(text)) !== null) {
      const tag = match[1];
      if (tag && !hashtags.includes(tag)) {
        hashtags.push(tag);
      }
    }

    return hashtags;
  }
}
