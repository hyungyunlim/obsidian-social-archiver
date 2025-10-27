<script lang="ts">
  import type { Platform } from '../../types/post';

  /**
   * Props
   */
  interface Props {
    canArchive: boolean;
    isArchiving: boolean;
    progress: number;
    platform?: Platform | null;
    onArchive: () => void;
    onCancel: () => void;
  }

  let {
    canArchive,
    isArchiving,
    progress,
    platform = null,
    onArchive,
    onCancel
  }: Props = $props();

  /**
   * Platform colors for styling
   */
  const platformColors: Record<Platform, string> = {
    facebook: '#1877f2',
    linkedin: '#0077b5',
    instagram: '#E4405F',
    tiktok: '#000000',
    x: '#000000',
    threads: '#000000'
  };

  /**
   * Get platform gradient
   */
  const platformGradient = $derived(() => {
    if (!platform) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    const color = platformColors[platform];
    return `linear-gradient(135deg, ${color} 0%, ${adjustBrightness(color, -20)} 100%)`;
  });

  /**
   * Adjust brightness of hex color
   */
  function adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1)}`;
  }

  /**
   * Progress text
   */
  const progressText = $derived(() => {
    if (progress === 0) return 'Starting...';
    if (progress < 30) return 'Fetching post...';
    if (progress < 70) return 'Processing content...';
    if (progress < 100) return 'Saving to vault...';
    return 'Complete!';
  });

  /**
   * Handle keyboard shortcut
   */
  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (canArchive && !isArchiving) {
        onArchive();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="action-buttons-container">
  <!-- Cancel Button -->
  <button
    type="button"
    class="btn btn-cancel"
    onclick={onCancel}
    disabled={false}
    aria-label="Cancel"
  >
    {isArchiving ? 'Cancel' : 'Close'}
  </button>

  <!-- Archive Button -->
  <button
    type="button"
    class="btn btn-archive"
    class:btn-disabled={!canArchive}
    class:btn-archiving={isArchiving}
    style="background: {platform ? platformGradient() : ''}"
    onclick={onArchive}
    disabled={!canArchive}
    aria-label={isArchiving ? `Archiving... ${progress}%` : 'Archive post'}
  >
    {#if isArchiving}
      <div class="btn-content-archiving">
        <div class="circular-progress">
          <svg class="progress-ring" width="24" height="24">
            <circle
              class="progress-ring-circle"
              stroke="currentColor"
              stroke-width="3"
              fill="transparent"
              r="9"
              cx="12"
              cy="12"
              style="stroke-dashoffset: {56.5 - (56.5 * progress) / 100}"
            />
          </svg>
        </div>
        <div class="progress-info">
          <span class="progress-percentage">{progress}%</span>
          <span class="progress-text">{progressText()}</span>
        </div>
      </div>
    {:else}
      <span class="btn-icon">💾</span>
      <span class="btn-text">Archive</span>
      <span class="keyboard-hint">(⌘↵)</span>
    {/if}
  </button>
</div>

<style>
  .action-buttons-container {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  /* Base Button Styles */
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px; /* iOS touch target */
    min-width: 120px;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .btn:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  /* Cancel Button */
  .btn-cancel {
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
  }

  .btn-cancel:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    transform: translateY(-1px);
  }

  .btn-cancel:active:not(:disabled) {
    transform: translateY(0);
  }

  /* Archive Button */
  .btn-archive {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    flex: 1;
    max-width: 300px;
  }

  .btn-archive:hover:not(:disabled):not(.btn-archiving) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }

  .btn-archive:active:not(:disabled):not(.btn-archiving) {
    transform: translateY(0);
  }

  .btn-archive.btn-disabled {
    background: var(--background-modifier-border);
    color: var(--text-muted);
  }

  .btn-archive.btn-archiving {
    cursor: wait;
  }

  /* Button Content */
  .btn-icon {
    font-size: 18px;
  }

  .btn-text {
    font-weight: 700;
  }

  .keyboard-hint {
    font-size: 12px;
    opacity: 0.7;
    font-weight: 500;
  }

  /* Archiving State */
  .btn-content-archiving {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .circular-progress {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .progress-ring {
    transform: rotate(-90deg);
  }

  .progress-ring-circle {
    stroke-dasharray: 56.5;
    stroke-dashoffset: 56.5;
    transition: stroke-dashoffset 0.3s ease;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
  }

  .progress-percentage {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .progress-text {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.9;
    line-height: 1.2;
  }

  /* Success Animation */
  .btn-archive.btn-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    animation: success-pulse 0.5s ease-out;
  }

  @keyframes success-pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .action-buttons-container {
      flex-direction: column-reverse;
      gap: 8px;
    }

    .btn {
      width: 100%;
      max-width: none;
    }

    .btn-archive {
      max-width: none;
    }

    .keyboard-hint {
      display: none; /* Hide keyboard hint on mobile */
    }
  }

  /* Platform-specific button sizes */
  @media (min-width: 769px) {
    .btn-cancel {
      min-width: auto;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .btn,
    .progress-ring-circle {
      transition: none !important;
    }

    .btn-archive.btn-success {
      animation: none !important;
    }
  }

  /* High Contrast */
  @media (prefers-contrast: high) {
    .btn {
      border-width: 2px;
    }

    .btn-archive:not(.btn-disabled) {
      border: 2px solid white;
    }
  }
</style>
