<script lang="ts">
/**
 * PostComposer - Main container for creating user posts
 *
 * Provides a Facebook-style post creation interface with:
 * - Collapsed state (60px height with placeholder)
 * - Expanded state (full editor with media upload)
 * - Smooth transitions between states
 * - Mobile-responsive design
 * - Auto-save draft functionality
 * - Draft recovery on open
 */

import { onMount, onDestroy } from 'svelte';
import type { App } from 'obsidian';
import type { PostData } from '@/types/post';
import type { SocialArchiverSettings } from '@/types/settings';
import { DraftService } from '@/services/DraftService';

/**
 * Component props
 */
interface PostComposerProps {
  app: App;
  settings: SocialArchiverSettings;
  onPostCreated?: (post: PostData) => void;
  onCancel?: () => void;
}

let {
  app,
  settings,
  onPostCreated,
  onCancel
}: PostComposerProps = $props();

/**
 * Component state using Svelte 5 runes
 */
let isExpanded = $state(false);
let isSubmitting = $state(false);
let error = $state<string | null>(null);
let content = $state('');
let showDraftRecovery = $state(false);
let recoveredDraft = $state<string | null>(null);

/**
 * Draft service
 */
let draftService: DraftService;
const DRAFT_ID = 'post-composer-draft';

/**
 * Expand the composer to show full editor
 */
async function expand(): Promise<void> {
  isExpanded = true;
  error = null;

  // Try to recover draft
  try {
    const recovery = await draftService.recoverDrafts(DRAFT_ID);
    if (recovery.hasDraft && recovery.draft) {
      recoveredDraft = recovery.draft.content;
      showDraftRecovery = true;
      console.log('[PostComposer] Draft recovered');
    }
  } catch (err) {
    console.error('[PostComposer] Failed to recover draft:', err);
  }

  // Start auto-save
  draftService.startAutoSave(DRAFT_ID, () => content);
}

/**
 * Collapse the composer to show only placeholder
 */
function collapse(): void {
  isExpanded = false;
  error = null;
  showDraftRecovery = false;

  // Stop auto-save
  draftService.stopAutoSave();
}

/**
 * Restore recovered draft
 */
function restoreDraft(): void {
  if (recoveredDraft) {
    content = recoveredDraft;
    showDraftRecovery = false;
    recoveredDraft = null;
  }
}

/**
 * Discard recovered draft
 */
function discardDraft(): void {
  if (recoveredDraft) {
    draftService.deleteDraft(DRAFT_ID);
    showDraftRecovery = false;
    recoveredDraft = null;
  }
}

/**
 * Handle content change with debounced save
 */
function handleContentChange(): void {
  if (content.trim()) {
    draftService.saveDraft(DRAFT_ID, content, { debounce: true });
  }
}

/**
 * Handle post submission
 */
async function handleSubmit(): Promise<void> {
  if (isSubmitting || !content.trim()) return;

  try {
    isSubmitting = true;
    error = null;

    // TODO: Implement post creation logic in subsequent tasks
    console.log('[PostComposer] Submitting post...');

    // Placeholder for post data
    const postData: Partial<PostData> = {
      platform: 'post',
      author: {
        name: settings.userName,
        url: '', // Will be set to vault path
        avatar: settings.userAvatar,
        handle: `@${settings.username}`,
      },
      content: {
        text: content,
      },
      media: [],
      metadata: {
        timestamp: new Date(),
      },
    };

    // Notify parent component
    if (onPostCreated) {
      onPostCreated(postData as PostData);
    }

    // Delete draft after successful post
    draftService.deleteDraft(DRAFT_ID);

    // Reset content and collapse
    content = '';
    collapse();
  } catch (err) {
    console.error('[PostComposer] Failed to create post:', err);
    error = err instanceof Error ? err.message : 'Failed to create post';
  } finally {
    isSubmitting = false;
  }
}

/**
 * Handle cancel action
 */
function handleCancel(): void {
  // Save draft before canceling (user may want to continue later)
  if (content.trim()) {
    draftService.saveDraft(DRAFT_ID, content, { immediate: true });
  }

  if (onCancel) {
    onCancel();
  }
  collapse();
}

/**
 * Handle escape key to collapse
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isExpanded) {
    handleCancel();
  }
}

/**
 * Reactive effect for content changes
 */
$effect(() => {
  if (content && isExpanded) {
    handleContentChange();
  }
});

onMount(async () => {
  // Initialize draft service
  draftService = new DraftService(app);
  await draftService.initialize();

  // Add global keydown listener
  window.addEventListener('keydown', handleKeydown);
});

onDestroy(() => {
  // Cleanup
  window.removeEventListener('keydown', handleKeydown);
  if (draftService) {
    draftService.cleanup();
  }
});
</script>

<div
  class="post-composer"
  class:expanded={isExpanded}
  role="region"
  aria-label="Create a post"
>
  {#if !isExpanded}
    <!-- Collapsed State -->
    <button
      type="button"
      class="composer-collapsed"
      onclick={expand}
      aria-label="Click to create a post"
    >
      <div class="avatar-placeholder">
        {#if settings.userAvatar}
          <img src={settings.userAvatar} alt={settings.userName} class="avatar-image" />
        {:else}
          <div class="avatar-initials">
            {settings.userName.charAt(0).toUpperCase()}
          </div>
        {/if}
      </div>

      <span class="placeholder-text">
        What's on your mind?
      </span>

      <div class="quick-actions">
        <button type="button" class="quick-action" aria-label="Add images">
          📷
        </button>
        <button type="button" class="quick-action" aria-label="Share settings">
          🔗
        </button>
      </div>
    </button>
  {:else}
    <!-- Expanded State -->
    <div class="composer-expanded">
      <div class="composer-header">
        <h3 class="composer-title">Create Post</h3>
        <button
          type="button"
          class="close-button"
          onclick={handleCancel}
          aria-label="Close composer"
        >
          ✕
        </button>
      </div>

      <div class="composer-body">
        {#if error}
          <div class="error-message" role="alert">
            {error}
          </div>
        {/if}

        {#if showDraftRecovery && recoveredDraft}
          <div class="draft-recovery" role="alert">
            <div class="recovery-header">
              <span class="recovery-icon">💾</span>
              <span class="recovery-text">
                We found a saved draft from {new Date().toLocaleDateString()}
              </span>
            </div>
            <div class="recovery-actions">
              <button
                type="button"
                class="btn-recovery-restore"
                onclick={restoreDraft}
              >
                Restore
              </button>
              <button
                type="button"
                class="btn-recovery-discard"
                onclick={discardDraft}
              >
                Discard
              </button>
            </div>
          </div>
        {/if}

        <!-- Temporary textarea until MarkdownEditor is implemented (Task 66) -->
        <textarea
          bind:value={content}
          class="composer-textarea"
          placeholder="What's on your mind?"
          rows="8"
          aria-label="Post content"
        ></textarea>

        <div class="editor-note">
          <p class="text-muted">
            📝 Rich text editor will be added in Task 66. Using simple textarea for now.
          </p>
        </div>
      </div>

      <div class="composer-footer">
        <div class="footer-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            class="btn-primary"
            onclick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        <div class="character-count">
          {content.length} / 10,000
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Main container */
  .post-composer {
    width: 100%;
    margin-bottom: 1rem;
  }

  /* Collapsed state */
  .composer-collapsed {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    height: 60px;
    padding: 0.75rem 1rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .composer-collapsed:hover {
    background: var(--background-secondary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .avatar-placeholder {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--background-modifier-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-initials {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .placeholder-text {
    flex: 1;
    font-size: 1rem;
    color: var(--text-muted);
    text-align: left;
  }

  .quick-actions {
    display: flex;
    gap: 0.5rem;
  }

  .quick-action {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.25rem;
    transition: background 0.2s ease;
  }

  .quick-action:hover {
    background: var(--background-modifier-hover);
  }

  /* Expanded state */
  .composer-expanded {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: expand 0.3s ease-out;
  }

  @keyframes expand {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .composer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .composer-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
  }

  .close-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.25rem;
    color: var(--text-muted);
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .composer-body {
    padding: 1rem;
    min-height: 200px;
    max-height: 500px;
    overflow-y: auto;
  }

  .error-message {
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: var(--background-modifier-error);
    border-left: 3px solid var(--text-error);
    border-radius: 6px;
    color: var(--text-error);
    font-size: 0.875rem;
  }

  .editor-placeholder {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  /* Draft recovery */
  .draft-recovery {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: var(--background-secondary);
    border-left: 3px solid var(--interactive-accent);
    border-radius: 6px;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .recovery-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .recovery-icon {
    font-size: 1.25rem;
  }

  .recovery-text {
    font-size: 0.875rem;
    color: var(--text-normal);
  }

  .recovery-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-recovery-restore,
  .btn-recovery-discard {
    padding: 0.375rem 0.875rem;
    border: none;
    border-radius: 6px;
    font-size: 0.813rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 32px;
  }

  .btn-recovery-restore {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-recovery-restore:hover {
    background: var(--interactive-accent-hover);
  }

  .btn-recovery-discard {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn-recovery-discard:hover {
    background: var(--background-modifier-hover);
  }

  /* Composer textarea */
  .composer-textarea {
    width: 100%;
    min-height: 150px;
    padding: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    color: var(--text-normal);
    font-family: var(--font-interface);
    font-size: 1rem;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.2s ease;
  }

  .composer-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .composer-textarea::placeholder {
    color: var(--text-muted);
  }

  .editor-note {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 6px;
    text-align: center;
  }

  .editor-note p {
    margin: 0;
    font-size: 0.813rem;
  }

  .composer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.5rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .btn-secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .btn-secondary:disabled,
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .character-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .text-muted {
    color: var(--text-muted);
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .composer-collapsed {
      height: 56px;
      padding: 0.625rem 0.75rem;
    }

    .avatar-placeholder {
      width: 36px;
      height: 36px;
    }

    .placeholder-text {
      font-size: 0.938rem;
    }

    .quick-action {
      width: 40px;
      height: 40px;
      font-size: 1.125rem;
    }

    .composer-expanded {
      border-radius: 0;
      margin: 0 -0.5rem;
    }

    .composer-body {
      min-height: 150px;
      max-height: 400px;
    }

    .composer-footer {
      flex-direction: column-reverse;
      gap: 0.75rem;
      align-items: stretch;
    }

    .footer-actions {
      width: 100%;
      justify-content: space-between;
    }

    .character-count {
      text-align: center;
    }
  }
</style>
