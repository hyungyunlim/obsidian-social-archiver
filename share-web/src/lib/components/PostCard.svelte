<script lang="ts">
	import type { Post } from '$lib/types';
	import PlatformIcon from './PlatformIcon.svelte';
	import SeeMoreButton from './SeeMoreButton.svelte';

	interface Props {
		post: Post;
		showShareButton?: boolean;
	}

	let { post, showShareButton = true }: Props = $props();

	// Svelte 5 Runes
	let expanded = $state(false);

	// Content truncation logic
	const previewLength = 500;
	const needsTruncation = $derived(post.content.text.length > previewLength);
	const displayContent = $derived(
		needsTruncation && !expanded
			? post.content.text.substring(0, previewLength) + '...'
			: post.content.text
	);

	// Format relative time
	function getRelativeTime(timestamp: string): string {
		const now = new Date();
		const date = new Date(timestamp);
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

	// Get first image for thumbnail
	const thumbnail = $derived(
		post.thumbnail ||
		post.media.find(m => m.type === 'image')?.thumbnail ||
		post.media.find(m => m.type === 'image')?.url
	);

	// Actions
	function handleShare() {
		if (post.shareUrl) {
			navigator.clipboard.writeText(post.shareUrl);
		}
	}
</script>

<article class="post-card" role="article" aria-label={`Post by ${post.author.name} on ${post.platform}`}>
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
			<p class="content-text">{displayContent}</p>
			{#if needsTruncation}
				<SeeMoreButton {expanded} onclick={() => expanded = !expanded} />
			{/if}
		</div>

		<!-- Media Preview (if available) -->
		{#if thumbnail && post.media.length > 0}
			<div class="media-preview">
				{#if post.media.length === 1}
					<img
						src={thumbnail}
						alt={post.media[0].altText || 'Post media'}
						class="single-image"
						loading="lazy"
					/>
				{:else}
					<div class="media-grid" data-count={Math.min(post.media.length, 4)}>
						{#each post.media.slice(0, 4) as media, i}
							{#if media.type === 'image'}
								<img
									src={media.thumbnail || media.url}
									alt={media.altText || `Media ${i + 1}`}
									class="grid-image"
									loading="lazy"
								/>
							{/if}
						{/each}
						{#if post.media.length > 4}
							<div class="more-indicator">+{post.media.length - 4}</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Interactions Bar -->
		<footer class="interactions">
			{#if post.metadata.likes !== undefined}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
					</svg>
					{formatNumber(post.metadata.likes)}
				</span>
			{/if}

			{#if post.metadata.comments !== undefined}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					{formatNumber(post.metadata.comments)}
				</span>
			{/if}

			{#if post.metadata.shares !== undefined}
				<span class="interaction-item">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
					</svg>
					{formatNumber(post.metadata.shares)}
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
	</div>
</article>

<style>
	.post-card {
		position: relative;
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--background-primary, #ffffff);
		transition: all 0.2s;
		margin-bottom: 1rem;
		border: 1px solid var(--background-modifier-border, #e5e7eb);
	}

	.post-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		background-color: var(--background-modifier-hover, #f9fafb);
	}

	/* Platform Icon */
	.platform-icon {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.3;
		transition: opacity 0.2s;
	}

	.platform-icon:hover {
		opacity: 0.6;
	}

	.platform-icon a {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-accent, #3b82f6);
	}

	/* Content Area */
	.content-area {
		padding-right: 3.5rem;
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
		color: var(--interactive-accent, #3b82f6);
	}

	.author-name {
		color: var(--text-normal, #111827);
		display: block;
		margin-bottom: 0.25rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.timestamp {
		font-size: 0.75rem;
		color: var(--text-muted, #6b7280);
	}

	/* Content */
	.post-content {
		margin-bottom: 0.75rem;
	}

	.content-text {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-normal, #111827);
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}

	/* Media Preview */
	.media-preview {
		margin: 0.75rem 0;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.single-image {
		width: 100%;
		height: auto;
		display: block;
	}

	.media-grid {
		display: grid;
		gap: 2px;
		grid-template-columns: repeat(2, 1fr);
		position: relative;
	}

	.media-grid[data-count="3"] {
		grid-template-areas:
			"a b"
			"a c";
	}

	.media-grid[data-count="3"] .grid-image:first-child {
		grid-area: a;
	}

	.grid-image {
		width: 100%;
		height: 200px;
		object-fit: cover;
	}

	.more-indicator {
		position: absolute;
		bottom: 8px;
		right: 8px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	/* Interactions */
	.interactions {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding-top: 0.75rem;
		margin-top: 0.75rem;
		border-top: 1px solid var(--background-modifier-border, #e5e7eb);
		color: var(--text-muted, #6b7280);
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
		color: var(--interactive-accent, #3b82f6);
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
		color: var(--text-muted, #6b7280);
		cursor: pointer;
		transition: color 0.2s;
	}

	.share-button:hover {
		color: var(--interactive-accent, #3b82f6);
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.post-card {
			background-color: #1f2937;
			border-color: #374151;
		}

		.post-card:hover {
			background-color: #111827;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		}

		.author-name,
		.content-text {
			color: #f3f4f6;
		}

		.timestamp,
		.interactions {
			color: #9ca3af;
		}

		.interaction-item:hover,
		.share-button:hover,
		.author-link:hover {
			color: #60a5fa;
		}

		.interactions {
			border-top-color: #374151;
		}

		.platform-icon a {
			color: #60a5fa;
		}
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.post-card {
			padding: 0.875rem;
		}

		.content-area {
			padding-right: 3rem;
		}

		.media-grid {
			grid-template-columns: 1fr;
		}

		.grid-image {
			height: 150px;
		}

		.interactions {
			gap: 1rem;
		}
	}
</style>