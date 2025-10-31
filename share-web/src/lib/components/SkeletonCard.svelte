<script lang="ts">
	interface Props {
		mode?: 'card' | 'compact';
	}

	let { mode = 'card' }: Props = $props();
</script>

<div
	class="skeleton-card"
	class:card-mode={mode === 'card'}
	class:compact-mode={mode === 'compact'}
	aria-label="Loading link preview"
>
	<!-- Image skeleton (card mode only) -->
	{#if mode === 'card'}
		<div class="skeleton-image"></div>
	{/if}

	<!-- Content skeleton -->
	<div class="skeleton-content">
		<!-- Domain line -->
		<div class="skeleton-line skeleton-domain"></div>

		<!-- Title lines -->
		<div class="skeleton-line skeleton-title"></div>
		<div class="skeleton-line skeleton-title-short"></div>

		<!-- Description (card mode only) -->
		{#if mode === 'card'}
			<div class="skeleton-line skeleton-description"></div>
			<div class="skeleton-line skeleton-description-short"></div>
		{/if}
	</div>
</div>

<style>
	.skeleton-card {
		display: flex;
		border: 1px solid var(--border-color, #e5e5e5);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-primary, #ffffff);
		position: relative;
		animation: skeleton-fade-in 0.2s ease-in;
	}

	@keyframes skeleton-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Card Mode */
	.card-mode {
		flex-direction: column;
	}

	/* Compact Mode */
	.compact-mode {
		flex-direction: row;
		align-items: center;
		padding: 12px;
		min-height: 60px;
	}

	/* Skeleton Image */
	.skeleton-image {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: linear-gradient(
			90deg,
			var(--bg-secondary, #f3f3f3) 0%,
			var(--bg-modifier-hover, #e8e8e8) 50%,
			var(--bg-secondary, #f3f3f3) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Skeleton Content */
	.skeleton-content {
		padding: 12px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card-mode .skeleton-content {
		padding: 16px;
	}

	.compact-mode .skeleton-content {
		padding: 0;
		gap: 6px;
	}

	/* Skeleton Lines */
	.skeleton-line {
		height: 12px;
		border-radius: 4px;
		background: linear-gradient(
			90deg,
			var(--bg-secondary, #f3f3f3) 0%,
			var(--bg-modifier-hover, #e8e8e8) 50%,
			var(--bg-secondary, #f3f3f3) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	.skeleton-domain {
		width: 30%;
		height: 10px;
		opacity: 0.6;
	}

	.skeleton-title {
		width: 90%;
		height: 14px;
	}

	.skeleton-title-short {
		width: 60%;
		height: 14px;
	}

	.skeleton-description {
		width: 95%;
		height: 12px;
		margin-top: 4px;
	}

	.skeleton-description-short {
		width: 70%;
		height: 12px;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.skeleton-content {
			padding: 14px;
		}

		.compact-mode .skeleton-content {
			padding: 0 12px;
		}
	}

	/* Accessibility - Reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.skeleton-card {
			animation: none;
		}

		.skeleton-image,
		.skeleton-line {
			animation: none;
			background: var(--bg-secondary, #f3f3f3);
		}
	}
</style>
