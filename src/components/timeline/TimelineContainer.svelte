<script lang="ts">
  import { onMount } from 'svelte';
  import type { TFile, Vault, App, CachedMetadata } from 'obsidian';
  import type { PostData } from '../../types/post';
  import type { YamlFrontmatter } from '../../types/archive';

  // Props
  interface Props {
    vault: Vault;
    app: App;
    archivePath: string;
  }

  let { vault, app, archivePath }: Props = $props();

  // Reactive state using Svelte 5 runes
  let posts = $state<PostData[]>([]);
  let filteredPosts = $state<PostData[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedPlatforms = $state<Set<string>>(new Set());

  // Derived state
  let groupedPosts = $derived(() => {
    return groupPostsByDate(filteredPosts);
  });

  /**
   * Load all archived posts from vault
   */
  async function loadPosts(): Promise<void> {
    try {
      isLoading = true;
      error = null;

      const allFiles = vault.getMarkdownFiles();
      const archiveFiles = allFiles.filter(file =>
        file.path.startsWith(archivePath)
      );

      console.log(`[Timeline] Found ${archiveFiles.length} files in ${archivePath}`);

      const loadedPosts: PostData[] = [];

      for (const file of archiveFiles) {
        try {
          const postData = await loadPostFromFile(file);
          if (postData) {
            loadedPosts.push(postData);
          }
        } catch (err) {
          console.warn(`[Timeline] Failed to load ${file.path}:`, err);
        }
      }

      // Sort by timestamp (newest first)
      loadedPosts.sort((a, b) =>
        new Date(b.metadata.timestamp).getTime() -
        new Date(a.metadata.timestamp).getTime()
      );

      posts = loadedPosts;
      filteredPosts = loadedPosts;

      console.log(`[Timeline] Loaded ${posts.length} posts`);

    } catch (err) {
      console.error('[Timeline] Failed to load posts:', err);
      error = err instanceof Error ? err.message : 'Failed to load posts';
    } finally {
      isLoading = false;
    }
  }

  /**
   * Load PostData from a file by parsing frontmatter using Obsidian's MetadataCache
   */
  async function loadPostFromFile(file: TFile): Promise<PostData | null> {
    try {
      // Use Obsidian's MetadataCache API
      const cache = app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter as YamlFrontmatter | undefined;

      if (!frontmatter || !frontmatter.platform) {
        return null;
      }

      // Read file content to extract post text
      const content = await vault.read(file);
      const contentText = extractContentText(content);

      // Reconstruct PostData from frontmatter
      const postData: PostData = {
        platform: frontmatter.platform as any,
        id: file.basename,
        url: frontmatter.originalUrl || '',
        author: {
          name: frontmatter.author || 'Unknown',
          url: frontmatter.authorUrl || '',
        },
        content: {
          text: contentText,
        },
        media: [],
        metadata: {
          timestamp: new Date(frontmatter.archived || file.stat.ctime),
          likes: (frontmatter as any).likes,
          comments: (frontmatter as any).comments,
          shares: (frontmatter as any).shares,
          views: (frontmatter as any).views,
        },
      };

      return postData;
    } catch (err) {
      console.warn(`[Timeline] Failed to load ${file.path}:`, err);
      return null;
    }
  }

  /**
   * Extract main content text from markdown (skip frontmatter and metadata)
   */
  function extractContentText(markdown: string): string {
    // Remove frontmatter
    const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Find the first paragraph (skip headers)
    const lines = withoutFrontmatter.split('\n');
    const contentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines, headers, and horizontal rules at the start
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('**Platform:**')) {
        if (contentLines.length > 0) break; // Stop if we've already collected content
        continue;
      }

      contentLines.push(line);

      // Collect only first paragraph (stop at first empty line after content)
      if (contentLines.length > 0 && !trimmed) {
        break;
      }
    }

    return contentLines.join('\n').trim();
  }

  /**
   * Group posts by date (Today, Yesterday, This Week, etc.)
   */
  function groupPostsByDate(posts: PostData[]): Map<string, PostData[]> {
    const grouped = new Map<string, PostData[]>();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    for (const post of posts) {
      const postDate = new Date(post.metadata.timestamp);
      const postDay = new Date(
        postDate.getFullYear(),
        postDate.getMonth(),
        postDate.getDate()
      );

      let groupLabel: string;

      if (postDay.getTime() === today.getTime()) {
        groupLabel = 'Today';
      } else if (postDay.getTime() === yesterday.getTime()) {
        groupLabel = 'Yesterday';
      } else if (postDate >= thisWeek) {
        groupLabel = 'This Week';
      } else {
        // Format as "Month Year"
        groupLabel = postDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }

      if (!grouped.has(groupLabel)) {
        grouped.set(groupLabel, []);
      }
      grouped.get(groupLabel)!.push(post);
    }

    return grouped;
  }

  /**
   * Filter posts based on search query and selected platforms
   */
  function filterPosts(): void {
    let result = posts;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(post =>
        post.content.text.toLowerCase().includes(query) ||
        post.author.name.toLowerCase().includes(query)
      );
    }

    // Platform filter
    if (selectedPlatforms.size > 0) {
      result = result.filter(post =>
        selectedPlatforms.has(post.platform)
      );
    }

    filteredPosts = result;
  }

  // Load posts on mount
  onMount(() => {
    loadPosts();
  });

  // Watch for search/filter changes
  $effect(() => {
    filterPosts();
  });
</script>

<div class="timeline-container">
  <!-- Loading State -->
  {#if isLoading}
    <div class="timeline-loading">
      <div class="timeline-loading-spinner"></div>
      <p>Loading archived posts...</p>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="timeline-error">
      <p class="timeline-error-icon">⚠️</p>
      <p class="timeline-error-message">{error}</p>
      <button class="timeline-error-retry" onclick={() => loadPosts()}>
        Retry
      </button>
    </div>
  {:else if posts.length === 0}
    <!-- Empty State -->
    <div class="timeline-empty">
      <p class="timeline-empty-icon">📭</p>
      <h3>No archived posts yet</h3>
      <p>Archive your first social media post to see it here!</p>
    </div>
  {:else}
    <!-- Search and Filter Bar -->
    <div class="timeline-filters">
      <input
        type="text"
        class="timeline-search"
        placeholder="Search posts..."
        bind:value={searchQuery}
      />
    </div>

    <!-- Posts Grid -->
    <div class="timeline-grid">
      {#each Array.from(groupedPosts()) as [groupLabel, groupPosts]}
        <div class="timeline-group">
          <h3 class="timeline-group-header">{groupLabel}</h3>
          <div class="timeline-group-posts">
            {#each groupPosts as post}
              <div class="timeline-post-card">
                <!-- Platform Badge -->
                <div class="timeline-post-platform" data-platform={post.platform}>
                  {post.platform}
                </div>

                <!-- Author -->
                <div class="timeline-post-author">
                  <strong>{post.author.name}</strong>
                </div>

                <!-- Content Preview -->
                <div class="timeline-post-content">
                  {post.content.text.substring(0, 200)}
                  {#if post.content.text.length > 200}...{/if}
                </div>

                <!-- Metadata -->
                <div class="timeline-post-meta">
                  <span>{new Date(post.metadata.timestamp).toLocaleDateString()}</span>
                  {#if post.metadata.likes}
                    <span>❤️ {post.metadata.likes}</span>
                  {/if}
                  {#if post.metadata.comments}
                    <span>💬 {post.metadata.comments}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 1rem;
  }

  .timeline-loading,
  .timeline-error,
  .timeline-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    text-align: center;
    color: var(--text-muted);
  }

  .timeline-loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .timeline-error-icon,
  .timeline-empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .timeline-error-retry {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .timeline-filters {
    margin-bottom: 1.5rem;
  }

  .timeline-search {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .timeline-grid {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .timeline-group-header {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text-normal);
    border-bottom: 2px solid var(--background-modifier-border);
    padding-bottom: 0.5rem;
  }

  .timeline-group-posts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .timeline-post-card {
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .timeline-post-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .timeline-post-platform {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .timeline-post-platform[data-platform="facebook"] {
    background: #1877f2;
    color: white;
  }

  .timeline-post-platform[data-platform="linkedin"] {
    background: #0077b5;
    color: white;
  }

  .timeline-post-platform[data-platform="instagram"] {
    background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
    color: white;
  }

  .timeline-post-platform[data-platform="tiktok"] {
    background: #000000;
    color: white;
  }

  .timeline-post-platform[data-platform="x"] {
    background: #000000;
    color: white;
  }

  .timeline-post-platform[data-platform="threads"] {
    background: #000000;
    color: white;
  }

  .timeline-post-platform[data-platform="youtube"] {
    background: #ff0000;
    color: white;
  }

  .timeline-post-author {
    margin-bottom: 0.5rem;
    color: var(--text-normal);
  }

  .timeline-post-content {
    margin-bottom: 0.75rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .timeline-post-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .timeline-group-posts {
      grid-template-columns: 1fr;
    }
  }
</style>
