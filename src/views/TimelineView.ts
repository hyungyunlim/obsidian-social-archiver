import { ItemView, WorkspaceLeaf } from 'obsidian';
import type SocialArchiverPlugin from '../main';
import TimelineContainer from '../components/timeline/TimelineContainer.svelte';

/**
 * Unique identifier for the Timeline View
 */
export const VIEW_TYPE_TIMELINE = 'social-archiver-timeline';

/**
 * TimelineView - Custom Obsidian view for displaying archived social media posts
 *
 * Provides a chronological timeline interface with:
 * - Virtual scrolling for performance
 * - Platform-specific post cards
 * - Date grouping and filtering
 * - Search capabilities
 * - Responsive mobile-first design
 *
 * @extends ItemView
 */
export class TimelineView extends ItemView {
  private plugin: SocialArchiverPlugin;
  private component: TimelineContainer | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: SocialArchiverPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  /**
   * Returns the unique view type identifier
   */
  getViewType(): string {
    return VIEW_TYPE_TIMELINE;
  }

  /**
   * Returns the display text shown in the view header
   */
  getDisplayText(): string {
    return 'Social Archive Timeline';
  }

  /**
   * Returns the icon identifier for the view
   */
  getIcon(): string {
    return 'calendar-clock';
  }

  /**
   * Called when the view is opened
   * Initializes the timeline container and renders content
   */
  async onOpen(): Promise<void> {
    const container = this.containerEl;
    container.empty();
    container.addClass('social-archiver-timeline-view');

    // Mount Svelte TimelineContainer component
    this.component = new TimelineContainer({
      target: container,
      props: {
        vault: this.app.vault,
        app: this.app,
        archivePath: this.plugin.settings.archivePath || 'Social Archives',
      },
    });
  }

  /**
   * Called when the view is closed
   * Cleanup resources and unmount Svelte components
   */
  async onClose(): Promise<void> {
    // Destroy Svelte component instance
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }

  /**
   * Refresh the timeline view
   * Useful when new posts are archived
   */
  public async refresh(): Promise<void> {
    // Re-mount component to refresh
    if (this.component) {
      await this.onClose();
      await this.onOpen();
    }
  }
}
