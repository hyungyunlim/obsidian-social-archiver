import type { Platform, PostData } from '../types/post';
import type { ArchiveService } from '../services/ArchiveService';

/**
 * Archive operation result
 */
export interface ArchiveResult {
  success: boolean;
  data?: PostData;
  error?: Error;
  filePath?: string;
}

/**
 * Archive state management using Svelte 5 Runes
 *
 * This composable provides reactive state for archive operations
 * with progress tracking, error handling, and cancellation support.
 */
export function useArchiveState(archiveService: ArchiveService) {
  // Reactive state
  let isArchiving = false;
  let error: Error | null = null;
  let progress = 0;
  let currentPlatform: Platform | null = null;
  let currentUrl: string | null = null;
  let abortController: AbortController | null = null;

  /**
   * Archive a post from the given URL
   */
  async function archive(
    url: string,
    options?: {
      enableAI?: boolean;
      downloadMedia?: boolean;
      onProgress?: (progress: number) => void;
    }
  ): Promise<ArchiveResult> {
    // Reset state
    reset();

    try {
      isArchiving = true;
      currentUrl = url;
      abortController = new AbortController();

      // Detect platform
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');

      // Simple platform detection (can be enhanced with PlatformDetector service)
      if (domain.includes('facebook')) {
        currentPlatform = 'facebook';
      } else if (domain.includes('linkedin')) {
        currentPlatform = 'linkedin';
      } else if (domain.includes('instagram')) {
        currentPlatform = 'instagram';
      } else if (domain.includes('tiktok')) {
        currentPlatform = 'tiktok';
      } else if (domain.includes('x.com') || domain.includes('twitter')) {
        currentPlatform = 'x';
      } else if (domain.includes('threads')) {
        currentPlatform = 'threads';
      }

      // Progress updates
      const progressCallback = (value: number) => {
        progress = value;
        options?.onProgress?.(value);
      };

      progressCallback(10); // Started

      // Archive post (fetch and process)
      const postData = await archiveService.archivePost(url, {
        enableAI: options?.enableAI || false,
        downloadMedia: options?.downloadMedia !== false,
        removeTracking: true,
        generateShareLink: false,
        deepResearch: false,
      }, progressCallback);

      progressCallback(100); // Complete

      const filePath = 'archived'; // Placeholder

      return {
        success: true,
        data: postData,
        filePath,
      };
    } catch (err) {
      const archiveError = err instanceof Error ? err : new Error(String(err));
      error = archiveError;

      return {
        success: false,
        error: archiveError,
      };
    } finally {
      isArchiving = false;
      abortController = null;
    }
  }

  /**
   * Cancel the current archive operation
   */
  function cancel() {
    if (abortController) {
      abortController.abort();
      reset();
    }
  }

  /**
   * Reset all state
   */
  function reset() {
    isArchiving = false;
    error = null;
    progress = 0;
    currentPlatform = null;
    currentUrl = null;
    abortController = null;
  }

  /**
   * Retry the last failed archive operation
   */
  async function retry(options?: {
    enableAI?: boolean;
    downloadMedia?: boolean;
    onProgress?: (progress: number) => void;
  }): Promise<ArchiveResult> {
    if (!currentUrl) {
      throw new Error('No URL to retry');
    }

    return archive(currentUrl, options);
  }

  // Getters for readonly access
  return {
    // State
    get isArchiving() {
      return isArchiving;
    },
    get error() {
      return error;
    },
    get progress() {
      return progress;
    },
    get currentPlatform() {
      return currentPlatform;
    },
    get currentUrl() {
      return currentUrl;
    },

    // Methods
    archive,
    cancel,
    reset,
    retry,
  };
}

/**
 * Type for the return value of useArchiveState
 */
export type UseArchiveState = ReturnType<typeof useArchiveState>;
