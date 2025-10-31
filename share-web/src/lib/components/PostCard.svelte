<script lang="ts">
	import type { Post, LinkPreview } from '$lib/types';
	import PlatformIcon from './PlatformIcon.svelte';
	import LinkPreviewCard from './LinkPreviewCard.svelte';
	import SkeletonCard from './SkeletonCard.svelte';
	import { fetchLinkPreviewsMetadata } from '$lib/api/client';
	import { marked } from 'marked';

	interface Props {
		post: Post;
		showShareButton?: boolean;
		username?: string;
		onCardClick?: (post: Post) => void;
	}

	let { post, showShareButton = true, username, onCardClick }: Props = $props();

	// Link preview state
	let linkPreviewsMetadata = $state<LinkPreview[]>([]);
	let loadingPreviews = $state(false);
	let previewError = $state(false);

	// Debug logging to check if comment is received
	$effect(() => {
		console.log('[PostCard] Received post data:', {
			username,
			comment: post.comment,
			like: post.like,
			archive: post.archive,
			comments: post.comments,
			firstCommentAuthorUrl: post.comments?.[0]?.author?.url,
			linkPreviews: post.linkPreviews,
			linkPreviewsType: typeof post.linkPreviews,
			linkPreviewsLength: post.linkPreviews?.length,
			linkPreviewsIsArray: Array.isArray(post.linkPreviews)
		});
	});

	// Get archive time (when user originally archived this post)
	const archiveTime = $derived(
		!post.archivedDate ? '' : getRelativeTime(
			post.archivedDate instanceof Date
				? post.archivedDate.toISOString()
				: post.archivedDate
		)
	);

	// Svelte 5 Runes
	let expanded = $state(false);
	let commentsExpanded = $state(false);
	let currentImageIndex = $state(0);

	// Configure marked for safe HTML rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	// Extract image URLs from markdown syntax: ![alt](url)
	function extractMarkdownImageUrls(text: string): string[] {
		const urls: string[] = [];
		const markdownImagePattern = /!\[.*?\]\((.*?)\)/g;
		let match;

		while ((match = markdownImagePattern.exec(text)) !== null) {
			if (match[1]) {
				urls.push(match[1]);
			}
		}

		return urls;
	}

	// Replace markdown images with plain links: ![alt](url) -> [url](url)
	function replaceMarkdownImagesWithLinks(text: string): string {
		return text.replace(/!\[.*?\]\((.*?)\)/g, '[$1]($1)');
	}

	// Process hashtags in text - convert to clickable links
	function processHashtags(text: string, platform: string): string {
		const hashtagPattern = /(#[\w\u0080-\uFFFF]+)/g;

		// Get platform-specific hashtag URL
		const getHashtagUrl = (hashtag: string): string => {
			const tag = hashtag.replace('#', '');
			const urlMap: Record<string, string> = {
				instagram: `https://www.instagram.com/explore/tags/${tag}/`,
				x: `https://twitter.com/hashtag/${tag}`,
				twitter: `https://twitter.com/hashtag/${tag}`,
				facebook: `https://www.facebook.com/hashtag/${tag}`,
				linkedin: `https://www.linkedin.com/feed/hashtag/${tag}/`,
				tiktok: `https://www.tiktok.com/tag/${tag}`,
				threads: `https://www.threads.net/tag/${tag}`,
				youtube: `https://www.youtube.com/hashtag/${tag}`,
				reddit: `https://www.reddit.com/search/?q=${encodeURIComponent(hashtag)}`
			};
			return urlMap[platform.toLowerCase()] || `https://www.google.com/search?q=${encodeURIComponent(hashtag)}`;
		};

		return text.replace(hashtagPattern, (match) => {
			const url = getHashtagUrl(match);
			// Return markdown link with hashtag class for styling
			return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="hashtag-link" onclick="event.stopPropagation()">${match}</a>`;
		});
	}

	// Replace image markdown with links (keep URLs visible in text)
	const cleanContent = $derived(replaceMarkdownImagesWithLinks(post.content.text || ''));

	// Process hashtags in content
	const contentWithHashtags = $derived(processHashtags(cleanContent, post.platform));

	// Content truncation logic (500 chars like timeline)
	const previewLength = 500;
	const needsTruncation = $derived(cleanContent.length > previewLength);

	// Smart preview truncation - don't cut markdown links in half
	const truncatedContent = $derived.by(() => {
		if (!needsTruncation) return contentWithHashtags;

		let preview = cleanContent.substring(0, previewLength);

		// Check if we cut off in the middle of a markdown link
		const lastOpenBracket = preview.lastIndexOf('[');
		const lastCloseBracket = preview.lastIndexOf(']');

		// If there's an unclosed link at the end, truncate before it
		if (lastOpenBracket > lastCloseBracket) {
			preview = cleanContent.substring(0, lastOpenBracket);
		}

		// Process hashtags after truncation
		return processHashtags(preview + '...', post.platform);
	});

	// Parse markdown content
	const displayContent = $derived(
		marked.parse(expanded ? contentWithHashtags : truncatedContent) as string
	);

	// Extract images from markdown in content
	const extractedImageUrls = $derived(extractMarkdownImageUrls(post.content.text || ''));

	// Merge post.media images with extracted markdown images
	const images = $derived.by(() => {
		const mediaImages = post.media.filter(m => m.type === 'image');

		// Add extracted markdown images as media objects
		const markdownImages = extractedImageUrls.map(url => ({
			type: 'image' as const,
			url: url,
			altText: 'Image from post content'
		}));

		return [...mediaImages, ...markdownImages];
	});

	// Track failed image loads
	let failedImages = $state<Set<string>>(new Set());

	function handleImageError(url: string) {
		failedImages = new Set([...failedImages, url]);
	}

	// Filter out failed images
	const visibleImages = $derived(images.filter(img => !failedImages.has(img.url)));

	// Fetch link preview metadata when post has linkPreviews and no visible images
	$effect(() => {
		console.log('[PostCard] Link preview fetch check:', {
			hasLinkPreviews: !!post.linkPreviews,
			linkPreviewsLength: post.linkPreviews?.length,
			visibleImagesLength: visibleImages.length,
			loadingPreviews,
			previewError,
			alreadyFetched: linkPreviewsMetadata.length > 0
		});

		// Only fetch if:
		// 1. Post has linkPreviews URLs
		// 2. No visible images (to avoid cluttering the card)
		// 3. Not already loading, errored, or already fetched
		if (
			post.linkPreviews &&
			post.linkPreviews.length > 0 &&
			visibleImages.length === 0 &&
			!loadingPreviews &&
			!previewError &&
			linkPreviewsMetadata.length === 0
		) {
			console.log('[PostCard] Starting link preview fetch for URLs:', post.linkPreviews);
			loadingPreviews = true;
			previewError = false;

			const urls = post.linkPreviews;

			// Set timeout for metadata fetching (10 seconds)
			const timeoutId = setTimeout(() => {
				if (loadingPreviews) {
					console.warn('[PostCard] Link preview metadata fetch timeout');
					loadingPreviews = false;
					previewError = true;
				}
			}, 10000);

			fetchLinkPreviewsMetadata(urls)
				.then(metadata => {
					clearTimeout(timeoutId);
					console.log('[PostCard] Link preview metadata fetched:', metadata);
					linkPreviewsMetadata = metadata;
					loadingPreviews = false;

					if (metadata.length === 0) {
						console.warn('[PostCard] No link preview metadata fetched');
					}
				})
				.catch(error => {
					clearTimeout(timeoutId);
					console.error('[PostCard] Failed to fetch link previews:', error);
					previewError = true;
					loadingPreviews = false;
				});

			// Cleanup function to clear timeout on component unmount
			return () => clearTimeout(timeoutId);
		}
	});

	// Determine if we should show link previews
	const shouldShowLinkPreviews = $derived(
		visibleImages.length === 0 &&
		linkPreviewsMetadata.length > 0 &&
		!loadingPreviews &&
		!previewError
	);

	// Comments logic
	const maxVisibleComments = 2;
	const hasMoreComments = $derived(post.comments && post.comments.length > maxVisibleComments);
	const visibleComments = $derived.by(() => {
		if (!post.comments) return [];
		if (commentsExpanded || !hasMoreComments) return post.comments;
		return post.comments.slice(-maxVisibleComments);
	});

	// Carousel navigation
	function nextImage() {
		currentImageIndex = (currentImageIndex + 1) % visibleImages.length;
	}

	function prevImage() {
		currentImageIndex = (currentImageIndex - 1 + visibleImages.length) % visibleImages.length;
	}

	// Reset current index if it exceeds visible images length
	$effect(() => {
		if (currentImageIndex >= visibleImages.length && visibleImages.length > 0) {
			currentImageIndex = 0;
		}
	});

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
	function handleCardClick(e: MouseEvent | KeyboardEvent) {
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

	// Handle keyboard navigation (Enter or Space)
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleCardClick(e);
		}
	}
</script>

{#snippet cardContent()}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="card-content"
		class:clickable={onCardClick !== undefined}
		role={onCardClick !== undefined ? 'button' : undefined}
		tabindex={onCardClick !== undefined ? 0 : -1}
		onclick={onCardClick !== undefined ? handleCardClick : undefined}
		onkeydown={onCardClick !== undefined ? handleKeyDown : undefined}
	>

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
				onclick={(e) => e.stopPropagation()}
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
		{#if visibleImages.length > 0}
			<div class="media-carousel">
				<!-- Main image display -->
				<div class="media-container">
					<img
						src={visibleImages[currentImageIndex].url}
						alt={visibleImages[currentImageIndex].altText || `Image ${currentImageIndex + 1}`}
						class="main-image"
						loading="lazy"
						onerror={() => {
							handleImageError(visibleImages[currentImageIndex].url);
						}}
					/>

					<!-- Navigation arrows (only if multiple images) -->
					{#if visibleImages.length > 1}
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
							{currentImageIndex + 1} / {visibleImages.length}
						</div>
					{/if}
				</div>

				<!-- Thumbnails (only if multiple images) -->
				{#if visibleImages.length > 1}
					<div class="thumbnails-container">
						{#each visibleImages as image, i}
							<button
								class="thumbnail"
								class:active={i === currentImageIndex}
								type="button"
								onclick={(e) => { e.stopPropagation(); currentImageIndex = i; }}
								aria-label={`View image ${i + 1}`}
							>
								<img
									src={'thumbnail' in image && image.thumbnail ? image.thumbnail : image.url}
									alt={image.altText || `Thumbnail ${i + 1}`}
									loading="lazy"
									onerror={() => {
										handleImageError(image.url);
									}}
								/>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Link Previews (only when no images) -->
		{#if visibleImages.length === 0 && post.linkPreviews && post.linkPreviews.length > 0}
			<div class="link-previews-section">
				{#if loadingPreviews}
					<!-- Show skeleton while loading -->
					{#each post.linkPreviews as _ (Math.random())}
						<SkeletonCard mode="card" />
					{/each}
				{:else if shouldShowLinkPreviews}
					<!-- Show actual preview cards with fade-in -->
					{#each linkPreviewsMetadata as preview (preview.url)}
						<div class="preview-card-wrapper">
							<LinkPreviewCard {preview} mode="card" />
						</div>
					{/each}
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
					{#each visibleComments as comment (comment.id)}
						<div class="comment">
							<div class="comment-content">
								<a
									href={comment.author.url}
									target="_blank"
									rel="noopener noreferrer"
									class="comment-author"
									onclick={(e) => e.stopPropagation()}
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
													onclick={(e) => e.stopPropagation()}
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
	</div>
{/snippet}

{#if username}
	<!-- Wrapper for nested cards (when saved/commented by user) -->
	<div class="nested-wrapper">
		<!-- Nested header outside the card -->
		<div class="nested-header">
			<span class="nested-text">
				<strong>{username}</strong> {post.comment ? 'commented on' : 'saved'} <a href="/{username}/{post.shareId}" class="post-link">this post</a>
				{#if archiveTime}
					<span class="nested-time"> · {archiveTime}</span>
				{/if}
			</span>
		</div>

		<!-- User's comment (if exists) -->
		{#if post.comment}
			<div class="user-comment">
				{post.comment}
			</div>
		{/if}

		<!-- The actual post card -->
		<article
			class="post-card nested-card"
			aria-label={`Post by ${post.author.name} on ${post.platform}`}
		>
			{@render cardContent()}
		</article>
	</div>
{:else}
	<!-- Regular post card without nesting -->
	<article
		class="post-card"
		aria-label={`Post by ${post.author.name} on ${post.platform}`}
	>
		{@render cardContent()}
	</article>
{/if}

<style>
	/* Nested wrapper - wraps entire card when saved/commented by user */
	.nested-wrapper {
		position: relative;
		padding-bottom: 1rem; /* Add padding to separate vertical line from bottom border */
		border-bottom: 1px solid var(--background-modifier-border);
	}

	/* Remove bottom border from last nested wrapper */
	.nested-wrapper:last-child {
		border-bottom: none;
	}

	/* Nested header - "username saved this post · 2h ago" */
	.nested-header {
		margin-bottom: 0.375rem; /* Reduced from 0.75rem */
		padding-left: 0;
		font-size: var(--font-size-base);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.nested-text strong {
		color: var(--text-normal);
		font-weight: 600;
	}

	.nested-time {
		color: var(--text-faint);
		font-size: var(--font-size-sm);
	}

	.post-link {
		font-weight: 600;
		color: var(--text-normal);
		text-decoration: none;
		cursor: pointer;
		transition: color 0.2s;
	}

	.post-link:hover {
		color: var(--interactive-accent);
		text-decoration: underline;
	}

	/* User's personal comment */
	.user-comment {
		font-size: var(--font-size-base);
		line-height: 1.5;
		color: var(--text-normal);
		margin-bottom: 0.75rem;
		padding: 0;
		word-break: break-word;
		white-space: pre-wrap;
	}

	/* Card Container - Only bottom border between posts */
	.post-card {
		position: relative;
		background-color: var(--background-primary);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	/* Remove bottom border from last card (when not nested) */
	.post-card:last-child {
		border-bottom: none;
	}

	/* Nested cards - vertical line on the left to show nesting */
	.post-card.nested-card {
		position: relative;
		border-bottom: none;
		margin-bottom: 0;
		margin-left: 0.75rem;
		padding-left: 1.25rem;
	}

	/* Vertical line for nested cards - separate element for better control */
	.post-card.nested-card::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.75rem; /* Start from author name position */
		bottom: 0.5rem; /* Stop before reaching bottom to avoid connecting with border */
		width: 2px;
		background-color: var(--background-modifier-border);
	}

	/* Remove top border from first card */
	.post-card:first-child {
		border-top: none;
	}

	/* Also remove for first nested wrapper */
	.nested-wrapper:first-child .post-card {
		border-top: none;
	}

	.card-content {
		padding: 0.75rem 1.25rem; /* Further reduced top/bottom padding */
	}

	.card-content.clickable {
		cursor: pointer;
		/* No hover effects - clean minimal design */
	}

	/* Platform Icon */
	.platform-icon {
		position: absolute;
		top: 1rem;
		right: 1.25rem;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.25;
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
		color: var(--text-muted);
		width: 100%;
		height: 100%;
	}

	/* Header */
	.post-header {
		margin-bottom: 0.25rem; /* Reduced from 0.5rem */
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
		display: inline-block;
		margin-bottom: 0; /* Removed margin */
		font-size: var(--font-size-md);
		font-weight: 600;
		line-height: 1.2; /* Reduced line-height for tighter spacing */
		max-width: calc(100% - 3rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.timestamp {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		display: block;
		margin-top: 0; /* Removed margin for tighter spacing */
		line-height: 1.2; /* Reduced line-height */
	}

	/* Content */
	.post-content {
		margin-bottom: 0.5rem; /* Reduced from 0.75rem */
	}

	.content-text {
		font-size: var(--font-size-md);
		line-height: 1.6;
		color: var(--text-normal);
		word-break: break-word;
		margin: 0;
	}

	.see-more-btn {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		margin-top: 0.25rem; /* Reduced from 0.375rem */
		display: inline-block;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.2s;
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

	/* Link Previews Section */
	.link-previews-section {
		margin: 0.75rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Preview card wrapper with fade-in animation */
	.preview-card-wrapper {
		animation: preview-fade-in 0.3s ease-in;
	}

	@keyframes preview-fade-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Accessibility - Reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.preview-card-wrapper {
			animation: none;
		}
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
		z-index: 10;
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
		background: none;
		padding: 0;
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
		gap: 1.25rem;
		margin-top: 0.5rem; /* Reduced from 0.75rem */
		padding-top: 0.5rem; /* Reduced from 0.75rem */
		border-top: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		flex-wrap: wrap;
		font-size: var(--font-size-base);
	}

	.interaction-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: default;
		transition: color 0.2s;
	}

	.interaction-item:hover {
		color: var(--text-normal);
	}

	.spacer {
		flex: 1;
	}

	.share-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.125rem 0.25rem;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s;
	}

	.share-button:hover {
		color: var(--interactive-accent);
	}

	/* Inline hashtag links */
	:global(.hashtag-link) {
		color: var(--interactive-accent);
		font-weight: 500;
		text-decoration: none;
		transition: all 0.2s;
	}

	:global(.hashtag-link:hover) {
		text-decoration: underline;
		opacity: 0.8;
	}

	/* Comments Section */
	.comments-section {
		margin-top: 12px;
	}

	.view-all-comments-btn {
		font-size: var(--font-size-base);
		color: var(--text-muted);
		cursor: pointer;
		margin-bottom: 8px;
		background: transparent;
		border: none;
		padding: 0;
		font-family: inherit;
	}

	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.comment {
		font-size: var(--font-size-base);
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

	.comment-text {
		color: var(--text-normal);
		margin-left: 4px;
	}

	.comment-time {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		margin-left: 8px;
	}

	.comment-likes {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
	}

	.comment-replies {
		margin-top: 8px;
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.card-content {
			padding: 0.625rem 1rem;
		}

		.nested-header {
			font-size: var(--font-size-sm);
			margin-bottom: 0.25rem; /* Reduced from 0.5rem */
		}

		.post-card.nested-card {
			margin-left: 0.5rem;
			padding-left: 1rem;
		}

		.post-card.nested-card::before {
			top: 0.625rem; /* Start from author name position on mobile */
		}

		.platform-icon {
			right: 1rem;
			width: 1.75rem;
			height: 1.75rem;
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
			font-size: var(--font-size-sm);
			padding-top: 0.375rem; /* Further reduced for mobile */
			margin-top: 0.375rem; /* Further reduced for mobile */
		}

		.author-name {
			font-size: var(--font-size-base);
		}

		.content-text {
			font-size: var(--font-size-base);
			line-height: 1.5;
		}
	}
</style>
