import { ItemView, WorkspaceLeaf } from 'obsidian';
import type SocialArchiverPlugin from '../main';
// Use Svelte version of TimelineContainer for better UX
import { TimelineContainer } from '../components/timeline/TimelineContainerSvelte';

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
  private refreshTimeout: number | null = null;

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
      plugin: this.plugin,
    });

    // Register vault file change listeners
    const archivePath = this.plugin.settings.archivePath || 'Social Archives';

    // Listen for file creation (new posts archived)
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file.path.startsWith(archivePath)) {
          console.log('[TimelineView] New file created in archive path');
          this.debouncedRefresh();
        }
      })
    );

    // Listen for file deletion (posts deleted)
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file.path.startsWith(archivePath)) {
          console.log('[TimelineView] File deleted from archive path');
          this.debouncedRefresh();
        }
      })
    );

    // Listen for file modification (posts edited)
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path.startsWith(archivePath)) {
          console.log('[TimelineView] File modified in archive path');
          this.debouncedRefresh();
        }
      })
    );

    // Listen for file rename (posts renamed)
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file.path.startsWith(archivePath) || oldPath.startsWith(archivePath)) {
          console.log('[TimelineView] File renamed in archive path');
          this.debouncedRefresh();
        }
      })
    );

    // Listen for settings change (archive path changed)
    this.registerEvent(
      this.plugin.events.on('settings-changed', () => {
        console.log('[TimelineView] Settings changed');
        this.debouncedRefresh();
      })
    );
  }

  /**
   * Called when the view is closed
   * Cleanup resources and destroy timeline
   */
  async onClose(): Promise<void> {
    // Clear any pending refresh timeout
    if (this.refreshTimeout !== null) {
      window.clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

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

  /**
   * Debounced refresh to prevent excessive reloads
   * Waits 500ms after last change before refreshing
   */
  private debouncedRefresh(): void {
    if (this.refreshTimeout !== null) {
      window.clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = window.setTimeout(() => {
      this.refresh();
      this.refreshTimeout = null;
    }, 500);
  }
}
