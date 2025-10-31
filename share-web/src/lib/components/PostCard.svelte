<script lang="ts">
	import type { Post } from '$lib/types';
	import PlatformIcon from './PlatformIcon.svelte';
	import { marked } from 'marked';

	interface Props {
		post: Post;
		showShareButton?: boolean;
		username?: string;
		onCardClick?: (post: Post) => void;
	}

	let { post, showShareButton = true, username, onCardClick }: Props = $props();

	// Svelte 5 Runes
	let expanded = $state(false);
	let commentsExpanded = $state(false);
	let currentImageIndex = $state(0);

	// Configure marked for safe HTML rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	// Remove image markdown from text (images will be shown separately below)
	function removeImageMarkdown(text: string): string {
		return text.replace(/!\[.*?\]\(.*?\)/g, '').trim();
	}

	// Get clean content without image markdown
	const cleanContent = $derived(removeImageMarkdown(post.content.text || ''));

	// Content truncation logic (500 chars like timeline)
	const previewLength = 500;
	const needsTruncation = $derived(cleanContent.length > previewLength);

	// Smart preview truncation - don't cut markdown links in half
	const truncatedContent = $derived(() => {
		if (!needsTruncation) return cleanContent;

		let preview = cleanContent.substring(0, previewLength);

		// Check if we cut off in the middle of a markdown link
		const lastOpenBracket = preview.lastIndexOf('[');
		const lastCloseBracket = preview.lastIndexOf(']');

		// If there's an unclosed link at the end, truncate before it
		if (lastOpenBracket > lastCloseBracket) {
			preview = cleanContent.substring(0, lastOpenBracket);
		}

		return preview + '...';
	});

	// Parse markdown content
	const displayContent = $derived(
		marked.parse(expanded ? cleanContent : truncatedContent()) as string
	);

	// Get image media only
	const images = $derived(post.media.filter(m => m.type === 'image'));
	const hasMultipleImages = $derived(images.length > 1);

	// Comments logic
	const maxVisibleComments = 2;
	const hasMoreComments = $derived(post.comments && post.comments.length > maxVisibleComments);
	const visibleComments = $derived(() => {
		if (!post.comments) return [];
		if (commentsExpanded || !hasMoreComments) return post.comments;
		return post.comments.slice(-maxVisibleComments);
	});

	// Carousel navigation
	function nextImage() {
		currentImageIndex = (currentImageIndex + 1) % images.length;
	}

	function prevImage() {
		currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
	}

	// Format relative time
	function getRelativeTime(timestamp: string): string {
		if (!timestamp) return '';

		const now = new Date();
		const date = new Date(timestamp);

		// Check if date is valid
		if (isNaN(date.getTime())) return '';

		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHour / 24);

		if (diffSec < 60) return 'Just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHour < 24) return `${diffHour}h ago`;
		if (diffDay === 1) return 'Yesterday';
		if (diffDay < 7) return `${diffDay}d ago`;

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
		});
	}

	// Format numbers with K/M suffix
	function formatNumber(num: number | undefined): string {
		if (!num) return '0';
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
		}
		if (num >= 1000) {
			return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
		}
		return num.toString();
	}

	// Handle share button click
	async function handleShare(e: MouseEvent) {
		e.stopPropagation();
		if (post.shareUrl) {
			await navigator.clipboard.writeText(post.shareUrl);
		}
	}

	// Handle card click
	function handleCardClick(e: MouseEvent) {
		// Ignore clicks on interactive elements
		const target = e.target as HTMLElement;
		if (
			target.closest('a') ||
			target.closest('button') ||
			target.tagName === 'A' ||
			target.tagName === 'BUTTON'
		) {
			return;
		}

		// Call parent handler if provided
		if (onCardClick) {
			onCardClick(post);
		}
	}
</script>

<article
	class="post-card"
	role="article"
	aria-label={`Post by ${post.author.name} on ${post.platform}`}
	onclick={handleCardClick}
	class:clickable={onCardClick !== undefined}
>
	<!-- Nested Card Header (like timeline) -->
	{#if username}
		<div class="nested-header">
			<div class="nested-indicator"></div>
			<span class="nested-text">
				<strong>{username}</strong> saved this post
			</span>
		</div>
	{/if}

	<!-- Platform Icon (top right) -->
	<div class="platform-icon">
		<a
			href={post.url}
			target="_blank"
			rel="noopener noreferrer"
			title="Open on {post.platform}"
			aria-label={`View original post on ${post.platform}`}
		>
			<PlatformIcon platform={post.platform} size={20} />
		</a>
	</div>

	<!-- Content Area -->
	<div class="content-area">
		<!-- Header: Author + Time -->
		<header class="post-header">
			<a
				href={post.author.url}
				target="_blank"
				rel="noopener noreferrer"
				class="author-link"
				aria-label={`View ${post.author.name}'s profile`}
			>
				<strong class="author-name">{post.author.name}</strong>
			</a>
			<time class="timestamp" datetime={post.metadata.timestamp}>
				{getRelativeTime(post.metadata.timestamp)}
			</time>
		</header>

		<!-- Content Text -->
		<div class="post-content">
			<div class="content-text markdown-content">
				{@html displayContent}
			</div>
			{#if needsTruncation}
				<button
					class="see-more-btn"
					type="button"
					onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
				>
					{expanded ? 'See less' : 'See more'}
				</button>
			{/if}
		</div>

		<!-- Image Carousel (if images exist) -->
		{#if images.length > 0}
			<div class="media-carousel">
				<!-- Main image display -->
				<div class="media-container">
					<img
						src={images[currentImageIndex].url}
						alt={images[currentImageIndex].altText || `Image ${currentImageIndex + 1}`}
						class="main-image"
						loading="lazy"
					/>

					<!-- Navigation arrows (only if multiple images) -->
					{#if hasMultipleImages}
						<button
							class="carousel-btn carousel-btn-prev"
							type="button"
							onclick={(e) => { e.stopPropagation(); prevImage(); }}
							aria-label="Previous image"
						>
							<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M15 18l-6-6 6-6" />
							</svg>
						</button>
						<button
							class="carousel-btn carousel-btn-next"
							type="button"
							onclick={(e) => { e.stopPropagation(); nextImage(); }}
							aria-label="Next image"
						>
							<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M9 18l6-6-6-6" />
							</svg>
						</button>

						<!-- Image counter -->
						<div class="image-counter">
							{currentImageIndex + 1} / {images.length}
						</div>
					{/if}
				</div>

				<!-- Thumbnails (only if multiple images) -->
				{#if hasMultipleImages}
					<div class="thumbnails-container">
						{#each images as image, i}
							<button
								class="thumbnail"
								class:active={i === currentImageIndex}
								type="button"
								onclick={(e) => { e.stopPropagation(); currentImageIndex = i; }}
								aria-label={`View image ${i + 1}`}
							>
								<img
									src={image.thumbnail || image.url}
									alt={image.altText || `Thumbnail ${i + 1}`}
									loading="lazy"
								/>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Interactions Bar -->
		<footer class="interactions">
			{#if post.metadata.likes !== undefined && post.metadata.likes > 0}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
					</svg>
					{formatNumber(post.metadata.likes)}
				</span>
			{/if}

			{#if post.metadata.comments !== undefined && post.metadata.comments > 0}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					{formatNumber(post.metadata.comments)}
				</span>
			{/if}

			{#if post.metadata.shares !== undefined && post.metadata.shares > 0}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
					</svg>
					{formatNumber(post.metadata.shares)}
				</span>
			{/if}

			{#if post.metadata.views !== undefined && post.metadata.views > 0}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
					{formatNumber(post.metadata.views)}
				</span>
			{/if}

			<div class="spacer"></div>

			{#if showShareButton && post.shareUrl}
				<button
					type="button"
					class="share-button"
					title="Copy share link"
					onclick={handleShare}
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="18" cy="5" r="3" />
						<circle cx="6" cy="12" r="3" />
						<circle cx="18" cy="19" r="3" />
						<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
						<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
					</svg>
				</button>
			{/if}
		</footer>

		<!-- Comments Section -->
		{#if post.comments && post.comments.length > 0}
			<div class="comments-section">
				<!-- "View all X comments" button (if more than 2 comments) -->
				{#if hasMoreComments}
					<button
						class="view-all-comments-btn"
						type="button"
						onclick={(e) => { e.stopPropagation(); commentsExpanded = !commentsExpanded; }}
					>
						{commentsExpanded ? 'Hide comments' : `View all ${post.comments.length} comments`}
					</button>
				{/if}

				<!-- Comments list -->
				<div class="comments-list">
					{#each visibleComments() as comment (comment.id)}
						<div class="comment">
							<div class="comment-content">
								<a
									href={comment.author.url}
									target="_blank"
									rel="noopener noreferrer"
									class="comment-author"
								>
									{comment.author.name}
								</a>
								<span class="comment-text">{comment.content}</span>
								{#if comment.timestamp}
									<span class="comment-time">{getRelativeTime(comment.timestamp)}</span>
								{/if}
								{#if comment.likes && comment.likes > 0}
									<span class="comment-likes">
										{comment.likes} {comment.likes === 1 ? 'like' : 'likes'}
									</span>
								{/if}
							</div>

							<!-- Render replies -->
							{#if comment.replies && comment.replies.length > 0}
								<div class="comment-replies">
									{#each comment.replies as reply (reply.id)}
										<div class="comment reply">
											<div class="comment-content">
												<a
													href={reply.author.url}
													target="_blank"
													rel="noopener noreferrer"
													class="comment-author"
												>
													{reply.author.name}
												</a>
												<span class="comment-text">{reply.content}</span>
												{#if reply.timestamp}
													<span class="comment-time">{getRelativeTime(reply.timestamp)}</span>
												{/if}
												{#if reply.likes && reply.likes > 0}
													<span class="comment-likes">
														{reply.likes} {reply.likes === 1 ? 'like' : 'likes'}
													</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</article>

<style>
	/* Card Container - No border, only subtle dividers */
	.post-card {
		position: relative;
		padding: 1.5rem 1.5rem;
		background-color: var(--background-primary);
		transition: background-color 0.2s ease;
		border-top: 1px solid var(--background-modifier-border);
		border-bottom: 1px solid var(--background-modifier-border);
		margin: -1px 0; /* Overlap borders to prevent double lines */
	}

	.post-card.clickable {
		cursor: pointer;
	}

	/* Subtle hover effect */
	.post-card:hover {
		background-color: var(--background-modifier-hover);
	}

	/* Nested card header (like timeline) */
	.nested-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.nested-indicator {
		width: 3px;
		height: 1.5rem;
		background: linear-gradient(
			to bottom,
			var(--interactive-accent),
			transparent
		);
		border-radius: 2px;
	}

	.nested-text {
		font-size: 0.813rem;
		color: var(--text-muted);
	}

	.nested-text strong {
		color: var(--text-normal);
		font-weight: 600;
	}

	/* Platform Icon */
	.platform-icon {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.2;
		transition: opacity 0.2s;
		z-index: 10;
	}

	.platform-icon:hover {
		opacity: 0.5;
	}

	.platform-icon a {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--interactive-accent);
	}

	/* Header */
	.post-header {
		margin-bottom: 0.75rem;
	}

	.author-link {
		text-decoration: none;
		color: inherit;
		transition: color 0.2s;
	}

	.author-link:hover {
		color: var(--interactive-accent);
	}

	.author-name {
		color: var(--text-normal);
		display: block;
		margin-bottom: 0.25rem;
		font-size: 1rem;
		font-weight: 600;
		max-width: calc(100% - 3rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.timestamp {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* Content */
	.post-content {
		margin-bottom: 0.75rem;
	}

	.content-text {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-normal);
		word-break: break-word;
		margin: 0;
	}

	.see-more-btn {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.5rem;
		display: inline-block;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.2s;
		font-family: inherit;
	}

	.see-more-btn:hover {
		color: var(--interactive-accent);
	}

	/* Markdown Content Styling */
	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3),
	.markdown-content :global(h4),
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		margin-top: 1em;
		margin-bottom: 0.5em;
		font-weight: 600;
		line-height: 1.25;
	}

	.markdown-content :global(h1) { font-size: 1.5rem; }
	.markdown-content :global(h2) { font-size: 1.25rem; }
	.markdown-content :global(h3) { font-size: 1.1rem; }
	.markdown-content :global(h4) { font-size: 1rem; }

	.markdown-content :global(p) {
		margin: 0.75em 0;
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: 0.75em 0;
		padding-left: 1.5em;
	}

	.markdown-content :global(li) {
		margin: 0.25em 0;
	}

	.markdown-content :global(blockquote) {
		margin: 1em 0;
		padding: 0.5em 1em;
		border-left: 3px solid var(--interactive-accent);
		background-color: var(--background-secondary);
		color: var(--text-muted);
	}

	.markdown-content :global(code) {
		padding: 0.125em 0.25em;
		border-radius: 0.25rem;
		background-color: var(--background-modifier-border);
		font-size: 0.875em;
		font-family: 'Courier New', monospace;
	}

	.markdown-content :global(pre) {
		margin: 1em 0;
		padding: 1em;
		border-radius: 0.5rem;
		background-color: var(--background-secondary);
		overflow-x: auto;
	}

	.markdown-content :global(pre code) {
		padding: 0;
		background-color: transparent;
	}

	.markdown-content :global(a) {
		color: var(--interactive-accent);
		text-decoration: none;
	}

	.markdown-content :global(a:hover) {
		text-decoration: underline;
	}

	/* Media Carousel */
	.media-carousel {
		margin: 0.75rem 0;
		border-radius: 0.5rem;
		overflow: hidden;
		background-color: var(--background-modifier-border);
	}

	.media-container {
		position: relative;
		width: 100%;
		max-height: 600px;
		min-height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #000;
	}

	.main-image {
		max-width: 100%;
		max-height: 600px;
		width: auto;
		height: auto;
		display: block;
	}

	.carousel-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
		z-index: 10;
	}

	.carousel-btn:hover {
		background: rgba(0, 0, 0, 0.7);
	}

	.carousel-btn-prev {
		left: 12px;
	}

	.carousel-btn-next {
		right: 12px;
	}

	.image-counter {
		position: absolute;
		bottom: 12px;
		right: 12px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		z-index: 10;
	}

	.thumbnails-container {
		display: flex;
		gap: 8px;
		padding: 12px;
		overflow-x: auto;
		background: rgba(0, 0, 0, 0.02);
		scrollbar-width: thin;
		scrollbar-color: var(--background-modifier-border) transparent;
	}

	.thumbnails-container::-webkit-scrollbar {
		height: 6px;
	}

	.thumbnails-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.thumbnails-container::-webkit-scrollbar-thumb {
		background: var(--background-modifier-border);
		border-radius: 3px;
	}

	.thumbnail {
		width: 60px;
		height: 60px;
		flex-shrink: 0;
		border-radius: 4px;
		overflow: hidden;
		cursor: pointer;
		border: 2px solid transparent;
		transition: all 0.2s;
		background: none;
		padding: 0;
	}

	.thumbnail:hover {
		border-color: var(--interactive-accent);
	}

	.thumbnail.active {
		border-color: var(--interactive-accent);
		opacity: 1;
	}

	.thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* Interactions */
	.interactions {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding-top: 0.75rem;
		margin-top: 0.75rem;
		border-top: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		flex-wrap: wrap;
		font-size: 0.813rem;
	}

	.interaction-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: default;
		transition: color 0.2s;
	}

	.interaction-item:hover {
		color: var(--interactive-accent);
	}

	.spacer {
		flex: 1;
	}

	.share-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s;
	}

	.share-button:hover {
		color: var(--interactive-accent);
	}

	/* Comments Section */
	.comments-section {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--background-modifier-border);
	}

	.view-all-comments-btn {
		font-size: 0.813rem;
		color: var(--text-muted);
		cursor: pointer;
		margin-bottom: 8px;
		transition: color 0.2s;
		background: transparent;
		border: none;
		padding: 0;
		font-family: inherit;
	}

	.view-all-comments-btn:hover {
		color: var(--text-normal);
	}

	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.comment {
		font-size: 0.813rem;
		line-height: 1.4;
	}

	.comment.reply {
		margin-left: 24px;
	}

	.comment-content {
		display: block;
	}

	.comment-author {
		font-weight: 600;
		color: var(--text-normal);
		text-decoration: none;
		cursor: pointer;
	}

	.comment-author:hover {
		text-decoration: underline;
	}

	.comment-text {
		color: var(--text-normal);
		margin-left: 4px;
	}

	.comment-time {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-left: 8px;
	}

	.comment-likes {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.comment-replies {
		margin-top: 8px;
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.post-card {
			padding: 1.25rem 1.25rem;
		}

		.platform-icon {
			right: 1.25rem;
		}

		.carousel-btn {
			width: 32px;
			height: 32px;
		}

		.carousel-btn-prev {
			left: 8px;
		}

		.carousel-btn-next {
			right: 8px;
		}

		.interactions {
			gap: 1rem;
		}
	}
</style>
