<script lang="ts">
	import type { LinkPreview } from '$lib/types';

	interface Props {
		preview: LinkPreview;
		/**
		 * Display mode: 'card' shows full card with image, 'compact' shows minimal version
		 */
		mode?: 'card' | 'compact';
		/**
		 * Optional click handler
		 */
		onClick?: (url: string) => void;
	}

	let { preview, mode = 'card', onClick }: Props = $props();

	// State for image loading
	let imageLoadError = $state(false);
	let imageLoaded = $state(false);

	// Extract domain from URL for display
	const domain = $derived.by(() => {
		try {
			const url = new URL(preview.url);
			return url.hostname.replace(/^www\./, '');
		} catch {
			return preview.url;
		}
	});

	// Determine if we should show the image
	const shouldShowImage = $derived(
		mode === 'card' && preview.image && !imageLoadError
	);

	// Handle image load error
	function handleImageError() {
		imageLoadError = true;
	}

	// Handle image load success
	function handleImageLoad() {
		imageLoaded = true;
	}

	// Handle card click
	function handleClick(event: MouseEvent) {
		if (onClick) {
			event.preventDefault();
			onClick(preview.url);
		}
	}

	// Truncate text to a maximum length
	function truncate(text: string | undefined, maxLength: number): string {
		if (!text) return '';
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength).trim() + '...';
	}
</script>

<a
	href={preview.url}
	target="_blank"
	rel="noopener noreferrer"
	class="link-preview-card"
	class:card-mode={mode === 'card'}
	class:compact-mode={mode === 'compact'}
	class:has-image={shouldShowImage}
	onclick={handleClick}
	aria-label={`Link preview: ${preview.title}`}
>
	<!-- Image Section (Card mode only) -->
	{#if shouldShowImage}
		<div class="preview-image">
			{#if !imageLoaded && !imageLoadError}
				<div class="image-loading">
					<div class="loading-spinner"></div>
				</div>
			{/if}
			<img
				src={preview.image || ''}
				alt={preview.title}
				class="preview-img"
				loading="lazy"
				width={400}
				height={300}
				onerror={handleImageError}
				onload={handleImageLoad}
			/>
		</div>
	{/if}

	<!-- Content Section -->
	<div class="preview-content">
		<!-- Site Name / Domain with Favicon -->
		<div class="preview-meta">
			{#if preview.favicon}
				<img
					src={preview.favicon}
					alt=""
					class="favicon"
					width="16"
					height="16"
					onerror={(e) => {
						(e.currentTarget as HTMLImageElement).style.display = 'none';
					}}
				/>
			{/if}
			<span class="domain">{preview.siteName || domain}</span>
		</div>

		<!-- Title -->
		<h3 class="preview-title">
			{mode === 'card' ? truncate(preview.title, 100) : truncate(preview.title, 60)}
		</h3>

		<!-- Description (Card mode only) -->
		{#if mode === 'card' && preview.description}
			<p class="preview-description">
				{truncate(preview.description, 150)}
			</p>
		{/if}

		<!-- External Link Icon -->
		<div class="external-icon" aria-hidden="true">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
				<polyline points="15 3 21 3 21 9"></polyline>
				<line x1="10" y1="14" x2="21" y2="3"></line>
			</svg>
		</div>
	</div>
</a>

<style>
	.link-preview-card {
		display: flex;
		text-decoration: none;
		color: inherit;
		border: 1px solid var(--border-color, #e5e5e5);
		border-radius: 8px;
		overflow: hidden;
		transition: all 0.2s ease;
		background: var(--bg-primary, #ffffff);
		position: relative;
	}

	.link-preview-card:hover {
		border-color: var(--border-hover, #ccc);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.link-preview-card:active {
		transform: translateY(0);
	}

	/* Card Mode (Full card with image) */
	.card-mode {
		flex-direction: column;
	}

	/* Compact Mode (Minimal, no image) */
	.compact-mode {
		flex-direction: row;
		align-items: center;
		padding: 12px;
		min-height: 60px;
	}

	/* Image Section */
	.preview-image {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: var(--bg-secondary, #f3f3f3);
		overflow: hidden;
	}

	.image-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary, #f3f3f3);
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border-color, #e5e5e5);
		border-top-color: var(--accent-color, #3b82f6);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: scale-down;
		display: block;
		background: var(--bg-secondary, #f3f3f3);
	}

	/* Content Section */
	.preview-content {
		padding: 12px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		position: relative;
	}

	.card-mode .preview-content {
		padding: 16px;
	}

	.compact-mode .preview-content {
		padding: 0;
		gap: 4px;
	}

	/* Meta (Favicon + Domain) */
	.preview-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		color: var(--text-muted, #666);
	}

	.favicon {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}

	.domain {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Title */
	.preview-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
		color: var(--text-primary, #1a1a1a);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.compact-mode .preview-title {
		font-size: 0.875rem;
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}

	/* Description */
	.preview-description {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--text-secondary, #4a4a4a);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	/* External Link Icon */
	.external-icon {
		position: absolute;
		bottom: 12px;
		right: 12px;
		opacity: 0.4;
		transition: opacity 0.2s;
	}

	.link-preview-card:hover .external-icon {
		opacity: 0.7;
	}

	.compact-mode .external-icon {
		position: static;
		margin-left: auto;
		flex-shrink: 0;
	}

	/* Mobile Responsive - Ensure minimum touch target of 44px */
	@media (max-width: 640px) {
		.link-preview-card {
			min-height: 44px;
		}

		.preview-content {
			padding: 14px;
		}

		.compact-mode .preview-content {
			padding: 0 12px;
		}

		.preview-title {
			font-size: 0.875rem;
		}

		.preview-description {
			font-size: 0.8125rem;
		}
	}

	/* Accessibility - Focus state */
	.link-preview-card:focus {
		outline: 2px solid var(--accent-color, #3b82f6);
		outline-offset: 2px;
	}

	/* Accessibility - Reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.link-preview-card {
			transition: none;
		}

		.loading-spinner {
			animation: none;
		}
	}

	/* Dark Mode Support */
	@media (prefers-color-scheme: dark) {
		.link-preview-card {
			background: var(--background-secondary, #161616);
			border-color: var(--background-modifier-border, #27272a);
		}

		.link-preview-card:hover {
			border-color: var(--background-modifier-border-hover, #3f3f46);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		}

		.preview-image {
			background: var(--background-secondary-alt, #1a1a1a);
		}

		.image-loading {
			background: var(--background-secondary-alt, #1a1a1a);
		}

		.loading-spinner {
			border-color: var(--background-modifier-border, #27272a);
			border-top-color: var(--interactive-accent, #6366f1);
		}

		.preview-img {
			background: var(--background-secondary-alt, #1a1a1a);
		}

		.preview-meta {
			color: var(--text-muted, #a1a1aa);
		}

		.preview-title {
			color: var(--text-normal, #e4e4e7);
		}

		.preview-description {
			color: var(--text-muted, #a1a1aa);
		}

		.link-preview-card:focus {
			outline-color: var(--interactive-accent, #6366f1);
		}
	}
</style>
