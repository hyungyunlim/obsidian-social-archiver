<script lang="ts">
  import type { PostData } from '../../types/post';
  import { PLATFORM_CONFIGS } from '../../types/platform';

  /**
   * Props
   */
  interface Props {
    post: PostData;
    editable?: boolean;
  }

  let { post, editable = false }: Props = $props();

  /**
   * Component state
   */
  let showAllMedia = $state(false);
  let editedContent = $state(post.content.text);

  /**
   * Platform config
   */
  const platformConfig = $derived(() => PLATFORM_CONFIGS[post.platform]);

  /**
   * Platform colors
   */
  const platformColors = {
    facebook: '#1877f2',
    linkedin: '#0077b5',
    instagram: '#E4405F',
    tiktok: '#000000',
    x: '#000000',
    threads: '#000000'
  };

  /**
   * Visible media (limit to 4 unless showAll is true)
   */
  const visibleMedia = $derived(() => {
    if (showAllMedia || post.media.length <= 4) {
      return post.media;
    }
    return post.media.slice(0, 4);
  });

  const remainingMediaCount = $derived(() => {
    return Math.max(0, post.media.length - 4);
  });

  /**
   * Format relative time
   */
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  /**
   * Format large numbers
   */
  function formatCount(count?: number): string {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  /**
   * Toggle show all media
   */
  function toggleShowAllMedia() {
    showAllMedia = !showAllMedia;
  }

  /**
   * Handle content edit
   */
  function handleContentChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    editedContent = textarea.value;
  }

  /**
   * Save edited content
   */
  function saveEdit() {
    post.content.text = editedContent;
  }
</script>

<div class="post-preview-container">
  <!-- Platform Header -->
  <div class="preview-header" style="border-left-color: {platformColors[post.platform]}">
    <div class="platform-badge">
      <span class="platform-name">{platformConfig()?.displayName}</span>
    </div>
    <div class="preview-label">Preview</div>
  </div>

  <!-- Author Info -->
  <div class="author-section">
    {#if post.author.avatar}
      <img
        src={post.author.avatar}
        alt={`${post.author.name}'s avatar`}
        class="author-avatar"
        loading="lazy"
      />
    {:else}
      <div class="author-avatar-placeholder" aria-label="User avatar">
        👤
      </div>
    {/if}

    <div class="author-info">
      <a
        href={post.author.url}
        target="_blank"
        rel="noopener noreferrer"
        class="author-name"
      >
        {post.author.name}
        {#if post.author.verified}
          <span class="verified-badge" title="Verified account">✓</span>
        {/if}
      </a>

      {#if post.author.username}
        <div class="author-username">@{post.author.username}</div>
      {/if}

      <div class="post-timestamp">
        {formatRelativeTime(post.metadata.timestamp)}
        {#if post.metadata.editedAt}
          <span class="edited-indicator">(edited)</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Post Content -->
  <div class="content-section">
    {#if editable}
      <textarea
        class="content-editor"
        value={editedContent}
        oninput={handleContentChange}
        onblur={saveEdit}
        rows={Math.max(3, editedContent.split('\n').length)}
      />
    {:else}
      <div class="content-text">
        {post.content.text}
      </div>
    {/if}
  </div>

  <!-- Media Gallery -->
  {#if post.media.length > 0}
    <div class="media-gallery" class:grid-layout={visibleMedia().length > 1}>
      {#each visibleMedia() as media, index}
        <div class="media-item">
          {#if media.type === 'image'}
            <img
              src={media.thumbnailUrl || media.url}
              alt={media.alt || `Image ${index + 1}`}
              class="media-image"
              loading="lazy"
            />
          {:else if media.type === 'video'}
            <div class="media-video">
              <video
                src={media.url}
                poster={media.thumbnailUrl}
                controls
                class="video-player"
              >
                <track kind="captions" />
              </video>
              {#if media.duration}
                <div class="video-duration">
                  {Math.floor(media.duration / 60)}:{String(Math.floor(media.duration % 60)).padStart(2, '0')}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}

      {#if remainingMediaCount() > 0 && !showAllMedia}
        <button
          type="button"
          class="show-more-media"
          onclick={toggleShowAllMedia}
        >
          <span class="show-more-count">+{remainingMediaCount()}</span>
          <span class="show-more-text">more</span>
        </button>
      {/if}
    </div>
  {/if}

  <!-- Engagement Metrics -->
  <div class="engagement-section">
    {#if post.metadata.likes !== undefined}
      <div class="engagement-item">
        <span class="engagement-icon">❤️</span>
        <span class="engagement-count">{formatCount(post.metadata.likes)}</span>
      </div>
    {/if}

    {#if post.metadata.comments !== undefined}
      <div class="engagement-item">
        <span class="engagement-icon">💬</span>
        <span class="engagement-count">{formatCount(post.metadata.comments)}</span>
      </div>
    {/if}

    {#if post.metadata.shares !== undefined}
      <div class="engagement-item">
        <span class="engagement-icon">🔄</span>
        <span class="engagement-count">{formatCount(post.metadata.shares)}</span>
      </div>
    {/if}

    {#if post.metadata.views !== undefined}
      <div class="engagement-item">
        <span class="engagement-icon">👁️</span>
        <span class="engagement-count">{formatCount(post.metadata.views)}</span>
      </div>
    {/if}
  </div>

  <!-- Location -->
  {#if post.metadata.location}
    <div class="location-tag">
      <span class="location-icon">📍</span>
      <span class="location-text">{post.metadata.location}</span>
    </div>
  {/if}

  <!-- AI Analysis Preview (if available) -->
  {#if post.ai}
    <div class="ai-preview">
      <div class="ai-header">
        <span class="ai-icon">🤖</span>
        <span class="ai-label">AI Analysis</span>
      </div>

      {#if post.ai.summary}
        <div class="ai-summary">
          <strong>Summary:</strong> {post.ai.summary}
        </div>
      {/if}

      {#if post.ai.sentiment}
        <div class="ai-sentiment">
          <strong>Sentiment:</strong>
          <span class="sentiment-badge sentiment-{post.ai.sentiment}">
            {post.ai.sentiment}
          </span>
        </div>
      {/if}

      {#if post.ai.topics.length > 0}
        <div class="ai-topics">
          <strong>Topics:</strong>
          {#each post.ai.topics.slice(0, 5) as topic}
            <span class="topic-tag">{topic}</span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .post-preview-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 10px;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Header */
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-left: 12px;
    border-left: 4px solid;
  }

  .platform-badge {
    padding: 4px 12px;
    background: var(--background-secondary);
    border-radius: 12px;
  }

  .platform-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-normal);
    text-transform: uppercase;
  }

  .preview-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  /* Author Section */
  .author-section {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .author-avatar,
  .author-avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }

  .author-avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary);
    font-size: 24px;
  }

  .author-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .author-name {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-normal);
    text-decoration: none;
  }

  .author-name:hover {
    text-decoration: underline;
  }

  .verified-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: #1d9bf0;
    color: white;
    border-radius: 50%;
    font-size: 12px;
    font-weight: bold;
  }

  .author-username {
    font-size: 13px;
    color: var(--text-muted);
  }

  .post-timestamp {
    font-size: 12px;
    color: var(--text-muted);
  }

  .edited-indicator {
    font-style: italic;
  }

  /* Content Section */
  .content-section {
    line-height: 1.6;
  }

  .content-text {
    font-size: 14px;
    color: var(--text-normal);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .content-editor {
    width: 100%;
    padding: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 14px;
    color: var(--text-normal);
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }

  .content-editor:focus {
    outline: 2px solid var(--interactive-accent);
  }

  /* Media Gallery */
  .media-gallery {
    display: grid;
    gap: 8px;
    border-radius: 12px;
    overflow: hidden;
  }

  .media-gallery.grid-layout {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .media-item {
    position: relative;
    aspect-ratio: 1;
    background: var(--background-secondary);
    border-radius: 8px;
    overflow: hidden;
  }

  .media-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .media-video {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .video-player {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-duration {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .show-more-media {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .show-more-media:hover {
    background: rgba(0, 0, 0, 0.85);
  }

  .show-more-count {
    font-size: 24px;
    font-weight: 700;
  }

  .show-more-text {
    font-size: 12px;
    font-weight: 600;
  }

  /* Engagement Section */
  .engagement-section {
    display: flex;
    gap: 16px;
    padding: 12px 0;
    border-top: 1px solid var(--background-modifier-border);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .engagement-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }

  .engagement-icon {
    font-size: 16px;
  }

  .engagement-count {
    font-weight: 600;
    color: var(--text-normal);
  }

  /* Location */
  .location-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .location-icon {
    font-size: 14px;
  }

  /* AI Preview */
  .ai-preview {
    padding: 12px;
    background: linear-gradient(135deg, #f0f4ff 0%, #e6ebff 100%);
    border: 1px solid #667eea;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ai-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #4c51bf;
  }

  .ai-icon {
    font-size: 16px;
  }

  .ai-summary,
  .ai-sentiment,
  .ai-topics {
    font-size: 13px;
    color: #4c51bf;
    line-height: 1.5;
  }

  .sentiment-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .sentiment-positive {
    background: #d1fae5;
    color: #065f46;
  }

  .sentiment-negative {
    background: #fee2e2;
    color: #991b1b;
  }

  .sentiment-neutral {
    background: #e5e7eb;
    color: #374151;
  }

  .sentiment-mixed {
    background: #fef3c7;
    color: #78350f;
  }

  .topic-tag {
    display: inline-block;
    margin: 4px 4px 0 0;
    padding: 4px 10px;
    background: white;
    border: 1px solid #c7d2fe;
    border-radius: 12px;
    font-size: 12px;
    color: #4c51bf;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .post-preview-container {
      padding: 14px;
      gap: 14px;
    }

    .author-avatar,
    .author-avatar-placeholder {
      width: 40px;
      height: 40px;
    }

    .media-gallery.grid-layout {
      grid-template-columns: repeat(2, 1fr);
    }

    .engagement-section {
      gap: 12px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .post-preview-container {
      animation: none !important;
    }
  }
</style>
