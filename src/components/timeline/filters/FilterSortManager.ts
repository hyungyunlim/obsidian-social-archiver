import type { PostData } from '../../../types/post';

/**
 * Filter state interface
 */
export interface FilterState {
  platforms: Set<string>;
  likedOnly: boolean;
  commentedOnly: boolean;
  sharedOnly: boolean;
  includeArchived: boolean;
  dateRange: { start: Date | null; end: Date | null };
}

/**
 * Sort state interface
 */
export interface SortState {
  by: 'published' | 'archived';
  order: 'newest' | 'oldest';
}

/**
 * FilterSortManager - Manages filtering and sorting logic
 * Single Responsibility: Apply filters and sorting to post data
 */
export class FilterSortManager {
  private filterState: FilterState;
  private sortState: SortState;

  constructor(
    initialFilterState?: Partial<FilterState>,
    initialSortState?: Partial<SortState>
  ) {
    // Initialize filter state with defaults
    this.filterState = {
      platforms: new Set<string>(['facebook', 'linkedin', 'instagram', 'tiktok', 'x', 'threads', 'youtube', 'reddit']),
      likedOnly: false,
      commentedOnly: false,
      sharedOnly: false,
      includeArchived: false,
      dateRange: { start: null, end: null },
      ...initialFilterState
    };

    // Initialize sort state with defaults
    this.sortState = {
      by: 'published',
      order: 'newest',
      ...initialSortState
    };
  }

  /**
   * Apply filters and sorting to posts
   */
  applyFiltersAndSort(posts: PostData[]): PostData[] {
    let filtered = this.applyFilters(posts);
    let sorted = this.applySort(filtered);
    return sorted;
  }

  /**
   * Apply filters to posts
   */
  private applyFilters(posts: PostData[]): PostData[] {
    let filtered = [...posts];

    // Filter by platform
    filtered = filtered.filter(post => this.filterState.platforms.has(post.platform));

    // Filter by liked only
    if (this.filterState.likedOnly) {
      filtered = filtered.filter(post => post.like === true);
    }

    // Filter by commented only
    if (this.filterState.commentedOnly) {
      filtered = filtered.filter(post => post.comment && post.comment.trim().length > 0);
    }

    // Filter by shared only
    if (this.filterState.sharedOnly) {
      filtered = filtered.filter(post => post.shareUrl && post.shareUrl.trim().length > 0);
    }

    // Filter by archive status
    if (!this.filterState.includeArchived) {
      filtered = filtered.filter(post => post.archive !== true);
    }

    // Filter by date range
    if (this.filterState.dateRange.start || this.filterState.dateRange.end) {
      filtered = filtered.filter(post => {
        const dateToCheck = this.sortState.by === 'published' ? post.publishedDate : post.archivedDate;
        if (!dateToCheck) return true; // Keep if date doesn't exist

        const postTime = typeof dateToCheck === 'string' ? new Date(dateToCheck).getTime() : dateToCheck.getTime();
        const startTime = this.filterState.dateRange.start?.getTime();
        const endTime = this.filterState.dateRange.end?.getTime();

        if (startTime && postTime < startTime) {
          return false;
        }
        if (endTime && postTime > endTime) {
          return false;
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * Apply sorting to posts
   */
  private applySort(posts: PostData[]): PostData[] {
    return posts.sort((a, b) => {
      // Get date to sort by
      const getDateForSort = (post: PostData): number => {
        const timestamp = typeof post.metadata.timestamp === 'string'
          ? new Date(post.metadata.timestamp).getTime()
          : post.metadata.timestamp.getTime();

        if (this.sortState.by === 'published') {
          return post.publishedDate?.getTime() ?? timestamp;
        } else {
          return post.archivedDate?.getTime() ?? timestamp;
        }
      };

      const aTime = getDateForSort(a);
      const bTime = getDateForSort(b);

      return this.sortState.order === 'newest' ? bTime - aTime : aTime - bTime;
    });
  }

  /**
   * Update filter state
   */
  updateFilter(filter: Partial<FilterState>): void {
    this.filterState = { ...this.filterState, ...filter };
  }

  /**
   * Update sort state
   */
  updateSort(sort: Partial<SortState>): void {
    this.sortState = { ...this.sortState, ...sort };
  }

  /**
   * Get current filter state
   */
  getFilterState(): FilterState {
    return { ...this.filterState };
  }

  /**
   * Get current sort state
   */
  getSortState(): SortState {
    return { ...this.sortState };
  }

  /**
   * Check if any filter is active
   */
  hasActiveFilters(): boolean {
    return (
      this.filterState.platforms.size < 8 ||
      this.filterState.likedOnly ||
      this.filterState.commentedOnly ||
      this.filterState.includeArchived ||
      this.filterState.dateRange.start !== null ||
      this.filterState.dateRange.end !== null
    );
  }
}
