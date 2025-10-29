import type { PostData } from '@/types/post';

/**
 * TranscriptFormatter - Format YouTube transcripts for markdown
 * Single Responsibility: YouTube transcript formatting with clickable timestamps
 */
export class TranscriptFormatter {
  /**
   * Convert milliseconds to seconds for YouTube URL timestamp parameter
   */
  private formatTimestampForUrl(milliseconds: number): number {
    return Math.floor(milliseconds / 1000);
  }

  /**
   * Format milliseconds to MM:SS or HH:MM:SS display format
   */
  private formatTimestampDisplay(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format YouTube transcript for markdown
   */
  formatTranscript(transcript: PostData['transcript'], videoId: string | undefined, includeRaw: boolean, includeFormatted: boolean): string {
    if (!transcript || !videoId) {
      return '';
    }

    const parts: string[] = [];

    // Add raw transcript text FIRST (if both are enabled)
    if (includeRaw && transcript.raw) {
      parts.push('**Full Transcript:**\n\n' + transcript.raw);
    }

    // Add formatted transcript with clickable timestamps SECOND
    if (includeFormatted && transcript.formatted && transcript.formatted.length > 0) {
      const chapterLinks = transcript.formatted
        .map((entry) => {
          const timeDisplay = this.formatTimestampDisplay(entry.start_time);
          const timeSeconds = this.formatTimestampForUrl(entry.start_time);
          const url = `https://www.youtube.com/watch?v=${videoId}&t=${timeSeconds}s`;
          return `[${timeDisplay}](${url}) ${entry.text}`;
        })
        .join('\n');

      if (parts.length > 0) {
        parts.push('---\n\n**Chapter Links** (click to open at specific time):\n\n' + chapterLinks);
      } else {
        parts.push('**Chapter Links** (click to open at specific time):\n\n' + chapterLinks);
      }
    }

    if (parts.length === 0) {
      return '';
    }

    // Wrap in Obsidian callout for collapsible section
    return `> [!note]- Click to expand transcript\n>\n` +
      parts.join('\n\n').split('\n').map(line => `> ${line}`).join('\n');
  }
}
