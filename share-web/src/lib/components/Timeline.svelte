<script lang="ts">
	import type { Post } from '$lib/types';
	import PostCard from './PostCard.svelte';

	interface Props {
		posts: Post[];
		loading?: boolean;
		emptyMessage?: string;
		gridLayout?: 'single' | 'masonry' | 'grid';
		showShareButtons?: boolean;
	}

	let {
		posts,
		loading = false,
		emptyMessage = 'No posts to display',
		gridLayout = 'single',
		showShareButtons = true
	}: Props = $props();

	// Filter and sort posts
	const sortedPosts = $derived(
		posts.slice().sort((a, b) => {
			const dateA = new Date(a.metadata.timestamp);
			const dateB = new Date(b.metadata.timestamp);
			return dateB.getTime() - dateA.getTime(); // Newest first
		})
	);
</script>

<div class="timeline-container" data-layout={gridLayout}>
	{#if loading}
		<div class="loading-container">
			<div class="loading-spinner"></div>
			<p class="loading-text">Loading posts...</p>
		</div>
	{:else if sortedPosts.length === 0}
		<div class="empty-state">
			<svg
				class="empty-icon"
				viewBox="0 0 24 24"
				width="48"
				height="48"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
				<line x1="9" y1="9" x2="15" y2="9" />
				<line x1="9" y1="13" x2="12" y2="13" />
			</svg>
			<p class="empty-text">{emptyMessage}</p>
		</div>
	{:else}
		<div class="posts-grid">
			{#each sortedPosts as post (post.shareId)}
				<div class="post-wrapper">
					<PostCard {post} showShareButton={showShareButtons} />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.timeline-container {
		min-height: 200px;
		padding: 1rem;
	}

	/* Grid Layouts */
	.posts-grid {
		display: grid;
		gap: 1rem;
	}

	/* Single column layout (default) */
	.timeline-container[data-layout="single"] .posts-grid {
		grid-template-columns: 1fr;
		max-width: 42rem;
		margin: 0 auto;
	}

	/* Masonry-like layout */
	.timeline-container[data-layout="masonry"] .posts-grid {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		align-items: start;
	}

	/* Grid layout */
	.timeline-container[data-layout="grid"] .posts-grid {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	}

	.post-wrapper {
		container-type: inline-size;
		min-width: 0; /* Prevent overflow */
	}

	/* Loading State */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		color: var(--text-muted, #6b7280);
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--background-modifier-border, #e5e7eb);
		border-top-color: var(--interactive-accent, #3b82f6);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: 0.875rem;
		margin: 0;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		color: var(--text-muted, #6b7280);
		padding: 2rem;
		text-align: center;
	}

	.empty-icon {
		opacity: 0.3;
		margin-bottom: 1rem;
	}

	.empty-text {
		font-size: 0.875rem;
		margin: 0;
		max-width: 300px;
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.timeline-container {
			background-color: #111827;
		}

		.loading-container,
		.empty-state {
			color: #9ca3af;
		}

		.loading-spinner {
			border-color: #374151;
			border-top-color: #60a5fa;
		}
	}

	/* Mobile optimizations */
	@media (max-width: 640px) {
		.timeline-container {
			padding: 0.5rem;
		}

		/* Force single column on mobile */
		.posts-grid {
			grid-template-columns: 1fr !important;
		}
	}

	/* Tablet optimizations */
	@media (min-width: 641px) and (max-width: 1024px) {
		.timeline-container[data-layout="masonry"] .posts-grid,
		.timeline-container[data-layout="grid"] .posts-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Desktop optimizations */
	@media (min-width: 1025px) {
		.timeline-container[data-layout="masonry"] .posts-grid,
		.timeline-container[data-layout="grid"] .posts-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Ultra-wide screens */
	@media (min-width: 1536px) {
		.timeline-container[data-layout="masonry"] .posts-grid,
		.timeline-container[data-layout="grid"] .posts-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	/* Container queries for responsive cards */
	@container (max-width: 400px) {
		.post-wrapper {
			font-size: 0.875rem;
		}
	}
</style>