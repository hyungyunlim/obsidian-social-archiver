<script lang="ts">
  import { Modal } from 'obsidian';
  import type { App } from 'obsidian';
  import URLInput from './URLInput.svelte';
  import AdvancedOptions from './AdvancedOptions.svelte';
  import Disclaimer from './Disclaimer.svelte';
  import ActionButtons from './ActionButtons.svelte';
  import PostPreview from './PostPreview.svelte';
  import { useArchiveState } from '../../hooks/useArchiveState';
  import type { ArchiveService } from '../../services/ArchiveService';
  import type { Platform, PostData } from '../../types/post';

  /**
   * Props
   */
  interface Props {
    app: App;
    archiveService: ArchiveService;
    onClose?: () => void;
    onSuccess?: (filePath: string) => void;
  }

  let { app, archiveService, onClose, onSuccess }: Props = $props();

  /**
   * Archive state management
   */
  const archiveState = useArchiveState(archiveService);

  /**
   * Component state
   */
  let url = $state('');
  let detectedPlatform = $state<Platform | null>(null);
  let isValidUrl = $state(false);
  let validationError = $state<string | null>(null);
  let showAdvanced = $state(false);
  let disclaimerAccepted = $state(false);
  let dontShowDisclaimer = $state(false);
  let fetchedPost = $state<PostData | null>(null);
  let showPreview = $state(false);

  /**
   * Advanced options state
   */
  let enableAI = $state(false);
  let downloadMedia = $state(true);
  let enableFactCheck = $state(false);
  let enableSentiment = $state(false);

  /**
   * Derived state
   */
  const canArchive = $derived(isValidUrl && disclaimerAccepted && !archiveState.isArchiving);

  /**
   * Handle URL change from URLInput component
   */
  function handleUrlChange(event: CustomEvent<{
    url: string;
    platform: Platform | null;
    valid: boolean;
    error: string | null;
  }>) {
    url = event.detail.url;
    detectedPlatform = event.detail.platform;
    isValidUrl = event.detail.valid;
    validationError = event.detail.error;
    showPreview = false;
    fetchedPost = null;
  }

  /**
   * Handle disclaimer acceptance
   */
  function handleDisclaimerChange(event: CustomEvent<{
    accepted: boolean;
    dontShow: boolean;
  }>) {
    disclaimerAccepted = event.detail.accepted;
    dontShowDisclaimer = event.detail.dontShow;

    // Save preference to plugin settings
    if (dontShowDisclaimer) {
      // TODO: Save to plugin settings
    }
  }

  /**
   * Handle archive action
   */
  async function handleArchive() {
    if (!canArchive) return;

    // Show initial notice
    const progressNotice = new Notice(`📡 Starting archive for ${detectedPlatform || 'post'}...`, 0);

    // Close modal immediately
    handleClose();

    // Run archive in background
    try {
      const result = await archiveState.archive(url, {
        enableAI,
        downloadMedia,
        onProgress: (progress) => {
          // Update progress notice
          progressNotice.setMessage(`⚙️ Archiving... ${Math.round(progress)}%`);
        },
      });

      // Hide progress notice
      progressNotice.hide();

      if (result.success && result.filePath) {
        // Show success notice
        new Notice(`✅ Post archived successfully!\nSaved to: ${result.filePath}`, 5000);

        // Call success callback
        onSuccess?.(result.filePath);
      } else if (result.error) {
        // Show error notice
        new Notice(`❌ Archive failed: ${result.error.message}`, 8000);
      }
    } catch (error) {
      progressNotice.hide();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`❌ Archive failed: ${errorMessage}`, 8000);
    }
  }

  /**
   * Handle cancel action
   */
  function handleCancel() {
    if (archiveState.isArchiving) {
      archiveState.cancel();
    }
    handleClose();
  }

  /**
   * Handle close action
   */
  function handleClose() {
    onClose?.();
  }

  /**
   * Handle ESC key
   */
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      handleArchive();
    }
  }

  /**
   * Handle preview toggle
   */
  async function handlePreviewToggle() {
    if (!showPreview && isValidUrl && !fetchedPost) {
      // Fetch post data for preview
      try {
        const result = await archiveState.archive(url, {
          enableAI: false,
          downloadMedia: false,
        });

        if (result.success && result.data) {
          fetchedPost = result.data;
        }
      } catch (error) {
        console.error('[ArchiveModal] Failed to fetch preview:', error);
      }
    }

    showPreview = !showPreview;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="archive-modal-container">
  <!-- Header -->
  <div class="modal-header">
    <h2 class="modal-title">Archive Social Post</h2>
    <button
      class="modal-close"
      onclick={handleClose}
      aria-label="Close modal"
      type="button"
    >
      ✕
    </button>
  </div>

  <!-- Content -->
  <div class="modal-content">
    <!-- URL Input -->
    <URLInput
      {url}
      onchange={handleUrlChange}
    />

    <!-- Post Preview -->
    {#if showPreview && fetchedPost}
      <PostPreview post={fetchedPost} />
    {/if}

    <!-- Advanced Options -->
    <AdvancedOptions
      bind:expanded={showAdvanced}
      bind:enableAI
      bind:downloadMedia
      bind:enableFactCheck
      bind:enableSentiment
      platform={detectedPlatform}
    />

    <!-- Disclaimer -->
    {#if !dontShowDisclaimer}
      <Disclaimer
        onchange={handleDisclaimerChange}
      />
    {/if}

    <!-- Error Display -->
    {#if archiveState.error}
      <div class="error-container">
        <div class="error-icon">❌</div>
        <div class="error-content">
          <div class="error-message">{archiveState.error.message}</div>
          <button
            class="btn-retry"
            onclick={() => archiveState.retry({ enableAI, downloadMedia })}
            type="button"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="modal-footer">
    <ActionButtons
      {canArchive}
      isArchiving={archiveState.isArchiving}
      progress={archiveState.progress}
      platform={detectedPlatform}
      onArchive={handleArchive}
      onCancel={handleCancel}
    />
  </div>
</div>

<style>
  .archive-modal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-primary);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-normal);
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 24px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-close:active {
    transform: scale(0.95);
  }

  /* Content */
  .modal-content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Error Container */
  .error-container {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: var(--background-modifier-error);
    border: 1px solid var(--text-error);
    border-radius: 8px;
    animation: shake 0.4s ease-in-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
  }

  .error-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .error-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .error-message {
    font-size: 14px;
    color: var(--text-error);
    font-weight: 600;
    line-height: 1.4;
  }

  .btn-retry {
    align-self: flex-start;
    padding: 6px 12px;
    background: var(--interactive-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-retry:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
  }

  .btn-retry:active {
    transform: translateY(0);
  }

  /* Footer */
  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .modal-header {
      padding: 16px 20px;
    }

    .modal-title {
      font-size: 18px;
    }

    .modal-content {
      padding: 20px;
      gap: 16px;
    }

    .modal-footer {
      padding: 12px 20px;
    }
  }

  /* Accessibility - Focus Visible */
  button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
