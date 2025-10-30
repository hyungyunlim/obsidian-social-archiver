import { setIcon } from 'obsidian';
import type { FilterState } from './FilterSortManager';
import type { PlatformIcon as SimpleIcon } from '../../../constants/platform-icons';

interface Platform {
  id: string;
  label: string;
}

/**
 * FilterPanel - Renders and manages filter UI
 * Single Responsibility: Filter panel UI and interactions
 */
export class FilterPanel {
  private panelEl: HTMLElement | null = null;
  private isOpen = false;
  private closeHandler: ((e: MouseEvent) => void) | null = null;

  // Callbacks
  private onFilterChangeCallback?: (filter: Partial<FilterState>) => void;
  private onRerenderCallback?: () => void;
  private getFilterStateCallback?: () => FilterState;

  constructor(
    private getPlatformIcon: (platform: string) => SimpleIcon | null,
    private getLucideIconName: (platform: string) => string
  ) {}

  /**
   * Toggle filter panel open/close
   */
  toggle(parent: HTMLElement, filterState: FilterState, updateFilterButton: () => void): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(parent, filterState, updateFilterButton);
    }
  }

  /**
   * Open filter panel
   */
  private open(parent: HTMLElement, filterState: FilterState, updateFilterButton: () => void): void {
    // Remove existing dropdowns
    parent.querySelectorAll('.sort-dropdown').forEach(el => el.remove());

    this.panelEl = parent.createDiv({ cls: 'filter-panel' });
    this.panelEl.style.cssText = `
      position: absolute;
      top: 48px;
      left: 0;
      z-index: 1000;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px;
      min-width: 320px;
      max-width: 400px;
    `;

    this.renderPlatformFilters(this.panelEl, filterState, updateFilterButton);
    this.renderDivider(this.panelEl);
    this.renderLikeFilter(this.panelEl, filterState, updateFilterButton);
    this.renderArchiveFilter(this.panelEl, filterState, updateFilterButton);

    this.attachOutsideClickHandler();
    this.isOpen = true;
  }

  /**
   * Close filter panel
   */
  close(): void {
    if (this.closeHandler) {
      document.removeEventListener('click', this.closeHandler);
      this.closeHandler = null;
    }
    this.panelEl?.remove();
    this.panelEl = null;
    this.isOpen = false;
  }

  /**
   * Render platform filters
   */
  private renderPlatformFilters(panel: HTMLElement, filterState: FilterState, updateFilterButton: () => void): void {
    const platformSection = panel.createDiv();
    platformSection.style.cssText = 'margin-bottom: 16px;';

    const platformLabel = platformSection.createEl('div', { text: 'Platforms' });
    platformLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;';

    const platformsGrid = platformSection.createDiv();
    platformsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;';

    const platforms: Platform[] = [
      { id: 'facebook', label: 'Facebook' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'instagram', label: 'Instagram' },
      { id: 'tiktok', label: 'TikTok' },
      { id: 'x', label: 'X' },
      { id: 'threads', label: 'Threads' },
      { id: 'youtube', label: 'YouTube' }
    ];

    platforms.forEach(platform => {
      this.renderPlatformCheckbox(platformsGrid, platform, filterState, updateFilterButton);
    });
  }

  /**
   * Render individual platform checkbox
   */
  private renderPlatformCheckbox(
    container: HTMLElement,
    platform: Platform,
    filterState: FilterState,
    updateFilterButton: () => void
  ): void {
    const isSelected = filterState.platforms.has(platform.id);

    const checkbox = container.createDiv();
    checkbox.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      background: ${isSelected ? 'var(--background-modifier-hover)' : 'transparent'};
    `;

    // Platform icon
    const iconWrapper = checkbox.createDiv();
    iconWrapper.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--text-accent);';

    const icon = this.getPlatformIcon(platform.id);
    if (icon) {
      iconWrapper.innerHTML = `
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="fill: var(--text-accent); width: 100%; height: 100%;">
          <title>${icon.title}</title>
          <path d="${icon.path}"/>
        </svg>
      `;
    } else {
      const lucideIconName = this.getLucideIconName(platform.id);
      setIcon(iconWrapper, lucideIconName);
    }

    const label = checkbox.createSpan({ text: platform.label });
    label.style.cssText = 'font-size: 13px; flex: 1;';

    const checkIcon = checkbox.createDiv();
    checkIcon.style.cssText = `width: 16px; height: 16px; display: ${isSelected ? 'block' : 'none'};`;
    setIcon(checkIcon, 'check');

    // Click handler
    checkbox.addEventListener('click', () => {
      // Get latest filter state
      const currentState = this.getFilterStateCallback?.() || filterState;
      const newPlatforms = new Set(currentState.platforms);

      if (newPlatforms.has(platform.id)) {
        newPlatforms.delete(platform.id);
        checkbox.style.background = 'transparent';
        checkIcon.style.display = 'none';
      } else {
        newPlatforms.add(platform.id);
        checkbox.style.background = 'var(--background-modifier-hover)';
        checkIcon.style.display = 'block';
      }

      this.onFilterChangeCallback?.({ platforms: newPlatforms });
      this.onRerenderCallback?.();
      updateFilterButton();
    });

    // Hover handlers
    checkbox.addEventListener('mouseenter', () => {
      if (!filterState.platforms.has(platform.id)) {
        checkbox.style.background = 'var(--background-secondary)';
      }
    });

    checkbox.addEventListener('mouseleave', () => {
      if (!filterState.platforms.has(platform.id)) {
        checkbox.style.background = 'transparent';
      }
    });
  }

  /**
   * Render divider
   */
  private renderDivider(panel: HTMLElement): void {
    const divider = panel.createDiv();
    divider.style.cssText = 'height: 1px; background: var(--background-modifier-border); margin: 16px 0;';
  }

  /**
   * Render like filter
   */
  private renderLikeFilter(panel: HTMLElement, filterState: FilterState, updateFilterButton: () => void): void {
    const likeOption = panel.createDiv();
    likeOption.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 8px;
      background: ${filterState.likedOnly ? 'var(--background-modifier-hover)' : 'transparent'};
    `;

    const likeIcon = likeOption.createDiv();
    likeIcon.style.cssText = 'width: 16px; height: 16px; color: var(--text-accent);';
    setIcon(likeIcon, 'star');

    const likeLabel = likeOption.createSpan({ text: 'Liked posts only' });
    likeLabel.style.cssText = 'font-size: 13px; flex: 1;';

    const likeCheckIcon = likeOption.createDiv();
    likeCheckIcon.style.cssText = `width: 16px; height: 16px; display: ${filterState.likedOnly ? 'block' : 'none'};`;
    setIcon(likeCheckIcon, 'check');

    likeOption.addEventListener('click', () => {
      // Get latest filter state
      const currentState = this.getFilterStateCallback?.() || filterState;
      const newLikedOnly = !currentState.likedOnly;
      likeOption.style.background = newLikedOnly ? 'var(--background-modifier-hover)' : 'transparent';
      likeCheckIcon.style.display = newLikedOnly ? 'block' : 'none';

      this.onFilterChangeCallback?.({ likedOnly: newLikedOnly });
      this.onRerenderCallback?.();
      updateFilterButton();
    });
  }

  /**
   * Render archive filter
   */
  private renderArchiveFilter(panel: HTMLElement, filterState: FilterState, updateFilterButton: () => void): void {
    const archiveOption = panel.createDiv();
    archiveOption.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      background: ${filterState.includeArchived ? 'var(--background-modifier-hover)' : 'transparent'};
    `;

    const archiveIcon = archiveOption.createDiv();
    archiveIcon.style.cssText = 'width: 16px; height: 16px;';
    setIcon(archiveIcon, 'archive');

    const archiveLabel = archiveOption.createSpan({ text: 'Include archived' });
    archiveLabel.style.cssText = 'font-size: 13px; flex: 1;';

    const archiveCheckIcon = archiveOption.createDiv();
    archiveCheckIcon.style.cssText = `width: 16px; height: 16px; display: ${filterState.includeArchived ? 'block' : 'none'};`;
    setIcon(archiveCheckIcon, 'check');

    archiveOption.addEventListener('click', () => {
      // Get latest filter state
      const currentState = this.getFilterStateCallback?.() || filterState;
      const newIncludeArchived = !currentState.includeArchived;
      archiveOption.style.background = newIncludeArchived ? 'var(--background-modifier-hover)' : 'transparent';
      archiveCheckIcon.style.display = newIncludeArchived ? 'block' : 'none';

      this.onFilterChangeCallback?.({ includeArchived: newIncludeArchived });
      this.onRerenderCallback?.();
      updateFilterButton();
    });
  }

  /**
   * Attach outside click handler to close panel
   */
  private attachOutsideClickHandler(): void {
    this.closeHandler = (e: MouseEvent) => {
      if (this.panelEl && !this.panelEl.contains(e.target as Node) && !(e.target as HTMLElement).closest('.filter-panel')) {
        this.close();
      }
    };
    setTimeout(() => {
      if (this.closeHandler) {
        document.addEventListener('click', this.closeHandler);
      }
    }, 0);
  }

  /**
   * Set callback for filter changes
   */
  onFilterChange(callback: (filter: Partial<FilterState>) => void): void {
    this.onFilterChangeCallback = callback;
  }

  /**
   * Set callback for re-rendering
   */
  onRerender(callback: () => void): void {
    this.onRerenderCallback = callback;
  }

  /**
   * Set callback to get latest filter state
   */
  onGetFilterState(callback: () => FilterState): void {
    this.getFilterStateCallback = callback;
  }

  /**
   * Check if panel is currently open
   */
  get isOpened(): boolean {
    return this.isOpen;
  }
}
