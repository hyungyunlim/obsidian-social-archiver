import { ItemView, WorkspaceLeaf } from 'obsidian';
import type SocialArchiverPlugin from '../main';
import { TimelineContainer } from '../components/timeline/TimelineContainer';

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
  private component: any;

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

    // Create timeline container (pure TypeScript)
    this.component = new TimelineContainer(container, {
      vault: this.app.vault,
      app: this.app,
      archivePath: this.plugin.settings.archivePath || 'Social Archives',
    });
  }

  /**
   * Called when the view is closed
   * Cleanup resources and destroy timeline
   */
  async onClose(): Promise<void> {
    if (this.component) {
      this.component.destroy();
      this.component = undefined;
    }
  }

  /**
   * Refresh the timeline view
   * Useful when new posts are archived or view is re-activated
   */
  public async refresh(): Promise<void> {
    // Reload the timeline without re-mounting
    if (this.component && this.component.reload) {
      await this.component.reload();
    }
  }
}
