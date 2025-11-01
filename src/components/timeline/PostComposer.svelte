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
import { LinkPreviewRenderer } from '@/components/timeline/renderers/LinkPreviewRenderer';
import MarkdownEditor from '@/components/editor/MarkdownEditor.svelte';

/**
 * Attached image data
 */
interface AttachedImage {
  id: string;
  file: File;
  preview: string;
  size: number;
}

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
let attachedImages = $state<AttachedImage[]>([]);
let detectedUrls = $state<string[]>([]);

/**
 * Draft service
 */
let draftService: DraftService;
const DRAFT_ID = 'post-composer-draft';

/**
 * Link preview renderer
 */
let linkPreviewRenderer: LinkPreviewRenderer;

/**
 * File input element
 */
let fileInputElement: HTMLInputElement;

/**
 * Link preview container
 */
let linkPreviewContainer: HTMLElement;

/**
 * Debounce timer for URL detection
 */
let urlDetectionTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Editor reference
 */
let editorRef: any = $state(null);

/**
 * Expand the composer to show full editor
 */
async function expand(): Promise<void> {
  console.log('[PostComposer] expand() called');
  isExpanded = true;
  error = null;

  // Auto-recover draft without notification
  try {
    const recovery = await draftService.recoverDrafts(DRAFT_ID);
    if (recovery.hasDraft && recovery.draft) {
      content = recovery.draft.content;
      console.log('[PostComposer] Draft auto-restored:', content);
    } else {
      console.log('[PostComposer] No draft found');
    }
  } catch (err) {
    console.error('[PostComposer] Failed to recover draft:', err);
  }

  // Start auto-save
  draftService.startAutoSave(DRAFT_ID, () => content);
  console.log('[PostComposer] Auto-save started');
}

/**
 * Collapse the composer to show only placeholder
 */
function collapse(): void {
  isExpanded = false;
  error = null;
  attachedImages = [];

  // Stop auto-save
  draftService.stopAutoSave();
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
    console.log('[PostComposer] Attached images:', attachedImages.length);

    // Convert attached images to media array
    const media = attachedImages.map((img) => ({
      type: 'image' as const,
      url: img.preview, // Temporary preview URL
      width: 0, // Will be set after upload
      height: 0,
      file: img.file, // Include file for upload
    }));

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
      media,
      metadata: {
        timestamp: new Date(),
      },
      linkPreviews: detectedUrls, // Include detected URLs for link preview generation
    };

    // Notify parent component
    if (onPostCreated) {
      onPostCreated(postData as PostData);
    }

    // Delete draft after successful post
    draftService.deleteDraft(DRAFT_ID);

    // Reset content and collapse
    content = '';
    attachedImages = [];
    collapse();
  } catch (err) {
    console.error('[PostComposer] Failed to create post:', err);
    error = err instanceof Error ? err.message : 'Failed to create post';
  } finally {
    isSubmitting = false;
  }
}

/**
 * Open file picker
 */
function openFilePicker(): void {
  fileInputElement?.click();
}

/**
 * Handle file selection
 */
async function handleFileSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);

  if (files.length === 0) return;

  // Validate and process files
  for (const file of files) {
    // Check file type
    if (!file.type.startsWith('image/')) {
      error = `Invalid file type: ${file.name}`;
      continue;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      error = `File too large: ${file.name} (max 10MB)`;
      continue;
    }

    // Check max images limit
    if (attachedImages.length >= 10) {
      error = 'Maximum 10 images allowed';
      break;
    }

    // Create preview
    try {
      const preview = await createPreview(file);
      const image: AttachedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
        size: file.size
      };
      attachedImages = [...attachedImages, image];
    } catch (err) {
      console.error('[PostComposer] Failed to create preview:', err);
      error = `Failed to process: ${file.name}`;
    }
  }

  // Reset input
  input.value = '';
}

/**
 * Create preview URL from file
 */
function createPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Remove image
 */
function removeImage(imageId: string): void {
  attachedImages = attachedImages.filter(img => img.id !== imageId);
}

/**
 * Detect URLs in content
 * Only matches complete URLs with valid domains
 */
function detectUrls(text: string): string[] {
  console.log('[PostComposer] detectUrls called with text:', text);

  // More strict URL regex pattern - must have valid domain
  const urlPattern = /(https?:\/\/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  const matches = text.match(urlPattern);

  console.log('[PostComposer] URL matches found:', matches);

  if (!matches) return [];

  // Clean and filter URLs
  const validUrls = matches
    .map(url => {
      // Remove trailing characters like >, ), ], etc.
      return url.replace(/[>)\]]+$/, '');
    })
    .filter(url => {
      try {
        const parsed = new URL(url);
        // Must have valid hostname with at least one dot
        return parsed.hostname.includes('.');
      } catch {
        return false;
      }
    });

  console.log('[PostComposer] Valid URLs after cleaning and filtering:', validUrls);
  return [...new Set(validUrls)]; // Remove duplicates
}

/**
 * Remove a detected URL from preview
 */
function removeUrlPreview(url: string): void {
  detectedUrls = detectedUrls.filter(u => u !== url);
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Handle cancel action
 */
function handleCancel(): void {
  console.log('[PostComposer] handleCancel called');

  // Delete draft on cancel
  if (content.trim()) {
    console.log('[PostComposer] Deleting draft on cancel');
    draftService.deleteDraft(DRAFT_ID);
  }

  // Clear content
  content = '';

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
 * Handle keyboard events on close button
 */
function handleCloseKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleCancel();
  }
}

/**
 * Reactive effect for content changes with debouncing
 */
$effect(() => {
  if (content && isExpanded) {
    console.log('[PostComposer] Content changed, setting up timer');
    handleContentChange();

    // Clear existing timer
    if (urlDetectionTimer) {
      clearTimeout(urlDetectionTimer);
    }

    // Debounce URL detection (wait 2 seconds after user stops typing)
    // This prevents API calls while actively typing
    urlDetectionTimer = setTimeout(() => {
      console.log('[PostComposer] Timer fired after 2 seconds');
      const urls = detectUrls(content);
      if (JSON.stringify(urls) !== JSON.stringify(detectedUrls)) {
        console.log('[PostComposer] URLs changed in timer, updating...');
        detectedUrls = urls;
        renderLinkPreviews(urls);
      }
    }, 2000); // 2 second delay - ensures user finished typing
  }
});

/**
 * Render link previews for detected URLs
 */
async function renderLinkPreviews(urls: string[]): Promise<void> {
  // Wait for next tick to ensure DOM is ready
  await new Promise(resolve => setTimeout(resolve, 0));

  if (!linkPreviewContainer) {
    console.warn('[PostComposer] Link preview container not ready');
    return;
  }

  // Clear existing previews
  linkPreviewContainer.empty();

  // Render new previews
  if (urls.length > 0 && linkPreviewRenderer) {
    console.log('[PostComposer] Rendering link previews for:', urls);
    await linkPreviewRenderer.renderPreviews(linkPreviewContainer, urls);
  }
}

/**
 * Trigger URL detection immediately (when user leaves editor)
 */
function triggerUrlDetection(): void {
  console.log('[PostComposer] triggerUrlDetection called (onBlur)');
  console.log('[PostComposer] Current content:', content);

  // Clear any pending timer
  if (urlDetectionTimer) {
    clearTimeout(urlDetectionTimer);
    urlDetectionTimer = null;
  }

  // Detect URLs immediately
  const urls = detectUrls(content);
  console.log('[PostComposer] Detected URLs:', urls);
  console.log('[PostComposer] Current detectedUrls:', detectedUrls);

  if (JSON.stringify(urls) !== JSON.stringify(detectedUrls)) {
    console.log('[PostComposer] URLs changed, updating...');
    detectedUrls = urls;
    renderLinkPreviews(urls);
  } else {
    console.log('[PostComposer] URLs unchanged, skipping render');
  }
}

onMount(async () => {
  console.log('[PostComposer] Component mounted');

  // Initialize draft service
  draftService = new DraftService(app);
  await draftService.initialize();
  console.log('[PostComposer] Draft service initialized');

  // Initialize link preview renderer
  linkPreviewRenderer = new LinkPreviewRenderer(settings.workerUrl);
  console.log('[PostComposer] Link preview renderer initialized');

  // Add global keydown listener
  window.addEventListener('keydown', handleKeydown);
  console.log('[PostComposer] Event listeners registered');
});

onDestroy(() => {
  // Cleanup
  window.removeEventListener('keydown', handleKeydown);

  // Clear URL detection timer
  if (urlDetectionTimer) {
    clearTimeout(urlDetectionTimer);
  }

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
    </button>
  {:else}
    <!-- Expanded State -->
    <div class="composer-expanded">
      <div class="composer-header">
        <h3 class="composer-title">Create Post</h3>
        <span
          class="close-button"
          onclick={handleCancel}
          onkeydown={handleCloseKeydown}
          role="button"
          tabindex="0"
          aria-label="Close composer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </span>
      </div>

      <div class="composer-body">
        {#if error}
          <div class="error-message" role="alert">
            {error}
          </div>
        {/if}


        <!-- Editor Toolbar -->
        <div class="editor-toolbar">
          <!-- Hidden file input -->
          <input
            type="file"
            bind:this={fileInputElement}
            onchange={handleFileSelect}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            multiple
            style="display: none;"
          />

          <!-- Image button -->
          <button
            type="button"
            class="toolbar-btn"
            onclick={openFilePicker}
            disabled={isSubmitting || attachedImages.length >= 10}
            aria-label="Add images"
            title="Add images (max 10)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            {#if attachedImages.length > 0}
              <span class="image-count-badge">{attachedImages.length}</span>
            {/if}
          </button>

          <div class="toolbar-divider"></div>

          <!-- Bold -->
          <button
            type="button"
            class="toolbar-btn"
            onclick={() => editorRef?.getEditor()?.chain().focus().toggleBold().run()}
            class:is-active={editorRef?.getEditor()?.isActive('bold')}
            aria-label="Bold"
            title="Bold (Ctrl+B)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>
            </svg>
          </button>
          <button
            type="button"
            class="toolbar-btn"
            onclick={() => editorRef?.getEditor()?.chain().focus().toggleItalic().run()}
            class:is-active={editorRef?.getEditor()?.isActive('italic')}
            aria-label="Italic"
            title="Italic (Ctrl+I)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" x2="10" y1="4" y2="4"/>
              <line x1="14" x2="5" y1="20" y2="20"/>
              <line x1="15" x2="9" y1="4" y2="20"/>
            </svg>
          </button>
          <button
            type="button"
            class="toolbar-btn"
            onclick={() => editorRef?.getEditor()?.chain().focus().toggleStrike().run()}
            class:is-active={editorRef?.getEditor()?.isActive('strike')}
            aria-label="Strikethrough"
            title="Strikethrough"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4H9a3 3 0 0 0-2.83 4"/>
              <path d="M14 12a4 4 0 0 1 0 8H6"/>
              <line x1="4" x2="20" y1="12" y2="12"/>
            </svg>
          </button>

          <div class="toolbar-divider"></div>

          <!-- Bullet List -->
          <button
            type="button"
            class="toolbar-btn"
            onclick={() => editorRef?.getEditor()?.chain().focus().toggleBulletList().run()}
            class:is-active={editorRef?.getEditor()?.isActive('bulletList')}
            aria-label="Bullet List"
            title="Bullet List"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" x2="21" y1="6" y2="6"/>
              <line x1="8" x2="21" y1="12" y2="12"/>
              <line x1="8" x2="21" y1="18" y2="18"/>
              <line x1="3" x2="3.01" y1="6" y2="6"/>
              <line x1="3" x2="3.01" y1="12" y2="12"/>
              <line x1="3" x2="3.01" y1="18" y2="18"/>
            </svg>
          </button>
          <button
            type="button"
            class="toolbar-btn"
            onclick={() => editorRef?.getEditor()?.chain().focus().toggleOrderedList().run()}
            class:is-active={editorRef?.getEditor()?.isActive('orderedList')}
            aria-label="Numbered List"
            title="Numbered List"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="10" x2="21" y1="6" y2="6"/>
              <line x1="10" x2="21" y1="12" y2="12"/>
              <line x1="10" x2="21" y1="18" y2="18"/>
              <path d="M4 6h1v4"/>
              <path d="M4 10h2"/>
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
            </svg>
          </button>
          <div class="toolbar-divider"></div>
          <button
            type="button"
            class="toolbar-btn"
            onclick={() => editorRef?.getEditor()?.chain().focus().toggleCodeBlock().run()}
            class:is-active={editorRef?.getEditor()?.isActive('codeBlock')}
            aria-label="Code Block"
            title="Code Block"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </button>
        </div>

        <!-- Markdown Editor with TipTap -->
        <MarkdownEditor
          bind:this={editorRef}
          content={content}
          placeholder="What's on your mind?"
          maxLength={10000}
          onUpdate={(markdown) => {
            content = markdown;
          }}
          onBlur={triggerUrlDetection}
        />

        <!-- Link Previews -->
        {#if detectedUrls.length > 0}
          <div bind:this={linkPreviewContainer} class="link-previews-section"></div>
        {/if}

        <!-- Image Previews -->
        {#if attachedImages.length > 0}
          <div class="image-previews">
            {#each attachedImages as image (image.id)}
              <div class="image-preview-item">
                <img src={image.preview} alt="Preview" class="preview-image" />
                <button
                  type="button"
                  class="remove-image-btn"
                  onclick={() => removeImage(image.id)}
                  aria-label="Remove image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
                <div class="image-info">{formatFileSize(image.size)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="composer-footer">
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
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 10px 12px;
    background: var(--background-primary);
    border: 0.5px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: none;
  }

  .composer-collapsed:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .avatar-placeholder {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
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
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .placeholder-text {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: left;
  }

  /* Expanded state */
  .composer-expanded {
    background: var(--background-primary);
    border: none;
    border-radius: var(--radius-s);
    animation: expand 0.2s ease-out;
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
    padding: 16px 16px 8px 16px;
    border-bottom: none;
  }

  .composer-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
  }

  .close-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-muted);
    transition: color 0.2s ease;
    line-height: 0;
  }

  .close-button:hover {
    color: var(--text-normal);
  }

  .composer-body {
    padding: 16px;
    min-height: 200px;
    max-height: 500px;
    overflow-y: auto;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 0;
    margin-bottom: 12px;
  }

  .toolbar-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    outline: none;
    background: none;
    box-shadow: none;
    cursor: pointer;
    color: var(--text-muted);
    transition: color 0.15s ease;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  .toolbar-btn:hover:not(:disabled) {
    color: var(--text-normal);
  }

  .toolbar-btn:focus {
    outline: none;
    box-shadow: none;
  }

  .toolbar-btn:active {
    outline: none;
    box-shadow: none;
  }

  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar-btn.is-active {
    color: var(--interactive-accent);
  }

  .image-count-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 9px;
    font-weight: 600;
    border-radius: 50%;
    padding: 0 3px;
  }

  .toolbar-divider {
    width: 1px;
    height: 16px;
    background: var(--background-modifier-border);
    margin: 0 6px;
  }

  .link-previews-section {
    margin-top: 12px;
  }

  .image-previews {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .image-preview-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-s);
    overflow: hidden;
    background: var(--background-secondary);
  }

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-image-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: white;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .image-preview-item:hover .remove-image-btn {
    opacity: 1;
  }

  .remove-image-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .image-info {
    position: absolute;
    bottom: 4px;
    left: 4px;
    right: 4px;
    padding: 2px 4px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 10px;
    text-align: center;
    border-radius: 3px;
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

  .composer-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 16px 16px 16px;
    border-top: none;
  }

  .btn-secondary,
  .btn-primary {
    padding: 8px 16px;
    border: none;
    border-radius: var(--radius-s);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 32px;
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

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .composer-collapsed {
      min-height: 44px;
      padding: 8px 10px;
    }

    .avatar-placeholder {
      width: 24px;
      height: 24px;
    }

    .placeholder-text {
      font-size: 0.813rem;
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
  }
</style>
