<script lang="ts">
/**
 * Timeline - Minimalist timeline view with integrated PostComposer
 *
 * Design Principles:
 * - Mobile-first with 44px minimum touch targets
 * - Progressive disclosure (show only what's needed)
 * - Clean, card-based layout
 * - Smooth animations and transitions
 * - Intuitive without documentation
 */

import { onMount } from 'svelte';
import { Notice } from 'obsidian';
import PostComposer from './PostComposer.svelte';
import type { PostData } from '@/types/post';
import type { SocialArchiverSettings } from '@/types/settings';
import { VaultStorageService } from '@/services/VaultStorageService';
import type { App } from 'obsidian';

/**
 * Component props
 */
interface TimelineProps {
  app: App;
  settings: SocialArchiverSettings;
  showComposer?: boolean;
}

let {
  app,
  settings,
  showComposer = true
}: TimelineProps = $props();

/**
 * Component state - Keep it simple!
 */
let posts = $state<PostData[]>([]);
let isLoading = $state(true);
let error = $state<string | null>(null);
let isRefreshing = $state(false);

// Composer state
let composerKey = $state(0); // For resetting composer
let hasNewPost = $state(false);

// Pagination (for future)
let hasMore = $state(true);
let page = $state(1);

/**
 * Storage service
 */
let storageService: VaultStorageService | null = null;

/**
 * Load posts from vault
 */
async function loadPosts(refresh = false) {
  try {
    if (refresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }
    error = null;

    if (!storageService) {
      storageService = new VaultStorageService(app.vault, app.metadataCache);
      await storageService.initialize();
    }

    // Get user posts from storage
    const userPosts = await storageService.getUserPosts(settings.username || 'default');

    // Sort by timestamp (newest first)
    posts = userPosts.sort((a, b) => {
      const timeA = new Date(a.metadata.timestamp).getTime();
      const timeB = new Date(b.metadata.timestamp).getTime();
      return timeB - timeA;
    });

    // Check if there are more posts (for pagination)
    hasMore = posts.length >= 20 * page;

  } catch (err) {
    console.error('[Timeline] Failed to load posts:', err);
    error = err instanceof Error ? err.message : 'Failed to load timeline';
  } finally {
    isLoading = false;
    isRefreshing = false;
  }
}

/**
 * Handle new post creation
 */
async function handlePostCreated(post: PostData) {
  // Add to timeline immediately for instant feedback
  posts = [post, ...posts];
  hasNewPost = true;

  // Reset composer
  composerKey++;

  // Smooth scroll to top to show new post
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 100);

  // Remove highlight after animation
  setTimeout(() => {
    hasNewPost = false;
  }, 2000);
}

/**
 * Pull to refresh gesture (mobile)
 */
let startY = 0;
let pullDistance = 0;
let isPulling = $state(false);

function handleTouchStart(e: TouchEvent) {
  if (window.scrollY === 0) {
    startY = e.touches[0].pageY;
  }
}

function handleTouchMove(e: TouchEvent) {
  if (startY === 0) return;

  const currentY = e.touches[0].pageY;
  const diff = currentY - startY;

  if (diff > 0 && window.scrollY === 0) {
    e.preventDefault();
    pullDistance = Math.min(diff, 100);
    isPulling = true;
  }
}

async function handleTouchEnd() {
  if (pullDistance > 60) {
    await loadPosts(true);
  }

  startY = 0;
  pullDistance = 0;
  isPulling = false;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Get user initials for avatar placeholder
 */
function getUserInitials(name: string): string {
  return name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Lifecycle
 */
onMount(() => {
  loadPosts();

  // Add touch listeners for pull-to-refresh
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);

  return () => {
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };
});
</script>

<div class="timeline-container">
  <!-- Pull to Refresh Indicator -->
  {#if isPulling}
    <div
      class="pull-indicator"
      style="transform: translateY({pullDistance}px); opacity: {pullDistance / 100}"
    >
      <div class="pull-spinner"></div>
    </div>
  {/if}

  <!-- Header - Keep it clean! -->
  <header class="timeline-header">
    <h1 class="timeline-title">Your Timeline</h1>
    {#if !isLoading && posts.length > 0}
      <button
        class="refresh-btn"
        onclick={() => loadPosts(true)}
        disabled={isRefreshing}
        aria-label="Refresh timeline"
      >
        <svg
          class="refresh-icon"
          class:spinning={isRefreshing}
          width="20"
          height="20"
          viewBox="0 0 24 24"
        >
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
      </button>
    {/if}
  </header>

  <!-- PostComposer - Collapsed by default for simplicity -->
  {#if showComposer && settings.username}
    <div class="composer-wrapper" key={composerKey}>
      <PostComposer
        {app}
        {settings}
        onPostCreated={handlePostCreated}
      />
    </div>
  {/if}

  <!-- Timeline Content -->
  <main class="timeline-content">
    {#if isLoading}
      <!-- Skeleton loader for better UX -->
      <div class="skeleton-container">
        {#each Array(3) as _, i}
          <div class="skeleton-card">
            <div class="skeleton-header">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-meta">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line shorter"></div>
              </div>
            </div>
            <div class="skeleton-content">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line medium"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if error}
      <!-- Error state - Clean and helpful -->
      <div class="error-state">
        <svg class="error-icon" width="48" height="48" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p class="error-message">{error}</p>
        <button class="retry-btn" onclick={() => loadPosts()}>
          Try Again
        </button>
      </div>
    {:else if posts.length === 0}
      <!-- Empty state - Encouraging and actionable -->
      <div class="empty-state">
        <svg class="empty-icon" width="64" height="64" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="9" y1="17" x2="12" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <h2 class="empty-title">No posts yet</h2>
        <p class="empty-text">
          {#if showComposer}
            Share your first thought above!
          {:else}
            Start creating and sharing your thoughts
          {/if}
        </p>
      </div>
    {:else}
      <!-- Post Cards - Clean, minimal design -->
      <div class="posts-container">
        {#each posts as post, index (post.id)}
          <article
            class="post-card"
            class:new-post={index === 0 && hasNewPost}
          >
            <!-- Post Header -->
            <header class="post-header">
              <div class="post-author">
                {#if post.author.avatar}
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    class="author-avatar"
                  />
                {:else}
                  <div class="author-avatar placeholder">
                    {getUserInitials(post.author.name)}
                  </div>
                {/if}
                <div class="author-info">
                  <h3 class="author-name">{post.author.name}</h3>
                  <time class="post-time">
                    {formatTimestamp(post.metadata.timestamp)}
                  </time>
                </div>
              </div>

              <button class="post-menu" aria-label="Post options">
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1" fill="currentColor"/>
                </svg>
              </button>
            </header>

            <!-- Post Content -->
            <div class="post-content">
              {#if post.content.text}
                <p class="post-text">{post.content.text}</p>
              {/if}

              {#if post.media && post.media.length > 0}
                <div class="post-media" class:single={post.media.length === 1}>
                  {#each post.media.slice(0, 4) as media, i}
                    {#if media.type === 'image'}
                      <div class="media-item">
                        <img
                          src={media.url}
                          alt={media.altText || `Image ${i + 1}`}
                          loading="lazy"
                        />
                        {#if post.media.length > 4 && i === 3}
                          <div class="media-overlay">
                            +{post.media.length - 4}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Post Actions - Subtle and clean -->
            <footer class="post-actions">
              {#if post.metadata.likes !== undefined}
                <button class="action-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    />
                  </svg>
                  <span>{post.metadata.likes}</span>
                </button>
              {/if}

              {#if post.metadata.comments !== undefined}
                <button class="action-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    />
                  </svg>
                  <span>{post.metadata.comments}</span>
                </button>
              {/if}

              {#if post.metadata.shares !== undefined}
                <button class="action-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                    <circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                    <circle cx="18" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" stroke-width="2"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  <span>{post.metadata.shares}</span>
                </button>
              {/if}
            </footer>
          </article>
        {/each}

        {#if hasMore}
          <div class="load-more">
            <button class="load-more-btn" onclick={() => page++}>
              Load More
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  /* Container */
  .timeline-container {
    max-width: 680px;
    margin: 0 auto;
    padding: 0;
    min-height: 100vh;
    background: var(--background-primary);
  }

  /* Pull to Refresh */
  .pull-indicator {
    position: absolute;
    top: -50px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    transition: none;
  }

  .pull-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Header - Minimal and clean */
  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .timeline-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal);
  }

  .refresh-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
  }

  .refresh-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-icon {
    transition: transform 0.3s;
  }

  .refresh-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Composer Wrapper */
  .composer-wrapper {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  /* Timeline Content */
  .timeline-content {
    min-height: calc(100vh - 120px);
  }

  /* Skeleton Loader */
  .skeleton-container {
    padding: 1rem;
  }

  .skeleton-card {
    background: var(--background-secondary);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .skeleton-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .skeleton-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(90deg,
      var(--background-modifier-border) 25%,
      var(--background-modifier-hover) 50%,
      var(--background-modifier-border) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-meta {
    flex: 1;
  }

  .skeleton-line {
    height: 12px;
    background: linear-gradient(90deg,
      var(--background-modifier-border) 25%,
      var(--background-modifier-hover) 50%,
      var(--background-modifier-border) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .skeleton-line.short {
    width: 120px;
  }

  .skeleton-line.shorter {
    width: 80px;
  }

  .skeleton-line.medium {
    width: 70%;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* Error State */
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    min-height: 400px;
  }

  .error-icon,
  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .error-message,
  .empty-title {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--text-normal);
    margin: 0 0 0.5rem 0;
  }

  .empty-text {
    color: var(--text-muted);
    margin: 0 0 1.5rem 0;
  }

  .retry-btn {
    padding: 0.5rem 1.5rem;
    background: var(--interactive-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .retry-btn:hover {
    background: var(--interactive-accent-hover);
  }

  /* Post Cards - Clean, minimal design */
  .posts-container {
    padding: 0.5rem;
  }

  .post-card {
    background: var(--background-secondary);
    border-radius: 12px;
    margin-bottom: 0.75rem;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .post-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .post-card.new-post {
    animation: highlight 2s ease;
  }

  @keyframes highlight {
    0%, 100% { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    50% { box-shadow: 0 0 20px var(--interactive-accent); }
  }

  /* Post Header */
  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
  }

  .post-author {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .author-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--background-modifier-hover);
  }

  .author-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--interactive-accent);
    color: white;
    font-weight: 500;
    font-size: 14px;
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-size: 0.9375rem;
    font-weight: 500;
    margin: 0;
    color: var(--text-normal);
  }

  .post-time {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .post-menu {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .post-menu:hover {
    background: var(--background-modifier-hover);
  }

  /* Post Content */
  .post-content {
    padding: 0 1rem 1rem;
  }

  .post-text {
    margin: 0 0 0.75rem 0;
    color: var(--text-normal);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Post Media Grid */
  .post-media {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2px;
    border-radius: 8px;
    overflow: hidden;
    margin-top: 0.75rem;
  }

  .post-media.single {
    grid-template-columns: 1fr;
  }

  .media-item {
    position: relative;
    aspect-ratio: 1;
    background: var(--background-modifier-border);
  }

  .post-media.single .media-item {
    aspect-ratio: 16/9;
  }

  .media-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .media-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
    font-weight: 500;
  }

  /* Post Actions - Subtle */
  .post-actions {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    transition: background 0.2s, color 0.2s;
    font-size: 0.875rem;
  }

  .action-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* Load More */
  .load-more {
    display: flex;
    justify-content: center;
    padding: 2rem;
  }

  .load-more-btn {
    padding: 0.625rem 2rem;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .load-more-btn:hover {
    background: var(--background-modifier-border);
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .timeline-header {
      padding: 0.75rem;
    }

    .timeline-title {
      font-size: 1.125rem;
    }

    .posts-container {
      padding: 0.25rem;
    }

    .post-card {
      border-radius: 0;
      margin-bottom: 0.5rem;
    }

    .post-header,
    .post-content {
      padding: 0.75rem;
    }

    .post-actions {
      padding: 0.5rem 0.75rem;
    }

    /* Ensure minimum touch target */
    .refresh-btn,
    .post-menu,
    .action-btn {
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  /* Dark mode optimizations */
  @media (prefers-color-scheme: dark) {
    .post-card {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .post-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }
</style>